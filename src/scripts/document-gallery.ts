import { createDocumentField } from './document-field';
import { dampDocumentScroll } from '../lib/document-motion.mjs';

/** Native page scrolling drives a reversible, position-based bend field. */
export function createDocumentGallery() {
  const root = document.querySelector<HTMLElement>('[data-document-gallery]');
  if (!root) return;
  const runway = root.querySelector<HTMLElement>('[data-document-runway]')!;
  const viewport = root.querySelector<HTMLElement>('[data-document-viewport]')!;
  const canvas = root.querySelector<HTMLCanvasElement>(
    '[data-document-field]',
  )!;
  const entries = [
    ...root.querySelectorAll<HTMLElement>('[data-document-entry]'),
  ];
  const links = [
    ...root.querySelectorAll<HTMLAnchorElement>('[data-document-link]'),
  ];
  const buttons = [
    ...root.querySelectorAll<HTMLButtonElement>('[data-document-filter]'),
  ];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const events = new AbortController();
  const { signal } = events;
  let field: Awaited<ReturnType<typeof createDocumentField>> | null = null;
  let active = entries.map((_, index) => index);
  let ready = false,
    disposed = false,
    inView = false,
    building = false;
  let raf = 0,
    previous = 0,
    time = 0,
    current = 0,
    target = 0;
  let top = 0,
    travel = 0,
    rowPitch = 0,
    startY = 0,
    columns: 1 | 2 = 2;
  let hover = -1;
  let fieldInset = 0;
  let viewportWidth = 0,
    viewportHeight = 0;

  const stop = () => {
    cancelAnimationFrame(raf);
    raf = 0;
    previous = 0;
  };
  const readScroll = () => {
    target = Math.max(0, Math.min(travel, scrollY - top));
  };
  const paint = () => {
    if (!field || !ready) return;
    for (const region of field.render(current, time, hover)) {
      const entry = entries[region.index];
      const onstage =
        region.opacity > 0.08 && region.width > 2 && region.height > 2;
      entry.toggleAttribute('data-onstage', onstage);
      if (onstage) {
        entry.style.left = `${region.left}px`;
        entry.style.top = `${region.top + fieldInset}px`;
        entry.style.width = `${region.width}px`;
        entry.style.height = `${region.height}px`;
        links[region.index].style.clipPath = region.polygon;
      } else {
        // Keep every native link in keyboard order, even when its mesh is offscreen.
        entry.style.top = '-10000px';
      }
    }
  };
  const tick = (now: number) => {
    raf = 0;
    if (!ready || reduce.matches || document.hidden || !inView) return;
    const dt = previous ? Math.min((now - previous) / 1000, 0.05) : 1 / 60;
    previous = now;
    time += dt;
    // Same .05 follow at 60 Hz, normalized for high/low-refresh displays.
    current = dampDocumentScroll(current, target, dt);
    if (Math.abs(target - current) < 0.01) current = target;
    paint();
    raf = requestAnimationFrame(tick);
  };
  const resume = () => {
    if (ready && inView && !document.hidden && !reduce.matches && !raf)
      raf = requestAnimationFrame(tick);
  };
  const measure = () => {
    if (!ready || !field) return;
    const width = viewport.clientWidth;
    const height = viewport.clientHeight;
    if (!width || !height) return;
    viewportWidth = width;
    viewportHeight = height;
    columns = width >= 1024 ? 2 : 1;
    const gap = width >= 1366 ? 40 : 30;
    const cardWidth =
      columns === 2
        ? Math.min(660, (width * 0.82 - gap) / 2)
        : Math.min(640, width - (width < 650 ? 48 : 100));
    const captionHeight = columns === 2 ? 156 : 174;
    const rowGap = columns === 2 ? 30 : 26;
    const toolbar = root.querySelector<HTMLElement>('.document-toolbar')!;
    startY = Math.max(
      height * 0.33,
      toolbar.offsetTop + toolbar.offsetHeight + 38,
    );
    // The site's navigation is taller than the reference's. Frame the same
    // curve below the controls so folded sheets never obscure the filters.
    fieldInset =
      columns === 1
        ? toolbar.offsetTop + toolbar.offsetHeight + 18
        : Math.max(
            80,
            toolbar.offsetTop + toolbar.offsetHeight - height * 0.19 + 22,
          );
    root.style.setProperty('--document-field-inset', `${fieldInset}px`);
    rowPitch = (cardWidth * 430) / 820 + captionHeight + rowGap;
    const cardHeight = (cardWidth * 430) / 820 + captionHeight;
    const lastRowClearance = Math.max(
      height * 0.15,
      startY + cardHeight - height + 40,
    );
    travel =
      Math.max(0, Math.ceil(active.length / columns) - 1) * rowPitch +
      lastRowClearance;
    root.style.setProperty('--document-height', `${height}px`);
    root.style.setProperty('--document-travel', `${travel}px`);
    top = runway.getBoundingClientRect().top + scrollY;
    field.layout(
      {
        width,
        height: height - fieldInset,
        cardWidth,
        gap,
        rowGap,
        startY: startY - fieldInset,
        captionHeight,
        columns,
      },
      active,
    );
    readScroll();
    current = target;
    paint();
    resume();
  };
  const fallback = () => {
    ready = false;
    stop();
    delete root.dataset.motion;
    root.style.removeProperty('--document-height');
    root.style.removeProperty('--document-travel');
    root.style.removeProperty('--document-field-inset');
    entries.forEach((entry, i) => {
      entry.removeAttribute('style');
      entry.removeAttribute('data-onstage');
      links[i].style.removeProperty('clip-path');
    });
  };
  const enhance = async () => {
    if (building || disposed || reduce.matches || ready) return;
    building = true;
    try {
      if (!field) field = await createDocumentField(canvas, links, root);
      if (disposed) {
        field.dispose();
        field = null;
        return;
      }
      if (reduce.matches) return;
      root.dataset.motion = 'ready';
      ready = true;
      measure();
    } catch (error) {
      fallback();
      field?.dispose();
      field = null;
      console.warn('Document gallery is using its HTML layout.', error);
    } finally {
      building = false;
    }
  };

  const intersection = new IntersectionObserver(
    ([entry]) => {
      inView = entry.isIntersecting;
      if (inView) {
        readScroll();
        resume();
      } else stop();
    },
    { rootMargin: '120px' },
  );
  intersection.observe(viewport);
  const resize = new ResizeObserver(() => {
    if (
      viewport.clientWidth !== viewportWidth ||
      viewport.clientHeight !== viewportHeight
    )
      measure();
  });
  resize.observe(viewport);
  window.addEventListener('resize', measure, { passive: true, signal });
  window.addEventListener(
    'scroll',
    () => {
      readScroll();
      resume();
    },
    { passive: true, signal },
  );
  document.addEventListener(
    'visibilitychange',
    () => {
      if (document.hidden) stop();
      else resume();
    },
    { signal },
  );
  reduce.addEventListener(
    'change',
    () => {
      if (reduce.matches) fallback();
      else void enhance();
    },
    { signal },
  );
  const theme = new MutationObserver(() => {
    field?.refreshColors();
    paint();
  });
  theme.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });

  buttons.forEach((button) =>
    button.addEventListener(
      'click',
      () => {
        if (button.getAttribute('aria-pressed') === 'true') return;
        const wasPinned = ready && scrollY >= top - 1;
        const group = button.dataset.documentFilter;
        active = [];
        entries.forEach((entry, index) => {
          entry.hidden = group !== 'all' && entry.dataset.group !== group;
          if (!entry.hidden) active.push(index);
        });
        buttons.forEach((item) =>
          item.setAttribute('aria-pressed', String(item === button)),
        );
        root.querySelector('[data-document-count]')!.textContent =
          `${String(active.length).padStart(2, '0')} 篇文档`;
        hover = -1;
        current = target = 0;
        if (ready) {
          // Recompute row positions and scroll range together; no stale hidden meshes.
          measure();
          if (wasPinned) window.scrollTo({ top, behavior: 'instant' });
          readScroll();
          current = target;
          paint();
        }
      },
      { signal },
    ),
  );
  links.forEach((link, index) => {
    link.addEventListener(
      'pointerenter',
      () => {
        if (fine.matches) hover = index;
      },
      { signal },
    );
    link.addEventListener(
      'pointerleave',
      () => {
        if (hover === index) hover = -1;
      },
      { signal },
    );
    link.addEventListener(
      'focus',
      () => {
        if (!ready || !link.matches(':focus-visible')) return;
        const slot = active.indexOf(index);
        if (slot < 0) return;
        const desired = Math.max(
          0,
          Math.min(
            travel,
            Math.floor(slot / columns) * rowPitch +
              startY -
              viewportHeight * 0.39,
          ),
        );
        window.scrollTo({ top: top + desired, behavior: 'instant' });
        readScroll();
        current = target;
        paint();
      },
      { signal },
    );
  });
  canvas.addEventListener(
    'webglcontextlost',
    (event) => {
      event.preventDefault();
      fallback();
    },
    { signal },
  );
  canvas.addEventListener(
    'webglcontextrestored',
    () => {
      field?.dispose();
      field = null;
      void enhance();
    },
    { signal },
  );
  window.addEventListener(
    'pageshow',
    () => {
      measure();
      resume();
    },
    { signal },
  );
  window.addEventListener(
    'pagehide',
    (event) => {
      stop();
      if (!event.persisted) {
        disposed = true;
        events.abort();
        intersection.disconnect();
        resize.disconnect();
        theme.disconnect();
        field?.dispose();
        field = null;
      }
    },
    { signal },
  );
  void enhance();
}
