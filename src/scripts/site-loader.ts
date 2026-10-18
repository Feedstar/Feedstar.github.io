import { bootSignal, prepareFonts, prepareImage } from './page-resources';
declare global {
  interface Window {
    __feedstarBoot?: { started: number; release: (reason?: string) => void };
  }
}

export function startSiteLoader() {
  const boot = window.__feedstarBoot;
  if (!boot || document.documentElement.dataset.boot !== 'loading') return;
  document
    .querySelectorAll<HTMLElement>('body > header, body > main, body > footer')
    .forEach((element) => {
      if (!element.inert) {
        element.inert = true;
        element.setAttribute('data-boot-inert', '');
      }
    });
  const scenes = [
    ...document.querySelectorAll<HTMLElement>('[data-boot-scene]'),
  ];
  const images = [
    ...document.querySelectorAll<HTMLImageElement>(
      '.home-document-art img, .home-profile-portrait img, .about-portrait img, .reading-cover img, .document-cover img, .crystal-static-art img',
    ),
  ];
  const firstScreen = [...document.images].filter(
    (image) =>
      image.getBoundingClientRect().top < innerHeight &&
      !image.closest('[hidden], .site-loader'),
  );
  const selected = [...new Set([...images, ...firstScreen])];
  const total = 1 + selected.length + scenes.length;
  let completed = 0;
  let failed = false;
  const count = document.querySelector<HTMLElement>('[data-boot-progress]');
  const status = document.querySelector<HTMLElement>('[data-boot-status]');
  const loader = document.querySelector<HTMLElement>('.site-loader');
  const stage = (name: string) =>
    document
      .querySelector(`[data-boot-stage='${name}']`)
      ?.setAttribute('data-settled', 'true');
  const report = (ok: boolean) => {
    if (bootSignal.aborted) return;
    failed ||= !ok;
    const percent = Math.round((++completed / total) * 100);
    loader?.style.setProperty('--boot-progress', String(percent));
    if (count) {
      count.innerHTML = String(percent).padStart(2, '0') + '<span>%</span>';
      count.setAttribute('aria-valuenow', String(percent));
    }
  };
  const waitScene = (root: HTMLElement) =>
    new Promise<boolean>((resolve) => {
      const finish = (ok: boolean) => {
        observer.disconnect();
        bootSignal.removeEventListener('abort', abort);
        resolve(ok);
      };
      const check = () => {
        if (root.dataset.bootState === 'ready') finish(true);
        else if (root.dataset.bootState === 'fallback') finish(false);
      };
      const observer = new MutationObserver(check);
      const abort = () => finish(false);
      observer.observe(root, {
        attributes: true,
        attributeFilter: ['data-boot-state'],
      });
      bootSignal.addEventListener('abort', abort, { once: true });
      if (bootSignal.aborted) abort();
      else check();
    });
  const fontTask = prepareFonts().then((ok) => {
    report(ok);
    stage('fonts');
  });
  const imageTask = Promise.all(
    selected.map((image) => prepareImage(image).then(report)),
  ).then(() => stage('images'));
  const sceneTask = Promise.all(
    scenes.map((root) => waitScene(root).then(report)),
  ).then(() => stage('scenes'));
  fontTask.then(() => {
    if (status && !bootSignal.aborted)
      status.textContent = '正在汇聚影像与场景';
  });
  Promise.all([fontTask, imageTask, sceneTask])
    .then(() => {
      if (bootSignal.aborted) return;
      let minimum = 950;
      try {
        if (sessionStorage.getItem('feedstar-visited')) minimum = 180;
        sessionStorage.setItem('feedstar-visited', '1');
      } catch {}
      document.documentElement.dataset.bootQuality = failed
        ? 'static'
        : 'complete';
      setTimeout(
        () => {
          if (bootSignal.aborted) return;
          // Let the prepared canvas, fonts and decoded images reach a paint boundary.
          requestAnimationFrame(() =>
            requestAnimationFrame(() => {
              if (!bootSignal.aborted) boot.release('ready');
            }),
          );
        },
        Math.max(0, minimum - (performance.now() - boot.started)),
      );
    })
    .catch(() => boot.release('error'));
}
