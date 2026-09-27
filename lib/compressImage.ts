/**
 * Compresses and resizes an image file in the browser before upload.
 * Cuts a typical 2-4MB phone screenshot down to roughly 100-300KB.
 */
export async function compressImage(
  file: File,
  maxWidth = 1000,
  quality = 0.75,
): Promise<File> {
  // Skip compression for already-small files (e.g. small screenshots) or non-images
  if (!file.type.startsWith('image/')) return file;
  if (file.size < 150 * 1024) return file; // already small enough, don't bother

  const imageBitmap = await createImageBitmap(file);

  let { width, height } = imageBitmap;
  if (width > maxWidth) {
    height = Math.round((height * maxWidth) / width);
    width = maxWidth;
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return file; // fallback: upload original if canvas unsupported

  ctx.drawImage(imageBitmap, 0, 0, width, height);

  const blob: Blob | null = await new Promise((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', quality),
  );

  if (!blob) return file; // fallback: upload original if compression fails

  const newName = file.name.replace(/\.[^.]+$/, '') + '.jpg';
  return new File([blob], newName, { type: 'image/jpeg' });
}