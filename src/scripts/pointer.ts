// Keep text illumination while leaving the system pointer untouched.
export function createPointer() {
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const textSelector =
    '.hero-english, .hero-chinese, .hero-description, .eyebrow, .field-title h2, .study-caption h3, .study-description, .notes-heading h2, .journal-list h3, .arrival h2, .arrival p, .about-quote, .about-body p, .about-fragment p, .prose p, .prose h2, .prose h3, .prose li, .article-header h1, .article-description, .page-intro h1, .intro-description';
  document
    .querySelectorAll(textSelector)
    .forEach((el) => el.setAttribute('data-pointer-light', ''));
  let lit: Element | null = null;
  let x = 0,
    y = 0,
    inside = false;
  const inspect = (element: Element | null) => {
    const blocked = element?.closest(
      'input, select, textarea, .simulation-view, pre, canvas, [inert]',
    );
    const next =
      fine.matches && !blocked
        ? (element?.closest('[data-pointer-light]') ?? null)
        : null;
    if (next === lit) return;
    lit?.classList.remove('pointer-lit');
    next?.classList.add('pointer-lit');
    lit = next;
  };
  const leave = () => {
    inside = false;
    inspect(null);
  };
  document.addEventListener(
    'pointermove',
    (event) => {
      if (event.pointerType === 'touch') return;
      x = event.clientX;
      y = event.clientY;
      inside = true;
      inspect(event.target instanceof Element ? event.target : null);
    },
    { passive: true },
  );
  document.addEventListener('pointerleave', leave);
  document.addEventListener('visibilitychange', leave);
  window.addEventListener('blur', leave);
  window.addEventListener(
    'scroll',
    () => {
      if (inside) inspect(document.elementFromPoint(x, y));
    },
    { passive: true },
  );
  fine.addEventListener('change', leave);
}
