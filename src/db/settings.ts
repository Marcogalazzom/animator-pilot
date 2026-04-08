import { getDb } from './database';

export async function getSetting(key: string): Promise<string | null> {
  const db = await getDb();
  const rows = await db.select<{ key: string; value: string }[]>(
    'SELECT value FROM app_settings WHERE key = ?',
    [key]
  );
  return rows[0]?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO app_settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value]
  );
}

export async function getAllSettings(): Promise<Record<string, string>> {
  const db = await getDb();
  const rows = await db.select<{ key: string; value: string }[]>(
    'SELECT key, value FROM app_settings',
    []
  );
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

// INSERT OR IGNORE intentional: never overwrite user-customized values
export async function seedDefaults(): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)`,
    ['establishment_name', 'Mon EHPAD']
  );
  await db.execute(
    `INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)`,
    ['bed_count', '80']
  );
}
