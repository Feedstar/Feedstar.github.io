// Cache document positions on layout changes; scrolling only updates small DOM
// indicators, without measuring every heading or running a continuous loop.
export function createReadingToc() {
  const toc = document.querySelector<HTMLDetailsElement>('.reading-toc');
  const article = document.querySelector<HTMLElement>('.article-shell');
  const prose = article?.querySelector<HTMLElement>('.prose');
  if (!toc || !article || !prose) return;

  const links = Array.from(
    toc.querySelectorAll<HTMLAnchorElement>('[data-toc-target]'),
  );
  const sections = links.map((link) =>
    document.getElementById(link.dataset.tocTarget!),
  );
  const label = toc.querySelector<HTMLElement>('[data-reading-current]')!;
  const percentage = toc.querySelector<HTMLElement>('[data-reading-percent]')!;
  const meter = toc.querySelector<HTMLElement>('[role="progressbar"]')!;
  const fills = [
    toc.querySelector<HTMLElement>('[data-reading-fill]'),
    document.getElementById('reading-progress'),
  ];
  const compact = matchMedia('(max-width: 1000px)');
  const phone = matchMedia('(max-width: 650px)');
  let positions: number[] = [];
  let start = 0;
  let end = 1;
  let frame = 0;
  let needsMeasure = true;
  // The server-rendered contents initially marks the introduction as current.
  let active = 0;
  let previousPercent = -1;

  const update = () => {
    frame = 0;
    const y = scrollY;
    if (needsMeasure) {
      positions = sections.map((section) =>
        section ? section.getBoundingClientRect().top + y : Infinity,
      );
      start = article.getBoundingClientRect().top + y;
      end = Math.max(
        start + 1,
        prose.getBoundingClientRect().bottom + y - innerHeight + 64,
      );
      needsMeasure = false;
    }
    const progress = Math.max(0, Math.min(1, (y - start) / (end - start)));
    const percent = Math.round(progress * 100);
    // Match anchor landing positions below the header and compact contents bar.
    const readingLine =
      y + (compact.matches ? (phone.matches ? 198 : 228) : 166);
    let next = 0;
    for (let i = 1; i < positions.length; i++) {
      if (positions[i] <= readingLine) next = i;
    }
    if (progress === 1) next = links.length - 1;
    if (active !== next) {
      links[active]?.removeAttribute('aria-current');
      links[next]?.setAttribute('aria-current', 'location');
      label.textContent = links[next]?.lastElementChild?.textContent ?? '开篇';
      active = next;
    }
    if (percent !== previousPercent) {
      percentage.textContent = `${percent}%`;
      meter.setAttribute('aria-valuenow', String(percent));
      previousPercent = percent;
    }
    for (const fill of fills)
      if (fill) fill.style.transform = `scaleX(${progress})`;
  };
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(update);
  };
  const measure = () => {
    needsMeasure = true;
    schedule();
  };
  const resize = () => {
    toc.open = !compact.matches;
    measure();
  };
  toc.open = !compact.matches;
  toc.addEventListener('click', (event) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = (event.target as Element).closest<HTMLAnchorElement>(
      '[data-toc-target]',
    );
    if (!link || !compact.matches) return;
    // Collapsing changes the article's document position on small screens.
    // Measure before the browser performs the native anchor navigation.
    toc.open = false;
    needsMeasure = true;
    sections[links.indexOf(link)]?.focus({ preventScroll: true });
    schedule();
  });
  // Heading focus makes keyboard reading continue at the destination.
  sections.forEach((section) => section?.setAttribute('tabindex', '-1'));
  toc.addEventListener('toggle', measure);
  const observer = new ResizeObserver(measure);
  observer.observe(article);
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', measure);
  window.addEventListener('pageshow', measure);
  window.addEventListener('hashchange', measure);
  compact.addEventListener('change', resize);
  document.fonts.ready.then(measure);
  window.addEventListener('pagehide', (event) => {
    cancelAnimationFrame(frame);
    frame = 0;
    if (!event.persisted) {
      observer.disconnect();
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', measure);
      window.removeEventListener('pageshow', measure);
      window.removeEventListener('hashchange', measure);
      compact.removeEventListener('change', resize);
    }
  });
  measure();
}
