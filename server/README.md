# Server — Express + WebSocket (ws) + MongoDB (Mongoose) + chess.js

Authoritative chess server and REST API. Run this first — the client
needs it to connect to.

## Stack

- **Express** — REST API (`/api/games`) and serves the built React
  client in production
- **ws** — raw WebSocket server attached to the same `http.Server`,
  carrying move proposals and state broadcasts
- **chess.js** — the single source of truth on legal moves, check,
  checkmate, stalemate, and draw detection
- **Mongoose / MongoDB** — persists completed games (players, full move
  list, PGN, result) — not live game state, which stays in memory

## Structure

```
server/
├── server.js          HTTP + WS server, chess.js game logic, Mongo persistence
├── models/
│   └── Game.js         Mongoose schema for a completed/in-progress game
├── routes/
│   └── games.js         GET /api/games
├── package.json
└── .env.example
```

## Setup

```bash
cp .env.example .env     # edit MONGO_URI if your Mongo isn't on localhost:27017
npm install
npm start
```

Runs on `http://localhost:8080` by default (`PORT` env var to change it).
Works fine for gameplay even with no MongoDB running — logs a warning
and `/api/games` returns `503` with an empty list rather than crashing.

## Endpoints

| Method | Path            | Description                                  |
|--------|-----------------|-----------------------------------------------|
| GET    | `/api/games`    | Last 20 games (newest first)                  |
| WS     | `/` (upgrade)   | Game connection — see message shapes below    |
| GET    | `/*`            | Serves built React client if `./public` exists|

## WebSocket protocol

**Server → client**
- `{type:'welcome', id, color, fen, turn, inCheck, isGameOver, isCheckmate, isStalemate, isDraw}` — sent once on connect. `color` is `'w'` or `'b'`; first connection gets White.
- `{type:'full'}` — sent + connection closed if 2 players already connected (this demo is single-room, no spectators)
- `{type:'roster', players:[{id,color}]}` — sent whenever a player joins/leaves
- `{type:'state', fen, turn, lastMove, inCheck, isGameOver, isCheckmate, isStalemate, isDraw}` — broadcast after every accepted move. `lastMove` is `{from, to, san, color}` or `null` on a fresh board.
- `{type:'move_rejected', reason, fen, turn}` — sent only to the player whose move didn't validate (`reason` is `'not your turn'`, `'illegal move'`, or `'waiting for opponent'`). Includes the true authoritative FEN so the client can roll back.

**Client → server**
- `{type:'move', from, to, promotion?}` — `promotion` defaults to `'q'` if omitted; only matters when the move is a pawn promotion
- `{type:'new_game'}` — resets the board; ignored unless the current game is already over

## How a game gets logged

A `Game` document is created in Mongo as soon as the 2nd player connects
(`startedAt`, `players`). It's finalized — `endedAt`, `result`
(`'white'|'black'|'draw'`), `endReason`
(`'checkmate'|'stalemate'|'draw'|'disconnect'`), the full `moves` (SAN)
array, and `pgn` — when the game actually ends, whether by checkmate/
stalemate/draw or a player disconnecting mid-game (which is scored as a
forfeit to whoever's left).

See the root `README.md` for the full architecture explanation and
Docker instructions.
