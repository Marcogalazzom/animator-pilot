import Database from '@tauri-apps/plugin-sql';
import { COLOR_PALETTE, DEFAULT_ACTIVITY_TYPES } from '@/data/activityTypeLibrary';

let dbPromise: Promise<Database> | null = null;

export function getDb(): Promise<Database> {
  if (!dbPromise) {
    dbPromise = Database.load('sqlite:pilot-animateur.db')
      .then(async (db) => {
        await ensureActivitiesSchema(db);
        await ensureJournalSchema(db);
        await ensureResidentsSchema(db);
        await ensureProjectsSchema(db);
        await ensureBudgetSchema(db);
        await ensureSettingsSeeded(db);
        await seedActivityTypes(db);
        return db;
      })
      .catch((err) => {
        dbPromise = null;
        throw err;
      });
  }
  return dbPromise;
}

// Defence against silent skip of tauri-plugin-sql migrations: we re-check and patch
// the schema at every open. Keeps installs resilient to dropped/missed migrations.

async function tableColumns(db: Database, table: string): Promise<Set<string>> {
  const cols = await db.select<{ name: string }[]>(
    `SELECT name FROM pragma_table_info('${table}')`,
    [],
  );
  return new Set(cols.map((c) => c.name));
}

async function ensureActivitiesSchema(db: Database): Promise<void> {
  try {
    const names = await tableColumns(db, 'activities');
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

    if (!names.has('category')) {
      await db.execute(
        "ALTER TABLE activities ADD COLUMN category TEXT NOT NULL DEFAULT 'prep'",
        [],
      );
      await db.execute(
        'CREATE INDEX IF NOT EXISTS idx_activities_category ON activities(category)',
        [],
      );
    }

    if (!names.has('difficulty')) {
      await db.execute(
        "ALTER TABLE activities ADD COLUMN difficulty TEXT NOT NULL DEFAULT 'facile'",
        [],
      );
    }

    if (patched) {
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

    const names = await tableColumns(db, 'journal');
    if (!names.has('is_shared')) {
      await db.execute(
        'ALTER TABLE journal ADD COLUMN is_shared INTEGER NOT NULL DEFAULT 0',
        [],
      );
      await db.execute(
        'CREATE INDEX IF NOT EXISTS idx_journal_shared ON journal(is_shared)',
        [],
      );
    }
    if (!names.has('linked_resident_ids')) {
      await db.execute(
        "ALTER TABLE journal ADD COLUMN linked_resident_ids TEXT NOT NULL DEFAULT ''",
        [],
      );
    }
    if (!names.has('title')) {
      await db.execute("ALTER TABLE journal ADD COLUMN title TEXT NOT NULL DEFAULT ''", []);
    }
    if (!names.has('time')) {
      await db.execute("ALTER TABLE journal ADD COLUMN time TEXT NOT NULL DEFAULT ''", []);
    }
    if (!names.has('author')) {
      await db.execute("ALTER TABLE journal ADD COLUMN author TEXT NOT NULL DEFAULT ''", []);
    }
    if (!names.has('category')) {
      await db.execute(
        "ALTER TABLE journal ADD COLUMN category TEXT NOT NULL DEFAULT 'prep'",
        [],
      );
      await db.execute(
        'CREATE INDEX IF NOT EXISTS idx_journal_category ON journal(category)',
        [],
      );
    }
  } catch (err) {
    console.error('[schema-guard] ensureJournalSchema failed:', err);
  }
}

async function ensureResidentsSchema(db: Database): Promise<void> {
  try {
    const names = await tableColumns(db, 'residents');

    if (!names.has('birthday')) {
      await db.execute('ALTER TABLE residents ADD COLUMN birthday TEXT', []);
      await db.execute(
        'CREATE INDEX IF NOT EXISTS idx_residents_birthday ON residents(birthday)',
        [],
      );
    }
    if (!names.has('arrival_date')) {
      await db.execute('ALTER TABLE residents ADD COLUMN arrival_date TEXT', []);
    }
    if (!names.has('mood')) {
      await db.execute(
        "ALTER TABLE residents ADD COLUMN mood TEXT NOT NULL DEFAULT 'calm'",
        [],
      );
    }
    if (!names.has('family_contacts')) {
      await db.execute(
        "ALTER TABLE residents ADD COLUMN family_contacts TEXT NOT NULL DEFAULT ''",
        [],
      );
    }
    if (!names.has('unit')) {
      await db.execute(
        "ALTER TABLE residents ADD COLUMN unit TEXT NOT NULL DEFAULT ''",
        [],
      );
      await db.execute(
        'CREATE INDEX IF NOT EXISTS idx_residents_unit ON residents(unit)',
        [],
      );
    }
  } catch (err) {
    console.error('[schema-guard] ensureResidentsSchema failed:', err);
  }
}

async function ensureProjectsSchema(db: Database): Promise<void> {
  try {
    const names = await tableColumns(db, 'projects');

    if (!names.has('category')) {
      await db.execute(
        "ALTER TABLE projects ADD COLUMN category TEXT NOT NULL DEFAULT ''",
        [],
      );
    }
    if (!names.has('next_action')) {
      await db.execute(
        "ALTER TABLE projects ADD COLUMN next_action TEXT NOT NULL DEFAULT ''",
        [],
      );
    }
  } catch (err) {
    console.error('[schema-guard] ensureProjectsSchema failed:', err);
  }
}

async function ensureBudgetSchema(db: Database): Promise<void> {
  try {
    const names = await tableColumns(db, 'animation_budget');
    const limits: Array<[string, string]> = [
      ['limit_intervenants', 'limit_intervenants'],
      ['limit_materiel',     'limit_materiel'],
      ['limit_sorties',      'limit_sorties'],
      ['limit_fetes',        'limit_fetes'],
      ['limit_other',        'limit_other'],
    ];
    for (const [col] of limits) {
      if (!names.has(col)) {
        await db.execute(
          `ALTER TABLE animation_budget ADD COLUMN ${col} REAL NOT NULL DEFAULT 3000`,
          [],
        );
      }
    }

    // Upcoming expenses table may be missing if migration 020 was skipped.
    await db.execute(
      `CREATE TABLE IF NOT EXISTS upcoming_expenses (
         id         INTEGER PRIMARY KEY AUTOINCREMENT,
         title      TEXT    NOT NULL,
         amount     REAL    NOT NULL DEFAULT 0,
         due_date   TEXT    NOT NULL,
         recurring  INTEGER NOT NULL DEFAULT 0,
         frequency  TEXT    NOT NULL DEFAULT '',
         note       TEXT    NOT NULL DEFAULT '',
         created_at TEXT    NOT NULL DEFAULT (datetime('now'))
       )`,
      [],
    );
    await db.execute(
      'CREATE INDEX IF NOT EXISTS idx_upcoming_due ON upcoming_expenses(due_date)',
      [],
    );
  } catch (err) {
    console.error('[schema-guard] ensureBudgetSchema failed:', err);
  }
}

async function seedActivityTypes(db: Database): Promise<void> {
  // Mirror planning-ehpad's DEFAULT_TYPES into category_colors so activities
  // display the same label + color as the web planner.
  try {
    for (const t of DEFAULT_ACTIVITY_TYPES) {
      const swatch = COLOR_PALETTE[t.colorName] ?? COLOR_PALETTE.slate;
      await db.execute(
        `INSERT INTO category_colors (module, name, color, bg, label)
         VALUES ('activities', ?, ?, ?, ?)
         ON CONFLICT(module, name) DO UPDATE SET
           color = excluded.color,
           bg    = excluded.bg,
           label = excluded.label`,
        [t.key, swatch.hex, swatch.hexBg, t.label],
      );
    }
  } catch (err) {
    console.error('[schema-guard] seedActivityTypes failed:', err);
  }
}

async function ensureSettingsSeeded(db: Database): Promise<void> {
  try {
    const seeds: Array<[string, string]> = [
      ['user_first_name', 'Marie'],
      ['user_last_name',  'Coste'],
      ['user_role',       'Animatrice'],
      ['residence_name',  'Les Glycines'],
      ['residence_kind',  'EHPAD'],
      ['residence_units', '["Étage 1","Étage 2","UPG Bastille","UPG Saint-Hilaire"]'],
    ];
    for (const [key, value] of seeds) {
      await db.execute(
        'INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)',
        [key, value],
      );
    }
  } catch (err) {
    console.error('[schema-guard] ensureSettingsSeeded failed:', err);
  }
}
