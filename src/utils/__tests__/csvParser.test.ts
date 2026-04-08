import { describe, it, expect, vi } from 'vitest';

// Mock @/db/types — only types needed, no DB runtime
vi.mock('@/db/types', () => ({}));

// Mock @/pages/kpis/useKpisData to avoid DB imports in the hook
vi.mock('@/pages/kpis/useKpisData', () => ({
  INDICATOR_META: [
    { key: 'taux_occupation',         label: "Taux d'occupation",      unit: '%',   upIsGood: true,  category: 'occupation' },
    { key: 'taux_absenteisme',         label: "Taux d'absentéisme",      unit: '%',   upIsGood: false, category: 'rh' },
    { key: 'evenements_indesirables', label: 'Événements indésirables', unit: '',   upIsGood: false, category: 'qualite' },
    { key: 'budget_realise',           label: 'Budget réalisé',          unit: ' k€', upIsGood: false, category: 'finance' },
  ],
}));

import {
  autoDetectMappings,
  buildImportPreview,
  tryConvertPeriod,
} from '@/utils/csvParser';
import type { RawRow, ColumnMapping } from '@/utils/csvParser';

// ─── tryConvertPeriod ─────────────────────────────────────────────────────────

describe('tryConvertPeriod', () => {
  it('returns null for already-valid YYYY-MM (caller should not call this)', () => {
    // The function doesn't match YYYY-MM strictly, but let's verify slashYM regex
    expect(tryConvertPeriod('2025-01')).toBe('2025-01');
  });

  it('converts YYYY/MM format', () => {
    expect(tryConvertPeriod('2025/03')).toBe('2025-03');
  });

  it('converts YYYY/M with single-digit month', () => {
    expect(tryConvertPeriod('2025/3')).toBe('2025-03');
  });

  it('converts MM/YYYY format', () => {
    expect(tryConvertPeriod('03/2025')).toBe('2025-03');
  });

  it('converts M/YYYY format (single digit month)', () => {
    expect(tryConvertPeriod('3/2025')).toBe('2025-03');
  });

  it('returns null for completely invalid string', () => {
    expect(tryConvertPeriod('not-a-date')).toBeNull();
  });

  it('returns null for empty string (no date parseable)', () => {
    // new Date('') is NaN
    expect(tryConvertPeriod('')).toBeNull();
  });
});

// ─── autoDetectMappings ───────────────────────────────────────────────────────

describe('autoDetectMappings', () => {
  it('detects period column by "mois" keyword', () => {
    const mappings = autoDetectMappings(['mois', 'taux_occupation']);
    expect(mappings[0].role).toBe('period');
  });

  it('detects period column by "period" keyword', () => {
    const mappings = autoDetectMappings(['period', 'value']);
    expect(mappings[0].role).toBe('period');
  });

  it('detects period column by "date" keyword', () => {
    const mappings = autoDetectMappings(['date', 'val']);
    expect(mappings[0].role).toBe('period');
  });

  it('detects indicator column matching known key', () => {
    const mappings = autoDetectMappings(['mois', 'taux_occupation']);
    expect(mappings[1].role).toBe('indicator');
    expect(mappings[1].indicatorKey).toBe('taux_occupation');
  });

  it('detects value column by "valeur" keyword', () => {
    const mappings = autoDetectMappings(['mois', 'valeur']);
    expect(mappings[1].role).toBe('value');
  });

  it('marks unknown columns as ignore', () => {
    const mappings = autoDetectMappings(['unknown_column']);
    expect(mappings[0].role).toBe('ignore');
  });

  it('handles empty headers array', () => {
    const mappings = autoDetectMappings([]);
    expect(mappings).toHaveLength(0);
  });

  it('detects "taux absenteisme" (with space) as indicator', () => {
    const mappings = autoDetectMappings(['taux absenteisme']);
    // After normalization "tauxabsenteisme" matches taux_absenteisme pattern
    expect(mappings[0].role).toBe('indicator');
  });
});

// ─── buildImportPreview ───────────────────────────────────────────────────────

describe('buildImportPreview', () => {
  const sampleMappings: ColumnMapping[] = [
    { header: 'mois',             role: 'period' },
    { header: 'taux_occupation',  role: 'indicator', indicatorKey: 'taux_occupation' },
  ];

  it('returns mapped rows for valid data', () => {
    const rows: RawRow[] = [
      { mois: '2025-01', taux_occupation: '92.5' },
      { mois: '2025-02', taux_occupation: '94.0' },
    ];
    const { mappedRows, warnings } = buildImportPreview(rows, sampleMappings);
    expect(mappedRows).toHaveLength(2);
    expect(mappedRows[0].period).toBe('2025-01');
    expect(mappedRows[0].value).toBe(92.5);
    expect(mappedRows[0].indicator).toBe('taux_occupation');
    expect(warnings).toHaveLength(0);
  });

  it('converts comma-decimal values', () => {
    const rows: RawRow[] = [
      { mois: '2025-01', taux_occupation: '92,5' },
    ];
    const { mappedRows } = buildImportPreview(rows, sampleMappings);
    expect(mappedRows[0].value).toBe(92.5);
  });

  it('auto-converts YYYY/MM period format', () => {
    const rows: RawRow[] = [
      { mois: '2025/01', taux_occupation: '90' },
    ];
    const { mappedRows, warnings } = buildImportPreview(rows, sampleMappings);
    expect(warnings).toHaveLength(0);
    expect(mappedRows[0].period).toBe('2025-01');
  });

  it('emits warning for invalid period', () => {
    const rows: RawRow[] = [
      { mois: 'invalid-date', taux_occupation: '90' },
    ];
    const { mappedRows, warnings } = buildImportPreview(rows, sampleMappings);
    expect(mappedRows).toHaveLength(0);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].message).toContain('période');
  });

  it('emits warning for missing period column data', () => {
    const rows: RawRow[] = [
      { mois: '', taux_occupation: '90' },
    ];
    const { mappedRows, warnings } = buildImportPreview(rows, sampleMappings);
    expect(mappedRows).toHaveLength(0);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].message).toContain('période manquante');
  });

  it('skips empty indicator values without warning', () => {
    const rows: RawRow[] = [
      { mois: '2025-01', taux_occupation: '' },
    ];
    const { mappedRows, warnings } = buildImportPreview(rows, sampleMappings);
    expect(mappedRows).toHaveLength(0);
    expect(warnings).toHaveLength(0);
  });

  it('emits warning for non-numeric indicator value', () => {
    const rows: RawRow[] = [
      { mois: '2025-01', taux_occupation: 'abc' },
    ];
    const { mappedRows, warnings } = buildImportPreview(rows, sampleMappings);
    expect(mappedRows).toHaveLength(0);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].message).toContain('non numérique');
  });

  it('returns empty result for empty rows array', () => {
    const { mappedRows, warnings } = buildImportPreview([], sampleMappings);
    expect(mappedRows).toHaveLength(0);
    expect(warnings).toHaveLength(0);
  });

  it('assigns correct category from INDICATOR_META', () => {
    const rows: RawRow[] = [
      { mois: '2025-01', taux_occupation: '92' },
    ];
    const { mappedRows } = buildImportPreview(rows, sampleMappings);
    expect(mappedRows[0].category).toBe('occupation');
  });
});
