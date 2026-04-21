/**
 * Import additif d'un bundle d'export. Aucune donnée existante n'est
 * écrasée : les lignes sont insérées avec de nouveaux IDs locaux et les
 * références FK sont remappées.
 *
 * Pour `animation_budget` (PK `fiscal_year`), si l'année existe déjà
 * localement, le budget entrant est ignoré (pas d'écrasement).
 */
import { getDb } from '@/db/database';
import { storePhotoFromBytes } from './photoStorage';
import { BUNDLE_VERSION, type ExportBundle } from './exportBundle';

export interface ImportSummary {
  residents: number;
  activities: number;
  albums: number;
  photos: number;
  projects: number;
  actions: number;
  budgets: number;
  expenses: number;
  upcomingExpenses: number;
  journalEntries: number;
  staff: number;
  suppliers: number;
  skipped: number;
  errors: string[];
}

function emptySummary(): ImportSummary {
  return {
    residents: 0, activities: 0, albums: 0, photos: 0,
    projects: 0, actions: 0, budgets: 0, expenses: 0,
    upcomingExpenses: 0, journalEntries: 0, staff: 0, suppliers: 0,
    skipped: 0, errors: [],
  };
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

interface RowLike { [key: string]: unknown }

/**
 * INSERT une ligne sans son `id` ni `created_at` (laissés à SQLite),
 * et retourne le nouvel id local.
 */
async function insertRow(
  table: string,
  row: RowLike,
  columns: string[],
): Promise<number> {
  const db = await getDb();
  const placeholders = columns.map(() => '?').join(', ');
  const values = columns.map((c) => row[c] ?? null);
  const res = await db.execute(
    `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`,
    values as unknown[],
  );
  return res.lastInsertId ?? 0;
}

/** Colonnes INSERT pour chaque table (id et created_at exclus → auto-remplis). */
const INSERT_COLUMNS: Record<string, string[]> = {
  residents: [
    'display_name', 'room_number', 'unit', 'interests', 'animation_notes',
    'participation_level', 'birthday', 'arrival_date', 'mood', 'family_contacts',
  ],
  activities: [
    'title', 'activity_type', 'description', 'date', 'time_start', 'time_end',
    'location', 'max_participants', 'actual_participants', 'animator_name',
    'status', 'materials_needed', 'notes', 'unit', 'category', 'difficulty',
    'is_shared', 'is_template', 'is_recurring',
    'synced_from', 'last_sync_at', 'external_id',
  ],
  photo_albums: [
    'title', 'description', 'activity_date', 'cover_path',
    'activity_id', 'activity_type',
  ],
  photos: [
    'album_id', 'file_path', 'thumbnail_path', 'caption', 'taken_at',
  ],
  projects: [
    'title', 'description', 'owner_role', 'status',
    'start_date', 'due_date', 'category', 'next_action',
  ],
  actions: [
    'project_id', 'title', 'progress', 'due_date', 'status',
  ],
  animation_budget: [
    'fiscal_year', 'total_allocated',
    'limit_intervenants', 'limit_materiel', 'limit_sorties',
    'limit_fetes', 'limit_other',
    'synced_from', 'last_sync_at', 'external_id',
  ],
  expenses: [
    'fiscal_year', 'title', 'category', 'amount', 'date', 'description',
    'supplier', 'invoice_path', 'linked_intervenant_id',
    'synced_from', 'last_sync_at', 'external_id',
  ],
  upcoming_expenses: [
    'title', 'amount', 'due_date', 'recurring', 'frequency', 'note',
  ],
  journal: [
    'date', 'time', 'title', 'author', 'content', 'mood',
    'category', 'tags', 'is_shared', 'linked_resident_ids',
  ],
  staff: [
    // Champs communs attendus ; des colonnes manquantes côté bundle seront NULL.
    'display_name', 'role', 'phone', 'email', 'availability', 'notes',
  ],
  suppliers: [
    'name', 'category', 'contact', 'phone', 'email', 'address',
    'notes', 'is_favorite',
  ],
};

/** Filtre les colonnes à insérer sur celles réellement présentes dans la table locale. */
async function availableColumns(table: string, want: string[]): Promise<string[]> {
  const db = await getDb();
  const cols = await db.select<{ name: string }[]>(
    `SELECT name FROM pragma_table_info('${table}')`,
    [],
  ).catch(() => []);
  const present = new Set(cols.map((c) => c.name));
  return want.filter((c) => present.has(c));
}

function remapCsvIds(csv: unknown, map: Map<number, number>): string {
  if (typeof csv !== 'string' || !csv.trim()) return '';
  return csv
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n))
    .map((n) => map.get(n) ?? null)
    .filter((n): n is number => n != null)
    .join(',');
}

