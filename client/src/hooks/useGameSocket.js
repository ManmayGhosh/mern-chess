import { useEffect, useRef, useState, useCallback } from 'react';
import { applyInput } from '../netcode';

const KEY_MAP = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
};

const INTERP_DELAY = 100; // ms — remote player render delay to smooth jitter

function defaultWsUrl() {
  if (import.meta.env.DEV) return 'ws://localhost:8080';
  const proto = location.protocol === 'https:' ? 'wss://' : 'ws://';
  return proto + location.host;
}

export function useGameSocket(canvasRef) {
  const [status, setStatus] = useState('connecting…');
  const [roster, setRoster] = useState([]);
  const [debugStats, setDebugStats] = useState(null);

  // network-condition sliders live in a ref so changing them never
  // triggers a re-render / doesn't need to be a dependency of the loop
  const settingsRef = useRef({ latency: 0, jitter: 0, loss: 0 });

  const wsRef = useRef(null);
  const myIdRef = useRef(null);
  const arenaRef = useRef({ w: 800, h: 600 });
  const tickRateRef = useRef(30);
  const localRef = useRef({ x: 0, y: 0 });
  const serverGhostRef = useRef({ x: 0, y: 0 });
  const pendingInputsRef = useRef([]);
  const inputSeqRef = useRef(0);
  const keysRef = useRef({ up: false, down: false, left: false, right: false });
  const rosterMapRef = useRef(new Map());
  const remoteBufferRef = useRef(new Map());
  const correctionsThisSecondRef = useRef(0);
  const correctionsDisplayRef = useRef(0);
  const rttRef = useRef(0);
  const lastPingTRef = useRef(0);
  const rafRef = useRef(null);
  const accRef = useRef(0);
  const lastTRef = useRef(performance.now());

  const simDelay = useCallback(() => {
    const { latency, jitter } = settingsRef.current;
    return Math.max(0, latency + (Math.random() * 2 - 1) * jitter);
  }, []);
  const simDrop = useCallback(() => Math.random() * 100 < settingsRef.current.loss, []);

  const sendInput = useCallback((input) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    if (simDrop()) return;
    setTimeout(() => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(input)); }, simDelay());
  }, [simDelay, simDrop]);

  const handleMessage = useCallback((msg) => {
    if (msg.type === 'welcome') {
      myIdRef.current = msg.id;
      arenaRef.current = msg.arena;
      tickRateRef.current = msg.tickRate;
      localRef.current = { x: msg.x, y: msg.y };
      serverGhostRef.current = { x: msg.x, y: msg.y };
      setStatus(`connected as player ${msg.id}`);
    } else if (msg.type === 'full') {
      setStatus('server full (2/2 players already connected)');
    } else if (msg.type === 'roster') {
      rosterMapRef.current = new Map(msg.players.map((p) => [p.id, p]));
      setRoster(msg.players);
    } else if (msg.type === 'state') {
      rttRef.current = performance.now() - lastPingTRef.current;
      for (const p of msg.players) {
        if (p.id === myIdRef.current) {
          // --- server reconciliation ---
          serverGhostRef.current = { x: p.x, y: p.y };
          const before = { ...localRef.current };
          localRef.current = { x: p.x, y: p.y };
          pendingInputsRef.current = pendingInputsRef.current.filter((i) => i.seq > p.lastProcessedInput);
          for (const input of pendingInputsRef.current) applyInput(localRef.current, input, arenaRef.current);
          const dist = Math.hypot(before.x - localRef.current.x, before.y - localRef.current.y);
          if (dist > 0.5) correctionsThisSecondRef.current++;
        } else {
          if (!remoteBufferRef.current.has(p.id)) remoteBufferRef.current.set(p.id, []);
          const buf = remoteBufferRef.current.get(p.id);
          buf.push({ t: performance.now(), x: p.x, y: p.y });
          while (buf.length > 40) buf.shift();
        }
      }
    }
  }, []);

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

  function interpolatedRemote(id) {
    const buf = remoteBufferRef.current.get(id);
    if (!buf || buf.length === 0) return null;
    const renderT = performance.now() - INTERP_DELAY;
    let a = buf[0], b = buf[0];
    for (let i = 0; i < buf.length - 1; i++) {
      if (buf[i].t <= renderT && buf[i + 1].t >= renderT) { a = buf[i]; b = buf[i + 1]; break; }
      a = buf[i]; b = buf[i + 1];
    }
    const span = b.t - a.t;
    const f = span > 0 ? Math.max(0, Math.min(1, (renderT - a.t) / span)) : 1;
    return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
  }

  function draw(ctx) {
    const arena = arenaRef.current;
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.strokeStyle = '#2a2f4a';
    ctx.strokeRect(1, 1, arena.w - 2, arena.h - 2);

    for (const [id, info] of rosterMapRef.current) {
      if (id === myIdRef.current) continue;
      const pos = interpolatedRemote(id);
      if (!pos) continue;
      ctx.beginPath(); ctx.arc(pos.x, pos.y, 18, 0, 7); ctx.fillStyle = info.color; ctx.fill();
    }

    if (myIdRef.current != null) {
      const g = serverGhostRef.current;
      ctx.beginPath(); ctx.arc(g.x, g.y, 18 * 0.6, 0, 7);
      ctx.fillStyle = '#ffb35c88'; ctx.fill();

      const mine = rosterMapRef.current.get(myIdRef.current);
      const l = localRef.current;
      ctx.beginPath(); ctx.arc(l.x, l.y, 18, 0, 7);
      ctx.fillStyle = mine ? mine.color : '#4dc9ff'; ctx.fill();
    }
  }

  useEffect(() => {
    const onKeyDown = (e) => { if (KEY_MAP[e.code]) { keysRef.current[KEY_MAP[e.code]] = true; e.preventDefault(); } };
    const onKeyUp = (e) => { if (KEY_MAP[e.code]) { keysRef.current[KEY_MAP[e.code]] = false; e.preventDefault(); } };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    connect(defaultWsUrl());

    const debugInterval = setInterval(() => {
      correctionsDisplayRef.current = correctionsThisSecondRef.current;
      correctionsThisSecondRef.current = 0;
      setDebugStats({
        tickRate: tickRateRef.current,
        inputSeq: inputSeqRef.current,
        pending: pendingInputsRef.current.length,
        correctionsPerSec: correctionsDisplayRef.current,
        rtt: rttRef.current,
        playersConnected: rosterMapRef.current.size,
      });
    }, 200);

    function frame(now) {
      let dt = (now - lastTRef.current) / 1000;
      lastTRef.current = now;
      accRef.current += dt;
      const tickMs = 1000 / tickRateRef.current / 1000;
      while (accRef.current >= tickMs) {
        const input = {
          type: 'input',
          seq: ++inputSeqRef.current,
          up: keysRef.current.up, down: keysRef.current.down,
          left: keysRef.current.left, right: keysRef.current.right,
          dt: tickMs,
        };
        pendingInputsRef.current.push(input);
        applyInput(localRef.current, input, arenaRef.current); // client-side prediction
        lastPingTRef.current = performance.now();
        sendInput(input);
        accRef.current -= tickMs;
      }
      const canvas = canvasRef.current;
      if (canvas) draw(canvas.getContext('2d'));
      rafRef.current = requestAnimationFrame(frame);
    }
    rafRef.current = requestAnimationFrame(frame);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      clearInterval(debugInterval);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (wsRef.current) { try { wsRef.current.close(); } catch { /* noop */ } }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { status, roster, debugStats, settingsRef, reconnect: connect, defaultWsUrl: defaultWsUrl() };
}
