import assert from 'node:assert/strict';
import {
  lunarParticle,
  arrivalOpacity,
  lunarTiming,
} from '../src/lib/lunar-flow.mjs';
import { sampleInk, inkAssignment } from '../src/lib/ink-samples.mjs';
import { settle, titleSpring } from '../src/lib/motion.mjs';
import { mistBufferSize } from '../src/lib/lunar-render.mjs';
import {
  createPreviewLoop,
  previewPixelRatio,
} from '../src/lib/preview-loop.mjs';

const previewHarness = () => {
  const queued = new Map();
  let id = 0;
  const loop = createPreviewLoop(
    (callback) => {
      queued.set(++id, callback);
      return id;
    },
    (handle) => queued.delete(handle),
  );
  return {
    loop,
    queued,
    frame(now) {
      const callbacks = [...queued.values()];
      queued.clear();
      callbacks.forEach((callback) => callback(now));
    },
  };
};
for (const hz of [30, 60, 120, 144, 180]) {
  const preview = previewHarness();
  let rendered = 0,
    elapsed = 0;
  const draw = (dt) => {
    rendered++;
    elapsed += dt;
  };
  preview.loop.add(draw);
  preview.loop.add(draw);
  for (let i = 0; i <= hz; i++) preview.frame((i * 1000) / hz);
  assert.equal(
    rendered,
    hz + 1,
    'A visible cover must render every display frame, with no 30fps gate or duplicate loop.',
  );
  assert(
    Math.abs(elapsed - 1) < 1e-10,
    'Cover animation speed must be independent of refresh rate.',
  );
  preview.loop.remove(draw);
  assert.equal(
    preview.queued.size,
    0,
    'Leaving the viewport must stop the last cover loop.',
  );
}
const preview = previewHarness();
const deltas = [];
const draw = (dt) => deltas.push(dt);
preview.loop.add(draw);
preview.frame(0);
preview.frame(16);
preview.loop.suspend(true);
assert.equal(
  preview.queued.size,
  0,
  'A hidden page must not schedule preview frames.',
);
preview.loop.suspend(false);
preview.frame(60000);
assert.equal(
  deltas.at(-1),
  0,
  'Returning to the page must not jump through the hidden time.',
);
preview.loop.remove(draw);
preview.loop.add((dt) => {
  preview.loop.dispose();
});
preview.frame(60016);
assert.equal(
  preview.queued.size,
  0,
  'A one-frame reduced-motion render must return to idle.',
);
for (const [width, height, dpr] of [
  [1440, 680, 2],
  [550, 550, 2],
  [390, 440, 3],
]) {
  const ratio = previewPixelRatio(width, height, dpr);
  assert(
    width * height * ratio ** 2 <= 1_000_001,
    'Cover resolution must remain within its pixel budget.',
  );
  assert(
    ratio <= dpr && ratio >= 1,
    'Normal cover sizes must retain at least native CSS resolution.',
  );
}
console.log(
  'PASS: display-rate cover rendering, refresh-independent motion, offscreen/hidden suspension, clean resumption and bounded pixel cost.',
);
for (const [width, height, dpr] of [
  [390, 844, 1.7],
  [1920, 1080, 1],
  [3840, 2160, 1.7],
]) {
  const mist = mistBufferSize(width, height, dpr);
  assert(
    mist.width * mist.height <= 700_000,
    'Soft mist must stay within its shading budget, including high-DPI 4K screens.',
  );
  assert(
    mist.width * mist.height <= width * height * dpr ** 2 * 0.25,
    'Mist must cost no more than one quarter of the full-resolution noise pass.',
  );
  assert(
    Math.abs(mist.width / mist.height - width / height) < 0.01,
    'Downsampling must preserve the cloud layout and aspect ratio.',
  );
}
console.log(
  'PASS: soft-mist buffer budget and unchanged cloud aspect ratio across phone, desktop and high-DPI 4K sizes.',
);
const simulate = (hz) => {
  let state = { value: 0, velocity: 0 };
  for (let i = 0; i < hz / 2; i++)
    state = settle(state.value, state.velocity, 0.6, 1 / hz);
  return state;
};
assert(
  Math.abs(simulate(30).value - simulate(120).value) < 1e-10,
  'Scroll smoothing must be independent of display frame rate.',
);
let spring = { value: 0, velocity: 0 };
let previous = 0;
for (let i = 0; i < 120; i++) {
  spring = settle(spring.value, spring.velocity, 0.6, 1 / 120);
  assert(
    spring.value >= previous && spring.value <= 0.6,
    'A wheel step must approach its position smoothly without bouncing.',
  );
  previous = spring.value;
}
assert(
  Math.abs(spring.value - 0.6) < 1e-7,
  'Motion must settle when scrolling stops.',
);
const moving = settle(0, 0, 0.6, 0.06);
const reversed = settle(moving.value, moving.velocity, 0, 0.00001);
assert(
  Math.abs(reversed.velocity - moving.velocity) < 0.01,
  'Changing direction must preserve velocity at the interruption.',
);
const returned = settle(moving.value, moving.velocity, 0, 1);
assert(
  Math.abs(returned.value) < 1e-7,
  'Reverse scrolling must settle at its new position.',
);
console.log(
  'PASS: frame-independent smoothing, no bounce, stationary hold and continuous reversal.',
);
const hoverAt = (hz) => {
  let state = { value: 0, velocity: 0 };
  for (let i = 0; i < hz / 2; i++)
    state = titleSpring(state.value, state.velocity, -12, 1 / hz);
  return state;
};
assert(
  Math.abs(hoverAt(30).value - hoverAt(120).value) < 1e-10,
  'Title rebound must be independent of frame rate.',
);
const hover = hoverAt(60);
const hoverExit = titleSpring(hover.value, hover.velocity, 0, 0.000001);
assert(
  Math.abs(hoverExit.velocity - hover.velocity) < 0.002,
  'Pointer exit must preserve the moving title velocity.',
);
const hoverRest = titleSpring(hover.value, hover.velocity, 0, 3);
assert(
  Math.abs(hoverRest.value) < 0.001,
  'Titles must return to their original baseline after leaving.',
);
const particles = Array.from({ length: 12000 }, (_, i) => {
  const y = 1 - (2 * (i + 0.5)) / 12000,
    r = Math.sqrt(1 - y * y),
    t = i * 2.399963229728653;
  return {
    p: [Math.cos(t) * r, y, Math.sin(t) * r],
    seed: Math.abs(Math.sin(i * 127.1) * 43758.5453) % 1,
  };
});
const states = (progress, time = 8) =>
  particles.map(({ p, seed }) => lunarParticle(p, seed, progress, time));
