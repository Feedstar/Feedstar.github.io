import assert from 'node:assert/strict';
import {
  crystalIdle,
  crystalCoverFit,
  crystalCaption,
  crystalPose,
} from '../src/lib/crystal-motion.mjs';

const close = (actual, expected, message, tolerance = 1e-8) =>
  assert(
    Math.abs(actual - expected) <= tolerance,
    `${message}: ${actual} vs ${expected}`,
  );

// Scroll reversibility is tested by check-crystal-motion. Idle is an independent
// elapsed-time layer, so reversing scroll must not reverse the floating clock.
for (let index = 0; index < 11; index++) {
  const scrollPose = crystalPose(index, 0.25);
  for (let sample = 0; sample <= 600; sample++) {
    const time = sample / 3;
    const state = crystalIdle(index, time);
    assert(
      Object.values(state).every(Number.isFinite),
      'Idle must remain finite throughout a complete turn',
    );
    assert(
      Math.abs(state.offsetY) <= 8 + 1e-10,
      'A stationary crystal must float within eight CSS pixels of its scroll centre',
    );
    assert(
      Math.abs(state.pitch) <= 0.018 + 1e-10 &&
        Math.abs(state.roll) <= 0.014 + 1e-10,
      'Additional rocking must stay small enough to preserve the reference scroll gesture',
    );
    const next = crystalIdle(index, time + 1 / 144);
    const yawSpeed = Math.abs(next.yaw - state.yaw) * 144;
    assert(
      yawSpeed > 0.018 && yawSpeed < 0.04,
      'Idle self-rotation must remain slow and continuous, with no reversal or phase wrap',
    );
    assert(
      Math.abs(next.offsetY - state.offsetY) < 0.06,
      'A high-refresh frame must not jump the floating translation',
    );
    close(
      crystalIdle(index, time + 6.4 + (index % 5) * 0.57).offsetY,
      state.offsetY,
      'Each crystal must return to its vertical position after its own floating period',
    );
  }
  for (const seconds of [0, 0.5, 3, 17.25, 130]) {
    // Sampling at a given elapsed time is independent of the number of frames.
    const expected = crystalIdle(index, seconds);
    for (const hz of [30, 60, 120, 144]) {
      const frames = Math.floor(seconds * hz);
      const sampled = crystalIdle(index, frames / hz + (seconds - frames / hz));
      assert.deepEqual(
        sampled,
        expected,
        'Equal elapsed times must produce identical idle poses on every refresh rate',
      );
    }
  }
  assert.deepEqual(
    crystalPose(index, 0.25),
    scrollPose,
    'The idle clock must leave the scroll-only pose unchanged',
  );
  for (const invalid of [NaN, Infinity, -Infinity, -10]) {
    assert.deepEqual(
      crystalIdle(index, invalid),
      crystalIdle(index, 0),
      'Invalid timestamps must have a finite resting phase',
    );
  }
}
assert(
  new Set(
    Array.from({ length: 11 }, (_, index) =>
      crystalIdle(index, 0).offsetY.toFixed(4),
    ),
  ).size === 11,
  'Different articles must not rise and fall in unison',
);
console.log(
  'PASS: idle drift stays within 8px, remains smooth across refresh rates, uses independent phases, and leaves reversible scroll motion intact.',
);

for (const [width, height] of [
  [1024, 1024],
  [1536, 1024],
  [1024, 1536],
  [1800, 640],
  [640, 1800],
]) {
  const fit = crystalCoverFit(width, height);
  close(
    Math.max(fit.width, fit.height),
    0.66,
    'A photo must fit within 66% of the shell size',
  );
  close(
    fit.width / fit.height,
    width / height,
    'A camera-facing photo must retain its original proportions',
  );
}
for (const [width, height] of [
  [0, 0],
  [-1, 20],
  [Infinity, 1024],
  [1024, NaN],
]) {
  assert.deepEqual(
    crystalCoverFit(width, height),
    { width: 0.66, height: 0.66 },
    'An unavailable image must retain a finite contained placeholder',
  );
}
assert.deepEqual(
  crystalCoverFit(1024, 1024, 2),
  { width: 0.7, height: 0.7 },
  'A cover cannot accidentally exceed the interior size limit',
);
console.log(
  'PASS: photographic covers preserve aspect ratio, fit the interior, and handle unavailable image dimensions safely.',
);

// Captions keep a readable measure as their shell enters/exits or turns edge-on.
for (const width of [320, 375, 390, 430, 768]) {
  const size = Math.min(430, width * 0.78);
  let prior;
  for (let centerY = 900; centerY >= -400; centerY -= 4) {
    const caption = crystalCaption(width / 2, centerY, size, width, 844, 185);
    assert(caption.width >= 272 && caption.width <= width - 48);
    assert(caption.left >= 24 && caption.left + caption.width <= width - 24);
    if (prior) {
      close(
        caption.width,
        prior.width,
        'Scrolling must never squeeze a caption into a vertical string',
      );
      close(
        caption.top - prior.top,
        -4,
        'The title moves upward with the crystal, without an entry drop',
      );
    }
    if (caption.top <= 185 || caption.top >= 812)
      close(
        caption.opacity,
        0,
        'Captions outside the reading area must be hidden',
      );
    prior = caption;
  }
}
console.log(
  'PASS: mobile crystal captions keep their width and follow the unclipped centre continuously.',
);
