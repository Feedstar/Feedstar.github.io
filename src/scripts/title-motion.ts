import { titleSpring } from '../lib/motion.mjs';

export function createTitleMotion() {
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const controller = new AbortController();
  const { signal } = controller;
  type Glyph = {
    element: HTMLElement;
    x: number;
    y: number;
    size: number;
    value: number;
    velocity: number;
    target: number;
  };
  const groups = new Map<HTMLElement, Glyph[]>();
  const active = new Set<Glyph>();
  let frame = 0,
    previousTime = 0;
  const tick = (now: number) => {
    const dt = Math.min((now - (previousTime || now - 16.67)) / 1000, 0.05);
    previousTime = now;
    for (const glyph of active) {
      const next = titleSpring(glyph.value, glyph.velocity, glyph.target, dt);
      glyph.value = next.value;
      glyph.velocity = next.velocity;
      glyph.element.style.transform = `translate3d(0,${glyph.value}px,0) rotate(${glyph.value * 0.075}deg)`;
      if (
        Math.abs(glyph.value - glyph.target) < 0.015 &&
        Math.abs(glyph.velocity) < 0.04
      ) {
        glyph.value = glyph.target;
        glyph.velocity = 0;
        glyph.element.style.transform = glyph.target
          ? `translateY(${glyph.target}px)`
          : '';
        active.delete(glyph);
      }
    }
    frame = active.size ? requestAnimationFrame(tick) : 0;
    if (!frame) previousTime = 0;
  };
  const wake = () => {
    if (!frame && active.size) frame = requestAnimationFrame(tick);
  };
  const reset = (immediate = false) => {
    groups.forEach((glyphs) =>
      glyphs.forEach((glyph) => {
        glyph.target = 0;
        if (immediate) {
          glyph.value = glyph.velocity = 0;
          glyph.element.style.transform = '';
          active.delete(glyph);
        } else if (glyph.value || glyph.velocity) active.add(glyph);
      }),
    );
    wake();
  };
  const selector =
    '.hero-english, .hero-chinese, .field-title h2, .notes-heading h2, .arrival h2, .page-intro h1, .article-header h1, .archive-title, .section-intro h1';
  for (const title of document.querySelectorAll<HTMLElement>(selector)) {
    const accessibleText = title.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    const walker = document.createTreeWalker(title, NodeFilter.SHOW_TEXT);
    const nodes: Text[] = [];
    while (walker.nextNode()) nodes.push(walker.currentNode as Text);
    for (const node of nodes) {
      if (!node.textContent?.trim()) continue;
      const fragment = document.createDocumentFragment();
      for (const word of node.textContent.split(/(\s+)/)) {
        if (!word || /^\s+$/.test(word)) {
          fragment.append(word);
          continue;
        }
        // Keep Latin words intact while Chinese remains free to wrap by character.
        const wordHost = /^[\x21-\x7e]+$/.test(word)
          ? document.createElement('span')
          : fragment;
        if (wordHost instanceof HTMLElement) wordHost.className = 'motion-word';
        for (const char of Array.from(word)) {
          const glyph = document.createElement('span');
          glyph.className = 'motion-glyph';
          glyph.setAttribute('aria-hidden', 'true');
          glyph.textContent = char;
          wordHost.append(glyph);
        }
        if (wordHost !== fragment) fragment.append(wordHost);
      }
      node.replaceWith(fragment);
    }
    const label = document.createElement('span');
    label.className = 'sr-only';
    label.textContent = accessibleText;
    title.append(label);
    const glyphs = Array.from(
      title.querySelectorAll<HTMLElement>('.motion-glyph'),
      (element) => ({
        element,
        x: 0,
        y: 0,
        size: 0,
        value: 0,
        velocity: 0,
        target: 0,
      }),
    );
    groups.set(title, glyphs);
    const measure = () =>
      glyphs.forEach((g) => {
        const rect = g.element.getBoundingClientRect();
        g.x = rect.left + rect.width / 2;
        g.y = rect.top + rect.height / 2 - g.value;
        g.size = parseFloat(getComputedStyle(g.element).fontSize);
      });
    title.addEventListener('pointerenter', measure, { signal });
    title.addEventListener(
      'pointermove',
      (event) => {
        if (!fine.matches || reduced.matches || event.pointerType === 'touch')
          return;
        glyphs.forEach((g) => {
          const radius = Math.max(65, g.size * 0.95);
          const distance = Math.hypot(
            event.clientX - g.x,
            (event.clientY - g.y) * 0.6,
          );
          const influence = Math.max(0, 1 - distance / radius);
          g.target = -Math.min(16, g.size * 0.15) * influence * influence;
          if (g.target || g.value || g.velocity) active.add(g);
        });
        wake();
      },
      { signal, passive: true },
    );
    title.addEventListener(
      'pointerleave',
      () => {
        glyphs.forEach((g) => {
          g.target = 0;
          if (g.value || g.velocity) active.add(g);
        });
        wake();
      },
      { signal },
    );
  }
  window.addEventListener('scroll', () => reset(), { signal, passive: true });
  window.addEventListener('blur', () => reset(true), { signal });
  document.addEventListener('visibilitychange', () => reset(true), { signal });
  reduced.addEventListener('change', () => reset(true), { signal });
  fine.addEventListener('change', () => reset(true), { signal });
  window.addEventListener(
    'pagehide',
    (event) => {
      reset(true);
      cancelAnimationFrame(frame);
      frame = previousTime = 0;
      if (!event.persisted) controller.abort();
    },
    { signal },
  );
}
