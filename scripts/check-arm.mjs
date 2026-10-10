import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import loadMujoco from '@mujoco/mujoco';
import {
  armJoints,
  armSensors,
  armPoses,
  armDefaults,
  applyArmControls,
  resetArm,
} from '../src/lib/arm-runtime.mjs';

const mj = await loadMujoco();
const model = mj.MjModel.from_xml_string(
  readFileSync(new URL('../public/examples/arm.xml', import.meta.url), 'utf8'),
);
const data = new mj.MjData(model),
  joints = armJoints(mj, model),
  sensors = armSensors(mj, model);
const cube = mj.mj_name2id(model, 1, 'sample'),
  tip = mj.mj_name2id(model, 6, 'tool_tip');
const sensor = (name) => {
  const s = sensors.find((s) => s.name === name);
  return Array.from(data.sensordata.slice(s.address, s.address + s.dimension));
};
const step = (seconds) => {
  for (let i = 0; i < Math.round(seconds / model.opt.timestep); i++)
    mj.mj_step(model, data);
  mj.mj_forward(model, data);
};
try {
  assert.equal(
    model.nu,
    6,
    'Four arm actuators and two independent finger actuators',
  );
  assert.equal(
    model.neq,
    0,
    'The cube must not be attached with an equality/weld constraint',
  );
  for (const target of [armPoses.home, armPoses.inspect, armPoses.grasp]) {
    resetArm(mj, model, data, joints);
    applyArmControls(model, data, joints, target, 0, armDefaults);
    step(4);
    assert(
      joints.every((j, i) => Math.abs(data.qpos[j.qpos] - target[i]) < 0.001),
      'Unloaded compensated arm must reach each teaching pose',
    );
    assert([...data.qpos, ...data.qvel].every(Number.isFinite));
  }
  resetArm(mj, model, data, joints);
  applyArmControls(model, data, joints, armPoses.inspect, 0, armDefaults);
  step(0.12);
  assert(
    Math.abs(data.qvel[1]) > 0.01,
    'Sensor test must sample an actually moving joint',
  );
  assert(Math.abs(sensor('shoulder_velocity')[0] - data.qvel[1]) < 1e-12);
  assert(Math.abs(sensor('shoulder_position')[0] - data.qpos[1]) < 1e-12);
  sensor('tool_position').forEach((v, i) =>
    assert(Math.abs(v - data.site_xpos[tip * 3 + i]) < 1e-12),
  );
  assert(Math.abs(Math.hypot(...sensor('tool_orientation')) - 1) < 1e-12);
  applyArmControls(model, data, joints, [100, -100, 100, -100], 2, armDefaults);
  joints.forEach((j) =>
    assert(data.ctrl[j.actuator] >= j.min && data.ctrl[j.actuator] <= j.max),
  );
  assert.equal(data.ctrl[4], 0.065);
  resetArm(mj, model, data, joints);
  applyArmControls(model, data, joints, armPoses.home, 0, {
    ...armDefaults,
    gravity: false,
  });
  step(4);
  assert(
    Math.abs(data.qpos[1] - armPoses.home[1]) > 0.005,
    'Disabling gravity compensation must expose the static PD error',
  );
  assert.equal(
    model.body_gravcomp[cube],
    0,
    'Compensation must never cancel the sample cube gravity',
  );

  const grasp = (friction) => {
    const settings = { ...armDefaults, friction };
    resetArm(mj, model, data, joints, settings);
    applyArmControls(model, data, joints, armPoses.grasp, 0, settings);
    step(4);
    applyArmControls(model, data, joints, armPoses.grasp, 1, settings);
    step(2);
    const normalForce =
      sensor('left_pressure')[0] + sensor('right_pressure')[0];
    applyArmControls(model, data, joints, armPoses.home, 1, settings);
    step(4);
    return { height: data.xpos[cube * 3 + 2], normalForce };
  };
  const held = grasp(0.8),
    slipped = grasp(0);
  assert(
    held.normalForce > 1,
    'Closing the fingers must register real touch forces',
  );
  assert(
    held.height > 0.45,
    `Frictional grasp must lift the free cube, got ${held.height}`,
  );
  assert(
    slipped.height < 0.16,
    `With zero friction the cube must slip, got ${slipped.height}`,
  );
  resetArm(mj, model, data, joints);
  assert.equal(data.time, 0);
  console.log(
    'Original arm: pose tracking, named sensors, limits, gravity toggle and real frictional grasp passed.',
    { held, slipped },
  );
} finally {
  data.delete();
  model.delete();
}
