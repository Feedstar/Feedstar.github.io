// Coverage-weighted, deterministic subpixel samples. Sampling every ink pixel
// with independent jitter avoids the visible lattice of a two-pixel grid.
export function sampleInk(data, width, height) {
  const samples = [];
  const random = (value) => {
    let bits = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
    bits = Math.imul(bits ^ (bits >>> 16), 0x45d9f3b);
    return ((bits ^ (bits >>> 16)) >>> 0) / 4294967296;
  };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 4;
      const coverage = data[offset + 3] / 255;
      if (!coverage) continue;
      const seed = Math.imul(x + 1, 374761393) ^ Math.imul(y + 1, 668265263);
      if (random(seed) >= coverage) continue;
      samples.push({
        x: x + random(seed ^ 0x68bc21eb),
        y: y + random(seed ^ 0x02e5be93),
        color: [
          data[offset] / 255,
          data[offset + 1] / 255,
          data[offset + 2] / 255,
        ],
      });
    }
  }
  return samples;
}
