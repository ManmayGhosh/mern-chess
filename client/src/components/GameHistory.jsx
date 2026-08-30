import { useEffect, useState } from 'react';

function apiBase() {
  return import.meta.env.DEV ? 'http://localhost:8080' : '';
}

function fmtDuration(startedAt, endedAt) {
  if (!endedAt) return 'in progress';
  const secs = Math.round((new Date(endedAt) - new Date(startedAt)) / 1000);
  return `${secs}s`;
}

function resultLabel(g) {
  if (g.result === 'in_progress') return '—';
  if (g.result === 'draw') return `Draw${g.endReason ? ` (${g.endReason})` : ''}`;
  return `${g.result === 'white' ? 'White' : 'Black'} won${g.endReason ? ` (${g.endReason})` : ''}`;
}

export default function GameHistory() {
  const [games, setGames] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`${apiBase()}/api/games`);
        const data = await res.json();
        if (!cancelled) {
          setGames(data.games || []);
          setError(res.ok ? null : (data.error || 'failed to load'));
        }
      } catch {
        if (!cancelled) setError('could not reach API');
      }
    }
    load();
    const iv = setInterval(load, 5000);
    return () => { cancelled = true; clearInterval(iv); };
  }, []);

  return (
    <div>
      <h3>Game history (MongoDB)</h3>
      {error && <div className="sub">{error} — is the DB connected?</div>}
      {!error && games.length === 0 && <div className="sub">No games logged yet — play one out!</div>}
      {games.length > 0 && (
        <table className="match-table">
          <thead>
            <tr><th>Started</th><th>Duration</th><th>Moves</th><th>Result</th></tr>
          </thead>
          <tbody>
            {games.map((g) => (
              <tr key={g._id}>
                <td>{new Date(g.startedAt).toLocaleTimeString()}</td>
                <td>{fmtDuration(g.startedAt, g.endedAt)}</td>
                <td>{g.moves ? g.moves.length : 0}</td>
                <td>{resultLabel(g)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
