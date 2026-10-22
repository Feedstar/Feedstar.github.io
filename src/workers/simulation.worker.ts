import { createViewerForce, viewerBodies } from '../lib/viewer-physics.mjs';
let viewerForce: ReturnType<typeof createViewerForce> | undefined;
import loadMujoco from '@mujoco/mujoco';
import wasmUrl from '@mujoco/mujoco/mujoco.wasm?url';
import { examples, type ExampleId } from '../lib/examples';
import {
  simulationParams,
  applyPositionServo,
  readPositionServo,
} from '../lib/control.mjs';
let mj: any,
  model: any,
  data: any,
  id: ExampleId = 'pendulum',
  playing = true,
  visible = true,
  disposed = false;
let params = { ...simulationParams };
let accumulator = 0,
  last = 0,
  timer: ReturnType<typeof setTimeout>;
const send = () => {
  if (!data) return;
  self.postMessage({
    type: 'state',
    viewer: viewerForce?.read(),
    time: data.time,
    qpos: Array.from(data.qpos),
    qvel: Array.from(data.qvel),
    ncon: data.ncon,
    positions: Array.from(data.geom_xpos),
    matrices: Array.from(data.geom_xmat),
    bodyPositions: Array.from(data.xpos),
    bodyQuaternions: Array.from(data.xquat),
    control: id === 'actuator' ? readPositionServo(model, data) : null,
  });
};
function apply() {
  if (!model) return;
  if (id === 'pendulum') model.dof_damping[0] = params.damping;
  if (id === 'actuator') {
    applyPositionServo(model, data, params);
  }
  if (id === 'contact')
    for (let i = 0; i < model.ngeom; i++)
      model.geom_friction[i * 3] = params.friction;
}
function reset() {
  viewerForce?.clear();
  mj.mj_resetDataKeyframe(model, data, 0);
  if (id === 'pendulum') data.qpos[0] = params.angle;
  apply();
  mj.mj_forward(model, data);
  accumulator = 0;
  last = performance.now();
  send();
}
async function load(next: ExampleId) {
  if (!mj)
    mj = await loadMujoco({
      locateFile: (file: string) => (file.endsWith('.wasm') ? wasmUrl : file),
    });
  if (disposed) return;
  clearTimeout(timer);
  viewerForce?.dispose();
  data?.delete();
  model?.delete();
  id = next;
  model = mj.MjModel.from_xml_string(examples[id].xml);
  data = new mj.MjData(model);
  viewerForce = createViewerForce(mj, model, data);
  reset();
  self.postMessage({
    type: 'ready',
    id,
    version: mj.mj_versionString(),
    bodies: viewerBodies(mj, model),
    geomBodies: Array.from(model.geom_bodyid),
    types: Array.from(model.geom_type),
    sizes: Array.from(model.geom_size),
    colors: Array.from(model.geom_rgba),
  });
  last = performance.now();
  tick();
}
function tick() {
  if (disposed || !visible || !playing || !data) return;
  const now = performance.now();
  const elapsed = Math.min((now - last) / 1000, 0.06);
  last = now;
  if (playing) {
    accumulator += elapsed * params.speed;
    const dt = model.opt.timestep;
    let steps = 0;
    while (accumulator >= dt && steps < 100) {
      apply();
      viewerForce?.apply();
      mj.mj_step(model, data);
      accumulator -= dt;
      steps++;
    }
    mj.mj_forward(model, data);
    send();
  }
  timer = setTimeout(tick, 16);
}
self.onmessage = async (event) => {
  try {
    const message = event.data;
    if (message.type === 'load') {
      await load(message.id in examples ? message.id : 'pendulum');
      return;
    }
    if (message.type === 'display') {
      viewerForce?.setDisplay(message.flags);
      if (viewerForce) {
        send();
      }
      return;
    }
    if (message.type === 'perturb') {
      if (viewerForce?.update(message.request, !playing)) {
        mj.mj_forward(model, data);
        send();
      }
      return;
    }
    if (message.type === 'params') {
      params = { ...params, ...message.params };
      apply();
      if (!playing && model && data) {
        mj.mj_forward(model, data);
        send();
      }
    }
    if (message.type === 'visible') {
      visible = Boolean(message.value);
      clearTimeout(timer);
      if (!visible) viewerForce?.clear();
      last = performance.now();
      accumulator = 0;
      tick();
    }
    if (message.type === 'play') {
      playing = message.value;
      if (!playing) viewerForce?.clear();
      last = performance.now();
      accumulator = 0;
      clearTimeout(timer);
      tick();
    }
    if (message.type === 'reset') reset();
    if (message.type === 'step' && !playing) {
      apply();
      viewerForce?.apply();
      mj.mj_step(model, data);
      mj.mj_forward(model, data);
      send();
    }
    if (message.type === 'dispose') {
      viewerForce?.dispose();
      disposed = true;
      clearTimeout(timer);
      data?.delete();
      model?.delete();
      self.close();
    }
  } catch (error) {
    self.postMessage({
      type: 'error',
      message: error instanceof Error ? error.message : String(error),
    });
  }
};
