import * as THREE from 'three';

// A velocity/pressure/dye simulation, rather than a blurred cursor stamp.
// The equations are the usual semi-Lagrangian incompressible fluid steps.
// Two dye channels carry the impulse direction; their ridges form the optical wake.
const vertex = /* glsl */ `
varying vec2 uv0;
void main() { uv0 = uv; gl_Position = vec4(position.xy, 0., 1.); }
`;
const common = /* glsl */ `
varying vec2 uv0;
uniform sampler2D source;
uniform sampler2D velocity;
uniform sampler2D field;
uniform vec2 pixel;
uniform vec2 point;
uniform vec2 oldPoint;
uniform vec3 impulse;
uniform float aspect;
uniform float dissipation;
uniform float dt;
`;
const fragments = {
  splat: `
    vec2 p = uv0 * vec2(aspect, 1.);
    vec2 a = oldPoint * vec2(aspect, 1.);
    vec2 b = point * vec2(aspect, 1.);
    vec2 line = b - a;
    float t = clamp(dot(p - a, line) / max(dot(line, line), .000001), 0., 1.);
    vec2 q = p - mix(a, b, t);
    float stamp = exp(-dot(q, q) / .00055);
    gl_FragColor = vec4(texture2D(source, uv0).xyz + impulse * stamp, 1.);
  `,
  curl: `
    float l = texture2D(velocity, uv0 - vec2(pixel.x, 0.)).y;
    float r = texture2D(velocity, uv0 + vec2(pixel.x, 0.)).y;
    float b = texture2D(velocity, uv0 - vec2(0., pixel.y)).x;
    float t = texture2D(velocity, uv0 + vec2(0., pixel.y)).x;
    gl_FragColor = vec4(.5 * (r - l - t + b), 0., 0., 1.);
  `,
  vorticity: `
    float l = abs(texture2D(field, uv0 - vec2(pixel.x, 0.)).x);
    float r = abs(texture2D(field, uv0 + vec2(pixel.x, 0.)).x);
    float b = abs(texture2D(field, uv0 - vec2(0., pixel.y)).x);
    float t = abs(texture2D(field, uv0 + vec2(0., pixel.y)).x);
    float c = texture2D(field, uv0).x;
    vec2 force = .5 * vec2(t - b, l - r);
    force *= 10. * c / (length(force) + .0001);
    vec2 v = texture2D(velocity, uv0).xy + dt * force;
    gl_FragColor = vec4(clamp(v, -1200., 1200.), 0., 1.);
  `,
  divergence: `
    vec2 c = texture2D(velocity, uv0).xy;
    float l = texture2D(velocity, uv0 - vec2(pixel.x, 0.)).x;
    float r = texture2D(velocity, uv0 + vec2(pixel.x, 0.)).x;
    float b = texture2D(velocity, uv0 - vec2(0., pixel.y)).y;
    float t = texture2D(velocity, uv0 + vec2(0., pixel.y)).y;
    if (uv0.x < pixel.x) l = -c.x;
    if (uv0.x > 1. - pixel.x) r = -c.x;
    if (uv0.y < pixel.y) b = -c.y;
    if (uv0.y > 1. - pixel.y) t = -c.y;
    gl_FragColor = vec4(.5 * (r - l + t - b), 0., 0., 1.);
  `,
  clear: `gl_FragColor = texture2D(source, uv0) * .99;`,
  pressure: `
    float l = texture2D(source, uv0 - vec2(pixel.x, 0.)).x;
    float r = texture2D(source, uv0 + vec2(pixel.x, 0.)).x;
    float b = texture2D(source, uv0 - vec2(0., pixel.y)).x;
    float t = texture2D(source, uv0 + vec2(0., pixel.y)).x;
    gl_FragColor = vec4((l + r + b + t - texture2D(field, uv0).x) * .25, 0., 0., 1.);
  `,
  project: `
    float l = texture2D(field, uv0 - vec2(pixel.x, 0.)).x;
    float r = texture2D(field, uv0 + vec2(pixel.x, 0.)).x;
    float b = texture2D(field, uv0 - vec2(0., pixel.y)).x;
    float t = texture2D(field, uv0 + vec2(0., pixel.y)).x;
    gl_FragColor = vec4(texture2D(velocity, uv0).xy - vec2(r - l, t - b), 0., 1.);
  `,
  advect: `
    vec2 back = uv0 - dt * texture2D(velocity, uv0).xy * pixel;
    gl_FragColor = texture2D(source, clamp(back, vec2(0.), vec2(1.))) * dissipation;
  `,
  normal: `
    float c = length(texture2D(source, uv0).xy);
    float r = length(texture2D(source, uv0 + vec2(pixel.x, 0.)).xy);
    float t = length(texture2D(source, uv0 + vec2(0., pixel.y)).xy);
    vec3 n = normalize(vec3((c - r) * .018, (c - t) * .018, 1.));
    gl_FragColor = vec4(n * .5 + .5, 1.);
  `,
};

