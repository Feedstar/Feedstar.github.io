import { DataTexture, LinearFilter, SRGBColorSpace } from 'three';

export function createDocumentTexture(
  data = new Uint8Array(4),
  width = 1,
  height = 1,
) {
  const texture = new DataTexture(data, width, height);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = texture.magFilter = LinearFilter;
  texture.generateMipmaps = false;
  // ImageData rows run top to bottom. The document shader flips its UVs;
  // UNPACK_FLIP_Y_WEBGL must stay off for typed-array uploads in WebGL2.
  texture.flipY = false;
  return texture;
}

/**
 * Upload pixels instead of a DOM canvas surface. Firefox/Linux can fail to map
 * that shared surface in texSubImage2D, even when the canvas itself draws fine.
 * Readback happens only when artwork changes, never in the animation loop.
 */
export function updateDocumentTexture(
  texture: DataTexture,
  context: CanvasRenderingContext2D,
) {
  const { width, height } = context.canvas;
  const { data } = context.getImageData(0, 0, width, height);
  // Reuse ImageData's buffer rather than allocating another full-size copy.
  const pixels = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  if (texture.image.width !== width || texture.image.height !== height) {
    // WebGL2 texture storage is immutable after its first upload.
    texture.dispose();
    texture = createDocumentTexture(pixels, width, height);
  } else texture.image.data = pixels;
  texture.needsUpdate = true;
  return texture;
}
