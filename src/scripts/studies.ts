import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { settle } from '../lib/motion.mjs';
import { createPreviewLoop, previewPixelRatio } from '../lib/preview-loop.mjs';

// Gallery sculptures are visual covers. The linked lab runs the actual MJCF models.
export function createStudies() {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const cleanup: (() => void)[] = [];
  const loop = createPreviewLoop(requestAnimationFrame, cancelAnimationFrame);
  let disposed = false;
  const windows = document.querySelectorAll<HTMLElement>('[data-study]');
  const mount = async (host: HTMLElement) => {
    let dirty = true;
    const canvas = host.querySelector<HTMLCanvasElement>('canvas')!;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance',
      });
    } catch {
      return;
    }
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;
    const scene = new THREE.Scene();
    const room = new RoomEnvironment();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const environment = pmrem.fromScene(room, 0.04);
    scene.environment = environment.texture;
    room.dispose();
    pmrem.dispose();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 40);
    camera.position.set(4.3, 2.5, 6.8);
    camera.lookAt(0, 0.1, 0);
    scene.add(new THREE.AmbientLight(0xc1bdff, 1.3));
    const key = new THREE.DirectionalLight(0xfff3e3, 5);
    key.position.set(-3, 5, 4);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xaca2ff, 4);
    rim.position.set(4, 2, -2);
    scene.add(rim);
    const world = new THREE.Group();
    scene.add(world);
    const kind = host.dataset.study;
    const silver = new THREE.MeshPhysicalMaterial({
      color: 0xd9d9ed,
      metalness: 0.92,
      roughness: 0.22,
      clearcoat: 0.7,
    });
    const dark = new THREE.MeshStandardMaterial({
      color: 0x22232d,
      metalness: 0.65,
      roughness: 0.35,
    });
    const violet = new THREE.MeshPhysicalMaterial({
      color: kind === 'contact' ? 0x8ca5cd : 0xafa0cb,
      metalness: 0.6,
      roughness: 0.24,
      clearcoat: 1,
    });
    const base = new THREE.MeshStandardMaterial({
      color: 0x30303d,
      roughness: 0.65,
      metalness: 0.3,
    });
    const mesh = (
      geometry: THREE.BufferGeometry,
      material: THREE.Material,
      parent: THREE.Object3D = world,
    ) => {
      const object = new THREE.Mesh(geometry, material);
      parent.add(object);
      return object;
    };
    const box = (
      x: number,
      y: number,
      z: number,
      material: THREE.Material = silver,
      parent: THREE.Object3D = world,
    ) => mesh(new RoundedBoxGeometry(x, y, z, 3, 0.06), material, parent);
    const disk = mesh(new THREE.CylinderGeometry(2.1, 2.15, 0.14, 80), base);
    disk.position.y = -1.22;
    // Fine concentric marks give the display plinth a tangible, machined surface.
    for (let i = 0; i < 3; i++) {
      const ring = mesh(
        new THREE.TorusGeometry(1.4 + i * 0.24, 0.006, 6, 96),
        silver,
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = -1.14;
    }
    let animate: (time: number) => void = () => {};
    if (kind === 'pendulum') {
      // At ±0.48 rad the bob's outer edge reaches x=1.275; keep both posts clear.
      for (const x of [-1.55, 1.55]) {
        const leg = box(0.09, 2.9, 0.16, dark);
        leg.position.set(x, 0.3, 0);
      }
      const beam = box(3.25, 0.13, 0.22);
      beam.position.y = 1.72;
      const pivot = new THREE.Group();
      pivot.position.y = 1.6;
      world.add(pivot);
      const pin = mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.4, 32), violet);
      pin.rotation.x = Math.PI / 2;
      pin.position.y = 1.6;
      const rod = mesh(
        new THREE.CylinderGeometry(0.022, 0.022, 1.9, 16),
        silver,
        pivot,
      );
      rod.position.y = -0.95;
      const bob = mesh(new THREE.SphereGeometry(0.37, 48, 32), silver, pivot);
      bob.position.y = -1.96;
      const collar = mesh(
        new THREE.TorusGeometry(0.365, 0.014, 8, 64),
        violet,
        bob,
      );
      collar.rotation.x = Math.PI / 2;
      const arcPoints = Array.from({ length: 65 }, (_, i) => {
        const a = (i / 64 - 0.5) * 1.5;
        return new THREE.Vector3(
          Math.sin(a) * 2.1,
          1.6 - Math.cos(a) * 2.1,
          -0.14,
        );
      });
      const arc = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(arcPoints),
        new THREE.LineDashedMaterial({
          color: 0xa89bc8,
          dashSize: 0.025,
          gapSize: 0.055,
          transparent: true,
          opacity: 0.55,
        }),
      );
      arc.computeLineDistances();
      world.add(arc);
      animate = (t) => {
        pivot.rotation.z = Math.sin(t * 0.8 + 0.5) * 0.48;
      };
    } else if (kind === 'actuator') {
      const stand = mesh(new THREE.CylinderGeometry(0.5, 0.68, 0.32, 64), dark);
      stand.position.y = -0.98;
      const pivot = new THREE.Group();
      pivot.position.y = -0.75;
      world.add(pivot);
      const joint = mesh(
        new THREE.CylinderGeometry(0.32, 0.32, 0.55, 48),
        silver,
        pivot,
      );
      joint.rotation.x = Math.PI / 2;
      const link = box(0.22, 1.3, 0.23, silver, pivot);
      link.position.y = 0.65;
      const elbow = new THREE.Group();
      elbow.position.y = 1.3;
      pivot.add(elbow);
      const joint2 = mesh(
        new THREE.CylinderGeometry(0.25, 0.25, 0.42, 48),
        violet,
        elbow,
      );
      joint2.rotation.x = Math.PI / 2;
      const link2 = box(0.18, 1.05, 0.18, silver, elbow);
      link2.position.y = 0.52;
      for (const x of [-0.15, 0.15]) {
        const finger = box(0.07, 0.34, 0.12, dark, elbow);
        finger.position.set(x, 1.16, 0);
      }
      const target = mesh(new THREE.TorusGeometry(0.32, 0.009, 8, 64), violet);
      target.position.set(-0.8, 1.5, 0.2);
      const dot = mesh(new THREE.SphereGeometry(0.05, 20, 16), violet);
      dot.position.copy(target.position);
      animate = (t) => {
        pivot.rotation.z = -0.2 + Math.sin(t * 0.45) * 0.3;
        elbow.rotation.z = 0.55 + Math.cos(t * 0.45) * 0.4;
      };
    } else {
      disk.scale.set(1.15, 1, 0.85);
      const rails = new THREE.InstancedMesh(
        new THREE.BoxGeometry(0.035, 0.035, 2.7),
        dark,
        61,
      );
      const matrix = new THREE.Matrix4();
      for (let i = 0; i < 61; i++) {
        matrix.makeTranslation((i - 30) * 0.055, -1.12, 0);
        rails.setMatrixAt(i, matrix);
      }
      world.add(rails);
      const block = box(0.95, 0.95, 0.95, violet);
      block.position.y = -0.61;
      const edge = new THREE.LineSegments(
        new THREE.EdgesGeometry(block.geometry, 25),
        new THREE.LineBasicMaterial({
          color: 0xdbe2ff,
          transparent: true,
          opacity: 0.3,
        }),
      );
      block.add(edge);
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(-1.6, -1.08, 0.65),
          new THREE.Vector3(1.6, -1.08, 0.65),
        ]),
        new THREE.LineDashedMaterial({
          color: 0xcbd7f1,
          dashSize: 0.08,
          gapSize: 0.04,
          opacity: 0.65,
          transparent: true,
        }),
      );
      line.computeLineDistances();
      world.add(line);
      animate = (t) => {
        block.position.x = Math.sin(t * 0.4) * 0.65;
      };
    }
    const resize = () => {
      dirty = true;
      const w = host.clientWidth,
        h = host.clientHeight;
      if (!w || !h) return;
      renderer.setPixelRatio(previewPixelRatio(w, h, devicePixelRatio));
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.position.z = w / h < 1 ? 8.6 : 6.8;
      camera.lookAt(0, 0.1, 0);
      camera.updateProjectionMatrix();
      requestDraw();
    };
    const resizeObserver = new ResizeObserver(resize);
    let active = false,
      ready = false,
      time = 0,
      px = 0,
      py = 0,
      rx = 0,
      ry = 0,
      vx = 0,
      vy = 0;
    let pointer: { x: number; y: number } | null = null;
    let reportAt = 0,
      reportFrames = 0,
      reportCost = 0;
    const requestDraw = () => {
      if (ready && active) loop.add(update);
    };
    const intersection = new IntersectionObserver(
      (entries) => {
        active = entries[0].isIntersecting;
        host.dataset.active = String(active);
        dirty = true;
        reportAt = 0;
        reportFrames = reportCost = 0;
        if (active) requestDraw();
        else loop.remove(update);
      },
      { threshold: 0 },
    );
    const move = (event: PointerEvent) => {
      if (!fine.matches || reduced.matches) return;
      // Coalesce high-frequency pointer events into the next rendered frame.
      pointer = { x: event.clientX, y: event.clientY };
      dirty = true;
      requestDraw();
    };
    const leave = () => {
      pointer = null;
      px = 0;
      py = 0;
      dirty = true;
      requestDraw();
    };
    host.addEventListener('pointermove', move, { passive: true });
    host.addEventListener('pointerleave', leave);
    const update = (dt: number, now: number) => {
      if (!ready || !active || (reduced.matches && !dirty)) {
        loop.remove(update);
        return;
      }
      if (pointer) {
        const rect = host.getBoundingClientRect();
        px = ((pointer.x - rect.left) / rect.width - 0.5) * 0.28;
        py = ((pointer.y - rect.top) / rect.height - 0.5) * 0.16;
        pointer = null;
      }
      const sx = settle(rx, vx, px, dt, 0.4),
        sy = settle(ry, vy, py, dt, 0.4);
      rx = sx.value;
      vx = sx.velocity;
      ry = sy.value;
      vy = sy.velocity;
      world.rotation.y = -0.18 + rx;
      world.rotation.x = ry;
      time += dt;
      animate(reduced.matches ? 1.2 : time);
      const started = performance.now();
      renderer.render(scene, camera);
      if (dt === 0) {
        reportAt = 0;
        reportFrames = reportCost = 0;
      }
      reportCost += performance.now() - started;
      if (!reportAt) reportAt = now;
      else reportFrames++;
      if (now - reportAt >= 1000) {
        host.dataset.previewFps = (
          (reportFrames * 1000) /
          (now - reportAt)
        ).toFixed(1);
        host.dataset.renderMs = (reportCost / (reportFrames + 1)).toFixed(2);
        reportAt = now;
        reportFrames = reportCost = 0;
      }
      dirty = false;
      if (reduced.matches) loop.remove(update);
    };
    const change = () => {
      if (reduced.matches || !fine.matches) leave();
      dirty = true;
      requestDraw();
    };
    reduced.addEventListener('change', change);
    fine.addEventListener('change', change);
    cleanup.push(() => {
      loop.remove(update);
      resizeObserver.disconnect();
      intersection.disconnect();
      host.removeEventListener('pointermove', move);
      host.removeEventListener('pointerleave', leave);
      reduced.removeEventListener('change', change);
      fine.removeEventListener('change', change);
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material)
            ? object.material
            : [object.material];
          materials.forEach((m) => m.dispose());
        }
      });
      environment.dispose();
      renderer.dispose();
    });
    resizeObserver.observe(host);
    resize();
    // Compile before the cover enters, using parallel shader compilation when
    // supported. No synchronous first-use compilation during its entrance.
    try {
      await renderer.compileAsync(scene, camera);
      if (disposed) return;
      world.rotation.y = -0.18;
      animate(reduced.matches ? 1.2 : 0);
      renderer.render(scene, camera);
      ready = true;
      host.dataset.ready = 'true';
      intersection.observe(host);
    } catch {
      host.dataset.ready = 'false';
    }
  };
  // Prepare one cover per idle task; two adjacent cards must not allocate their
  // environments and compile all their materials in the same scrolling frame.
  const pending: HTMLElement[] = [];
  let preparing = false;
  let idle: number | null = null;
  const scheduleMount = () => {
    if (
      disposed ||
      preparing ||
      idle !== null ||
      !pending.length ||
      document.hidden
    )
      return;
    const prepare = async () => {
      idle = null;
      if (disposed || document.hidden) return;
      preparing = true;
      const host = pending.shift()!;
      try {
        await mount(host);
      } catch {
        host.dataset.ready = 'false';
      } finally {
        preparing = false;
        scheduleMount();
      }
    };
    idle =
      'requestIdleCallback' in window
        ? window.requestIdleCallback(prepare, { timeout: 1000 })
        : globalThis.setTimeout(prepare, 0);
  };
  const preload = new IntersectionObserver(
    (entries) => {
      for (const entry of entries)
        if (entry.isIntersecting) {
          preload.unobserve(entry.target);
          pending.push(entry.target as HTMLElement);
        }
      scheduleMount();
    },
    { rootMargin: '700px' },
  );
  windows.forEach((host) => preload.observe(host));
  cleanup.push(() => preload.disconnect());
  const visibility = () => {
    loop.suspend(document.hidden);
    if (!document.hidden) scheduleMount();
  };
  document.addEventListener('visibilitychange', visibility);
  visibility();
  window.addEventListener('pagehide', (event) => {
    loop.suspend(true);
    if (idle !== null) {
      if ('cancelIdleCallback' in window) window.cancelIdleCallback(idle);
      else clearTimeout(idle);
      idle = null;
    }
    if (!event.persisted) {
      disposed = true;
      loop.dispose();
      cleanup.forEach((dispose) => dispose());
      document.removeEventListener('visibilitychange', visibility);
    }
  });
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) visibility();
  });
}