assert(
  states(0).every((s) => s.release === 0 && s.gather === 0),
  'The opening surface must remain intact.',
);
const stages = [0, 0.2, 0.4, 0.5, 0.65, 0.8, 0.87, 0.97].map((progress) => ({
  progress,
  released: states(progress).filter((s) => s.release > 0.5).length,
  gathered: states(progress).filter((s) => s.gather > 0.98).length,
  html: arrivalOpacity(progress),
}));
for (let i = 1; i < stages.length; i++) {
  assert(
    stages[i].released >= stages[i - 1].released,
    'Local release must progress monotonically.',
  );
  assert(
    stages[i].gathered >= stages[i - 1].gathered,
    'Particles must progressively converge onto content.',
  );
}
const mid = states(0.2);
const left = particles.filter(
  (v, i) => v.p[0] < -0.4 && mid[i].release > 0.5,
).length;
const right = particles.filter(
  (v, i) => v.p[0] > 0.4 && mid[i].release > 0.5,
).length;
assert(
  left > right * 3,
  'Wind erosion must retain local, directional variation.',
);
const held = states(0.35, 8),
  later = states(0.35, 8.4);
const flowing = held.filter(
  (s, i) => s.release > 0.8 && s.lifeAlpha > 0.5 && later[i].lifeAlpha > 0.5,
);
assert(
  flowing.length > 1000,
  'The held stage must have a substantial visible flowing cloud.',
);
const moved = held.filter(
  (s, i) =>
    s.release > 0.8 &&
    s.lifeAlpha > 0.5 &&
    later[i].lifeAlpha > 0.5 &&
    Math.hypot(...s.position.map((v, j) => v - later[i].position[j])) > 0.001,
);
assert(
  moved.length === flowing.length,
  'Released grains must keep flowing when scrolling stops.',
);
for (const seed of [0.05, 0.25, 0.5, 0.75, 0.95]) {
  const position = [-0.8, 0.2, 0.56];
  assert.deepEqual(
    lunarParticle(position, seed, 0.4, 8, true),
    lunarParticle(position, seed, 0.4, 8, false),
    'Airborne and released grains must share exactly the same wind path.',
  );
  const wrap = (1 - seed) / (0.045 + seed * 0.014);
  assert(
    lunarParticle(position, seed, 0.3, wrap - 1e-5, true).lifeAlpha < 1e-6,
  );
  assert(
    lunarParticle(position, seed, 0.3, wrap + 1e-5, true).lifeAlpha < 1e-6,
    'Lifecycle wrapping must be invisible.',
  );
}
// A plume must converge vertically as it travels, not carry a moon-height wall.
const plumeWidth = (time) => {
  const top = lunarParticle([-0.65, 0.8, 0.1], 0.12, 0, time, true).position;
  const bottom = lunarParticle(
    [-0.65, -0.8, 0.1],
    0.12,
    0,
    time,
    true,
  ).position;
  return Math.abs(top[1] - bottom[1]);
};
const tailRatio = plumeWidth(10) / plumeWidth(1);
assert(
  tailRatio > 0.55 && tailRatio < 0.8,
  'The reference-shaped plume must retain a broad fan while gradually tapering.',
);
const forming = states(0.82);
assert(
  forming.some((s) => s.ink > 0.4) && forming.some((s) => s.ink < 0.1),
  'Footprints should join locally, with different regions still in flight.',
);
for (const p of [0.72, 0.8, 0.86, 0.91, lunarTiming.handoffEnd - 1e-5]) {
  assert.equal(
    arrivalOpacity(p),
    0,
    'HTML must never supply the forming strokes through an opacity fade.',
  );
}
assert(
  states(lunarTiming.inkEnd).every(
    (s) => s.ink === 1 && s.gather === 1 && s.alpha === 1,
  ),
  'All particle footprints must fully connect before HTML takes over.',
);
assert(
  states(lunarTiming.handoffEnd).every((s) => s.alpha === 0),
  'The complete HTML must have no competing particle overlay.',
);
assert.equal(arrivalOpacity(lunarTiming.handoffEnd), 1);
const checkpoint = states(0.65, 8);
states(0.97, 8);
assert.deepEqual(
  states(0.65, 8),
  checkpoint,
  'Reversing scroll must restore the same shape at a fixed wind phase.',
);
console.log(
  'PASS: intact origin, local feathered release, continuous shared wind, invisible wrapping, content convergence and reversible handoff.',
);
console.table(stages);

