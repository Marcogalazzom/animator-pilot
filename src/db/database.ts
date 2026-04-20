import Database from '@tauri-apps/plugin-sql';

let dbPromise: Promise<Database> | null = null;

export function getDb(): Promise<Database> {
  if (!dbPromise) {
    dbPromise = Database.load('sqlite:pilot-animateur.db')
      .then(async (db) => {
        await ensureActivitiesSchema(db);
        await ensureJournalSchema(db);
        return db;
      })
      .catch((err) => {
        dbPromise = null;
        throw err;
      });
  }
  return dbPromise;
}

// Défense contre l'échec silencieux des migrations tauri-plugin-sql :
// on vérifie et complète le schéma d'`activities` à chaque ouverture.
// Sans la colonne `unit`, le filtre Animations/PASA retourne zéro résultat
// et la sync plante avec "no such column: unit".
async function ensureActivitiesSchema(db: Database): Promise<void> {
  try {
    const cols = await db.select<{ name: string }[]>(
      "SELECT name FROM pragma_table_info('activities')",
      [],
    );
    const names = new Set(cols.map((c) => c.name));
    let patched = false;

    if (!names.has('unit')) {
      await db.execute(
        "ALTER TABLE activities ADD COLUMN unit TEXT NOT NULL DEFAULT 'main'",
        [],
      );
      await db.execute(
        'CREATE INDEX IF NOT EXISTS idx_activities_unit ON activities(unit)',
        [],
      );
      patched = true;
    }

    if (!names.has('is_recurring')) {
      await db.execute(
        'ALTER TABLE activities ADD COLUMN is_recurring INTEGER NOT NULL DEFAULT 0',
        [],
      );
      await db.execute(
        'CREATE INDEX IF NOT EXISTS idx_activities_recurring ON activities(is_recurring)',
        [],
      );
      patched = true;
    }

    if (patched) {
      // Force un pull complet au prochain sync pour re-tagguer les activités
      // avec leur vraie valeur `unit` depuis Firestore.
      await db.execute(
        "DELETE FROM activities WHERE synced_from = 'planning-ehpad'",
        [],
      );
      await db.execute(
        "DELETE FROM sync_log WHERE module = 'activities'",
        [],
      );
    }
  } catch (err) {
    console.error('[schema-guard] ensureActivitiesSchema failed:', err);
  }
}

async function ensureJournalSchema(db: Database): Promise<void> {
  try {
    await db.execute(
      `CREATE TABLE IF NOT EXISTS journal (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        date            TEXT    NOT NULL,
        content         TEXT    NOT NULL DEFAULT '',
        mood            TEXT    NOT NULL DEFAULT 'neutral',
        tags            TEXT    NOT NULL DEFAULT '',
        created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
      )`,
      [],
    );
    await db.execute(
      'CREATE INDEX IF NOT EXISTS idx_journal_date ON journal(date)',
      [],
    );
  } catch (err) {
    console.error('[schema-guard] ensureJournalSchema failed:', err);
  }
}
