import {
  armJoints,
  armPoses,
  resetArm,
  applyArmControls,
  armDefaults,
} from './arm-runtime.mjs';
import { studySpecs } from './study-specs.mjs';
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const deg = (v) => (v * 180) / Math.PI;
const distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
// Solve the 3 × 3 positive-definite damped normal equation with pivoting.
export function solve3(matrix, rhs) {
  const a = matrix.map((row, i) => [...row, rhs[i]]);
  for (let k = 0; k < 3; k++) {
    let p = k;
    for (let i = k + 1; i < 3; i++)
      if (Math.abs(a[i][k]) > Math.abs(a[p][k])) p = i;
    [a[p], a[k]] = [a[k], a[p]];
    if (Math.abs(a[k][k]) < 1e-12) return [0, 0, 0];
    const s = a[k][k];
    for (let j = k; j < 4; j++) a[k][j] /= s;
    for (let i = 0; i < 3; i++)
      if (i !== k) {
        const f = a[i][k];
        for (let j = k; j < 4; j++) a[i][j] -= f * a[k][j];
      }
  }
  return a.map((row) => row[3]);
}
export function createStudy(mj, kind, xml) {
  const spec = studySpecs[kind];
  if (!spec) throw new Error('Unknown study');
  const model = mj.MjModel.from_xml_string(xml),
    data = new mj.MjData(model);
  let settings = { ...spec.defaults },
    controlsAt = -1,
    goal = [0, 0, 0],
    residual = 0;
  const siteId = (name) => mj.mj_name2id(model, 6, name);
  const point = (name) =>
    Array.from(data.site_xpos.slice(siteId(name) * 3, siteId(name) * 3 + 3));
  const ik = kind === 'inverse-kinematics';
  const joints = ik ? armJoints(mj, model) : [];
  const scratch = ik ? new mj.MjData(model) : null,
    jac = ik ? new mj.DoubleBuffer(model.nv * 3) : null;
  const tip = ik ? siteId('tool_tip') : -1;
  let solved = [...armPoses.home];
  const inertia0 = Array.from(model.body_inertia),
    loadBody = kind === 'tendon' ? mj.mj_name2id(model, 1, 'load') : -1;
  function parameters() {
    if (kind === 'linkage') data.eq_active[0] = settings.closed ? 1 : 0;
    if (kind === 'tendon') {
      model.tendon_stiffness[0] = settings.stiffness;
      model.tendon_damping[0] = settings.damping;
      model.body_mass[loadBody] = settings.mass;
      for (let i = 0; i < 3; i++)
        model.body_inertia[loadBody * 3 + i] =
          inertia0[loadBody * 3 + i] * settings.mass;
      // Refresh mass-dependent constants using independent data; preserve live state.
      const constants = new mj.MjData(model);
      mj.mj_setConst(model, constants);
      constants.delete();
    }
    if (kind === 'scanner') {
      data.mocap_pos[0] = settings.x;
      data.mocap_pos[1] = settings.y;
      data.mocap_pos[2] = 0.2;
    }
  }
  function control() {
    if (ik) {
      const phase = data.time * settings.rate;
      goal = [
        settings.x,
        settings.y + (settings.mode === 'circle' ? 0.1 * Math.sin(phase) : 0),
        settings.z + (settings.mode === 'circle' ? 0.1 * Math.cos(phase) : 0),
      ];
      scratch.qpos.set(data.qpos);
      joints.forEach((j, i) => (scratch.qpos[j.qpos] = solved[i]));
      for (let iteration = 0; iteration < 12; iteration++) {
        mj.mj_forward(model, scratch);
        const actual = Array.from(
            scratch.site_xpos.slice(tip * 3, tip * 3 + 3),
          ),
          e = goal.map((v, i) => v - actual[i]);
        if (Math.hypot(...e) < 0.00005) break;
        mj.mj_jacSite(model, scratch, jac, null, tip);
        const values = jac.GetView(),
          J = [0, 1, 2].map((r) =>
            joints.map((j) => values[r * model.nv + j.dof]),
          );
        const A = J.map((row, r) =>
          J.map(
            (other, c) =>
              row.reduce((sum, v, i) => sum + v * other[i], 0) +
              (r === c ? settings.damping ** 2 : 0),
          ),
        );
        const v = solve3(A, e);
        joints.forEach((j, i) => {
          const delta = clamp(
            J.reduce((sum, row, r) => sum + row[i] * v[r], 0),
            -0.12,
            0.12,
          );
          scratch.qpos[j.qpos] = clamp(
            scratch.qpos[j.qpos] + delta,
            j.min,
            j.max,
          );
        });
      }
      solved = joints.map((j) => scratch.qpos[j.qpos]);
      mj.mj_forward(model, scratch);
      residual = distance(
        goal,
        Array.from(scratch.site_xpos.slice(tip * 3, tip * 3 + 3)),
      );
      applyArmControls(model, data, joints, solved, 0, {
        ...armDefaults,
        gain: 180,
        damping: 20,
      });
    } else if (kind === 'linkage')
      data.ctrl[0] = 0.7 * Math.sin(data.time * settings.rate);
    else if (kind === 'tendon')
      data.ctrl[0] =
        settings.mode === 'step'
          ? data.time < 0.5
            ? 0
            : -settings.amplitude
          : (-settings.amplitude * (1 - Math.cos(data.time * settings.rate))) /
            2;
    else if (kind === 'scanner')
      data.ctrl[0] =
        settings.mode === 'fixed'
          ? 0
          : ((settings.span * Math.PI) / 360) *
            Math.sin(data.time * settings.rate);
    controlsAt = data.time;
  }
  function reset() {
    if (ik) {
      resetArm(mj, model, data, joints);
      solved = [...armPoses.home];
    } else mj.mj_resetData(model, data);
    controlsAt = -1;
    parameters();
    control();
    mj.mj_forward(model, data);
  }
  function update(patch, restart = false) {
    for (const [key, , min, max] of spec.ranges)
      if (Number.isFinite(patch[key]))
        settings[key] = clamp(patch[key], min, max);
    if (spec.modes.some(([name]) => name === patch.mode))
      settings.mode = patch.mode;
    const changedLoop =
      kind === 'linkage' &&
      typeof patch.closed === 'boolean' &&
      patch.closed !== settings.closed;
    if (typeof patch.closed === 'boolean' && kind === 'linkage')
      settings.closed = patch.closed;
    if (restart || changedLoop) reset();
    else {
      parameters();
      control();
      mj.mj_forward(model, data);
    }
  }
  function step() {
    if (data.time - controlsAt >= 0.01 - 1e-8) control();
    mj.mj_step(model, data);
  }
  function observe() {
    mj.mj_forward(model, data);
    if (ik) {
      const actual = point('tool_tip'),
        e = distance(goal, actual),
        tracking = Math.max(
          ...joints.map((j, i) => Math.abs(solved[i] - data.qpos[j.qpos])),
        );
      const limited = joints.some(
        (j, i) =>
          Math.min(Math.abs(solved[i] - j.min), Math.abs(solved[i] - j.max)) <
          0.01,
      );
      const segments = [...actual, ...goal];
      if (settings.mode === 'circle')
        for (let i = 0; i < 64; i++) {
          const a = (i / 64) * Math.PI * 2,
            b = ((i + 1) / 64) * Math.PI * 2;
          segments.push(
            settings.x,
            settings.y + 0.1 * Math.sin(a),
            settings.z + 0.1 * Math.cos(a),
            settings.x,
            settings.y + 0.1 * Math.sin(b),
            settings.z + 0.1 * Math.cos(b),
          );
        }
      return {
        values: [e * 1000, residual * 1000, deg(tracking)],
        plot: [actual[2], goal[2]],
        actual,
        target: goal,
        segments,
        status:
          residual > 0.01
            ? limited
              ? '逆解受限 · 关节限位'
              : '目标未收敛 / 可能不可达'
            : e > 0.01
              ? '执行器追踪中'
              : '已接近目标',
        solved,
      };
    }
    if (kind === 'linkage') {
      const a = point('closure_a'),
        b = point('closure_b');
      return {
        values: [distance(a, b) * 1000, deg(data.qpos[0]), deg(data.qpos[2])],
        plot: [deg(data.qpos[0]), deg(data.ctrl[0])],
        actual: point('trace'),
        segments: [...a, ...b],
        status: settings.closed ? '闭环约束开启' : '开链 · 从动杆已断开',
      };
    }
    if (kind === 'tendon') {
      const length = data.ten_length[0],
        stretch = length - model.tendon_lengthspring[0],
        force =
          -settings.stiffness * stretch -
          settings.damping * data.ten_velocity[0];
      const path = [];
      const n = data.ten_wrapnum[0],
        adr = data.ten_wrapadr[0];
      for (let i = 0; i < n; i++) {
        const p = Array.from(
          data.wrap_xpos.slice((adr + i) * 3, (adr + i) * 3 + 3),
        );
        path.push(p);
        if (
          i + 1 < n &&
          data.wrap_obj[adr + i] >= 0 &&
          data.wrap_obj[adr + i] === data.wrap_obj[adr + i + 1]
        ) {
          const geom = data.wrap_obj[adr + i],
            c = Array.from(data.geom_xpos.slice(geom * 3, geom * 3 + 3));
          const next = data.wrap_xpos.slice(
            (adr + i + 1) * 3,
            (adr + i + 1) * 3 + 3,
          );
          const start = Math.atan2(p[1] - c[1], p[0] - c[0]),
            end = Math.atan2(next[1] - c[1], next[0] - c[0]);
          const sweep = Math.atan2(
              Math.sin(end - start),
              Math.cos(end - start),
            ),
            r = model.geom_size[geom * 3];
          for (let k = 1; k < 12; k++) {
            const angle = start + (sweep * k) / 12;
            path.push([
              c[0] + r * Math.cos(angle),
              c[1] + r * Math.sin(angle),
              c[2],
            ]);
          }
        }
      }
      return {
        values: [length, stretch * 1000, force],
        plot: [data.qpos[1], data.qpos[0]],
        segments: path.slice(1).flatMap((p, i) => [...path[i], ...p]),
        status:
          force < 0 ? '腱受拉 · 回位弹簧共同作用' : '腱压缩 / 接近松弛长度',
      };
    }
    const range = data.sensordata[0],
      origin = point('beam'),
      offset = siteId('beam') * 9,
      direction = [
        data.site_xmat[offset + 2],
        data.site_xmat[offset + 5],
        data.site_xmat[offset + 8],
      ];
    const hit = range >= 0,
      end = origin.map((v, i) => v + direction[i] * (hit ? range : 2));
    return {
      values: [range, deg(data.qpos[0]), hit ? 1 : 0],
      plot: [hit ? range : null],
      actual: hit ? end : undefined,
      segments: [...origin, ...end],
      status: hit ? '已命中最近表面' : '未命中 · 原始读数 −1',
      origin,
    };
  }
  reset();
  return {
    model,
    data,
    step,
    observe,
    reset,
    update,
    get settings() {
      return { ...settings };
    },
    dispose() {
      jac?.delete();
      scratch?.delete();
      data.delete();
      model.delete();
    },
  };
}
