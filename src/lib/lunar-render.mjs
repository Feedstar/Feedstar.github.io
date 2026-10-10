// Mist is deliberately soft. Shade it in a smaller buffer while the moon and
// individual grains keep their original resolution, density and trajectories.
export function mistBufferSize(width, height, pixelRatio) {
  const scale = Math.min(
    0.5,
    Math.sqrt(700_000 / Math.max(1, width * height * pixelRatio ** 2)),
  );
  return {
    width: Math.max(1, Math.floor(width * pixelRatio * scale)),
    height: Math.max(1, Math.floor(height * pixelRatio * scale)),
  };
}
