import { smoothstep, erosionThreshold } from './erosion.mjs';

export const lunarTiming = {
  erosionScale: 1.8,
  gatherStart: 0.5,
  gatherEnd: 0.83,
  inkStart: 0.7,
  inkEnd: 0.91,
  // Ink is formed entirely by the particles. HTML takes over only after the
  // overlapping footprints have already reconstructed the complete strokes.
  handoffEnd: 0.95,
};
export const arrivalOpacity = (progress) =>
  Number(progress >= lunarTiming.handoffEnd);

export const inkFormation = (progress, seed, gather) =>
  smoothstep(
    lunarTiming.inkStart + seed * 0.07,
    lunarTiming.inkEnd - 0.03 + seed * 0.03,
    progress,
  ) * smoothstep(0.9, 1, gather);

// The opening is already weathered along the left limb. Use this contour both
// for the surface cutaway and the airborne particles' origins.
export function lunarNotch(y) {
  const latitude = Math.max(0, 1 - y * y);
  return (
    -Math.sqrt(latitude) +
    0.48 * Math.exp(-(((y + 0.1) / 0.7) ** 2)) * latitude ** 0.35 +
    Math.sin(y * 11 + 0.4) * 0.035 * latitude
  );
}
export const lunarNotchGLSL = `
float notchAt(float y) {
  float latitude=max(0.,1.-y*y);
  return -sqrt(latitude)+.48*exp(-pow((y+.1)/.7,2.))*pow(latitude,.35)+sin(y*11.+.4)*.035*latitude;
}`;

// CPU reference for the shader field: scroll controls the shape, time supplies
// bounded continuous advection. No accumulated simulation can diverge on rewind.
export function lunarParticle(position, seed, progress, time, ambient = false) {
  const erosion = progress * lunarTiming.erosionScale;
  const threshold = erosionThreshold(...position, seed);
  const release = ambient
    ? 1
    : smoothstep(threshold - 0.075, threshold + 0.035, erosion);
  const phase = seed + time * (0.045 + seed * 0.014);
  const life = phase - Math.floor(phase);
  const age = Math.max(0, erosion - threshold);
  const travel =
    (0.035 + life * (1.95 + seed * 0.7) + age * 0.8) *
    release *
    (0.72 + 0.28 * Math.sqrt(Math.max(0, 1 - position[1] * position[1])));
  const p = [...position];
  p[0] -= travel;
  // A broad fan drifts left and slightly down. Individual streamlines retain
  // different widths instead of all collapsing onto a single central spine.
  const taper = Math.exp(-travel * (0.59 + Math.sin(seed * 65) * 0.14));
  const curl = Math.sin(travel * 1.6 - time * 0.18 + position[1] * 2) * 0.055;
  p[1] = position[1] * taper - travel * 0.13 + curl * (1 - taper);
  p[1] += Math.sin(seed * 24 + time * 0.55 + travel * 3) * 0.075 * (1 - taper);
  p[2] += (seed - 0.5) * travel * 0.1;
  const gather = smoothstep(
    lunarTiming.gatherStart + seed * 0.1,
    lunarTiming.gatherEnd + seed * 0.03,
    progress,
  );
  const lifeAlpha =
    smoothstep(0, 0.045, life) * (1 - smoothstep(0.48, 1, life));
  return {
    position: p,
    release,
    lifeAlpha,
    gather,
    ink: inkFormation(progress, seed, gather),
    alpha: 1 - arrivalOpacity(progress),
  };
}

export const lunarFlowGLSL = `
float releaseAt(float threshold, float progress, float ambient) {
  return mix(smoothstep(threshold-.075,threshold+.035,progress*${lunarTiming.erosionScale}),1.,ambient);
}
vec3 windPosition(vec3 p, float seed, float progress, float time, float release, float threshold, out float lifeAlpha) {
  float life=fract(seed+time*(.045+seed*.014));
  float age=max(0.,progress*${lunarTiming.erosionScale}-threshold);
  float travel=(.035+life*(1.95+seed*.7)+age*.8)*release*(.72+.28*sqrt(max(0.,1.-p.y*p.y)));
  vec3 moved=p;
  moved.x-=travel;
  float taper=exp(-travel*(.59+sin(seed*65.)*.14));
  float curl=sin(travel*1.6-time*.18+p.y*2.)*.055;
  moved.y=p.y*taper-travel*.13+curl*(1.-taper);
  moved.y+=sin(seed*24.+time*.55+travel*3.)*.075*(1.-taper);
  moved.z+=(seed-.5)*travel*.1;
  lifeAlpha=smoothstep(0.,.045,life)*(1.-smoothstep(.48,1.,life));
  return moved;
}
float gatherAt(float progress, float seed) {
  return smoothstep(${lunarTiming.gatherStart}+seed*.10,${lunarTiming.gatherEnd}+seed*.03,progress);
}
float inkAt(float progress, float seed, float gather) {
  return smoothstep(${lunarTiming.inkStart}+seed*.07,${lunarTiming.inkEnd - 0.03}+seed*.03,progress)*smoothstep(.9,1.,gather);
}`;
