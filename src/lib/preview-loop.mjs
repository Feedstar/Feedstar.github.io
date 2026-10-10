// One callback per display frame. Only visible covers subscribe, so a page
// with no visible studies does not keep an empty animation loop running.
export function createPreviewLoop(requestFrame, cancelFrame) {
  const subscribers = new Set();
  let frame = null;
  let previous = null;
  let suspended = false;
  const stop = () => {
    if (frame !== null) cancelFrame(frame);
    frame = null;
    previous = null;
  };
  const schedule = () => {
    if (frame === null && subscribers.size && !suspended)
      frame = requestFrame(tick);
  };
  const tick = (now) => {
    frame = null;
    const dt = previous === null ? 0 : Math.min((now - previous) / 1000, 0.05);
    previous = now;
    for (const update of subscribers) update(dt, now);
    if (!subscribers.size) previous = null;
    schedule();
  };
  return {
    add(update) {
      subscribers.add(update);
      schedule();
    },
    remove(update) {
      subscribers.delete(update);
      if (!subscribers.size) stop();
    },
    suspend(value) {
      suspended = value;
      if (suspended) stop();
      else schedule();
    },
    dispose() {
      subscribers.clear();
      stop();
    },
  };
}

// Keep glossy covers sharp without shading millions of unnecessary pixels on
// a high-DPI display. The CSS size and camera framing remain unchanged.
export function previewPixelRatio(width, height, deviceRatio) {
  return Math.min(
    deviceRatio,
    1.5,
    Math.sqrt(1_000_000 / Math.max(1, width * height)),
  );
}
