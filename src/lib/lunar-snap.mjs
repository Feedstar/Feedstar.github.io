// Native scrolling owns the gesture. Only take over after it has come to rest,
// and relinquish the animation before the next native input is processed.
export function createLunarSnap(driver) {
  let frame = 0,
    timer = 0,
    running = false,
    manual = false,
    armed = false;
  let lastY = driver.read().y,
    disposed = false;
  const clearPending = () => {
    driver.clearTimer(timer);
    driver.cancelFrame(frame);
    timer = frame = 0;
  };
  const interrupt = () => {
    if (disposed) return;
    clearPending();
    if (running) manual = true;
    running = armed = false;
    driver.state(manual ? 'manual' : 'idle');
  };
  const begin = () => {
    if (disposed) return false;
    const { y, start, end, enabled } = driver.read();
    if (!enabled || y < start - 2 || y >= end - 2) return false;
    clearPending();
    manual = armed = false;
    running = true;
    driver.state('gliding');
    // Give erosion and particle assembly room to unfold, including short finishes.
    const duration = Math.max(
      1800,
      5200 * Math.sqrt((end - y) / (end - start)),
    );
    let began;
    const tick = (now) => {
      if (!running || disposed) return;
      if (!driver.read().enabled) {
        interrupt();
        return;
      }
      began ??= now;
      const t = Math.min(1, (now - began) / duration);
      const eased = t * t * t * (t * (t * 6 - 15) + 10);
      driver.write(y + (end - y) * eased);
      if (t < 1) frame = driver.requestFrame(tick);
      else {
        running = false;
        frame = 0;
        lastY = end;
        driver.state('complete');
      }
    };
    frame = driver.requestFrame(tick);
    return true;
  };
  const queue = () => {
    driver.clearTimer(timer);
    if (!armed || manual || running || disposed) return;
    timer = driver.setTimer(() => {
      timer = 0;
      const { y, start, end, enabled } = driver.read();
      if (enabled && armed && !manual && y > start + 6 && y < end - 2) begin();
    }, 220);
  };
  const input = (delta) => {
    if (disposed) return;
    if (running) {
      interrupt();
      return;
    }
    const { y, start } = driver.read();
    if (y <= start + 2) manual = false;
    armed = delta > 0 && !manual;
    queue();
  };
  const moved = () => {
    if (disposed || running) return;
    const { y, start, end } = driver.read();
    if (y <= start + 2 || y >= end - 2) {
      manual = armed = false;
      driver.clearTimer(timer);
      driver.state(y >= end - 2 ? 'complete' : 'idle');
    } else {
      if (y < lastY - 1) armed = false;
      queue();
    }
    lastY = y;
  };
  return {
    input,
    moved,
    begin,
    interrupt,
    dispose() {
      interrupt();
      disposed = true;
    },
  };
}
