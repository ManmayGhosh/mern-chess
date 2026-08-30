import { useMemo } from 'react';
import { Chess } from 'chess.js';

const PIECE_GLYPH = {
  p: { w: '♙', b: '♟' },
  n: { w: '♘', b: '♞' },
  b: { w: '♗', b: '♝' },
  r: { w: '♖', b: '♜' },
  q: { w: '♕', b: '♛' },
  k: { w: '♔', b: '♚' },
};

function squareOf(row, col) {
  const file = String.fromCharCode(97 + col); // 'a'..'h'
  const rank = 8 - row;                        // 8..1
  return `${file}${rank}`;
}

export default function ChessBoard({ fen, myColor, selected, legalTargets, lastMove, onSquareClick }) {
  const board = useMemo(() => new Chess(fen).board(), [fen]);
  const flip = myColor === 'b';

  const rowOrder = flip ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];
  const colOrder = flip ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];

  return (
    <div className="board">
      {rowOrder.map((r) => (
        <div className="board-row" key={r}>
          {colOrder.map((c) => {
            const square = squareOf(r, c);
            const cell = board[r][c];
            const isDark = (r + c) % 2 === 1;
            const isSelected = selected === square;
            const isTarget = legalTargets.includes(square);
            const isLastMove = lastMove && (lastMove.from === square || lastMove.to === square);
            const classes = [
              'sq',
              isDark ? 'sq-dark' : 'sq-light',
              isSelected ? 'sq-selected' : '',
              isTarget ? 'sq-target' : '',
              isLastMove ? 'sq-lastmove' : '',
            ].filter(Boolean).join(' ');
            return (
              <div key={square} className={classes} onClick={() => onSquareClick(square)}>
                {cell && <span className={`piece piece-${cell.color}`}>{PIECE_GLYPH[cell.type][cell.color]}</span>}
                {isTarget && !cell && <span className="target-dot" />}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
