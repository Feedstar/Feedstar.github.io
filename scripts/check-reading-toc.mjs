import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { stripTypeScriptTypes } from 'node:module';

const code = stripTypeScriptTypes(
  fs
    .readFileSync(
      new URL('../src/scripts/reading-toc.ts', import.meta.url),
      'utf8',
    )
    .replace('export function', 'function'),
);
function fixture({ reduced = false, compact = false, y = 0, count = 60 } = {}) {
  const events = () => ({
    listeners: new Map(),
    addEventListener(type, fn) {
      const handlers = this.listeners.get(type) || new Set();
      handlers.add(fn);
      this.listeners.set(type, handlers);
    },
    removeEventListener(type, fn) {
      this.listeners.get(type)?.delete(fn);
    },
    emit(type, event = {}) {
      for (const fn of this.listeners.get(type) || [])
        fn({ target: this, ...event });
    },
  });
  const frames = new Map();
  let serial = 0;
  const compactQuery = { ...events(), matches: compact };
  const calls = [];
  const label = {},
    percentage = {},
    meter = { setAttribute() {} },
    fill = { style: {} };
  const offsets = Array.from({ length: count }, (_, i) => i * 52);
  const links = offsets.map((offset, i) => ({
    dataset: { tocTarget: `chapter-${i}` },
    lastElementChild: { textContent: `Chapter ${i}` },
    attributes: i ? {} : { 'aria-current': 'location' },
    setAttribute(name, value) {
      this.attributes[name] = value;
    },
    removeAttribute(name) {
      delete this.attributes[name];
    },
    getBoundingClientRect() {
      const top = 145 + 92 + offset - toc.scrollTop;
      return { top, bottom: top + 50, height: 50 };
    },
    closest: () => links[i],
  }));
  const summary = { getBoundingClientRect: () => ({ bottom: 145 + 92 }) };
  const toc = {
    ...events(),
    open: !compact,
    scrollTop: 0,
    clientHeight: 600,
    scrollHeight: Math.max(600, 92 + count * 52 + 24),
    getBoundingClientRect: () => ({ top: 145, bottom: 745 }),
    scrollTo(options) {
      calls.push(options);
      this.scrollTop = options.top;
    },
    contains: (target) => target === toc || links.includes(target),
    querySelectorAll: () => links,
    querySelector: (selector) =>
      ({
        summary,
        '[data-reading-current]': label,
        '[data-reading-percent]': percentage,
        '[role="progressbar"]': meter,
        '[data-reading-fill]': fill,
      })[selector],
  };
  const prose = {
    getBoundingClientRect: () => ({
      bottom: 1000 + count * 500 - context.scrollY,
    }),
  };
  const article = {
    getBoundingClientRect: () => ({ top: 1000 - context.scrollY }),
    querySelector: () => prose,
  };
  const sections = links.map((_, i) => ({
    getBoundingClientRect: () => ({ top: 1000 + i * 500 - context.scrollY }),
    setAttribute() {},
    focus() {},
  }));
  const document = {
    ...events(),
    fonts: {
      ready: {
        then(fn) {
          fn();
        },
      },
    },
    querySelector: (selector) => (selector === '.reading-toc' ? toc : article),
    getElementById: (id) =>
      id === 'reading-progress' ? fill : sections[Number(id.split('-')[1])],
  };
  const window = events();
  const context = vm.createContext({
    document,
    window,
    scrollY: y,
    innerHeight: 900,
    matchMedia: (query) =>
      query.includes('max-width') ? compactQuery : { matches: reduced },
    requestAnimationFrame(fn) {
      const id = ++serial;
      frames.set(id, fn);
      return id;
    },
    cancelAnimationFrame(id) {
      frames.delete(id);
    },
    ResizeObserver: class {
      observe() {}
      disconnect() {}
    },
  });
  const flush = () => {
    const pending = [...frames.values()];
    frames.clear();
    pending.forEach((fn) => fn());
    assert.equal(frames.size, 0, 'No continuous animation loop is needed');
  };
  const scroll = (nextY) => {
    context.scrollY = nextY;
    window.emit('scroll');
    flush();
  };
  const visible = () => {
    const current = links.find((l) => l.attributes['aria-current']);
    assert.ok(current, 'A current link must exist');
    const rect = current.getBoundingClientRect();
    assert.ok(
      rect.top >= summary.getBoundingClientRect().bottom + 12,
      'Current link stays below the sticky summary',
    );
    assert.ok(
      rect.bottom <= 745 - 12,
      'Current link stays above the panel bottom',
    );
  };
  vm.runInContext(`${code}\ncreateReadingToc();`, context);
  flush();
  return {
    toc,
    calls,
    context,
    window,
    document,
    article,
    links,
    flush,
    scroll,
    visible,
  };
}

const long = fixture();
assert.equal(
  long.calls.length,
  0,
  'Visible entries must not recenter unnecessarily',
);
long.scroll(25000);
long.visible();
assert.equal(
  long.context.scrollY,
  25000,
  'Following the TOC cannot scroll the document',
);
assert.equal(long.calls.at(-1).behavior, 'smooth');
const lowerPosition = long.toc.scrollTop;
long.scroll(6500);
long.visible();
assert.ok(
  long.toc.scrollTop < lowerPosition,
  'Reverse reading follows upwards',
);

long.toc.emit('wheel');
long.toc.scrollTop = 0;
const beforeManual = long.calls.length;
long.scroll(25000);
assert.equal(
  long.calls.length,
  beforeManual,
  'Manual TOC browsing cannot be interrupted',
);
assert.equal(
  long.links[48].attributes['aria-current'],
  'location',
  'Highlight still updates during manual browsing',
);
long.document.emit('wheel', { target: long.article });
long.scroll(25001);
long.visible();

long.toc.emit('keydown');
long.toc.scrollTop = 0;
long.scroll(25500);
assert.equal(
  long.toc.scrollTop,
  0,
  'Keyboard browsing gets the same protection',
);
long.toc.emit('focusout', { relatedTarget: long.article });
long.scroll(25501);
long.visible();

const deep = fixture({ y: 25000, reduced: true });
deep.visible();
assert.equal(
  deep.calls.at(-1).behavior,
  'instant',
  'Reduced motion avoids smooth scrolling',
);
deep.toc.scrollTop = 0;
deep.window.emit('pageshow', { persisted: true });
deep.flush();
deep.visible();
deep.context.innerHeight = 580;
deep.window.emit('resize');
deep.flush();
const current = deep.links.find((l) => l.attributes['aria-current']);
assert.ok(
  current.getBoundingClientRect().bottom <= 580 - 16 - 12,
  'Resizing keeps the item within the viewport',
);

const phone = fixture({ y: 25000, compact: true });
assert.equal(phone.calls.length, 0, 'A collapsed mobile TOC must not scroll');
phone.toc.open = true;
phone.toc.emit('toggle');
phone.flush();
phone.visible();

const short = fixture({ count: 5 });
short.scroll(1500);
assert.equal(short.calls.length, 0, 'Short articles need no panel scrolling');
long.window.emit('pagehide', { persisted: false });
const disposedCalls = long.calls.length;
long.scroll(10000);
assert.equal(long.calls.length, disposedCalls, 'Disposed pages stop reacting');
console.log(
  'PASS: long TOC follow, reverse scroll, deep links, viewport resize, manual and keyboard browsing, compact reopening, reduced motion and cleanup.',
);
