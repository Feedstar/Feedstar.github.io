/** Math shared by the document renderer and its motion checks. No DOM or WebGL. */

export const DOCUMENT_CAMERA_Z = 2000;
export const DOCUMENT_PLANE_Z = 1000;
export const DOCUMENT_IMAGE_RATIO = 820 / 430;

/** @param {number} value @param {number} low @param {number} high */
export function clampDocument(value, low, high) {
  return Math.max(low, Math.min(high, value));
}

/** @param {number} low @param {number} high @param {number} value */
export function documentSmoothstep(low, high, value) {
  const amount = clampDocument((value - low) / (high - low), 0, 1);
  return amount * amount * (3 - 2 * amount);
}

/**
 * The reference's 0.05-per-frame follow, made independent of refresh rate.
 * This is an exponential follow, without spring overshoot or a second velocity.
 * @param {number} current
 * @param {number} target
 * @param {number} deltaSeconds
 * @param {number} [rateAt60Hz]
 */
export function dampDocumentScroll(
  current,
  target,
  deltaSeconds,
  rateAt60Hz = 0.05,
) {
  if (!Number.isFinite(current)) return Number.isFinite(target) ? target : 0;
  if (!Number.isFinite(target)) return current;
  const elapsed = Number.isFinite(deltaSeconds) ? Math.max(0, deltaSeconds) : 0;
  const rate = clampDocument(rateAt60Hz, 0, 1);
  return current + (target - current) * (1 - Math.pow(1 - rate, elapsed * 60));
}

/** @param {number} width @param {number} height */
export function documentBendRange(width, height) {
  if (width >= 1024)
    return { start: (100 * height) / 1100, end: (700 * height) / 1100 };
  return { start: 100, end: width >= 768 ? 500 : 600 };
}

/**
 * @typedef {{x:number,y:number,z:number,ripple:number,opacity:number,fog:number}} DocumentVertex
 */

/**
 * A continuous field: vertices rise into a curl, retreat, and fade with depth.
 * x/y are the vertex's UNDEFORMED world position. A world unit is half a CSS px
 * at the flat card plane. imageHeight is in world units, including for captions.
 * The optional output object avoids allocating for every vertex on every frame.
 * @param {number} x
 * @param {number} y
 * @param {number} time
 * @param {number} imageHeight
 * @param {{start:number,end:number}} bend
 * @param {DocumentVertex} [out]
 * @returns {DocumentVertex}
 */
export function bendDocumentVertex(x, y, time, imageHeight, bend, out) {
  const result = out || { x: 0, y: 0, z: 0, ripple: 0, opacity: 0, fog: 0 };
  const retreat = documentSmoothstep(bend.start, bend.end, y);
  const fold = documentSmoothstep(bend.start * 1.1, bend.end * 0.7, y);
  const ripple = Math.sin((x - y) * 0.02 - time * 2) * 12;
  const depthWave =
    Math.sin((x - y * 0.1) * 0.03 - time * 1.1 + Math.cos(40) * 10) * 50;
  const foldWave = Math.sin((x + y * 0.1) * 0.01 - time * 0.4) * 0.5;
  result.x = x;
  result.y = y - imageHeight * (1.5 - foldWave) * fold;
  result.z = DOCUMENT_PLANE_Z + ripple - (1200 + depthWave) * retreat;
  result.ripple = ripple;
  const depth = DOCUMENT_CAMERA_Z - result.z;
  result.opacity = 1 - documentSmoothstep(1500, 2000, depth);
  result.fog = documentSmoothstep(500, 4500, depth);
  return result;
}

/**
 * The same perspective as the renderer, expressed in canvas-local CSS pixels.
 * @param {{x:number,y:number,z:number}} vertex
 * @param {number} width
 * @param {number} height
 */
export function projectDocumentVertex(vertex, width, height) {
  const scale = DOCUMENT_CAMERA_Z / (DOCUMENT_CAMERA_Z - vertex.z);
  return { x: width / 2 + vertex.x * scale, y: height / 2 - vertex.y * scale };
}

/** @typedef {{x:number,y:number}} DocumentPoint */

/** @param {DocumentPoint} a @param {DocumentPoint} b @param {DocumentPoint} c */
function cross(a, b, c) {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

/** @param {DocumentPoint[]} points @returns {DocumentPoint[]} */
export function documentConvexHull(points) {
  if (points.length < 3) return points.slice();
  const sorted = points.slice().sort((a, b) => a.x - b.x || a.y - b.y);
  /** @type {DocumentPoint[]} */
  const lower = [];
  /** @type {DocumentPoint[]} */
  const upper = [];
  for (const point of sorted) {
    while (
      lower.length > 1 &&
      cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0
    )
      lower.pop();
    lower.push(point);
  }
  for (let index = sorted.length - 1; index >= 0; index -= 1) {
    const point = sorted[index];
    while (
      upper.length > 1 &&
      cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0
    )
      upper.pop();
    upper.push(point);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

/**
 * Clip a projected hull to the visible canvas. Offscreen links have no hit area.
 * @param {DocumentPoint[]} polygon
 * @param {number} width
 * @param {number} height
 * @returns {DocumentPoint[]}
 */
export function clipDocumentPolygon(polygon, width, height) {
  let result = polygon;
  for (const edge of [0, 1, 2, 3]) {
    const input = result;
    result = [];
    if (!input.length) break;
    const axis = edge < 2 ? 'x' : 'y';
    const boundary = edge === 1 ? width : edge === 3 ? height : 0;
    const keepGreater = edge === 0 || edge === 2;
    let previous = input[input.length - 1];
    let previousInside = keepGreater
      ? previous[axis] >= boundary
      : previous[axis] <= boundary;
    for (const current of input) {
      const currentInside = keepGreater
        ? current[axis] >= boundary
        : current[axis] <= boundary;
      if (currentInside !== previousInside) {
        const amount =
          (boundary - previous[axis]) / (current[axis] - previous[axis]);
        result.push({
          x: previous.x + (current.x - previous.x) * amount,
          y: previous.y + (current.y - previous.y) * amount,
        });
      }
      if (currentInside) result.push(current);
      previous = current;
      previousInside = currentInside;
    }
  }
  return result;
}
