/** `PhotoCaptureImageProcessing`: longest side capped at 2048 px, re-encoded as JPEG at 0.85. */
export const PHOTO_MAX_DIMENSION = 2048;
export const PHOTO_JPEG_QUALITY = 0.85;

export async function downscaledJPEG(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const largest = Math.max(bitmap.width, bitmap.height);
  const scale = largest > PHOTO_MAX_DIMENSION ? PHOTO_MAX_DIMENSION / largest : 1;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext('2d');
  if (!context) return file;
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob ?? file), 'image/jpeg', PHOTO_JPEG_QUALITY);
  });
}
