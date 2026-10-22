import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { stripTypeScriptTypes } from 'node:module';
const source = fs
  .readFileSync(
    new URL('../src/workers/simulation.worker.ts', import.meta.url),
    'utf8',
  )
  .replace(/^import[\s\S]*?;\r?\n/gm, '');
const code = stripTypeScriptTypes(source);
let now = 0,
  serial = 0,
  steps = 0;
const jobs = new Map(),
  messages = [];
const data = {
  time: 0,
  qpos: [0],
  qvel: [0],
  geom_xpos: [],
  geom_xmat: [],
  xpos: [],
  xquat: [],
  ncon: 0,
  delete() {},
};
const model = {
  opt: { timestep: 0.002 },
  dof_damping: [0],
  geom_bodyid: [],
  geom_type: [],
  geom_size: [],
  geom_rgba: [],
  delete() {},
};
const mj = {
  MjModel: { from_xml_string: () => model },
  MjData: function () {
    return data;
  },
  mj_resetDataKeyframe() {
    data.time = 0;
  },
  mj_forward() {},
  mj_versionString: () => 'test',
  mj_step() {
    data.time += 0.002;
    steps++;
  },
};
const self = { postMessage: (message) => messages.push(message), close() {} };
const context = vm.createContext({
  self,
  performance: { now: () => now },
  setTimeout(fn, delay) {
    const id = ++serial;
    jobs.set(id, { fn, at: now + delay });
    return id;
  },
  clearTimeout(id) {
    jobs.delete(id);
  },
  loadMujoco: async () => mj,
  wasmUrl: 'test',
  examples: { pendulum: { xml: '' } },
  simulationParams: { angle: 0.85, damping: 0.1, speed: 1 },
  applyPositionServo() {},
  readPositionServo() {},
  viewerBodies: () => [],
  createViewerForce: () => ({
    read() {},
    clear() {},
    apply() {},
    dispose() {},
  }),
});
vm.runInContext(code, context);
const send = (message) => self.onmessage({ data: message });
const advance = (ms) => {
  const end = now + ms;
  while (true) {
    const next = [...jobs].sort((a, b) => a[1].at - b[1].at)[0];
    if (!next || next[1].at > end) break;
    now = next[1].at;
    jobs.delete(next[0]);
    next[1].fn();
  }
  now = end;
};
// Visibility and playback controls can arrive before asynchronous WASM loading.
await send({ type: 'visible', value: false });
await send({ type: 'play', value: false });
await send({ type: 'params', params: {} });
await send({ type: 'load', id: 'pendulum' });
advance(1000);
assert.equal(steps, 0);
assert.equal(jobs.size, 0);
await send({ type: 'play', value: true });
assert.equal(jobs.size, 0, 'Offscreen play must not wake the worker');
await send({ type: 'visible', value: true });
advance(100);
assert.ok(steps > 0);
assert.equal(jobs.size, 1);
await send({ type: 'visible', value: true });
assert.equal(
  jobs.size,
  1,
  'Repeated notifications cannot create multiple loops',
);
await send({ type: 'visible', value: false });
const paused = steps;
advance(10000);
assert.equal(steps, paused);
assert.equal(jobs.size, 0);
await send({ type: 'visible', value: true });
assert.equal(
  steps,
  paused,
  'Returning after a long pause must not catch up hidden time',
);
advance(32);
assert.ok(steps - paused < 25);
await send({ type: 'play', value: false });
const userPaused = steps;
await send({ type: 'visible', value: false });
await send({ type: 'visible', value: true });
advance(100);
assert.equal(steps, userPaused);
assert.equal(jobs.size, 0);
await send({ type: 'step' });
assert.equal(steps, userPaused + 1);
await send({ type: 'dispose' });
assert.equal(jobs.size, 0);
assert.equal(messages.filter((message) => message.type === 'error').length, 0);
console.log(
  'PASS: basic simulation worker suspends offscreen/background, resumes without time jumps, preserves manual pause and releases its timer.',
);
