import { loadResource } from '../lib/load-resource.mjs';
import {
  bootCancelled,
  bootSignal,
  prepareFonts,
  sceneState,
  onBootCancel,
} from './page-resources';
import { crystalCaption } from '../lib/crystal-motion.mjs';
import { createCrystalField } from './crystal-field';

/** Native page scroll, native article links, and a single progressive WebGL scene. */
export function createCrystalJournal() {
  const root = document.querySelector<HTMLElement>('[data-crystal-journal]');
  if (!root) return;
  root.dataset.sceneState = 'waiting';
  const runway = root.querySelector<HTMLElement>('[data-crystal-runway]')!;
  const viewport = root.querySelector<HTMLElement>('[data-crystal-viewport]')!;
  const canvas = root.querySelector<HTMLCanvasElement>(
    '[data-crystal-canvas]',
  )!;
  const entries = [
    ...root.querySelectorAll<HTMLElement>('[data-crystal-entry]'),
  ];
  const links = [
    ...root.querySelectorAll<HTMLAnchorElement>('[data-crystal-link]'),
  ];
  const buttons = [
    ...root.querySelectorAll<HTMLButtonElement>('[data-crystal-filter]'),
  ];
  const tooltip = root.querySelector<HTMLElement>('[data-crystal-tooltip]')!;
  const tooltipMeta = root.querySelector<HTMLElement>(
    '[data-crystal-tooltip-meta]',
  )!;
  const tooltipTitle = root.querySelector<HTMLElement>(
    '[data-crystal-tooltip-title]',
  )!;
  const tooltipDescription = root.querySelector<HTMLElement>(
    '[data-crystal-tooltip-description]',
  )!;
  const cursor = root.querySelector<HTMLElement>('[data-crystal-cursor]')!;
  const progress = root.querySelector<HTMLElement>('[data-crystal-progress]')!;
  const position = root.querySelector<HTMLElement>('[data-crystal-position]')!;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const events = new AbortController();
  const { signal } = events;
  let field: Awaited<ReturnType<typeof createCrystalField>> | null = null;
  let active = entries.map((_, index) => index);
  let ready = false,
    building = false,
    disposed = false,
    inView = false,
    contextLost = false,
    loadFailed = false;
  let raf = 0,
    previous = 0,
    time = 0,
    current = 0,
    target = 0;
  let top = 0,
    travel = 0,
    step = 1,
    width = 0,
    height = 0,
    cardSize = 0,
    captionSafeTop = 0;
  let hovered = -1,
    focused = -1,
    tooltipIndex = -1;
  let pointer = { x: 0, y: 0, active: false };
  let clientX = 0,
    clientY = 0;
  let cursorX = 0,
    cursorY = 0;
  const stop = () => {
    cancelAnimationFrame(raf);
    raf = 0;
    previous = 0;
  };
  const readScroll = () => {
    target = Math.max(0, Math.min(travel, scrollY - top));
  };
  const hidePointer = () => {
    pointer.active = false;
    viewport.removeAttribute('data-pointer-inside');
    cursor.removeAttribute('data-visible');
  };
  const syncPointer = () => {
    if (!pointer.active) return;
    const hit = document.elementFromPoint(clientX, clientY);
    if (!hit || !viewport.contains(hit) || hit.closest('.crystal-toolbar')) {
      hidePointer();
      return;
    }
    const rect = viewport.getBoundingClientRect();
    pointer.x = clientX - rect.left;
    pointer.y = clientY - rect.top;
  };
  const paint = (dt = 1 / 60) => {
    if (!field || !ready) return;
    const result = field.render(current, time, pointer, focused);
    hovered = result.hoverIndex;
    for (const region of result.regions) {
      const entry = entries[region.index];
      const onstage =
        region.opacity > 0.04 && region.width > 4 && region.height > 4;
      entry.toggleAttribute('data-onstage', onstage);
      if (onstage) {
        entry.style.left = `${region.left}px`;
        entry.style.top = `${region.top}px`;
        entry.style.width = `${region.width}px`;
        entry.style.height = `${region.height}px`;
        links[region.index].style.clipPath = region.polygon;
        const caption = crystalCaption(
          region.centerX,
          region.centerY,
          cardSize,
          width,
          height,
          captionSafeTop,
        );
        entry.style.setProperty(
          '--caption-x',
          `${caption.left - region.left}px`,
        );
        entry.style.setProperty('--caption-y', `${caption.top - region.top}px`);
        entry.style.setProperty('--caption-width', `${caption.width}px`);
        entry.style.setProperty('--caption-opacity', String(caption.opacity));
        entry.toggleAttribute('data-caption-visible', caption.opacity > 0.05);
      } else entry.style.top = '-10000px';
    }
    const index = focused >= 0 ? focused : hovered;
    const showTooltip = fine.matches && pointer.active && index >= 0;
    if (index >= 0 && index !== tooltipIndex) {
      tooltipIndex = index;
      tooltipMeta.textContent = `${links[index].dataset.number} / ${links[index].querySelector('.crystal-english')?.textContent || ''}`;
      tooltipTitle.textContent =
        links[index].querySelector('h2')?.textContent || '';
      tooltipDescription.textContent =
        links[index].querySelector('p')?.textContent || '';
    }
    tooltip.toggleAttribute('data-visible', showTooltip);
    cursor.toggleAttribute('data-hover', hovered >= 0);
    cursor.querySelector('span')!.textContent = hovered >= 0 ? '↗' : '✧';
    if (pointer.active) {
      const follow = 1 - Math.exp(-dt * 18);
      cursorX += (pointer.x - cursorX) * follow;
      cursorY += (pointer.y - cursorY) * follow;
      cursor.style.left = `${cursorX}px`;
      cursor.style.top = `${cursorY}px`;
      const rightSide = cursorX > width * 0.52;
      tooltip.style.left = rightSide
        ? 'auto'
        : `${Math.min(width - 260, cursorX + 48)}px`;
      tooltip.style.right = rightSide
        ? `${Math.max(24, width - cursorX + 48)}px`
        : 'auto';
      tooltip.style.textAlign = rightSide ? 'right' : 'left';
      tooltip.style.top = `${Math.max(190, Math.min(height - tooltip.offsetHeight - 40, cursorY - 38))}px`;
    }
    progress.style.transform = `scaleX(${travel ? current / travel : 1})`;
    position.textContent = String(
      Math.min(active.length, Math.max(1, Math.round(current / step) + 1)),
    ).padStart(2, '0');
  };
  const tick = (now: number) => {
    raf = 0;
    if (!ready || reduce.matches || document.hidden || !inView) return;
    const dt = previous ? Math.min((now - previous) / 1000, 0.05) : 1 / 60;
    previous = now;
    time += dt;
    current += (target - current) * (1 - Math.exp(-dt * 4.5));
    if (Math.abs(current - target) < 0.01) current = target;
    paint(dt);
    raf = requestAnimationFrame(tick);
  };
  const resume = () => {
    if (ready && inView && !document.hidden && !reduce.matches && !raf)
      raf = requestAnimationFrame(tick);
  };
  const measure = () => {
    if (!field || !ready) return;
    width = viewport.clientWidth;
    height = viewport.clientHeight;
    if (!width || !height) return;
    const columns: 1 | 2 = width >= 768 ? 2 : 1;
    cardSize =
      columns === 2
        ? Math.max(240, Math.min(600, width * 0.38, height - 240))
        : Math.min(430, width * 0.78, height - 240);
    const toolbar = root.querySelector<HTMLElement>('.crystal-toolbar')!;
    captionSafeTop = toolbar.offsetTop + toolbar.offsetHeight + 18;
    const rowGap = columns === 2 ? -cardSize * 0.38 : 100;
    const startY = Math.max(height * 0.58, 195 + cardSize * 0.5);
    step = cardSize + rowGap;
    travel = Math.max(0, active.length - 1) * step;
    root.style.setProperty('--crystal-height', `${height}px`);
    root.style.setProperty('--crystal-travel', `${travel}px`);
    top = runway.getBoundingClientRect().top + scrollY;
    field.layout(
      { width, height, cardSize, gap: 32, rowGap, startY, columns },
      active,
    );
    readScroll();
    current = target;
    paint();
    resume();
  };
  const fallback = (failed = false) => {
    loadFailed ||= failed;
    viewport.setAttribute('aria-busy', 'false');
    sceneState(root, 'fallback');
    ready = false;
    stop();
    hidePointer();
    root.dataset.sceneState = 'static';
    delete root.dataset.motion;
    root.style.removeProperty('--crystal-height');
    root.style.removeProperty('--crystal-travel');
    tooltip.removeAttribute('data-visible');
    entries.forEach((entry, index) => {
      entry.removeAttribute('style');
      entry.removeAttribute('data-onstage');
      entry.removeAttribute('data-caption-visible');
      links[index].style.removeProperty('clip-path');
    });
  };
  onBootCancel(() => {
    fallback(true);
    field?.dispose();
    field = null;
  });
  const enhance = async () => {
    if (bootCancelled()) {
      fallback();
      return;
    }
    if (reduce.matches) {
      fallback();
      return;
    }
    if (
      building ||
      ready ||
      disposed ||
      contextLost ||
      loadFailed ||
      reduce.matches
    )
      return;
    building = true;
    root.dataset.sceneState = 'loading';
    viewport.setAttribute('aria-busy', 'true');
    try {
      await prepareFonts();
      if (bootCancelled()) return;
      if (!field) field = await createCrystalField(canvas, links, root);
      if (disposed || bootCancelled()) {
        field.dispose();
        field = null;
        return;
      }
      if (reduce.matches || contextLost) return;
      root.dataset.motion = 'ready';
      ready = true;
      measure();
      // The canvas stays hidden while all passes draw their first complete frame.
      await loadResource(
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
        { signal: bootSignal },
      );
      if (disposed || bootCancelled() || reduce.matches || contextLost) return;
      viewport.setAttribute('aria-busy', 'false');
      sceneState(root, 'ready');
      root.dataset.sceneState = 'ready';
    } catch (error) {
      fallback(true);
      field?.dispose();
      field = null;
      console.warn(
        'Crystal journal is using its accessible HTML layout.',
        error,
      );
    } finally {
      building = false;
    }
  };
  const intersection = new IntersectionObserver(
    ([entry]) => {
      inView = entry.isIntersecting;
      if (inView) {
        readScroll();
        if (!ready) void enhance();
        else resume();
      } else {
        hidePointer();
        stop();
      }
    },
    { rootMargin: '300px' },
  );
  intersection.observe(viewport);
  void enhance();
  const resize = new ResizeObserver(() => {
    if (width !== viewport.clientWidth || height !== viewport.clientHeight)
      measure();
  });
  resize.observe(viewport);
  window.addEventListener('resize', measure, { passive: true, signal });
  window.addEventListener(
    'scroll',
    () => {
      readScroll();
      syncPointer();
      resume();
    },
    { passive: true, signal },
  );
  viewport.addEventListener(
    'pointermove',
    (event) => {
      if (
        !fine.matches ||
        event.pointerType === 'touch' ||
        !ready ||
        (event.target as Element).closest('.crystal-toolbar')
      ) {
        hidePointer();
        return;
      }
      const rect = viewport.getBoundingClientRect();
      const wasActive = pointer.active;
      clientX = event.clientX;
      clientY = event.clientY;
      pointer = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
        active: true,
      };
      if (!wasActive) {
        cursorX = pointer.x;
        cursorY = pointer.y;
      }
      focused = -1;
      viewport.setAttribute('data-pointer-inside', '');
      cursor.setAttribute('data-visible', '');
      resume();
    },
    { passive: true, signal },
  );
  viewport.addEventListener('pointerleave', hidePointer, { signal });
  window.addEventListener('blur', hidePointer, { signal });
  fine.addEventListener('change', hidePointer, { signal });
  document.addEventListener(
    'visibilitychange',
    () => {
      if (document.hidden) {
        hidePointer();
        stop();
      } else resume();
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
        active = [];
        entries.forEach((entry, index) => {
          entry.hidden =
            button.dataset.crystalFilter !== 'all' &&
            entry.dataset.group !== button.dataset.crystalFilter;
          if (!entry.hidden) active.push(index);
        });
        buttons.forEach((item) =>
          item.setAttribute('aria-pressed', String(item === button)),
        );
        root.querySelector('[data-crystal-count]')!.textContent =
          `${String(active.length).padStart(2, '0')} 篇手记`;
        root.querySelector('.crystal-progress > span:last-child')!.textContent =
          String(active.length).padStart(2, '0');
        focused = hovered = -1;
        tooltip.removeAttribute('data-visible');
        hidePointer();
        if (ready) {
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
      'focus',
      () => {
        if (!ready || !link.matches(':focus-visible')) return;
        const slot = active.indexOf(index);
        if (slot < 0) return;
        focused = index;
        window.scrollTo({
          top: top + Math.min(travel, slot * step),
          behavior: 'instant',
        });
        readScroll();
        current = target;
        paint();
        resume();
      },
      { signal },
    );
    link.addEventListener(
      'blur',
      () => {
        if (focused === index) focused = -1;
      },
      { signal },
    );
    // Convex HTML hotspots retain native new-tab/modifier behavior. The exact
    // mesh raycast drives hover; keyboard activation never depends on a pointer.
  });
  canvas.addEventListener(
    'webglcontextlost',
    (event) => {
      event.preventDefault();
      contextLost = true;
      fallback();
    },
    { signal },
  );
  canvas.addEventListener(
    'webglcontextrestored',
    () => {
      contextLost = false;
      loadFailed = false;
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
}
