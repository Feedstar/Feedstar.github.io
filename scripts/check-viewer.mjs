import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import loadMujoco from '@mujoco/mujoco';
import { createViewerForce, viewerBodies } from '../src/lib/viewer-physics.mjs';
import { createStudy } from '../src/lib/study-runtime.mjs';
const mj = await loadMujoco();
const xml = (path) =>
  readFileSync(
    new URL(`../public/examples/${path}.xml`, import.meta.url),
    'utf8',
  );
const check = (m, d, step, name) => {
  const controller = createViewerForce(mj, m, d),
    bodies = viewerBodies(mj, m);
  const b = bodies.findLast((b) => b.movable);
  assert(b, `${name}: a dynamic body is selectable`);
  mj.mj_forward(m, d);
  const before = Array.from(d.qpos);
  const target = Array.from(d.xpos.slice(b.id * 3, b.id * 3 + 3));
  target[0] += 0.4;
  target[1] += 0.2;
  target[2] += 0.3;
  controller.update({ body: b.id, local: [0.04, 0.02, 0.01], target });
  assert.deepEqual(
    Array.from(d.qpos),
    before,
    'Picking must not teleport bodies',
  );
  for (let i = 0; i < 250; i++) {
    controller.apply();
    step();
  }
  assert(
    [...d.qpos, ...d.qvel].every(Number.isFinite),
    `${name}: force remains stable`,
  );
  assert(
    Math.hypot(...d.qpos.map((v, i) => v - before[i])) > 1e-5,
    `${name}: drag changes physical state`,
  );
  controller.clear();
  assert(
    Math.max(...d.xfrc_applied.map(Math.abs)) < 1e-9,
    `${name}: release clears every owned force/torque`,
  );
  controller.update({ body: 0, local: [0, 0, 0], target });
  controller.apply();
  assert(
    d.xfrc_applied.every((v) => Math.abs(v) < 1e-9),
    'World cannot receive a drag force',
  );
  controller.update({ body: b.id, local: [0, 0, 0], target: [NaN, 0, 0] });
  controller.apply();
  assert(
    d.xfrc_applied.every((v) => Math.abs(v) < 1e-9),
    'Invalid requests are rejected',
  );
  console.log(
    `${name}: pick, physical disturbance, release, invalid input passed`,
  );
};
for (const name of ['pendulum', 'actuator', 'contact', 'arm']) {
  const m = mj.MjModel.from_xml_string(xml(name)),
    d = new mj.MjData(m);
  try {
    check(m, d, () => mj.mj_step(m, d), name);
  } finally {
    d.delete();
    m.delete();
  }
}
for (const kind of ['inverse-kinematics', 'linkage', 'tendon', 'scanner']) {
  const s = createStudy(
    mj,
    kind,
    xml(kind === 'inverse-kinematics' ? 'arm' : `studies/${kind}`),
  );
  try {
    check(s.model, s.data, () => s.step(), kind);
  } finally {
    s.dispose();
  }
}
// At an off-centre pick, check moment arm, external-force composition and a lost-event lease.
const m = mj.MjModel.from_xml_string(
  '<mujoco><worldbody><body pos="0 0 1"><freejoint/><geom type="box" size=".1 .1 .1" mass="1"/></body></worldbody></mujoco>',
);
const d = new mj.MjData(m),
  drag = createViewerForce(mj, m, d);
mj.mj_forward(m, d);
d.xfrc_applied[6] = 2;
drag.update({ body: 1, local: [0, 0.1, 0], target: [0.2, 0.1, 1] });
drag.apply();
assert(
  Math.abs(d.xfrc_applied[11] + 0.1 * (d.xfrc_applied[6] - 2)) < 1e-8,
  'Torque is r cross F at COM',
);
drag.apply();
drag.clear();
assert.equal(d.xfrc_applied[6], 2, 'Unrelated external forces survive release');
drag.update({ body: 1, local: [0, 0, 0], target: [100, 100, 100] });
drag.apply();
assert(
  Math.hypot(d.xfrc_applied[6] - 2, d.xfrc_applied[7], d.xfrc_applied[8]) <=
    80.00001,
  'Force is bounded',
);
await new Promise((resolve) => setTimeout(resolve, 1050));
drag.apply();
assert.equal(d.xfrc_applied[6], 2, 'Missing pointer release expires safely');
drag.clear();
d.delete();
m.delete();
console.log(
  'Viewer force: off-centre torque, force cap, composition and lease passed',
);
