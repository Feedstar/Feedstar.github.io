import { bootCancelled, prepareFonts, prepareImage } from './page-resources';
import * as THREE from 'three';
import {
  DOCUMENT_CAMERA_Z,
  DOCUMENT_IMAGE_RATIO,
  bendDocumentVertex,
  clipDocumentPolygon,
  dampDocumentScroll,
  documentBendRange,
  documentConvexHull,
  projectDocumentVertex,
} from '../lib/document-motion.mjs';

export interface DocumentFieldLayout {
  width: number;
  height: number;
  cardWidth: number;
  gap: number;
  rowGap: number;
  startY: number;
  captionHeight: number;
  columns: 1 | 2;
}

export interface DocumentFieldBounds {
  index: number;
  left: number;
  top: number;
  width: number;
  height: number;
  /** A clip-path polygon, relative to this result's bounding rectangle. */
  polygon: string;
  opacity: number;
}

type Point = { x: number; y: number };
type Palette = { ink: string; soft: string; space: string };
type CardData = {
  number: string;
  title: string;
  description: string;
  tags: string;
  english: string;
};
type Panel = {
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  canvas: HTMLCanvasElement;
  texture: THREE.CanvasTexture;
  base: Float32Array;
  positions: THREE.BufferAttribute;
  visibility: THREE.BufferAttribute;
  fog: THREE.BufferAttribute;
  lift: THREE.BufferAttribute;
};
type Card = {
  index: number;
  data: CardData;
  source: HTMLImageElement | null;
  picture: Panel;
  caption: Panel;
  active: boolean;
  left: number;
  top: number;
  hover: number;
};

const vertexShader = `
  attribute float aVisibility;
  attribute float aFog;
  attribute float aLift;
  varying vec2 vUv;
  varying float vVisibility;
  varying float vFog;
  varying float vLift;
  void main() {
    vUv = uv;
    vVisibility = aVisibility;
    vFog = aFog;
    vLift = aLift;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform sampler2D uTexture;
  uniform vec3 uFogColor;
  uniform float uZoom;
  uniform float uIsPicture;
  varying vec2 vUv;
  varying float vVisibility;
  varying float vFog;
  varying float vLift;
  void main() {
    vec2 uv = (vUv - 0.5) / uZoom + 0.5;
    vec4 color = texture2D(uTexture, uv);
    float sheen = max(0.0, vLift);
    color.rgb += sheen * sheen * 0.075 * uIsPicture;
    color.rgb = mix(color.rgb, uFogColor, vFog);
    color.a *= vVisibility;
    gl_FragColor = color;
    #include <colorspace_fragment>
  }
`;

function readData(link: HTMLAnchorElement): CardData {
  const text = (selector: string) =>
    link.querySelector(selector)?.textContent?.trim().replace(/\s+/g, ' ') ||
    '';
  const tags = link.querySelector('.document-tags');
  return {
    number: text('.document-number'),
    title: text('.document-title'),
    description: text('.document-description'),
    tags: tags?.children.length
      ? Array.from(tags.children)
          .map((tag) => tag.textContent?.trim())
          .filter(Boolean)
          .join('  ·  ')
      : text('.document-tags'),
    english: text('.document-english'),
  };
}

function readPalette(root: HTMLElement): Palette {
  const style = getComputedStyle(root);
  return {
    ink: style.getPropertyValue('--ink').trim() || '#352e25',
    soft: style.getPropertyValue('--ink-soft').trim() || '#736351',
    space: style.getPropertyValue('--space').trim() || '#e8e0d1',
  };
}

function makePanel(
  scene: THREE.Scene,
  palette: Palette,
  isPicture: boolean,
): Panel {
  const canvas = document.createElement('canvas');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  const geometry = new THREE.PlaneGeometry(1, 1, 20, isPicture ? 14 : 8);
  const positions = geometry.getAttribute('position') as THREE.BufferAttribute;
  const base = new Float32Array(positions.array);
  positions.setUsage(THREE.DynamicDrawUsage);
  const attributes = ['aVisibility', 'aFog', 'aLift'].map((name) => {
    const attribute = new THREE.BufferAttribute(
      new Float32Array(positions.count),
      1,
    );
    attribute.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute(name, attribute);
    return attribute;
  });
  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uTexture: { value: texture },
      uFogColor: { value: new THREE.Color(palette.space) },
      uZoom: { value: 1 },
      uIsPicture: { value: isPicture ? 1 : 0 },
    },
    transparent: true,
    depthWrite: false,
    depthTest: false,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.visible = false;
  scene.add(mesh);
  return {
    mesh,
    canvas,
    texture,
    base,
    positions,
    visibility: attributes[0],
    fog: attributes[1],
    lift: attributes[2],
  };
}

