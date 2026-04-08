import { getDb } from './database';
import type { RegulatoryWatch, WatchCategory, TrainingTracking } from './types';

const UPDATABLE_WATCH = new Set(['title', 'category', 'source', 'url', 'date_published', 'summary', 'is_read']);
const UPDATABLE_TRAINING = new Set(['title', 'category', 'hours_planned', 'hours_completed', 'fiscal_year', 'notes']);

// ─── Regulatory Watch ────────────────────────────────────────

export async function getWatchItems(category?: WatchCategory, isRead?: boolean): Promise<RegulatoryWatch[]> {
  const db = await getDb();
  const conditions: string[] = [];
  const bindings: unknown[] = [];
  if (category) { conditions.push('category = ?'); bindings.push(category); }
  if (isRead !== undefined) { conditions.push('is_read = ?'); bindings.push(isRead ? 1 : 0); }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  return db.select<RegulatoryWatch[]>(`SELECT * FROM regulatory_watch ${where} ORDER BY date_published DESC, created_at DESC`, bindings);
}

export async function createWatchItem(item: Omit<RegulatoryWatch, 'id' | 'created_at'>): Promise<number> {
  const db = await getDb();
  const result = await db.execute(
    'INSERT INTO regulatory_watch (title, category, source, url, date_published, summary, is_read) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [item.title, item.category, item.source, item.url, item.date_published, item.summary, item.is_read]
  );
  return result.lastInsertId ?? 0;
}

export async function updateWatchItem(id: number, updates: Partial<RegulatoryWatch>): Promise<void> {
  const db = await getDb();
  const fields = Object.keys(updates).filter((k) => UPDATABLE_WATCH.has(k));
  if (fields.length === 0) return;
  const setClauses = fields.map((f) => `${f} = ?`).join(', ');
  const values: unknown[] = fields.map((f) => (updates as Record<string, unknown>)[f]);
  values.push(id);
  await db.execute(`UPDATE regulatory_watch SET ${setClauses} WHERE id = ?`, values);
}

export async function deleteWatchItem(id: number): Promise<void> {
  const db = await getDb();
  await db.execute('DELETE FROM regulatory_watch WHERE id = ?', [id]);
}

// ─── Training Tracking ───────────────────────────────────────

export async function getTrainings(fiscalYear?: number): Promise<TrainingTracking[]> {
  const db = await getDb();
  if (fiscalYear) {
    return db.select<TrainingTracking[]>('SELECT * FROM training_tracking WHERE fiscal_year = ? ORDER BY title', [fiscalYear]);
  }
  return db.select<TrainingTracking[]>('SELECT * FROM training_tracking ORDER BY fiscal_year DESC, title', []);
}

export async function createTraining(item: Omit<TrainingTracking, 'id' | 'created_at'>): Promise<number> {
  const db = await getDb();
  const result = await db.execute(
    'INSERT INTO training_tracking (title, category, hours_planned, hours_completed, fiscal_year, notes) VALUES (?, ?, ?, ?, ?, ?)',
    [item.title, item.category, item.hours_planned, item.hours_completed, item.fiscal_year, item.notes]
  );
  return result.lastInsertId ?? 0;
}

export async function updateTraining(id: number, updates: Partial<TrainingTracking>): Promise<void> {
  const db = await getDb();
  const fields = Object.keys(updates).filter((k) => UPDATABLE_TRAINING.has(k));
  if (fields.length === 0) return;
  const setClauses = fields.map((f) => `${f} = ?`).join(', ');
  const values: unknown[] = fields.map((f) => (updates as Record<string, unknown>)[f]);
  values.push(id);
  await db.execute(`UPDATE training_tracking SET ${setClauses} WHERE id = ?`, values);
}

export async function deleteTraining(id: number): Promise<void> {
  const db = await getDb();
  await db.execute('DELETE FROM training_tracking WHERE id = ?', [id]);
}
