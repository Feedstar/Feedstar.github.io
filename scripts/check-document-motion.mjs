import assert from 'node:assert/strict';
import {
  DOCUMENT_CAMERA_Z,
  DOCUMENT_PLANE_Z,
  DOCUMENT_IMAGE_RATIO,
  bendDocumentVertex,
  clipDocumentPolygon,
  dampDocumentScroll,
  documentBendRange,
  documentConvexHull,
  projectDocumentVertex,
} from '../src/lib/document-motion.mjs';

const close = (actual, expected, message, tolerance = 1e-8) =>
  assert(
    Math.abs(actual - expected) <= tolerance,
    `${message}: ${actual} vs ${expected}`,
  );

function follow(rate, seconds, target = 1200) {
  let position = 0;
  for (let frame = 0; frame < rate * seconds; frame += 1)
    position = dampDocumentScroll(position, target, 1 / rate);
  return position;
}

for (const seconds of [0.5, 1, 2]) {
  const expected = follow(60, seconds);
  for (const rate of [30, 120, 144])
    close(
      follow(rate, seconds),
      expected,
      'Equal elapsed time must produce equal scroll follow',
    );
}
close(
  dampDocumentScroll(dampDocumentScroll(80, 900, 0.017), 900, 0.043),
  dampDocumentScroll(80, 900, 0.06),
  'Variable frame lengths must compose without changing the scroll response',
);
let position = 0;
for (const target of [1200, 120, 900, 0]) {
  for (let frame = 0; frame < 90; frame += 1) {
    const next = dampDocumentScroll(position, target, 1 / 60);
    assert(
      next >= Math.min(position, target) - 1e-10 &&
        next <= Math.max(position, target) + 1e-10,
      'Forward and reverse scroll must approach the new target without overshoot',
    );
    assert(
      Math.abs(target - next) <= Math.abs(target - position),
      'Each frame must settle toward its current target',
    );
    position = next;
  }
}
close(
  dampDocumentScroll(42, 900, 0),
  42,
  'A zero-duration frame must not move',
);
close(
  dampDocumentScroll(42, 900, -1),
  42,
  'A stale timestamp must not run motion backwards',
);
console.log(
  'PASS: document scroll follow is refresh-independent, composes across variable frames and reverses without overshoot.',
);

const viewports = [
  [390, 844],
  [768, 1024],
  [1024, 768],
  [1440, 900],
  [1920, 1080],
];
for (const [width, height] of viewports) {
  const bend = documentBendRange(width, height);
  const imageHeight = Math.min(660, width * 0.42) / DOCUMENT_IMAGE_RATIO / 2;
  for (const x of [-width / 4, 0, width / 4]) {
    for (const y of [bend.start - 100, 0, bend.start]) {
      if (y > bend.start) continue;
      const vertex = bendDocumentVertex(x, y, 2.3, imageHeight, bend);
      close(
        vertex.x,
        x,
        'An unbent vertex must retain its horizontal position',
      );
      close(vertex.y, y, 'An unbent vertex must retain its vertical position');
      close(
        vertex.z - vertex.ripple,
        DOCUMENT_PLANE_Z,
        'The unbent surface must remain on its base plane apart from the ripple',
      );
      close(vertex.opacity, 1, 'Cards before the bend must stay opaque');
      assert(
        Math.abs(vertex.ripple) <= 12.000001,
        'The idle ripple must remain bounded',
      );
    }
    for (let y = -height; y <= height * 2; y += height / 40) {
      const vertex = bendDocumentVertex(x, y, 4.1, imageHeight, bend);
      assert(
        Object.values(vertex).every(Number.isFinite),
        'Every vertex must remain finite across the entire scroll passage',
      );
      assert(
        vertex.opacity >= 0 &&
          vertex.opacity <= 1 &&
          vertex.fog >= 0 &&
          vertex.fog <= 1,
        'Opacity and fog must stay within displayable bounds',
      );
      assert(
        DOCUMENT_CAMERA_Z - vertex.z > 900,
        'The bend must never cross the perspective camera or create a projection singularity',
      );
    }
    const far = bendDocumentVertex(x, bend.end + 200, 4.1, imageHeight, bend);
    assert(
      far.z < DOCUMENT_PLANE_Z - 1000,
      'The departing edge must retreat into depth',
    );
    close(far.opacity, 0, 'The distant edge must disappear through depth fade');
  }
  for (const boundary of [
    bend.start,
    bend.start * 1.1,
    bend.end * 0.7,
    bend.end,
  ]) {
    const before = bendDocumentVertex(
      73,
      boundary - 1e-5,
      5.2,
      imageHeight,
      bend,
    );
    const after = bendDocumentVertex(
      73,
      boundary + 1e-5,
      5.2,
      imageHeight,
      bend,
    );
    assert(
      Math.hypot(after.x - before.x, after.y - before.y, after.z - before.z) <
        0.001,
      'Crossing an entry or exit threshold must not create a geometric jump',
    );
    assert(
      Math.abs(after.opacity - before.opacity) < 0.001,
      'Depth fading must remain continuous through the bend thresholds',
    );
  }
}

const bend = documentBendRange(1440, 900);
const imageHeight = 150;
const time = 3.7;
const path = Array.from({ length: 31 }, (_, index) => index * 30);
const sample = (scroll) =>
  [-140, 0, 140].map((x) =>
    [-100, 0, 100].map((offset) =>
      bendDocumentVertex(
        x,
        -140 + scroll / 2 + offset,
        time,
        imageHeight,
        bend,
      ),
    ),
  );