/** Unicode-aware wrapping keeps Chinese copy and ordinary Latin text complete. */
function wrapText(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  if (!text) return [];
  const lines: string[] = [];
  let line = '';
  for (const character of Array.from(text)) {
    if (character === '\n') {
      lines.push(line.trim());
      line = '';
    } else if (line && context.measureText(line + character).width > maxWidth) {
      lines.push(line.trim());
      line = character.trimStart();
    } else line += character;
  }
  if (line) lines.push(line.trim());
  return lines;
}

function prepareCanvas(
  panel: Panel,
  width: number,
  height: number,
  resolution: number,
) {
  panel.canvas.width = Math.max(1, Math.round(width * resolution));
  panel.canvas.height = Math.max(1, Math.round(height * resolution));
  const context = panel.canvas.getContext('2d');
  if (!context) throw new Error('A 2D canvas is required for document text.');
  context.setTransform(resolution, 0, 0, resolution, 0, 0);
  context.clearRect(0, 0, width, height);
  return context;
}

function drawPicture(
  card: Card,
  width: number,
  height: number,
  palette: Palette,
) {
  const resolution = Math.min(3, Math.max(2, 1024 / width));
  const context = prepareCanvas(card.picture, width, height, resolution);
  const image = card.source;
  if (image?.naturalWidth && image.naturalHeight) {
    const sourceRatio = image.naturalWidth / image.naturalHeight;
    const targetRatio = width / height;
    const sourceWidth =
      sourceRatio > targetRatio
        ? image.naturalHeight * targetRatio
        : image.naturalWidth;
    const sourceHeight =
      sourceRatio > targetRatio
        ? image.naturalHeight
        : image.naturalWidth / targetRatio;
    context.drawImage(
      image,
      (image.naturalWidth - sourceWidth) / 2,
      (image.naturalHeight - sourceHeight) / 2,
      sourceWidth,
      sourceHeight,
      0,
      0,
      width,
      height,
    );
  } else {
    context.fillStyle = palette.space;
    context.fillRect(0, 0, width, height);
    context.strokeStyle = palette.soft;
    context.globalAlpha = 0.22;
    for (let row = 24; row < height; row += 24) {
      context.beginPath();
      context.moveTo(20, row);
      context.lineTo(width - 20, row);
      context.stroke();
    }
    context.globalAlpha = 1;
    context.fillStyle = palette.ink;
    context.font = '500 12px sans-serif';
    context.fillText(`FEEDSTAR  /  ${card.data.number || 'DOCUMENT'}`, 24, 34);
    context.font = '500 23px sans-serif';
    wrapText(context, card.data.title, width - 48).forEach((line, index) =>
      context.fillText(line, 24, height / 2 + index * 29),
    );
  }
  card.picture.texture.needsUpdate = true;
}

function drawCaption(
  card: Card,
  width: number,
  height: number,
  palette: Palette,
  fontFamily: string,
) {
  const context = prepareCanvas(
    card.caption,
    width,
    height,
    Math.min(3, Math.max(2, window.devicePixelRatio || 1)),
  );
  const inset = 1;
  const availableWidth = width - inset * 2;
  const titleFont = (size: number) => `500 ${size}px ${fontFamily}`;
  const bodyFont = (size: number) => `400 ${size}px ${fontFamily}`;
  let titleSize = Math.max(17, Math.min(21, width / 23));
  let bodySize = 12;
  let titleLines: string[] = [];
  let descriptionLines: string[] = [];
  // Allocate enough vertical room for all copy instead of hiding overflow.
  for (let attempt = 0; attempt < 36; attempt += 1) {
    context.font = titleFont(titleSize);
    titleLines = wrapText(context, card.data.title, availableWidth - 20);
    context.font = bodyFont(bodySize);
    descriptionLines = wrapText(context, card.data.description, availableWidth);
    const bodyHeight =
      titleLines.length * titleSize * 1.3 +
      (descriptionLines.length ? 6 : 0) +
      descriptionLines.length * bodySize * 1.5;
    if (descriptionLines.length <= 3 && bodyHeight <= height - 47) break;
    if (descriptionLines.length > 3 || bodySize > 10.5) bodySize -= 0.25;
    else titleSize -= 0.25;
  }
  context.textBaseline = 'top';
  context.fillStyle = palette.soft;
  context.font = `500 10px ${fontFamily}`;
  context.fillText(card.data.number, inset, 10);
  context.textAlign = 'right';
  context.font = `400 10px ${fontFamily}`;
  context.fillText(
    card.data.english,
    width - inset,
    10,
    Math.max(1, width - 40),
  );
  context.textAlign = 'left';
  let y = 27;
  context.fillStyle = palette.ink;
  context.font = titleFont(titleSize);
  titleLines.forEach((line) => {
    context.fillText(line, inset, y);
    y += titleSize * 1.3;
  });
  context.font = `400 19px ${fontFamily}`;
  context.fillText('↗', width - 17, 25);
  y += 6;
  context.fillStyle = palette.soft;
  context.font = bodyFont(bodySize);
  descriptionLines.forEach((line) => {
    context.fillText(line, inset, y);
    y += bodySize * 1.5;
  });
  context.font = `400 10px ${fontFamily}`;
  context.fillText(card.data.tags, inset, height - 17, availableWidth);
  context.strokeStyle = palette.soft;
  context.globalAlpha = 0.3;
  context.beginPath();
  context.moveTo(inset, height - 0.5);
  context.lineTo(width - inset, height - 0.5);
  context.stroke();
  card.caption.texture.needsUpdate = true;
}

