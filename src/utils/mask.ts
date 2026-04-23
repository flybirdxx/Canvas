/**
 * Utilities for building inpainting masks compatible with OpenAI's
 * `/images/edits` endpoint.
 *
 * Mask semantics (per OpenAI docs):
 *   - Must be the SAME dimensions as the base image.
 *   - Must be a PNG with an alpha channel.
 *   - Pixels with alpha = 0 are the region that should be rewritten.
 *   - Opaque pixels are preserved verbatim.
 */

/**
 * Build a PNG data URL where a single rectangular region is transparent
 * (rewrite) and the rest is opaque white (keep).
 *
 * @param width Target mask width in pixels (matches base image's natural width)
 * @param height Target mask height in pixels (matches base image's natural height)
 * @param rect Rewrite rectangle in NORMALIZED [0..1] coords relative to the
 *             base image. Values are clamped to [0, 1] and the rect is
 *             clipped to the canvas so slightly-out-of-bounds drags don't
 *             error out.
 */
export function createRectMaskPng(
  width: number,
  height: number,
  rect: { x: number; y: number; w: number; h: number },
): string {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const nx = Math.max(0, Math.min(1, rect.x));
  const ny = Math.max(0, Math.min(1, rect.y));
  const nw = Math.max(0, Math.min(1 - nx, rect.w));
  const nh = Math.max(0, Math.min(1 - ny, rect.h));

  const rx = Math.round(nx * canvas.width);
  const ry = Math.round(ny * canvas.height);
  const rw = Math.max(1, Math.round(nw * canvas.width));
  const rh = Math.max(1, Math.round(nh * canvas.height));

  ctx.clearRect(rx, ry, rw, rh);
  return canvas.toDataURL('image/png');
}

/**
 * Load an image src (http(s) URL or data URL) and resolve its natural
 * dimensions. Used to size the mask so it matches the base image exactly.
 * Returns null on load failure so the caller can surface a friendly error.
 */
export function loadImageNaturalSize(
  src: string,
): Promise<{ w: number; h: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve(null);
    img.src = src;
  });
}
