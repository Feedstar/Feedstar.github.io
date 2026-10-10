import * as THREE from 'three';
import { erosionGLSL, clamp, smoothstep } from '../lib/erosion.mjs';
import { settle } from '../lib/motion.mjs';

export function createMoon(canvas: HTMLCanvasElement) {
  const host = canvas.parentElement!;
  const journey = document.getElementById('orbit-journey')!;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const aura = host.querySelector<HTMLElement>('.lunar-aura')!;
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
  texture.wrapS = THREE.RepeatWrapping;
  const uniforms = {
    uProgress: { value: 0 },
    uSpin: { value: 0 },
    uTexture: { value: texture },
    uDpr: { value: renderer.getPixelRatio() },
  };
  const surface = new THREE.ShaderMaterial({
    uniforms,
    transparent: false,
    vertexShader: `varying vec3 vPosition; varying vec2 vUv; void main(){ vPosition=position; vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform float uProgress; uniform float uSpin; uniform sampler2D uTexture; varying vec3 vPosition; varying vec2 vUv; ${erosionGLSL}
    void main(){ vec3 p=normalize(vPosition); if(uProgress>.075 && uProgress>thresholdAt(p,0.)) discard;
      vec3 tex=texture2D(uTexture,vec2(vUv.x+uSpin/6.2831853,vUv.y)).rgb; float lum=dot(tex,vec3(.299,.587,.114));
      float light=.16+.86*pow(max(0.,dot(p,normalize(vec3(-.6,.65,1.2)))),.6);
      float grain=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453);
      vec3 color=vec3(.89,.88,.94)*(pow(lum,.75)*1.12)*light + (grain-.5)*.035;
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
    fragmentShader: `uniform sampler2D uTexture; uniform float uSpin; varying vec2 vUv; varying float vAlpha; varying float vLight;
      void main(){ float radius=length(gl_PointCoord-.5); if(radius>.5)discard;
        vec3 tex=texture2D(uTexture,vec2(vUv.x+uSpin/6.2831853,vUv.y)).rgb; float lum=dot(tex,vec3(.299,.587,.114));
        gl_FragColor=vec4(vec3(.89,.88,.94)*pow(lum,.75)*1.12*vLight, vAlpha*(1.-smoothstep(.15,.5,radius))); }`,
  });
  const points = new THREE.Points(geometry, material);
  group.add(points);
  points.frustumCulled = false;
  // Long-lived grains originate on the illuminated limb. Their staggered
  // lifetimes make a continuous dust stream without synchronised pulses.
  const dustCount = innerWidth < 700 ? 14000 : 32000;
  const dustPositions = new Float32Array(dustCount * 3);
  const dustSeeds = new Float32Array(dustCount * 4);
  for (let i = 0; i < dustCount; i++) {
    const random = (n: number) => {
      const v = Math.sin(i * 127.1 + n * 311.7) * 43758.5453;
      return v - Math.floor(v);
    };
    const y = (random(1) * 2 - 1) * 0.96;
    const r = Math.sqrt(1 - y * y);
    const x = -r * (0.84 + random(2) * 0.15);
    const z = Math.sqrt(Math.max(0, 1 - x * x - y * y));
    dustPositions.set([x, y, z], i * 3);
    dustSeeds.set([random(3), random(4), random(5), random(6)], i * 4);
  }
  const dustGeometry = new THREE.BufferGeometry();
  dustGeometry.setAttribute(
    'position',
    new THREE.BufferAttribute(dustPositions, 3),
  );
  dustGeometry.setAttribute('aDust', new THREE.BufferAttribute(dustSeeds, 4));
  const dustUniforms = {
    uProgress: uniforms.uProgress,
    uDpr: uniforms.uDpr,
    uTime: { value: 0 },
    uPaper: { value: 0 },
    uViewport: { value: new THREE.Vector2(1, 1) },
    uPointer: { value: new THREE.Vector2(-1000, -1000) },
  };
  const dustMaterial = new THREE.ShaderMaterial({
    uniforms: dustUniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: `
      uniform float uTime, uProgress, uDpr;
      uniform vec2 uViewport, uPointer;
      attribute vec4 aDust;
      varying float vAlpha, vTone;
      void main(){
        float life=fract(aDust.x+uTime*(.022+aDust.y*.016));
        float travel=pow(life,1.6)*(1.05+aDust.z*.85);
        vec3 p=position;
        p.x-=travel*(1.+uProgress*.4);
        float ribbon=sin(position.y*11.+travel*2.8);
        p.y+=travel*(.07+ribbon*.08)+(aDust.y-.5)*travel*.16;
        p.z+=(aDust.z-.5)*travel*.3;
        float birth=smoothstep(0.,.08,life);
        float death=1.-smoothstep(.48,1.,life);
        float band=.46+.54*pow(.5+.5*sin(position.y*16.+aDust.z*1.5),2.);
        vAlpha=birth*death*band*(.34+aDust.w*.6)*(1.-smoothstep(.18,.91,uProgress));
        vTone=aDust.y;
        vec4 mv=modelViewMatrix*vec4(p*1.006,1.);
        gl_Position=projectionMatrix*mv;
        vec2 screen=(gl_Position.xy/gl_Position.w*.5+.5)*uViewport;
        vec2 delta=screen-uPointer;
        float distance=length(delta);
        float influence=pow(1.-smoothstep(0.,110.,distance),2.);
        gl_Position.xy+=delta/max(1.,distance)*influence*13./uViewport*2.*gl_Position.w;
        gl_PointSize=clamp((.72+pow(aDust.w,3.)*.8)*uDpr*(5./-mv.z),.65,2.5);
      }`,
    fragmentShader: `
      uniform float uPaper;
      varying float vAlpha, vTone;
      void main(){
        float r=length(gl_PointCoord-.5);
        if(r>.5) discard;
        vec3 silver=mix(vec3(.61,.63,.7),vec3(.93,.91,.96),vTone);
        vec3 color=mix(silver,vec3(.37,.32,.44),uPaper);
        gl_FragColor=vec4(color,vAlpha*(1.-smoothstep(.08,.5,r)));
      }`,
  });
  const dustPoints = new THREE.Points(dustGeometry, dustMaterial);
  dustPoints.frustumCulled = false;
  group.add(dustPoints);
  group.rotation.set(0, -0.34, 0.08);
  canvas.dataset.dustParticles = String(dustCount);
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
    aura.style.left = `${moonX}px`;
    aura.style.top = `${moonY}px`;
    aura.style.width = `${moonRadius * 2.9}px`;
    dustUniforms.uViewport.value.set(w, h);
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
    points.visible = uniforms.uProgress.value > 0.075;
    dustPoints.visible = uniforms.uProgress.value < 0.91;
    const introOpacity = 1 - smoothstep(0.08, 0.4, progress);
    if (intro) {
      intro.style.opacity = String(introOpacity);
      intro.style.transform = `translateY(${reduced.matches ? 0 : -progress * 65}px)`;
    }
    if (bottom) bottom.style.opacity = String(introOpacity);
    journey
      .querySelectorAll<HTMLElement>(
        '.orbital-lines, .moon-caption, .hero-atmosphere',
      )
      .forEach((el) => {
        el.style.opacity = String(introOpacity);
      });
    if (arrival) {
      arrival.style.opacity = String(smoothstep(0.4, 0.72, progress));
      arrival.style.transform = `translateY(calc(-50% + ${reduced.matches ? 0 : 24 * (1 - smoothstep(0.4, 0.75, progress))}px))`;
    }
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
      // Stop the longitudinal rotation before erosion starts: a held scroll
      // position keeps its surface/particle correspondence, including on rewind.
      const spinRate = 0.012 * (1 - smoothstep(0.005, 0.065, progress));
      uniforms.uSpin.value =
        (uniforms.uSpin.value + dt * spinRate) % (Math.PI * 2);
      ambientTime += dt;
    } else {
      dustUniforms.uPointer.value.set(-1000, -1000);
    }
    if (
      dirty ||
      (!reduced.matches && now - renderTime >= 1000 / 30 && progress < 0.94)
    ) {
      dustUniforms.uTime.value = reduced.matches ? 0 : ambientTime;
      dustUniforms.uPaper.value = Number(
        document.documentElement.dataset.theme === 'paper',
      );
      canvas.dataset.rotation = uniforms.uSpin.value.toFixed(5);
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
    dustUniforms.uPointer.value.set(
      event.clientX - rect.left,
      rect.bottom - event.clientY,
    );
  };
  const onPointerLeave = () => {
    dustUniforms.uPointer.value.set(-1000, -1000);
  };
  const themeObserver = new MutationObserver(() => {
    dirty = true;
  });
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
    cancelAnimationFrame(frame);
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
    dustGeometry.dispose();
    dustMaterial.dispose();
    texture.dispose();
    renderer.dispose();
  };
}
