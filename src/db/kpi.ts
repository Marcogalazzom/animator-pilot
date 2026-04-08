import { getDb } from './database';
import type { KpiEntry, KpiThreshold } from './types';

export async function getKpiEntries(category?: string, period?: string): Promise<KpiEntry[]> {
  const db = await getDb();
  const conditions: string[] = [];
  const bindings: unknown[] = [];

  if (category) {
    conditions.push('category = ?');
    bindings.push(category);
  }
  if (period) {
    conditions.push('period = ?');
    bindings.push(period);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  return db.select<KpiEntry[]>(
    `SELECT * FROM kpi_entries ${where} ORDER BY period DESC, category, indicator`,
    bindings
  );
}

export async function addKpiEntry(entry: Omit<KpiEntry, 'id' | 'created_at'>): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO kpi_entries (category, indicator, value, period, source)
     VALUES (?, ?, ?, ?, ?)`,
    [entry.category, entry.indicator, entry.value, entry.period, entry.source]
  );
}

export async function deleteKpiEntry(id: number): Promise<void> {
  const db = await getDb();
  await db.execute('DELETE FROM kpi_entries WHERE id = ?', [id]);
}

export async function getKpiThresholds(): Promise<KpiThreshold[]> {
  const db = await getDb();
  return db.select<KpiThreshold[]>('SELECT * FROM kpi_thresholds ORDER BY indicator', []);
}

export async function setKpiThreshold(threshold: Omit<KpiThreshold, 'id'>): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO kpi_thresholds (indicator, warning, critical, direction)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(indicator) DO UPDATE SET
       warning = excluded.warning,
       critical = excluded.critical,
       direction = excluded.direction`,
    [threshold.indicator, threshold.warning, threshold.critical, threshold.direction]
  );
}
