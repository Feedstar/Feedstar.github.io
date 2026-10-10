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

// CPU reference for the shader field: scroll controls the shape, time supplies
// bounded continuous advection. No accumulated simulation can diverge on rewind.
export function lunarParticle(position, seed, progress, time, ambient = false) {
  const erosion = progress * lunarTiming.erosionScale;
  const threshold = erosionThreshold(...position, seed);
  const release = ambient
    ? 1
    : smoothstep(threshold - 0.075, threshold + 0.035, erosion);
  const phase = seed + time * (0.026 + seed * 0.012);
  const life = phase - Math.floor(phase);
  const age = Math.max(0, erosion - threshold);
  const travel =
    (0.04 + life ** 1.4 * (0.75 + seed * 0.65) + age * 0.8) * release;
  const p = [...position];
  p[0] -= travel;
  p[1] +=
    travel *
    (0.06 + Math.sin(position[1] * 8 + travel * 2 + time * 0.22) * 0.065);
  p[2] += (seed - 0.5) * travel * 0.18;
  const gather = smoothstep(
    lunarTiming.gatherStart + seed * 0.1,
    lunarTiming.gatherEnd + seed * 0.03,
    progress,
  );
  const lifeAlpha = smoothstep(0, 0.06, life) * (1 - smoothstep(0.72, 1, life));
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
  float life=fract(seed+time*(.026+seed*.012));
  float age=max(0.,progress*${lunarTiming.erosionScale}-threshold);
  float travel=(.04+pow(life,1.4)*(.75+seed*.65)+age*.8)*release;
  vec3 moved=p;
  moved.x-=travel;
  moved.y+=travel*(.06+sin(p.y*8.+travel*2.+time*.22)*.065);
  moved.z+=(seed-.5)*travel*.18;
  lifeAlpha=smoothstep(0.,.06,life)*(1.-smoothstep(.72,1.,life));
  return moved;
}
float gatherAt(float progress, float seed) {
  return smoothstep(${lunarTiming.gatherStart}+seed*.10,${lunarTiming.gatherEnd}+seed*.03,progress);
}
float handoffAt(float progress) {
  return smoothstep(${lunarTiming.handoffStart},${lunarTiming.handoffEnd},progress);
}`;
