import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { previewPixelRatio } from './preview-loop.mjs';
import type { ArmReady, ArmState } from './arm-types';

export function createArmView(canvas: HTMLCanvasElement) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor('#15191f');
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.4;
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog('#15191f', 4, 9);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.02, 30);
  camera.up.set(0, 0, 1);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.09;
  controls.minDistance = 0.8;
  controls.maxDistance = 5;
  controls.maxPolarAngle = Math.PI * 0.49;
  const resetCamera = () => {
    camera.position.set(1.5, -1.85, 1.2);
    controls.target.set(0.22, 0, 0.43);
    controls.update();
  };
  resetCamera();
  scene.add(new THREE.HemisphereLight('#e6efff', '#45433d', 2.1));
  const light = new THREE.DirectionalLight('#fff2dc', 3.5);
  light.position.set(2, -3, 5);
  scene.add(light);
  const edge = new THREE.DirectionalLight('#bfdde1', 2);
  edge.position.set(-2, 2, 3);
  scene.add(edge);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(18, 18),
    new THREE.MeshStandardMaterial({ color: '#161b20', roughness: 0.95 }),
  );
  ground.position.z = -0.008;
  scene.add(ground);
  const grid = new THREE.GridHelper(6, 60, '#59636b', '#343d44');
  grid.rotation.x = Math.PI / 2;
  grid.position.z = -0.006;
  grid.material.transparent = true;
  grid.material.opacity = 0.45;
  scene.add(grid);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.78, 0.784, 100),
    new THREE.MeshBasicMaterial({
      color: '#96b1ae',
      transparent: true,
      opacity: 0.32,
    }),
  );
  ring.position.z = -0.004;
  scene.add(ring);
  const axes = new THREE.AxesHelper(0.19);
  (axes.material as THREE.Material).depthTest = false;
  axes.renderOrder = 2;
  scene.add(axes);
  const geoms = new Map<number, THREE.Mesh>();
  const bodies = new Map<number, number>();
  const materials = new Map<string, THREE.MeshStandardMaterial>();
  let current: ArmState | null = null,
    previous: ArmState | null = null;
  let received = 0,
    interval = 16,
    body = -1,
    showAxes = true,
    active = false,
    frame = 0,
    disposed = false;
  const mat = new THREE.Matrix4(),
    q = new THREE.Quaternion(),
    pq = new THREE.Quaternion();
  const p = new THREE.Vector3(),
    pp = new THREE.Vector3();
  const matrixQuaternion = (
    values: Float32Array,
    offset: number,
    out: THREE.Quaternion,
  ) => {
    mat.set(
      values[offset],
      values[offset + 1],
      values[offset + 2],
      0,
      values[offset + 3],
      values[offset + 4],
      values[offset + 5],
      0,
      values[offset + 6],
      values[offset + 7],
      values[offset + 8],
      0,
      0,
      0,
      0,
      1,
    );
    out.setFromRotationMatrix(mat);
  };
  const draw = (now: number) => {
    frame = 0;
    if (disposed || !active || document.hidden) return;
    if (current) {
      const alpha = previous
        ? THREE.MathUtils.clamp((now - received) / interval, 0, 1)
        : 1;
      geoms.forEach((mesh, id) => {
        p.fromArray(current!.positions, id * 3);
        matrixQuaternion(current!.matrices, id * 9, q);
        if (previous) {
          pp.fromArray(previous.positions, id * 3);
          matrixQuaternion(previous.matrices, id * 9, pq);
          mesh.position.lerpVectors(pp, p, alpha);
          mesh.quaternion.slerpQuaternions(pq, q, alpha);
        } else {
          mesh.position.copy(p);
          mesh.quaternion.copy(q);
        }
      });
      axes.visible = showAxes && body >= 0;
      if (axes.visible) {
        axes.position.fromArray(current.bodyPositions, body * 3);
        const values = current.bodyQuaternions,
          b = body * 4;
        axes.quaternion.set(
          values[b + 1],
          values[b + 2],
          values[b + 3],
          values[b],
        );
      }
    }
    controls.update();
    renderer.render(scene, camera);
    frame = requestAnimationFrame(draw);
  };
  const wake = () => {
    if (active && !document.hidden && !frame && !disposed)
      frame = requestAnimationFrame(draw);
    else if ((!active || document.hidden) && frame) {
      cancelAnimationFrame(frame);
      frame = 0;
    }
  };
  document.addEventListener('visibilitychange', wake);
  const resize = new ResizeObserver(() => {
    const { width, height } = canvas.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setPixelRatio(previewPixelRatio(width, height, devicePixelRatio));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  });
  resize.observe(canvas);
  return {
    setModel(model: ArmReady) {
      for (const geom of model.geoms) {
        if (geom.type === 0) continue;
        const s = geom.size;
        const geometry =
          geom.type === 2
            ? new THREE.SphereGeometry(s[0], 20, 16)
            : geom.type === 3
              ? new THREE.CapsuleGeometry(s[0], 2 * s[1], 8, 20).rotateX(
                  Math.PI / 2,
                )
              : geom.type === 5
                ? new THREE.CylinderGeometry(s[0], s[0], 2 * s[1], 20).rotateX(
                    Math.PI / 2,
                  )
                : new THREE.BoxGeometry(s[0] * 2, s[1] * 2, s[2] * 2);
        const key = geom.color.join(',');
        if (!materials.has(key))
          materials.set(
            key,
            new THREE.MeshStandardMaterial({
              color: new THREE.Color().setRGB(
                geom.color[0],
                geom.color[1],
                geom.color[2],
                THREE.SRGBColorSpace,
              ),
              roughness: 0.5,
              metalness: 0.12,
              opacity: geom.color[3],
              transparent: geom.color[3] < 1,
            }),
          );
        const mesh = new THREE.Mesh(geometry, materials.get(key));
        mesh.material = mesh.material.clone();
        geoms.set(geom.id, mesh);
        bodies.set(geom.id, geom.body);
        scene.add(mesh);
      }
    },
    setState(state: ArmState) {
      previous =
        current && state.time >= current.time && state.time - current.time < 0.1
          ? current
          : null;
      const now = performance.now();
      interval = Math.min(40, Math.max(8, now - received));
      received = now;
      current = state;
    },
    setBody(id: number, visible: boolean) {
      body = id;
      showAxes = visible;
      geoms.forEach((mesh, geomId) => {
        const material = mesh.material as THREE.MeshStandardMaterial;
        material.emissive.set(
          bodies.get(geomId) === id ? '#25443c' : '#000000',
        );
        material.emissiveIntensity = 0.5;
      });
    },
    setActive(value: boolean) {
      active = value;
      wake();
    },
    resetCamera,
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      resize.disconnect();
      document.removeEventListener('visibilitychange', wake);
      controls.dispose();
      const geometries = new Set<THREE.BufferGeometry>();
      const allMaterials = new Set<THREE.Material>();
      scene.traverse((object) => {
        if (
          object instanceof THREE.Mesh ||
          object instanceof THREE.LineSegments
        ) {
          geometries.add(object.geometry);
          (Array.isArray(object.material)
            ? object.material
            : [object.material]
          ).forEach((m) => allMaterials.add(m));
        }
      });
      geometries.forEach((g) => g.dispose());
      allMaterials.forEach((m) => m.dispose());
      materials.forEach((m) => m.dispose());
      renderer.dispose();
    },
  };
}
