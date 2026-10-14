import * as THREE from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  createViewerDisplay,
  type ViewerDisplay,
  type ViewerDiagnostics,
} from './viewer-display';
export type ViewerMode = 'camera' | 'force' | 'rotate';
export type ViewerBody = {
  id: number;
  name: string;
  parent: number;
  mass: number;
  movable: boolean;
  mocap: boolean;
  editable: boolean;
};
export type ViewerStatus = {
  name: string;
  movable: boolean;
  dragging: boolean;
  mocap: boolean;
  editable: boolean;
  following: boolean;
  mass: number;
};
export type ViewerAPI = {
  setMode(mode: ViewerMode): void;
  setRunning(running: boolean): void;
  setDisplay(flags: ViewerDisplay): void;
  cancel(): void;
  focus(): void;
  follow(): void;
  resetCamera(): void;
};
export type PerturbRequest =
  | {
      kind: 'begin';
      body: number;
      local: number[];
      active: 1 | 2;
      camera: {
        position: number[];
        forward: number[];
        up: number[];
        fov: number;
        aspect: number;
      };
    }
  | { kind: 'move'; action: number; dx: number; dy: number }
  | { kind: 'keepalive' }
  | null;
export type ViewerOptions = {
  onForce?: (request: PerturbRequest) => void;
  onSelection?: (body: ViewerBody | null) => void;
  onStatus?: (status: ViewerStatus) => void;
  onCommand?: (command: string) => void;
  onStats?: (stats: { time: number; contacts: number; fps: number }) => void;
};
type Pose = {
  bodyPositions: ArrayLike<number>;
  bodyQuaternions: ArrayLike<number>;
  viewer?: ViewerDiagnostics;
  time?: number;
  contacts?: number;
  ncon?: number;
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
    mode: ViewerMode = 'camera',
    running = true,
    following = false;
  let pointerId: number | null = null,
    panning = false,
    rotating = false,
    lastX = 0,
    lastY = 0,
    lastSent = 0,
    lastRight = 0;
  let frames = 0,
    lastStats = performance.now();
  const local = new THREE.Vector3(),
    pointer = new THREE.Vector2(),
    ray = new THREE.Raycaster();
  const point = new THREE.Vector3(),
    delta = new THREE.Vector3(),
    forward = new THREE.Vector3(),
    right = new THREE.Vector3(),
    q = new THREE.Quaternion();
  const display = createViewerDisplay(scene);
  const geometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(),
    new THREE.Vector3(),
  ]);
  const tether = new THREE.Line(
    geometry,
    new THREE.LineBasicMaterial({ color: '#edd0a0', depthTest: false }),
  );
  tether.frustumCulled = false;
  tether.renderOrder = 10;
  tether.visible = false;
  scene.add(tether);
  const body = () => bodies.find((b) => b.id === selected);
  function status() {
    const b = body();
    options.onStatus?.({
      name: b?.name ?? '',
      movable: !!b?.movable,
      mocap: !!b?.mocap,
      editable: !!b?.editable,
      mass: b?.mass ?? 0,
      dragging: pointerId !== null && !panning,
      following,
    });
  }
  function cancel() {
    const id = pointerId;
    pointerId = null;
    panning = false;
    tether.visible = false;
    controls.enabled = true;
    canvas.style.cursor = mode === 'camera' ? 'grab' : 'crosshair';
    if (id !== null) {
      options.onForce?.(null);
      if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
      status();
    }
  }
  function select(id: number, hit?: THREE.Vector3) {
    if (selected !== id) cancel();
    selected = id;
    local.set(0, 0, 0);
    if (hit && state && id > 0) {
      const b = id * 4,
        values = state.bodyQuaternions;
      q.set(values[b + 1], values[b + 2], values[b + 3], values[b]);
      local
        .copy(hit)
        .sub(point.fromArray(state.bodyPositions, id * 3))
        .applyQuaternion(q.invert());
    }
    if (id <= 0) following = false;
    for (const mesh of meshes) {
      const material = mesh.material as THREE.MeshStandardMaterial;
      material.emissive?.set(
        mesh.userData.viewerBody === id && id > 0 ? '#49786c' : '#000000',
      );
      material.emissiveIntensity = 0.55;
    }
    options.onSelection?.(body() ?? null);
    status();
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
    return ray.intersectObjects(
      meshes.filter((m) => m.visible),
      false,
    )[0];
  }
  function focus() {
    if (!state || selected < 0) return;
    point.fromArray(state.bodyPositions, selected * 3);
    delta.copy(point).sub(controls.target);
    camera.position.add(delta);
    controls.target.copy(point);
    controls.update();
  }
  function down(e: PointerEvent) {
    if (!e.isPrimary) return;
    canvas.focus({ preventScroll: true });
    // OrbitControls otherwise turns Shift + left into panning. Keep it a camera rotation.
    controls.mouseButtons.LEFT = e.shiftKey
      ? THREE.MOUSE.PAN
      : THREE.MOUSE.ROTATE;
    const modified = e.ctrlKey || e.metaKey;
    const perturbing =
      (modified && (e.button === 0 || e.button === 2)) ||
      (mode !== 'camera' && e.button === 0);
    // Native right-drag pans in a vertical plane; Shift moves in the ground plane.
    if (!perturbing && e.button !== 2) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    cancel();
    if (e.button === 2 && performance.now() - lastRight < 320) {
      lastRight = 0;
      const hit = cast(e);
      if (hit) {
        select(hit.object.userData.viewerBody, hit.point);
        focus();
        following = modified && selected > 0;
        status();
      }
      return;
    }
    if (e.button === 2) lastRight = performance.now();
    lastX = e.clientX;
    lastY = e.clientY;
    if (perturbing) {
      if (!state) return;
      const hit = cast(e);
      // Toolbar modes pick directly; native Ctrl gestures keep the selected body.
      if ((mode !== 'camera' || selected < 1) && hit)
        select(hit.object.userData.viewerBody, hit.point);
      const b = body();
      if (!b || (!b.movable && !b.mocap) || (!running && !b.editable)) return;
      rotating = modified ? e.button === 0 : mode === 'rotate';
      camera.getWorldDirection(forward);
      options.onForce?.({
        kind: 'begin',
        body: selected,
        local: local.toArray(),
        active: rotating ? 2 : 1,
        camera: {
          position: camera.position.toArray(),
          forward: forward.toArray(),
          up: new THREE.Vector3(0, 1, 0)
            .applyQuaternion(camera.quaternion)
            .toArray(),
          fov: camera.fov,
          aspect: camera.aspect,
        },
      });
      lastSent = performance.now();
    } else {
      panning = true;
      following = false;
    }
    pointerId = e.pointerId;
    controls.enabled = false;
    canvas.setPointerCapture(e.pointerId);
    canvas.style.cursor = 'grabbing';
    status();
  }
  function move(e: PointerEvent) {
    if (pointerId !== e.pointerId) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const height = Math.max(1, canvas.clientHeight),
      dx = (e.clientX - lastX) / height,
      dy = (e.clientY - lastY) / height;
    lastX = e.clientX;
    lastY = e.clientY;
    if (Math.abs(dx) + Math.abs(dy) > 0.002) lastRight = 0;
    if (panning) {
      camera.getWorldDirection(forward);
      forward.z = 0;
      forward.normalize();
      right.set(forward.y, -forward.x, 0);
      const scale =
        2 *
        camera.position.distanceTo(controls.target) *
        Math.tan((camera.fov * Math.PI) / 360);
      delta.copy(right).multiplyScalar(-dx * scale);
      if (e.shiftKey) delta.addScaledVector(forward, dy * scale);
      else delta.z += dy * scale;
      camera.position.add(delta);
      controls.target.add(delta);
      controls.update();
    } else {
      options.onForce?.({
        kind: 'move',
        action: rotating ? (e.shiftKey ? 2 : 1) : e.shiftKey ? 4 : 3,
        dx,
        dy,
      });
      lastSent = performance.now();
    }
  }
  function up(e: PointerEvent) {
    if (pointerId === e.pointerId) {
      e.stopImmediatePropagation();
      cancel();
    }
  }
  function dblclick(e: MouseEvent) {
    if (e.button !== 0) return;
    e.preventDefault();
    const hit = cast(e);
    select(hit ? hit.object.userData.viewerBody : -1, hit?.point);
  }
  function visibility() {
    if (document.hidden) cancel();
  }
  function key(e: KeyboardEvent) {
    if (e.altKey) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      cancel();
      following = false;
      status();
      return;
    }
    if (e.key === 'PageUp') {
      e.preventDefault();
      select(body()?.parent ?? -1);
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
      e.preventDefault();
      following = false;
      options.onCommand?.('camera');
      status();
      return;
    }
    if (e.ctrlKey || e.metaKey) return;
    const command: Record<string, string> = {
      ' ': 'play',
      ArrowRight: 'step',
      Backspace: 'reset',
      '+': 'faster',
      '=': 'faster',
      '-': 'slower',
      F1: 'help',
      F2: 'stats',
      F5: 'fullscreen',
      F6: 'frames',
      c: 'contacts',
      f: 'forces',
      j: 'joints',
      m: 'com',
      w: 'wireframe',
      t: 'transparent',
    };
    const action = command[e.key] ?? command[e.key.toLowerCase()];
    if (action) {
      e.preventDefault();
      if (!e.repeat || action === 'step') options.onCommand?.(action);
    }
  }
  function context(e: MouseEvent) {
    e.preventDefault();
  }
  canvas.addEventListener('pointerdown', down, true);
  canvas.addEventListener('pointermove', move, true);
  canvas.addEventListener('pointerup', up, true);
  canvas.addEventListener('pointercancel', up, true);
  canvas.addEventListener('lostpointercapture', cancel);
  canvas.addEventListener('dblclick', dblclick);
  canvas.addEventListener('contextmenu', context);
  canvas.addEventListener('keydown', key);
  window.addEventListener('blur', cancel);
  document.addEventListener('visibilitychange', visibility);
  return {
    setModel(objects: THREE.Mesh[], metadata: ViewerBody[]) {
      meshes = objects;
      bodies = metadata;
      display.setModel(meshes);
      select(-1);
    },
    setState(pose: Pose) {
      state = pose;
      display.update(pose.viewer, pose.bodyPositions, pose.bodyQuaternions);
    },
    setDisplay(flags: ViewerDisplay) {
      display.setFlags(flags);
      if (state)
        display.update(
          state.viewer,
          state.bodyPositions,
          state.bodyQuaternions,
        );
    },
    select(id: number) {
      if (selected !== id) select(id);
    },
    setMode(value: ViewerMode) {
      cancel();
      mode = value;
      canvas.style.cursor = mode === 'camera' ? 'grab' : 'crosshair';
    },
    setRunning(value: boolean) {
      if (running !== value) cancel();
      running = value;
    },
    cancel,
    focus,
    follow() {
      if (selected > 0) {
        following = !following;
        focus();
        status();
      }
    },
    freeCamera() {
      following = false;
      status();
    },
    draw() {
      if (following && state) focus();
      tether.visible =
        pointerId !== null && !panning && !rotating && !!state?.viewer?.target;
      if (tether.visible) {
        const vertices = geometry.getAttribute(
          'position',
        ) as THREE.BufferAttribute;
        vertices.array.set(state!.viewer!.anchor!, 0);
        vertices.array.set(state!.viewer!.target!, 3);
        vertices.needsUpdate = true;
      }
      if (
        pointerId !== null &&
        !panning &&
        performance.now() - lastSent > 200
      ) {
        options.onForce?.({ kind: 'keepalive' });
        lastSent = performance.now();
      }
      frames++;
      const now = performance.now();
      if (now - lastStats > 500) {
        options.onStats?.({
          time: state?.time ?? 0,
          contacts: state?.contacts ?? state?.ncon ?? 0,
          fps: Math.round((frames * 1000) / (now - lastStats)),
        });
        frames = 0;
        lastStats = now;
      }
    },
    dispose() {
      cancel();
      display.dispose();
      scene.remove(tether);
      geometry.dispose();
      tether.material.dispose();
      canvas.removeEventListener('pointerdown', down, true);
      canvas.removeEventListener('pointermove', move, true);
      canvas.removeEventListener('pointerup', up, true);
      canvas.removeEventListener('pointercancel', up, true);
      canvas.removeEventListener('lostpointercapture', cancel);
      canvas.removeEventListener('dblclick', dblclick);
      canvas.removeEventListener('contextmenu', context);
      canvas.removeEventListener('keydown', key);
      window.removeEventListener('blur', cancel);
      document.removeEventListener('visibilitychange', visibility);
    },
  };
}
