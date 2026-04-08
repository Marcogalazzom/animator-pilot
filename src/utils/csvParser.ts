import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import type { KpiCategory } from '@/db/types';
import { INDICATOR_META } from '@/pages/kpis/useKpisData';

// ─── Types ────────────────────────────────────────────────────────────────────

export type RawRow = Record<string, string>;

export type ColumnRole = 'indicator' | 'period' | 'value' | 'ignore';

export interface ColumnMapping {
  header: string;
  role: ColumnRole;
  /** If role === 'indicator', the mapped KPI key */
  indicatorKey?: string;
}

export interface MappedRow {
  period: string;
  indicator: string;
  category: KpiCategory;
  value: number;
}

export interface ValidationWarning {
  row: number;
  message: string;
}

export interface ParseResult {
  headers: string[];
  rows: RawRow[];
  error?: string;
}

export interface ImportPreview {
  mappedRows: MappedRow[];
  warnings: ValidationWarning[];
}

// ─── File parsing ─────────────────────────────────────────────────────────────

export async function parseFile(file: File): Promise<ParseResult> {
  const ext = file.name.split('.').pop()?.toLowerCase();

  if (ext === 'csv') {
    return parseCsv(file);
  } else if (ext === 'xlsx' || ext === 'xls') {
    return parseExcel(file);
  }
  return { headers: [], rows: [], error: 'Format de fichier non supporté. Utilisez .csv, .xlsx ou .xls.' };
}

function parseCsv(file: File): Promise<ParseResult> {
  return new Promise((resolve) => {
    Papa.parse<RawRow>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
      complete: (results) => {
        if (results.errors.length > 0 && results.data.length === 0) {
          resolve({ headers: [], rows: [], error: results.errors[0].message });
          return;
        }
        const headers = results.meta.fields ?? [];
        resolve({ headers, rows: results.data });
      },
      error: (err) => {
        resolve({ headers: [], rows: [], error: err.message });
      },
    });
  });
}

async function parseExcel(file: File): Promise<ParseResult> {
  try {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return { headers: [], rows: [], error: 'Classeur Excel vide.' };

    const sheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json<RawRow>(sheet, {
      header: 1,
      defval: '',
    });

    if (jsonData.length === 0) return { headers: [], rows: [], error: 'Feuille Excel vide.' };

    // First row as headers
    const rawHeaders = (jsonData[0] as unknown as string[]).map((h) => String(h).trim());
    const rows: RawRow[] = (jsonData.slice(1) as unknown as string[][])
      .filter((row) => row.some((cell) => String(cell).trim() !== ''))
      .map((row) => {
        const obj: RawRow = {};
        rawHeaders.forEach((h, i) => {
          obj[h] = String(row[i] ?? '').trim();
        });
        return obj;
      });

    return { headers: rawHeaders, rows };
  } catch (err) {
    return { headers: [], rows: [], error: `Erreur de lecture Excel: ${String(err)}` };
  }
}

// ─── Auto-detect column mapping ───────────────────────────────────────────────

const PERIOD_PATTERNS = ['period', 'période', 'mois', 'month', 'date', 'année', 'year'];
const VALUE_PATTERNS  = ['valeur', 'value', 'val', 'montant', 'taux', 'nombre', 'count', 'qty'];

/** Indicator key patterns for auto-detection */
const INDICATOR_PATTERNS: Array<{ patterns: string[]; key: string }> = INDICATOR_META.map((m) => ({
  patterns: [m.key, m.label.toLowerCase(), ...m.key.split('_')],
  key: m.key,
}));

export function autoDetectMappings(headers: string[]): ColumnMapping[] {
  return headers.map((header) => {
    const h = header.toLowerCase().replace(/[_\- ]/g, '');

    // Check period
    if (PERIOD_PATTERNS.some((p) => h.includes(p.replace(/[_\- ]/g, '')))) {
      return { header, role: 'period' as ColumnRole };
    }

    // Check indicator key match
    for (const { patterns, key } of INDICATOR_PATTERNS) {
      const normalized = patterns.map((p) => p.toLowerCase().replace(/[_\- ]/g, ''));
      if (normalized.some((p) => h.includes(p) || p.includes(h))) {
        return { header, role: 'indicator' as ColumnRole, indicatorKey: key };
      }
    }

    // Check value
    if (VALUE_PATTERNS.some((p) => h.includes(p.replace(/[_\- ]/g, '')))) {
      return { header, role: 'value' as ColumnRole };
    }

    return { header, role: 'ignore' as ColumnRole };
  });
}

