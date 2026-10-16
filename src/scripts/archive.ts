import { createPreviewLoop } from '../lib/preview-loop.mjs';
import { createArchiveScene } from './archive-scene';

export function createArchive() {
  const root = document.querySelector<HTMLElement>('[data-archive]');
  if (!root) return;
  const opening = root.querySelector<HTMLElement>('.archive-opening')!;
  const title = root.querySelector<HTMLElement>('.archive-title')!;
  const introduction = root.querySelector<HTMLElement>(
    '.archive-introduction',
  )!;
  const holdButton = root.querySelector<HTMLButtonElement>(
    '[data-archive-hold]',
  )!;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(hover:hover) and (pointer:fine)');
  const cards = [...root.querySelectorAll<HTMLElement>('[data-archive-item]')];
  const filters = [
    ...root.querySelectorAll<HTMLButtonElement>('[data-archive-filter]'),
  ];
  const loop = createPreviewLoop(requestAnimationFrame, cancelAnimationFrame);
  let scene: ReturnType<typeof createArchiveScene> | null = null;
  try {
    scene = createArchiveScene(
      root.querySelector<HTMLCanvasElement>('canvas')!,
      root.dataset.archive!,
    );
  } catch {
    holdButton.hidden = true;
  }
  let progress = 0,
    target = 0,
    holding = false,
    hold = 0,
    time = 0,
    px = 0,
    py = 0,
    visible = true,
    travel = 1,
    top = 0;
  const measure = () => {
    const rect = opening.getBoundingClientRect();
    top = rect.top + scrollY;
    travel = Math.max(1, opening.offsetHeight - innerHeight);
    updateScroll();
  };
  const updateScroll = () => {
    target = reduce.matches
      ? 0
      : Math.max(0, Math.min(1, (scrollY - top) / travel));
  };
  const frame = (dt: number) => {
    const damping = 1 - Math.exp(-dt * 9);
    progress += (target - progress) * damping;
    hold +=
      ((holding ? 1 : 0) - hold) * (1 - Math.exp(-dt * (holding ? 3.8 : 5.5)));
    if (!reduce.matches) time += dt;
    scene?.render(progress, hold, time, px, py, reduce.matches);
    title.style.transform = `translate3d(${-progress * 25}px,${-progress * 75}px,0) scale(${1 - progress * 0.06})`;
    title.style.opacity = String(1 - progress * 0.8);
    introduction.style.transform = `translate3d(0,${-progress * 30}px,0)`;
    introduction.style.opacity = String(1 - progress * 0.9);
    holdButton.style.setProperty('--hold', String(hold));
    root.style.setProperty('--archive-progress', String(progress));
    if (reduce.matches) loop.remove(frame);
  };
  const resume = () => {
    if (visible && !document.hidden) loop.add(frame);
  };
  const visibility = new IntersectionObserver(
    ([entry]) => {
      visible = entry.isIntersecting;
      if (visible) resume();
      else loop.remove(frame);
    },
    { rootMargin: '60px' },
  );
  visibility.observe(opening);
  const resize = new ResizeObserver(measure);
  resize.observe(opening);
  measure();
  window.addEventListener('scroll', updateScroll, { passive: true });
  const pointer = (e: PointerEvent) => {
    if (fine.matches) {
      px = e.clientX / innerWidth - 0.5;
      py = e.clientY / innerHeight - 0.5;
    }
  };
  opening.addEventListener('pointermove', pointer, { passive: true });
  const release = () => {
    holding = false;
    holdButton.setAttribute('aria-pressed', 'false');
  };
  holdButton.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || reduce.matches) return;
    holding = true;
    holdButton.setPointerCapture(e.pointerId);
    holdButton.setAttribute('aria-pressed', 'true');
  });
  ['pointerup', 'pointercancel', 'lostpointercapture', 'blur'].forEach(
    (event) => holdButton.addEventListener(event, release),
  );
  holdButton.addEventListener('keydown', (e) => {
    if ((e.key === ' ' || e.key === 'Enter') && !reduce.matches) {
      e.preventDefault();
      holding = true;
      holdButton.setAttribute('aria-pressed', 'true');
    }
  });
  holdButton.addEventListener('keyup', (e) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      release();
    }
  });
  const changeMotion = () => {
    release();
    progress = target = 0;
    measure();
    resume();
  };
  reduce.addEventListener('change', changeMotion);
  const onVisibility = () => {
    if (document.hidden) {
      release();
      loop.suspend(true);
    } else {
      loop.suspend(false);
      resume();
    }
  };
  document.addEventListener('visibilitychange', onVisibility);
  const cardObserver = new IntersectionObserver(
    (entries) =>
      entries.forEach((entry) => {
        entry.target.classList.toggle('is-inview', entry.isIntersecting);
        if (
          entry.isIntersecting &&
          !entry.target.hasAttribute('data-entered')
        ) {
          entry.target.setAttribute('data-entered', '');
          if (!reduce.matches)
            (entry.target as HTMLElement).animate(
              [
                { opacity: 0, transform: 'translateY(45px) rotateX(5deg)' },
                { opacity: 1, transform: 'none' },
              ],
              {
                duration: 700,
                easing: 'cubic-bezier(.23,1,.32,1)',
                fill: 'none',
              },
            );
        }
      }),
    { threshold: 0.08 },
  );
  cards.forEach((card, index) => {
    card.classList.toggle('is-alternate', index % 2 === 1);
    cardObserver.observe(card);
    const surface = card.querySelector<HTMLElement>('[data-card-surface]')!;
    card.addEventListener(
      'pointermove',
      (e) => {
        if (!fine.matches || reduce.matches) return;
        const rect = card.getBoundingClientRect();
        surface.style.setProperty(
          '--tilt-x',
          `${(-(e.clientY - rect.top - rect.height / 2) / rect.height) * 4}deg`,
        );
        surface.style.setProperty(
          '--tilt-y',
          `${((e.clientX - rect.left - rect.width / 2) / rect.width) * 6}deg`,
        );
      },
      { passive: true },
    );
    card.addEventListener('pointerleave', () => {
      surface.style.setProperty('--tilt-x', '0deg');
      surface.style.setProperty('--tilt-y', '0deg');
    });
  });
  filters.forEach((button) =>
    button.addEventListener('click', () => {
      if (button.getAttribute('aria-pressed') === 'true') return;
      const previous = new Map(
        cards.map((card) => [card, card.getBoundingClientRect()]),
      );
      const alreadyVisible = new Set(cards.filter((card) => !card.hidden));
      cards.forEach((card) =>
        card.getAnimations().forEach((animation) => animation.cancel()),
      );
      filters.forEach((filter) =>
        filter.setAttribute('aria-pressed', String(filter === button)),
      );
      const selected = button.dataset.archiveFilter;
      let count = 0;
      cards.forEach((card) => {
        card.hidden = selected !== 'all' && card.dataset.group !== selected;
        if (!card.hidden) {
          card.style.setProperty('--visible-index', String(count));
          count++;
        }
      });
      const visibleCards = cards.filter((card) => !card.hidden);
      visibleCards.forEach((card) => card.setAttribute('data-entered', ''));
      visibleCards.forEach((card, index) => {
        card.classList.toggle('is-alternate', index % 2 === 1);
        if (reduce.matches) return;
        const before = previous.get(card)!,
          after = card.getBoundingClientRect();
        const retained = alreadyVisible.has(card);
        card.animate(
          [
            {
              transform: retained
                ? `translate(${before.left - after.left}px,${before.top - after.top}px)`
                : 'translateY(35px)',
              opacity: retained ? 1 : 0,
            },
            { transform: 'none', opacity: 1 },
          ],
          {
            duration: retained ? 500 : 550,
            delay: retained ? 0 : index * 45,
            easing: 'cubic-bezier(.23,1,.32,1)',
            fill: 'backwards',
          },
        );
      });
      root.querySelector('[data-archive-count]')!.textContent =
        `${String(count).padStart(2, '0')} 篇${root.dataset.archive === 'journal' ? '手记' : '文档'}`;
    }),
  );
  resume();
  // Restore the scene after back/forward-cache navigation; ordinary links need no JS.
  window.addEventListener('pageshow', () => {
    loop.suspend(false);
    measure();
    resume();
  });
  window.addEventListener('pagehide', (event) => {
    loop.suspend(true);
    if (!event.persisted) {
      scene?.dispose();
      resize.disconnect();
      visibility.disconnect();
      cardObserver.disconnect();
      loop.dispose();
      window.removeEventListener('scroll', updateScroll);
      reduce.removeEventListener('change', changeMotion);
      document.removeEventListener('visibilitychange', onVisibility);
    }
  });
}
