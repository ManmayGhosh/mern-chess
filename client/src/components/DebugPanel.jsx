export default function DebugPanel({ stats }) {
  if (!stats) return <div className="debug">waiting for connection…</div>;
  return (
    <pre className="debug">
{`tick rate:        ${stats.tickRate} Hz
input seq:         ${stats.inputSeq}
pending (unacked): ${stats.pending}
corrections/sec:   ${stats.correctionsPerSec}
rtt (approx):      ${stats.rtt.toFixed(0)} ms
players connected: ${stats.playersConnected}/2`}
    </pre>
  );
}
