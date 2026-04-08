import { getDb } from './database';
import type { Alert, AlertRule, AlertModule } from './types';

export async function getAlerts(isRead?: boolean, limit = 50): Promise<Alert[]> {
  const db = await getDb();
  const conditions: string[] = [];
  const bindings: unknown[] = [];
  if (isRead !== undefined) { conditions.push('is_read = ?'); bindings.push(isRead ? 1 : 0); }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  bindings.push(limit);
  return db.select<Alert[]>(`SELECT * FROM alerts ${where} ORDER BY triggered_at DESC LIMIT ?`, bindings);
}

export async function getUnreadAlertCount(): Promise<number> {
  const db = await getDb();
  const rows = await db.select<{ cnt: number }[]>('SELECT COUNT(*) as cnt FROM alerts WHERE is_read = 0', []);
  return rows[0]?.cnt ?? 0;
}

export async function createAlert(alert: Omit<Alert, 'id' | 'triggered_at'>): Promise<number> {
  const db = await getDb();
  const result = await db.execute(
    'INSERT INTO alerts (rule_id, module, severity, title, message, link_path, link_entity_id, is_read) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [alert.rule_id, alert.module, alert.severity, alert.title, alert.message, alert.link_path, alert.link_entity_id, alert.is_read]
  );
  return result.lastInsertId ?? 0;
}

export async function markAlertAsRead(id: number): Promise<void> {
  const db = await getDb();
  await db.execute('UPDATE alerts SET is_read = 1 WHERE id = ?', [id]);
}

export async function markAllAlertsAsRead(): Promise<void> {
  const db = await getDb();
  await db.execute('UPDATE alerts SET is_read = 1 WHERE is_read = 0', []);
}

export async function deleteOldAlerts(daysToKeep = 90): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM alerts WHERE triggered_at < datetime('now', '-' || ? || ' days')", [daysToKeep]);
}

export async function getAlertRules(isActive?: boolean): Promise<AlertRule[]> {
  const db = await getDb();
  if (isActive !== undefined) {
    return db.select<AlertRule[]>('SELECT * FROM alert_rules WHERE is_active = ? ORDER BY module, rule_type', [isActive ? 1 : 0]);
  }
  return db.select<AlertRule[]>('SELECT * FROM alert_rules ORDER BY module, rule_type', []);
}

export async function alertExistsToday(module: AlertModule, title: string): Promise<boolean> {
  const db = await getDb();
  const rows = await db.select<{ cnt: number }[]>(
    "SELECT COUNT(*) as cnt FROM alerts WHERE module = ? AND title = ? AND triggered_at >= date('now')",
    [module, title]
  );
  return (rows[0]?.cnt ?? 0) > 0;
}
