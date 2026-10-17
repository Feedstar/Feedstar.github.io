/** Pure motion/geometry helpers; renderer owns no scroll listeners or animation loop. */
export const clamp = (x, min = 0, max = 1) => Math.min(max, Math.max(min, x));

/** Analytic damped spring. Stable after tab suspension and independent of frame rate. */
export function stepSpring(state, target, dt, stiffness = 20, damping = 10) {
  if (!Number.isFinite(dt) || dt <= 0) return state.value;
  dt = Math.min(dt, 0.1);
  const displacement = state.value - target;
  const half = damping / 2;
  const discriminant = stiffness - half * half;
  const attenuation = Math.exp(-half * dt);
  let position, velocity;
  if (discriminant > 1e-7) {
    const frequency = Math.sqrt(discriminant);
    const sine = Math.sin(frequency * dt),
      cosine = Math.cos(frequency * dt);
    const amplitude = (state.velocity + half * displacement) / frequency;
    position = attenuation * (displacement * cosine + amplitude * sine);
    velocity =
      attenuation *
      (state.velocity * cosine -
        (half * amplitude + frequency * displacement) * sine);
  } else if (discriminant < -1e-7) {
    const frequency = Math.sqrt(-discriminant);
    const r1 = -half + frequency,
      r2 = -half - frequency;
    const a = (state.velocity - r2 * displacement) / (r1 - r2);
    const b = displacement - a;
    position = a * Math.exp(r1 * dt) + b * Math.exp(r2 * dt);
    velocity = a * r1 * Math.exp(r1 * dt) + b * r2 * Math.exp(r2 * dt);
  } else {
    const b = state.velocity + half * displacement;
    position = attenuation * (displacement + b * dt);
    velocity = attenuation * (state.velocity - half * b * dt);
  }
  state.value = target + position;
  state.velocity = velocity;
  if (
    Math.abs(state.value - target) < 1e-6 &&
    Math.abs(state.velocity) < 1e-6
  ) {
    state.value = target;
    state.velocity = 0;
  }
  return state.value;
}

export function crystalCenter(order, layout, scroll = 0) {
  const { width, cardSize, gap, rowGap, startY, columns } = layout;
  return {
    x:
      width / 2 +
      (columns === 2 ? ((order % 2 ? 1 : -1) * (cardSize + gap)) / 2 : 0),
    y: startY + order * (cardSize + rowGap) - scroll,
  };
}

// Five measured poses per object, at vertical positions -1.5, -.75, 0, .75, 1.5
// shell widths from the viewport centre. The source camera axis is converted to +Z.
// This small pose table preserves the alternating scroll turns without shipping a timeline runtime.
const POSES = [
  [
    [0.0091, -0.28941, 0.03011, 0.95669],
    [0.01766, 0.00886, 0.02603, 0.99947],
    [0.02293, 0.22714, 0.02154, 0.97335],
    [0.02651, 0.40298, 0.01693, 0.91467],
    [0.02895, 0.54908, 0.0123, 0.83517],
  ],
  [
    [0.04291, 0.23157, 0.17711, 0.9556],
    [0.01171, 0.06318, 0.18186, 0.98122],
    [-0.01463, -0.07897, 0.18165, 0.98008],
    [-0.03801, -0.20507, 0.17823, 0.96163],
    [-0.05913, -0.31903, 0.17238, 0.93006],
  ],
  [
    [0.03214, -0.19207, -0.16189, 0.9674],
    [0.00746, -0.0446, -0.16488, 0.98528],
    [-0.01482, 0.08852, -0.16438, 0.98231],
    [-0.03519, 0.21026, -0.16125, 0.96361],
    [-0.05418, 0.32375, -0.1559, 0.93164],
  ],
  [
    [0.00194, 0.01708, 0.11319, 0.99343],
    [-0.01524, -0.13376, 0.11217, 0.98453],
    [-0.031, -0.27204, 0.10888, 0.9556],
    [-0.04552, -0.39951, 0.10365, 0.90971],
    [-0.05898, -0.51764, 0.09662, 0.84808],
  ],
  [
    [-0.00224, -0.08134, 0.13078, 0.98807],
    [0.01879, 0.07833, 0.12946, 0.98831],
    [0.0385, 0.22965, 0.12501, 0.96444],
    [0.05697, 0.37282, 0.11775, 0.91864],
    [0.07417, 0.50781, 0.10775, 0.85148],
  ],
  [
    [-0.04111, 0.00178, -0.20802, 0.97726],
    [-0.01245, -0.13111, -0.21168, 0.96842],
    [0.0161, -0.26004, -0.21144, 0.94203],
    [0.04468, -0.38562, -0.20729, 0.89796],
    [0.07351, -0.50858, -0.1989, 0.8345],
  ],
  [
    [-0.07182, 0.98478, 0.15025, -0.04984],
    [-0.04872, 0.96647, 0.15925, -0.19546],
    [-0.02429, 0.92623, 0.16476, -0.33818],
    [0.00165, 0.86228, 0.16653, -0.47827],
    [0.02095, 0.801, 0.16522, -0.57503],
  ],
];

