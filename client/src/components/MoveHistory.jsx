export default function MoveHistory({ moves }) {
  const rows = [];
  for (let i = 0; i < moves.length; i += 2) {
    rows.push({ num: i / 2 + 1, white: moves[i], black: moves[i + 1] });
  }
  return (
    <div>
      <h3>Moves</h3>
      {rows.length === 0 && <div className="sub">No moves yet.</div>}
      {rows.length > 0 && (
        <div className="move-list">
          {rows.map((r) => (
            <div className="move-row" key={r.num}>
              <span className="move-num">{r.num}.</span>
              <span className="move-san">{r.white}</span>
              <span className="move-san">{r.black || ''}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
