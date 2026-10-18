(() => {
  const root = document.documentElement;
  const started = performance.now();
  let released = false;
  let deadline;
  root.dataset.boot = 'loading';
  const release = (outcome = 'ready') => {
    if (released) return;
    released = true;
    clearTimeout(deadline);
    root.dataset.bootOutcome = outcome;
    if (outcome !== 'ready') {
      window.dispatchEvent(new Event('feedstar:boot-cancel'));
      // Content stays available even if the main JavaScript never arrived.
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
    const loader = document.querySelector('.site-loader');
    const status = document.querySelector('[data-boot-status]');
    if (status)
      status.textContent =
        outcome === 'ready'
          ? '微光已就绪，开始探索。'
          : '先从文字开始，保持好奇。';
    root.dataset.boot = 'leaving';
    document.querySelectorAll('[data-boot-inert]').forEach((element) => {
      element.inert = false;
      element.removeAttribute('data-boot-inert');
    });
    const focused = loader?.contains(document.activeElement);
    window.setTimeout(
      () => {
        root.dataset.boot = 'done';
        if (loader) loader.hidden = true;
        if (focused) {
          const main = document.getElementById('main');
          main?.setAttribute('tabindex', '-1');
          main?.focus({ preventScroll: true });
        }
        window.dispatchEvent(new Event('feedstar:revealed'));
      },
      matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 520,
    );
  };
  window.__feedstarBoot = { started, release };
  // Independent of the downloaded module graph; never trap a failed request.
  deadline = window.setTimeout(() => release('timeout'), 18000);
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
      clearTimeout(deadline);
      release('skipped');
      root.dataset.boot = 'done';
      const loader = document.querySelector('.site-loader');
      if (loader) loader.hidden = true;
    }
  });
})();
