(() => {
  const root = document.documentElement;
  const started = performance.now();
  let entered = false;
  try {
    entered = sessionStorage.getItem('feedstar-entered') === '1';
  } catch {}
  // Same-origin navigation also works when session storage is unavailable.
  let internal = false;
  try {
    internal = new URL(document.referrer).origin === location.origin;
  } catch {}
  const mode = entered || internal ? 'navigation' : 'intro';
  root.dataset.bootMode = mode;
  root.dataset.boot = 'loading';
  let settled = false,
    released = false,
    minimumElapsed = false;
  let outcome = 'ready';
  let deadline, minimumTimer, hintTimer;
  const updateEntry = () => {
    if (mode !== 'intro' || !settled || released) return;
    const status = document.querySelector('[data-boot-status]');
    if (!minimumElapsed) {
      if (status) status.textContent = '微光已就绪，片刻后开启。';
      return;
    }
    root.dataset.boot = 'awaiting';
    const button = document.querySelector('[data-boot-enter]');
    const label = document.querySelector('[data-boot-enter-label]');
    if (button) button.disabled = false;
    if (label)
      label.textContent = outcome === 'ready' ? '进入观测站' : '进入阅读';
    if (status)
      status.textContent =
        outcome === 'ready'
          ? '微光已就绪，由你开启这次探索。'
          : '部分影像暂未就绪，可以先从文字开始。';
  };
  const reveal = (instant = false) => {
    if (released) return;
    released = true;
    clearTimeout(deadline);
    clearTimeout(minimumTimer);
    clearTimeout(hintTimer);
    delete root.dataset.bootHint;
    const loader = document.querySelector('.site-loader');
    const focused = loader?.contains(document.activeElement);
    document.querySelectorAll('[data-boot-inert]').forEach((element) => {
      element.inert = false;
      element.removeAttribute('data-boot-inert');
    });
    const done = () => {
      root.dataset.boot = 'done';
      if (loader) loader.hidden = true;
      if (focused) {
        const main = document.getElementById('main');
        main?.setAttribute('tabindex', '-1');
        main?.focus({ preventScroll: true });
      }
      window.dispatchEvent(new Event('feedstar:revealed'));
    };
    if (instant || matchMedia('(prefers-reduced-motion: reduce)').matches)
      done();
    else {
      root.dataset.boot = 'leaving';
      window.setTimeout(done, 520);
    }
  };
  const finish = (reason = 'ready') => {
    if (settled || released) return;
    settled = true;
    outcome = reason;
    clearTimeout(deadline);
    root.dataset.bootOutcome = reason;
    if (reason !== 'ready') {
      window.dispatchEvent(new Event('feedstar:boot-cancel'));
      root.classList.remove('js');
      if (root.dataset.fontState !== 'ready') {
        root.setAttribute('data-font-fallback', '');
        const fonts = document.querySelector('[data-site-fonts]');
        if (fonts) {
          fonts.disabled = true;
          fonts.media = 'not all';
        }
      }
    }
    if (mode === 'navigation') reveal(true);
    else updateEntry();
  };
  const enter = () => {
    if (mode !== 'intro' || !settled || !minimumElapsed || released) return;
    try {
      sessionStorage.setItem('feedstar-entered', '1');
    } catch {}
    reveal();
  };
  window.__feedstarBoot = { started, mode, finish, enter };
  // The first visit always needs a click, including the bounded failure path.
  // This watchdog works even when the downloaded module graph never arrives.
  deadline = window.setTimeout(() => finish('timeout'), 18000);
  if (mode === 'intro') {
    const visibleIntro = () => {
      if (!document.querySelector('.site-loader')) return false;
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          // Count from the opening's paint, without waiting for module downloads
          // (which can postpone DOMContentLoaded indefinitely on a broken network).
          minimumTimer = window.setTimeout(() => {
            minimumElapsed = true;
            updateEntry();
          }, 3000);
        }),
      );
      return true;
    };
    if (!visibleIntro()) {
      const markup = new MutationObserver(() => {
        if (visibleIntro()) markup.disconnect();
      });
      markup.observe(root, { childList: true, subtree: true });
    }
  } else {
    // Cached navigation has no overlay, minimum delay or entry confirmation.
    hintTimer = window.setTimeout(() => {
      if (!settled) root.dataset.bootHint = 'true';
    }, 600);
  }
  window.addEventListener('pageshow', (event) => {
    if (!event.persisted) return;
    if (released) {
      root.dataset.boot = 'done';
      const loader = document.querySelector('.site-loader');
      if (loader) loader.hidden = true;
    } else updateEntry(); // Returning must not bypass the first-visit click.
  });
})();
