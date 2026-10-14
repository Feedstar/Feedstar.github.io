import { createViewerForce, viewerBodies } from '../lib/viewer-physics.mjs';
let viewerForce: ReturnType<typeof createViewerForce> | undefined;
import loadMujoco from '@mujoco/mujoco';
import wasmUrl from '@mujoco/mujoco/mujoco.wasm?url';
import { createStudy } from '../lib/study-runtime.mjs';
import { studyXML, type StudyId } from '../lib/study-assets';
import { armSensors } from '../lib/arm-runtime.mjs';
let runtime: any,
  mj: any,
  loading = false;
let playing = true,
  visible = true,
  speed = 1,
  epoch = 0;
let last = 0,
  accumulator = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
function sendState(forced = false) {
  const { data } = runtime;
  const observation = runtime.observe();
  const state = {
    type: 'state',
    viewer: viewerForce?.read(),
    forced,
    epoch,
    time: data.time,
    realtime: 1,
    contacts: data.ncon,
    qpos: new Float64Array(data.qpos),
    qvel: new Float64Array(data.qvel),
    ctrl: new Float64Array(data.ctrl),
    sensors: new Float64Array(data.sensordata),
    positions: new Float32Array(data.geom_xpos),
    matrices: new Float32Array(data.geom_xmat),
    bodyPositions: new Float64Array(data.xpos),
    bodyQuaternions: new Float64Array(data.xquat),
    observation,
  };
  self.postMessage(state, {
    transfer: Object.values(state)
      .filter(ArrayBuffer.isView)
      .map((v: any) => v.buffer),
  });
}
function schedule() {
  clearTimeout(timer);
  last = performance.now();
  accumulator = 0;
  if (runtime && playing && visible) timer = setTimeout(tick, 0);
}
function tick() {
  if (!runtime || !playing || !visible) return;
  try {
    const now = performance.now(),
      dt = runtime.model.opt.timestep;
    accumulator += Math.min((now - last) / 1000, 0.06) * speed;
    last = now;
    const before = runtime.data.time;
    while (accumulator >= dt) {
      viewerForce?.apply();
      runtime.step();
      accumulator -= dt;
      if (performance.now() - now > 10) {
        accumulator = 0;
        break;
      }
    }
    if (runtime.data.time > before) sendState();
    timer = setTimeout(tick, Math.max(1, 16 - (performance.now() - now)));
  } catch (error) {
    fail(error);
  }
}
function fail(error: unknown) {
  clearTimeout(timer);
  playing = false;
  self.postMessage({
    type: 'error',
    message: error instanceof Error ? error.message : String(error),
  });
}
self.onmessage = async ({ data: message }) => {
  try {
    if (message.type === 'load' && !runtime && !loading) {
      loading = true;
      const kind = message.kind as StudyId;
      if (!Object.hasOwn(studyXML, kind)) throw new Error('实验不存在');
      self.postMessage({ type: 'progress', message: '正在加载 MuJoCo 引擎…' });
      mj = await loadMujoco({
        locateFile: (file: string) => (file.endsWith('.wasm') ? wasmUrl : file),
      });
      runtime = createStudy(mj, kind, studyXML[kind]);
      viewerForce = createViewerForce(mj, runtime.model, runtime.data);
      const m = runtime.model,
        geoms = [];
      for (let id = 0; id < m.ngeom; id++) {
        if (m.geom_group[id] === 3) continue;
        const material = m.geom_matid[id],
          colorId = material < 0 ? id : material;
        geoms.push({
          id,
          body: m.geom_bodyid[id],
          type: m.geom_type[id],
          size: Array.from(m.geom_size.slice(id * 3, id * 3 + 3)),
          color: Array.from(
            (material < 0 ? m.geom_rgba : m.mat_rgba).slice(
              colorId * 4,
              colorId * 4 + 4,
            ),
          ),
          name: mj.mj_id2name(m, 5, id) || '',
        });
      }
      self.postMessage({
        type: 'ready',
        version: mj.mj_versionString(),
        timestep: m.opt.timestep,
        joints: [],
        bodies: viewerBodies(mj, m),
        sensors: armSensors(mj, m),
        geoms,
      });
      sendState(true);
      schedule();
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
        const pose = runtime.syncViewerPose();
        if (pose && message.request?.kind === 'move') {
          epoch++;
          self.postMessage({ type: 'viewer-pose', pose });
        }
        mj.mj_forward(runtime.model, runtime.data);
        sendState(true);
      }
      return;
    }
    if (message.type === 'visible') {
      visible = !!message.value;
      if (!visible) viewerForce?.clear();
      schedule();
      return;
    }
    if (!runtime) return;
    if (message.type === 'controls') {
      viewerForce?.clear();
      runtime.update(message.patch || {}, !!message.restart);
      // Any parameter edit starts a fresh chart/scan, avoiding mixed experiments.
      epoch++;
      if (message.restart) schedule();
    }
    if (message.type === 'reset') {
      viewerForce?.clear();
      runtime.reset();
      epoch++;
      schedule();
    }
    if (message.type === 'play') {
      playing = !!message.value;
      if (!playing) viewerForce?.clear();
      schedule();
    }
    if (message.type === 'speed') {
      speed = [0.1, 0.25, 0.5, 1, 2].includes(message.value)
        ? message.value
        : 1;
      schedule();
    }
    if (message.type === 'step' && !playing) {
      viewerForce?.apply();
      runtime.step();
    }
    if (message.type === 'dispose') {
      viewerForce?.dispose();
      clearTimeout(timer);
      runtime.dispose();
      self.close();
      return;
    }
    sendState(true);
  } catch (error) {
    fail(error);
  }
};
