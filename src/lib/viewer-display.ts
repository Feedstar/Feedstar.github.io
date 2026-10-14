import * as THREE from 'three';
export type ViewerDisplay = {
  contacts: boolean;
  forces: boolean;
  joints: boolean;
  com: boolean;
  frames: boolean;
  wireframe: boolean;
  transparent: boolean;
};
export const defaultViewerDisplay: ViewerDisplay = {
  contacts: false,
  forces: false,
  joints: false,
  com: false,
  frames: false,
  wireframe: false,
  transparent: false,
};
export type ViewerDiagnostics = {
  contacts: number[];
  forces: number[];
  joints: number[];
  com: number[];
  target: number[] | null;
  anchor: number[] | null;
};
export function createViewerDisplay(scene: THREE.Scene) {
  const group = new THREE.Group();
  scene.add(group);
  const points = new THREE.Points(
    new THREE.BufferGeometry(),
    new THREE.PointsMaterial({
      color: '#ffca7b',
      size: 7,
      sizeAttenuation: false,
      depthTest: false,
    }),
  );
  const centers = new THREE.Points(
    new THREE.BufferGeometry(),
    new THREE.PointsMaterial({
      color: '#9be2d7',
      size: 6,
      sizeAttenuation: false,
      depthTest: false,
    }),
  );
  const lines = new THREE.LineSegments(
    new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({ vertexColors: true, depthTest: false }),
  );
  group.add(points, centers, lines);
  group.traverse((o) => {
    o.renderOrder = 8;
    o.frustumCulled = false;
  });
  const flags = { ...defaultViewerDisplay };
  let meshes: THREE.Mesh[] = [];
  const p = new THREE.Vector3(),
    v = new THREE.Vector3(),
    end = new THREE.Vector3(),
    side = new THREE.Vector3(),
    q = new THREE.Quaternion();
  function setBuffer(
    geometry: THREE.BufferGeometry,
    key: string,
    values: number[],
  ) {
    let attr = geometry.getAttribute(key) as THREE.BufferAttribute | undefined;
    if (!attr || attr.array.length < values.length) {
      attr = new THREE.BufferAttribute(
        new Float32Array(Math.max(96, values.length * 2)),
        3,
      );
      geometry.setAttribute(key, attr);
    }
    attr.array.set(values);
    attr.needsUpdate = true;
    if (key === 'position') geometry.setDrawRange(0, values.length / 3);
  }
  return {
    setModel(objects: THREE.Mesh[]) {
      meshes = objects;
      for (const mesh of meshes)
        mesh.userData.viewerOpacity = (
          mesh.material as THREE.MeshStandardMaterial
        ).opacity;
      this.setFlags(flags);
    },
    setFlags(next: ViewerDisplay) {
      Object.assign(flags, next);
      for (const mesh of meshes) {
        const material = mesh.material as THREE.MeshStandardMaterial;
        material.wireframe = flags.wireframe;
        material.opacity =
          mesh.userData.viewerOpacity * (flags.transparent ? 0.3 : 1);
        material.transparent = material.opacity < 1;
        material.depthWrite = !material.transparent;
      }
    },
    update(
      data: ViewerDiagnostics | undefined,
      positions: ArrayLike<number>,
      quaternions: ArrayLike<number>,
    ) {
      const vertices: number[] = [],
        colors: number[] = [];
      function segment(
        a: THREE.Vector3,
        b: THREE.Vector3,
        color: [number, number, number],
      ) {
        vertices.push(...a.toArray(), ...b.toArray());
        colors.push(...color, ...color);
      }
      function arrow(
        origin: number[],
        direction: number[],
        length: number,
        color: [number, number, number],
      ) {
        p.fromArray(origin);
        v.fromArray(direction).normalize();
        end.copy(p).addScaledVector(v, length);
        segment(p, end, color);
        side
          .crossVectors(
            v,
            Math.abs(v.z) < 0.9
              ? new THREE.Vector3(0, 0, 1)
              : new THREE.Vector3(0, 1, 0),
          )
          .normalize();
        for (const sign of [-1, 1]) {
          const tip = end
            .clone()
            .addScaledVector(v, -Math.min(length * 0.25, 0.035))
            .addScaledVector(side, sign * Math.min(length * 0.12, 0.018));
          segment(end, tip, color);
        }
      }
      if (flags.forces && data)
        for (let i = 0; i < data.forces.length; i += 6) {
          const f = data.forces.slice(i + 3, i + 6),
            magnitude = Math.hypot(...f);
          if (magnitude > 1e-6)
            arrow(
              data.forces.slice(i, i + 3),
              f,
              Math.min(0.6, Math.log1p(magnitude) * 0.045),
              [1, 0.65, 0.3],
            );
        }
      if (flags.joints && data)
        for (let i = 0; i < data.joints.length; i += 6)
          arrow(
            data.joints.slice(i, i + 3),
            data.joints.slice(i + 3, i + 6),
            0.16,
            [0.5, 0.85, 1],
          );
      if (flags.frames)
        for (let i = 1; i < positions.length / 3; i++) {
          p.fromArray(positions, i * 3);
          const b = i * 4;
          q.set(
            quaternions[b + 1],
            quaternions[b + 2],
            quaternions[b + 3],
            quaternions[b],
          );
          (
            [
              [1, 0, 0],
              [0, 1, 0],
              [0, 0, 1],
            ] as [number, number, number][]
          ).forEach((axis, j) => {
            end.fromArray(axis).applyQuaternion(q).multiplyScalar(0.1).add(p);
            segment(
              p,
              end,
              (
                [
                  [1, 0.35, 0.3],
                  [0.4, 0.9, 0.5],
                  [0.35, 0.6, 1],
                ] as [number, number, number][]
              )[j],
            );
          });
        }
      setBuffer(
        points.geometry,
        'position',
        flags.contacts ? (data?.contacts ?? []) : [],
      );
      setBuffer(
        centers.geometry,
        'position',
        flags.com ? (data?.com ?? []).slice(3) : [],
      );
      setBuffer(lines.geometry, 'position', vertices);
      setBuffer(lines.geometry, 'color', colors);
    },
    dispose() {
      scene.remove(group);
      for (const object of [points, centers, lines]) {
        object.geometry.dispose();
        object.material.dispose();
      }
    },
  };
}
