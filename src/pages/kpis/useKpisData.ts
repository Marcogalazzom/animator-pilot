import { useState, useEffect, useCallback } from 'react';
import { getKpiEntries, getKpiThresholds } from '@/db';
import type { KpiEntry, KpiThreshold, KpiCategory } from '@/db/types';

// ─── Indicator metadata ───────────────────────────────────────────────────────

export interface IndicatorMeta {
  key: string;
  label: string;
  unit: string;
  upIsGood: boolean;
  category: KpiCategory;
  formatValue?: (v: number) => string;
}

export const INDICATOR_META: IndicatorMeta[] = [
  // Occupation
  { key: 'taux_occupation',    label: "Taux d'occupation",      unit: '%',   upIsGood: true,  category: 'occupation' },
  { key: 'duree_sejour_moy',   label: 'Durée moy. de séjour',   unit: ' j',  upIsGood: true,  category: 'occupation' },
  { key: 'lits_disponibles',   label: 'Lits disponibles',        unit: '',    upIsGood: true,  category: 'occupation' },
  // Finance
  { key: 'budget_realise',     label: 'Budget réalisé',          unit: ' k€', upIsGood: false, category: 'finance' },
  { key: 'cout_journalier',    label: 'Coût journalier',         unit: ' €',  upIsGood: false, category: 'finance' },
  { key: 'recettes_hebergement', label: 'Recettes hébergement',  unit: ' k€', upIsGood: true,  category: 'finance' },
  // RH
  { key: 'taux_absenteisme',   label: "Taux d'absentéisme",      unit: '%',   upIsGood: false, category: 'rh' },
  { key: 'ratio_soignants',    label: 'Ratio soignants/résidents', unit: '',  upIsGood: true,  category: 'rh' },
  { key: 'heures_sup',         label: 'Heures supplémentaires',  unit: ' h',  upIsGood: false, category: 'rh' },
  { key: 'turnover',           label: 'Turnover RH',             unit: '%',   upIsGood: false, category: 'rh' },
  // Qualité
  { key: 'evenements_indesirables', label: 'Événements indésirables', unit: '', upIsGood: false, category: 'qualite' },
  { key: 'taux_chutes',        label: 'Taux de chutes',          unit: '%',   upIsGood: false, category: 'qualite' },
  { key: 'satisfaction_familles', label: 'Satisfaction familles', unit: '/10', upIsGood: true, category: 'qualite' },
  { key: 'imc_moyen',          label: 'IMC moyen résidents',     unit: '',    upIsGood: true,  category: 'qualite' },
];

export const CATEGORY_LABELS: Record<KpiCategory, string> = {
  occupation: 'Occupation',
  finance:    'Finance',
  rh:         'RH',
  qualite:    'Qualité',
};

// ─── Mock data ────────────────────────────────────────────────────────────────

const MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

