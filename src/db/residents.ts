import { getDb } from './database';
import type { Resident } from './types';

const UPDATABLE_FIELDS = new Set(['display_name', 'room_number', 'interests', 'animation_notes', 'participation_level']);

export async function getResidents(participationLevel?: Resident['participation_level']): Promise<Resident[]> {
  const db = await getDb();
  if (participationLevel) {
    return db.select<Resident[]>(
      'SELECT * FROM residents WHERE participation_level = ? ORDER BY display_name ASC',
      [participationLevel]
    );
  }
  return db.select<Resident[]>('SELECT * FROM residents ORDER BY display_name ASC', []);
}

export async function getResident(id: number): Promise<Resident | null> {
  const db = await getDb();
  const rows = await db.select<Resident[]>('SELECT * FROM residents WHERE id = ?', [id]);
  return rows[0] ?? null;
}

export async function createResident(resident: Omit<Resident, 'id' | 'created_at'>): Promise<number> {
  const db = await getDb();
  const result = await db.execute(
    `INSERT INTO residents (display_name, room_number, interests, animation_notes, participation_level)
     VALUES (?, ?, ?, ?, ?)`,
    [resident.display_name, resident.room_number, resident.interests, resident.animation_notes, resident.participation_level]
  );
  return result.lastInsertId ?? 0;
}

export async function updateResident(id: number, updates: Partial<Resident>): Promise<void> {
  const db = await getDb();
  const fields = Object.keys(updates).filter((k) => UPDATABLE_FIELDS.has(k));
  if (fields.length === 0) return;
  const setClauses = fields.map((f) => `${f} = ?`).join(', ');
  const values: unknown[] = fields.map((f) => (updates as Record<string, unknown>)[f]);
  values.push(id);
  await db.execute(`UPDATE residents SET ${setClauses} WHERE id = ?`, values);
}

export async function deleteResident(id: number): Promise<void> {
  const db = await getDb();
  await db.execute('DELETE FROM residents WHERE id = ?', [id]);
}

export async function getResidentCount(): Promise<number> {
  const db = await getDb();
  const rows = await db.select<{ cnt: number }[]>('SELECT COUNT(*) as cnt FROM residents', []).catch(() => [{ cnt: 0 }]);
  return rows[0]?.cnt ?? 0;
}
