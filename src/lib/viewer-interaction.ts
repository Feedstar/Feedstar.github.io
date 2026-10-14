import * as THREE from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
export type ViewerBody = {
  id: number;
  name: string;
  movable: boolean;
  mocap: boolean;
};
export type ViewerStatus = {
  name: string;
  movable: boolean;
  dragging: boolean;
  mocap: boolean;
};
export type ViewerAPI = {
  setMode(mode: 'camera' | 'force'): void;
  setRunning(running: boolean): void;
  cancel(): void;
  focus(): void;
  resetCamera(): void;
};
export type ViewerOptions = {
  onForce?: (
    request: { body: number; local: number[]; target: number[] } | null,
  ) => void;
  onSelection?: (body: ViewerBody | null) => void;
  onStatus?: (status: ViewerStatus) => void;
  onMocapDrag?: (body: number, position: number[]) => void;
};
type Pose = {
  bodyPositions: ArrayLike<number>;
  bodyQuaternions: ArrayLike<number>;
};

export function createViewerInteraction(
  canvas: HTMLCanvasElement,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
  options: ViewerOptions,
) {
  let meshes: THREE.Mesh[] = [],
    bodies: ViewerBody[] = [],
    state: Pose | null = null;
  let selected = -1,
    mode: 'camera' | 'force' = 'camera',
    running = true;
  let pointerId: number | null = null,
    lastSent = 0;
  let dragMesh: THREE.Mesh | null = null;
  const ray = new THREE.Raycaster(),
    pointer = new THREE.Vector2(),
    plane = new THREE.Plane();
  const local = new THREE.Vector3(),
    meshLocal = new THREE.Vector3(),
    target = new THREE.Vector3();
  const anchor = new THREE.Vector3(),
    offset = new THREE.Vector3(),
    point = new THREE.Vector3();
  const rotation = new THREE.Quaternion(),
    normal = new THREE.Vector3(),
    delta = new THREE.Vector3();
  const tetherGeometry = new THREE.BufferGeometry();
  tetherGeometry.setAttribute(
    'position',
    new THREE.BufferAttribute(new Float32Array(6), 3),
  );
  const tether = new THREE.Line(
    tetherGeometry,
    new THREE.LineBasicMaterial({ color: '#edd0a0', depthTest: false }),
  );
  tether.frustumCulled = false;
  const markerGeometry = new THREE.SphereGeometry(0.013, 12, 8);
  const markerMaterial = new THREE.MeshBasicMaterial({
    color: '#ffe1a9',
    depthTest: false,
  });
  const marker = new THREE.Mesh(markerGeometry, markerMaterial),
    cursor = new THREE.Mesh(markerGeometry, markerMaterial);
  const overlay = new THREE.Group();
  overlay.add(tether, marker, cursor);
  overlay.traverse((o) => {
    o.renderOrder = 10;
  });
  overlay.visible = false;
  scene.add(overlay);
  const status = () => {
    const b = bodies.find((b) => b.id === selected);
    options.onStatus?.({
      name: b?.name ?? '',
      movable: !!b?.movable,
      mocap: !!b?.mocap,
      dragging: pointerId !== null,
    });
  };
  const select = (id: number) => {
    selected = id;
    for (const mesh of meshes) {
      const material = mesh.material as THREE.MeshStandardMaterial;
      if (material.emissive) {
        material.emissive.set(
          mesh.userData.viewerBody === id && id > 0 ? '#49786c' : '#000000',
        );
        material.emissiveIntensity = 0.55;
      }
    }
    options.onSelection?.(bodies.find((b) => b.id === id) ?? null);
    status();
  };
  function cancel() {
    const id = pointerId;
    pointerId = null;
    dragMesh = null;
    overlay.visible = false;
    controls.enabled = true;
    canvas.style.cursor = mode === 'force' ? 'crosshair' : 'grab';
    if (id !== null) {
      options.onForce?.(null);
      if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
      status();
    }
  }
  function cast(e: MouseEvent) {
    const r = canvas.getBoundingClientRect();
    pointer.set(
      ((e.clientX - r.left) / r.width) * 2 - 1,
      1 - ((e.clientY - r.top) / r.height) * 2,
    );
    scene.updateMatrixWorld(true);
    camera.updateMatrixWorld();
    ray.setFromCamera(pointer, camera);
  }
  function emitForce() {
    if (pointerId === null || bodies.find((b) => b.id === selected)?.mocap)
      return;
    options.onForce?.({
      body: selected,
      local: local.toArray(),
      target: target.toArray(),
    });
    lastSent = performance.now();
  }
  function down(e: PointerEvent) {
    if (
      !e.isPrimary ||
      e.shiftKey ||
      e.button !== 0 ||
      (mode !== 'force' && !e.ctrlKey && !e.metaKey)
    )
      return;
    // Capture before OrbitControls so dragging a body never also moves the camera.
    e.preventDefault();
    e.stopImmediatePropagation();
    canvas.focus({ preventScroll: true });
    cancel();
    if (!state) return;
    cast(e);
    const hit = ray.intersectObjects(meshes, false)[0];
    if (!hit) {
      select(-1);
      return;
    }
    const id = hit.object.userData.viewerBody as number;
    select(id);
    const body = bodies.find((b) => b.id === id);
    if (!body || (!body.movable && !body.mocap) || (!running && !body.mocap))
      return;
    dragMesh = hit.object as THREE.Mesh;
    meshLocal.copy(hit.point);
    dragMesh.worldToLocal(meshLocal);
    point.fromArray(state.bodyPositions, id * 3);
    const b = id * 4,
      q = state.bodyQuaternions;
    rotation.set(q[b + 1], q[b + 2], q[b + 3], q[b]);
    local.copy(hit.point).sub(point).applyQuaternion(rotation.invert());
    offset.copy(hit.point).sub(point);
    target.copy(hit.point);
    if (body.mocap) normal.set(0, 0, 1);
    else camera.getWorldDirection(normal);
    plane.setFromNormalAndCoplanarPoint(normal, hit.point);
    pointerId = e.pointerId;
    controls.enabled = false;
    canvas.setPointerCapture(e.pointerId);
    canvas.style.cursor = 'grabbing';
    overlay.visible = true;
    status();
    emitForce();
  }
  function move(e: PointerEvent) {
    if (pointerId !== e.pointerId || !dragMesh) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    cast(e);
    if (!ray.ray.intersectPlane(plane, point)) return;
    anchor.copy(meshLocal);
    dragMesh.localToWorld(anchor);
    delta.copy(point).sub(anchor).clampLength(0, 0.75);
    target.copy(anchor).add(delta);
    const body = bodies.find((b) => b.id === selected);
    if (body?.mocap)
      options.onMocapDrag?.(selected, point.sub(offset).toArray());
    else emitForce();
  }
  function up(e: PointerEvent) {
    if (pointerId !== e.pointerId) return;
    e.stopImmediatePropagation();
    cancel();
  }
  function dblclick(e: MouseEvent) {
    e.preventDefault();
    cast(e);
    const hit = ray.intersectObjects(meshes, false)[0];
    select(hit ? hit.object.userData.viewerBody : -1);
  }
  function visibility() {
    if (document.hidden) cancel();
  }
  function key(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      cancel();
      select(-1);
    }
  }
  canvas.addEventListener('pointerdown', down, true);
  canvas.addEventListener('pointermove', move, true);
  canvas.addEventListener('pointerup', up, true);
  canvas.addEventListener('pointercancel', up, true);
  canvas.addEventListener('lostpointercapture', cancel);
  canvas.addEventListener('dblclick', dblclick);
  canvas.addEventListener('keydown', key);
  window.addEventListener('blur', cancel);
  document.addEventListener('visibilitychange', visibility);
  return {
    setModel(objects: THREE.Mesh[], metadata: ViewerBody[]) {
      meshes = objects;
      bodies = metadata;
      select(-1);
    },
    setState(pose: Pose) {
      state = pose;
    },
    select,
    setMode(value: 'camera' | 'force') {
      cancel();
      mode = value;
      canvas.style.cursor = mode === 'force' ? 'crosshair' : 'grab';
    },
    setRunning(value: boolean) {
      running = value;
      if (!value) cancel();
    },
    cancel,
    focus() {
      if (!state || selected < 0) return;
      cancel();
      point.fromArray(state.bodyPositions, selected * 3);
      delta.copy(point).sub(controls.target);
      camera.position.add(delta);
      controls.target.copy(point);
      controls.update();
    },
    draw() {
      if (!dragMesh || pointerId === null) return;
      anchor.copy(meshLocal);
      dragMesh.localToWorld(anchor);
      const positions = tetherGeometry.getAttribute(
        'position',
      ) as THREE.BufferAttribute;
      positions.setXYZ(0, anchor.x, anchor.y, anchor.z);
      positions.setXYZ(1, target.x, target.y, target.z);
      positions.needsUpdate = true;
      marker.position.copy(anchor);
      cursor.position.copy(target);
      if (performance.now() - lastSent > 200) emitForce();
    },
    dispose() {
      cancel();
      scene.remove(overlay);
      tetherGeometry.dispose();
      tether.material.dispose();
      markerGeometry.dispose();
      markerMaterial.dispose();
      canvas.removeEventListener('pointerdown', down, true);
      canvas.removeEventListener('pointermove', move, true);
      canvas.removeEventListener('pointerup', up, true);
      canvas.removeEventListener('pointercancel', up, true);
      canvas.removeEventListener('lostpointercapture', cancel);
      canvas.removeEventListener('dblclick', dblclick);
      canvas.removeEventListener('keydown', key);
      window.removeEventListener('blur', cancel);
      document.removeEventListener('visibilitychange', visibility);
    },
  };
}
