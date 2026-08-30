import { useCallback, useEffect, useRef, useState } from 'react';
import { Chess } from 'chess.js';

function defaultWsUrl() {
  if (import.meta.env.DEV) return 'ws://localhost:8080';
  const proto = location.protocol === 'https:' ? 'wss://' : 'ws://';
  return proto + location.host;
}

export function useChessSocket() {
  const [status, setStatus] = useState('connecting…');
  const [roster, setRoster] = useState([]);
  const [myId, setMyId] = useState(null);
  const [myColor, setMyColor] = useState(null);

  const [fen, setFen] = useState(new Chess().fen());
  const [turn, setTurn] = useState('w');
  const [lastMove, setLastMove] = useState(null);
  const [flags, setFlags] = useState({ inCheck: false, isGameOver: false, isCheckmate: false, isStalemate: false, isDraw: false });
  const [moveHistory, setMoveHistory] = useState([]);
  const [rejection, setRejection] = useState(null); // transient message when the server rejects our move

  const [selected, setSelected] = useState(null);       // square string, e.g. 'e2'
  const [legalTargets, setLegalTargets] = useState([]);  // squares the selected piece can move to
  const [pendingPromotion, setPendingPromotion] = useState(null); // {from, to} awaiting piece choice

  const chessRef = useRef(new Chess());
  const wsRef = useRef(null);
  const rejectionTimerRef = useRef(null);

  // Simulated network conditions — read live from a ref so slider changes
  // never need to reconnect or re-run effects.
  const settingsRef = useRef({ latency: 0, jitter: 0, loss: 0 });

  const simDelay = useCallback(() => {
    const { latency, jitter } = settingsRef.current;
    return Math.max(0, latency + (Math.random() * 2 - 1) * jitter);
  }, []);
  const simDrop = useCallback(() => Math.random() * 100 < settingsRef.current.loss, []);

  const syncFromChess = useCallback(() => {
    setFen(chessRef.current.fen());
    setTurn(chessRef.current.turn());
    setFlags({
      inCheck: chessRef.current.isCheck(),
      isGameOver: chessRef.current.isGameOver(),
      isCheckmate: chessRef.current.isCheckmate(),
      isStalemate: chessRef.current.isStalemate(),
      isDraw: chessRef.current.isDraw(),
    });
  }, []);

  const flashRejection = useCallback((text) => {
    setRejection(text);
    clearTimeout(rejectionTimerRef.current);
    rejectionTimerRef.current = setTimeout(() => setRejection(null), 1800);
  }, []);

  const handleMessage = useCallback((msg) => {
    if (msg.type === 'welcome') {
      setMyId(msg.id);
      setMyColor(msg.color);
      chessRef.current.load(msg.fen);
      syncFromChess();
      setMoveHistory([]);
      setStatus(`connected as ${msg.color === 'w' ? 'White' : 'Black'}`);
    } else if (msg.type === 'full') {
      setStatus('server full (2/2 players already connected)');
    } else if (msg.type === 'roster') {
      setRoster(msg.players);
    } else if (msg.type === 'state') {
      // Authoritative confirmation (or correction) — always trust this fully.
      chessRef.current.load(msg.fen);
      syncFromChess();
      setLastMove(msg.lastMove);
      setSelected(null);
      setLegalTargets([]);
      if (msg.lastMove) {
        setMoveHistory((h) => [...h, msg.lastMove.san]);
      } else {
        // null lastMove means a fresh/reset board
        setMoveHistory([]);
      }
    } else if (msg.type === 'move_rejected') {
      // --- reconciliation: our optimistic move didn't hold up, roll back ---
      chessRef.current.load(msg.fen);
      syncFromChess();
      setSelected(null);
      setLegalTargets([]);
      flashRejection(msg.reason === 'not your turn' ? "Not your turn yet" : "That move wasn't accepted — board resynced");
    }
  }, [syncFromChess, flashRejection]);

  const connect = useCallback((url) => {
    if (wsRef.current) { try { wsRef.current.close(); } catch { /* noop */ } }
    setStatus('connecting…');
    const ws = new WebSocket(url);
    wsRef.current = ws;
    ws.onopen = () => setStatus('connected, waiting for welcome…');
    ws.onclose = () => setStatus('disconnected');
    ws.onerror = () => setStatus('connection error');
    ws.onmessage = (ev) => {
      if (simDrop()) return;
      setTimeout(() => handleMessage(JSON.parse(ev.data)), simDelay());
    };
  }, [handleMessage, simDelay, simDrop]);

  const sendMove = useCallback((from, to, promotion) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const payload = JSON.stringify({ type: 'move', from, to, promotion });
    if (simDrop()) return; // pretend it never arrived — the board will just sit unconfirmed
    setTimeout(() => { if (ws.readyState === WebSocket.OPEN) ws.send(payload); }, simDelay());
  }, [simDelay, simDrop]);

  const requestNewGame = useCallback(() => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'new_game' }));
  }, []);

  // Called when the user clicks a square on the board.
  const clickSquare = useCallback((square) => {
    if (flags.isGameOver || turn !== myColor) {
      // still allow re-selecting your own pieces to see legal moves, just no sending
    }
    const piece = chessRef.current.get(square);

    if (selected) {
      if (selected === square) { setSelected(null); setLegalTargets([]); return; }
      const isLegalTarget = legalTargets.includes(square);
      if (isLegalTarget) {
        const moves = chessRef.current.moves({ square: selected, verbose: true });
        const candidate = moves.find((m) => m.to === square);
        if (candidate && candidate.promotion) {
          setPendingPromotion({ from: selected, to: square });
          setSelected(null);
          setLegalTargets([]);
          return;
        }
        // --- client-side prediction: apply immediately, then tell the server ---
        try {
          const applied = chessRef.current.move({ from: selected, to: square });
          syncFromChess();
          setLastMove({ from: applied.from, to: applied.to, san: applied.san, color: applied.color });
          sendMove(selected, square);
        } catch {
          /* shouldn't happen since we checked legality above */
        }
        setSelected(null);
        setLegalTargets([]);
        return;
      }
      // clicking a different own piece re-selects instead of moving
      if (piece && piece.color === myColor && turn === myColor) {
        setSelected(square);
        setLegalTargets(chessRef.current.moves({ square, verbose: true }).map((m) => m.to));
      } else {
        setSelected(null);
        setLegalTargets([]);
      }
      return;
    }

    if (piece && piece.color === myColor && turn === myColor && !flags.isGameOver) {
      setSelected(square);
      setLegalTargets(chessRef.current.moves({ square, verbose: true }).map((m) => m.to));
    }
  }, [selected, legalTargets, myColor, turn, flags.isGameOver, syncFromChess, sendMove]);

  const choosePromotion = useCallback((piece) => {
    if (!pendingPromotion) return;
    const { from, to } = pendingPromotion;
    try {
      const applied = chessRef.current.move({ from, to, promotion: piece });
      syncFromChess();
      setLastMove({ from: applied.from, to: applied.to, san: applied.san, color: applied.color });
      sendMove(from, to, piece);
    } catch { /* noop */ }
    setPendingPromotion(null);
  }, [pendingPromotion, syncFromChess, sendMove]);

  useEffect(() => {
    connect(defaultWsUrl());
    return () => {
      clearTimeout(rejectionTimerRef.current);
      if (wsRef.current) { try { wsRef.current.close(); } catch { /* noop */ } }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    status, roster, myId, myColor,
    fen, turn, lastMove, flags, moveHistory, rejection,
    selected, legalTargets, pendingPromotion,
    clickSquare, choosePromotion, requestNewGame,
    settingsRef, reconnect: connect, defaultWsUrl: defaultWsUrl(),
  };
}
