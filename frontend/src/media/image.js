/**
 * image.js — Client-side image processing
 * Generates dual-image payloads:
 * - HD (max 1080px, quality 0.8) for Drive
 * - Thumbnail (max 150px, quality 0.5) for Sheets
 * EXIF orientation auto-corrected via createImageBitmap.
 */

async function resize(bmp, maxSide, quality) {
  const s = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(bmp.width * s));
  c.height = Math.max(1, Math.round(bmp.height * s));
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((resolve) => c.toBlob(resolve, 'image/jpeg', quality));
}

const toB64 = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      // Strip 'data:image/jpeg;base64,' prefix
      const result = reader.result;
      const commaIdx = result.indexOf(',');
      resolve(commaIdx !== -1 ? result.substring(commaIdx + 1) : result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

export async function processImage(file) {
  let bmp;
  try {
    bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch (e) {
    // Fallback if imageOrientation option not supported
    bmp = await createImageBitmap(file);
  }

  try {
    const [hdBlob, thumbBlob] = await Promise.all([
      resize(bmp, 1080, 0.8),
      resize(bmp, 150, 0.5),
    ]);

    const [imageHD, thumb] = await Promise.all([
      toB64(hdBlob),
      toB64(thumbBlob),
    ]);

    return {
      imageHD,
      thumb,
      previewUrl: URL.createObjectURL(thumbBlob),
    };
  } finally {
    if (bmp && typeof bmp.close === 'function') {
      bmp.close();
    }
  }
}

/**
 * Converts raw Base64 (without data: prefix) to blob URL for display
 */
export function b64ToBlobUrl(base64, mimeType = 'image/jpeg') {
  if (!base64) return '';
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: mimeType });
  return URL.createObjectURL(blob);
}
