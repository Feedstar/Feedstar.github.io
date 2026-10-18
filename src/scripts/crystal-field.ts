import { loadResource } from '../lib/load-resource.mjs';
import { bootSignal } from './page-resources';
import * as THREE from 'three';
import { createCrystalFluid } from './crystal-fluid';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import {
  clamp,
  stepSpring,
  crystalCenter,
  crystalPose,
  crystalIdle,
  crystalCoverFit,
  convexHull,
  clipPolygon,
  GLASS_SETTINGS,
} from '../lib/crystal-motion.mjs';

export interface CrystalLayout {
  width: number;
  height: number;
  cardSize: number;
  gap: number;
  rowGap: number;
  /** Centre of the first crystal, in viewport CSS pixels. */
  startY: number;
  columns: 1 | 2;
}
export interface CrystalRegion {
  index: number;
  left: number;
  top: number;
  width: number;
  height: number;
  polygon: string;
  opacity: number;
  hoverAmount: number;
  centerX: number;
  centerY: number;
}
export interface CrystalPointer {
  x: number;
  y: number;
  active: boolean;
}
type Spring = { value: number; velocity: number };
type Settings = Record<string, number | string>;
type Uniforms = Record<string, THREE.IUniform>;

// Public reference assets contain shell geometry only. Photographic covers are
// independent billboards inside the refraction pass. Attribution lives with assets.
const vertex = /* glsl */ `
attribute vec4 tangent;
attribute float aThickness;
attribute float aPeaks;
attribute float aConvexity;
attribute float aConcavity;
varying vec3 worldPoint;
varying vec3 worldNormal;
varying vec3 worldTangent;
varying vec2 shellUV;
varying float thickness;
varying float peaks;
varying float convexity;
varying float concavity;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  worldPoint = world.xyz;
  worldNormal = normalize(mat3(modelMatrix) * normal);
  worldTangent = normalize(mat3(modelMatrix) * tangent.xyz) * tangent.w;
  shellUV = uv;
  thickness = aThickness;
  peaks = aPeaks;
  convexity = aConvexity;
  concavity = aConcavity;
  gl_Position = projectionMatrix * viewMatrix * world;
}`;

const opticalFunctions = /* glsl */ `
varying vec3 worldPoint;
varying vec3 worldNormal;
varying vec3 worldTangent;
varying vec2 shellUV;
varying float thickness;
varying float peaks;
varying float convexity;
varying float concavity;
uniform sampler2D normalMap;
uniform sampler2D environmentMap;
uniform sampler2D backMap;
uniform mat4 projectionMatrix;
uniform vec3 baseColor;
uniform vec3 peaksColor;
uniform vec3 fringeColor;
uniform float resetDistances;
uniform float distancesFactor;
uniform float iorStart;
uniform float iorDelta;
uniform float uvShiftFactor;
uniform float envReflection;
uniform float envRefraction;
uniform float reflectionIridescence;
uniform float refractionIridescence;
uniform float convexityFactor;
uniform float concavityFactor;
uniform float peaksFactor;
uniform float fringeCurve;
uniform float fringeMix;
uniform float colorBoost;
uniform float colorFactor;
uniform float colorCurve;
uniform float colorCurveR;
uniform float colorCurveG;
uniform float colorCurveB;
uniform float maxColorValue;
uniform float decayFactor;
uniform float worldScale;
uniform vec3 backgroundColor;
uniform float time;
uniform float lightMode;
vec3 surfaceNormal() {
  vec3 n = normalize(worldNormal);
  vec3 t = normalize(worldTangent - n * dot(worldTangent, n));
  vec3 b = normalize(cross(n, t));
  vec3 mapped = texture2D(normalMap, shellUV).xyz * 2.0 - 1.0;
  return normalize(mat3(t, b, n) * mapped);
}
vec3 environment(vec3 direction) {
  direction = normalize(direction);
  vec2 uv = vec2(atan(direction.x, direction.z) / 6.2831853 + .5,
    asin(clamp(direction.y, -1.0, 1.0)) / 3.14159265 + .5);
  vec3 light = texture2D(environmentMap, uv).rgb;
  return 1.0 - exp(-light * .1);
}
vec3 spectrum(float wavelength) {
  // Smooth overlapping spectral bands make a neutral white sum.
  return .12 + .88 * pow(.5 + .5 * cos(6.2831853 * (wavelength + vec3(0.0, .3333, .6667))), vec3(2.0));
}
vec3 interference(float angle) {
  return .45 + .55 * (.5 + .5 * cos(6.2831853 * (angle * 1.6 + vec3(.02, .35, .68))));
}
vec2 screenUV(vec3 point) {
  vec4 projected = projectionMatrix * viewMatrix * vec4(point, 1.0);
  return clamp(projected.xy / projected.w * .5 + .5, .001, .999);
}
float opticalDistance() {
  return mix(thickness * distancesFactor, .1, resetDistances) * worldScale;
}
float edgeAmount(vec3 incident, vec3 n) {
  return pow(clamp(1.0 - abs(dot(incident, n)), 0.0, 1.0), fringeCurve);
}
`;

