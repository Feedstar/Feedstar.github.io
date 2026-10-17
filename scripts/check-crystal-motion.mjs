import assert from 'node:assert/strict';
// These tests intentionally isolate scroll/hover from the perpetual idle layer.
// Its time-based drift and cover containment are covered by check-crystal-idle.mjs.
import {
  stepSpring,
  crystalCenter,
  crystalPose,
  convexHull,
  clipPolygon,
} from '../src/lib/crystal-motion.mjs';

const close = (actual, expected, message, tolerance = 1e-8) =>
  assert(
    Math.abs(actual - expected) <= tolerance,
    `${message}: ${actual} vs ${expected}`,
  );
const configurations = [
  [20, 10],
  [20, 2 * Math.sqrt(20)],
  [20, 2],
];
const response = (hz, seconds, stiffness, damping) => {
  const state = { value: -0.2, velocity: 0.3 };
  for (let frame = 0; frame < Math.round(hz * seconds); frame += 1)
    stepSpring(state, 1, 1 / hz, stiffness, damping);
  return state;
};

for (const [stiffness, damping] of configurations) {
  for (const seconds of [0.5, 1, 2]) {
    const expected = response(60, seconds, stiffness, damping);
    for (const hz of [30, 120, 144]) {
      const actual = response(hz, seconds, stiffness, damping);
      close(
        actual.value,
        expected.value,
        'Equal elapsed time must give the same crystal hover displacement',
      );
      close(
        actual.velocity,
        expected.velocity,
        'Equal elapsed time must retain the same hover velocity',
      );
    }
  }
  const state = { value: -0.2, velocity: 0.3 };
  let energy = (state.velocity ** 2 + stiffness * (state.value - 1) ** 2) / 2;
  for (let frame = 0; frame < 480; frame += 1) {
    stepSpring(state, 1, 1 / 60, stiffness, damping);
    const nextEnergy =
      (state.velocity ** 2 + stiffness * (state.value - 1) ** 2) / 2;
    assert(
      nextEnergy <= energy + 1e-10,
      'A passive damped hover spring must dissipate energy, including when underdamped',
    );
    assert(
      Number.isFinite(state.value) && Number.isFinite(state.velocity),
      'All spring regimes must stay finite',
    );
    energy = nextEnergy;
  }
}
const steady = { value: 0, velocity: 0 };
let previous = 0;
for (let frame = 0; frame < 600; frame += 1) {
  stepSpring(steady, 1, 1 / 60);
  assert(
    steady.value >= previous - 1e-10 && steady.value <= 1 + 1e-10,
    'The default overdamped hover must approach its target without overshoot',
  );
  previous = steady.value;
}
close(steady.value, 1, 'Hover must settle at its optical target');
close(
  steady.velocity,
  0,
  'A settled optical target must have no residual velocity',
);

const reversed = { value: 0, velocity: 0 };
for (let frame = 0; frame < 12; frame += 1) stepSpring(reversed, 1, 1 / 60);
const interruption = { ...reversed };
stepSpring(reversed, 0, 1e-8);
close(
  reversed.value,
  interruption.value,
  'Pointer exit must preserve the current position at interruption',
  1e-6,
);
close(
  reversed.velocity,
  interruption.velocity,
  'Pointer exit must preserve moving velocity at interruption',
  1e-6,
);
for (let frame = 0; frame < 600; frame += 1) stepSpring(reversed, 0, 1 / 60);
close(reversed.value, 0, 'Pointer exit must restore the resting material');
close(reversed.velocity, 0, 'The reverse transition must settle');

