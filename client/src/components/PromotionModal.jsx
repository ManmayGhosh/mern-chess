const CHOICES = [
  { key: 'q', label: 'Queen', glyph: '♕' },
  { key: 'r', label: 'Rook', glyph: '♖' },
  { key: 'b', label: 'Bishop', glyph: '♗' },
  { key: 'n', label: 'Knight', glyph: '♘' },
];

export default function PromotionModal({ onChoose }) {
  return (
    <div className="modal-overlay">
      <div className="modal">
        <h3>Promote pawn to…</h3>
        <div className="promotion-choices">
          {CHOICES.map((c) => (
            <button key={c.key} className="promotion-btn" onClick={() => onChoose(c.key)}>
              <span className="promotion-glyph">{c.glyph}</span>
              {c.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
