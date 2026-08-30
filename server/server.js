/**
 * Backend for 2-player realtime chess.
 *
 * Netcode model, adapted for a turn-based game:
 *   - The server holds the one authoritative `Chess` instance (chess.js).
 *     Clients never decide what's legal — they only propose moves.
 *   - The client still predicts optimistically: when you click a legal
 *     move locally, it renders immediately rather than waiting for a
 *     round trip. It then either gets confirmed by the next `state`
 *     broadcast, or rejected — in which case the client rolls back to
 *     the last server-confirmed position. This is the same
 *     predict-then-reconcile shape as continuous-movement netcode, just
 *     simpler, because only one side can legally move at a time.
 *   - Mongo logs completed games (players, full move list, PGN, result)
 *     — a natural fit for a turn-based game, unlike per-tick position
 *     data which would be far too granular to be useful.
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const http = require('http');
const path = require('path');
const fs = require('fs');
const WebSocket = require('ws');
const mongoose = require('mongoose');
const { Chess } = require('chess.js');

const Game = require('./models/Game');
const gamesRouter = require('./routes/games');

const PORT = process.env.PORT || 8080;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/netcode-demo';

// ---------------- Express app ----------------
const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/games', gamesRouter);

const staticDir = path.join(__dirname, 'public');
if (fs.existsSync(staticDir)) {
  app.use(express.static(staticDir));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(staticDir, 'index.html'), (err) => { if (err) next(); });
  });
} else {
  app.get('/', (req, res) => {
    res.type('text/plain').send(
      'Server is running, but no client build found at ./public.\n' +
      'In dev, run the client separately with `npm run dev` in ../client.'
    );
  });
}

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// ---------------- Mongo (non-blocking) ----------------
mongoose
  .connect(MONGO_URI)
  .then(() => console.log('[mongo] connected:', MONGO_URI))
  .catch((err) => console.warn('[mongo] connection failed, game history disabled:', err.message));

// ---------------- authoritative game state (single room) ----------------
const players = new Map(); // id -> { id, color: 'w'|'b', ws }
let nextPlayerId = 1;
let chess = new Chess();
let gameMoves = [];        // SAN move list for the game currently in progress
let currentGameDoc = null; // in-progress Mongoose doc, or null

function colorWord(c) { return c === 'w' ? 'white' : 'black'; }

function statusFlags() {
  return {
    inCheck: chess.isCheck(),
    isGameOver: chess.isGameOver(),
    isCheckmate: chess.isCheckmate(),
    isStalemate: chess.isStalemate(),
    isDraw: chess.isDraw(),
  };
}

function broadcast(obj) {
  const data = JSON.stringify(obj);
  for (const p of players.values()) {
    if (p.ws.readyState === WebSocket.OPEN) p.ws.send(data);
  }
}

function broadcastRoster() {
  broadcast({ type: 'roster', players: [...players.values()].map((p) => ({ id: p.id, color: p.color })) });
}

function broadcastState(lastMove) {
  broadcast({
    type: 'state',
    fen: chess.fen(),
    turn: chess.turn(),
    lastMove: lastMove || null,
    ...statusFlags(),
  });
}

async function maybeStartGameRecord() {
  if (players.size === 2 && !currentGameDoc && mongoose.connection.readyState === 1) {
    try {
      currentGameDoc = await Game.create({
        startedAt: new Date(),
        players: [...players.values()].map((p) => ({ playerId: p.id, color: p.color })),
      });
    } catch (err) {
      console.warn('[mongo] failed to create game record:', err.message);
      currentGameDoc = null;
    }
  }
}

async function finalizeGame(result, endReason) {
  if (!currentGameDoc) return;
  try {
    currentGameDoc.endedAt = new Date();
    currentGameDoc.result = result;
    currentGameDoc.endReason = endReason;
    currentGameDoc.moves = gameMoves;
    currentGameDoc.pgn = chess.pgn();
    await currentGameDoc.save();
  } catch (err) {
    console.warn('[mongo] failed to finalize game record:', err.message);
  }
  currentGameDoc = null;
}

function resetBoard() {
  chess = new Chess();
  gameMoves = [];
}

wss.on('connection', (ws) => {
  if (players.size >= 2) {
    ws.send(JSON.stringify({ type: 'full' }));
    ws.close();
    return;
  }

  const id = nextPlayerId++;
  const color = players.size === 0 ? 'w' : 'b';
  const player = { id, color, ws };
  players.set(id, player);

  ws.send(JSON.stringify({
    type: 'welcome',
    id,
    color,
    fen: chess.fen(),
    turn: chess.turn(),
    ...statusFlags(),
  }));

  broadcastRoster();
  maybeStartGameRecord();

  ws.on('message', async (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    if (msg.type === 'move') {
      if (players.size < 2) {
        ws.send(JSON.stringify({ type: 'move_rejected', reason: 'waiting for opponent', fen: chess.fen(), turn: chess.turn() }));
        return;
      }
      if (player.color !== chess.turn()) {
        ws.send(JSON.stringify({ type: 'move_rejected', reason: 'not your turn', fen: chess.fen(), turn: chess.turn() }));
        return;
      }
      let result;
      try {
        result = chess.move({ from: msg.from, to: msg.to, promotion: msg.promotion || 'q' });
      } catch {
        ws.send(JSON.stringify({ type: 'move_rejected', reason: 'illegal move', fen: chess.fen(), turn: chess.turn() }));
        return;
      }
      gameMoves.push(result.san);
      broadcastState({ from: result.from, to: result.to, san: result.san, color: result.color });

      if (chess.isGameOver()) {
        let outcome = 'draw';
        let reason = 'draw';
        if (chess.isCheckmate()) {
          // side to move is the one checkmated (stuck), so the other side wins
          outcome = chess.turn() === 'w' ? 'black' : 'white';
          reason = 'checkmate';
        } else if (chess.isStalemate()) {
          reason = 'stalemate';
        }
        await finalizeGame(outcome, reason);
      }
    } else if (msg.type === 'new_game') {
      if (!chess.isGameOver()) return; // ignore mid-game reset requests
      resetBoard();
      await maybeStartGameRecord();
      broadcastState(null);
    }
  });

  ws.on('close', async () => {
    const wasPresent = players.delete(id);
    if (wasPresent && currentGameDoc && !chess.isGameOver()) {
      const remaining = [...players.values()][0];
      const outcome = remaining ? colorWord(remaining.color) : 'draw';
      await finalizeGame(outcome, 'disconnect');
    }
    resetBoard();
    broadcastRoster();
    broadcastState(null);
  });
});

server.listen(PORT, () => console.log(`[server] listening on :${PORT}`));
