import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { setImmediate } from 'node:timers/promises';
import { stripTypeScriptTypes } from 'node:module';
import {
  createDocumentTexture,
  resizeDocumentTexture,
} from '../src/lib/document-texture.ts';

// A resize must allocate new immutable storage; a redraw must reuse it.
const canvas = { width: 300, height: 150 };
const original = createDocumentTexture(canvas);
let releases = 0;
original.addEventListener('dispose', () => releases++);
assert.equal(resizeDocumentTexture(original, 300, 150), original);
assert.equal(releases, 0);
const resized = resizeDocumentTexture(original, 1320, 692);
assert.notEqual(resized, original);
assert.equal(releases, 1);
assert.equal(resized.image, canvas);
assert.equal(canvas.width, 1320);
assert.equal(canvas.height, 692);
assert.equal(resized.colorSpace, original.colorSpace);
assert.equal(resized.generateMipmaps, false);
assert.equal(resizeDocumentTexture(resized, 1320, 692), resized);
resized.dispose();

// Exercise the real gallery controller with deterministic DOM/renderer failures.
const source = stripTypeScriptTypes(
  fs.readFileSync(
    new URL('../src/scripts/document-gallery.ts', import.meta.url),
    'utf8',
  ),
)
  .replace(/^import .*;\n/gm, '')
  .replace('export function', 'function');

function element(dataset = {}) {
  const item = new EventTarget();
  const styles = new Map(),
    attributes = new Map();
  return Object.assign(item, {
    dataset,
    hidden: false,
    style: {
      setProperty: (key, value) => styles.set(key, value),
      removeProperty: (key) => styles.delete(key),
    },
    setAttribute: (key, value) => attributes.set(key, value),
    getAttribute: (key) => attributes.get(key),
    removeAttribute(key) {
      attributes.delete(key);
      if (key === 'style') {
        styles.clear();
        for (const name of ['left', 'top', 'width', 'height'])
          delete this.style[name];
      }
    },
    toggleAttribute: (key, enabled) =>
      enabled ? attributes.set(key, '') : attributes.delete(key),
    matches: () => true,
    getBoundingClientRect: () => ({ top: 1000 }),
  });
}

async function fixture({ failure, reduced = false } = {}) {
  const root = element(),
    canvas = element(),
    viewport = element();
  Object.assign(viewport, { clientWidth: 1440, clientHeight: 1000 });
  const entries = [element({ group: 'a' }), element({ group: 'b' })];
  const links = entries.map(() => element());
  const buttons = ['all', 'a', 'b'].map((group) => {
    const button = element({ documentFilter: group });
    button.setAttribute('aria-pressed', String(group === 'all'));
    return button;
  });
  const selectors = {
    '[data-document-runway]': element(),
    '[data-document-viewport]': viewport,
    '[data-document-field]': canvas,
    '.document-toolbar': { offsetTop: 200, offsetHeight: 40 },
    '[data-document-count]': {},
  };
  root.querySelector = (selector) => selectors[selector];
  root.querySelectorAll = (selector) =>
    ({
      '[data-document-entry]': entries,
      '[data-document-link]': links,
      '[data-document-filter]': buttons,
    })[selector];
  const state = { failure, disposed: 0, created: 0, raf: new Map(), next: 0 };
  const field = {
    layout() {
      if (state.failure === 'layout') throw Error('resize upload');
    },
    render() {
      if (state.failure === 'render') throw Error('empty drawing buffer');
      return entries.map((_, index) => ({
        index,
        opacity: 1,
        left: 10,
        top: 30,
        width: 400,
        height: 300,
        polygon: 'polygon(0 0, 100% 0, 100% 100%)',
      }));
    },
    refreshColors() {
      if (state.failure === 'theme') throw Error('texture upload');
    },
    dispose() {
      state.disposed++;
    },
  };
  const window = element();
  window.scrollTo = () => {};
  const document = Object.assign(element(), {
    querySelector: () => root,
    documentElement: element(),
    hidden: false,
  });
  const observers = {};
  const observer = (name) =>
    class {
      constructor(callback) {
        observers[name] = callback;
      }
      observe() {}
      disconnect() {}
    };
  const context = {
    document,
    window,
    scrollY: 0,
    AbortController,
    console: { warn() {} },
    bootCancelled: () => false,
    onBootCancel: (callback) => {
      state.cancel = callback;
    },
    sceneState: (root, value) => {
      root.dataset.bootState = value;
    },
    createDocumentField: async () => {
      state.created++;
      return field;
    },
    dampDocumentScroll: (current, target) => target,
    matchMedia: (query) =>
      Object.assign(element(), {
        matches: query.includes('reduced') && reduced,
      }),
    requestAnimationFrame: (callback) => {
      const id = ++state.next;
      state.raf.set(id, callback);
      return id;
    },
    cancelAnimationFrame: (id) => state.raf.delete(id),
    IntersectionObserver: observer('intersection'),
    ResizeObserver: observer('resize'),
    MutationObserver: observer('theme'),
  };
  vm.runInNewContext(`${source}\ncreateDocumentGallery();`, context);
  await setImmediate();
  const restored = () => {
    assert.equal(root.dataset.motion, undefined);
    assert.equal(root.dataset.bootState, 'fallback');
    assert.equal(
      state.raf.size,
      0,
      'A failed renderer must stop scheduling frames',
    );
    entries.forEach((entry) => assert.equal(entry.style.top, undefined));
  };
  return {
    root,
    canvas,
    viewport,
    state,
    entries,
    buttons,
    observers,
    restored,
  };
}

for (const failure of ['layout', 'render']) {
  const f = await fixture({ failure });
  f.restored();
  assert.equal(f.state.disposed, 1);
}
for (const failure of ['render', 'layout', 'theme']) {
  const f = await fixture();
  assert.equal(f.root.dataset.motion, 'ready');
  f.observers.intersection([{ isIntersecting: true }]);
  f.state.failure = failure;
  if (failure === 'render') {
    const [id, tick] = f.state.raf.entries().next().value;
    f.state.raf.delete(id);
    tick(16);
  } else if (failure === 'layout') {
    f.viewport.clientWidth = 1200;
    f.observers.resize();
  } else f.observers.theme();
  f.restored();
  assert.equal(f.state.disposed, 1);
  // Filters must still expose complete native cards after a graphics failure.
  f.buttons[1].dispatchEvent(new Event('click'));
  assert.equal(f.entries[0].hidden, false);
  assert.equal(f.entries[1].hidden, true);
  f.buttons[0].dispatchEvent(new Event('click'));
  assert.ok(f.entries.every((entry) => !entry.hidden));
}
{
  const f = await fixture();
  f.buttons[1].dispatchEvent(new Event('click'));
  f.canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
  f.restored();
  assert.equal(
    f.entries[1].hidden,
    true,
    'Context loss preserves the selected category',
  );
  f.canvas.dispatchEvent(new Event('webglcontextrestored'));
  await setImmediate();
  assert.equal(f.root.dataset.motion, 'ready');
  assert.equal(f.state.created, 2);
}
{
  const f = await fixture({ reduced: true });
  f.restored();
  assert.equal(f.state.created, 0);
}
console.log(
  'Document rendering checks passed (texture resizing, initial/late failure, filters, context recovery, reduced motion).',
);
