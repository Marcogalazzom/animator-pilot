import { getDb } from './database';
import type { SyncLog, SyncModule, SyncStatus } from './types';

export async function createSyncLog(module: SyncModule, direction: 'pull' | 'push'): Promise<number> {
  const db = await getDb();
  const result = await db.execute(
    `INSERT INTO sync_log (module, direction, status) VALUES (?, ?, 'syncing')`,
    [module, direction]
  );
  return result.lastInsertId ?? 0;
}

export async function completeSyncLog(
  id: number,
  itemsSynced: number,
  itemsFailed: number,
  status: SyncStatus,
  errorMessage?: string
): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE sync_log SET items_synced = ?, items_failed = ?, status = ?, error_message = ?, finished_at = datetime('now') WHERE id = ?`,
    [itemsSynced, itemsFailed, status, errorMessage ?? null, id]
  );
}

export async function getLastSync(module: SyncModule): Promise<SyncLog | null> {
  const db = await getDb();
  const rows = await db.select<SyncLog[]>(
    `SELECT * FROM sync_log WHERE module = ? AND status = 'success' ORDER BY finished_at DESC LIMIT 1`,
    [module]
  );
  return rows[0] ?? null;
}

export async function getSyncLogs(limit = 20): Promise<SyncLog[]> {
  const db = await getDb();
  return db.select<SyncLog[]>(
    `SELECT * FROM sync_log ORDER BY started_at DESC LIMIT ?`,
    [limit]
  );
}

export async function getLastSyncAll(): Promise<Record<SyncModule, SyncLog | null>> {
  const modules: SyncModule[] = ['activities', 'inventory', 'staff', 'budget'];
  const result: Record<string, SyncLog | null> = {};
  for (const mod of modules) {
    result[mod] = await getLastSync(mod).catch(() => null);
  }
  return result as Record<SyncModule, SyncLog | null>;
}
