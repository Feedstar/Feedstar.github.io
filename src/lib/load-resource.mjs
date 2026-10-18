/**
 * @template T
 * @param {PromiseLike<T>} promise
 * @param {{signal?: AbortSignal, timeout?: number, dispose?: (value: T) => void}} [options]
 * @returns {Promise<T>}
 */
// A late result must not resurrect a scene after its loading screen was left.
export function loadResource(
  promise,
  { signal, timeout = 16000, dispose = () => {} } = {},
) {
  return new Promise((resolve, reject) => {
    let finished = false;
    let accepted = false;
    let timer;
    const finish = (ok, value) => {
      if (finished) return;
      finished = true;
      accepted = ok;
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      ok ? resolve(value) : reject(value);
    };
    const abort = () => finish(false, new Error('Page preparation cancelled'));
    timer = setTimeout(
      () => finish(false, new Error('Resource preparation timed out')),
      timeout,
    );
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
    Promise.resolve(promise).then(
      (value) => {
        if (finished) {
          if (!accepted) dispose(value);
        } else finish(true, value);
      },
      (error) => finish(false, error),
    );
  });
}
