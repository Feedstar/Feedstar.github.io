import assert from 'node:assert/strict';
import {
  lunarParticle,
  arrivalOpacity,
  lunarTiming,
} from '../src/lib/lunar-flow.mjs';
import { settle, titleSpring } from '../src/lib/motion.mjs';
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
  tailRatio > 0.35 && tailRatio < 0.55,
  'The tail must taper while retaining an airy width instead of collapsing into a line.',
);
assert(
  states(lunarTiming.handoffStart).every((s) => s.gather === 1),
  'All particle targets must be reached before readable HTML appears.',
);
assert.equal(arrivalOpacity(lunarTiming.handoffStart), 0);
assert(
  states(0.97).every((s) => s.alpha === 0),
  'The complete HTML must have no competing particle overlay.',
);
assert.equal(arrivalOpacity(0.97), 1);
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
