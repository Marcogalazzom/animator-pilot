import { getDb } from './database';
import type { JournalEntry } from './types';

const UPDATABLE = new Set([
  'date', 'time', 'title', 'author', 'content', 'mood', 'category',
  'tags', 'is_shared', 'linked_resident_ids',
]);

export async function getJournalEntries(limit = 50): Promise<JournalEntry[]> {
  const db = await getDb();
  return db.select<JournalEntry[]>('SELECT * FROM journal ORDER BY date DESC LIMIT ?', [limit]);
}

export async function getJournalEntry(id: number): Promise<JournalEntry | null> {
  const db = await getDb();
  const rows = await db.select<JournalEntry[]>('SELECT * FROM journal WHERE id = ?', [id]);
  return rows[0] ?? null;
}

export async function getJournalByDate(date: string): Promise<JournalEntry | null> {
  const db = await getDb();
  const rows = await db.select<JournalEntry[]>('SELECT * FROM journal WHERE date = ?', [date]);
  return rows[0] ?? null;
}

export async function createJournalEntry(entry: Omit<JournalEntry, 'id' | 'created_at'>): Promise<number> {
  const db = await getDb();
  const result = await db.execute(
    `INSERT INTO journal
     (date, time, title, author, content, mood, category, tags, is_shared, linked_resident_ids)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.date, entry.time ?? '', entry.title ?? '', entry.author ?? '',
      entry.content, entry.mood, entry.category ?? 'prep',
      entry.tags, entry.is_shared, entry.linked_resident_ids,
    ],
  );
  return result.lastInsertId ?? 0;
}

export async function updateJournalEntry(id: number, updates: Partial<JournalEntry>): Promise<void> {
  const db = await getDb();
  const fields = Object.keys(updates).filter((k) => UPDATABLE.has(k));
  if (fields.length === 0) return;
  const setClauses = fields.map((f) => `${f} = ?`).join(', ');
  const values: unknown[] = fields.map((f) => (updates as Record<string, unknown>)[f]);
  values.push(id);
  await db.execute(`UPDATE journal SET ${setClauses} WHERE id = ?`, values);
}

export async function deleteJournalEntry(id: number): Promise<void> {
  const db = await getDb();
  await db.execute('DELETE FROM journal WHERE id = ?', [id]);
}
