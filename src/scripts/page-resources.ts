import { loadResource } from '../lib/load-resource.mjs';

export const bootCancelled = () =>
  ['timeout', 'skipped', 'error'].includes(
    document.documentElement.dataset.bootOutcome || '',
  );
const cancellation = new AbortController();
export const bootSignal = cancellation.signal;
if (bootCancelled()) cancellation.abort();
window.addEventListener('feedstar:boot-cancel', () => cancellation.abort(), {
  once: true,
});

export function sceneState(root: HTMLElement, state: 'ready' | 'fallback') {
  root.dataset.bootState = state;
}
export function onBootCancel(callback: () => void) {
  if (bootSignal.aborted) callback();
  else bootSignal.addEventListener('abort', callback, { once: true });
}

let fonts: Promise<boolean> | undefined;
export function prepareFonts() {
  if (fonts) return fonts;
  fonts = (async () => {
    const link = document.querySelector<HTMLLinkElement>('[data-site-fonts]');
    let observer: MutationObserver | undefined;
    try {
      await loadResource(
        new Promise<void>((resolve, reject) => {
          const check = () => {
            if (!link || link.dataset.settled === 'ready') resolve();
            else if (link.dataset.settled === 'failed')
              reject(new Error('Font stylesheet unavailable'));
          };
          if (link) {
            observer = new MutationObserver(check);
            observer.observe(link, {
              attributes: true,
              attributeFilter: ['data-settled'],
            });
          }
          check();
        }),
        { timeout: 5000, signal: bootSignal },
      );
      // Apply the stylesheet before asking FontFaceSet about used faces.
      document.body.getBoundingClientRect();
      await loadResource(document.fonts.ready, {
        timeout: 5000,
        signal: bootSignal,
      });
      if ([...document.fonts].some((face) => face.status === 'error'))
        throw new Error('Font unavailable');
      document.documentElement.dataset.fontState = 'ready';
      return true;
    } catch {
      document.documentElement.dataset.fontState = 'fallback';
      document.documentElement.setAttribute('data-font-fallback', '');
      if (link) {
        link.disabled = true;
        link.media = 'not all';
      }
      return false;
    } finally {
      observer?.disconnect();
    }
  })();
  return fonts;
}

const images = new WeakMap<HTMLImageElement, Promise<boolean>>();
export function prepareImage(image: HTMLImageElement) {
  const existing = images.get(image);
  if (existing) return existing;
  const result = (async () => {
    let clean = () => {};
    image.loading = 'eager';
    try {
      await loadResource(
        new Promise<void>((resolve, reject) => {
          const loaded = () =>
            image.naturalWidth
              ? resolve()
              : reject(new Error('Image unavailable'));
          const failed = () => reject(new Error('Image unavailable'));
          clean = () => {
            image.removeEventListener('load', loaded);
            image.removeEventListener('error', failed);
          };
          image.addEventListener('load', loaded, { once: true });
          image.addEventListener('error', failed, { once: true });
          if (image.complete) loaded();
        }),
        { signal: bootSignal },
      );
      await loadResource(image.decode(), { signal: bootSignal });
      image.dataset.bootImage = 'ready';
      return true;
    } catch {
      image.dataset.bootImage = 'failed';
      return false;
    } finally {
      clean();
    }
  })();
  images.set(image, result);
  return result;
}
