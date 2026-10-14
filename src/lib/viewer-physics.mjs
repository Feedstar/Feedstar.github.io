// Shared by every lab worker. Forces live in MuJoCo, never in the render meshes.
export function viewerBodies(mj, model) {
  return Array.from({ length: model.nbody }, (_, id) => {
    let movable = false;
    for (let b = id; b > 0; b = model.body_parentid[b])
      if (model.body_dofnum[b] > 0) {
        movable = true;
        break;
      }
    return {
      id,
      name: mj.mj_id2name(model, 1, id) || `body_${id}`,
      parent: model.body_parentid[id],
      mass: model.body_mass[id],
      movable,
      mocap: model.body_mocapid[id] >= 0,
    };
  });
}

export function createViewerForce(mj, model, data) {
  const bodies = viewerBodies(mj, model),
    jac = new Float64Array(3 * model.nv);
  const point = [0, 0, 0],
    velocity = [0, 0, 0],
    force = [0, 0, 0];
  let request = null,
    expires = 0,
    appliedBody = -1;
  const contribution = new Float64Array(6);
  function remove() {
    if (appliedBody >= 0)
      for (let i = 0; i < 6; i++)
        data.xfrc_applied[appliedBody * 6 + i] -= contribution[i];
    contribution.fill(0);
    appliedBody = -1;
  }
  function clear() {
    remove();
    request = null;
  }
  const vector = (v) =>
    Array.isArray(v) && v.length === 3 && v.every(Number.isFinite);
  return {
    clear,
    update(next) {
      if (!next) {
        clear();
        return;
      }
      if (
        !Number.isInteger(next.body) ||
        !bodies[next.body]?.movable ||
        !vector(next.local) ||
        !vector(next.target) ||
        [...next.local, ...next.target].some((v) => Math.abs(v) > 100)
      ) {
        clear();
        return;
      }
      request = {
        body: next.body,
        local: [...next.local],
        target: [...next.target],
      };
      // The view renews this lease while held; lost tabs cannot leave a stuck force.
      expires = performance.now() + 1000;
    },
    apply() {
      remove();
      if (!request || performance.now() > expires) {
        request = null;
        return;
      }
      const { body, local, target } = request,
        r = body * 9,
        p = body * 3;
      for (let i = 0; i < 3; i++)
        point[i] =
          data.xpos[p + i] +
          data.xmat[r + i * 3] * local[0] +
          data.xmat[r + i * 3 + 1] * local[1] +
          data.xmat[r + i * 3 + 2] * local[2];
      mj.mj_jac(model, data, jac, null, point, body);
      const mass = Math.max(0.2, Math.min(3, model.body_subtreemass[body]));
      const gain = Math.sqrt(mass),
        stiffness = 180 * gain,
        damping = 12 * gain;
      for (let i = 0; i < 3; i++) {
        velocity[i] = 0;
        for (let j = 0; j < model.nv; j++)
          velocity[i] += jac[i * model.nv + j] * data.qvel[j];
        force[i] = stiffness * (target[i] - point[i]) - damping * velocity[i];
      }
      const scale = Math.min(
        1,
        (80 * gain) / Math.max(1e-9, Math.hypot(...force)),
      );
      for (let i = 0; i < 3; i++) contribution[i] = force[i] * scale;
      // xfrc_applied is a world-space wrench at the body's centre of mass.
      const x = point[0] - data.xipos[p],
        y = point[1] - data.xipos[p + 1],
        z = point[2] - data.xipos[p + 2];
      contribution[3] = y * contribution[2] - z * contribution[1];
      contribution[4] = z * contribution[0] - x * contribution[2];
      contribution[5] = x * contribution[1] - y * contribution[0];
      appliedBody = body;
      for (let i = 0; i < 6; i++)
        data.xfrc_applied[p * 2 + i] += contribution[i];
    },
  };
}
