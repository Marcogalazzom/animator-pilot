import { getDb } from './database';
import type { PhotoAlbum, Photo } from './types';

const UPDATABLE_ALBUM_FIELDS = new Set(['title', 'description', 'activity_date', 'cover_path']);
const UPDATABLE_PHOTO_FIELDS = new Set(['caption', 'taken_at']);

// ─── Albums ──────────────────────────────────────────────────

export async function getAlbums(): Promise<PhotoAlbum[]> {
  const db = await getDb();
  return db.select<PhotoAlbum[]>('SELECT * FROM photo_albums ORDER BY activity_date DESC', []);
}

export async function getAlbum(id: number): Promise<PhotoAlbum | null> {
  const db = await getDb();
  const rows = await db.select<PhotoAlbum[]>('SELECT * FROM photo_albums WHERE id = ?', [id]);
  return rows[0] ?? null;
}

export async function createAlbum(album: Omit<PhotoAlbum, 'id' | 'created_at'>): Promise<number> {
  const db = await getDb();
  const result = await db.execute(
    'INSERT INTO photo_albums (title, description, activity_date, cover_path) VALUES (?, ?, ?, ?)',
    [album.title, album.description, album.activity_date, album.cover_path]
  );
  return result.lastInsertId ?? 0;
}

export async function updateAlbum(id: number, updates: Partial<PhotoAlbum>): Promise<void> {
  const db = await getDb();
  const fields = Object.keys(updates).filter((k) => UPDATABLE_ALBUM_FIELDS.has(k));
  if (fields.length === 0) return;
  const setClauses = fields.map((f) => `${f} = ?`).join(', ');
  const values: unknown[] = fields.map((f) => (updates as Record<string, unknown>)[f]);
  values.push(id);
  await db.execute(`UPDATE photo_albums SET ${setClauses} WHERE id = ?`, values);
}

export async function deleteAlbum(id: number): Promise<void> {
  const db = await getDb();
  await db.execute('DELETE FROM photos WHERE album_id = ?', [id]);
  await db.execute('DELETE FROM photo_albums WHERE id = ?', [id]);
}

// ─── Photos ──────────────────────────────────────────────────

export async function getPhotos(albumId: number): Promise<Photo[]> {
  const db = await getDb();
  return db.select<Photo[]>('SELECT * FROM photos WHERE album_id = ? ORDER BY taken_at DESC', [albumId]);
}

export async function createPhoto(photo: Omit<Photo, 'id' | 'created_at'>): Promise<number> {
  const db = await getDb();
  const result = await db.execute(
    'INSERT INTO photos (album_id, file_path, caption, taken_at) VALUES (?, ?, ?, ?)',
    [photo.album_id, photo.file_path, photo.caption, photo.taken_at]
  );
  return result.lastInsertId ?? 0;
}

export async function updatePhoto(id: number, updates: Partial<Photo>): Promise<void> {
  const db = await getDb();
  const fields = Object.keys(updates).filter((k) => UPDATABLE_PHOTO_FIELDS.has(k));
  if (fields.length === 0) return;
  const setClauses = fields.map((f) => `${f} = ?`).join(', ');
  const values: unknown[] = fields.map((f) => (updates as Record<string, unknown>)[f]);
  values.push(id);
  await db.execute(`UPDATE photos SET ${setClauses} WHERE id = ?`, values);
}

export async function deletePhoto(id: number): Promise<void> {
  const db = await getDb();
  await db.execute('DELETE FROM photos WHERE id = ?', [id]);
}

export async function getAlbumStats(): Promise<{ totalAlbums: number; totalPhotos: number }> {
  const db = await getDb();
  const albumRows = await db.select<{ cnt: number }[]>('SELECT COUNT(*) as cnt FROM photo_albums', []).catch(() => [{ cnt: 0 }]);
  const photoRows = await db.select<{ cnt: number }[]>('SELECT COUNT(*) as cnt FROM photos', []).catch(() => [{ cnt: 0 }]);
  return { totalAlbums: albumRows[0]?.cnt ?? 0, totalPhotos: photoRows[0]?.cnt ?? 0 };
}
