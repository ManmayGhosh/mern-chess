# 2-Player Realtime Chess — MERN Stack

A 2-player chess game where the server is the sole authority on legal
moves (via [chess.js](https://github.com/jhlywa/chess.js)), the client
predicts your own moves instantly, and completed games are logged to
MongoDB. Built as **M**ongoDB, **E**xpress, **R**eact, **N**ode.

## Project layout

```
mern-netcode/
├── server/     Express + ws + Mongoose + chess.js   → see server/README.md
├── client/     React (Vite) + chess.js               → see client/README.md
├── Dockerfile                 multi-stage: build React, bundle into server image
└── docker-compose.yml         mongo + app
```

Each package has its own README with setup and structure specific to
that half. This root README covers running the whole stack together and
the architecture ideas that span both.

## Run it

### With Docker (recommended — brings up Mongo too)

```bash
docker compose up --build
```

Open **http://localhost:8080** in two tabs (or two machines pointing at
the host's LAN IP). First tab to connect plays White, second plays
Black. Click a piece to see its legal moves highlighted, click a
highlighted square to move.

### Locally without Docker (two terminals + Mongo running somewhere)

See `server/README.md` and `client/README.md` for details. In short:

Terminal 1 — server:
```bash
cd server
cp .env.example .env
npm install
npm start
```

Terminal 2 — client:
```bash
cd client
npm install
npm run dev
```

Open the Vite dev URL (usually **http://localhost:5173**) in two tabs.

## How it works

**Server is the sole authority on legal moves (`server/server.js`)**
The server holds one authoritative `Chess` instance. Clients never
decide what's legal — they send a proposed `{from, to, promotion}` and
the server either accepts it (broadcasting the new position to both
players) or rejects it with a reason and the true board state.

**Client-side prediction**
When you click a legal move, `useChessSocket` applies it to a local
`Chess` instance immediately — the board updates before any round trip.
This is the same "don't wait for the network to feel responsive"
principle as continuous-movement games, just applied to a turn-based
one.

**Reconciliation**
If the server rejects a move (stale client state, or an out-of-turn
click that beat an incoming update under simulated lag), the client
reloads its board from the authoritative FEN the server sent back —
snapping to the correct position rather than getting stuck showing an
illegal move. This is deliberately simpler than the prediction/replay
dance a continuous-movement game needs, because in chess only one side
can legally act at a time — there's no "unconfirmed inputs to replay,"
just "trust the server's FEN completely."

**Simulated network conditions**
The latency/jitter/packet-loss sliders (same mechanism a
continuous-movement demo would use) let you see prediction and
reconciliation actually matter: crank latency up and your own moves
still feel instant, while the opponent's board — and any rejection —
visibly lags.

**MongoDB's role**
Live game state stays in server memory (a single `Chess` instance per
room) — there's nothing to gain from putting that in a database. Mongo
instead persists finished games: start/end time, full SAN move list,
PGN, and result (checkmate/stalemate/draw/disconnect). `GET /api/games`
serves the last 20 for the `GameHistory` component to display. This is
the natural split for any realtime game backend: durable history in the
database, hot authoritative state in memory.

## Known limitations / good next steps

- **Single room.** All connections share one game; a 3rd connection is
  rejected. Multiple concurrent games would need a room/matchmaking
  layer.
- **No reconnection to an in-progress game.** If a player disconnects
  mid-game, the game is logged as a disconnect-forfeit and the board
  resets — there's no session/auth to let them resume the same seat.
- **No clocks.** Real chess servers sync per-player time budgets, which
  is its own interesting sync problem (server-authoritative clock
  ticking down, paused on the opponent's turn, resolved on flag-fall)
  — a natural extension if you want more of the original "netcode under
  lag" flavor.
- **No player accounts.** Colors are assigned by connection order, not
  by identity. Add an Express auth route + a `User` model to support that.
- **No spectators.** Rejecting a 3rd connection is the simplest option
  ("full") rather than a fan-out spectator mode.
