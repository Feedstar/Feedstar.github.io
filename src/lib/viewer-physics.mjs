// Shared by every lab worker; native MuJoCo perturbations own the physics.
export function viewerBodies(mj, model) {
  return Array.from({ length: model.nbody }, (_, id) => {
    let movable = false,
      editable = model.body_mocapid[id] >= 0;
    for (let b = id; b > 0; b = model.body_parentid[b]) {
      if (model.body_dofnum[b] > 0) movable = true;
      if (
        model.body_jntnum[b] === 1 &&
        model.jnt_type[model.body_jntadr[b]] === 0
      )
        editable = true;
    }
    return {
      id,
      name: mj.mj_id2name(model, 1, id) || `body_${id}`,
      parent: model.body_parentid[id],
      mass: model.body_mass[id],
      movable,
      editable,
      mocap: model.body_mocapid[id] >= 0,
    };
  });
}

export function createViewerForce(mj, model, data) {
  const bodies = viewerBodies(mj, model);
  const scene = new mj.MjvScene(model, 1),
    perturb = new mj.MjvPerturb();
  mj.mjv_defaultPerturb(perturb);
  const contactWrench = new mj.DoubleBuffer(6);
  const contribution = new Float64Array(6),
    baseline = new Float64Array(6);
  let expires = 0,
    appliedBody = -1,
    active = false;
  let flags = { contacts: false, forces: false, joints: false, com: false };
  const vec = (v) =>
    Array.isArray(v) && v.length === 3 && v.every(Number.isFinite);
  function remove() {
    if (appliedBody >= 0)
      for (let i = 0; i < 6; i++)
        data.xfrc_applied[appliedBody * 6 + i] -= contribution[i];
    contribution.fill(0);
    appliedBody = -1;
  }
  function clear() {
    remove();
    active = false;
    perturb.active = 0;
  }
  function apply(paused = false) {
    remove();
    if (!active || performance.now() > expires) {
      clear();
      return;
    }
    mj.mjv_applyPerturbPose(model, data, perturb, paused ? 1 : 0);
    if (paused || bodies[perturb.select].mocap) return;
    const offset = perturb.select * 6;
    baseline.set(data.xfrc_applied.subarray(offset, offset + 6));
    data.xfrc_applied.fill(0, offset, offset + 6);
    mj.mjv_applyPerturbForce(model, data, perturb);
    contribution.set(data.xfrc_applied.subarray(offset, offset + 6));
    for (let i = 0; i < 6; i++) data.xfrc_applied[offset + i] += baseline[i];
    appliedBody = perturb.select;
  }
  return {
    clear,
    apply,
    dispose() {
      clear();
      contactWrench.delete();
      perturb.delete();
      scene.delete();
    },
    setDisplay(next) {
      flags = { ...flags, ...next };
    },
    update(next, paused = false) {
      if (!next) {
        clear();
        return true;
      }
      if (next.kind === 'begin') {
        clear();
        const b = bodies[next.body],
          c = next.camera;
        if (
          !b ||
          next.body <= 0 ||
          (!b.movable && !b.mocap) ||
          !vec(next.local) ||
          !c ||
          !vec(c.position) ||
          !vec(c.forward) ||
          !vec(c.up) ||
          !Number.isFinite(c.fov) ||
          c.fov < 1 ||
          c.fov > 170 ||
          !Number.isFinite(c.aspect) ||
          c.aspect <= 0 ||
          ![1, 2].includes(next.active)
        )
          return false;
        const cameras = scene.camera;
        for (let i = 0; i < 2; i++) {
          const eye = cameras.get(i);
          eye.pos.set(c.position);
          eye.forward.set(c.forward);
          eye.up.set(c.up);
          eye.frustum_near = 0.01;
          eye.frustum_far = 100;
          eye.frustum_top = 0.01 * Math.tan((c.fov * Math.PI) / 360);
          eye.frustum_bottom = -eye.frustum_top;
          eye.frustum_center = 0;
          eye.frustum_width = eye.frustum_top * 2 * c.aspect;
          eye.orthographic = 0;
          cameras.set(i, eye);
          eye.delete();
        }
        // The embind vector is a value; assign the edited cameras back to the scene.
        scene.camera = cameras;
        cameras.delete();
        perturb.select = next.body;
        perturb.localpos.set(next.local);
        mj.mjv_initPerturb(model, data, scene, perturb);
        perturb.active = next.active;
        active = true;
      } else if (next.kind === 'move') {
        if (
          !active ||
          ![1, 2, 3, 4].includes(next.action) ||
          !Number.isFinite(next.dx) ||
          !Number.isFinite(next.dy)
        )
          return false;
        // Deltas are normalized by viewport height, as in simulate.cc.
        mj.mjv_movePerturb(
          model,
          data,
          next.action,
          Math.max(-1, Math.min(1, next.dx)),
          Math.max(-1, Math.min(1, next.dy)),
          scene,
          perturb,
        );
      } else if (next.kind !== 'keepalive' || !active) return false;
      expires = performance.now() + 1000;
      apply(paused);
      return true;
    },
    read() {
      const contacts = [],
        forces = [],
        joints = [];
      if (flags.contacts || flags.forces) {
        const list = data.contact,
          wrench = contactWrench.GetView();
        for (let i = 0; i < data.ncon; i++) {
          const contact = list.get(i);
          if (contact.efc_address >= 0) {
            if (flags.contacts) contacts.push(...contact.pos);
            if (flags.forces) {
              mj.mj_contactForce(model, data, i, contactWrench);
              const f = contact.frame;
              forces.push(
                ...contact.pos,
                f[0] * wrench[0] + f[3] * wrench[1] + f[6] * wrench[2],
                f[1] * wrench[0] + f[4] * wrench[1] + f[7] * wrench[2],
                f[2] * wrench[0] + f[5] * wrench[1] + f[8] * wrench[2],
              );
            }
          }
          contact.delete();
        }
        list.delete();
      }
      if (flags.joints)
        for (let i = 0; i < model.njnt; i++) {
          if (model.jnt_type[i] < 2) continue;
          const a = i * 3;
          joints.push(
            ...data.xanchor.subarray(a, a + 3),
            ...data.xaxis.subarray(a, a + 3),
          );
        }
      return {
        contacts,
        forces,
        joints,
        com: flags.com ? Array.from(data.xipos) : [],
        target: active ? Array.from(perturb.refpos) : null,
        anchor: active
          ? Array.from(
              data.xipos.subarray(perturb.select * 3, perturb.select * 3 + 3),
            )
          : null,
      };
    },
  };
}