export const MOCK_ENTRIES: Record<string, KpiEntry[]> = (() => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const prevYear    = currentYear - 1;

  const make = (indicator: string, category: KpiCategory, values: number[]): KpiEntry[] =>
    values.map((value, i) => ({
      id: i,
      category,
      indicator,
      value,
      period: `${currentYear}-${String(i + 1).padStart(2, '0')}`,
      source: 'manual' as const,
      created_at: new Date(currentYear, i, 1).toISOString(),
    }));

  const makePrev = (indicator: string, category: KpiCategory, values: number[]): KpiEntry[] =>
    values.map((value, i) => ({
      id: 100 + i,
      category,
      indicator,
      value,
      period: `${prevYear}-${String(i + 1).padStart(2, '0')}`,
      source: 'manual' as const,
      created_at: new Date(prevYear, i, 1).toISOString(),
    }));

  return {
    taux_occupation:    [
      ...make('taux_occupation', 'occupation', [91,92,93,94,93,95,92,88,93,94,95,94]),
      ...makePrev('taux_occupation', 'occupation', [88,89,90,91,92,90,89,85,90,91,92,91]),
    ],
    duree_sejour_moy:   [
      ...make('duree_sejour_moy', 'occupation', [820,835,812,841,810,855,842,831,819,847,862,851]),
      ...makePrev('duree_sejour_moy', 'occupation', [790,810,805,820,815,830,825,810,810,830,845,835]),
    ],
    lits_disponibles:   [
      ...make('lits_disponibles', 'occupation', [78,78,79,79,80,80,79,77,79,80,80,80]),
      ...makePrev('lits_disponibles', 'occupation', [75,75,76,77,77,78,78,76,77,78,79,79]),
    ],
    budget_realise:     [
      ...make('budget_realise', 'finance', [155,162,160,168,172,169,171,173,178,182,183,185]),
      ...makePrev('budget_realise', 'finance', [148,152,155,158,162,160,163,165,170,175,178,180]),
    ],
    cout_journalier:    [
      ...make('cout_journalier', 'finance', [68,68,69,70,71,70,71,72,72,73,73,74]),
      ...makePrev('cout_journalier', 'finance', [65,65,66,67,67,68,68,69,69,70,70,71]),
    ],
    recettes_hebergement: [
      ...make('recettes_hebergement', 'finance', [142,145,148,151,152,154,153,155,158,162,163,165]),
      ...makePrev('recettes_hebergement', 'finance', [135,138,140,143,144,146,147,148,151,154,157,160]),
    ],
    taux_absenteisme:   [
      ...make('taux_absenteisme', 'rh', [7.2,6.8,7.5,8.1,7.9,6.5,7.0,8.3,7.1,6.9,7.3,7.2]),
      ...makePrev('taux_absenteisme', 'rh', [8.5,8.1,8.8,9.2,8.7,7.8,8.0,9.1,8.3,7.9,8.2,8.5]),
    ],
    ratio_soignants:    [
      ...make('ratio_soignants', 'rh', [0.62,0.61,0.63,0.64,0.63,0.65,0.62,0.60,0.63,0.64,0.65,0.64]),
      ...makePrev('ratio_soignants', 'rh', [0.59,0.58,0.60,0.61,0.60,0.62,0.60,0.58,0.60,0.61,0.62,0.62]),
    ],
    heures_sup:         [
      ...make('heures_sup', 'rh', [280,245,310,390,350,195,220,415,285,260,295,310]),
      ...makePrev('heures_sup', 'rh', [320,290,360,420,385,240,260,450,320,295,340,355]),
    ],
    turnover:           [
      ...make('turnover', 'rh', [15.2,15.2,15.5,16.1,15.8,14.9,15.0,15.8,15.3,14.8,15.1,15.2]),
      ...makePrev('turnover', 'rh', [17.5,17.2,17.8,18.2,17.9,17.0,17.2,18.0,17.5,17.1,17.4,17.5]),
    ],
    evenements_indesirables: [
      ...make('evenements_indesirables', 'qualite', [4,3,5,6,4,2,3,7,4,3,4,3]),
      ...makePrev('evenements_indesirables', 'qualite', [6,5,7,8,6,4,5,9,6,5,6,5]),
    ],
    taux_chutes:        [
      ...make('taux_chutes', 'qualite', [3.1,2.8,3.5,4.0,3.2,2.2,2.5,4.5,3.0,2.7,3.1,2.9]),
      ...makePrev('taux_chutes', 'qualite', [4.2,3.9,4.7,5.1,4.3,3.5,3.8,5.8,4.1,3.8,4.2,4.0]),
    ],
    satisfaction_familles: [
      ...make('satisfaction_familles', 'qualite', [8.2,8.3,8.1,8.0,8.4,8.5,8.3,8.1,8.4,8.5,8.6,8.5]),
      ...makePrev('satisfaction_familles', 'qualite', [7.8,7.9,7.7,7.8,8.0,8.1,8.0,7.8,8.0,8.1,8.2,8.2]),
    ],
    imc_moyen:          [
      ...make('imc_moyen', 'qualite', [22.1,22.0,22.2,22.3,22.1,22.0,21.9,22.1,22.2,22.3,22.2,22.1]),
      ...makePrev('imc_moyen', 'qualite', [21.8,21.7,21.9,22.0,21.8,21.7,21.6,21.8,21.9,22.0,21.9,21.8]),
    ],
  };
})();