const backFragment =
  opticalFunctions +
  /* glsl */ `
void main() {
  vec3 n = -surfaceNormal();
  vec3 incident = normalize(worldPoint - cameraPosition);
  float edge = edgeAmount(incident, n);
  vec3 refracted = refract(incident, n, 1.0 / max(iorStart, 1.001));
  vec3 light = environment(refracted) * envRefraction;
  light *= mix(vec3(1.0), interference(1.0 - abs(dot(incident, n))), refractionIridescence);
  float curvature = convexity * convexityFactor + concavity * concavityFactor;
  // Bright studios need absorption, not the dark-stage optical gain.
  vec3 studio = mix(backgroundColor, backgroundColor * vec3(.66, .69, .74), lightMode);
  vec3 color = (studio + light) * (1.0 + curvature * abs(dot(refracted, n)) * mix(1., .16, lightMode));
  color = mix(color, fringeColor, edge * fringeMix);
  gl_FragColor = vec4(color, 1.0);
}`;

const frontFragment =
  opticalFunctions +
  /* glsl */ `
void main() {
  vec3 n = surfaceNormal();
  vec3 incident = normalize(worldPoint - cameraPosition);
  float optical = opticalDistance();
  vec3 lowRay = refract(incident, n, 1.0 / iorStart);
  vec3 highRay = refract(incident, n, 1.0 / (iorStart + iorDelta));
  vec2 firstUV = screenUV(worldPoint + lowRay * optical);
  vec2 lastUV = screenUV(worldPoint + highRay * optical);
  vec2 range = (lastUV - firstUV) * uvShiftFactor;
  vec3 color = vec3(0.0), totalWeight = vec3(0.0);
  // Small temporal dither prevents the separate spectral taps becoming bands.
  float jitter = fract(sin(dot(gl_FragCoord.xy + floor(time * 24.0), vec2(12.9898, 78.233))) * 43758.5453);
  for (int tap = 0; tap < 9; tap++) {
    float wavelength = (float(tap) + jitter) / 9.0;
    vec3 weight = spectrum(wavelength);
    color += texture2D(backMap, clamp(firstUV + range * wavelength, .001, .999)).rgb * weight;
    totalWeight += weight;
  }
  color /= totalWeight;
  float edge = edgeAmount(incident, n);
  color = mix(color, fringeColor, fringeMix * edge);
  float luminance = dot(color, vec3(.2126, .7152, .0722));
  color = max(vec3(0.0), mix(vec3(luminance), color, mix(colorBoost, .92, lightMode)));
  vec3 tint = mix(baseColor, peaksColor, clamp(peaks * peaksFactor, 0.0, 1.0));
  float absorption = exp(-mix(thickness * distancesFactor, .1, resetDistances) * decayFactor);
  color *= mix(tint, vec3(1.0), absorption) * mix(colorFactor, min(colorFactor, 1.12), lightMode);
  vec3 curve = colorCurve * vec3(colorCurveR, colorCurveG, colorCurveB);
  color = mix(pow(max(color, vec3(.00001)), curve), color, step(vec3(1.0), color));
  float fresnel = .04 + .96 * pow(1.0 - abs(dot(incident, n)), 5.0);
  vec3 reflected = environment(reflect(incident, n));
  reflected *= mix(vec3(1.0), interference(1.0 - abs(dot(incident, n))), reflectionIridescence);
  color += reflected * envReflection * fresnel;
  // Reflection from the dark side of the studio gives clear glass a readable edge.
  float studioKey = pow(.5 + .5 * dot(n, normalize(vec3(-.6, .8, 1.))), 2.);
  color *= mix(vec3(1.), mix(vec3(.48, .53, .61), vec3(1.), studioKey), lightMode);
  color *= 1. - lightMode * edge * .22;
  gl_FragColor = vec4(clamp(color, 0.0, maxColorValue), 1.0);
  #include <colorspace_fragment>
}`;

