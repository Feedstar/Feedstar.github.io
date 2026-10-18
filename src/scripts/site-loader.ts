import { bootSignal, prepareFonts, prepareImage } from './page-resources';
declare global {
  interface Window {
    __feedstarBoot?: {
      started: number;
      mode: 'intro' | 'navigation';
      progress: (percent: number) => void;
      finish: (reason?: string) => void;
      enter: () => void;
    };
  }
}

export function startSiteLoader() {
  const boot = window.__feedstarBoot;
  if (!boot || document.documentElement.dataset.boot !== 'loading') return;
  if (boot.mode === 'intro')
    document
      .querySelectorAll<HTMLElement>(
        'body > header, body > main, body > footer',
      )
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
      '.home-document-art img, .about-portrait img, .reading-cover img, .document-cover img',
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
  const status = document.querySelector<HTMLElement>('[data-boot-status]');
  const stage = (name: string) =>
    document
      .querySelector(`[data-boot-stage='${name}']`)
      ?.setAttribute('data-settled', 'true');
  const report = (ok: boolean) => {
    if (bootSignal.aborted) return;
    failed ||= !ok;
    boot.progress((++completed / total) * 100);
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
      document.documentElement.dataset.bootQuality = failed
        ? 'static'
        : 'complete';
      // Await a paint boundary, then let the first-visit controller offer entry.
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          if (!bootSignal.aborted) boot.finish('ready');
        }),
      );
    })
    .catch(() => boot.finish('error'));
}
