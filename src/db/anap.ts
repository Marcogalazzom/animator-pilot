import { getDb } from './database';
import type { AnapIndicator, AnapCategory } from './types';

const UPDATABLE_FIELDS = new Set(['indicator_key', 'label', 'value_etablissement', 'value_national', 'value_regional', 'unit', 'fiscal_year', 'category']);

export async function getAnapIndicators(fiscalYear?: number, category?: AnapCategory): Promise<AnapIndicator[]> {
  const db = await getDb();
  const conditions: string[] = [];
  const bindings: unknown[] = [];
  if (fiscalYear) { conditions.push('fiscal_year = ?'); bindings.push(fiscalYear); }
  if (category) { conditions.push('category = ?'); bindings.push(category); }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  return db.select<AnapIndicator[]>(`SELECT * FROM anap_indicators ${where} ORDER BY category, indicator_key`, bindings);
}

export async function createAnapIndicator(ind: Omit<AnapIndicator, 'id' | 'created_at'>): Promise<number> {
  const db = await getDb();
  const result = await db.execute(
    'INSERT INTO anap_indicators (indicator_key, label, value_etablissement, value_national, value_regional, unit, fiscal_year, category) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [ind.indicator_key, ind.label, ind.value_etablissement, ind.value_national, ind.value_regional, ind.unit, ind.fiscal_year, ind.category]
  );
  return result.lastInsertId ?? 0;
}

export async function updateAnapIndicator(id: number, updates: Partial<AnapIndicator>): Promise<void> {
  const db = await getDb();
  const fields = Object.keys(updates).filter((k) => UPDATABLE_FIELDS.has(k));
  if (fields.length === 0) return;
  const setClauses = fields.map((f) => `${f} = ?`).join(', ');
  const values: unknown[] = fields.map((f) => (updates as Record<string, unknown>)[f]);
  values.push(id);
  await db.execute(`UPDATE anap_indicators SET ${setClauses} WHERE id = ?`, values);
}

export async function deleteAnapIndicator(id: number): Promise<void> {
  const db = await getDb();
  await db.execute('DELETE FROM anap_indicators WHERE id = ?', [id]);
}

export async function getAnapYears(): Promise<number[]> {
  const db = await getDb();
  const rows = await db.select<{ fiscal_year: number }[]>('SELECT DISTINCT fiscal_year FROM anap_indicators ORDER BY fiscal_year DESC', []);
  return rows.map((r) => r.fiscal_year);
}
