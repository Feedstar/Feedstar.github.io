import { settle } from '../lib/motion.mjs';

export function createPointer() {
  const orbit = document.querySelector<HTMLElement>('.pointer-orbit');
  if (!orbit) return;
  const fine = matchMedia(
    '(min-width: 701px) and (hover: hover) and (pointer: fine)',
  );
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const textSelector =
    '.hero-english, .hero-chinese, .hero-description, .eyebrow, .section-heading h2, .project-meta h3, .project-summary, .journal-list h3, .arrival h2, .arrival p, .about-quote, .about-body p, .about-fragment p, .prose p, .prose h2, .prose h3, .prose li, .footer-statement, .article-header h1, .article-description, .page-intro h1, .intro-description';
  document
    .querySelectorAll(textSelector)
    .forEach((el) => el.setAttribute('data-pointer-light', ''));
  let x = 0,
    y = 0,
    vx = 0,
    vy = 0,
    tx = 0,
    ty = 0;
  let started = false,
    inside = false,
    frame = 0,
    previous = 0;
  let lit: Element | null = null;
  const inspect = (element: Element | null) => {
    const blocked = !!element?.closest(
      'input, select, textarea, .simulation-view, pre, canvas, [inert]',
    );
    const next = blocked
      ? null
      : (element?.closest('[data-pointer-light]') ?? null);
    if (next !== lit) {
      lit?.classList.remove('pointer-lit');
      next?.classList.add('pointer-lit');
      lit = next;
    }
    orbit.dataset.mode = blocked
      ? 'hidden'
      : element?.closest('a, button')
        ? 'link'
        : next
          ? 'text'
          : 'idle';
  };
  const draw = (now: number) => {
    frame = 0;
    if (!inside || !fine.matches || reduced.matches) return;
    const dt = previous ? Math.min((now - previous) / 1000, 0.05) : 1 / 60;
    previous = now;
    const sx = settle(x, vx, tx, dt, 0.26),
      sy = settle(y, vy, ty, dt, 0.26);
    x = sx.value;
    vx = sx.velocity;
    y = sy.value;
    vy = sy.velocity;
    orbit.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    if (Math.hypot(x - tx, y - ty) > 0.04 || Math.hypot(vx, vy) > 0.04)
      frame = requestAnimationFrame(draw);
  };
  const move = (event: PointerEvent) => {
    if (!fine.matches || event.pointerType === 'touch') return;
    tx = event.clientX;
    ty = event.clientY;
    inspect(event.target instanceof Element ? event.target : null);
    if (reduced.matches) return;
    inside = true;
    if (!started) {
      x = tx;
      y = ty;
      started = true;
    }
    orbit.dataset.visible = 'true';
    if (!frame) {
      previous = 0;
      frame = requestAnimationFrame(draw);
    }
  };
  const leave = () => {
    inside = false;
    started = false;
    orbit.dataset.visible = 'false';
    lit?.classList.remove('pointer-lit');
    lit = null;
    cancelAnimationFrame(frame);
    frame = 0;
    vx = 0;
    vy = 0;
  };
  const scroll = () => {
    if (inside) inspect(document.elementFromPoint(tx, ty));
  };
  document.addEventListener('pointermove', move, { passive: true });
  document.addEventListener('pointerleave', leave);
  window.addEventListener('blur', leave);
  window.addEventListener('scroll', scroll, { passive: true });
  document.addEventListener('visibilitychange', leave);
  fine.addEventListener('change', leave);
  reduced.addEventListener('change', leave);
}
