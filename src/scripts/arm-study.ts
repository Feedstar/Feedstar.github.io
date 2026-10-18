import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { armPoses } from '../lib/arm-runtime.mjs';
import { createPreviewLoop, previewPixelRatio } from '../lib/preview-loop.mjs';
import { settle } from '../lib/motion.mjs';
import type { ArmLesson } from '../lib/arm-types';

// One lightweight cover renderer serves all four chapters. These choreographed
// covers explain the idea; only the linked laboratory runs MuJoCo physics.
export function createArmStudy(host: HTMLElement) {
  const canvas = host.querySelector<HTMLCanvasElement>('canvas')!;
  const caption = host.querySelector<HTMLElement>('[data-arm-caption]')!;
  const readout = host.querySelector<HTMLElement>('[data-arm-readout]')!;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const loop = createPreviewLoop(requestAnimationFrame, cancelAnimationFrame);
  let renderer: THREE.WebGLRenderer | undefined;
  let update: (dt: number) => void = () => {};
  let resize = () => {};
  let disposeScene = () => {};
  let active = false,
    ready = false,
    disposed = false,
    preparing = false;
  const wake = () => {
    if (!ready || !active || document.hidden) {
      loop.remove(update);
      return;
    }
    if (reduced.matches) {
      loop.remove(update);
      update(0);
    } else loop.add(update);
  };
  const prepare = async () => {
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
      renderer.toneMappingExposure = 1.25;
      const scene = new THREE.Scene();
      const environment = new RoomEnvironment();
      const generator = new THREE.PMREMGenerator(renderer);
      const texture = generator.fromScene(environment, 0.04);
      environment.dispose();
      generator.dispose();
      scene.environment = texture.texture;
      const camera = new THREE.PerspectiveCamera(34, 1, 0.05, 20);
      camera.up.set(0, 0, 1);
      camera.position.set(0.95, -1.85, 1.25);
      camera.lookAt(0.27, 0, 0.39);
      scene.add(new THREE.HemisphereLight(0xe7edff, 0x1b2138, 2.1));
      const light = new THREE.DirectionalLight(0xf0efff, 3.4);
      light.position.set(-2, -3, 4);
      scene.add(light);
      const rim = new THREE.DirectionalLight(0xb6b5e6, 2.4);
      rim.position.set(1, 2, 2);
      scene.add(rim);
      const ivory = new THREE.MeshStandardMaterial({
        color: 0xdde3ef,
        metalness: 0.6,
        roughness: 0.28,
      });
      const graphite = new THREE.MeshStandardMaterial({
        color: 0x232b40,
        metalness: 0.7,
        roughness: 0.32,
      });
      const mint = new THREE.MeshStandardMaterial({
        color: 0x929bc4,
        metalness: 0.65,
        roughness: 0.25,
      });
      const brass = new THREE.MeshStandardMaterial({
        color: 0xc8a568,
        metalness: 0.65,
        roughness: 0.28,
      });
      const ghostMaterial = new THREE.MeshBasicMaterial({
        color: 0xc3c7f1,
        wireframe: true,
        transparent: true,
        opacity: 0.2,
        depthWrite: false,
      });
      const cubeGeometry = new THREE.BoxGeometry(1, 1, 1);
      const cylinderGeometry = new THREE.CylinderGeometry(1, 1, 1, 32);
      const capsuleGeometry = new THREE.CapsuleGeometry(1, 1, 4, 12);
      const mesh = (
        geometry: THREE.BufferGeometry,
        material: THREE.Material,
        parent: THREE.Object3D,
        scale: number[],
        position: number[],
      ) => {
        const item = new THREE.Mesh(geometry, material);
        item.scale.set(scale[0], scale[1], scale[2]);
        item.position.set(position[0], position[1], position[2]);
        parent.add(item);
        return item;
      };
      const cylinder = (
        parent: THREE.Object3D,
        material: THREE.Material,
        r: number,
        h: number,
        z: number,
      ) => {
        const item = mesh(
          cylinderGeometry,
          material,
          parent,
          [r, h, r],
          [0, 0, z],
        );
        item.rotation.x = Math.PI / 2;
        return item;
      };
      const plinth = cylinder(scene, graphite, 0.65, 0.032, -0.025);
      plinth.position.x = 0.25;
      for (const radius of [0.29, 0.43, 0.57]) {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(radius, 0.001, 4, 80),
          mint,
        );
        ring.position.set(0.25, 0, -0.007);
        scene.add(ring);
      }
      const makeArm = (ghost = false) => {
        const root = new THREE.Group();
        scene.add(root);
        const shell = ghost ? ghostMaterial : ivory,
          joint = ghost ? ghostMaterial : mint,
          dark = ghost ? ghostMaterial : graphite;
        cylinder(root, dark, 0.145, 0.055, 0.028);
        const base = new THREE.Group();
        base.position.z = 0.06;
        root.add(base);
        cylinder(base, shell, 0.075, 0.18, 0.09);
        cylinder(base, joint, 0.08, 0.018, 0.045);
        const shoulder = new THREE.Group();
        shoulder.position.z = 0.18;
        base.add(shoulder);
        const elbow = new THREE.Group();
        elbow.position.z = 0.4;
        shoulder.add(elbow);
        const wrist = new THREE.Group();
        wrist.position.z = 0.36;
        elbow.add(wrist);
        [shoulder, elbow, wrist].forEach((part, i) => {
          const r = [0.059, 0.05, 0.041][i];
          mesh(
            cylinderGeometry,
            dark,
            part,
            [r, 0.13 - i * 0.022, r],
            [0, 0, 0],
          );
          mesh(
            cylinderGeometry,
            joint,
            part,
            [r * 0.73, 0.135 - i * 0.022, r * 0.73],
            [0, 0, 0],
          );
        });
        // Two shell rails make the upper arm readable as a rigid body.
        for (const y of [-0.032, 0.032]) {
          const rail = mesh(
            capsuleGeometry,
            shell,
            shoulder,
            [0.025, 0.108, 0.025],
            [0, y, 0.2],
          );
          rail.rotation.x = Math.PI / 2;
        }
        const forearm = mesh(
          capsuleGeometry,
          shell,
          elbow,
          [0.033, 0.096, 0.033],
          [0, 0, 0.18],
        );
        forearm.rotation.x = Math.PI / 2;
        mesh(cubeGeometry, shell, wrist, [0.09, 0.206, 0.05], [0, 0, 0.042]);
        const fingers = [-1, 1].map((side) =>
          mesh(
            cubeGeometry,
            dark,
            wrist,
            [0.032, 0.02, 0.09],
            [0, side * 0.09, 0.11],
          ),
        );
        const tip = new THREE.Object3D();
        tip.position.z = 0.11;
        wrist.add(tip);
        const axes = [shoulder, elbow, wrist].map((part) => {
          const axis = new THREE.AxesHelper(0.12);
          part.add(axis);
          return axis;
        });
        return { root, base, shoulder, elbow, wrist, fingers, tip, axes };
      };
      const arm = makeArm(),
        targetArm = makeArm(true);
      targetArm.axes.forEach((axis) => (axis.visible = false));
      const table = mesh(
        cubeGeometry,
        graphite,
        scene,
        [0.28, 0.26, 0.08],
        [0.58176, 0, 0.04],
      );
      const cube = mesh(
        cubeGeometry,
        brass,
        scene,
        [0.07, 0.07, 0.07],
        [0.58176, 0, 0.115],
      );
      const toolAxes = new THREE.AxesHelper(0.19);
      arm.tip.add(toolAxes);
      const pulseMaterial = new THREE.MeshBasicMaterial({
        color: 0xb6bfdc,
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
      });
      const pulse = new THREE.Mesh(
        new THREE.TorusGeometry(0.085, 0.0015, 4, 64),
        pulseMaterial,
      );
      arm.tip.add(pulse);
      const arrows = [-1, 1].map((side) => {
        const arrow = new THREE.ArrowHelper(
          new THREE.Vector3(0, -side, 0),
          new THREE.Vector3(0, side * 0.14, 0.11),
          0.075,
          0xd6bb80,
          0.025,
          0.013,
        );
        arm.wrist.add(arrow);
        return arrow;
      });
      const pose = [...armPoses.home],
        velocities = [0, 0, 0, 0];
      const tool = new THREE.Vector3();
      let time = 0,
        lastMode = '',
        lastText = -1,
        explode = 0,
        explodeVelocity = 0;
      const smooth = (x: number) => {
        const v = Math.max(0, Math.min(1, x));
        return v * v * (3 - 2 * v);
      };
      const mix = (a: number[], b: number[], p: number) =>
        a.map((v, i) => v + (b[i] - v) * p);
      const setPose = (rig: ReturnType<typeof makeArm>, q: number[]) => {
        rig.base.rotation.z = q[0];
        rig.shoulder.rotation.y = q[1];
        rig.elbow.rotation.y = q[2];
        rig.wrist.rotation.y = q[3];
      };
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
      update = (dt: number) => {
        const mode = (host.dataset.lesson || 'model') as ArmLesson;
        if (mode !== lastMode) {
          time = 0;
          lastText = -1;
          lastMode = mode;
        }
        time += dt;
        const t = reduced.matches ? (mode === 'contact' ? 7 : 2.7) : time;
        let desired = [...armPoses.home],
          grip = 0,
          separation = 0,
          stage = '运动链 · 父级 → 子级';
        if (mode === 'model') {
          separation = (0.5 - 0.5 * Math.cos(t * 0.55)) * 0.095;
          desired[0] = -0.18;
          desired[1] = 0.35;
          desired[2] = 0.85;
          desired[3] = Math.PI - 1.2;
        } else if (mode === 'control') {
          const phase = Math.sin(t * 0.65);
          desired = [
            -0.18,
            0.45 + phase * 0.23,
            0.72 - phase * 0.18,
            Math.PI - 1.17 - phase * 0.05,
          ];
          setPose(targetArm, [
            -0.18,
            0.45 + Math.sin(t * 0.65 + 0.6) * 0.23,
            0.72 - Math.sin(t * 0.65 + 0.6) * 0.18,
            Math.PI - 1.17 - Math.sin(t * 0.65 + 0.6) * 0.05,
          ]);
          stage = '线框：目标 / 实体：响应';
        } else if (mode === 'sensors') {
          desired = [
            Math.sin(t * 0.42) * 0.3,
            0.48 + Math.sin(t * 0.55) * 0.12,
            0.7 - Math.sin(t * 0.55) * 0.08,
            Math.PI - 1.18 - Math.sin(t * 0.55) * 0.04,
          ];
          stage = 'tool_tip · 世界坐标 / m';
        } else {
          const p = t % 14;
          const reach =
            smooth(p / 2) -
            smooth((p - 4) / 3) +
            smooth((p - 8) / 2) -
            smooth((p - 11) / 3);
          desired = mix(armPoses.home, armPoses.grasp, reach);
          grip = smooth((p - 2) / 1.2) - smooth((p - 10) / 1);
          stage =
            p < 2
              ? '01 / 对准方块'
              : p < 4
                ? '02 / 夹爪闭合'
                : p < 8
                  ? '03 / 抬起观察'
                  : p < 10
                    ? '04 / 放回台面'
                    : '05 / 松开，返回';
        }
        pose.forEach((value, i) => {
          const next = settle(value, velocities[i], desired[i], dt, 0.3);
          pose[i] = reduced.matches ? desired[i] : next.value;
          velocities[i] = next.velocity;
        });
        const next = settle(explode, explodeVelocity, separation, dt, 0.3);
        explode = reduced.matches ? separation : next.value;
        explodeVelocity = next.velocity;
        setPose(arm, pose);
        arm.elbow.position.z = 0.4 + explode;
        arm.wrist.position.z = 0.36 + explode;
        arm.fingers.forEach(
          (finger, i) =>
            (finger.position.y = (i ? 1 : -1) * (0.09 - grip * 0.045)),
        );
        arm.axes.forEach((axis) => (axis.visible = mode === 'model'));
        toolAxes.visible = mode === 'sensors';
        pulse.visible = mode === 'sensors';
        targetArm.root.visible = mode === 'control';
        table.visible = cube.visible = mode === 'contact';
        arrows.forEach(
          (arrow) => (arrow.visible = mode === 'contact' && grip > 0.75),
        );
        const phase = (t * 0.6) % 1;
        pulse.scale.setScalar(0.8 + phase * 1.5);
        pulseMaterial.opacity = (1 - phase) * 0.55;
        scene.updateMatrixWorld();
        arm.tip.getWorldPosition(tool);
        if (mode === 'contact') {
          cube.position.set(0.58176, 0, 0.115);
          // A storyboard preview, never displayed as a physics result.
          if (grip > 0.99) {
            cube.position.copy(tool);
            arm.wrist.getWorldQuaternion(cube.quaternion);
          } else cube.quaternion.identity();
        }
        if (t - lastText > 0.1 || lastText < 0) {
          caption.textContent = stage;
          readout.textContent =
            mode === 'sensors'
              ? `x ${tool.x.toFixed(3)}  y ${tool.y.toFixed(3)}  z ${tool.z.toFixed(3)}`
              : mode === 'control'
                ? 'τ = Kp · e − Kd · q̇'
                : mode === 'model'
                  ? 'body / joint / geom'
                  : '接触 · 摩擦 · 抬升';
          lastText = t;
        }
        renderer?.render(scene, camera);
      };
      disposeScene = () => {
        const geometries = new Set<THREE.BufferGeometry>(),
          materials = new Set<THREE.Material>();
        scene.traverse((object) => {
          if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
            geometries.add(object.geometry);
            (Array.isArray(object.material)
              ? object.material
              : [object.material]
            ).forEach((m) => materials.add(m));
          }
        });
        geometries.forEach((g) => g.dispose());
        materials.forEach((m) => m.dispose());
        texture.dispose();
        renderer?.dispose();
      };
      resize();
      await renderer.compileAsync(scene, camera);
      if (disposed) return;
      ready = true;
      host.dataset.ready = 'true';
      update(0);
      wake();
    } catch {
      host.dataset.ready = 'false';
      disposeScene();
      renderer?.dispose();
    }
  };
  const observer = new IntersectionObserver((entries) => {
    active = entries[0].isIntersecting;
    host.dataset.active = String(active);
    if (active && !preparing) void prepare();
    wake();
  });
  const resizer = new ResizeObserver(() => resize());
  const change = () => wake();
  observer.observe(host);
  resizer.observe(canvas);
  reduced.addEventListener('change', change);
  document.addEventListener('visibilitychange', change);
  host.addEventListener('arm-preview-change', change);
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
      reduced.removeEventListener('change', change);
      document.removeEventListener('visibilitychange', change);
      host.removeEventListener('arm-preview-change', change);
      disposeScene();
    },
    { once: true },
  );
  window.addEventListener('pageshow', () => {
    loop.suspend(false);
    wake();
  });
}
