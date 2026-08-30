import ChessBoard from './components/ChessBoard';
import PromotionModal from './components/PromotionModal';
import MoveHistory from './components/MoveHistory';
import NetworkControls from './components/NetworkControls';
import GameHistory from './components/GameHistory';
import { useChessSocket } from './hooks/useChessSocket';

function statusLine({ flags, turn, myColor, roster }) {
  if (roster.length < 2) return 'Waiting for an opponent to connect…';
  if (flags.isCheckmate) return `Checkmate — ${turn === 'w' ? 'Black' : 'White'} wins!`;
  if (flags.isStalemate) return 'Stalemate — draw.';
  if (flags.isDraw) return 'Draw.';
  const toMove = turn === 'w' ? 'White' : 'Black';
  const you = turn === myColor ? ' (your move)' : '';
  return `${toMove} to move${you}${flags.inCheck ? ' — check!' : ''}`;
}

export default function App() {
  const {
    status, roster, myColor,
    fen, turn, lastMove, flags, moveHistory, rejection,
    selected, legalTargets, pendingPromotion,
    clickSquare, choosePromotion, requestNewGame,
    settingsRef, reconnect, defaultWsUrl,
  } = useChessSocket();

  return (
    <div className="app">
      <h1>2-Player Chess (MERN)</h1>
      <div className="sub">
        Authoritative Express/ws server validates every move with chess.js &middot;
        client predicts your own legal moves instantly &middot; illegal/out-of-turn
        moves get rolled back &middot; completed games logged to MongoDB
      </div>

      <div className="layout">
        <div>
          <div className="game-status">{statusLine({ flags, turn, myColor, roster })}</div>
          {rejection && <div className="rejection-banner">{rejection}</div>}
          <ChessBoard
            fen={fen}
            myColor={myColor}
            selected={selected}
            legalTargets={legalTargets}
            lastMove={lastMove}
            onSquareClick={clickSquare}
          />
          {flags.isGameOver && (
            <button className="new-game-btn" onClick={requestNewGame}>New Game</button>
          )}
        </div>

        <div className="panel">
          <h3>Connection</h3>
          <div className="status">{status}</div>
          <button onClick={() => reconnect(defaultWsUrl)}>Reconnect</button>

          <h3>You are</h3>
          <div>{myColor === 'w' ? '⚪ White' : myColor === 'b' ? '⚫ Black' : 'unassigned'}</div>

          <NetworkControls settingsRef={settingsRef} />
          <MoveHistory moves={moveHistory} />
        </div>
      </div>

      {pendingPromotion && <PromotionModal onChoose={choosePromotion} />}

      <div className="panel history-panel">
        <GameHistory />
      </div>
    </div>
  );
}
