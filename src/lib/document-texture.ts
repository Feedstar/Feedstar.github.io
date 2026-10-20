import { CanvasTexture, LinearFilter, SRGBColorSpace } from 'three';

export function createDocumentTexture(canvas: HTMLCanvasElement) {
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = texture.magFilter = LinearFilter;
  texture.generateMipmaps = false;
  return texture;
}

/** WebGL2 texture storage is immutable after its first upload. */
export function resizeDocumentTexture(
  texture: CanvasTexture,
  width: number,
  height: number,
) {
  const canvas = texture.image as HTMLCanvasElement;
  if (canvas.width === width && canvas.height === height) return texture;
  texture.dispose();
  canvas.width = width;
  canvas.height = height;
  return createDocumentTexture(canvas);
}
