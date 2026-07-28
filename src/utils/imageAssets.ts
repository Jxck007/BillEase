export async function prepareDocumentAsset(file: File, kind: 'signature' | 'seal') {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('Use a PNG, JPEG, or WebP image.');
  if (file.size > 2 * 1024 * 1024) throw new Error(`${kind === 'signature' ? 'Signature' : 'Seal'} image must be smaller than 2 MB.`);
  const bitmap = await createImageBitmap(file);
  const scan = document.createElement('canvas');
  scan.width = bitmap.width; scan.height = bitmap.height;
  const context = scan.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Image processing is unavailable.');
  context.drawImage(bitmap, 0, 0);
  const pixels = context.getImageData(0, 0, scan.width, scan.height);
  let left = scan.width, top = scan.height, right = 0, bottom = 0;
  for (let y = 0; y < scan.height; y += 1) for (let x = 0; x < scan.width; x += 1) {
    if (pixels.data[(y * scan.width + x) * 4 + 3] > 12) { left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y); }
  }
  if (right <= left || bottom <= top) throw new Error(`The ${kind} image appears empty.`);
  const width = right - left + 1;
  const height = bottom - top + 1;
  const bounds = kind === 'signature' ? { width: 520, height: 220 } : { width: 420, height: 420 };
  const scale = Math.min(1, bounds.width / width, bounds.height / height);
  const output = document.createElement('canvas');
  output.width = Math.max(1, Math.round(width * scale)); output.height = Math.max(1, Math.round(height * scale));
  output.getContext('2d')?.drawImage(scan, left, top, width, height, 0, 0, output.width, output.height);
  const dataUrl = output.toDataURL('image/webp', 0.82);
  if (dataUrl.length > 220_000) throw new Error(`Compressed ${kind} image is still too large.`);
  return dataUrl;
}

export function prepareSignatureImage(file: File) {
  return prepareDocumentAsset(file, 'signature');
}
