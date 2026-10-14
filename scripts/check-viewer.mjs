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
const camera = {
  position: [2, -3, 2],
  forward: [-2 / Math.sqrt(14), 3 / Math.sqrt(14), -1 / Math.sqrt(14)],
  up: [0, 0, 1],
  fov: 38,
  aspect: 1.5,
};
const begin = (body, active = 1, local = [0, 0, 0]) => ({
  kind: 'begin',
  body,
  local,
  active,
  camera,
});
const move = (action = 3, dx = 0.04, dy = 0.02) => ({
  kind: 'move',
  action,
  dx,
  dy,
});
function check(m, d, step, name) {
  const drag = createViewerForce(mj, m, d),
    bodies = viewerBodies(mj, m),
    b = bodies.findLast((b) => b.movable);
  mj.mj_forward(m, d);
  const before = [...d.qpos];
  drag.update(begin(b.id, 1, [0.1, 0.02, 0.2]));
  drag.update(move());
  assert.deepEqual(
    [...d.qpos],
    before,
    `${name}: picking does not teleport live bodies`,
  );
  for (let i = 0; i < 250; i++) {
    drag.apply();
    step();
  }
  assert(
    [...d.qpos, ...d.qvel].every(Number.isFinite),
    `${name}: native perturbation stays finite`,
  );
  assert(
    Math.hypot(...d.qpos.map((v, i) => v - before[i])) > 1e-5,
    `${name}: physical state responds`,
  );
  drag.clear();
  assert(
    Math.max(...d.xfrc_applied.map(Math.abs)) < 1e-8,
    `${name}: force/torque released`,
  );
  assert.equal(drag.update(begin(0)), false, 'World cannot be disturbed');
  assert.equal(
    drag.update({
      ...begin(b.id),
      camera: { ...camera, position: [NaN, 0, 0] },
    }),
    false,
  );
  drag.setDisplay({ contacts: true, forces: true, joints: true, com: true });
  const debug = drag.read();
  assert(
    [...debug.contacts, ...debug.forces, ...debug.joints, ...debug.com].every(
      Number.isFinite,
    ),
  );
  assert.equal(debug.com.length, m.nbody * 3);
  drag.dispose();
  console.log(`${name}: native disturbance, diagnostics and release passed`);
}
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
    if (kind === 'scanner') {
      const drag = createViewerForce(mj, s.model, s.data),
        b = viewerBodies(mj, s.model).find((b) => b.mocap);
      const before = [...s.data.mocap_pos];
      drag.update(begin(b.id), true);
      drag.update(move(), true);
      assert.notDeepEqual(
        [...s.data.mocap_pos],
        before,
        'Paused mocap pose changes',
      );
      const edited = [...s.data.mocap_pos];
      s.syncViewerPose();
      s.update({ rate: 0.4 });
      assert.deepEqual(
        [...s.data.mocap_pos],
        edited,
        'Lesson settings preserve native mocap pose',
      );
      drag.dispose();
    }
  } finally {
    s.dispose();
  }
}
// Native pose editing is reserved for free roots and mocap, preserving articulated constraints.
const m = mj.MjModel.from_xml_string(
  '<mujoco><option gravity="0 0 0"/><worldbody><body name="free" pos="0 0 1"><freejoint/><geom type="box" size=".1 .1 .1" mass="1"/><body name="child" pos=".2 0 0"><geom size=".04" mass=".2"/></body></body><body name="hinge" pos="1 0 1"><joint axis="0 1 0"/><geom type="box" size=".1 .1 .1"/></body></worldbody></mujoco>',
);
const d = new mj.MjData(m),
  drag = createViewerForce(mj, m, d);
mj.mj_forward(m, d);
const original = [...d.qpos];
drag.update(begin(1), true);
drag.update(move(), true);
assert.notDeepEqual(
  [...d.qpos.slice(0, 3)],
  original.slice(0, 3),
  'Paused translation moves free body',
);
assert.equal(d.time, 0, 'Pose edits do not advance physics');
assert(
  d.xfrc_applied.every((v) => Math.abs(v) < 1e-9),
  'Paused editing applies no force',
);
drag.clear();
mj.mj_forward(m, d);
const priorQuaternion = [...d.qpos.slice(3, 7)];
drag.update(begin(1, 2), true);
drag.update(move(1, 0.1, 0.05), true);
assert.notDeepEqual(
  [...d.qpos.slice(3, 7)],
  priorQuaternion,
  'Paused rotation edits free joint quaternion',
);
assert(
  Math.abs(Math.hypot(...d.qpos.slice(3, 7)) - 1) < 1e-9,
  'Edited quaternion stays normalized',
);
drag.clear();
mj.mj_forward(m, d);
const hinged = [...d.qpos];
drag.update(begin(3), true);
drag.update(move(), true);
assert.deepEqual(
  [...d.qpos],
  hinged,
  'Hinged body cannot teleport when paused',
);
drag.clear();
mj.mj_forward(m, d);
const root = [...d.qpos.slice(0, 3)];
drag.update(begin(2), true);
drag.update(move(), true);
assert.notDeepEqual(
  [...d.qpos.slice(0, 3)],
  root,
  'Child selection edits its free root',
);
drag.clear();
mj.mj_forward(m, d);
d.xfrc_applied[6] = 2;
drag.update(begin(1, 1, [0, 0.1, 0]));
drag.update(move(3, 0.04, 0));
drag.apply();
assert(
  Math.hypot(...d.xfrc_applied.slice(9, 12)) > 1e-5,
  'Off-centre native drag generates torque',
);
drag.clear();
assert.equal(d.xfrc_applied[6], 2, 'Unrelated forces survive release');
drag.update(begin(1, 2));
drag.update(move(1));
drag.apply();
assert(
  Math.hypot(...d.xfrc_applied.slice(9, 12)) > 1e-5,
  'Rotation gesture produces physical torque',
);
await new Promise((resolve) => setTimeout(resolve, 1050));
drag.apply();
assert.equal(d.xfrc_applied[6], 2, 'Lost pointer lease expires');
assert(
  d.xfrc_applied.slice(7).every((v) => Math.abs(v) < 1e-8),
  'Expired rotation clears torque',
);
drag.dispose();
d.delete();
m.delete();
// Contact force is read from the solver, transformed to world coordinates, and supports weight.
const cm = mj.MjModel.from_xml_string(
  '<mujoco><worldbody><geom type="plane" size="2 2 .1"/><body pos="0 0 .1"><freejoint/><geom type="box" size=".1 .1 .1" mass="1"/></body></worldbody></mujoco>',
);
const cd = new mj.MjData(cm),
  debug = createViewerForce(mj, cm, cd);
for (let i = 0; i < 1000; i++) mj.mj_step(cm, cd);
mj.mj_forward(cm, cd);
debug.setDisplay({ contacts: true, forces: true });
const sample = debug.read();
assert(sample.contacts.length >= 3);
let vertical = 0;
for (let i = 5; i < sample.forces.length; i += 6) vertical += sample.forces[i];
assert(
  Math.abs(vertical - 9.81) < 0.02,
  'World-space contact force balances gravity',
);
debug.dispose();
cd.delete();
cm.delete();
console.log(
  'Native viewer: free-root pose, articulated constraints, mocap, torque, lease and solver force checks passed',
);
