import { describe, it, expect } from 'vitest';
import { isPasaLocation, filterByViewMode } from '../useActivityViewMode';

describe('isPasaLocation', () => {
  it('matches "PASA" case-insensitively and with whitespace', () => {
    expect(isPasaLocation('PASA')).toBe(true);
    expect(isPasaLocation('pasa')).toBe(true);
    expect(isPasaLocation('  Pasa  ')).toBe(true);
  });

  it('returns false for other locations and empty values', () => {
    expect(isPasaLocation('Salon')).toBe(false);
    expect(isPasaLocation('Étage 1')).toBe(false);
    expect(isPasaLocation('')).toBe(false);
    expect(isPasaLocation(null)).toBe(false);
    expect(isPasaLocation(undefined)).toBe(false);
  });
});

describe('filterByViewMode', () => {
  const items = [
    { id: 1, location: 'PASA' },
    { id: 2, location: 'Salon' },
    { id: 3, location: 'pasa' },
    { id: 4, location: '' },
    { id: 5, location: null },
  ];

  it('animations mode hides PASA entries', () => {
    expect(filterByViewMode(items, 'animations').map((i) => i.id)).toEqual([2, 4, 5]);
  });

  it('pasa mode keeps only PASA entries', () => {
    expect(filterByViewMode(items, 'pasa').map((i) => i.id)).toEqual([1, 3]);
  });
});