const longPause = { value: 0.3, velocity: -0.2 };
const boundedPause = { ...longPause };
stepSpring(longPause, 1, 3600);
stepSpring(boundedPause, 1, 0.1);
assert.deepEqual(
  longPause,
  boundedPause,
  'Resuming after a hidden tab must limit integration to one bounded step',
);
for (const dt of [0, -1, NaN, Infinity]) {
  const state = { value: 0.3, velocity: -0.2 };
  stepSpring(state, 1, dt);
  assert.deepEqual(
    state,
    { value: 0.3, velocity: -0.2 },
    'Invalid or stale timestamps must not move the spring',
  );
}
console.log(
  'PASS: crystal hover springs agree across 30/60/120/144 Hz, dissipate energy, preserve interrupted velocity and resume safely after suspension.',
);

const layouts = [
  {
    width: 390,
    height: 844,
    cardSize: 304.2,
    gap: 32,
    rowGap: 100,
    startY: 489.52,
    columns: 1,
  },
  {
    width: 767,
    height: 540,
    cardSize: 300,
    gap: 32,
    rowGap: 100,
    startY: 345,
    columns: 1,
  },
  {
    width: 768,
    height: 540,
    cardSize: 291.84,
    gap: 32,
    rowGap: -110.8992,
    startY: 340.92,
    columns: 2,
  },
  {
    width: 1440,
    height: 900,
    cardSize: 547.2,
    gap: 32,
    rowGap: -207.936,
    startY: 522,
    columns: 2,
  },
  {
    width: 1920,
    height: 1080,
    cardSize: 600,
    gap: 32,
    rowGap: -228,
    startY: 626.4,
    columns: 2,
  },
];
const dot = (a, b) =>
  a.reduce((sum, value, index) => sum + value * b[index], 0);
// Rotate independent basis points with a unit quaternion to test finite, rigid
// transforms. The hull checks below then use these actual rotated coordinates.
function rotate([x, y, z], [qx, qy, qz, qw]) {
  const tx = 2 * (qy * z - qz * y);
  const ty = 2 * (qz * x - qx * z);
  const tz = 2 * (qx * y - qy * x);
  return [
    x + qw * tx + qy * tz - qz * ty,
    y + qw * ty + qz * tx - qx * tz,
    z + qw * tz + qx * ty - qy * tx,
  ];
}
for (const layout of layouts) {
  const step = layout.cardSize + layout.rowGap;
  assert(
    step > 0,
    'Every visible order must advance along the native scroll runway',
  );
  for (const count of [1, 3, 4, 11]) {
    const travel = (count - 1) * step;
    close(
      crystalCenter(count - 1, layout, travel).y,
      layout.startY,
      'The last crystal must reach the same readable centre as the first',
    );
    for (let order = 0; order < count; order += 1) {
      const centered = crystalCenter(order, layout, order * step);
      close(
        centered.y,
        layout.startY,
        'Keyboard focus must centre each visible order at its own scroll stop',
      );
      if (layout.columns === 1)
        close(
          centered.x,
          layout.width / 2,
          'Phone crystals must remain horizontally centred',
        );
      const path = Array.from(
        { length: 41 },
        (_, index) => (travel * index) / 40,
      );
      const sample = (scroll) => {
        const center = crystalCenter(order, layout, scroll);
        return {
          center,
          pose: crystalPose(
            order,
            (layout.height / 2 - center.y) / layout.cardSize,
          ),
        };
      };
      const outward = path.map(sample);
      path
        .toReversed()
        .forEach((scroll, index) =>
          assert.deepEqual(
            sample(scroll),
            outward[path.length - 1 - index],
            'Reverse scrolling must exactly retrace crystal placement and orientation',
          ),
        );
    }
  }
}
for (let index = 0; index < 11; index += 1) {
  for (let step = 0; step <= 160; step += 1) {
    const pose = crystalPose(index, -4 + step * 0.05);
    assert(
      pose.length === 4 && pose.every(Number.isFinite),
      'Every article must have a finite quaternion throughout its passage',
    );
    close(
      Math.hypot(...pose),
      1,
      'Interpolated scroll poses must stay normalized',
    );
    const axes = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ].map((axis) => rotate(axis, pose));
    axes.forEach((axis) =>
      close(
        Math.hypot(...axis),
        1,
        'Scroll rotation must preserve shell dimensions',
      ),
    );
    close(
      dot(axes[0], axes[1]),
      0,
      'Rotated shell axes must remain orthogonal',
    );
    close(
      dot(axes[1], axes[2]),
      0,
      'Scroll interpolation must not shear the shell',
    );
  }
  for (const boundary of [-1.5, -0.75, 0, 0.75, 1.5]) {
    const a = crystalPose(index, boundary - 1e-6);
    const b = crystalPose(index, boundary + 1e-6);
    assert(
      dot(a, b) > 0.999999999,
      'Crossing a measured pose knot must not cause a visible orientation jump',
    );
  }
  assert.deepEqual(
    crystalPose(index, -100),
    crystalPose(index, -1.5),
    'Entrance rotation must stop at its supported boundary',
  );
  assert.deepEqual(
    crystalPose(index, 100),
    crystalPose(index, 1.5),
    'Exit rotation must stop at its supported boundary',
  );
}
console.log(
  'PASS: visible orders and keyboard stops agree, reverse scroll restores exact poses, and all eleven articles retain finite, continuous rigid transforms.',
);

