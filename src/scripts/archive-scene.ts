import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { previewPixelRatio } from '../lib/preview-loop.mjs';

/** One GPU scene for an archive, never one renderer per card. */
export function createArchiveScene(canvas: HTMLCanvasElement, kind: string) {
  const host = canvas.parentElement!;
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: 'low-power',
  });
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = kind === 'journal' ? 1.35 : 1.05;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 60);
  camera.position.set(0, 0, 10);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, 0.05);
  scene.environment = environment.texture;
  room.dispose();
  pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xfff4db, 0x647e77, 2.2));
  const key = new THREE.DirectionalLight(0xfff9e8, 4);
  key.position.set(-3, 6, 5);
  scene.add(key);
  const rim = new THREE.DirectionalLight(
    kind === 'journal' ? 0xc0e5e1 : 0xf1ba79,
    3,
  );
  rim.position.set(4, 0, -3);
  scene.add(rim);
  const sculpture = new THREE.Group();
  scene.add(sculpture);
  const chrome = new THREE.MeshPhysicalMaterial({
    color: 0xd6e0d7,
    metalness: 0.91,
    roughness: 0.21,
    clearcoat: 0.8,
    clearcoatRoughness: 0.17,
    iridescence: 0.25,
    iridescenceIOR: 1.3,
  });
  const paper = new THREE.MeshPhysicalMaterial({
    color: 0xe7d5b9,
    metalness: 0.23,
    roughness: 0.36,
    side: THREE.DoubleSide,
    clearcoat: 0.4,
  });
  let paperTexture: THREE.CanvasTexture | null = null;
  if (kind === 'docs') {
    const sheet = document.createElement('canvas');
    sheet.width = 512;
    sheet.height = 640;
    const ink = sheet.getContext('2d')!;
    ink.fillStyle = '#e4d3b4';
    ink.fillRect(0, 0, 512, 640);
    ink.strokeStyle = '#9c825948';
    ink.lineWidth = 1;
    ink.strokeRect(35, 35, 442, 570);
    ink.fillStyle = '#715b3d';
    ink.font = '12px serif';
    ink.fillText('FEEDSTAR  /  WORKING ARCHIVE', 55, 75);
    ink.font = 'italic 42px serif';
    ink.fillText('In the making.', 55, 160);
    ink.fillStyle = '#9c8259';
    ink.font = '10px monospace';
    ink.fillText('OBSERVATION  —  PROCESS  —  REFLECTION', 55, 193);
    for (let row = 0; row < 16; row++) {
      ink.fillStyle = row % 4 === 0 ? '#7c664d65' : '#927f6050';
      ink.fillRect(55, 255 + row * 16, row % 5 === 4 ? 230 : 350, 2);
    }
    ink.beginPath();
    ink.arc(365, 540, 28, 0, Math.PI * 2);
    ink.stroke();
    paperTexture = new THREE.CanvasTexture(sheet);
    paperTexture.colorSpace = THREE.SRGBColorSpace;
    paper.map = paperTexture;
    paper.color.set(0xffffff);
    paper.roughness = 0.5;
    paper.metalness = 0.14;
  }
  const bronze = new THREE.MeshStandardMaterial({
    color: 0x9e7147,
    metalness: 0.8,
    roughness: 0.25,
  });
  const pieces: {
    mesh: THREE.Mesh;
    base: THREE.Vector3;
    rotation: THREE.Euler;
    direction: THREE.Vector3;
    index: number;
  }[] = [];
  const ownedGeometry = new Set<THREE.BufferGeometry>();
  const add = (
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    position: THREE.Vector3,
    rotation: THREE.Euler,
    direction: THREE.Vector3,
    index: number,
  ) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(position);
    mesh.rotation.copy(rotation);
    sculpture.add(mesh);
    ownedGeometry.add(geometry);
    pieces.push({
      mesh,
      base: position.clone(),
      rotation: rotation.clone(),
      direction,
      index,
    });
    return mesh;
  };
  if (kind === 'journal') {
    // Three nested gimbals split into arcs. Unfolding changes the structure itself.
    for (let ring = 0; ring < 3; ring++) {
      const ringRotation = new THREE.Euler(
        0.55 + ring * 0.55,
        ring * 0.85,
        -0.3 + ring * 0.45,
      );
      const ringQuaternion = new THREE.Quaternion().setFromEuler(ringRotation);
      for (let i = 0; i < 8; i++) {
        const angle = (i * Math.PI) / 4;
        const geometry = new THREE.TorusGeometry(
          1.5 - ring * 0.22,
          0.075 + ring * 0.018,
          12,
          20,
          Math.PI / 4 - 0.065,
        );
        geometry.rotateZ(angle);
        geometry.applyQuaternion(ringQuaternion);
        const direction = new THREE.Vector3(
          Math.cos(angle + 0.38),
          Math.sin(angle + 0.38),
          0.2 * Math.sin(i),
        ).applyQuaternion(ringQuaternion);
        add(
          geometry,
          ring === 1 ? bronze : chrome,
          new THREE.Vector3(),
          new THREE.Euler(),
          direction,
          i + ring * 8,
        );
      }
    }
    add(
      new THREE.SphereGeometry(0.42, 40, 24),
      chrome,
      new THREE.Vector3(),
      new THREE.Euler(),
      new THREE.Vector3(0, 0.2, 0),
      24,
    );
    for (let i = 0; i < 5; i++) {
      const angle = i * 1.256;
      add(
        new THREE.SphereGeometry(0.06 + i * 0.012, 12, 10),
        bronze,
        new THREE.Vector3(
          Math.cos(angle) * 1.9,
          Math.sin(angle) * 1.5,
          Math.sin(angle * 2) * 0.7,
        ),
        new THREE.Euler(),
        new THREE.Vector3(Math.cos(angle), Math.sin(angle), 0.3),
        25 + i,
      );
    }
  } else {
    // A fan of bowed sheets: continuous surfaces with actual light and occlusion.
    for (let i = 0; i < 13; i++) {
      const geometry = new THREE.PlaneGeometry(2.45, 2.8, 24, 24);
      const pos = geometry.attributes.position;
      for (let j = 0; j < pos.count; j++) {
        const x = pos.getX(j),
          y = pos.getY(j);
        pos.setZ(
          j,
          0.36 * Math.sin((x / 2.45 + 0.5) * Math.PI) +
            0.17 * Math.sin(y * 1.3 + x),
        );
      }
      geometry.computeVertexNormals();
      const t = (i - 6) / 6;
      add(
        geometry,
        i % 5 === 0 ? bronze : paper,
        new THREE.Vector3(t * 0.17, Math.abs(t) * 0.1, t * 0.11),
        new THREE.Euler(-0.25, t * 0.34, t * 0.13),
        new THREE.Vector3(t * 1.2, Math.abs(t) * 0.3, 0.12 * i),
        i,
      );
    }
  }
  // Subtle suspended grains, not a second heavyweight postprocessing pass.
  const dotsGeometry = new THREE.BufferGeometry();
  const positions = new Float32Array(150 * 3);
  for (let i = 0; i < 150; i++) {
    const s = Math.sin(i * 127.1) * 43758.5453;
    const r = s - Math.floor(s);
    positions[i * 3] = Math.sin(i * 2.4) * (2 + r * 2);
    positions[i * 3 + 1] = Math.cos(i * 1.7) * (1 + r * 2);
    positions[i * 3 + 2] = -2 + r * 3;
  }
  dotsGeometry.setAttribute(
    'position',
    new THREE.BufferAttribute(positions, 3),
  );
  const dotsMaterial = new THREE.PointsMaterial({
    color: kind === 'journal' ? 0x456b5f : 0x9c784d,
    size: 0.012,
    transparent: true,
    opacity: 0.38,
    depthWrite: false,
  });
  const dots = new THREE.Points(dotsGeometry, dotsMaterial);
  scene.add(dots);
  let narrow = false;
  const resize = () => {
    const { width, height } = host.getBoundingClientRect();
    narrow = innerWidth < 650;
    renderer.setPixelRatio(previewPixelRatio(width, height, devicePixelRatio));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  resize();
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  let ready = false;
  return {
    render(
      progress: number,
      hold: number,
      time: number,
      x: number,
      y: number,
      reduced: boolean,
    ) {
      const spread = progress * 1.1 + hold * 0.9 + (kind === 'docs' ? 0.4 : 0);
      sculpture.position.set(
        narrow ? 0.26 : kind === 'journal' ? 1.95 : 1.7,
        narrow ? -0.1 : -0.1 - progress * 0.15,
        0,
      );
      const scale = narrow ? 0.76 : 1.05 - progress * 0.18;
      sculpture.scale.setScalar(scale);
      sculpture.rotation.set(
        0.13 + y * 0.035,
        kind === 'journal'
          ? -0.25 + time * 0.055 + progress * 0.65
          : 0.35 + progress * 0.4,
        -0.18 + x * 0.04 + progress * 0.22,
      );
      pieces.forEach(({ mesh, base, rotation, direction, index }) => {
        const local = spread * (0.65 + 0.35 * Math.sin(index * 1.7) ** 2);
        mesh.position.copy(base).addScaledVector(direction, local);
        mesh.rotation.set(
          rotation.x +
            local * 0.17 * Math.sin(index) +
            (reduced ? 0 : Math.sin(time * 0.6 + index * 0.3) * 0.018),
          rotation.y + local * 0.2 * Math.cos(index),
          rotation.z + local * 0.15 * Math.sin(index * 1.3),
        );
      });
      if (!reduced) sculpture.position.y += Math.sin(time * 0.5) * 0.045;
      dots.rotation.y = time * 0.018;
      dots.position.x = sculpture.position.x * 0.5;
      camera.position.z = 10 + progress * 0.5;
      renderer.render(scene, camera);
      if (!ready) {
        host.dataset.ready = 'true';
        ready = true;
      }
    },
    dispose() {
      observer.disconnect();
      ownedGeometry.forEach((g) => g.dispose());
      chrome.dispose();
      paper.dispose();
      paperTexture?.dispose();
      bronze.dispose();
      dotsGeometry.dispose();
      dotsMaterial.dispose();
      environment.dispose();
      renderer.dispose();
    },
  };
}
