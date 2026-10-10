import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import loadMujoco from '@mujoco/mujoco';
import {
  simulationParams,
  applyPositionServo,
  readPositionServo,
} from '../src/lib/control.mjs';
const mj = await loadMujoco();
function simulate(name, seconds, configure, update) {
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
    let peak = 0,
      errorPeak = 0;
    for (let i = 0; i < seconds / model.opt.timestep; i++) {
      update?.(model, data);
      mj.mj_step(model, data);
      if (i > (seconds / model.opt.timestep) * 0.75) {
        peak = Math.max(peak, Math.abs(data.qpos[0]));
        if (name === 'actuator')
          errorPeak = Math.max(
            errorPeak,
            Math.abs(data.ctrl[0] - data.qpos[0]),
          );
      }
    }
    assert(
      [...data.qpos, ...data.qvel].every(Number.isFinite),
      `${name}: nonfinite state`,
    );
    mj.mj_forward(model, data);
    return {
      position: data.qpos[0],
      velocity: data.qvel[0],
      time: data.time,
      peak,
      errorPeak,
      control: name === 'actuator' ? readPositionServo(model, data) : null,
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
const servo = (
  target,
  gain = 30,
  derivative = 6,
  gravityComp = true,
  seconds = 12,
) =>
  simulate('actuator', seconds, (m, d) =>
    applyPositionServo(m, d, {
      ...simulationParams,
      target,
      gain,
      derivative,
      gravityComp,
    }),
  );
const tracking = [];
for (const gain of [5, 30, 100])
  for (const target of [-1.3, -0.6, 0, 0.6, 1.3]) {
    const result = servo(target, gain);
    assert(
      Math.abs(result.control.error) < 1e-4,
      `PD + gravity compensation must converge: kp=${gain}, target=${target}, error=${result.control.error}`,
    );
    assert(
      Math.abs(result.velocity) < 1e-4,
      'Tracking must settle, not merely pass through the target.',
    );
    tracking.push({
      gain,
      target,
      error: result.control.error,
      velocity: result.velocity,
    });
  }
const undamped = servo(0.6, 30, 0, true, 6),
  damped = servo(0.6, 30, 6, true, 6);
assert(
  damped.errorPeak < undamped.errorPeak * 0.05,
  'The explicit D gain must suppress late oscillations.',
);
const uncompensated = servo(0.6, 30, 6, false),
  highGainUncompensated = servo(0.6, 100, 6, false);
assert(
  Math.abs(uncompensated.control.error) > 0.02,
  'Uncompensated PD must expose the gravity-induced steady-state error.',
);
assert(
  Math.abs(highGainUncompensated.control.error) <
    Math.abs(uncompensated.control.error),
  'Higher P gain must reduce, not falsely eliminate, the gravity error.',
);
assert(
  Math.abs(highGainUncompensated.control.error) > 0.005,
  'Increasing finite P gain must not masquerade as gravity compensation.',
);
const reversal = simulate('actuator', 12, null, (m, d) =>
  applyPositionServo(m, d, {
    ...simulationParams,
    target: d.time < 3 ? 1.1 : -1.1,
  }),
);
assert(
  Math.abs(reversal.control.error) < 1e-4,
  'Live target reversal must also converge.',
);
const limited = servo(1.3, 100, 0, true, 0.002);
assert(
  limited.control.saturated && Math.abs(limited.control.torque - 40) < 1e-6,
  'The reported PD output must obey the actual actuator torque limit.',
);
console.log(
  'PASS: PD converges within 1e-4 rad at 15 gain/target combinations; D suppresses oscillation, gravity toggle exposes steady-state error, live reversal and torque limit behave correctly.',
);
console.table(tracking);
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
