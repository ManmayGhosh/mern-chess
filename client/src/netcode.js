// This function MUST behave identically to `applyInput` in
// server/server.js. It's duplicated (not imported) because the client
// runs in the browser and the server runs in Node — there's no shared
// module boundary here without extra build tooling, so the contract is
// enforced by keeping both copies in lockstep by hand. If you change
// movement physics, change it in both places.
export const PLAYER_SPEED = 220;   // px/sec — must match server
export const PLAYER_RADIUS = 18;   // must match server

export function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

export function applyInput(pos, input, arena) {
  const dt = Math.min(input.dt, 0.1);
  let dx = 0, dy = 0;
  if (input.up) dy -= 1;
  if (input.down) dy += 1;
  if (input.left) dx -= 1;
  if (input.right) dx += 1;
  if (dx !== 0 && dy !== 0) { dx *= 0.7071; dy *= 0.7071; }
  pos.x = clamp(pos.x + dx * PLAYER_SPEED * dt, PLAYER_RADIUS, arena.w - PLAYER_RADIUS);
  pos.y = clamp(pos.y + dy * PLAYER_SPEED * dt, PLAYER_RADIUS, arena.h - PLAYER_RADIUS);
}
