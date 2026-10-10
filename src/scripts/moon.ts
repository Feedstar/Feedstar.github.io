import * as THREE from 'three';
import { erosionGLSL, clamp, smoothstep } from '../lib/erosion.mjs';
import { settle } from '../lib/motion.mjs';

export function createMoon(canvas: HTMLCanvasElement) {
  const host = canvas.parentElement!;
  const journey = document.getElementById('orbit-journey')!;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const aura = host.querySelector<HTMLElement>('.lunar-aura')!;
  const dust = host.querySelector<HTMLCanvasElement>('.orbital-dust')!;
  const dustContext = dust.getContext('2d');
  let width = 0,
    height = 0,
    moonX = 0,
    moonY = 0,
    moonRadius = 0;
  let pointerX = -1000,
    pointerY = -1000;
  const motes = Array.from({ length: innerWidth < 700 ? 50 : 110 }, (_, i) => {
    const random = (n: number) => {
      const v = Math.sin(i * 127.1 + n * 311.7) * 43758.5453;
      return v - Math.floor(v);
    };
    return {
      angle: random(1) * Math.PI * 2,
      radius: 1.08 + random(2) * 0.92,
      depth: random(3),
      size: 0.45 + random(4) * 0.85,
      speed: 0.007 + random(5) * 0.009,
    };
  });
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
      void main(){ vec3 p=position; float age=max(0.,uProgress-thresholdAt(p,aSeed)); float drift=(age*age/(age+.035))*(.8+aSeed*.8);
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
    width = w;
    height = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const viewH = 2 * Math.tan(THREE.MathUtils.degToRad(17.5)) * 6,
      viewW = viewH * camera.aspect;
    const mobile = w < 700;
    const radius = mobile
      ? Math.min(viewW * 0.33, viewH * 0.24)
      : Math.min(viewH * 0.35, viewW * 0.255);
    group.scale.setScalar(radius);
    group.position.set(
      mobile ? viewW * 0.12 : viewW * 0.185,
      mobile ? viewH * 0.21 : viewH * 0.015,
      0,
    );
    moonX = (0.5 + group.position.x / viewW) * w;
    moonY = (0.5 - group.position.y / viewH) * h;
    moonRadius = (radius / viewH) * h;
    aura.style.left = `${moonX}px`;
    aura.style.top = `${moonY}px`;
    aura.style.width = `${moonRadius * 2.9}px`;
    const dpr = Math.min(devicePixelRatio, 1.5);
    dust.width = Math.round(w * dpr);
    dust.height = Math.round(h * dpr);
    dustContext?.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();
  let frame = 0,
    active = true,
    visible = !document.hidden;
  let progress = 0,
    targetProgress = 0,
    velocity = 0;
  const arrival = journey.querySelector<HTMLElement>('.arrival');
  const bottom = journey.querySelector<HTMLElement>('.hero-bottom');
  const intro = journey.querySelector<HTMLElement>('.hero-copy');
  const indicator = document.getElementById('orbit-progress');
  const updatePresentation = () => {
    const rect = journey.getBoundingClientRect();
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
    if (arrival) {
      arrival.inert = progress < 0.55;
      arrival.setAttribute('aria-hidden', String(progress < 0.4));
    }
    if (bottom) bottom.inert = progress > 0.43;
    if (intro) {
      intro.inert = progress > 0.43;
      intro.setAttribute('aria-hidden', String(progress > 0.43));
    }
    canvas.dataset.progress = progress.toFixed(4);
    canvas.dataset.targetProgress = targetProgress.toFixed(4);
    canvas.dataset.particles = String(count);
    if (indicator) indicator.style.transform = `scaleY(${progress})`;
    aura.style.opacity = String(1 - smoothstep(0.12, 0.62, progress));
    active = rect.bottom > 0 && rect.top < innerHeight;
    host.dataset.active = String(active && visible);
  };
  const sync = () => {
    const rect = journey.getBoundingClientRect();
    targetProgress = clamp(
      -rect.top / Math.max(1, journey.offsetHeight - innerHeight),
    );
    canvas.dataset.targetProgress = targetProgress.toFixed(4);
    active = rect.bottom > 0 && rect.top < innerHeight;
    host.dataset.active = String(active && visible);
    if (reduced.matches || !active) {
      progress = targetProgress;
      velocity = 0;
    }
    dirty = true;
  };
  const drawDust = (time: number) => {
    if (!dustContext) return;
    dustContext.clearRect(0, 0, width, height);
    const fade = 1 - smoothstep(0.18, 0.78, progress);
    if (fade === 0) return;
    const paper = document.documentElement.dataset.theme === 'paper';
    for (const mote of motes) {
      const angle = mote.angle + time * mote.speed;
      let x = moonX + Math.cos(angle) * moonRadius * mote.radius;
      let y =
        moonY +
        Math.sin(angle) * moonRadius * mote.radius * (0.62 + mote.depth * 0.32);
      const dx = x - pointerX,
        dy = y - pointerY,
        distance = Math.hypot(dx, dy);
      if (distance < 105 && distance > 0 && !reduced.matches) {
        const repel = (1 - distance / 105) ** 2 * 16;
        x += (dx / distance) * repel;
        y += (dy / distance) * repel;
      }
      const pulse = 0.55 + Math.sin(time * 0.5 + mote.angle * 3) * 0.25;
      dustContext.fillStyle = `rgba(${paper ? '73,94,78' : '213,230,212'},${fade * pulse * (0.22 + mote.depth * 0.35)})`;
      dustContext.beginPath();
      dustContext.arc(x, y, mote.size, 0, Math.PI * 2);
      dustContext.fill();
    }
  };
  let previousTime = 0,
    ambientTime = 0,
    dustTime = 0;
  const draw = (now: number) => {
    frame = requestAnimationFrame(draw);
    const dt = previousTime
      ? Math.min((now - previousTime) / 1000, 0.05)
      : 1 / 60;
    previousTime = now;
    if (!active || !visible) return;
    if (
      Math.abs(progress - targetProgress) > 0.00001 ||
      Math.abs(velocity) > 0.00001
    ) {
      const next = settle(progress, velocity, targetProgress, dt);
      progress = clamp(next.value);
      velocity = next.velocity;
      if (
        Math.abs(progress - targetProgress) < 0.00001 &&
        Math.abs(velocity) < 0.0001
      ) {
        progress = targetProgress;
        velocity = 0;
      }
      dirty = true;
    }
    if (active && visible && dirty) {
      updatePresentation();
      group.rotation.y = -0.34;
      group.rotation.z = 0.08;
      renderer.render(scene, camera);
    }
    if (!reduced.matches) ambientTime += dt;
    if ((now - dustTime > 1000 / 30 && !reduced.matches) || dirty) {
      drawDust(ambientTime);
      dustTime = now;
    }
    dirty = false;
  };
  const onVisibility = () => {
    visible = !document.hidden;
    host.dataset.active = String(active && visible);
    dirty = true;
  };
  const onPointer = (event: PointerEvent) => {
    if (!active || event.pointerType === 'touch') return;
    const rect = host.getBoundingClientRect();
    pointerX = event.clientX - rect.left;
    pointerY = event.clientY - rect.top;
  };
  const onPointerLeave = () => {
    pointerX = -1000;
    pointerY = -1000;
  };
  window.addEventListener('scroll', sync, { passive: true });
  window.addEventListener('resize', sync);
  window.addEventListener('pointermove', onPointer, { passive: true });
  document.addEventListener('pointerleave', onPointerLeave);
  reduced.addEventListener('change', sync);
  document.addEventListener('visibilitychange', onVisibility);
  sync();
  progress = targetProgress;
  frame = requestAnimationFrame(draw);
  return () => {
    cancelAnimationFrame(frame);
    observer.disconnect();
    window.removeEventListener('scroll', sync);
    window.removeEventListener('resize', sync);
    window.removeEventListener('pointermove', onPointer);
    document.removeEventListener('pointerleave', onPointerLeave);
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
