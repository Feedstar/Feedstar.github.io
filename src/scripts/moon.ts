import * as THREE from 'three';
import { erosionGLSL, clamp, smoothstep } from '../lib/erosion.mjs';

export function createMoon(canvas: HTMLCanvasElement) {
  const host = canvas.parentElement!;
  const journey = document.getElementById('orbit-journey')!;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: false,
      powerPreference: 'high-performance',
    });
  } catch {
    host.dataset.fallback = 'true';
    journey.dataset.static = 'true';
    return () => {};
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
  renderer.debug.onShaderError = () => {
    host.dataset.fallback = 'true';
    host.dataset.ready = 'false';
    journey.dataset.static = 'true';
  };
  const scene = new THREE.Scene();
  let dirty = true;
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.z = 6;
  const group = new THREE.Group();
  scene.add(group);
  const texture = new THREE.TextureLoader().load('/assets/moon.jpg', () => {
    host.dataset.ready = 'true';
    dirty = true;
  });
  texture.colorSpace = THREE.SRGBColorSpace;
  const uniforms = {
    uProgress: { value: 0 },
    uTexture: { value: texture },
    uDpr: { value: renderer.getPixelRatio() },
  };
  const surface = new THREE.ShaderMaterial({
    uniforms,
    transparent: false,
    vertexShader: `varying vec3 vPosition; varying vec2 vUv; void main(){ vPosition=position; vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform float uProgress; uniform sampler2D uTexture; varying vec3 vPosition; varying vec2 vUv; ${erosionGLSL}
    void main(){ vec3 p=normalize(vPosition); if(uProgress>thresholdAt(p,0.)) discard;
      vec3 tex=texture2D(uTexture,vUv).rgb; float lum=dot(tex,vec3(.299,.587,.114));
      float light=.16+.86*pow(max(0.,dot(p,normalize(vec3(-.6,.65,1.2)))),.6);
      float grain=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453);
      vec3 color=vec3(.86,.88,.82)*(pow(lum,.75)*1.12)*light + (grain-.5)*.035;
      gl_FragColor=vec4(color,1.); }`,
  });
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(1, 160, 100), surface);
  group.add(sphere);
  const count = window.innerWidth < 700 ? 70000 : 170000;
  const positions = new Float32Array(count * 3),
    uvs = new Float32Array(count * 2),
    seeds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const y = 1 - (2 * (i + 0.5)) / count,
      radius = Math.sqrt(1 - y * y),
      theta = i * 2.399963229728653;
    const x = Math.cos(theta) * radius,
      z = Math.sin(theta) * radius;
    positions.set([x, y, z], i * 3);
    uvs.set(
      [Math.atan2(z, -x) / (2 * Math.PI) + 0.5, Math.acos(-y) / Math.PI],
      i * 2,
    );
    seeds[i] = (Math.sin(i * 127.1) * 43758.5453) % 1;
    seeds[i] = Math.abs(seeds[i]);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: `uniform float uProgress; uniform float uDpr; attribute float aSeed; varying vec2 vUv; varying float vAlpha; varying float vLight; ${erosionGLSL}
      void main(){ vec3 p=position; float age=max(0.,uProgress-thresholdAt(p,aSeed)); float drift=age*(.8+aSeed*.8);
        p.x-=drift*(1.7+aSeed*.5); p.y+=drift*(.2+sin(position.y*5.+aSeed*9.)*.4); p.z+=drift*sin(position.x*4.+aSeed*7.)*.35;
        vAlpha=(1.-smoothstep(.10,.34,age))*smoothstep(-.01,.03,uProgress-thresholdAt(position,aSeed))*.9;
        vLight=.16+.86*pow(max(0.,dot(position,normalize(vec3(-.6,.65,1.2)))),.6);
        vUv=uv; vec4 mv=modelViewMatrix*vec4(p*1.002,1.);
        gl_PointSize=clamp((1.1+aSeed*.7)*uDpr*(5./-mv.z),.65,2.5); gl_Position=projectionMatrix*mv;
      }`,
    fragmentShader: `uniform sampler2D uTexture; varying vec2 vUv; varying float vAlpha; varying float vLight;
      void main(){ float radius=length(gl_PointCoord-.5); if(radius>.5)discard;
        vec3 tex=texture2D(uTexture,vUv).rgb; float lum=dot(tex,vec3(.299,.587,.114));
        gl_FragColor=vec4(vec3(.86,.88,.82)*pow(lum,.75)*1.12*vLight, vAlpha*(1.-smoothstep(.15,.5,radius))); }`,
  });
  const points = new THREE.Points(geometry, material);
  group.add(points);
  points.frustumCulled = false;
  const resize = () => {
    dirty = true;
    const w = host.clientWidth,
      h = host.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const viewH = 2 * Math.tan(THREE.MathUtils.degToRad(17.5)) * 6,
      viewW = viewH * camera.aspect;
    const mobile = w < 700;
    const radius = mobile
      ? Math.min(viewW * 0.37, viewH * 0.26)
      : Math.min(viewH * 0.35, viewW * 0.255);
    group.scale.setScalar(radius);
    group.position.set(
      mobile ? viewW * 0.12 : viewW * 0.185,
      mobile ? viewH * 0.2 : viewH * 0.015,
      0,
    );
  };
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();
  let frame = 0,
    active = true,
    visible = !document.hidden;
  let progress = 0;
  const sync = () => {
    dirty = true;
    const rect = journey.getBoundingClientRect();
    progress = clamp(-rect.top / (journey.offsetHeight - innerHeight));
    // Uniform values follow scroll directly; no momentum/smoothing delays the stopped frame.
    uniforms.uProgress.value = reduced.matches ? 0 : progress * 1.18;
    journey.style.setProperty(
      '--intro-opacity',
      String(1 - smoothstep(0.12, 0.43, progress)),
    );
    journey.style.setProperty(
      '--intro-y',
      `${reduced.matches ? 0 : -progress * 60}px`,
    );
    journey.style.setProperty(
      '--arrival-opacity',
      String(smoothstep(0.4, 0.72, progress)),
    );
    journey.style.setProperty(
      '--arrival-y',
      `${reduced.matches ? 0 : 24 * (1 - smoothstep(0.4, 0.75, progress))}px`,
    );
    canvas.style.opacity = reduced.matches
      ? String(1 - smoothstep(0.25, 0.7, progress))
      : '1';
    const arrival = document.querySelector<HTMLElement>('.arrival');
    if (arrival) {
      arrival.inert = progress < 0.55;
      arrival.setAttribute('aria-hidden', String(progress < 0.4));
    }
    const bottom = document.querySelector<HTMLElement>('.hero-bottom');
    if (bottom) bottom.inert = progress > 0.43;
    canvas.dataset.progress = progress.toFixed(4);
    canvas.dataset.particles = String(count);
    const indicator = document.getElementById('orbit-progress');
    if (indicator) indicator.style.transform = `scaleY(${progress})`;
    active = rect.bottom > 0 && rect.top < innerHeight;
  };
  const draw = () => {
    frame = requestAnimationFrame(draw);
    if (active && visible && dirty) {
      group.rotation.y = -0.34;
      group.rotation.z = 0.08;
      renderer.render(scene, camera);
      dirty = false;
    }
  };
  const onVisibility = () => {
    visible = !document.hidden;
    dirty = true;
  };
  window.addEventListener('scroll', sync, { passive: true });
  reduced.addEventListener('change', sync);
  document.addEventListener('visibilitychange', onVisibility);
  sync();
  draw();
  return () => {
    cancelAnimationFrame(frame);
    observer.disconnect();
    window.removeEventListener('scroll', sync);
    reduced.removeEventListener('change', sync);
    document.removeEventListener('visibilitychange', onVisibility);
    sphere.geometry.dispose();
    surface.dispose();
    geometry.dispose();
    material.dispose();
    texture.dispose();
    renderer.dispose();
  };
}
