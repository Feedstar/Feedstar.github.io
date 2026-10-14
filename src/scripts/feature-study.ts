import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createPreviewLoop, previewPixelRatio } from '../lib/preview-loop.mjs';
import type { StudyId } from '../lib/study-assets';
// One lightweight storyboard renderer for all four covers. No physics engine
// is loaded by the gallery; the full experiment supplies numerical results.
export function createFeatureStudy(host: HTMLElement) {
  const canvas = host.querySelector<HTMLCanvasElement>('canvas')!;
  const caption = host.querySelector<HTMLElement>('[data-feature-caption]')!;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const loop = createPreviewLoop(requestAnimationFrame, cancelAnimationFrame);
  let active = false,
    disposed = false,
    ready = false,
    preparing = false,
    time = 0;
  let renderer: THREE.WebGLRenderer | undefined,
    draw = (_dt: number) => {},
    resize = () => {},
    dispose = () => {};
  const wake = () => {
    if (!ready || !active || host.hidden || document.hidden) {
      loop.remove(draw);
      return;
    }
    if (reduced.matches) {
      loop.remove(draw);
      draw(0);
    } else loop.add(draw);
  };
  async function prepare() {
    if (preparing || disposed) return;
    preparing = true;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: 'low-power',
      });
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.3;
      const scene = new THREE.Scene(),
        camera = new THREE.PerspectiveCamera(35, 1, 0.05, 20);
      camera.up.set(0, 0, 1);
      camera.position.set(1.25, -1.95, 1.65);
      camera.lookAt(0.25, 0, 0.3);
      scene.add(new THREE.HemisphereLight(0xe7fff5, 0x233138, 2));
      const key = new THREE.DirectionalLight(0xffebce, 3.2);
      key.position.set(-2, -3, 4);
      scene.add(key);
      const env = new RoomEnvironment(),
        pmrem = new THREE.PMREMGenerator(renderer),
        texture = pmrem.fromScene(env, 0.04);
      scene.environment = texture.texture;
      env.dispose();
      pmrem.dispose();
      const ivory = new THREE.MeshStandardMaterial({
        color: 0xdde1d6,
        metalness: 0.55,
        roughness: 0.3,
      });
      const mint = new THREE.MeshStandardMaterial({
        color: 0x80b1a0,
        metalness: 0.55,
        roughness: 0.3,
      });
      const brass = new THREE.MeshStandardMaterial({
        color: 0xcfab70,
        metalness: 0.55,
        roughness: 0.3,
      });
      const dark = new THREE.MeshStandardMaterial({
        color: 0x243735,
        metalness: 0.6,
        roughness: 0.35,
      });
      const sphere = new THREE.SphereGeometry(1, 16, 12),
        cylinder = new THREE.CylinderGeometry(1, 1, 1, 24),
        box = new THREE.BoxGeometry(1, 1, 1);
      const groups = Object.fromEntries(
        (['inverse-kinematics', 'linkage', 'tendon', 'scanner'] as const).map(
          (k) => {
            const g = new THREE.Group();
            scene.add(g);
            return [k, g];
          },
        ),
      ) as Record<StudyId, THREE.Group>;
      const mesh = (
        g: THREE.Object3D,
        geo: THREE.BufferGeometry,
        mat: THREE.Material,
        pos: number[],
        scale: number[],
      ) => {
        const m = new THREE.Mesh(geo, mat);
        m.position.fromArray(pos);
        m.scale.fromArray(scale);
        g.add(m);
        return m;
      };
      const zCylinder = (
        g: THREE.Object3D,
        mat: THREE.Material,
        pos: number[],
        r: number,
        h: number,
      ) => {
        const m = mesh(g, cylinder, mat, pos, [r, h, r]);
        m.rotation.x = Math.PI / 2;
        return m;
      };
      const a = new THREE.Vector3(),
        b = new THREE.Vector3(),
        direction = new THREE.Vector3(),
        up = new THREE.Vector3(0, 1, 0);
      const setRod = (m: THREE.Mesh, p: number[], q: number[], r = 0.025) => {
        a.fromArray(p);
        b.fromArray(q);
        direction.subVectors(b, a);
        m.position.addVectors(a, b).multiplyScalar(0.5);
        m.scale.set(r, direction.length(), r);
        m.quaternion.setFromUnitVectors(up, direction.normalize());
      };
      const rod = (g: THREE.Object3D, mat: THREE.Material) =>
        mesh(g, cylinder, mat, [0, 0, 0], [1, 1, 1]);
      const wire = (g: THREE.Object3D, count: number, color: number) => {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute(
          'position',
          new THREE.BufferAttribute(new Float32Array(count * 3), 3),
        );
        geometry.setDrawRange(0, 0);
        const line = new THREE.Line(
          geometry,
          new THREE.LineBasicMaterial({
            color,
            transparent: true,
            opacity: 0.8,
          }),
        );
        line.frustumCulled = false;
        g.add(line);
        return line;
      };
      const setWire = (line: THREE.Line, points: number[]) => {
        const attribute = line.geometry.getAttribute(
          'position',
        ) as THREE.BufferAttribute;
        attribute.array.set(points);
        attribute.needsUpdate = true;
        line.geometry.setDrawRange(0, points.length / 3);
      };
      const platform = zCylinder(scene, dark, [0.2, 0, -0.04], 0.86, 0.06);
      for (const radius of [0.36, 0.58, 0.79]) {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(radius, 0.0015, 4, 90),
          mint,
        );
        ring.position.set(0.2, 0, -0.007);
        scene.add(ring);
      }
      // 08: analytic two-link storyboard, clearly labelled as an illustration.
      const arm = groups['inverse-kinematics'];
      zCylinder(arm, dark, [0, 0, 0.035], 0.13, 0.07);
      zCylinder(arm, ivory, [0, 0, 0.14], 0.065, 0.2);
      const rods = [rod(arm, ivory), rod(arm, ivory), rod(arm, mint)];
      const joints = [0, 1, 2].map(() =>
        mesh(arm, sphere, mint, [0, 0, 0], [0.045, 0.045, 0.045]),
      );
      const target = mesh(arm, sphere, brass, [0, 0, 0], [0.025, 0.025, 0.025]);
      target.material = new THREE.MeshBasicMaterial({
        color: 0xe5c48c,
        depthTest: false,
        depthWrite: false,
      });
      target.renderOrder = 3;
      const orbit = wire(arm, 97, 0xe5c48c),
        orbitPoints = [];
      for (let i = 0; i <= 96; i++) {
        const t = (i / 96) * Math.PI * 2;
        orbitPoints.push(0.49, 0.12 * Math.sin(t), 0.54 + 0.12 * Math.cos(t));
      }
      setWire(orbit, orbitPoints);
      // 09: exact parallelogram geometry makes loop closure visible in preview.
      const linkage = groups.linkage;
      mesh(linkage, box, dark, [0.325, 0, 0.04], [0.8, 0.14, 0.07]);
      const bars = [
        rod(linkage, mint),
        rod(linkage, ivory),
        rod(linkage, brass),
      ];
      const pins = Array.from({ length: 4 }, () =>
        zCylinder(linkage, brass, [0, 0, 0.2], 0.04, 0.055),
      );
      for (const x of [0, 0.65])
        zCylinder(linkage, ivory, [x, 0, 0.13], 0.035, 0.2);
      // 10: the path follows the same upper cylinder arc used by the live model.
      const tendon = groups.tendon;
      mesh(tendon, box, dark, [0, 0, 0.07], [1.45, 0.075, 0.045]);
      zCylinder(tendon, dark, [0, 0, 0.2], 0.025, 0.32);
      zCylinder(tendon, mint, [0, 0, 0.37], 0.13, 0.07);
      const driver = mesh(
          tendon,
          box,
          mint,
          [-0.5, 0, 0.37],
          [0.11, 0.11, 0.11],
        ),
        load = mesh(tendon, box, brass, [0.5, 0, 0.37], [0.13, 0.13, 0.13]);
      const cable = wire(tendon, 40, 0xe3dec7);
      // 11: diagram rays use simple analytical surface intersections; no fake
      // numerical measurement is presented by this gallery storyboard.
      const scanner = groups.scanner;
      scanner.scale.setScalar(0.75);
      scanner.position.x = -0.15;
      const head = new THREE.Group();
      head.position.z = 0.2;
      scanner.add(head);
      zCylinder(scanner, dark, [0, 0, 0.04], 0.12, 0.08);
      zCylinder(head, mint, [0, 0, 0], 0.075, 0.12);
      mesh(head, box, brass, [0.08, 0, 0], [0.08, 0.045, 0.05]);
      mesh(scanner, box, brass, [0.8, 0, 0.2], [0.24, 0.28, 0.4]);
      zCylinder(scanner, ivory, [0.6, 0.62, 0.2], 0.15, 0.4);
      mesh(scanner, box, dark, [1.5, 0, 0.2], [0.08, 1.04, 0.4]);
      mesh(scanner, box, ivory, [0.85, -0.6, 0.2], [0.36, 0.16, 0.4]);
      const beam = wire(scanner, 2, 0xe5c48c),
        dotsGeometry = new THREE.BufferGeometry();
      dotsGeometry.setAttribute(
        'position',
        new THREE.BufferAttribute(new Float32Array(300 * 3), 3),
      );
      dotsGeometry.setDrawRange(0, 0);
      const dots = new THREE.Points(
        dotsGeometry,
        new THREE.PointsMaterial({ color: 0xa9d9c4, size: 0.018 }),
      );
      dots.frustumCulled = false;
      scanner.add(dots);
      const cloud: number[] = [];
      let sampled = 0,
        lastMode = '';
      function range(angle: number) {
        const dx = Math.cos(angle),
          dy = Math.sin(angle);
        let nearest = 2.2;
        for (const [cx, cy, hx, hy] of [
          [0.8, 0, 0.12, 0.14],
          [1.5, 0, 0.04, 0.52],
          [0.85, -0.6, 0.18, 0.08],
        ]) {
          const tx = [(cx - hx) / dx, (cx + hx) / dx].sort((a, b) => a - b),
            ty =
              Math.abs(dy) < 1e-8
                ? Math.abs(cy) <= hy
                  ? [-Infinity, Infinity]
                  : [Infinity, -Infinity]
                : [(cy - hy) / dy, (cy + hy) / dy].sort((a, b) => a - b);
          const near = Math.max(tx[0], ty[0], 0),
            far = Math.min(tx[1], ty[1]);
          if (near <= far) nearest = Math.min(nearest, near);
        }
        const along = 0.6 * dx + 0.62 * dy,
          disc = along * along - (0.6 * 0.6 + 0.62 * 0.62 - 0.15 * 0.15);
        if (disc >= 0 && along > 0)
          nearest = Math.min(nearest, along - Math.sqrt(disc));
        return nearest;
      }
      resize = () => {
        const w = canvas.clientWidth,
          h = canvas.clientHeight;
        if (!w || !h || !renderer) return;
        renderer.setPixelRatio(previewPixelRatio(w, h, devicePixelRatio));
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        wake();
      };
      draw = (dt: number) => {
        const mode = host.dataset.studyKind as StudyId;
        if (lastMode !== mode) {
          time = 0;
          lastMode = mode;
          cloud.length = 0;
          sampled = -1;
        }
        time += dt;
        const t = reduced.matches ? 2 : time;
        Object.entries(groups).forEach(
          ([key, g]) => (g.visible = key === mode),
        );
        if (mode === 'inverse-kinematics') {
          const x = 0.49,
            y = 0.12 * Math.sin(t * 0.65),
            z = 0.54 + 0.12 * Math.cos(t * 0.65),
            r = Math.hypot(x, y),
            height = z - 0.24;
          const elbow = Math.acos(
            THREE.MathUtils.clamp(
              (r * r + height * height - 0.4 * 0.4 - 0.36 * 0.36) /
                (2 * 0.4 * 0.36),
              -1,
              1,
            ),
          );
          const shoulder =
            Math.atan2(height, r) -
            Math.atan2(0.36 * Math.sin(elbow), 0.4 + 0.36 * Math.cos(elbow));
          const p = [0, 0, 0.24],
            q = [
              (0.4 * Math.cos(shoulder) * x) / r,
              (0.4 * Math.cos(shoulder) * y) / r,
              0.24 + 0.4 * Math.sin(shoulder),
            ],
            end = [x, y, z];
          setRod(rods[0], p, q, 0.03);
          setRod(rods[1], q, end, 0.027);
          setRod(rods[2], end, [x, y, z - 0.065], 0.035);
          [p, q, end].forEach((p, i) => joints[i].position.fromArray(p));
          target.position.set(
            0.49,
            0.12 * Math.sin(t * 0.65 + 0.2),
            0.54 + 0.12 * Math.cos(t * 0.65 + 0.2),
          );
          caption.textContent = '末端追踪 · 空间中的一条圆';
        } else if (mode === 'linkage') {
          const angle = 0.62 * Math.sin(t * 0.6),
            p = [0, 0, 0.24],
            q = [-0.32 * Math.sin(angle), 0.32 * Math.cos(angle), 0.24],
            r = [q[0] + 0.65, q[1], 0.24],
            s = [0.65, 0, 0.24];
          setRod(bars[0], p, q);
          setRod(bars[1], q, r);
          setRod(bars[2], s, r);
          [p, q, r, s].forEach((p, i) => pins[i].position.fromArray(p));
          caption.textContent = '输入 → 连杆 → 从动 · 首尾相接';
        } else if (mode === 'tendon') {
          const x = -0.5 - (0.09 * (1 - Math.cos(t * 1.2))) / 2,
            y = 0.5 - (0.075 * (1 - Math.cos(t * 1.2 - 0.45))) / 2;
          driver.position.x = x;
          load.position.x = y;
          const start = Math.acos(0.13 / x),
            end = Math.acos(0.13 / y),
            points = [x, 0, 0.37];
          for (let i = 0; i <= 24; i++) {
            const angle = start + ((end - start) * i) / 24;
            points.push(0.13 * Math.cos(angle), 0.13 * Math.sin(angle), 0.37);
          }
          points.push(y, 0, 0.37);
          setWire(cable, points);
          caption.textContent = '弹性传动 · 牵引与迟滞';
        } else {
          const angle = 1.3 * Math.sin(t * 0.6),
            length = range(angle);
          head.rotation.z = angle;
          const end = [Math.cos(angle) * length, Math.sin(angle) * length, 0.2];
          setWire(beam, [0, 0, 0.2, ...end]);
          if (t - sampled > 0.035 || sampled < 0) {
            if (length < 2.2) {
              cloud.push(...end);
              if (cloud.length > 900) cloud.splice(0, 3);
            }
            sampled = t;
            const attr = dotsGeometry.getAttribute(
              'position',
            ) as THREE.BufferAttribute;
            attr.array.set(cloud);
            attr.needsUpdate = true;
            dotsGeometry.setDrawRange(0, cloud.length / 3);
          }
          caption.textContent = '射线扫过 · 距离成为轮廓';
        }
        renderer?.render(scene, camera);
      };
      dispose = () => {
        const geometries = new Set<THREE.BufferGeometry>(),
          materials = new Set<THREE.Material>();
        scene.traverse((o) => {
          if (
            o instanceof THREE.Mesh ||
            o instanceof THREE.Line ||
            o instanceof THREE.Points
          ) {
            geometries.add(o.geometry);
            (Array.isArray(o.material) ? o.material : [o.material]).forEach(
              (m) => materials.add(m),
            );
          }
        });
        geometries.forEach((g) => g.dispose());
        materials.forEach((m) => m.dispose());
        texture.dispose();
        renderer?.dispose();
      };
      resize();
      await renderer.compileAsync(scene, camera);
      if (disposed) {
        dispose();
        return;
      }
      ready = true;
      host.dataset.ready = 'true';
      draw(0);
      wake();
    } catch {
      dispose();
      host.dataset.ready = 'false';
    }
  }
  const observer = new IntersectionObserver((entries) => {
    active = entries[0].isIntersecting;
    if (active && !preparing) void prepare();
    wake();
  });
  const resizer = new ResizeObserver(() => resize());
  observer.observe(host);
  resizer.observe(canvas);
  host.addEventListener('feature-preview-change', wake);
  reduced.addEventListener('change', wake);
  document.addEventListener('visibilitychange', wake);
  window.addEventListener(
    'pagehide',
    (event) => {
      if (event.persisted) {
        loop.suspend(true);
        return;
      }
      disposed = true;
      loop.dispose();
      observer.disconnect();
      resizer.disconnect();
      host.removeEventListener('feature-preview-change', wake);
      reduced.removeEventListener('change', wake);
      document.removeEventListener('visibilitychange', wake);
      dispose();
    },
    { once: true },
  );
  window.addEventListener('pageshow', () => {
    loop.suspend(false);
    wake();
  });
}
