import { getDb } from './database';
import type { ImportRecord } from './types';

export async function getImportHistory(): Promise<ImportRecord[]> {
  const db = await getDb();
  return db.select<ImportRecord[]>(
    'SELECT * FROM import_history ORDER BY imported_at DESC',
    []
  );
}

export async function addImportRecord(
  record: Omit<ImportRecord, 'id' | 'imported_at'>
): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO import_history (filename, row_count, status)
     VALUES (?, ?, ?)`,
    [record.filename, record.row_count, record.status]
  );
}