const area = (polygon) =>
  Math.abs(
    polygon.reduce((sum, point, index) => {
      const next = polygon[(index + 1) % polygon.length];
      return sum + point[0] * next[1] - next[0] * point[1];
    }, 0),
  ) / 2;
const shell = [
  [-0.52, -0.33, -0.21],
  [0.38, -0.48, -0.17],
  [0.55, 0.22, -0.24],
  [-0.19, 0.58, -0.16],
  [-0.43, -0.37, 0.22],
  [0.42, -0.35, 0.31],
  [0.46, 0.34, 0.24],
  [-0.31, 0.49, 0.29],
];
for (const layout of layouts) {
  const { width, height, cardSize } = layout;
  for (let index = 0; index < 11; index += 1) {
    for (const relative of [-3, -1.5, -0.5, 0, 0.5, 1.5, 3]) {
      const pose = crystalPose(index, relative);
      const center = {
        x: width / 2 + (index % 2 ? 1 : -1) * width * 0.2,
        y: height / 2 - relative * cardSize,
      };
      const points = shell.map((point) => {
        const [x, y, z] = rotate(point, pose);
        const perspective = 3 / (3 - z);
        return [
          center.x + x * cardSize * perspective,
          center.y - y * cardSize * perspective,
        ];
      });
      const polygon = clipPolygon(convexHull(points), width, height);
      assert(
        area(polygon) <= width * height + 1e-6,
        'A clipped native link cannot cover more than the viewport',
      );
      polygon.forEach(([x, y]) => {
        assert(
          Number.isFinite(x) && Number.isFinite(y),
          'Every projected native-link vertex must be finite',
        );
        assert(
          x >= -1e-8 && x <= width + 1e-8 && y >= -1e-8 && y <= height + 1e-8,
          'Projected links must remain clipped to the visible stage',
        );
      });
    }
  }
  const covering = [
    [-10, -10],
    [width + 10, -10],
    [width + 10, height + 10],
    [-10, height + 10],
  ];
  close(
    area(clipPolygon(covering, width, height)),
    width * height,
    'A fully covering silhouette must clip exactly to the visible viewport',
    1e-5,
  );
  assert.equal(
    clipPolygon(
      [
        [-100, -100],
        [-20, -100],
        [-20, -20],
      ],
      width,
      height,
    ).length,
    0,
    'An offstage crystal must leave no clickable polygon',
  );
}
assert.deepEqual(
  clipPolygon(convexHull([]), 390, 844),
  [],
  'No mesh means no native hit area',
);
assert(
  convexHull([
    [0, 0],
    [1, 1],
    [2, 2],
    [1, 1],
  ]).length <= 2,
  'Duplicate collinear points must not create a fake filled hit area',
);
console.log(
  'PASS: transformed crystal silhouettes stay finite and clipped, while empty, collinear and fully offstage shapes have no filled link area.',
);