/** Scroll-only quaternion; idle motion is a separate, additive layer below. */
export function crystalPose(index, verticalPosition) {
  const poses = POSES[index % POSES.length];
  const coordinate = clamp((verticalPosition + 1.5) / 0.75, 0, 4);
  const left = Math.min(3, Math.floor(coordinate)),
    amount = coordinate - left;
  const a = poses[left],
    b = poses[left + 1];
  const sign = a.reduce((sum, value, k) => sum + value * b[k], 0) < 0 ? -1 : 1;
  const result = a.map((value, k) => value + (b[k] * sign - value) * amount);
  const length = Math.hypot(...result);
  return result.map((value) => value / length);
}

/**
 * Small perpetual drift, independent of scroll/hover and of frame rate.
 * offsetY uses CSS pixels; angles use radians. Distinct phases avoid a common
 * up/down beat, while a full self-turn takes about 3.5–4 minutes.
 */
export function crystalIdle(index, timeSeconds) {
  const time = Number.isFinite(timeSeconds) ? Math.max(0, timeSeconds) : 0;
  const phase = index * 2.399963229728653;
  const period = 6.4 + (index % 5) * 0.57;
  const direction = index % 2 ? -1 : 1;
  const angularSpeed = 0.026 + (index % 4) * 0.0014;
  return {
    offsetY: 8 * Math.sin((time * Math.PI * 2) / period + phase),
    yaw:
      direction * (time * angularSpeed + 0.045 * Math.sin(time * 0.17 + phase)),
    pitch: 0.018 * Math.sin(time * 0.21 + phase * 0.7),
    roll: 0.014 * Math.sin(time * 0.16 + phase),
  };
}

/** Contain the entire photograph in a square interior, without stretching it. */
export function crystalCoverFit(width, height, interiorFraction = 0.66) {
  const aspect =
    width > 0 && height > 0 && Number.isFinite(width / height)
      ? width / height
      : 1;
  const fraction = clamp(interiorFraction, 0, 0.7);
  return {
    width: fraction * Math.min(1, aspect),
    height: fraction * Math.min(1, 1 / aspect),
  };
}

