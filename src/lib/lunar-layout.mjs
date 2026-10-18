// Fit the moon between the real header and title. Leave projection headroom:
// the front hemisphere is nearer the perspective camera than the origin.
export function mobileMoonLayout(
  width,
  height,
  headerBottom,
  copyTop,
  viewWidth,
  viewHeight,
) {
  const top = headerBottom + 24;
  const bottom = Math.max(top + 24, copyTop - 24);
  const radiusPixels = Math.min(width * 0.29, (bottom - top) * 0.5) * 0.88;
  return {
    radius: (radiusPixels / height) * viewHeight,
    x: viewWidth * 0.1,
    y: (0.5 - ((top + bottom) * 0.5) / height) * viewHeight,
  };
}
