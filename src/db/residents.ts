import { getDb } from './database';
import type { Resident, ResidentAutonomy } from './types';

const UPDATABLE_FIELDS = new Set(['first_name', 'last_name', 'room_number', 'autonomy_level', 'interests', 'notes', 'arrival_date']);

export async function getResidents(autonomyLevel?: ResidentAutonomy): Promise<Resident[]> {
  const db = await getDb();
  if (autonomyLevel) {
    return db.select<Resident[]>(
      'SELECT * FROM residents WHERE autonomy_level = ? ORDER BY last_name ASC, first_name ASC',
      [autonomyLevel]
    );
  }
  return db.select<Resident[]>('SELECT * FROM residents ORDER BY last_name ASC, first_name ASC', []);
}

export async function getResident(id: number): Promise<Resident | null> {
  const db = await getDb();
  const rows = await db.select<Resident[]>('SELECT * FROM residents WHERE id = ?', [id]);
  return rows[0] ?? null;
}

export async function createResident(resident: Omit<Resident, 'id' | 'created_at'>): Promise<number> {
  const db = await getDb();
  const result = await db.execute(
    `INSERT INTO residents (first_name, last_name, room_number, autonomy_level, interests, notes, arrival_date)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [resident.first_name, resident.last_name, resident.room_number, resident.autonomy_level, resident.interests, resident.notes, resident.arrival_date]
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
  const [row] = await db.select<[{ cnt: number }]>('SELECT COUNT(*) as cnt FROM residents', []).catch(() => [[{ cnt: 0 }]]);
  return row.cnt;
}
