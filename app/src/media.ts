/** Client-side image prep for profile uploads: shrink and convert photos/docs to WebP. */
export type CompressedImage = { data: string; filename: string; mime: string };

const MAX_EDGE = 1600;
const QUALITY = 0.82;

export function isImageFile(file: File) {
  return ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'].includes(file.type) || /\.(jpe?g|png|webp)$/i.test(file.name);
}

/** Decode → scale down → WebP data URL (base64 payload without prefix). */
export async function compressToWebp(file: File): Promise<CompressedImage> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    try {
      await image.decode();
    } catch {
      throw new Error('Не удалось прочитать изображение. Выберите другой файл');
    }
    const scale = Math.min(1, MAX_EDGE / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Не удалось подготовить изображение');
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const webp = canvas.toDataURL('image/webp', QUALITY);
    const base64 = webp.startsWith('data:image/webp') ? webp.split(',')[1] : canvas.toDataURL('image/jpeg', QUALITY).split(',')[1];
    const mime = webp.startsWith('data:image/webp') ? 'image/webp' : 'image/jpeg';
    const base = file.name.replace(/\.[^.]+$/, '');
    return { data: base64, filename: `${base}.${mime === 'image/webp' ? 'webp' : 'jpg'}`, mime };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function fileToUpload(file: File): Promise<CompressedImage> {
  if (isImageFile(file)) return compressToWebp(file);
  // PDF and other binaries pass through
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = () => reject(new Error('Не удалось прочитать файл'));
    reader.readAsDataURL(file);
  });
  return { data, filename: file.name, mime: file.type || 'application/octet-stream' };
}
