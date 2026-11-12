const MAX_SOURCE_BYTES = 12 * 1024 * 1024;
const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
const MAX_DIMENSION = 1800;

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the optimised image.'));
    reader.onload = () => {
      const result = String(reader.result || '');
      const separator = result.indexOf(',');
      if (separator < 0) return reject(new Error('Could not prepare the image for upload.'));
      resolve(result.slice(separator + 1));
    };
    reader.readAsDataURL(blob);
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error('Your browser could not optimise this image.'));
    }, type, quality);
  });
}

export async function compressForUpload(file: File): Promise<{
  base64: string;
  mimeType: string;
  fileName: string;
}> {
  if (!file.type.startsWith('image/')) {
    throw new Error(`${file.name} is not an image file.`);
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error(`${file.name} is larger than 12 MB. Choose a smaller image.`);
  }
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Choose a JPEG, PNG or WebP image.');
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error(`${file.name} could not be opened as an image.`);
  }

  try {
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));

    const context = canvas.getContext('2d');
    if (!context) throw new Error('Image optimisation is not supported by this browser.');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const preferredType = 'image/webp';
    let blob = await canvasToBlob(canvas, preferredType, 0.82);
    if (blob.type !== preferredType) {
      const fallbackType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
      blob = await canvasToBlob(canvas, fallbackType, fallbackType === 'image/png' ? 1 : 0.82);
    }

    if (blob.size > MAX_UPLOAD_BYTES) {
      blob = await canvasToBlob(canvas, blob.type, blob.type === 'image/png' ? 1 : 0.68);
    }
    if (blob.size > MAX_UPLOAD_BYTES) {
      const reduced = document.createElement('canvas');
      reduced.width = Math.max(1, Math.round(canvas.width * 0.72));
      reduced.height = Math.max(1, Math.round(canvas.height * 0.72));
      const reducedContext = reduced.getContext('2d');
      if (!reducedContext) throw new Error('Image optimisation failed.');
      reducedContext.drawImage(canvas, 0, 0, reduced.width, reduced.height);
      blob = await canvasToBlob(reduced, blob.type, blob.type === 'image/png' ? 1 : 0.62);
    }
    if (blob.size > MAX_UPLOAD_BYTES) {
      throw new Error(`${file.name} is still larger than 2 MB after optimisation.`);
    }

    const extension = blob.type === 'image/webp' ? 'webp' : blob.type === 'image/png' ? 'png' : 'jpg';
    const safeBaseName = file.name.replace(/\\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 100) || 'product-image';
    return {
      base64: await blobToBase64(blob),
      mimeType: blob.type,
      fileName: `${safeBaseName}.${extension}`
    };
  } finally {
    bitmap.close();
  }
}
