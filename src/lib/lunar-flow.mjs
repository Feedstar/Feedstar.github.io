import { smoothstep, erosionThreshold } from './erosion.mjs';

export const lunarTiming = {
  erosionScale: 1.8,
  gatherStart: 0.5,
  gatherEnd: 0.83,
  handoffStart: 0.87,
  handoffEnd: 0.97,
};
export const arrivalOpacity = (progress) =>
  smoothstep(lunarTiming.handoffStart, lunarTiming.handoffEnd, progress);

// The opening is already weathered along the left limb. Use this contour both
// for the surface cutaway and the airborne particles' origins.
export function lunarNotch(y) {
  const latitude = Math.max(0, 1 - y * y);
  return (
    -Math.sqrt(latitude) +
    0.42 * latitude ** 0.85 +
    Math.sin(y * 6 + 0.4) * 0.045 * latitude
  );
}
export const lunarNotchGLSL = `
float notchAt(float y) {
  float latitude=max(0.,1.-y*y);
  return -sqrt(latitude)+.42*pow(latitude,.85)+sin(y*6.+.4)*.045*latitude;
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
  const taper = Math.exp(-travel * 1.2);
  const spine = -0.12 + Math.sin(travel * 1.6 - time * 0.18) * 0.05;
  p[1] = position[1] * taper + spine * (1 - taper);
  p[1] += Math.sin(seed * 24 + time * 0.55 + travel * 3) * 0.025 * (1 - taper);
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
  float taper=exp(-travel*1.2);
  float spine=-.12+sin(travel*1.6-time*.18)*.05;
  moved.y=p.y*taper+spine*(1.-taper);
  moved.y+=sin(seed*24.+time*.55+travel*3.)*.025*(1.-taper);
  moved.z+=(seed-.5)*travel*.1;
  lifeAlpha=smoothstep(0.,.045,life)*(1.-smoothstep(.48,1.,life));
  return moved;
}
float gatherAt(float progress, float seed) {
  return smoothstep(${lunarTiming.gatherStart}+seed*.10,${lunarTiming.gatherEnd}+seed*.03,progress);
}
float handoffAt(float progress) {
  return smoothstep(${lunarTiming.handoffStart},${lunarTiming.handoffEnd},progress);
}`;