async function loadCardImage(
  link: HTMLAnchorElement,
): Promise<HTMLImageElement | null> {
  const original = link.querySelector('img');
  if (!original) return null;
  const source = original.currentSrc || original.src;
  if (new URL(source, document.baseURI).origin === location.origin)
    return (await prepareImage(original)) ? original : null;
  const image = new Image();
  image.crossOrigin = 'anonymous';
  image.src = source;
  return (await prepareImage(image)) ? image : null;
}

const emptyBounds = (index: number): DocumentFieldBounds => ({
  index,
  left: 0,
  top: 0,
  width: 0,
  height: 0,
  polygon: 'polygon(0 0, 0 0, 0 0)',
  opacity: 0,
});

/**
 * One disposable scene for the document collection. layout and render use CSS
 * pixels; scrollPixels is already smoothed by the controller. The returned link
 * polygons are derived from precisely the vertices uploaded to the GPU.
 */
export async function createDocumentField(
  canvas: HTMLCanvasElement,
  links: HTMLAnchorElement[],
  root: HTMLElement,
) {
  const sources = await Promise.all(links.map(loadCardImage));
  await prepareFonts();
  if (
    bootCancelled() ||
    sources.some((image, i) => !image && links[i].querySelector('img'))
  )
    throw new Error('Document artwork is unavailable');
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: 'low-power',
  });
  renderer.setClearColor(0x000000, 0);
  renderer.debug.onShaderError = () => {
    throw new Error('Document shader compilation failed');
  };
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 100, 4500);
  camera.position.z = DOCUMENT_CAMERA_Z;
  let palette = readPalette(root);
  const fontFamily = getComputedStyle(root).fontFamily || 'sans-serif';
  const cards: Card[] = links.map((link, index) => ({
    index,
    data: readData(link),
    source: sources[index],
    picture: makePanel(scene, palette, true),
    caption: makePanel(scene, palette, false),
    active: false,
    left: 0,
    top: 0,
    hover: 0,
  }));
  cards.forEach((card, index) => {
    card.picture.mesh.renderOrder = index * 2;
    card.caption.mesh.renderOrder = index * 2 + 1;
  });
  let options: DocumentFieldLayout | null = null;
  let disposed = false;
  let previousTime: number | null = null;

  function refreshColors() {
    if (disposed) return;
    palette = readPalette(root);
    cards.forEach((card) => {
      card.picture.mesh.material.uniforms.uFogColor.value.set(palette.space);
      card.caption.mesh.material.uniforms.uFogColor.value.set(palette.space);
      if (options) {
        drawPicture(
          card,
          options.cardWidth,
          options.cardWidth / DOCUMENT_IMAGE_RATIO,
          palette,
        );
        drawCaption(
          card,
          options.cardWidth,
          options.captionHeight,
          palette,
          fontFamily,
        );
      }
    });
  }

  function layout(next: DocumentFieldLayout, activeIndices: number[]) {
    if (disposed) return;
    options = {
      ...next,
      width: Math.max(1, next.width),
      height: Math.max(1, next.height),
      cardWidth: Math.max(1, next.cardWidth),
    };
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setSize(options.width, options.height, false);
    camera.fov = THREE.MathUtils.radToDeg(
      2 * Math.atan(options.height / (2 * DOCUMENT_CAMERA_Z)),
    );
    camera.aspect = options.width / options.height;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    const totalWidth =
      options.columns * options.cardWidth + (options.columns - 1) * options.gap;
    const startX = (options.width - totalWidth) / 2;
    const rowPitch =
      options.cardWidth / DOCUMENT_IMAGE_RATIO +
      options.captionHeight +
      options.rowGap;
    cards.forEach((card) => {
      const order = activeIndices.indexOf(card.index);
      card.active = order >= 0;
      card.picture.mesh.visible = false;
      card.caption.mesh.visible = false;
      if (order >= 0) {
        card.left =
          startX +
          (order % options!.columns) * (options!.cardWidth + options!.gap);
        card.top =
          options!.startY + Math.floor(order / options!.columns) * rowPitch;
      }
    });
    refreshColors();
  }

  function render(
    scrollPixels: number,
    timeSeconds: number,
    hoverIndex = -1,
  ): DocumentFieldBounds[] {
    if (!options || disposed)
      return cards.map((card) => emptyBounds(card.index));
    const { width, height, cardWidth, captionHeight } = options;
    const imageHeight = cardWidth / DOCUMENT_IMAGE_RATIO;
    const bend = documentBendRange(width, height);
    const delta =
      previousTime === null
        ? 1 / 60
        : Math.min(0.1, Math.max(0, timeSeconds - previousTime));
    previousTime = timeSeconds;
    const vertex = { x: 0, y: 0, z: 0, ripple: 0, opacity: 0, fog: 0 };

    const bounds = cards.map((card) => {
      const top = card.top - scrollPixels;
      const bottom = top + imageHeight + captionHeight;
      if (!card.active || top > height + 80 || bottom < -height * 1.6) {
        card.picture.mesh.visible = false;
        card.caption.mesh.visible = false;
        return emptyBounds(card.index);
      }
      card.hover = dampDocumentScroll(
        card.hover,
        card.index === hoverIndex ? 1 : 0,
        delta,
        0.12,
      );
      card.picture.mesh.material.uniforms.uZoom.value = 1 + card.hover * 0.1;
      const points: Point[] = [];
      let maximumOpacity = 0;
      const updatePanel = (
        panel: Panel,
        panelTop: number,
        panelHeight: number,
      ) => {
        let panelOpacity = 0;
        const centerX = (card.left + cardWidth / 2 - width / 2) * 0.5;
        const centerY = (height / 2 - panelTop - panelHeight / 2) * 0.5;
        for (let index = 0; index < panel.positions.count; index += 1) {
          const offset = index * 3;
          const x = centerX + panel.base[offset] * cardWidth * 0.5;
          const y = centerY + panel.base[offset + 1] * panelHeight * 0.5;
          bendDocumentVertex(
            x,
            y,
            timeSeconds,
            imageHeight * 0.5,
            bend,
            vertex,
          );
          panel.positions.setXYZ(index, vertex.x, vertex.y, vertex.z);
          panel.visibility.setX(index, vertex.opacity);
          panel.fog.setX(index, vertex.fog);
          panel.lift.setX(index, vertex.ripple / 12);
          panelOpacity = Math.max(panelOpacity, vertex.opacity);
          if (vertex.opacity > 0.025)
            points.push(projectDocumentVertex(vertex, width, height));
        }
        panel.positions.needsUpdate = true;
        panel.visibility.needsUpdate = true;
        panel.fog.needsUpdate = true;
        panel.lift.needsUpdate = true;
        panel.mesh.visible = panelOpacity > 0.005;
        maximumOpacity = Math.max(maximumOpacity, panelOpacity);
      };
      updatePanel(card.picture, top, imageHeight);
      updatePanel(card.caption, top + imageHeight, captionHeight);
      const polygon = clipDocumentPolygon(
        documentConvexHull(points),
        width,
        height,
      );
      if (polygon.length < 3 || maximumOpacity <= 0.025)
        return emptyBounds(card.index);
      const left = Math.min(...polygon.map((point) => point.x));
      const right = Math.max(...polygon.map((point) => point.x));
      const upper = Math.min(...polygon.map((point) => point.y));
      const lower = Math.max(...polygon.map((point) => point.y));
      const boxWidth = right - left;
      const boxHeight = lower - upper;
      if (boxWidth < 1 || boxHeight < 1) return emptyBounds(card.index);
      return {
        index: card.index,
        left,
        top: upper,
        width: boxWidth,
        height: boxHeight,
        polygon: `polygon(${polygon.map((point) => `${(((point.x - left) / boxWidth) * 100).toFixed(2)}% ${(((point.y - upper) / boxHeight) * 100).toFixed(2)}%`).join(', ')})`,
        opacity: maximumOpacity,
      };
    });
    renderer.render(scene, camera);
    return bounds;
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    cards.forEach((card) => {
      [card.picture, card.caption].forEach((panel) => {
        panel.mesh.geometry.dispose();
        panel.mesh.material.dispose();
        panel.texture.dispose();
        scene.remove(panel.mesh);
        panel.canvas.width = panel.canvas.height = 1;
      });
    });
    renderer.dispose();
  }

  return { layout, render, refreshColors, dispose };
}
