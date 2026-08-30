# Client — React (Vite) + chess.js

The chess client: board rendering, click-to-move with legal-move
highlighting, optimistic move prediction, server-driven rollback, a
network-condition simulator, and a game-history view backed by the
server's MongoDB data.

## Stack

- **React 19** via **Vite**
- Plain `WebSocket` (browser built-in) — matches the server's raw `ws`
- **chess.js** — used client-side purely for move generation (which
  squares to highlight) and local board rendering; the server is still
  the only one who decides what actually counts

## Structure

```
client/
├── index.html
├── vite.config.js
└── src/
    ├── main.jsx
    ├── App.jsx
    ├── index.css
    ├── hooks/
    │   └── useChessSocket.js     connection + optimistic move + reconciliation
    └── components/
        ├── ChessBoard.jsx        8x8 grid from FEN, click-to-select/move
        ├── PromotionModal.jsx    pawn promotion piece picker
        ├── MoveHistory.jsx       SAN move list, paired by move number
        ├── NetworkControls.jsx   latency / jitter / packet-loss sliders
        └── GameHistory.jsx       fetches GET /api/games from the server
```

## Setup

Requires the server running first (see `../server/README.md`).

```bash
npm install
npm run dev
```

Opens on `http://localhost:5173` by default. Open it in two tabs (or two
machines) to play — first tab is White, second is Black. Click a piece
to see its legal destinations highlighted, click a highlighted square to
move. Pawn promotions open a small picker for Queen/Rook/Bishop/Knight.

```bash
npm run build      # outputs static files to dist/
npm run preview    # serve the production build locally to sanity-check it
```

## Talking to the server

In dev, `useChessSocket.js` and `GameHistory.jsx` both hardcode
`localhost:8080` as the server (Vite's dev server runs on a different
port). In production both resolve to the same origin the page was
served from, which is why the Docker build serves everything from one
Express process on one port.

## How a move actually happens (`useChessSocket.js`)

1. Click a square you own on your turn → legal destinations get computed
   via `chess.moves({square, verbose:true})` and highlighted.
2. Click a highlighted square → the move is applied **immediately** to a
   local `Chess` instance (this is the "prediction" — no waiting on the
   network), then sent to the server as `{type:'move', from, to}`.
3. If the server accepts it, its next `state` broadcast just confirms
   what you already see — no visible change.
4. If the server rejects it (`move_rejected`) — most likely because a
   `state` update you hadn't received yet changed whose turn it is —
   the client reloads its board from the FEN the server sent back,
   snapping to the truth. Try cranking the latency slider up to make
   this actually happen: click quickly right as your opponent's move is
   "in flight" under simulated lag.

See the root `README.md` for the full architecture explanation.
