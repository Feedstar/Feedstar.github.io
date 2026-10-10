import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import loadMujoco from '@mujoco/mujoco';
const mj = await loadMujoco();
function simulate(name, seconds, configure) {
  const model = mj.MjModel.from_xml_string(
    readFileSync(
      new URL(`../public/examples/${name}.xml`, import.meta.url),
      'utf8',
    ),
  );
  const data = new mj.MjData(model);
  try {
    mj.mj_resetDataKeyframe(model, data, 0);
    configure?.(model, data);
    let peak = 0;
    for (let i = 0; i < seconds / model.opt.timestep; i++) {
      mj.mj_step(model, data);
      if (i > (seconds / model.opt.timestep) * 0.75)
        peak = Math.max(peak, Math.abs(data.qpos[0]));
    }
    assert(
      [...data.qpos, ...data.qvel].every(Number.isFinite),
      `${name}: nonfinite state`,
    );
    return {
      position: data.qpos[0],
      velocity: data.qvel[0],
      time: data.time,
      peak,
    };
  } finally {
    data.delete();
    model.delete();
  }
}
const low = simulate('pendulum', 6, (m) => (m.dof_damping[0] = 0)),
  high = simulate('pendulum', 6, (m) => (m.dof_damping[0] = 0.8));
assert(
  high.peak < low.peak * 0.4,
  'Damping must materially reduce late oscillation amplitude.',
);
const positive = simulate('actuator', 4, (m, d) => (d.ctrl[0] = 0.6)),
  negative = simulate('actuator', 4, (m, d) => (d.ctrl[0] = -0.6));
assert(
  positive.position > 0.3 && negative.position < -0.3,
  'Target control must change the direction of the actual MuJoCo response.',
);
const slippery = simulate('contact', 1, (m) => {
    for (let i = 0; i < m.ngeom; i++) m.geom_friction[i * 3] = 0.05;
  }),
  sticky = simulate('contact', 1, (m) => {
    for (let i = 0; i < m.ngeom; i++) m.geom_friction[i * 3] = 0.6;
  });
assert(
  slippery.position > sticky.position * 2,
  'Friction must materially change travel distance.',
);
console.log(
  `PASS: MuJoCo ${mj.mj_versionString()}, all MJCF models compile; damping, target control and friction produce expected physical differences.`,
);
console.table({
  lowDamping: low,
  highDamping: high,
  positiveTarget: positive,
  negativeTarget: negative,
  lowFriction: slippery,
  highFriction: sticky,
});
