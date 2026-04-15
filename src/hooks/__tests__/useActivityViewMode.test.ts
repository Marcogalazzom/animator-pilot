import { describe, it, expect } from 'vitest';
import { normalizeUnit, filterByViewMode } from '../useActivityViewMode';

describe('normalizeUnit', () => {
  it('returns "pasa" only when unit is exactly "pasa"', () => {
    expect(normalizeUnit('pasa')).toBe('pasa');
  });

  it('returns "main" for any other value, including null/undefined', () => {
    expect(normalizeUnit('main')).toBe('main');
    expect(normalizeUnit('')).toBe('main');
    expect(normalizeUnit(null)).toBe('main');
    expect(normalizeUnit(undefined)).toBe('main');
    expect(normalizeUnit('PASA')).toBe('main'); // strict match; Firestore always stores lowercase
  });
});

describe('filterByViewMode', () => {
  const items = [
    { id: 1, unit: 'pasa' },
    { id: 2, unit: 'main' },
    { id: 3, unit: 'pasa' },
    { id: 4, unit: '' },
    { id: 5, unit: null },
    { id: 6 }, // missing unit entirely
  ];

  it('animations mode keeps non-PASA entries', () => {
    expect(filterByViewMode(items, 'animations').map((i) => i.id)).toEqual([2, 4, 5, 6]);
  });

  it('pasa mode keeps only PASA entries', () => {
    expect(filterByViewMode(items, 'pasa').map((i) => i.id)).toEqual([1, 3]);
  });
});
