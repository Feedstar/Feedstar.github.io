// Every occupied pixel gets a seed, including fine antialiased hairlines.
// Jitter breaks the lattice; overlapping particle footprints close its gaps.
// The high-resolution glyph mask, not sample density, defines the final edge.
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
      samples.push({
        x: x + 0.2 + random(seed ^ 0x68bc21eb) * 0.6,
        y: y + 0.2 + random(seed ^ 0x02e5be93) * 0.6,
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

// A shuffled, balanced allocation visits every ink seed before duplicating
// any region. Independent random picks leave holes in thin strokes.
export function inkAssignment(sampleCount, particleCount) {
  const order = Uint32Array.from({ length: particleCount }, (_, i) => i);
  let seed = 0xfeed57a;
  for (let i = particleCount - 1; i > 0; i--) {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    const j = (seed >>> 0) % (i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order.map((i) => Math.floor((i * sampleCount) / particleCount));
}