export async function importBundle(json: string): Promise<ImportSummary> {
  const summary = emptySummary();
  let bundle: ExportBundle;
  try {
    bundle = JSON.parse(json);
  } catch {
    summary.errors.push('Fichier JSON invalide.');
    return summary;
  }
  if (!bundle || bundle.version !== BUNDLE_VERSION || !bundle.tables) {
    summary.errors.push('Format de sauvegarde incompatible.');
    return summary;
  }

  const tables = bundle.tables;
  const residentIdMap = new Map<number, number>();
  const albumIdMap = new Map<number, number>();
  const projectIdMap = new Map<number, number>();

  // 1. Résidents
  const residentsCols = await availableColumns('residents', INSERT_COLUMNS.residents);
  for (const raw of tables.residents ?? []) {
    try {
      const newId = await insertRow('residents', raw, residentsCols);
      if (typeof raw.id === 'number') residentIdMap.set(raw.id, newId);
      summary.residents++;
    } catch { summary.skipped++; }
  }

  // 2. Suppliers
  const suppliersCols = await availableColumns('suppliers', INSERT_COLUMNS.suppliers);
  for (const raw of tables.suppliers ?? []) {
    try {
      await insertRow('suppliers', raw, suppliersCols);
      summary.suppliers++;
    } catch { summary.skipped++; }
  }

  // 3. Staff
  const staffCols = await availableColumns('staff', INSERT_COLUMNS.staff);
  for (const raw of tables.staff ?? []) {
    try {
      await insertRow('staff', raw, staffCols);
      summary.staff++;
    } catch { summary.skipped++; }
  }

  // 4. Albums
  const albumsCols = await availableColumns('photo_albums', INSERT_COLUMNS.photo_albums);
  for (const raw of tables.photo_albums ?? []) {
    try {
      const row = { ...raw, cover_path: null }; // régénéré côté photos si besoin
      const newId = await insertRow('photo_albums', row, albumsCols);
      if (typeof raw.id === 'number') albumIdMap.set(raw.id, newId);
      summary.albums++;
    } catch { summary.skipped++; }
  }

  // 5. Activités
  const activitiesCols = await availableColumns('activities', INSERT_COLUMNS.activities);
  for (const raw of tables.activities ?? []) {
    try {
      await insertRow('activities', raw, activitiesCols);
      summary.activities++;
    } catch { summary.skipped++; }
  }

  // 6. Projets
  const projectsCols = await availableColumns('projects', INSERT_COLUMNS.projects);
  for (const raw of tables.projects ?? []) {
    try {
      const newId = await insertRow('projects', raw, projectsCols);
      if (typeof raw.id === 'number') projectIdMap.set(raw.id, newId);
      summary.projects++;
    } catch { summary.skipped++; }
  }

  // 7. Budgets — clé `fiscal_year` unique, skip si l'année existe déjà.
  const budgetsCols = await availableColumns('animation_budget', INSERT_COLUMNS.animation_budget);
  const db = await getDb();
  const existingYears = await db.select<{ fiscal_year: number }[]>(
    'SELECT fiscal_year FROM animation_budget', [],
  ).catch(() => []);
  const existingYearSet = new Set(existingYears.map((r) => r.fiscal_year));
  for (const raw of tables.animation_budget ?? []) {
    const year = typeof raw.fiscal_year === 'number' ? raw.fiscal_year : 0;
    if (existingYearSet.has(year)) { summary.skipped++; continue; }
    try {
      await insertRow('animation_budget', raw, budgetsCols);
      summary.budgets++;
    } catch { summary.skipped++; }
  }

  // 8. Photos — copier les fichiers à partir du base64, mapper album_id.
  const photosCols = await availableColumns('photos', INSERT_COLUMNS.photos);
  for (const raw of tables.photos ?? []) {
    try {
      const base64 = typeof raw.__file_base64 === 'string' ? raw.__file_base64 : '';
      const ext = typeof raw.__file_ext === 'string' ? raw.__file_ext : 'jpg';
      if (!base64) { summary.skipped++; continue; }
      const bytes = base64ToBytes(base64);
      const stored = await storePhotoFromBytes(bytes, ext);

      const oldAlbumId = typeof raw.album_id === 'number' ? raw.album_id : 0;
      const newAlbumId = albumIdMap.get(oldAlbumId);
      if (!newAlbumId) { summary.skipped++; continue; }

      const row = {
        ...raw,
        album_id: newAlbumId,
        file_path: stored.filePath,
        thumbnail_path: stored.thumbnailPath,
      };
      await insertRow('photos', row, photosCols);
      summary.photos++;
    } catch { summary.skipped++; }
  }

  // 9. Expenses (no FK remap — fiscal_year est un entier libre)
  const expensesCols = await availableColumns('expenses', INSERT_COLUMNS.expenses);
  for (const raw of tables.expenses ?? []) {
    try {
      await insertRow('expenses', raw, expensesCols);
      summary.expenses++;
    } catch { summary.skipped++; }
  }

  // 10. Upcoming expenses
  const upcomingCols = await availableColumns('upcoming_expenses', INSERT_COLUMNS.upcoming_expenses);
  for (const raw of tables.upcoming_expenses ?? []) {
    try {
      await insertRow('upcoming_expenses', raw, upcomingCols);
      summary.upcomingExpenses++;
    } catch { summary.skipped++; }
  }

  // 11. Actions (project_id remap)
  const actionsCols = await availableColumns('actions', INSERT_COLUMNS.actions);
  for (const raw of tables.actions ?? []) {
    const oldPid = typeof raw.project_id === 'number' ? raw.project_id : 0;
    const newPid = projectIdMap.get(oldPid);
    if (!newPid) { summary.skipped++; continue; }
    try {
      await insertRow('actions', { ...raw, project_id: newPid }, actionsCols);
      summary.actions++;
    } catch { summary.skipped++; }
  }

  // 12. Journal (linked_resident_ids remap)
  const journalCols = await availableColumns('journal', INSERT_COLUMNS.journal);
  for (const raw of tables.journal ?? []) {
    try {
      const mapped = remapCsvIds(raw.linked_resident_ids, residentIdMap);
      await insertRow('journal', { ...raw, linked_resident_ids: mapped }, journalCols);
      summary.journalEntries++;
    } catch { summary.skipped++; }
  }

  return summary;
}
