import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const ALLOWED_CATEGORIES = new Set(['avatars', 'games', 'news', 'public-events']);

export const UPLOAD_ROOT = path.resolve(
  process.env.UPLOAD_ROOT || path.join(process.cwd(), 'public', 'uploads'),
);

function categoryDirectory(category) {
  if (!ALLOWED_CATEGORIES.has(category)) throw new Error('INVALID_UPLOAD_CATEGORY');
  return path.join(UPLOAD_ROOT, category);
}

export function uploadedImageExtension(buffer) {
  if (!Buffer.isBuffer(buffer)) return null;
  const isJpeg = buffer.length >= 3
    && buffer[0] === 0xff
    && buffer[1] === 0xd8
    && buffer[2] === 0xff;
  const isPng = buffer.length >= 8
    && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isWebp = buffer.length >= 12
    && buffer.subarray(0, 4).toString('ascii') === 'RIFF'
    && buffer.subarray(8, 12).toString('ascii') === 'WEBP';

  if (isJpeg) return 'jpg';
  if (isPng) return 'png';
  if (isWebp) return 'webp';
  return null;
}

export async function saveUploadedImage(file, category, invalidContentCode) {
  if (!file) return null;
  const extension = uploadedImageExtension(file.buffer);
  if (!extension) throw new Error(invalidContentCode);

  const directory = categoryDirectory(category);
  await fs.mkdir(directory, { recursive: true });
  const filename = `${crypto.randomUUID()}.${extension}`;
  const imagePath = path.join(directory, filename);
  await fs.writeFile(imagePath, file.buffer, { mode: 0o644, flag: 'wx' });
  return { imagePath, imageUrl: `/uploads/${category}/${filename}` };
}

export async function deleteUploadedImage(imageUrl, category) {
  const prefix = `/uploads/${category}/`;
  if (!imageUrl?.startsWith(prefix)) return false;

  const filename = imageUrl.slice(prefix.length);
  if (!filename || filename !== path.basename(filename)) return false;
  const imagePath = path.join(categoryDirectory(category), filename);
  await fs.unlink(imagePath).catch((error) => {
    if (error.code !== 'ENOENT') throw error;
  });
  return true;
}