// Thin, partially covered strokes also need a seed. All pixel parities must
// participate; a balanced assignment must leave no ink seed unoccupied.
const ink = new Uint8ClampedArray(32 * 24 * 4);
for (let y = 0; y < 24; y++) {
  for (let x = 0; x < 24; x++) {
    const i = (y * 32 + x) * 4;
    ink.set([220, 210, 200, x < 16 ? 255 : 128], i);
  }
}
const inkPoints = sampleInk(ink, 32, 24);
assert.deepEqual(
  sampleInk(ink, 32, 24),
  inkPoints,
  'Resampling must be deterministic for reverse scroll and resize.',
);
assert.equal(inkPoints.filter((p) => p.x < 16).length, 16 * 24);
assert(
  inkPoints.every((p) => p.x < 24 && p.y < 24),
  'Transparent background must never attract particles.',
);
assert(
  inkPoints.every((p) => !Number.isInteger(p.x) && !Number.isInteger(p.y)),
  'Targets need subpixel jitter, not fixed pixel centers.',
);
assert.equal(
  new Set(inkPoints.map((p) => `${Math.floor(p.x) % 2},${Math.floor(p.y) % 2}`))
    .size,
  4,
);
const edgeCount = inkPoints.filter((p) => p.x >= 16).length;
assert.equal(
  edgeCount,
  8 * 24,
  'Every antialiased hairline must retain a particle seed.',
);
const assigned = inkAssignment(inkPoints.length, 2400);
assert.deepEqual(assigned, inkAssignment(inkPoints.length, 2400));
assert.equal(
  new Set(assigned).size,
  inkPoints.length,
  'No target pixel may be missed by random duplicates.',
);
const visits = Array(inkPoints.length).fill(0);
for (const i of assigned) visits[i]++;
assert(
  Math.max(...visits) - Math.min(...visits) <= 1,
  'Ink occupancy must be balanced.',
);
// A settled footprint is opaque through radius 5.5 * .34. Each pixel's entire
// area lies inside its own jittered seed's footprint, not just its center.
for (const p of inkPoints) {
  const x = Math.floor(p.x),
    y = Math.floor(p.y);
  for (const dx of [0, 1])
    for (const dy of [0, 1]) {
      assert(
        Math.hypot(p.x - x - dx, p.y - y - dy) < 5.5 * 0.34,
        'The complete glyph must be covered before switching to HTML.',
      );
    }
}
console.log(
  'PASS: irregular ink seeds, complete stroke coverage, local footprint fusion and no HTML fade.',
);