export const MOCK_THRESHOLDS: KpiThreshold[] = [
  { id: 1,  indicator: 'taux_occupation',         warning:  85,  critical:  80,  direction: 'below' },
  { id: 2,  indicator: 'taux_absenteisme',         warning:   8,  critical:  12,  direction: 'above' },
  { id: 3,  indicator: 'evenements_indesirables',  warning:   4,  critical:   7,  direction: 'above' },
  { id: 4,  indicator: 'budget_realise',           warning: 180,  critical: 200,  direction: 'above' },
  { id: 5,  indicator: 'satisfaction_familles',    warning:   8,  critical:   7,  direction: 'below' },
  { id: 6,  indicator: 'taux_chutes',              warning:   4,  critical:   6,  direction: 'above' },
  { id: 7,  indicator: 'turnover',                 warning:  16,  critical:  20,  direction: 'above' },
];

// ─── Status helpers ───────────────────────────────────────────────────────────

export type KpiStatus = 'ok' | 'warning' | 'critical' | 'neutral';

export function computeStatus(value: number, threshold: KpiThreshold | undefined): KpiStatus {
  if (!threshold) return 'neutral';
  const { warning, critical, direction } = threshold;

  if (direction === 'above') {
    if (critical !== null && value >= critical) return 'critical';
    if (warning  !== null && value >= warning)  return 'warning';
    return 'ok';
  } else {
    if (critical !== null && value <= critical) return 'critical';
    if (warning  !== null && value <= warning)  return 'warning';
    return 'ok';
  }
}

// ─── Chart data builder ───────────────────────────────────────────────────────

export interface ChartPoint {
  month: string;
  current: number | null;
  previous: number | null;
}

export function buildChartData(entries: KpiEntry[]): ChartPoint[] {
  const now = new Date();
  const currentYear = now.getFullYear();
  const prevYear    = currentYear - 1;

  const currentYearEntries = entries
    .filter(e => e.period.startsWith(String(currentYear)))
    .sort((a, b) => a.period.localeCompare(b.period));

  const prevYearEntries = entries
    .filter(e => e.period.startsWith(String(prevYear)))
    .sort((a, b) => a.period.localeCompare(b.period));

  const months = MONTHS;
  return months.map((month, i) => {
    const monthStr = String(i + 1).padStart(2, '0');
    const cur  = currentYearEntries.find(e => e.period.endsWith(`-${monthStr}`));
    const prev = prevYearEntries.find(e => e.period.endsWith(`-${monthStr}`));
    return {
      month,
      current:  cur  ? cur.value  : null,
      previous: prev ? prev.value : null,
    };
  });
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface KpisData {
  entries:    KpiEntry[];
  thresholds: KpiThreshold[];
  loading:    boolean;
  error:      string | null;
  refresh:    () => void;
}

export function useKpisData(category: KpiCategory): KpisData {
  const [entries,    setEntries]    = useState<KpiEntry[]>([]);
  const [thresholds, setThresholds] = useState<KpiThreshold[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [rev,        setRev]        = useState(0);

  const refresh = useCallback(() => setRev(r => r + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    async function load() {
      try {
        const [dbEntries, dbThresholds] = await Promise.all([
          getKpiEntries(category).catch(() => [] as KpiEntry[]),
          getKpiThresholds().catch(() => [] as KpiThreshold[]),
        ]);

        if (cancelled) return;

        if (dbEntries.length > 0) {
          setEntries(dbEntries);
        } else {
          // Fall back to mock data for the current category
          const indicators = INDICATOR_META
            .filter(m => m.category === category)
            .map(m => m.key);
          const mockForCategory = indicators.flatMap(k => MOCK_ENTRIES[k] ?? []);
          setEntries(mockForCategory);
        }

        setThresholds(dbThresholds.length > 0 ? dbThresholds : MOCK_THRESHOLDS);
      } catch (err) {
        if (!cancelled) setError(String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [category, rev]);

  return { entries, thresholds, loading, error, refresh };
}
