import * as THREE from 'three';
import { erosionThreshold, clamp, smoothstep } from '../lib/erosion.mjs';
import { arrivalOpacity, lunarNotch } from '../lib/lunar-flow.mjs';
import { sampleArrival } from './particle-targets';
import {
  surfaceVertex,
  surfaceFragment,
  flowVertex,
  flowFragment,
} from './lunar-shaders';
import { settle } from '../lib/motion.mjs';
import { mistVertex, mistFragment } from './lunar-mist';

export function createMoon(canvas: HTMLCanvasElement) {
  const host = canvas.parentElement!;
  const journey = document.getElementById('orbit-journey')!;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
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
  let dirty = true,
    disposed = false;
  const arrival = journey.querySelector<HTMLElement>('.arrival')!;
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.z = 6;
  const group = new THREE.Group();
  scene.add(group);
  const texture = new THREE.TextureLoader().load('/assets/moon.jpg', () => {
    host.dataset.ready = 'true';
    dirty = true;
  });
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  const uniforms = {
    uProgress: { value: 0 },
    uSpin: { value: 2.39 },
    uTexture: { value: texture },
    uDpr: { value: renderer.getPixelRatio() },
    uTime: { value: 0 },
    uPaper: { value: 0 },
    uViewport: { value: new THREE.Vector2(1, 1) },
    uPointer: { value: new THREE.Vector2(-1000, -1000) },
    uMoon: { value: new THREE.Vector3(0, 0, 1) },
  };
  const surface = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: surfaceVertex,
    fragmentShader: surfaceFragment,
  });
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(1, 160, 100), surface);
  group.add(sphere);
  // One particle pool, material and wind field span the entire journey.
  // Seeds on the limb are already airborne; surface seeds join the same flow
  // as their matching surface region feathers away.
  const count = innerWidth < 700 ? 42000 : 96000;
  const positions = new Float32Array(count * 3);
  const uvs = new Float32Array(count * 2);
  const flow = new Float32Array(count * 4);
  const targets = new Float32Array(count * 3);
  const targetColors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const random = (n: number) => {
      const value = Math.sin(i * 127.1 + n * 311.7) * 43758.5453;
      return value - Math.floor(value);
    };
    const ambient = i < count * 0.42;
    const y = (random(1) * 2 - 1) * 0.97;
    const r = Math.sqrt(1 - y * y);
    const angle = random(2) * Math.PI;
    const x = ambient
      ? clamp(
          lunarNotch(y) + 0.07 + (random(2) - 0.5) * 0.32,
          -r + 0.002,
          r - 0.002,
        )
      : Math.cos(angle) * r;
    const z = Math.sqrt(Math.max(0, 1 - x * x - y * y));
    const seed = random(3);
    positions.set([x, y, z], i * 3);
    uvs.set(
      [Math.atan2(z, -x) / (2 * Math.PI) + 0.5, Math.acos(-y) / Math.PI],
      i * 2,
    );
    flow.set(
      [seed, random(4), Number(ambient), erosionThreshold(x, y, z, seed)],
      i * 4,
    );
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setAttribute('aFlow', new THREE.BufferAttribute(flow, 4));
  const targetAttribute = new THREE.BufferAttribute(targets, 3);
  const colorAttribute = new THREE.BufferAttribute(targetColors, 3);
  geometry.setAttribute('aTarget', targetAttribute);
  geometry.setAttribute('aTargetColor', colorAttribute);
  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    vertexShader: flowVertex,
    fragmentShader: flowFragment,
  });
  const points = new THREE.Points(geometry, material);
  points.renderOrder = 1;
  points.frustumCulled = false;
  group.add(points);
  const mistMaterial = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    vertexShader: mistVertex,
    fragmentShader: mistFragment,
  });
  const mist = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mistMaterial);
  mist.frustumCulled = false;
  mist.renderOrder = 2;
  scene.add(mist);
  // Keep the erosion contour in the image plane; the wind sets the tail angle.
  // The lunar texture continues rotating independently through uSpin.
  group.rotation.set(0, 0, 0);
  canvas.dataset.particles = String(count);
  canvas.dataset.particleSystem = 'continuous-wind-to-content';
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
      ? Math.min(viewW * 0.31, viewH * 0.23)
      : Math.min(viewH * 0.34, viewW * 0.27);
    group.scale.setScalar(radius);
    group.position.set(
      mobile ? viewW * 0.12 : viewW * 0.15,
      mobile ? viewH * 0.22 : viewH * 0.01,
      0,
    );
    const moonX = (0.5 + group.position.x / viewW) * w;
    const moonY = (0.5 - group.position.y / viewH) * h;
    const moonRadius = (radius / viewH) * h;
    uniforms.uMoon.value.set(moonX, h - moonY, moonRadius);
    uniforms.uViewport.value.set(w, h);
    const samples = sampleArrival(arrival, host);
    if (samples.length) {
      for (let i = 0; i < count; i++) {
        const index = Math.floor(flow[i * 4 + 1] * samples.length);
        const sample = samples[Math.min(index, samples.length - 1)];
        targets.set(
          [
            ((sample.x + 0.5 + (flow[i * 4] - 0.5) * 1.4) / w - 0.5) * viewW,
            (0.5 - (sample.y + 0.5 + positions[i * 3 + 1] * 0.7) / h) * viewH,
            0,
          ],
          i * 3,
        );
        targetColors.set(sample.color, i * 3);
      }
      targetAttribute.needsUpdate = true;
      colorAttribute.needsUpdate = true;
    }
    canvas.dataset.targetSamples = String(samples.length);
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
  const bottom = journey.querySelector<HTMLElement>('.hero-bottom');
  const intro = journey.querySelector<HTMLElement>('.hero-copy');
  const indicator = document.getElementById('orbit-progress');
  const updatePresentation = () => {
    const rect = journey.getBoundingClientRect();
    uniforms.uProgress.value = reduced.matches ? 0 : progress;
    points.visible = reduced.matches || progress < 0.97;
    sphere.visible = reduced.matches || progress < 0.51;
    mist.visible = reduced.matches || progress < 0.7;
    const introOpacity = 1 - smoothstep(0.08, 0.4, progress);
    if (intro) {
      intro.style.opacity = String(introOpacity);
      intro.style.transform = `translateY(${reduced.matches ? 0 : -progress * 65}px)`;
    }
    if (bottom) bottom.style.opacity = String(introOpacity);
    journey
      .querySelectorAll<HTMLElement>('.orbital-lines, .moon-caption')
      .forEach((el) => {
        el.style.opacity = String(introOpacity);
      });
    if (arrival) {
      arrival.style.opacity = String(
        reduced.matches
          ? smoothstep(0.55, 0.8, progress)
          : arrivalOpacity(progress),
      );
    }
    canvas.style.opacity = reduced.matches
      ? String(1 - smoothstep(0.25, 0.7, progress))
      : '1';
    if (arrival) {
      arrival.inert = progress < (reduced.matches ? 0.7 : 0.92);
      arrival.setAttribute(
        'aria-hidden',
        String(progress < (reduced.matches ? 0.55 : 0.87)),
      );
    }
    if (bottom) bottom.inert = progress > 0.43;
    if (intro) {
      intro.inert = progress > 0.43;
      intro.setAttribute('aria-hidden', String(progress > 0.43));
    }
    canvas.dataset.progress = progress.toFixed(4);
    canvas.dataset.targetProgress = targetProgress.toFixed(4);
    canvas.dataset.stage =
      progress < 0.08
        ? 'moon'
        : progress < 0.5
          ? 'weathering'
          : progress < 0.87
            ? 'gathering'
            : 'content';
    if (indicator) indicator.style.transform = `scaleY(${progress})`;
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
  let previousTime = 0,
    ambientTime = 0,
    renderTime = 0;
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
    if (dirty) updatePresentation();
    if (!reduced.matches) {
      // Stop axial rotation during erosion, while liberated grains keep flowing.
      const spinRate = 0.012 * (1 - smoothstep(0.005, 0.065, progress));
      uniforms.uSpin.value =
        (uniforms.uSpin.value + dt * spinRate) % (Math.PI * 2);
      ambientTime += dt;
    } else {
      uniforms.uPointer.value.set(-1000, -1000);
    }
    if (
      dirty ||
      (!reduced.matches && now - renderTime >= 1000 / 30 && progress < 0.97)
    ) {
      uniforms.uTime.value = reduced.matches ? 0 : ambientTime;
      uniforms.uPaper.value = Number(
        document.documentElement.dataset.theme === 'paper',
      );
      canvas.dataset.rotation = uniforms.uSpin.value.toFixed(5);
      canvas.dataset.flowTime = uniforms.uTime.value.toFixed(3);
      renderer.render(scene, camera);
      renderTime = now;
    }
    dirty = false;
  };
  const onVisibility = () => {
    visible = !document.hidden;
    host.dataset.active = String(active && visible);
    dirty = true;
  };
  const onPointer = (event: PointerEvent) => {
    if (
      !active ||
      reduced.matches ||
      !finePointer.matches ||
      event.pointerType === 'touch'
    )
      return;
    const rect = host.getBoundingClientRect();
    uniforms.uPointer.value.set(
      event.clientX - rect.left,
      rect.bottom - event.clientY,
    );
  };
  const onPointerLeave = () => {
    uniforms.uPointer.value.set(-1000, -1000);
  };
  const onFonts = () => {
    if (!disposed) resize();
  };
  document.fonts.ready.then(onFonts);
  document.fonts.addEventListener('loadingdone', onFonts);
  const themeObserver = new MutationObserver(resize);
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });
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
    disposed = true;
    cancelAnimationFrame(frame);
    document.fonts.removeEventListener('loadingdone', onFonts);
    observer.disconnect();
    themeObserver.disconnect();
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
    mist.geometry.dispose();
    mistMaterial.dispose();
    texture.dispose();
    renderer.dispose();
  };
}
