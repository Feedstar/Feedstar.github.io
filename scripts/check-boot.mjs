import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { loadResource } from '../src/lib/load-resource.mjs';
const source = fs.readFileSync(
  new URL('../src/lib/boot-bootstrap.js', import.meta.url),
  'utf8',
);
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => (resolve = done));
  return { promise, resolve };
};
assert.equal(await loadResource(Promise.resolve('ready')), 'ready');
await assert.rejects(
  loadResource(Promise.reject(new Error('missing'))),
  /missing/,
);
for (const mode of ['timeout', 'abort', 'already-aborted']) {
  const item = deferred(),
    controller = new AbortController();
  let disposed = 0;
  if (mode === 'already-aborted') controller.abort();
  const result = loadResource(item.promise, {
    signal: controller.signal,
    timeout: 10,
    dispose: () => disposed++,
  });
  const rejected = assert.rejects(
    result,
    mode === 'timeout' ? /timed out/ : /cancelled/,
  );
  if (mode === 'abort') controller.abort();
  await rejected;
  item.resolve({ texture: true });
  await Promise.resolve();
  assert.equal(disposed, 1);
}
{
  const controller = new AbortController();
  let disposed = 0;
  await loadResource(Promise.resolve({}), {
    signal: controller.signal,
    dispose: () => disposed++,
  });
  controller.abort();
  assert.equal(disposed, 0, 'Accepted GPU assets remain owned by the scene');
}
function fixture({
  entered = false,
  referrer = '',
  storageBlocked = false,
  reduced = false,
} = {}) {
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
  const loader = { hidden: true, contains: () => true },
    status = {},
    font = {},
    button = { disabled: true },
    label = {};
  const main = {
    inert: true,
    removeAttribute() {},
    setAttribute() {},
    focus() {
      main.focused = true;
    },
  };
  const documentEvents = new EventTarget(),
    events = new EventTarget();
  let markupReady = false;
  const observers = new Set();
  class MutationObserver {
    constructor(callback) {
      this.callback = callback;
    }
    observe() {
      observers.add(this);
    }
    disconnect() {
      observers.delete(this);
    }
  }
  const doc = {
    documentElement: root,
    readyState: 'loading',
    referrer,
    activeElement: {},
    getElementById: () => main,
    addEventListener: documentEvents.addEventListener.bind(documentEvents),
    querySelector: (selector) =>
      ({
        '.site-loader': markupReady ? loader : null,
        '[data-site-fonts]': font,
        '[data-boot-enter]': button,
        '[data-boot-enter-label]': label,
        '[data-boot-status]': status,
      })[selector],
    querySelectorAll: () => [main],
  };
  const storage = new Map(entered ? [['feedstar-entered', '1']] : []);
  const sessionStorage = {
    getItem(key) {
      if (storageBlocked) throw new Error('blocked');
      return storage.get(key) || null;
    },
    setItem(key, value) {
      if (storageBlocked) throw new Error('blocked');
      storage.set(key, value);
    },
  };
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
    sessionStorage,
    location: { origin: 'https://example.com' },
    URL,
    performance: { now: () => time },
    setTimeout,
    clearTimeout,
    requestAnimationFrame: (fn) => setTimeout(() => fn(time), 16),
    matchMedia: () => ({ matches: reduced }),
    Event,
    MutationObserver,
  });
  const advance = (ms) => {
    const target = time + ms;
    for (;;) {
      const next = [...timers]
        .filter(([, timer]) => timer.at <= target)
        .sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      time = next[1].at;
      timers.delete(next[0]);
      next[1].fn();
    }
    time = target;
  };
  const paint = () => {
    markupReady = true;
    for (const observer of observers) observer.callback();
    advance(32);
  };
  const restore = () => {
    const event = new Event('pageshow');
    event.persisted = true;
    events.dispatchEvent(event);
  };
  return {
    root,
    loader,
    status,
    font,
    button,
    label,
    main,
    events,
    window,
    storage,
    advance,
    paint,
    restore,
    boot: window.__feedstarBoot,
  };
}
{
  const f = fixture();
  f.paint();
  f.boot.finish();
  f.boot.enter();
  assert.equal(f.root.dataset.boot, 'loading');
  assert.equal(f.button.disabled, true);
  f.advance(2999);
  assert.equal(
    f.button.disabled,
    true,
    'Cached assets must not bypass the 3-second opening',
  );
  f.advance(1);
  assert.equal(f.root.dataset.boot, 'awaiting');
  assert.equal(f.button.disabled, false);
  f.advance(60000);
  assert.equal(
    f.root.dataset.boot,
    'awaiting',
    'Readiness must never automatically enter',
  );
  assert.equal(
    f.storage.has('feedstar-entered'),
    false,
    'Only a deliberate entry marks the visit',
  );
  f.restore();
  assert.equal(
    f.root.dataset.boot,
    'awaiting',
    'Back/forward must preserve the entry decision',
  );
  f.boot.enter();
  assert.equal(f.root.dataset.boot, 'leaving');
  assert.equal(f.storage.get('feedstar-entered'), '1');
  assert.equal(f.main.inert, false);
  f.advance(520);
  assert.equal(f.root.dataset.boot, 'done');
  assert.equal(f.main.focused, true);
  f.restore();
  assert.equal(f.root.dataset.boot, 'done');
  f.boot.finish('timeout');
  assert.equal(f.root.dataset.bootOutcome, 'ready');
}
{
  const f = fixture();
  f.boot.finish();
  f.advance(5000);
  assert.equal(f.button.disabled, true);
  f.paint();
  f.advance(2999);
  assert.equal(
    f.button.disabled,
    true,
    'Count from the visible opening, not the request',
  );
  f.advance(1);
  assert.equal(f.button.disabled, false);
}
{
  const f = fixture();
  f.paint();
  f.advance(6000);
  assert.equal(
    f.button.disabled,
    true,
    'Three seconds alone is not resource readiness',
  );
  f.boot.finish();
  assert.equal(f.root.dataset.boot, 'awaiting');
  f.advance(60000);
  assert.equal(f.root.dataset.boot, 'awaiting');
}
{
  const f = fixture();
  f.paint();
  f.advance(18000);
  assert.equal(f.root.dataset.bootOutcome, 'timeout');
  assert.equal(f.root.dataset.boot, 'awaiting');
  assert.equal(f.button.disabled, false);
  assert.equal(f.font.disabled, true);
  assert.equal(f.label.textContent, '进入阅读');
  f.boot.finish();
  assert.equal(
    f.root.dataset.bootOutcome,
    'timeout',
    'A late module cannot reverse fallback',
  );
  f.boot.enter();
  f.advance(520);
  assert.equal(f.root.dataset.boot, 'done');
}
{
  const f = fixture({ reduced: true });
  f.paint();
  f.root.dataset.fontState = 'ready';
  f.boot.finish('error');
  f.advance(2999);
  assert.equal(f.button.disabled, true);
  f.advance(1);
  f.boot.enter();
  assert.equal(f.root.dataset.boot, 'done');
  assert.equal(
    f.font.disabled,
    undefined,
    'Keep settled fonts used by prepared canvases',
  );
}
for (const options of [
  { entered: true },
  { referrer: 'https://example.com/docs/', storageBlocked: true },
]) {
  const f = fixture(options);
  assert.equal(f.boot.mode, 'navigation');
  f.advance(200);
  f.boot.finish();
  assert.equal(
    f.root.dataset.boot,
    'done',
    'Warm navigation has no minimum delay or click',
  );
  f.advance(10000);
  assert.equal(f.root.dataset.bootHint, undefined);
}
{
  const f = fixture({ entered: true });
  f.advance(599);
  assert.equal(f.root.dataset.bootHint, undefined);
  f.advance(1);
  assert.equal(f.root.dataset.bootHint, 'true');
  f.boot.finish();
  assert.equal(f.root.dataset.boot, 'done');
  assert.equal(f.root.dataset.bootHint, undefined);
}
{
  const f = fixture({ entered: true });
  f.advance(18000);
  assert.equal(
    f.root.dataset.boot,
    'done',
    'Navigation errors cannot trap the page',
  );
  assert.equal(f.root.dataset.bootOutcome, 'timeout');
}
{
  const f = fixture({
    storageBlocked: true,
    referrer: 'https://elsewhere.example/',
  });
  assert.equal(f.boot.mode, 'intro');
  f.paint();
  f.boot.finish();
  f.advance(3000);
  f.boot.enter();
  f.advance(520);
  assert.equal(f.root.dataset.boot, 'done');
}
console.log(
  'PASS: 3 visible seconds + resource readiness + manual entry; uninterrupted warm navigation; delayed nonblocking hint; timeout, reduced motion, BFCache, unavailable storage and late GPU disposal.',
);
