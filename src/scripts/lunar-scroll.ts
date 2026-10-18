import { createLunarSnap } from '../lib/lunar-snap.mjs';

export function createLunarScroll(journey: HTMLElement) {
  const sticky = journey.querySelector<HTMLElement>('.orbit-sticky')!;
  const cue = journey.querySelector<HTMLAnchorElement>('.scroll-cue');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let touching = false;
  const bounds = () => {
    const start = journey.getBoundingClientRect().top + scrollY;
    return { start, end: start + journey.offsetHeight - sticky.clientHeight };
  };
  const snap = createLunarSnap({
    read: () => ({
      ...bounds(),
      y: scrollY,
      enabled:
        !reduced.matches &&
        !touching &&
        !document.hidden &&
        journey.dataset.static !== 'true' &&
        document.documentElement.dataset.boot === 'done',
    }),
    write: (top: number) => window.scrollTo({ top, behavior: 'instant' }),
    requestFrame: (callback: FrameRequestCallback) =>
      requestAnimationFrame(callback),
    cancelFrame: (id: number) => cancelAnimationFrame(id),
    setTimer: (callback: () => void, delay: number) =>
      window.setTimeout(callback, delay),
    clearTimer: (id: number) => clearTimeout(id),
    state: (value: string) => {
      journey.dataset.scrollState = value;
    },
  });
  const wheel = (event: WheelEvent) => {
    if (event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
      snap.interrupt();
      return;
    }
    snap.input(event.deltaY);
  };
  let touchY: number | null = null;
  const touchStart = (event: TouchEvent) => {
    snap.interrupt();
    touching = true;
    touchY = event.touches.length === 1 ? event.touches[0].clientY : null;
  };
  const touchMove = (event: TouchEvent) => {
    if (touchY === null || event.touches.length !== 1) return;
    const next = event.touches[0].clientY;
    snap.input(touchY - next);
    touchY = next;
  };
  const touchEnd = (event: TouchEvent) => {
    touchY = null;
    touching = event.touches.length > 0;
    if (!touching) snap.moved();
  };
  const key = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement;
    if (
      event.key === 'Escape' ||
      target.closest('input, textarea, select, [contenteditable="true"]')
    ) {
      snap.interrupt();
      return;
    }
    if ([' ', 'Enter'].includes(event.key) && target.closest('button, a')) {
      snap.interrupt();
      return;
    }
    if (['ArrowDown', 'PageDown', ' '].includes(event.key))
      snap.input(event.shiftKey ? -1 : 1);
    else if (['ArrowUp', 'PageUp', 'Home', 'End'].includes(event.key))
      snap.interrupt();
  };
  const clickCue = (event: MouseEvent) => {
    if (
      event.button ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    event.preventDefault();
    if (!snap.begin())
      window.scrollTo({ top: bounds().end, behavior: 'instant' });
  };
  // These listeners are passive: scrolling, inertia and browser zoom stay native.
  window.addEventListener('wheel', wheel, { passive: true });
  window.addEventListener('scroll', snap.moved, { passive: true });
  window.addEventListener('touchstart', touchStart, { passive: true });
  window.addEventListener('touchmove', touchMove, { passive: true });
  window.addEventListener('touchend', touchEnd, { passive: true });
  window.addEventListener('touchcancel', touchEnd, { passive: true });
  window.addEventListener('pointerdown', snap.interrupt, { passive: true });
  window.addEventListener('keydown', key);
  window.addEventListener('resize', snap.interrupt);
  window.addEventListener('pagehide', snap.interrupt);
  document.addEventListener('visibilitychange', snap.interrupt);
  reduced.addEventListener('change', snap.interrupt);
  cue?.addEventListener('click', clickCue);
  return () => {
    snap.dispose();
    window.removeEventListener('wheel', wheel);
    window.removeEventListener('scroll', snap.moved);
    window.removeEventListener('touchstart', touchStart);
    window.removeEventListener('touchmove', touchMove);
    window.removeEventListener('touchend', touchEnd);
    window.removeEventListener('touchcancel', touchEnd);
    window.removeEventListener('pointerdown', snap.interrupt);
    window.removeEventListener('keydown', key);
    window.removeEventListener('resize', snap.interrupt);
    window.removeEventListener('pagehide', snap.interrupt);
    document.removeEventListener('visibilitychange', snap.interrupt);
    reduced.removeEventListener('change', snap.interrupt);
    cue?.removeEventListener('click', clickCue);
  };
}
