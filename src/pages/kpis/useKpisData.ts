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

const MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

export const DEFAULT_THRESHOLDS: KpiThreshold[] = [
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

        setEntries(dbEntries);
        setThresholds(dbThresholds.length > 0 ? dbThresholds : DEFAULT_THRESHOLDS);
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
