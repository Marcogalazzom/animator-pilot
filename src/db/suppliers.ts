import { getDb } from './database';
import type { Supplier, SupplierCategory } from './types';

const UPDATABLE = new Set(['name', 'category', 'contact_name', 'phone', 'email', 'address', 'website', 'notes', 'hourly_rate', 'session_rate', 'is_favorite']);

export async function getSuppliers(category?: SupplierCategory): Promise<Supplier[]> {
  const db = await getDb();
  if (category) {
    return db.select<Supplier[]>(
      'SELECT * FROM suppliers WHERE category = ? ORDER BY is_favorite DESC, name ASC',
      [category]
    );
  }
  return db.select<Supplier[]>('SELECT * FROM suppliers ORDER BY is_favorite DESC, name ASC', []);
}

export async function getSupplier(id: number): Promise<Supplier | null> {
  const db = await getDb();
  const rows = await db.select<Supplier[]>('SELECT * FROM suppliers WHERE id = ?', [id]);
  return rows[0] ?? null;
}

export async function createSupplier(supplier: Omit<Supplier, 'id' | 'created_at'>): Promise<number> {
  const db = await getDb();
  const result = await db.execute(
    `INSERT INTO suppliers (name, category, contact_name, phone, email, address, website, notes, hourly_rate, session_rate, is_favorite)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [supplier.name, supplier.category, supplier.contact_name, supplier.phone, supplier.email, supplier.address, supplier.website, supplier.notes, supplier.hourly_rate, supplier.session_rate, supplier.is_favorite]
  );
  return result.lastInsertId ?? 0;
}

export async function updateSupplier(id: number, updates: Partial<Supplier>): Promise<void> {
  const db = await getDb();
  const fields = Object.keys(updates).filter((k) => UPDATABLE.has(k));
  if (fields.length === 0) return;
  const setClauses = fields.map((f) => `${f} = ?`).join(', ');
  const values: unknown[] = fields.map((f) => (updates as Record<string, unknown>)[f]);
  values.push(id);
  await db.execute(`UPDATE suppliers SET ${setClauses} WHERE id = ?`, values);
}

export async function deleteSupplier(id: number): Promise<void> {
  const db = await getDb();
  await db.execute('DELETE FROM suppliers WHERE id = ?', [id]);
}

export async function toggleFavorite(id: number): Promise<void> {
  const db = await getDb();
  await db.execute('UPDATE suppliers SET is_favorite = CASE WHEN is_favorite = 1 THEN 0 ELSE 1 END WHERE id = ?', [id]);
}
