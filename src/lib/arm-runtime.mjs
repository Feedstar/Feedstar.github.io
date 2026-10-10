// Original teaching examples: these same controls run in the worker and tests.
export const armPoses = {
  home: [0, 0.48, 0.7, Math.PI - 1.18],
  inspect: [-0.55, 0.2, 1.0, Math.PI - 1.2],
  grasp: [0, 0.9, 1.4, Math.PI - 2.3],
};
export const armDefaults = {
  gain: 120,
  damping: 14,
  gravity: true,
  friction: 0.8,
};
export function armJoints(mj, model) {
  return ['base', 'shoulder', 'elbow', 'wrist'].map((name) => {
    const id = mj.mj_name2id(model, 3, name),
      actuator = mj.mj_name2id(model, 19, `${name}_servo`);
    return {
      name,
      id,
      actuator,
      qpos: model.jnt_qposadr[id],
      dof: model.jnt_dofadr[id],
      min: model.jnt_range[id * 2],
      max: model.jnt_range[id * 2 + 1],
    };
  });
}
export function applyArmControls(model, data, joints, targets, grip, settings) {
  joints.forEach((joint, i) => {
    const value = Number.isFinite(targets[i]) ? targets[i] : armPoses.home[i];
    data.ctrl[joint.actuator] = Math.max(joint.min, Math.min(joint.max, value));
    model.actuator_gainprm[joint.actuator * 10] = settings.gain;
    model.actuator_biasprm[joint.actuator * 10 + 1] = -settings.gain;
    model.actuator_biasprm[joint.actuator * 10 + 2] = -settings.damping;
  });
  data.ctrl[4] = data.ctrl[5] = Math.max(0, Math.min(1, grip)) * 0.065;
  // The free cube has gravity at all times; only arm bodies are compensated.
  for (let body = 1; body < model.nbody; body++)
    if (
      model.body_jntnum[body] &&
      model.jnt_type[model.body_jntadr[body]] !== 0
    )
      model.body_gravcomp[body] = settings.gravity ? 1 : 0;
  for (let geom = 0; geom < model.ngeom; geom++)
    model.geom_friction[geom * 3] = settings.friction;
}
export function resetArm(mj, model, data, joints, settings = armDefaults) {
  mj.mj_resetDataKeyframe(model, data, 0);
  applyArmControls(model, data, joints, armPoses.home, 0, settings);
  mj.mj_forward(model, data);
}
export function armSensors(mj, model) {
  return Array.from({ length: model.nsensor }, (_, id) => ({
    name: mj.mj_id2name(model, 20, id),
    address: model.sensor_adr[id],
    dimension: model.sensor_dim[id],
  }));
}
