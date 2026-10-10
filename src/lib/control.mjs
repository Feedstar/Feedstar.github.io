export const simulationParams = {
  damping: 0.12,
  angle: 0.85,
  target: 0.6,
  gain: 30,
  derivative: 6,
  gravityComp: true,
  friction: 0.25,
  speed: 1,
};

// Single hinge, unit actuator gear, fixed position target (desired velocity = 0).
// The D term belongs to the actuator; joint damping is zero in this example.
export function applyPositionServo(model, data, params) {
  data.ctrl[0] = params.target;
  model.actuator_gainprm[0] = params.gain;
  model.actuator_biasprm[1] = -params.gain;
  model.actuator_biasprm[2] = -params.derivative;
  for (let body = 1; body < model.nbody; body++)
    model.body_gravcomp[body] = params.gravityComp ? 1 : 0;
}

export function readPositionServo(model, data) {
  const target = data.ctrl[0];
  const error = target - data.qpos[0];
  const pTorque = model.actuator_gainprm[0] * error;
  const dTorque = model.actuator_biasprm[2] * data.qvel[0];
  return {
    target,
    error,
    pTorque,
    dTorque,
    torque: data.actuator_force[0],
    gravityTorque: data.qfrc_gravcomp[0],
    saturated:
      Math.abs(pTorque + dTorque) > model.actuator_forcerange[1] + 1e-6,
  };
}
