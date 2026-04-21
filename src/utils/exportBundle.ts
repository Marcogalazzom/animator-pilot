/**
 * Export de toutes les données métier vers un bundle JSON unique,
 * transportable sur clé USB et ré-importable sur un autre poste.
 * Les fichiers photos sont embarqués en base64 (pas de dépendance zip).
 */
import { getDb } from '@/db/database';
import { readPhotoBytes } from './photoStorage';

export const BUNDLE_VERSION = 1;

const TABLES = [
  'residents',
  'activities',
  'photo_albums',
  'photos',
  'projects',
  'actions',
  'animation_budget',
  'expenses',
  'upcoming_expenses',
  'journal',
  'staff',
  'suppliers',
] as const;
type TableName = typeof TABLES[number];

export interface ExportBundle {
  version: number;
  exported_at: string;
  tables: Record<TableName, Record<string, unknown>[]>;
}

function bytesToBase64(bytes: Uint8Array): string {
  // btoa plafonne sur les grosses chaînes, on chunke.
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

function extFromPath(path: string): string {
  const m = path.match(/\.([a-zA-Z0-9]+)$/);
  return m ? m[1].toLowerCase() : 'jpg';
}

export async function buildExportBundle(): Promise<string> {
  const db = await getDb();
  const tables = {} as ExportBundle['tables'];

  for (const t of TABLES) {
    const rows = await db.select<Record<string, unknown>[]>(
      `SELECT * FROM ${t}`,
      [],
    ).catch(() => []);

    if (t === 'photos') {
      // Embed file bytes as base64 so la sauvegarde est self-contained.
      const enriched: Record<string, unknown>[] = [];
      for (const raw of rows) {
        const row = { ...raw };
        const filePath = typeof row.file_path === 'string' ? row.file_path : '';
        const thumbPath = typeof row.thumbnail_path === 'string' ? row.thumbnail_path : '';
        try {
          if (filePath) {
            const bytes = await readPhotoBytes(filePath);
            row.__file_base64 = bytesToBase64(bytes);
            row.__file_ext = extFromPath(filePath);
          }
        } catch {
          row.__file_base64 = '';
        }
        try {
          if (thumbPath) {
            const bytes = await readPhotoBytes(thumbPath);
            row.__thumb_base64 = bytesToBase64(bytes);
          }
        } catch {
          row.__thumb_base64 = '';
        }
        enriched.push(row);
      }
      tables[t] = enriched;
    } else {
      tables[t] = rows;
    }
  }

  const bundle: ExportBundle = {
    version: BUNDLE_VERSION,
    exported_at: new Date().toISOString(),
    tables,
  };
  return JSON.stringify(bundle);
}
