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

// ─── Residence units (étages / UPG / …) ─────────────────────

const DEFAULT_UNITS = ['Étage 1', 'Étage 2', 'UPG Bastille', 'UPG Saint-Hilaire'];

export async function getResidenceUnits(): Promise<string[]> {
  const raw = await getSetting('residence_units');
  if (!raw) return DEFAULT_UNITS;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const units = parsed.filter((x): x is string => typeof x === 'string' && x.trim().length > 0);
      return units.length > 0 ? units : DEFAULT_UNITS;
    }
  } catch { /* fall through */ }
  return DEFAULT_UNITS;
}

export async function setResidenceUnits(units: string[]): Promise<void> {
  const cleaned = units.map((u) => u.trim()).filter((u) => u.length > 0);
  await setSetting('residence_units', JSON.stringify(cleaned));
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
