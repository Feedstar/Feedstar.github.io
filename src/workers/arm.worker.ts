import { createViewerForce, viewerBodies } from '../lib/viewer-physics.mjs';
let viewerForce: ReturnType<typeof createViewerForce> | undefined;
import loadMujoco from '@mujoco/mujoco';
import wasmUrl from '@mujoco/mujoco/mujoco.wasm?url';
import xml from '../../public/examples/arm.xml?raw';
import {
  armJoints,
  armPoses,
  armSensors,
  armDefaults,
  applyArmControls,
  resetArm,
} from '../lib/arm-runtime.mjs';
import type { ArmGeom, ArmJoint } from '../lib/arm-types';

let mj: any, model: any, data: any;
let joints: ArmJoint[] = [];
let targets = [...armPoses.home],
  grip = 0,
  settings = { ...armDefaults };
let playing = true,
  visible = true,
  stopped = false,
  loading = false,
  speed = 1;
let last = 0,
  accumulator = 0,
  realtime = 1;
let timer: ReturnType<typeof setTimeout> | undefined;

function sendState(forced = false) {
  const state = {
    type: 'state',
    viewer: viewerForce?.read(),
    forced,
    time: data.time,
    contacts: data.ncon,
    realtime,
    qpos: new Float64Array(data.qpos),
    qvel: new Float64Array(data.qvel),
    ctrl: new Float64Array(data.ctrl),
    sensors: new Float64Array(data.sensordata),
    positions: new Float32Array(data.geom_xpos),
    matrices: new Float32Array(data.geom_xmat),
    bodyPositions: new Float64Array(data.xpos),
    bodyQuaternions: new Float64Array(data.xquat),
  };
  self.postMessage(state, {
    transfer: Object.values(state)
      .filter((v) => ArrayBuffer.isView(v))
      .map((v: any) => v.buffer),
  });
}
async function load() {
  if (loading || model) return;
  loading = true;
  self.postMessage({ type: 'progress', message: '正在加载 MuJoCo 引擎…' });
  mj = await loadMujoco({
    locateFile: (file: string) => (file.endsWith('.wasm') ? wasmUrl : file),
  });
  if (stopped) return;
  model = mj.MjModel.from_xml_string(xml);
  data = new mj.MjData(model);
  viewerForce = createViewerForce(mj, model, data);
  joints = armJoints(mj, model);
  resetArm(mj, model, data, joints, settings);
  const geoms: ArmGeom[] = [];
  for (let id = 0; id < model.ngeom; id++) {
    if (model.geom_group[id] === 3) continue;
    const material = model.geom_matid[id],
      colorId = material < 0 ? id : material;
    const color = Array.from<number>(
      (material < 0 ? model.geom_rgba : model.mat_rgba).slice(
        colorId * 4,
        colorId * 4 + 4,
      ),
    );
    geoms.push({
      id,
      body: model.geom_bodyid[id],
      type: model.geom_type[id],
      size: Array.from(model.geom_size.slice(id * 3, id * 3 + 3)),
      color,
      name: mj.mj_id2name(model, 5, id) || '',
    });
  }
  const bodies = viewerBodies(mj, model);
  self.postMessage({
    type: 'ready',
    version: mj.mj_versionString(),
    timestep: model.opt.timestep,
    joints,
    bodies,
    sensors: armSensors(mj, model),
    geoms,
  });
  sendState(true);
  loading = false;
  schedule();
}
function schedule() {
  clearTimeout(timer);
  last = performance.now();
  accumulator = 0;
  if (model && playing && visible && !stopped) timer = setTimeout(tick, 0);
}
function tick() {
  if (!model || !playing || !visible || stopped) return;
  const now = performance.now(),
    elapsed = Math.min((now - last) / 1000, 0.06);
  last = now;
  accumulator += elapsed * speed;
  const before = data.time,
    budgetStart = performance.now();
  while (accumulator >= model.opt.timestep) {
    viewerForce?.apply();
    mj.mj_step(model, data);
    accumulator -= model.opt.timestep;
    // Keep a bounded compute budget; slow devices never build a catch-up queue.
    if (performance.now() - budgetStart > 10) {
      accumulator = 0;
      break;
    }
  }
  if (data.time > before) {
    realtime +=
      (Math.min(1, (data.time - before) / Math.max(elapsed * speed, 0.001)) -
        realtime) *
      0.12;
    mj.mj_forward(model, data);
    sendState();
  }
  timer = setTimeout(tick, Math.max(1, 16 - (performance.now() - now)));
}
self.onmessage = async ({ data: message }) => {
  try {
    if (message.type === 'load') {
      await load();
      return;
    }
    if (message.type === 'display') {
      viewerForce?.setDisplay(message.flags);
      if (viewerForce) {
        sendState(true);
      }
      return;
    }
    if (message.type === 'perturb') {
      if (viewerForce?.update(message.request, !playing)) {
        mj.mj_forward(model, data);
        sendState(true);
      }
      return;
    }
    if (message.type === 'visible') {
      visible = Boolean(message.value);
      if (!visible) viewerForce?.clear();
      schedule();
      return;
    }
    if (message.type === 'dispose') {
      viewerForce?.dispose();
      stopped = true;
      clearTimeout(timer);
      data?.delete();
      model?.delete();
      self.close();
      return;
    }
    if (!model) return;
    if (message.type === 'controls') {
      if (Array.isArray(message.targets) && message.targets.length === 4)
        targets = message.targets;
      if (Number.isFinite(message.grip)) grip = message.grip;
      if (message.settings) settings = { ...settings, ...message.settings };
      applyArmControls(model, data, joints, targets, grip, settings);
    }
    if (message.type === 'play') {
      playing = Boolean(message.value);
      if (!playing) viewerForce?.clear();
      schedule();
    }
    if (message.type === 'speed') {
      speed = [0.1, 0.25, 0.5, 1, 2].includes(message.value)
        ? message.value
        : 1;
      schedule();
    }
    if (message.type === 'reset') {
      targets = [...armPoses.home];
      grip = 0;
      realtime = 1;
      viewerForce?.clear();
      resetArm(mj, model, data, joints, settings);
      schedule();
    }
    if (message.type === 'step' && !playing) {
      viewerForce?.apply();
      mj.mj_step(model, data);
    }
    mj.mj_forward(model, data);
    sendState(true);
  } catch (error) {
    clearTimeout(timer);
    playing = false;
    self.postMessage({
      type: 'error',
      message: error instanceof Error ? error.message : String(error),
    });
  }
};