const outward = path.map(sample);
path.toReversed().forEach((scroll, index) => {
  assert.deepEqual(
    sample(scroll),
    outward[path.length - 1 - index],
    'Reversing scroll at a fixed time must retrace exactly the same geometry',
  );
});
const span = [bend.start - 40, (bend.start + bend.end) / 2, bend.end + 40];
const bent = span.map((y) =>
  bendDocumentVertex(45, y, time, imageHeight, bend),
);
const cross =
  (bent[1].y - bent[0].y) * (bent[2].z - bent[0].z) -
  (bent[1].z - bent[0].z) * (bent[2].y - bent[0].y);
assert(
  Math.abs(cross) > 1000,
  'A straight line across the passage must curve; a rigid card rotation is insufficient',
);
assert(
  bent[0].opacity > bent[2].opacity,
  'Different vertices of one card must enter and leave the fade independently',
);
const still = bendDocumentVertex(45, 0, 0, imageHeight, bend);
const later = bendDocumentVertex(45, 0, 0.6, imageHeight, bend);
assert(
  Math.abs(still.z - later.z) > 0.1,
  'The subtle surface ripple must remain alive while scroll position is held',
);
console.log(
  'PASS: flat entry, bounded idle ripple, per-vertex curl, depth fade and position-reversible geometry across phone, tablet and desktop sizes.',
);

const area = (polygon) =>
  Math.abs(
    polygon.reduce((total, point, index) => {
      const next = polygon[(index + 1) % polygon.length];
      return total + point.x * next.y - next.x * point.y;
    }, 0) / 2,
  );
for (const [width, height] of viewports) {
  for (const [pixelX, pixelY] of [
    [0, 0],
    [width, 0],
    [width, height],
    [0, height],
    [width * 0.37, height * 0.61],
  ]) {
    const projected = projectDocumentVertex(
      {
        x: (pixelX - width / 2) / 2,
        y: (height / 2 - pixelY) / 2,
        z: DOCUMENT_PLANE_Z,
      },
      width,
      height,
    );
    close(
      projected.x,
      pixelX,
      'Flat mesh and native link must agree on horizontal CSS pixels',
    );
    close(
      projected.y,
      pixelY,
      'Flat mesh and native link must agree on vertical CSS pixels',
    );
  }
  const cover = [
    { x: -40, y: -40 },
    { x: width + 40, y: -40 },
    { x: width + 40, y: height + 40 },
    { x: -40, y: height + 40 },
  ];
  close(
    area(clipDocumentPolygon(cover, width, height)),
    width * height,
    'A hull covering the viewport must clip to the complete viewport',
    1e-5,
  );
  assert.equal(
    clipDocumentPolygon(
      [
        { x: -100, y: -100 },
        { x: -20, y: -100 },
        { x: -20, y: -20 },
      ],
      width,
      height,
    ).length,
    0,
    'Fully offscreen geometry must not leave a clickable polygon',
  );
  const range = documentBendRange(width, height);
  for (const scroll of [0, height * 0.4, height, height * 2]) {
    const points = [];
    for (let column = 0; column <= 12; column += 1) {
      for (let row = 0; row <= 12; row += 1) {
        const vertex = bendDocumentVertex(
          (column / 12 - 0.5) * width * 0.45,
          (row / 12 - 0.5) * height * 0.7 + scroll / 2,
          2.8,
          imageHeight,
          range,
        );
        if (vertex.opacity > 0.025)
          points.push(projectDocumentVertex(vertex, width, height));
      }
    }
    const clipped = clipDocumentPolygon(
      documentConvexHull(points),
      width,
      height,
    );
    for (const point of clipped) {
      assert(
        Number.isFinite(point.x) && Number.isFinite(point.y),
        'Link polygon coordinates must remain finite',
      );
      assert(
        point.x >= -1e-8 &&
          point.x <= width + 1e-8 &&
          point.y >= -1e-8 &&
          point.y <= height + 1e-8,
        'Hit areas must be clipped to the visible canvas',
      );
    }
    assert(
      area(clipped) <= width * height + 1e-5,
      'The clipped hit area cannot exceed the viewport',
    );
  }
}
assert.deepEqual(
  clipDocumentPolygon(documentConvexHull([]), 390, 844),
  [],
  'An empty field must have no active hit polygon',
);
console.log(
  'PASS: perspective matches native CSS coordinates, offscreen polygons disappear and all projected hit regions stay finite and inside the viewport.',
);

// Use the actual canvas AFTER mobile navigation and filters, not window height.
for (const [width, height] of [
  [320, 310],
  [390, 590],
  [430, 680],
  [768, 720],
]) {
  const bend = documentBendRange(width, height);
  const imageHeight = (width - 48) / DOCUMENT_IMAGE_RATIO / 2;
  let visibleCurl = false;
  for (let y = height * 0.15; y <= height * 0.65; y += 2) {
    const vertex = bendDocumentVertex(width / 8, y, 2.3, imageHeight, bend);
    const screen = projectDocumentVertex(vertex, width, height);
    if (
      screen.y > 0 &&
      screen.y < height &&
      vertex.opacity > 0.3 &&
      vertex.z < DOCUMENT_PLANE_Z - 250 &&
      y - vertex.y > imageHeight * 0.5
    )
      visibleCurl = true;
  }
  assert(
    visibleCurl,
    'Phones must show a substantial curved/retreating edge inside the visible canvas',
  );
}
console.log(
  'PASS: mobile document curl remains visible below the toolbar, including short screens.',
);