export function createCrystalFluid(renderer: THREE.WebGLRenderer) {
  const supported = renderer.extensions.has('EXT_color_buffer_float');
  const neutral = new THREE.DataTexture(
    new Uint8Array([128, 128, 255, 255]),
    1,
    1,
  );
  neutral.needsUpdate = true;
  const uniforms = {
    source: { value: null as THREE.Texture | null },
    velocity: { value: null as THREE.Texture | null },
    field: { value: null as THREE.Texture | null },
    pixel: { value: new THREE.Vector2(1, 1) },
    point: { value: new THREE.Vector2() },
    oldPoint: { value: new THREE.Vector2() },
    impulse: { value: new THREE.Vector3() },
    aspect: { value: 1 },
    dt: { value: 1 / 60 },
    dissipation: { value: 0.99 },
  };
  const materials = Object.fromEntries(
    Object.entries(fragments).map(([key, fragment]) => [
      key,
      new THREE.ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: common + `void main() { ${fragment} }`,
        uniforms,
        depthTest: false,
        depthWrite: false,
      }),
    ]),
  ) as Record<keyof typeof fragments, THREE.ShaderMaterial>;
  const geometry = new THREE.PlaneGeometry(2, 2);
  const mesh = new THREE.Mesh(geometry, materials.splat);
  const scene = new THREE.Scene();
  scene.add(mesh);
  const camera = new THREE.Camera();
  const targets: THREE.WebGLRenderTarget[] = [];
  function target() {
    const rt = new THREE.WebGLRenderTarget(1, 1, {
      type: supported ? THREE.HalfFloatType : THREE.UnsignedByteType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: false,
    });
    targets.push(rt);
    return rt;
  }
  function pair() {
    return {
      read: target(),
      write: target(),
      swap() {
        [this.read, this.write] = [this.write, this.read];
      },
    };
  }
  const velocity = pair(),
    dye = pair(),
    pressure = pair();
  const curl = target(),
    divergence = target(),
    normal = target();
  let width = 1,
    height = 1,
    accumulator = 0,
    age = 10;
  let previous: THREE.Vector2 | null = null;
  const old = new THREE.Vector2(),
    current = new THREE.Vector2();
  function pass(name: keyof typeof fragments, out: THREE.WebGLRenderTarget) {
    mesh.material = materials[name];
    renderer.setRenderTarget(out);
    renderer.render(scene, camera);
  }
  function resize(w: number, h: number) {
    if (!supported) return;
    // Approximately 130k simulation pixels; twice the resolution for optical ridges.
    const scale = Math.min(0.6, Math.sqrt(131072 / (w * h)));
    width = Math.max(2, Math.round(w * scale));
    height = Math.max(2, Math.round(h * scale));
    uniforms.aspect.value = w / h;
    for (const rt of targets) {
      const high = rt === dye.read || rt === dye.write || rt === normal;
      rt.setSize(width * (high ? 2 : 1), height * (high ? 2 : 1));
      renderer.setRenderTarget(rt);
      renderer.setClearColor(0, 0);
      renderer.clear();
    }
    renderer.setRenderTarget(null);
    previous = null;
    accumulator = 0;
    age = 10;
  }
  function update(dt: number, x: number, y: number, active: boolean) {
    if (!supported) return;
    current.set(x, y);
    if (!active) previous = null;
    old.copy(previous ?? current);
    const moved = active && current.distanceToSquared(old) > 1e-9;
    if (moved) age = 0;
    else age += dt;
    if (age > 8) {
      previous = active ? current.clone() : null;
      return;
    }
    accumulator = Math.min(accumulator + dt, 3 / 60);
    const steps = Math.floor((accumulator + 1e-8) * 60);
    if (!steps) return;
    uniforms.pixel.value.set(1 / width, 1 / height);
    for (let i = 0; i < steps; i++) {
      if (moved) {
        uniforms.oldPoint.value.copy(old).lerp(current, i / steps);
        uniforms.point.value.copy(old).lerp(current, (i + 1) / steps);
        const dx = ((current.x - old.x) * 7500) / steps;
        const dy = ((current.y - old.y) * 7500) / steps;
        uniforms.impulse.value.set(dx, dy, 1).clampLength(0, 1100);
        uniforms.source.value = velocity.read.texture;
        pass('splat', velocity.write);
        velocity.swap();
        uniforms.source.value = dye.read.texture;
        pass('splat', dye.write);
        dye.swap();
      }
      uniforms.velocity.value = velocity.read.texture;
      pass('curl', curl);
      uniforms.field.value = curl.texture;
      pass('vorticity', velocity.write);
      velocity.swap();
      uniforms.velocity.value = velocity.read.texture;
      pass('divergence', divergence);
      uniforms.source.value = pressure.read.texture;
      pass('clear', pressure.write);
      pressure.swap();
      uniforms.field.value = divergence.texture;
      for (let j = 0; j < 4; j++) {
        uniforms.source.value = pressure.read.texture;
        pass('pressure', pressure.write);
        pressure.swap();
      }
      uniforms.field.value = pressure.read.texture;
      pass('project', velocity.write);
      velocity.swap();
      uniforms.velocity.value = velocity.read.texture;
      uniforms.source.value = velocity.read.texture;
      uniforms.dissipation.value = 0.99;
      pass('advect', velocity.write);
      velocity.swap();
      uniforms.velocity.value = velocity.read.texture;
      uniforms.source.value = dye.read.texture;
      uniforms.dissipation.value = 0.97;
      pass('advect', dye.write);
      dye.swap();
    }
    uniforms.source.value = dye.read.texture;
    uniforms.pixel.value.set(1 / (width * 2), 1 / (height * 2));
    pass('normal', normal);
    accumulator -= steps / 60;
    previous = active ? current.clone() : null;
  }
  return {
    resize,
    update,
    get texture() {
      return supported ? normal.texture : neutral;
    },
    get strength() {
      return supported ? Math.max(0, Math.min(1, (8 - age) / 2)) : 0;
    },
    get pixel() {
      return new THREE.Vector2(1 / (width * 2), 1 / (height * 2));
    },
    dispose() {
      targets.forEach((rt) => rt.dispose());
      Object.values(materials).forEach((material) => material.dispose());
      geometry.dispose();
      neutral.dispose();
      scene.clear();
    },
  };
}