// ─── Build preview from mapping ───────────────────────────────────────────────

const PERIOD_REGEX = /^\d{4}-\d{2}$/;

export function buildImportPreview(
  rows: RawRow[],
  mappings: ColumnMapping[]
): ImportPreview {
  const periodCol   = mappings.find((m) => m.role === 'period');
  const valueCol    = mappings.find((m) => m.role === 'value');
  const indicatorCols = mappings.filter((m) => m.role === 'indicator' && m.indicatorKey);

  const mappedRows: MappedRow[] = [];
  const warnings: ValidationWarning[] = [];

  rows.forEach((row, i) => {
    const rowNum = i + 2; // 1-indexed + header offset

    // Get period
    let period = periodCol ? row[periodCol.header]?.trim() : '';
    if (period && !PERIOD_REGEX.test(period)) {
      // Try to convert common date formats to YYYY-MM
      const converted = tryConvertPeriod(period);
      if (converted) {
        period = converted;
      } else {
        warnings.push({ row: rowNum, message: `Ligne ${rowNum}: période "${period}" invalide (attendu YYYY-MM)` });
        return;
      }
    }

    if (!period) {
      warnings.push({ row: rowNum, message: `Ligne ${rowNum}: colonne période manquante` });
      return;
    }

    if (indicatorCols.length > 0) {
      // Each indicator column → one row per indicator
      for (const col of indicatorCols) {
        const raw = row[col.header]?.trim();
        if (!raw) continue;
        const num = parseFloat(raw.replace(',', '.'));
        if (isNaN(num)) {
          warnings.push({ row: rowNum, message: `Ligne ${rowNum}: valeur "${raw}" non numérique pour ${col.indicatorKey}` });
          continue;
        }
        const meta = INDICATOR_META.find((m) => m.key === col.indicatorKey);
        mappedRows.push({
          period,
          indicator: col.indicatorKey!,
          category: meta?.category ?? 'occupation',
          value: num,
        });
      }
    } else if (valueCol) {
      // Single value column — need an indicator column
      const raw = row[valueCol.header]?.trim();
      if (!raw) {
        warnings.push({ row: rowNum, message: `Ligne ${rowNum}: valeur manquante` });
        return;
      }
      const num = parseFloat(raw.replace(',', '.'));
      if (isNaN(num)) {
        warnings.push({ row: rowNum, message: `Ligne ${rowNum}: valeur "${raw}" non numérique` });
        return;
      }
      // Look for an indicator name in a separate column
      const indicatorNameCol = mappings.find(
        (m) => m.role === 'ignore' &&
               m.header.toLowerCase().includes('indicator')
      );
      const indicatorKey = indicatorNameCol ? row[indicatorNameCol.header]?.trim() : undefined;
      const meta = indicatorKey ? INDICATOR_META.find((m) => m.key === indicatorKey) : undefined;
      mappedRows.push({
        period,
        indicator: indicatorKey ?? 'taux_occupation',
        category: meta?.category ?? 'occupation',
        value: num,
      });
    }
  });

  return { mappedRows, warnings };
}

export function tryConvertPeriod(raw: string): string | null {
  // Try YYYY/MM or MM/YYYY or YYYY-M etc.
  const slashYM = raw.match(/^(\d{4})[\/\-](\d{1,2})$/);
  if (slashYM) return `${slashYM[1]}-${slashYM[2].padStart(2, '0')}`;

  const slashMY = raw.match(/^(\d{1,2})[\/\-](\d{4})$/);
  if (slashMY) return `${slashMY[2]}-${slashMY[1].padStart(2, '0')}`;

  // Try parsing as date
  const d = new Date(raw);
  if (!isNaN(d.getTime())) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  return null;
}
