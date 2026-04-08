import { useState, useEffect } from 'react';
import { getKpiEntries, getKpiThresholds, getProjects } from '@/db';
import type { KpiEntry, KpiThreshold, Project } from '@/db/types';

// ─── Mock data (realistic French EHPAD values) ───────────────────────────────

export const MOCK_KPIS = {
  taux_occupation:       { current: 94.2, previous: 92.8 },
  budget_realise:        { current: 185,  previous: 178  },
  taux_absenteisme:      { current: 7.2,  previous: 6.8  },
  evenements_indesirables: { current: 3,  previous: 5    },
};

export const MOCK_OCCUPATION_MONTHS = [
  { month: 'Jan', value: 91 },
  { month: 'Fév', value: 92 },
  { month: 'Mar', value: 93 },
  { month: 'Avr', value: 94 },
  { month: 'Mai', value: 93 },
  { month: 'Jun', value: 95 },
  { month: 'Jul', value: 92 },
  { month: 'Aoû', value: 88 },
  { month: 'Sep', value: 93 },
  { month: 'Oct', value: 94 },
  { month: 'Nov', value: 95 },
  { month: 'Déc', value: 94 },
];

export const MOCK_BUDGET_MONTHS = [
  { month: 'Jan', prevu: 160, realise: 155 },
  { month: 'Fév', prevu: 160, realise: 162 },
  { month: 'Mar', prevu: 165, realise: 160 },
  { month: 'Avr', prevu: 165, realise: 168 },
  { month: 'Mai', prevu: 170, realise: 172 },
  { month: 'Jun', prevu: 170, realise: 169 },
  { month: 'Jul', prevu: 175, realise: 171 },
  { month: 'Aoû', prevu: 175, realise: 173 },
  { month: 'Sep', prevu: 180, realise: 178 },
  { month: 'Oct', prevu: 180, realise: 182 },
  { month: 'Nov', prevu: 185, realise: 183 },
  { month: 'Déc', prevu: 185, realise: 185 },
];

export const MOCK_OVERDUE_PROJECTS: Project[] = [
  {
    id: 1,
    title: 'Mise à jour protocole hygiène',
    description: '',
    owner_role: 'Infirmier coordinateur',
    status: 'overdue',
    start_date: '2025-11-01',
    due_date: '2025-12-31',
    created_at: '2025-11-01',
  },
  {
    id: 2,
    title: 'Formation gestes barrières',
    description: '',
    owner_role: 'Directeur RH',
    status: 'overdue',
    start_date: '2025-10-01',
    due_date: '2025-12-15',
    created_at: '2025-10-01',
  },
];

// ─── Types ────────────────────────────────────────────────────────────────────

export interface KpiValues {
  taux_occupation:        { current: number; previous: number };
  budget_realise:         { current: number; previous: number };
  taux_absenteisme:       { current: number; previous: number };
  evenements_indesirables:{ current: number; previous: number };
}

export interface OccupationMonth { month: string; value: number }
export interface BudgetMonth     { month: string; prevu: number; realise: number }

export interface DashboardData {
  kpis:             KpiValues;
  occupationMonths: OccupationMonth[];
  budgetMonths:     BudgetMonth[];
  overdueProjects:  Project[];
  thresholds:       KpiThreshold[];
  loading:          boolean;
  error:            string | null;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useDashboardData(): DashboardData {
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [kpis,     setKpis]     = useState<KpiValues>(MOCK_KPIS);
  const [occupationMonths, setOccupationMonths] = useState<OccupationMonth[]>(MOCK_OCCUPATION_MONTHS);
  // Budget months are always mock for now (no per-month DB query yet)
  const [budgetMonths] = useState<BudgetMonth[]>(MOCK_BUDGET_MONTHS);
  const [overdueProjects,  setOverdueProjects]  = useState<Project[]>(MOCK_OVERDUE_PROJECTS);
  const [thresholds,       setThresholds]       = useState<KpiThreshold[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        // Try to load from DB; fall back gracefully to mock data if empty/error
        const [dbEntries, dbThresholds, dbProjects] = await Promise.all([
          getKpiEntries().catch(() => [] as KpiEntry[]),
          getKpiThresholds().catch(() => [] as KpiThreshold[]),
          getProjects('overdue').catch(() => [] as Project[]),
        ]);

        if (cancelled) return;

        // Only replace mock KPIs if DB has real data
        if (dbEntries.length > 0) {
          // Group by indicator and use the latest period
          const byIndicator = new Map<string, KpiEntry[]>();
          for (const e of dbEntries) {
            const list = byIndicator.get(e.indicator) ?? [];
            list.push(e);
            byIndicator.set(e.indicator, list);
          }

          const pick = (indicator: string): number => {
            const entries = (byIndicator.get(indicator) ?? [])
              .sort((a, b) => b.period.localeCompare(a.period));
            return entries[0]?.value ?? 0;
          };
          const pickPrev = (indicator: string): number => {
            const entries = (byIndicator.get(indicator) ?? [])
              .sort((a, b) => b.period.localeCompare(a.period));
            return entries[1]?.value ?? entries[0]?.value ?? 0;
          };

          setKpis({
            taux_occupation:        { current: pick('taux_occupation'),        previous: pickPrev('taux_occupation') },
            budget_realise:         { current: pick('budget_realise'),         previous: pickPrev('budget_realise') },
            taux_absenteisme:       { current: pick('taux_absenteisme'),       previous: pickPrev('taux_absenteisme') },
            evenements_indesirables:{ current: pick('evenements_indesirables'),previous: pickPrev('evenements_indesirables') },
          });

          // Build occupation chart series from DB if available
          const occupEntries = dbEntries
            .filter(e => e.indicator === 'taux_occupation')
            .sort((a, b) => a.period.localeCompare(b.period))
            .slice(-12);
          if (occupEntries.length > 0) {
            setOccupationMonths(
              occupEntries.map(e => ({
                month: new Date(e.period + '-01').toLocaleDateString('fr-FR', { month: 'short' }),
                value: e.value,
              }))
            );
          }
        }

        if (dbThresholds.length > 0) setThresholds(dbThresholds);
        if (dbProjects.length > 0)   setOverdueProjects(dbProjects);

      } catch (err) {
        if (!cancelled) setError(String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return {
    kpis,
    occupationMonths,
    budgetMonths,
    overdueProjects,
    thresholds,
    loading,
    error,
  };
}
