import assert from 'node:assert/strict';
import { createLunarSnap } from '../src/lib/lunar-snap.mjs';
import { mobileMoonLayout } from '../src/lib/lunar-layout.mjs';

function harness() {
  let y = 0,
    enabled = true,
    now = 0,
    id = 0,
    state;
  const frames = new Map(),
    timers = new Map(),
    writes = [];
  const snap = createLunarSnap({
    read: () => ({ y, start: 0, end: 1800, enabled }),
    write: (value) => {
      y = value;
      writes.push(value);
    },
    requestFrame: (fn) => {
      frames.set(++id, fn);
      return id;
    },
    cancelFrame: (key) => frames.delete(key),
    setTimer: (fn, delay) => {
      timers.set(++id, { fn, at: now + delay });
      return id;
    },
    clearTimer: (key) => timers.delete(key),
    state: (value) => {
      state = value;
    },
  });
  return {
    snap,
    writes,
    frames,
    get y() {
      return y;
    },
    get state() {
      return state;
    },
    enable(value) {
      enabled = value;
    },
    scroll(value) {
      y = value;
      snap.moved();
    },
    advance(ms) {
      for (let elapsed = 0; elapsed < ms; elapsed += 10) {
        now += Math.min(10, ms - elapsed);
        for (const [key, task] of [...timers])
          if (task.at <= now) {
            timers.delete(key);
            task.fn();
          }
        const batch = [...frames.values()];
        frames.clear();
        batch.forEach((fn) => fn(now));
      }
    },
  };
}
{
  const f = harness();
  f.snap.input(120);
  f.scroll(120);
  f.advance(200);
  assert.equal(
    f.writes.length,
    0,
    'Never compete with an active native gesture.',
  );
  f.snap.input(120);
  f.scroll(240);
  f.advance(200);
  assert.equal(
    f.writes.length,
    0,
    'Every wheel/momentum update postpones the glide.',
  );
  f.advance(1000);
  assert(
    f.y > 240 && f.y < 1800,
    'A paused downward gesture glides through intermediate frames.',
  );
  f.advance(2200);
  assert.equal(f.y, 1800);
  assert.equal(f.state, 'complete');
  assert(f.writes.every((value, i) => !i || value >= f.writes[i - 1]));
  assert(
    Math.max(...f.writes.slice(1).map((v, i) => v - f.writes[i])) < 25,
    'No large frame jumps.',
  );
  assert.equal(f.frames.size, 0);
}
for (const direction of [-120, 120]) {
  const f = harness();
  f.snap.input(120);
  f.scroll(120);
  f.advance(800);
  const interruptedAt = f.y;
  f.snap.input(direction);
  f.scroll(interruptedAt + direction);
  const writeCount = f.writes.length;
  f.advance(4000);
  assert.equal(
    f.writes.length,
    writeCount,
    'New wheel input cancels before the next animation frame.',
  );
  assert.equal(f.y, interruptedAt + direction);
  assert.equal(
    f.state,
    'manual',
    'Do not grab the wheel back after interruption.',
  );
  f.scroll(0);
  f.snap.input(80);
  f.scroll(80);
  f.advance(3000);
  assert.equal(f.y, 1800, 'Returning to the opening permits a fresh journey.');
}
{
  const f = harness();
  f.scroll(400);
  f.advance(3000);
  assert.equal(
    f.writes.length,
    0,
    'History restoration and anchor scrolling do not arm the glide.',
  );
  f.snap.input(-100);
  f.scroll(300);
  f.advance(3000);
  assert.equal(f.writes.length, 0, 'Upward scrolling stays manual.');
  f.enable(false);
  f.snap.input(100);
  f.scroll(400);
  f.advance(3000);
  assert.equal(
    f.writes.length,
    0,
    'Reduced motion, loading and fallback never auto-scroll.',
  );
  f.enable(true);
  f.snap.begin();
  f.advance(300);
  f.snap.interrupt();
  const count = f.writes.length;
  f.advance(3000);
  assert.equal(f.writes.length, count);
  f.snap.begin();
  f.snap.dispose();
  f.advance(3000);
  assert.equal(f.writes.length, count);
}
// Project the whole sphere, not just its equator: its near hemisphere must
// also remain inside the unobstructed mobile space at short and tall sizes.
for (const [w, h] of [
  [320, 568],
  [360, 640],
  [375, 667],
  [390, 844],
  [430, 932],
  [650, 720],
]) {
  const viewH = 2 * Math.tan((17.5 * Math.PI) / 180) * 6,
    viewW = (viewH * w) / h;
  const copyTop = Math.floor(h * 0.48),
    headerBottom = 104;
  const layout = mobileMoonLayout(w, h, headerBottom, copyTop, viewW, viewH);
  for (let lat = 0; lat <= 180; lat += 3)
    for (let lon = 0; lon < 360; lon += 3) {
      const a = (lat * Math.PI) / 180,
        b = (lon * Math.PI) / 180,
        r = layout.radius;
      const x = layout.x + r * Math.sin(a) * Math.cos(b);
      const y = layout.y + r * Math.cos(a),
        z = r * Math.sin(a) * Math.sin(b);
      const px = w / 2 + ((x * 6) / (6 - z) / viewW) * w,
        py = h / 2 - ((y * 6) / (6 - z) / viewH) * h;
      assert(px > 16 && px < w - 16, `Moon clips at side: ${w} × ${h}`);
      assert(
        py > headerBottom + 16 && py < copyTop - 16,
        `Moon overlaps navigation/title: ${w} × ${h}`,
      );
    }
}
console.log(
  'PASS: mobile lunar bounds; native gesture priority; smooth arrival; immediate interruption without recapture; history, reverse, reduced-motion and cleanup.',
);