/** Convex silhouette, in CSS pixels, used for native keyboard/link hit regions. */
export function convexHull(points) {
  if (points.length < 3) return points;
  const sorted = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (a, b, c) =>
    (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const half = (sequence) => {
    const result = [];
    for (const point of sequence) {
      while (
        result.length > 1 &&
        cross(result[result.length - 2], result[result.length - 1], point) <= 0
      )
        result.pop();
      result.push(point);
    }
    result.pop();
    return result;
  };
  return half(sorted).concat(half(sorted.slice().reverse()));
}

export function clipPolygon(points, width, height) {
  let result = points;
  for (const [axis, edge, sign] of [
    [0, 0, 1],
    [0, width, -1],
    [1, 0, 1],
    [1, height, -1],
  ]) {
    const input = result;
    result = [];
    if (!input.length) break;
    let previous = input[input.length - 1];
    for (const current of input) {
      const inside = sign * (current[axis] - edge) >= 0;
      const previousInside = sign * (previous[axis] - edge) >= 0;
      if (inside !== previousInside) {
        const amount =
          (edge - previous[axis]) / (current[axis] - previous[axis]);
        result.push(
          previous.map((value, k) => value + (current[k] - value) * amount),
        );
      }
      if (inside) result.push(current);
      previous = current;
    }
  }
  return result;
}

// Optical settings measured from the public reference; implementation is independent.
export const GLASS_SETTINGS = {
  default: {
    baseColor: '#ffffff',
    peaksColor: '#ffffff',
    fringeColor: '#ffffff',
    resetDistances: 0.0,
    distancesFactor: 1.0,
    iorStart: 1.2,
    iorDelta: 0.3,
    uvShiftFactor: 1.0,
    envReflection: 1.0,
    envRefraction: 0.0,
    reflectionIridescence: 0.0,
    refractionIridescence: 0.0,
    convexityFactor: 1.0,
    concavityFactor: 1.0,
    peaksFactor: 1.0,
    fringeCurve: 5.0,
    fringeMix: 1.0,
    colorBoost: 2.0,
    colorFactor: 2.0,
    colorCurve: 1.5,
    colorCurveR: 1.0,
    colorCurveG: 1.0,
    colorCurveB: 1.0,
    maxColorValue: 25.0,
    decayFactor: 20.0,
  },
  hovers: [
    {
      baseColor: '#fbe687',
      peaksColor: '#f8ecde',
      fringeColor: '#f6eedb',
      resetDistances: 0.33,
      distancesFactor: 22.22,
      iorStart: 1.3,
      iorDelta: 0.33,
      uvShiftFactor: 1.8,
      envReflection: 0.22,
      envRefraction: 0.72,
      reflectionIridescence: 0.16,
      refractionIridescence: 0.95,
      convexityFactor: 0.72,
      concavityFactor: 0.52,
      peaksFactor: 0.84,
      fringeCurve: 3.23,
      fringeMix: 0.83,
      colorBoost: 0.04,
      colorFactor: 2.58,
      colorCurve: 1.37,
      colorCurveR: 1.0,
      colorCurveG: 1.11,
      colorCurveB: 1.11,
      maxColorValue: 50.0,
      decayFactor: 250.0,
    },
    {
      baseColor: '#87acfb',
      peaksColor: '#f8ecde',
      fringeColor: '#f6eedb',
      resetDistances: 0.33,
      distancesFactor: 22.0,
      iorStart: 1.3,
      iorDelta: 0.33,
      uvShiftFactor: 1.8,
      envReflection: 0.22,
      envRefraction: 0.72,
      reflectionIridescence: 0.15,
      refractionIridescence: 0.95,
      convexityFactor: 0.72,
      concavityFactor: 0.52,
      peaksFactor: 0.84,
      fringeCurve: 3.23,
      fringeMix: 0.83,
      colorBoost: 0.04,
      colorFactor: 2.58,
      colorCurve: 1.37,
      colorCurveR: 1.0,
      colorCurveG: 1.11,
      colorCurveB: 1.11,
      maxColorValue: 50.0,
      decayFactor: 250.0,
    },
    {
      baseColor: '#c2fac9',
      peaksColor: '#fef4f9',
      fringeColor: '#cbf7e7',
      distancesFactor: 15.0,
      iorStart: 1.33,
      iorDelta: 3.0,
      uvShiftFactor: 3.0,
      envReflection: 1.0,
      envRefraction: 0.88,
      reflectionIridescence: 0.47,
      refractionIridescence: 0.8,
      convexityFactor: 1.0,
      concavityFactor: 0.55,
      peaksFactor: 0.58,
      fringeCurve: 2.5,
      fringeMix: 0.7,
      colorBoost: 0.27,
      colorFactor: 2.5,
      colorCurve: 1.8,
      colorCurveR: 1.2,
      colorCurveG: 0.99,
      colorCurveB: 0.92,
      maxColorValue: 65.0,
      decayFactor: 500.0,
    },
    {
      baseColor: '#ffb0fa',
      peaksColor: '#e7e2ff',
      fringeColor: '#d6e1fc',
      resetDistances: 0.0,
      distancesFactor: 6.0,
      iorStart: 1.65,
      iorDelta: 5.0,
      uvShiftFactor: 2.14,
      envReflection: 0.8,
      envRefraction: 0.75,
      reflectionIridescence: 0.85,
      refractionIridescence: 0.75,
      convexityFactor: 0.22,
      concavityFactor: 0.67,
      peaksFactor: 2.67,
      fringeCurve: 4.8,
      fringeMix: 0.63,
      colorBoost: 0.5,
      colorFactor: 2.0,
      colorCurve: 0.72,
      colorCurveR: 1.14,
      colorCurveG: 1.11,
      colorCurveB: 1.16,
      maxColorValue: 100.0,
      decayFactor: 500.0,
    },
    {
      baseColor: '#cbddd9',
      peaksColor: '#f9cfe5',
      fringeColor: '#cdd3db',
      resetDistances: 0.0,
      distancesFactor: 4.35,
      iorStart: 1.98,
      iorDelta: 4.0,
      uvShiftFactor: 5.0,
      envReflection: 0.52,
      envRefraction: 0.49,
      reflectionIridescence: 0.5,
      refractionIridescence: 0.17,
      convexityFactor: 0.01,
      concavityFactor: 0.7,
      peaksFactor: 1.2,
      fringeCurve: 2.22,
      fringeMix: 0.65,
      colorBoost: 1.33,
      colorFactor: 2.0,
      colorCurve: 0.45,
      colorCurveR: 1.07,
      colorCurveG: 1.37,
      colorCurveB: 0.94,
      maxColorValue: 35.0,
      decayFactor: 50.0,
    },
    {
      baseColor: '#4edbef',
      peaksColor: '#c2c0ff',
      fringeColor: '#fcfcfc',
      resetDistances: 0.0,
      distancesFactor: 6.0,
      iorStart: 1.22,
      iorDelta: 5.0,
      uvShiftFactor: 1.0,
      envReflection: 0.68,
      envRefraction: 0.34,
      reflectionIridescence: 0.38,
      refractionIridescence: 0.22,
      convexityFactor: 0.21,
      concavityFactor: 0.55,
      peaksFactor: 2.34,
      fringeCurve: 3.02,
      fringeMix: 0.68,
      colorBoost: 0.3,
      colorFactor: 2.0,
      colorCurve: 1.24,
      colorCurveR: 0.28,
      colorCurveG: 1.52,
      colorCurveB: 1.04,
      maxColorValue: 100.0,
      decayFactor: 350.0,
    },
    {
      baseColor: '#cef1e2',
      peaksColor: '#e4daff',
      fringeColor: '#d6efe2',
      resetDistances: 0.0,
      distancesFactor: 24.0,
      iorStart: 1.5,
      iorDelta: 0.5,
      uvShiftFactor: 2.86,
      envReflection: 0.21,
      envRefraction: 0.95,
      reflectionIridescence: 0.9,
      refractionIridescence: 0.88,
      convexityFactor: 0.73,
      concavityFactor: 0.56,
      peaksFactor: 1.77,
      fringeCurve: 4.51,
      fringeMix: 0.71,
      colorBoost: 0.14,
      colorFactor: 2.58,
      colorCurve: 1.16,
      colorCurveR: 1.05,
      colorCurveG: 1.09,
      colorCurveB: 0.93,
      maxColorValue: 100.0,
      decayFactor: 450.0,
    },
  ],
};
