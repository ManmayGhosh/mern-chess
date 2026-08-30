import { useEffect, useState } from 'react';

function apiBase() {
  return import.meta.env.DEV ? 'http://localhost:8080' : '';
}

function fmtDuration(startedAt, endedAt) {
  if (!endedAt) return 'in progress';
  const secs = Math.round((new Date(endedAt) - new Date(startedAt)) / 1000);
  return `${secs}s`;
}

export default function MatchHistory() {
  const [matches, setMatches] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`${apiBase()}/api/matches`);
        const data = await res.json();
        if (!cancelled) {
          setMatches(data.matches || []);
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
      <h3>Match history (MongoDB)</h3>
      {error && <div className="sub">{error} — is the DB connected?</div>}
      {!error && matches.length === 0 && <div className="sub">No matches logged yet — play a round!</div>}
      {matches.length > 0 && (
        <table className="match-table">
          <thead>
            <tr><th>Started</th><th>Duration</th><th>Ticks</th><th>Players</th></tr>
          </thead>
          <tbody>
            {matches.map((m) => (
              <tr key={m._id}>
                <td>{new Date(m.startedAt).toLocaleTimeString()}</td>
                <td>{fmtDuration(m.startedAt, m.endedAt)}</td>
                <td>{m.ticks}</td>
                <td>
                  {m.players.map((p) => (
                    <span key={p.playerId} className="dot" style={{ background: p.color }} />
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
