import { useState, useEffect, useCallback } from 'react';
import { getAnapIndicators, updateAnapIndicator, getAnapYears } from '@/db';
import type { AnapIndicator, AnapCategory } from '@/db/types';

export const ANAP_CATEGORY_LABELS: Record<AnapCategory, string> = {
  activite: 'Activité', rh: 'Ressources humaines', finance: 'Finance', qualite: 'Qualité',
  immobilier: 'Immobilier', other: 'Autre',
};

export interface BenchmarkingData {
  indicators: AnapIndicator[];
  years: number[];
  loading: boolean;
  selectedYear: number;
  setSelectedYear: (y: number) => void;
  filterCategory: AnapCategory | null;
  setFilterCategory: (c: AnapCategory | null) => void;
  refresh: () => void;
  editIndicator: (id: number, updates: Partial<AnapIndicator>) => Promise<void>;
}

export function useBenchmarkingData(): BenchmarkingData {
  const [indicators, setIndicators] = useState<AnapIndicator[]>([]);
  const [years, setYears] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(2024);
  const [filterCategory, setFilterCategory] = useState<AnapCategory | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [dbIndicators, dbYears] = await Promise.all([
        getAnapIndicators(selectedYear, filterCategory ?? undefined).catch(() => []),
        getAnapYears().catch(() => [2024]),
      ]);
      setIndicators(dbIndicators as AnapIndicator[]);
      setYears(dbYears.length > 0 ? dbYears : [2024]);
    } finally { setLoading(false); }
  }, [selectedYear, filterCategory]);

  useEffect(() => { loadData(); }, [loadData]);

  return {
    indicators, years, loading,
    selectedYear, setSelectedYear,
    filterCategory, setFilterCategory,
    refresh: loadData,
    editIndicator: async (id, u) => { await updateAnapIndicator(id, u); await loadData(); },
  };
}
