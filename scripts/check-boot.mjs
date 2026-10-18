import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { loadResource } from '../src/lib/load-resource.mjs';
const source = fs.readFileSync(
  new URL('../src/lib/boot-bootstrap.js', import.meta.url),
  'utf8',
);
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
};
assert.equal(await loadResource(Promise.resolve('ready')), 'ready');
await assert.rejects(
  loadResource(Promise.reject(new Error('missing'))),
  /missing/,
);
for (const mode of ['timeout', 'abort', 'already-aborted']) {
  const item = deferred(),
    signal = new AbortController();
  let disposed = 0;
  if (mode === 'already-aborted') signal.abort();
  const task = loadResource(item.promise, {
    signal: signal.signal,
    timeout: 10,
    dispose: () => disposed++,
  });
  const rejected = assert.rejects(
    task,
    mode === 'timeout' ? /timed out/ : /cancelled/,
  );
  if (mode === 'abort') signal.abort();
  await rejected;
  item.resolve({ texture: true });
  await Promise.resolve();
  assert.equal(
    disposed,
    1,
    'Late GPU resources must be disposed after ' + mode,
  );
}
{
  const signal = new AbortController();
  let disposed = 0;
  await loadResource(Promise.resolve({}), {
    signal: signal.signal,
    dispose: () => disposed++,
  });
  signal.abort();
  assert.equal(disposed, 0, 'Accepted resources remain owned by the scene');
}
function fixture(reduced = false) {
  const root = {
    dataset: {},
    classList: {
      remove(name) {
        root.removed = name;
      },
    },
    setAttribute(name, value) {
      root[name] = value;
    },
  };
  const loader = { hidden: true, contains: () => true };
  const status = {};
  const font = {};
  const main = {
    inert: true,
    removeAttribute() {},
    setAttribute() {},
    focus() {
      main.focused = true;
    },
  };
  const doc = {
    documentElement: root,
    activeElement: {},
    getElementById: () => main,
    querySelector: (s) =>
      s === '.site-loader' ? loader : s === '[data-site-fonts]' ? font : status,
    querySelectorAll: () => [main],
  };
  const events = new EventTarget();
  let time = 0,
    id = 0;
  const timers = new Map();
  const setTimeout = (fn, delay) => {
    const key = ++id;
    timers.set(key, { fn, at: time + delay });
    return key;
  };
  const clearTimeout = (key) => timers.delete(key);
  const window = {
    setTimeout,
    addEventListener: events.addEventListener.bind(events),
    dispatchEvent: events.dispatchEvent.bind(events),
  };
  vm.runInNewContext(source, {
    document: doc,
    window,
    performance: { now: () => time },
    setTimeout,
    clearTimeout,
    matchMedia: () => ({ matches: reduced }),
    Event,
  });
  function advance(ms) {
    time += ms;
    for (const [key, timer] of [...timers])
      if (timer.at <= time) {
        timers.delete(key);
        timer.fn();
      }
  }
  return { root, loader, main, font, window, advance, events };
}
{
  const f = fixture();
  assert.equal(f.root.dataset.boot, 'loading');
  f.advance(17999);
  assert.equal(f.root.dataset.boot, 'loading');
  f.advance(1);
  assert.equal(f.root.dataset.bootOutcome, 'timeout');
  assert.equal(f.main.inert, false);
  assert.equal(f.font.disabled, true);
  f.advance(520);
  assert.equal(f.root.dataset.boot, 'done');
  assert.equal(f.main.focused, true);
  f.window.__feedstarBoot.release('ready');
  assert.equal(
    f.root.dataset.bootOutcome,
    'timeout',
    'Late module must not reopen loading',
  );
}
{
  const f = fixture();
  let cancelled = 0;
  f.events.addEventListener('feedstar:boot-cancel', () => cancelled++);
  f.window.__feedstarBoot.release('ready');
  f.advance(520);
  f.advance(20000);
  assert.equal(cancelled, 0);
  assert.equal(f.root.dataset.bootOutcome, 'ready');
  assert.equal(f.root.removed, undefined);
}
{
  const f = fixture(true);
  f.window.__feedstarBoot.release('skipped');
  f.advance(0);
  assert.equal(f.root.dataset.boot, 'done');
  assert.equal(f.root.removed, 'js');
}
{
  const f = fixture();
  const e = new Event('pageshow');
  e.persisted = true;
  f.events.dispatchEvent(e);
  assert.equal(f.root.dataset.boot, 'done');
  assert.equal(f.main.inert, false);
  assert.equal(f.loader.hidden, true);
}
console.log(
  'Loader: readiness, errors, timeout, skip, BFCache, reduced motion and late resource disposal passed.',
);

{
  const f = fixture();
  f.root.dataset.fontState = 'ready';
  f.window.__feedstarBoot.release('skipped');
  assert.equal(
    f.font.disabled,
    undefined,
    'Preserve settled fonts used by ready canvas scenes',
  );
}
