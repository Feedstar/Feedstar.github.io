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
  const loader = {
      hidden: true,
      contains: () => true,
      style: { setProperty() {} },
    },
    status = {},
    font = {},
    button = { disabled: true },
    label = {},
    count = {
      value: 0,
      setAttribute(name, value) {
        if (name === 'aria-valuenow') this.value = Number(value);
      },
    };
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
        '[data-boot-progress]': count,
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
    cancelAnimationFrame: clearTimeout,
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
    count,
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
  f.advance(17);
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
  f.advance(17);
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
  f.advance(1000);
  assert.equal(f.root.dataset.boot, 'awaiting');
  f.advance(60000);
  assert.equal(f.root.dataset.boot, 'awaiting');
}
{
  const f = fixture();
  f.paint();
  f.advance(19000);
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
  f.advance(17);
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
  f.advance(3016);
  f.boot.enter();
  f.advance(520);
  assert.equal(f.root.dataset.boot, 'done');
}
// Fast caches still animate the entire range; 100 and the enabled entry are atomic.
{
  const f = fixture();
  f.paint();
  f.boot.progress(100);
  f.boot.finish();
  const readings = [];
  for (let elapsed = 16; elapsed <= 2992; elapsed += 16) {
    f.advance(16);
    readings.push(f.count.value);
    assert.ok(f.count.value < 100);
    assert.equal(f.button.disabled, true);
  }
  assert.ok(
    new Set(readings).size > 85,
    'Progress must continuously traverse the opening',
  );
  assert.ok(
    readings[46] >= 23 && readings[46] <= 26,
    'At .75s the animation is about one-quarter complete',
  );
  assert.ok(
    readings[93] >= 48 && readings[93] <= 51,
    'At 1.5s it is about halfway',
  );
  assert.ok(
    readings[140] >= 73 && readings[140] <= 76,
    'At 2.25s it is about three-quarters complete',
  );
  f.advance(16);
  assert.equal(f.count.value, 100);
  assert.equal(f.button.disabled, false);
}
// The visual clock never fabricates completion while assets or first frames are pending.
{
  const f = fixture();
  f.paint();
  f.boot.progress(25);
  f.advance(4000);
  assert.equal(f.count.value, 25);
  assert.equal(f.button.disabled, true);
  f.boot.progress(100);
  f.advance(1000);
  assert.equal(f.count.value, 99);
  assert.equal(f.button.disabled, true);
  f.boot.finish();
  f.advance(16);
  assert.equal(f.count.value, 100);
  assert.equal(f.button.disabled, false);
}
// Late batches are interpolated instead of snapping the number and ring.
{
  const f = fixture();
  f.paint();
  f.boot.progress(10);
  f.advance(2000);
  assert.equal(f.count.value, 10);
  f.boot.progress(90);
  f.advance(16);
  assert.ok(f.count.value > 10 && f.count.value < 20);
  f.boot.finish();
  f.advance(2000);
  assert.equal(f.count.value, 100);
  assert.equal(f.button.disabled, false);
}
console.log(
  'PASS: continuous 3-second progress, simultaneous 100% and entry, real-resource ceiling + manual entry; uninterrupted warm navigation; delayed nonblocking hint; timeout, reduced motion, BFCache, unavailable storage and late GPU disposal.',
);
