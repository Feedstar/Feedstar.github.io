// One deterministic local field drives the feathered surface and grain release.
export const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const fract = (x) => x - Math.floor(x);
const hash = (x, y, z) =>
  fract(Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453);
function noise(x, y, z) {
  const ix = Math.floor(x),
    iy = Math.floor(y),
    iz = Math.floor(z);
  const fx = fract(x),
    fy = fract(y),
    fz = fract(z),
    u = fx * fx * (3 - 2 * fx),
    v = fy * fy * (3 - 2 * fy),
    w = fz * fz * (3 - 2 * fz);
  const mix = (a, b, t) => a + (b - a) * t;
  return mix(
    mix(
      mix(hash(ix, iy, iz), hash(ix + 1, iy, iz), u),
      mix(hash(ix, iy + 1, iz), hash(ix + 1, iy + 1, iz), u),
      v,
    ),
    mix(
      mix(hash(ix, iy, iz + 1), hash(ix + 1, iy, iz + 1), u),
      mix(hash(ix, iy + 1, iz + 1), hash(ix + 1, iy + 1, iz + 1), u),
      v,
    ),
    w,
  );
}
export function erosionThreshold(x, y, z, seed = 0) {
  const regionNoise =
    (noise(x * 3.8 + 5, y * 3.8 + 2, z * 3.8 + 7) - 0.5) * 0.18;
  const detail = (noise(x * 15 + 2, y * 15 + 7, z * 15 + 1) - 0.5) * 0.1;
  const grain = (noise(x * 65, y * 65, z * 65) - 0.5) * 0.04;
  const fleck =
    (hash(Math.floor(x * 230), Math.floor(y * 230), Math.floor(z * 230)) -
      0.5) *
    0.025;
  return clamp(
    0.12 + (x + 1) * 0.27 + regionNoise + detail + grain + fleck + seed * 0.025,
    0.08,
    0.84,
  );
}
export const erosionGLSL = `
float erosionHash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
float erosionNoise(vec3 p){
 vec3 i=floor(p),f=fract(p),u=f*f*(3.-2.*f);
 return mix(mix(mix(erosionHash(i),erosionHash(i+vec3(1,0,0)),u.x),mix(erosionHash(i+vec3(0,1,0)),erosionHash(i+vec3(1,1,0)),u.x),u.y),mix(mix(erosionHash(i+vec3(0,0,1)),erosionHash(i+vec3(1,0,1)),u.x),mix(erosionHash(i+vec3(0,1,1)),erosionHash(i+vec3(1,1,1)),u.x),u.y),u.z);
}
float thresholdAt(vec3 p, float seed) {
 float regionNoise=(erosionNoise(p*3.8+vec3(5,2,7))-.5)*.18;
 float detail=(erosionNoise(p*15.+vec3(2,7,1))-.5)*.1;
 float grain=(erosionNoise(p*65.)-.5)*.04;
 float fleck=(erosionHash(floor(p*230.))-.5)*.025;
 return clamp(.12+(p.x+1.)*.27+regionNoise+detail+grain+fleck+seed*.025,.08,.84);
}`;
