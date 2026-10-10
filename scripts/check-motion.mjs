import assert from 'node:assert/strict';
import { particleState } from '../src/lib/erosion.mjs';
const particles = Array.from({ length: 12000 }, (_, i) => {
  const y = 1 - (2 * (i + 0.5)) / 12000,
    r = Math.sqrt(1 - y * y),
    t = i * 2.399963229728653;
  return {
    p: [Math.cos(t) * r, y, Math.sin(t) * r],
    seed: Math.abs(Math.sin(i * 127.1) * 43758.5453) % 1,
  };
});
const states = (p) =>
  particles.map(({ p: position, seed }) => particleState(position, seed, p));
assert(
  states(0).every((s) => !s.detached && s.alpha === 1),
  'Initial moon must remain intact.',
);
const stages = [0, 0.2, 0.4, 0.6, 0.8, 1.18].map((p) => ({
  progress: p,
  remaining: states(p).filter((s) => s.alpha > 0.1).length,
  detached: states(p).filter((s) => s.detached).length,
}));
for (let i = 1; i < stages.length; i++)
  assert(
    stages[i].remaining <= stages[i - 1].remaining,
    'Particle density must progressively decrease.',
  );
assert.equal(
  stages.at(-1).remaining,
  0,
  'Particles must disappear before the next section.',
);
const mid = states(0.4);
const left = particles.filter(
  (v, i) => v.p[0] < -0.4 && mid[i].detached,
).length;
const right = particles.filter(
  (v, i) => v.p[0] > 0.4 && mid[i].detached,
).length;
assert(
  left > right * 3,
  'Erosion must start locally and preserve a directional progression.',
);
const distances = particles.map((v, i) =>
  Math.hypot(...mid[i].position.map((x, j) => x - v.p[j])),
);
assert(
  Math.max(...distances) > 0.1 && Math.min(...distances) === 0,
  'Mid-transition needs actual displacement alongside still-attached particles.',
);
const checkpoint = states(0.45);
states(0.8);
assert.deepEqual(
  states(0.45),
  checkpoint,
  'Reverse scroll must recover exactly the same particle state.',
);
console.log(
  'PASS: intact origin, local erosion, displacement, density, completion and reversible scroll.',
);
console.table(stages);
