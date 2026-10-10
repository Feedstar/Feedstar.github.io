import { clamp, smoothstep } from '../lib/erosion.mjs';

// Scroll changes spatial relationships; no wheel interception or autoplayed
// section timeline. A reverse scroll retraces the same masks and depth.
export function createChapters() {
  if (document.body.dataset.page !== 'home') return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const chapters = Array.from(
    document.querySelectorAll<HTMLElement>('[data-chapter]'),
  );
  const cards = Array.from(
    document.querySelectorAll<HTMLElement>('.study-card'),
  );
  const notesMark = document.querySelector<HTMLElement>('.notes-asterisk');
  const lines = Array.from(
    document.querySelectorAll<HTMLElement>('[data-story-line]'),
  );
  const footer = document.querySelector<HTMLElement>('.site-footer');
  const wordmark = document.querySelector<HTMLElement>('.footer-wordmark');
  let frame = 0;
  const update = () => {
    frame = 0;
    const height = innerHeight;
    for (const section of chapters) {
      const rect = section.getBoundingClientRect();
      const p = reduced.matches
        ? 1
        : smoothstep(0, 1, (height - rect.top) / (height * 0.86));
      section.dataset.transitionProgress = p.toFixed(3);
      if (section.dataset.chapter === 'gallery') {
        section.style.clipPath = reduced.matches
          ? ''
          : `inset(0 ${(1 - p) * 8}% 0 round ${(1 - p) * 140 + 20}px ${(1 - p) * 140 + 20}px 0 0)`;
      } else if (section.dataset.chapter === 'notes') {
        section.style.clipPath = reduced.matches
          ? ''
          : `inset(0 0 0 round ${(1 - p) * 42}vw ${(1 - p) * 42}vw 0 0)`;
        if (notesMark)
          notesMark.style.transform = reduced.matches
            ? ''
            : `rotate(${(1 - p) * -100 + clamp(-rect.top / height) * 55}deg)`;
      } else {
        const rule = section.querySelector<HTMLElement>('.chapter-rule');
        if (rule) rule.style.transform = `scaleX(${p})`;
      }
    }
    for (const card of cards) {
      const rect = card.getBoundingClientRect();
      if (rect.bottom < -100 || rect.top > height + 100) continue;
      const p = reduced.matches
        ? 1
        : smoothstep(0, 1, (height - rect.top) / (height * 0.68));
      const window = card.querySelector<HTMLElement>('.study-window')!;
      window.style.transform = reduced.matches
        ? ''
        : `translate3d(0,${(1 - p) * 70}px,0) scale(${0.92 + p * 0.08})`;
      window.style.clipPath = reduced.matches
        ? ''
        : `inset(${(1 - p) * 12}% ${(1 - p) * 5}% round 28px)`;
    }
    for (const line of lines) {
      const rect = line.getBoundingClientRect();
      const p = reduced.matches
        ? 1
        : smoothstep(0, 1, (height * 0.94 - rect.top) / (height * 0.36));
      line.style.clipPath = reduced.matches
        ? ''
        : `inset(0 ${(1 - p) * 100}% 0 0)`;
    }
    if (footer && wordmark) {
      const p = reduced.matches
        ? 1
        : smoothstep(
            0,
            1,
            (height - footer.getBoundingClientRect().top) / (height * 0.8),
          );
      wordmark.style.transform = reduced.matches
        ? ''
        : `translate3d(${(1 - p) * -4}%,${(1 - p) * 90}px,0)`;
      wordmark.style.opacity = String(0.25 + p * 0.75);
      footer.style.clipPath = reduced.matches
        ? ''
        : `inset(0 0 0 round ${(1 - p) * 90}px ${(1 - p) * 90}px 0 0)`;
    }
  };
  const schedule = () => {
    if (!frame && !document.hidden) frame = requestAnimationFrame(update);
  };
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  reduced.addEventListener('change', schedule);
  document.addEventListener('visibilitychange', schedule);
  window.addEventListener('pageshow', schedule);
  document.fonts.ready.then(schedule);
  schedule();
  window.addEventListener('pagehide', (event) => {
    cancelAnimationFrame(frame);
    frame = 0;
    if (!event.persisted) {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('pageshow', schedule);
      reduced.removeEventListener('change', schedule);
      document.removeEventListener('visibilitychange', schedule);
    }
  });
}