const screenVertex = /* glsl */ `
varying vec2 screen;
void main() { screen = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;
const backgroundFragment = /* glsl */ `
varying vec2 screen;
uniform vec3 backgroundColor;
void main() { gl_FragColor = vec4(backgroundColor, 1.); }
`;
const wakeFragment = /* glsl */ `
varying vec2 screen;
uniform sampler2D sceneMap;
uniform sampler2D normalMap;
uniform vec2 pixel;
uniform float strength;
uniform float lightMode;
void main() {
  vec3 n = texture2D(normalMap, screen).xyz * 2. - 1.;
  vec3 r = texture2D(normalMap, screen + vec2(pixel.x, 0.)).xyz * 2. - 1.;
  vec3 t = texture2D(normalMap, screen + vec2(0., pixel.y)).xyz * 2. - 1.;
  vec3 ridge = (abs(n - r) + abs(n - t)) * strength;
  // Separate wavelengths bend differently through the moving liquid surface.
  vec2 bend = n.xy * .012 * strength;
  vec3 color;
  color.r = texture2D(sceneMap, clamp(screen + bend * .88, .001, .999)).r;
  color.g = texture2D(sceneMap, clamp(screen + bend, .001, .999)).g;
  color.b = texture2D(sceneMap, clamp(screen + bend * 1.14, .001, .999)).b;
  vec3 film = ridge * vec3(.62, .74, .95);
  // Reflected light on ink; translucent spectral absorption on pearl.
  color = mix(color + film * .48, color * (1. - min(film.bgr * .85, vec3(.48))) + film * .05, lightMode);
  gl_FragColor = vec4(color, 1.);
  #include <colorspace_fragment>
}
`;

const coverVertex = /* glsl */ `
varying vec2 coverUV;
void main() {
  coverUV = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const coverFragment = /* glsl */ `
varying vec2 coverUV;
uniform sampler2D coverMap;
uniform float opacity;
void main() {
  vec4 photograph = texture2D(coverMap, coverUV);
  // Feather only the outer rim. The transparent artwork already has a soft
  // silhouette; a second radial mask washed out the entire photograph.
  vec2 p = abs(coverUV - .5) * 2.0;
  vec2 corner = p - vec2(.74);
  float roundedDistance = length(max(corner, 0.0))
    + min(max(corner.x, corner.y), 0.0) - .26;
  float edge = 1.0 - smoothstep(-.075, .0, roundedDistance);
  float alpha = photograph.a * edge * opacity;
  if (alpha < .001) discard;
  // sRGB image textures decode to linear on upload; the back RT stays linear.
  // Leave highlight headroom for the surrounding glass's optical gain.
  gl_FragColor = vec4(photograph.rgb * .56, alpha);
}`;

function emptyRegion(index: number, hoverAmount = 0): CrystalRegion {
  return {
    index,
    left: 0,
    top: 0,
    width: 0,
    height: 0,
    polygon: 'polygon(0 0,0 0,0 0)',
    opacity: 0,
    hoverAmount,
    centerX: 0,
    centerY: 0,
  };
}

export async function createCrystalField(
  canvas: HTMLCanvasElement,
  links: HTMLAnchorElement[],
  root: HTMLElement,
) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
  });
  renderer.debug.onShaderError = () => {
    throw new Error('Crystal shader compilation failed');
  };
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.autoClear = false;
  const camera = new THREE.PerspectiveCamera(25, 1, 0.1, 100);
  camera.position.z = 8;
  const backScene = new THREE.Scene(),
    frontScene = new THREE.Scene();
  const screenScene = new THREE.Scene();
  const screenCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const screenGeometry = new THREE.PlaneGeometry(2, 2);
  const useFloat = renderer.extensions.has('EXT_color_buffer_float');
  const targetOptions = {
    type: useFloat ? THREE.HalfFloatType : THREE.UnsignedByteType,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
  };
  const backTarget = new THREE.WebGLRenderTarget(1, 1, targetOptions);
  const sceneTarget = new THREE.WebGLRenderTarget(1, 1, targetOptions);
  const fluid = createCrystalFluid(renderer);
  const backgroundColor = new THREE.Color('#030512');
  const lightMode = { value: 0 };
  const backgroundMaterial = new THREE.ShaderMaterial({
    vertexShader: screenVertex,
    fragmentShader: backgroundFragment,
    uniforms: { backgroundColor: { value: backgroundColor } },
    depthTest: false,
    depthWrite: false,
  });
  const wakeUniforms = {
    sceneMap: { value: sceneTarget.texture },
    normalMap: { value: fluid.texture },
    pixel: { value: new THREE.Vector2(1, 1) },
    strength: { value: 0 },
    lightMode,
  };
  const wakeMaterial = new THREE.ShaderMaterial({
    vertexShader: screenVertex,
    fragmentShader: wakeFragment,
    uniforms: wakeUniforms,
    depthTest: false,
    depthWrite: false,
  });
  const screenMesh = new THREE.Mesh(screenGeometry, backgroundMaterial);
  screenScene.add(screenMesh);
  const ownedTextures: THREE.Texture[] = [],
    ownedGeometries: THREE.BufferGeometry[] = [],
    ownedMaterials: THREE.Material[] = [];
  const loader = new GLTFLoader(),
    textureLoader = new THREE.TextureLoader();
  const asset = '/crystal-assets/';
  let disposed = false;
  // Collect each resource as it arrives so failed initialization can release all of it.
  const loadGeometry = async (index: number) => {
    const gltf = await loadResource(
      loader.loadAsync(`${asset}crystal-shell-${index}.glb`),
      {
        signal: bootSignal,
        dispose: (late) =>
          late.scene.traverse((object) => {
            if (!(object instanceof THREE.Mesh)) return;
            object.geometry.dispose();
            (Array.isArray(object.material)
              ? object.material
              : [object.material]
            ).forEach((material) => material.dispose());
          }),
      },
    );
    let geometry: THREE.BufferGeometry | undefined;
    gltf.scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      if (!geometry && object.name === 'Cube') geometry = object.geometry;
      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material];
      materials.forEach((material) => material.dispose());
    });
    if (!geometry) throw new Error(`Crystal shell ${index} is missing`);
    ownedGeometries.push(geometry);
    return geometry;
  };
  const loadNormal = async (index: number) => {
    const texture = await loadResource(
      textureLoader.loadAsync(`${asset}crystal${index}-normal.jpg`),
      { signal: bootSignal, dispose: (texture) => texture.dispose() },
    );
    texture.flipY = false;
    ownedTextures.push(texture);
    return texture;
  };
  const loadEnvironment = async () => {
    const texture = await loadResource(
      new HDRLoader().loadAsync(`${asset}wooden_studio_19_1k.hdr`),
      { signal: bootSignal, dispose: (texture) => texture.dispose() },
    );
    texture.wrapS = THREE.RepeatWrapping;
    ownedTextures.push(texture);
    return texture;
  };
  const loadCover = async (link: HTMLAnchorElement) => {
    const texture = await loadResource(
      textureLoader.loadAsync(
        '/journal-covers/' + encodeURIComponent(link.dataset.id!) + '.webp',
      ),
      { signal: bootSignal, dispose: (texture) => texture.dispose() },
    );
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    ownedTextures.push(texture);
    return texture;
  };
  const requests = [
    ...Array.from({ length: 7 }, (_, i) => loadGeometry(i)),
    ...Array.from({ length: 7 }, (_, i) => loadNormal(i)),
    loadEnvironment(),
    ...links.map(loadCover),
  ];
  const results = await Promise.allSettled(requests);
  const failed = results.find((result) => result.status === 'rejected');
  if (failed) {
    ownedTextures.forEach((texture) => texture.dispose());
    ownedGeometries.forEach((geometry) => geometry.dispose());
    wakeMaterial.dispose();
    fluid.dispose();
    backgroundMaterial.dispose();
    screenGeometry.dispose();
    backTarget.dispose();
    sceneTarget.dispose();
    renderer.dispose();
    throw new Error('Crystal assets could not be loaded', {
      cause: failed.status === 'rejected' ? failed.reason : undefined,
    });
  }
  const loaded = results.map(
    (result) =>
      (result as PromiseFulfilledResult<THREE.BufferGeometry | THREE.Texture>)
        .value,
  );
  const environment = loaded[14] as THREE.Texture;
  const defaultSettings = GLASS_SETTINGS.default as Settings;
  const numberKeys = Object.keys(defaultSettings).filter(
    (key) => typeof defaultSettings[key] === 'number',
  );
  const colorKeys = ['baseColor', 'peaksColor', 'fringeColor'];
  const entries = links.map((link, index) => {
    const geometry = loaded[index % 7] as THREE.BufferGeometry;
    for (const [source, destination] of [
      ['_thickness', 'aThickness'],
      ['_peaks', 'aPeaks'],
      ['_convexity', 'aConvexity'],
      ['_concavity', 'aConcavity'],
    ]) {
      const attribute = geometry.getAttribute(source);
      if (attribute) geometry.setAttribute(destination, attribute);
      else
        geometry.setAttribute(
          destination,
          new THREE.BufferAttribute(
            new Float32Array(geometry.getAttribute('position').count).fill(
              source === '_thickness' ? 0.2 : 0.5,
            ),
            1,
          ),
        );
    }
    geometry.computeBoundingBox();
    const extent = geometry.boundingBox!.getSize(new THREE.Vector3());
    const size = Math.max(extent.x, extent.y);
    const settings = {
      ...defaultSettings,
      ...GLASS_SETTINGS.hovers[index % 7],
    } as Settings;
    const uniforms: Uniforms = {
      normalMap: { value: loaded[7 + (index % 7)] },
      environmentMap: { value: environment },
      backMap: { value: backTarget.texture },
      worldScale: { value: 1 },
      time: { value: 0 },
      backgroundColor: { value: backgroundColor },
      lightMode,
    };
    const colors: Record<string, { start: THREE.Color; end: THREE.Color }> = {};
    for (const key of numberKeys)
      uniforms[key] = { value: defaultSettings[key] };
    for (const key of colorKeys) {
      colors[key] = {
        start: new THREE.Color(defaultSettings[key] as string),
        end: new THREE.Color(settings[key] as string),
      };
      uniforms[key] = { value: colors[key].start.clone() };
    }
    const frontMaterial = new THREE.ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: frontFragment,
      uniforms,
      side: THREE.FrontSide,
    });
    const backMaterial = new THREE.ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: backFragment,
      uniforms,
      side: THREE.BackSide,
    });
    ownedMaterials.push(frontMaterial, backMaterial);
    const front = new THREE.Mesh(geometry, frontMaterial),
      back = new THREE.Mesh(geometry, backMaterial);
    front.userData.index = index;
    const frontGroup = new THREE.Group(),
      backGroup = new THREE.Group();
    frontGroup.add(front);
    backGroup.add(back);
    const coverGeometry = new THREE.PlaneGeometry(1, 1);
    ownedGeometries.push(coverGeometry);
    const coverUniforms: Uniforms = {
      coverMap: { value: null },
      opacity: { value: 0 },
    };
    const coverState = { loaded: true, opacity: 1 };
    const coverMaterial = new THREE.ShaderMaterial({
      vertexShader: coverVertex,
      fragmentShader: coverFragment,
      uniforms: coverUniforms,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      toneMapped: false,
    });
    ownedMaterials.push(coverMaterial);
    const cover = new THREE.Mesh(coverGeometry, coverMaterial);
    const coverGroup = new THREE.Group();
    coverGroup.add(cover);
    coverGroup.visible = false;
    backScene.add(backGroup, coverGroup);
    frontScene.add(frontGroup);

    // The first visible frame already contains the decoded artwork.
    const texture = loaded[15 + index] as THREE.Texture;
    const image = texture.image as HTMLImageElement;
    const fit = crystalCoverFit(
      image.naturalWidth || image.width,
      image.naturalHeight || image.height,
    );
    cover.scale.set(fit.width, fit.height, 1);
    coverUniforms.coverMap.value = texture;
    coverUniforms.opacity.value = 1;
    return {
      index,
      front,
      back,
      frontGroup,
      backGroup,
      coverGroup,
      coverState,
      coverUniforms,
      size,
      settings,
      colors,
      uniforms,
      materialSpring: { value: 0, velocity: 0 } as Spring,
      rotationSpring: { value: 0, velocity: 0 } as Spring,
      center: { x: 0, y: 0 },
      idle: crystalIdle(index, 0),
      active: false,
    };
  });
  let config: CrystalLayout = {
    width: 1,
    height: 1,
    cardSize: 1,
    gap: 0,
    rowGap: 0,
    startY: 0,
    columns: 1,
  };
  let activeIndices = links.map((_, index) => index);
  let lastTime = -1,
    lastScroll = 0;
  const cameraX: Spring = { value: 0, velocity: 0 },
    cameraY: Spring = { value: 0, velocity: 0 };
  const fovSpring: Spring = { value: 25, velocity: 0 };
  const raycaster = new THREE.Raycaster(),
    ndc = new THREE.Vector2();
  const projected = new THREE.Vector3(),
    hoverRotation = new THREE.Quaternion(),
    idleRotation = new THREE.Quaternion(),
    idleEuler = new THREE.Euler(0, 0, 0, 'YXZ'),
    yAxis = new THREE.Vector3(0, 1, 0);

  function refreshColors() {
    const css = getComputedStyle(root)
      .getPropertyValue('--crystal-stage')
      .trim();
    backgroundColor.set(css || '#030512');
    lightMode.value =
      document.documentElement.dataset.theme === 'paper' ? 1 : 0;
  }

  function layout(options: CrystalLayout, indices: number[]) {
    if (disposed) return;
    config = {
      ...options,
      width: Math.max(1, options.width),
      height: Math.max(1, options.height),
      cardSize: Math.max(1, options.cardSize),
    };
    activeIndices = [
      ...new Set(
        indices.filter(
          (index) =>
            Number.isInteger(index) && index >= 0 && index < entries.length,
        ),
      ),
    ];
    // Budget physical pixels as well as DPR: a large retina display must not
    // silently turn the full-screen refraction pass into a 10+ megapixel draw.
    const pixelBudgetRatio = Math.sqrt(
      3_000_000 / (config.width * config.height),
    );
    renderer.setPixelRatio(
      Math.min(window.devicePixelRatio || 1, 1.75, pixelBudgetRatio),
    );
    renderer.setSize(config.width, config.height, false);
    camera.aspect = config.width / config.height;
    camera.updateProjectionMatrix();
    const resolution = Math.min(
      1.5,
      1600 / Math.max(config.width, config.height),
    );
    backTarget.setSize(
      Math.max(1, Math.round(config.width * resolution)),
      Math.max(1, Math.round(config.height * resolution)),
    );
    sceneTarget.setSize(backTarget.width, backTarget.height);
    fluid.resize(config.width, config.height);
    wakeUniforms.pixel.value.copy(fluid.pixel);
    refreshColors();
  }

  function render(
    scrollPixels: number,
    timeSeconds: number,
    pointer?: CrystalPointer,
    focusedIndex = -1,
  ) {
    if (disposed)
      return {
        regions: links.map((_, index) => emptyRegion(index)),
        hoverIndex: -1,
        hoverAmount: 0,
      };
    const dt = lastTime < 0 ? 1 / 60 : clamp(timeSeconds - lastTime, 0, 0.1);
    const velocity =
      lastTime < 0 || dt === 0
        ? 0
        : Math.abs(scrollPixels - lastScroll) / dt / config.height;
    lastTime = timeSeconds;
    lastScroll = scrollPixels;
    const pointerActive = Boolean(
      pointer?.active &&
      pointer.x >= 0 &&
      pointer.x <= config.width &&
      pointer.y >= 0 &&
      pointer.y <= config.height,
    );
    const px = pointerActive ? (pointer!.x / config.width) * 2 - 1 : 0;
    const py = pointerActive ? 1 - (pointer!.y / config.height) * 2 : 0;
    stepSpring(cameraX, (px * Math.PI) / 36, dt, 30, 10);
    stepSpring(cameraY, (py * Math.PI) / 36, dt, 30, 10);
    camera.position.set(
      Math.sin(cameraX.value) * 8,
      Math.sin(cameraY.value) * 8,
      Math.cos(cameraX.value) * Math.cos(cameraY.value) * 8,
    );
    camera.lookAt(0, 0, 0);
    stepSpring(fovSpring, 25 + Math.min(velocity, 10), dt, 30, 10);
    camera.fov = fovSpring.value;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    const worldPerPixel =
      (2 * 8 * Math.tan((25 * Math.PI) / 360)) / config.height;
    entries.forEach((entry) => {
      entry.active = false;
      entry.frontGroup.visible =
        entry.backGroup.visible =
        entry.coverGroup.visible =
          false;
    });
    for (let order = 0; order < activeIndices.length; order++) {
      const entry = entries[activeIndices[order]];
      entry.center = crystalCenter(order, config, scrollPixels);
      entry.idle = crystalIdle(entry.index, timeSeconds);
      entry.active = true;
      const visualY = entry.center.y + entry.idle.offsetY;
      const visible =
        visualY > -config.cardSize * 1.15 &&
        visualY < config.height + config.cardSize * 1.15;
      entry.frontGroup.visible =
        entry.backGroup.visible =
        entry.coverGroup.visible =
          visible;
      if (!visible) continue;
      const scale = (config.cardSize * worldPerPixel) / entry.size;
      entry.uniforms.worldScale.value = scale;
      entry.frontGroup.scale.setScalar(scale);
      entry.frontGroup.position.set(
        (entry.center.x - config.width / 2) * worldPerPixel,
        (config.height / 2 - visualY) * worldPerPixel,
        0,
      );
      const pose = crystalPose(
        entry.index,
        (config.height / 2 - entry.center.y) / config.cardSize,
      );
      entry.frontGroup.quaternion.set(pose[0], pose[1], pose[2], pose[3]);
      idleEuler.set(entry.idle.pitch, entry.idle.yaw, entry.idle.roll, 'YXZ');
      idleRotation.setFromEuler(idleEuler);
      entry.frontGroup.quaternion.multiply(idleRotation);
      // Apply the preceding spring value before raycasting, so the pick uses the displayed pose.
      hoverRotation.setFromAxisAngle(yAxis, entry.rotationSpring.value);
      entry.frontGroup.quaternion.premultiply(hoverRotation);
      entry.frontGroup.updateMatrixWorld(true);
    }
    let hoverIndex = -1;
    if (pointerActive) {
      ndc.set(px, py);
      raycaster.setFromCamera(ndc, camera);
      const intersection = raycaster.intersectObjects(
        entries
          .filter((entry) => entry.active && entry.frontGroup.visible)
          .map((entry) => entry.front),
        false,
      )[0];
      if (intersection) hoverIndex = intersection.object.userData.index;
    }
    if (focusedIndex >= 0 && entries[focusedIndex]?.active)
      hoverIndex = focusedIndex;
    for (const entry of entries) {
      const target = entry.index === hoverIndex ? 1 : 0;
      const hover = clamp(stepSpring(entry.materialSpring, target, dt, 20, 10));
      stepSpring(
        entry.rotationSpring,
        (target * (entry.index % 2 ? -1 : 1) * Math.PI) / 12,
        dt,
        20,
        3,
      );
      for (const key of numberKeys)
        entry.uniforms[key].value =
          Number(defaultSettings[key]) +
          (Number(entry.settings[key]) - Number(defaultSettings[key])) * hover;
      for (const key of colorKeys)
        entry.uniforms[key].value
          .copy(entry.colors[key].start)
          .lerp(entry.colors[key].end, hover);
      entry.uniforms.time.value = timeSeconds;
      entry.coverState.opacity +=
        ((entry.coverState.loaded ? 1 : 0) - entry.coverState.opacity) *
        (1 - Math.exp(-dt * 4));
      entry.coverUniforms.opacity.value = entry.coverState.opacity;
      if (!entry.frontGroup.visible) continue;
      const pose = crystalPose(
        entry.index,
        (config.height / 2 - entry.center.y) / config.cardSize,
      );
      entry.frontGroup.quaternion.set(pose[0], pose[1], pose[2], pose[3]);
      idleEuler.set(entry.idle.pitch, entry.idle.yaw, entry.idle.roll, 'YXZ');
      idleRotation.setFromEuler(idleEuler);
      entry.frontGroup.quaternion.multiply(idleRotation);
      hoverRotation.setFromAxisAngle(yAxis, entry.rotationSpring.value);
      entry.frontGroup.quaternion.premultiply(hoverRotation);
      entry.backGroup.position.copy(entry.frontGroup.position);
      entry.backGroup.quaternion.copy(entry.frontGroup.quaternion);
      entry.backGroup.scale.copy(entry.frontGroup.scale);
      // Only translation/size are shared. Covers remain upright while either
      // scroll, hover or perpetual idle rotation turns the surrounding shell.
      entry.coverGroup.position.copy(entry.frontGroup.position);
      entry.coverGroup.quaternion.copy(camera.quaternion);
      entry.coverGroup.scale.setScalar(entry.frontGroup.scale.x * entry.size);
      entry.frontGroup.updateMatrixWorld(true);
      entry.backGroup.updateMatrixWorld(true);
      entry.coverGroup.updateMatrixWorld(true);
    }

    fluid.update(
      dt,
      pointerActive ? pointer!.x / config.width : 0,
      pointerActive ? 1 - pointer!.y / config.height : 0,
      pointerActive,
    );
    screenMesh.material = backgroundMaterial;
    renderer.setRenderTarget(backTarget);
    renderer.clear();
    renderer.render(screenScene, screenCamera);
    renderer.render(backScene, camera);
    renderer.setRenderTarget(sceneTarget);
    renderer.clear();
    renderer.render(screenScene, screenCamera);
    renderer.render(frontScene, camera);
    wakeUniforms.normalMap.value = fluid.texture;
    wakeUniforms.strength.value = fluid.strength;
    screenMesh.material = wakeMaterial;
    renderer.setRenderTarget(null);
    renderer.clear();
    renderer.render(screenScene, screenCamera);

    const regions: CrystalRegion[] = entries.map((entry) => {
      const hoverAmount = clamp(entry.materialSpring.value);
      if (!entry.active || !entry.frontGroup.visible)
        return emptyRegion(entry.index, hoverAmount);
      const position = entry.front.geometry.getAttribute('position');
      const points: number[][] = [];
      for (let i = 0; i < position.count; i++) {
        projected
          .fromBufferAttribute(position, i)
          .applyMatrix4(entry.front.matrixWorld)
          .project(camera);
        if (projected.z < -1 || projected.z > 1) continue;
        points.push([
          ((projected.x + 1) * config.width) / 2,
          ((1 - projected.y) * config.height) / 2,
        ]);
      }
      const hull: number[][] = clipPolygon(
        convexHull(points),
        config.width,
        config.height,
      );
      if (hull.length < 3) return emptyRegion(entry.index, hoverAmount);
      const xs = hull.map((point) => point[0]),
        ys = hull.map((point) => point[1]);
      const left = Math.min(...xs),
        top = Math.min(...ys);
      const width = Math.max(...xs) - left,
        height = Math.max(...ys) - top;
      if (width < 1 || height < 1) return emptyRegion(entry.index, hoverAmount);
      const polygon = `polygon(${hull.map((point) => `${(((point[0] - left) / width) * 100).toFixed(2)}% ${(((point[1] - top) / height) * 100).toFixed(2)}%`).join(',')})`;
      // The caption follows the object centre, never its clipped/rotating hull.
      projected.copy(entry.frontGroup.position).project(camera);
      return {
        centerX: ((projected.x + 1) * config.width) / 2,
        centerY: ((1 - projected.y) * config.height) / 2,
        index: entry.index,
        left,
        top,
        width,
        height,
        polygon,
        opacity: 1,
        hoverAmount,
      };
    });
    return {
      regions,
      hoverIndex,
      hoverAmount:
        hoverIndex >= 0 ? clamp(entries[hoverIndex].materialSpring.value) : 0,
    };
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    ownedTextures.forEach((texture) => texture.dispose());
    ownedGeometries.forEach((geometry) => geometry.dispose());
    ownedMaterials.forEach((material) => material.dispose());
    screenGeometry.dispose();
    wakeMaterial.dispose();
    fluid.dispose();
    backgroundMaterial.dispose();
    backTarget.dispose();
    sceneTarget.dispose();
    backScene.clear();
    frontScene.clear();
    screenScene.clear();
    renderer.dispose();
  }
  refreshColors();
  return { layout, render, refreshColors, dispose };
}
