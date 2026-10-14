import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import loadMujoco from '@mujoco/mujoco';
import { createStudy } from '../src/lib/study-runtime.mjs';
import { studySpecs } from '../src/lib/study-specs.mjs';
const mj = await loadMujoco();
const make = (kind) =>
  createStudy(
    mj,
    kind,
    readFileSync(
      new URL(
        `../public/examples/${kind === 'inverse-kinematics' ? 'arm.xml' : `studies/${kind}.xml`}`,
        import.meta.url,
      ),
      'utf8',
    ),
  );
const advance = (s, seconds) => {
  for (let i = 0; i < Math.round(seconds / s.model.opt.timestep); i++) s.step();
  return s.observe();
};
function finite(s) {
  assert(
    [...s.data.qpos, ...s.data.qvel].every(Number.isFinite),
    'All state variables remain finite',
  );
}
const ik = make('inverse-kinematics');
try {
  assert(
    advance(ik, 4).values[0] < 0.2,
    'A reachable static goal converges below 0.2 mm',
  );
  const before = Array.from(ik.data.qpos);
  ik.update({ x: 0.4, y: -0.15, z: 0.65 });
  assert.deepEqual(
    Array.from(ik.data.qpos),
    before,
    'Changing the IK goal must not teleport the physical arm',
  );
  assert(advance(ik, 4).values[0] < 0.2, 'A second reachable point converges');
  ik.update({ x: 0.55, y: 0, z: 0.5, mode: 'circle', rate: 0.5 }, true);
  advance(ik, 3);
  let max = 0;
  for (let i = 0; i < 120; i++) {
    const o = advance(ik, 0.05);
    max = Math.max(max, o.values[0]);
  }
  assert(max < 20, `Slow circular tracking stays within 20 mm, got ${max}`);
  ik.update({ mode: 'point', x: 1.08, y: 0, z: 1.1 }, true);
  const far = advance(ik, 4);
  assert(
    far.values[1] > 100,
    'Unreachable target retains an honest IK residual',
  );
  finite(ik);
  ik.update({ x: NaN, damping: -10 });
  assert.equal(ik.settings.damping, 0.01);
  assert.equal(ik.settings.x, 1.08);
} finally {
  ik.dispose();
}
const loop = make('linkage');
try {
  for (let i = 0; i < 40; i++)
    assert(
      advance(loop, 0.1).values[0] < 0.1,
      'Closed four-bar connection stays within 0.1 mm',
    );
  loop.update({ closed: false }, true);
  const open = advance(loop, 2);
  assert(
    open.values[0] > 100,
    'Disabling loop closure actually separates the endpoints',
  );
  loop.update({ closed: true });
  assert.equal(
    loop.data.time,
    0,
    'Re-enabling the loop safely resets the mechanism',
  );
  assert(advance(loop, 1).values[0] < 0.1);
  finite(loop);
} finally {
  loop.dispose();
}
const cable = make('tendon');
try {
  const r = cable.observe();
  assert(
    Math.abs(r.values[1]) < 1e-5,
    'Tendon starts at spring reference length',
  );
  advance(cable, 5);
  const low = Math.abs(cable.data.qpos[1]);
  assert(low > 0.04, 'Passive tendon force moves the undriven load');
  assert.equal(cable.model.nu, 1, 'Only the input carriage has an actuator');
  assert(
    cable.observe().values[2] < 0,
    'Extension creates a tensile restoring force',
  );
  cable.update({ stiffness: 300, damping: 6 }, true);
  advance(cable, 5);
  assert(
    Math.abs(cable.data.qpos[1]) > low,
    'Greater stiffness transfers more steady displacement against the return spring',
  );
  cable.update(
    { stiffness: 50, damping: 0.2, mass: 3, mode: 'wave', rate: 4 },
    true,
  );
  advance(cable, 12);
  finite(cable);
  assert(
    Math.abs(cable.model.body_mass[mj.mj_name2id(cable.model, 1, 'load')] - 3) <
      1e-12,
  );
  assert(
    cable.observe().segments.every(Number.isFinite),
    'Wrapped path contains finite tangent and arc coordinates',
  );
} finally {
  cable.dispose();
}
const scanner = make('scanner');
try {
  scanner.update({ mode: 'fixed' }, true);
  assert(
    Math.abs(advance(scanner, 1).values[0] - 0.56) < 1e-6,
    'Front surface is 0.56 m from sensor origin',
  );
  scanner.update({ y: 0.5 }, true);
  assert(
    Math.abs(advance(scanner, 1).values[0] - 1.34) < 1e-6,
    'Moving foreground exposes the farther wall',
  );
  scanner.update({ mode: 'sweep', span: 200 }, true);
  let hit = false,
    miss = false;
  for (let i = 0; i < 120; i++) {
    const o = advance(scanner, 0.05);
    if (o.values[0] < 0) {
      miss = true;
      assert.equal(o.plot[0], null);
      assert.equal(o.actual, undefined);
    } else hit = true;
  }
  assert(
    hit && miss,
    'Scanner reports both hits and misses without fabricating distances',
  );
  finite(scanner);
} finally {
  scanner.dispose();
}
// Optional native parity check, run locally when Python MuJoCo is installed.
if (process.argv.includes('--python')) {
  for (const kind of Object.keys(studySpecs)) {
    const s = make(kind),
      browser = advance(s, 5);
    const native = JSON.parse(
      execFileSync(
        'python3',
        [
          'public/examples/studies/study.py',
          '--example',
          kind,
          '--headless',
          '--duration',
          '5',
        ],
        { encoding: 'utf8' },
      ),
    );
    browser.values.forEach((v, i) =>
      assert(
        Math.abs(v - native.values[i]) < 1e-5,
        `${kind} metric ${i} agrees between WASM and Python`,
      ),
    );
    assert.equal(native.qpos.length, s.data.qpos.length);
    native.qpos.forEach((v, i) =>
      assert(
        Math.abs(v - s.data.qpos[i]) < 1e-7,
        `${kind} state ${i} matches native`,
      ),
    );
    s.dispose();
  }
  console.log(
    'Native Python / browser WASM parity passed for all four studies.',
  );
}
console.log(
  'Four original MuJoCo studies: convergence, loop closure, passive transmission, sensing and reset checks passed.',
);
