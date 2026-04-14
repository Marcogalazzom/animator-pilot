import { appDataDir, join } from '@tauri-apps/api/path';
import { convertFileSrc } from '@tauri-apps/api/core';
import { readFile, writeFile, mkdir, exists, remove } from '@tauri-apps/plugin-fs';

const PHOTOS_SUBDIR = 'photos';

function uuid(): string {
  return (
    Date.now().toString(36) + '-' +
    Math.random().toString(36).slice(2, 10)
  );
}

function extOf(path: string): string {
  const m = path.match(/\.([a-zA-Z0-9]+)$/);
  return m ? m[1].toLowerCase() : 'jpg';
}

async function ensurePhotosDir(): Promise<string> {
  const base = await appDataDir();
  const dir = await join(base, PHOTOS_SUBDIR);
  if (!(await exists(dir))) {
    await mkdir(dir, { recursive: true });
  }
  return dir;
}

// Load file bytes into an HTMLImageElement via blob URL
async function loadImage(path: string): Promise<{ img: HTMLImageElement; bytes: Uint8Array; mime: string }> {
  const bytes = await readFile(path);
  const ext = extOf(path);
  const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
  const blob = new Blob([bytes as BlobPart], { type: mime });
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('Image load failed'));
      i.src = url;
    });
    return { img, bytes, mime };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function canvasToBytes(canvas: HTMLCanvasElement, type = 'image/jpeg', quality = 0.85): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      async (blob) => {
        if (!blob) return reject(new Error('Canvas toBlob failed'));
        const buf = await blob.arrayBuffer();
        resolve(new Uint8Array(buf));
      },
      type,
      quality,
    );
  });
}

async function buildThumbnail(img: HTMLImageElement, maxSize = 300): Promise<Uint8Array> {
  const ratio = Math.min(maxSize / img.width, maxSize / img.height, 1);
  const w = Math.max(1, Math.round(img.width * ratio));
  const h = Math.max(1, Math.round(img.height * ratio));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No 2d context');
  ctx.drawImage(img, 0, 0, w, h);
  return canvasToBytes(canvas, 'image/jpeg', 0.85);
}

export interface StoredPhoto {
  filePath: string;
  thumbnailPath: string;
}

/**
 * Copy a user-picked image into the app data photos dir and generate a thumbnail.
 * Returns absolute paths (stored in DB).
 */
export async function storePhoto(sourcePath: string): Promise<StoredPhoto> {
  const dir = await ensurePhotosDir();
  const id = uuid();
  const ext = extOf(sourcePath);
  const fileName = `${id}.${ext}`;
  const thumbName = `thumb_${id}.jpg`;
  const filePath = await join(dir, fileName);
  const thumbPath = await join(dir, thumbName);

  const { img, bytes } = await loadImage(sourcePath);
  await writeFile(filePath, bytes);

  const thumbBytes = await buildThumbnail(img, 300);
  await writeFile(thumbPath, thumbBytes);

  return { filePath, thumbnailPath: thumbPath };
}

export async function deletePhotoFiles(filePath: string | null, thumbnailPath: string | null): Promise<void> {
  for (const p of [filePath, thumbnailPath]) {
    if (!p) continue;
    try {
      if (await exists(p)) await remove(p);
    } catch { /* ignore */ }
  }
}

/**
 * Read a stored image as bytes. Used by PDF export to embed photos.
 */
export async function readPhotoBytes(path: string): Promise<Uint8Array> {
  const data = await readFile(path);
  return data instanceof Uint8Array ? data : new Uint8Array(data);
}

/**
 * Convert a stored absolute path into a URL usable in <img src>.
 */
export function photoSrc(path: string | null | undefined): string {
  if (!path) return '';
  return convertFileSrc(path);
}
