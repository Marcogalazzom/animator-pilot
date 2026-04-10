import { getDb } from './database';
import type { InventoryItem, InventoryCategory } from './types';

const UPDATABLE_FIELDS = new Set(['name', 'category', 'quantity', 'condition', 'location', 'notes', 'synced_from', 'last_sync_at']);

export async function getInventoryItems(category?: InventoryCategory): Promise<InventoryItem[]> {
  const db = await getDb();
  if (category) {
    return db.select<InventoryItem[]>(
      'SELECT * FROM inventory WHERE category = ? ORDER BY name ASC',
      [category]
    );
  }
  return db.select<InventoryItem[]>('SELECT * FROM inventory ORDER BY name ASC', []);
}

export async function getInventoryItem(id: number): Promise<InventoryItem | null> {
  const db = await getDb();
  const rows = await db.select<InventoryItem[]>('SELECT * FROM inventory WHERE id = ?', [id]);
  return rows[0] ?? null;
}

export async function createInventoryItem(item: Omit<InventoryItem, 'id' | 'created_at'>): Promise<number> {
  const db = await getDb();
  const result = await db.execute(
    `INSERT INTO inventory (name, category, quantity, condition, location, notes, synced_from, last_sync_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [item.name, item.category, item.quantity, item.condition, item.location, item.notes, item.synced_from, item.last_sync_at]
  );
  return result.lastInsertId ?? 0;
}

export async function updateInventoryItem(id: number, updates: Partial<InventoryItem>): Promise<void> {
  const db = await getDb();
  const fields = Object.keys(updates).filter((k) => UPDATABLE_FIELDS.has(k));
  if (fields.length === 0) return;
  const setClauses = fields.map((f) => `${f} = ?`).join(', ');
  const values: unknown[] = fields.map((f) => (updates as Record<string, unknown>)[f]);
  values.push(id);
  await db.execute(`UPDATE inventory SET ${setClauses} WHERE id = ?`, values);
}

export async function deleteInventoryItem(id: number): Promise<void> {
  const db = await getDb();
  await db.execute('DELETE FROM inventory WHERE id = ?', [id]);
}

export async function getInventoryStats(): Promise<{ total: number; toReplace: number; categories: number }> {
  const db = await getDb();
  const [totalRow] = await db.select<[{ cnt: number }]>('SELECT COUNT(*) as cnt FROM inventory', []).catch(() => [[{ cnt: 0 }]]);
  const [replaceRow] = await db.select<[{ cnt: number }]>("SELECT COUNT(*) as cnt FROM inventory WHERE condition = 'a_remplacer'", []).catch(() => [[{ cnt: 0 }]]);
  const [catRow] = await db.select<[{ cnt: number }]>('SELECT COUNT(DISTINCT category) as cnt FROM inventory', []).catch(() => [[{ cnt: 0 }]]);
  return { total: totalRow.cnt, toReplace: replaceRow.cnt, categories: catRow.cnt };
}
