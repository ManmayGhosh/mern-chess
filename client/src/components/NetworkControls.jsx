import { useState } from 'react';

export default function NetworkControls({ settingsRef }) {
  const [display, setDisplay] = useState({ latency: 0, jitter: 0, loss: 0 });

  function update(key, value) {
    settingsRef.current[key] = value;
    setDisplay((d) => ({ ...d, [key]: value }));
  }

  return (
    <div>
      <h3>Simulated network conditions</h3>
      <div className="sub" style={{ marginBottom: 6 }}>
        Crank these up and watch your own move render instantly (prediction)
        while the opponent's board — and any illegal-move rollback — lags behind.
      </div>
      <label className="row">Added latency (one-way) <span className="val">{display.latency} ms</span></label>
      <input type="range" min="0" max="500" value={display.latency}
        onChange={(e) => update('latency', Number(e.target.value))} />

      <label className="row">Jitter <span className="val">{display.jitter} ms</span></label>
      <input type="range" min="0" max="200" value={display.jitter}
        onChange={(e) => update('jitter', Number(e.target.value))} />

      <label className="row">Packet loss <span className="val">{display.loss}%</span></label>
      <input type="range" min="0" max="20" value={display.loss}
        onChange={(e) => update('loss', Number(e.target.value))} />
    </div>
  );
}
