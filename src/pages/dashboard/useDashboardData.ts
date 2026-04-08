import { useState, useEffect } from 'react';
import { getKpiEntries, getKpiThresholds, getProjects, getObligationStats, getUnreadAlertCount } from '@/db';
import { getUpcomingEvents } from '@/db/tutelles';
import { getOverdueActions } from '@/db/projects';
import { getUpcomingDeadlines } from '@/db/search';
import type { KpiEntry, KpiThreshold, Project } from '@/db/types';
import type { UpcomingEventWithPrep } from '@/db/tutelles';
import type { OverdueAction } from '@/db/projects';
import type { UpcomingDeadline } from '@/db/search';

// ─── Mock data (realistic French EHPAD values) ───────────────────────────────

export const MOCK_KPIS = {
  taux_occupation:       { current: 94.2, previous: 92.8 },
  budget_realise:        { current: 185,  previous: 178  },
  taux_absenteisme:      { current: 7.2,  previous: 6.8  },
  evenements_indesirables: { current: 3,  previous: 5    },
};

// Generate last 12 months labels relative to current month
function getLast12Months(): { label: string; period: string }[] {
  const MONTH_SHORT = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
  const now = new Date();
  const result: { label: string; period: string }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const m = d.getMonth();
    const y = d.getFullYear();
    result.push({
      label: `${MONTH_SHORT[m]} ${y % 100}`,
      period: `${y}-${String(m + 1).padStart(2, '0')}`,
    });
  }
  return result;
}

const LAST_12 = getLast12Months();

// Mock occupation values for the last 12 months
const OCCUP_VALUES = [91, 92, 93, 94, 93, 95, 92, 88, 93, 94, 95, 94];
export const MOCK_OCCUPATION_MONTHS = LAST_12.map((m, i) => ({
  month: m.label,
  period: m.period,
  value: OCCUP_VALUES[i],
}));

// Mock budget values for the last 12 months
const BUDGET_BASE = [155, 162, 160, 168, 172, 169, 171, 173, 178, 182, 183, 185];
const BUDGET_PREVU = [160, 160, 165, 165, 170, 170, 175, 175, 180, 180, 185, 185];
export const MOCK_BUDGET_MONTHS = LAST_12.map((m, i) => ({
  month: m.label,
  period: m.period,
  prevu: BUDGET_PREVU[i],
  realise: BUDGET_BASE[i],
}));

export const MOCK_COMPLIANCE_STATS = {
  total: 24,
  compliant: 18,
  overdue: 3,
  upcoming30: 3,
};

export const MOCK_UPCOMING_EVENTS: UpcomingEventWithPrep[] = [
  {
    id: 1,
    title: 'Visite HAS — Évaluation externe',
    event_type: 'evaluation',
    authority: 'has',
    date_start: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    date_end: null,
    status: 'planned',
    notes: '',
    is_recurring: 0,
    recurrence_rule: null,
    created_at: '',
    total_items: 8,
    done_items: 5,
  },
  {
    id: 2,
    title: 'Dialogue de gestion ARS',
    event_type: 'dialogue',
    authority: 'ars',
    date_start: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    date_end: null,
    status: 'planned',
    notes: '',
    is_recurring: 0,
    recurrence_rule: null,
    created_at: '',
    total_items: 4,
    done_items: 1,
  },
];

export const MOCK_UPCOMING_DEADLINES: UpcomingDeadline[] = [
  { title: 'Mise à jour procédure incendie', date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), module: 'compliance', link_path: '/compliance' },
  { title: 'Visite HAS — Évaluation externe', date: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), module: 'tutelles', link_path: '/tutelles' },
  { title: 'Formation gestes barrières', date: new Date(Date.now() + 18 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), module: 'projects', link_path: '/projects' },
  { title: 'Rapport d\'activité trimestriel', date: new Date(Date.now() + 22 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), module: 'compliance', link_path: '/compliance' },
  { title: 'Dialogue de gestion ARS', date: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), module: 'tutelles', link_path: '/tutelles' },
];

export const MOCK_OVERDUE_ACTIONS: OverdueAction[] = [
  { id: 1, project_id: 1, title: 'Mettre à jour le protocole de change', progress: 40, due_date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), status: 'in_progress', created_at: '', project_title: 'Mise à jour protocole hygiène' },
  { id: 2, project_id: 2, title: 'Planifier sessions de formation', progress: 0, due_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), status: 'todo', created_at: '', project_title: 'Formation gestes barrières' },
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

export interface OccupationMonth { month: string; period?: string; value: number }
export interface BudgetMonth     { month: string; period?: string; prevu: number; realise: number }

export interface ComplianceStats {
  total: number;
  compliant: number;
  overdue: number;
  upcoming30: number;
}

export interface DashboardData {
  kpis:              KpiValues;
  occupationMonths:  OccupationMonth[];
  budgetMonths:      BudgetMonth[];
  overdueProjects:   Project[];
  thresholds:        KpiThreshold[];
  complianceStats:   ComplianceStats;
  upcomingEvents:    UpcomingEventWithPrep[];
  upcomingDeadlines: UpcomingDeadline[];
  overdueActions:    OverdueAction[];
  unreadAlertCount:  number;
  loading:           boolean;
  error:             string | null;
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
  const [complianceStats,  setComplianceStats]  = useState<ComplianceStats>(MOCK_COMPLIANCE_STATS);
  const [upcomingEvents,   setUpcomingEvents]   = useState<UpcomingEventWithPrep[]>(MOCK_UPCOMING_EVENTS);
  const [upcomingDeadlines, setUpcomingDeadlines] = useState<UpcomingDeadline[]>(MOCK_UPCOMING_DEADLINES);
  const [overdueActions,   setOverdueActions]   = useState<OverdueAction[]>(MOCK_OVERDUE_ACTIONS);
  const [unreadAlertCount, setUnreadAlertCount] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        // Try to load from DB; fall back gracefully to mock data if empty/error
        const [dbEntries, dbThresholds, dbProjects, dbComplianceStats, dbUpcomingEvents, dbDeadlines, dbActions, dbAlertCount] = await Promise.all([
          getKpiEntries().catch(() => [] as KpiEntry[]),
          getKpiThresholds().catch(() => [] as KpiThreshold[]),
          getProjects('overdue').catch(() => [] as Project[]),
          getObligationStats().catch(() => MOCK_COMPLIANCE_STATS),
          getUpcomingEvents(60).catch(() => [] as UpcomingEventWithPrep[]),
          getUpcomingDeadlines(10).catch(() => [] as UpcomingDeadline[]),
          getOverdueActions(10).catch(() => [] as OverdueAction[]),
          getUnreadAlertCount().catch(() => 0),
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
              occupEntries.map(e => {
                const d = new Date(e.period + '-01');
                const monthStr = d.toLocaleDateString('fr-FR', { month: 'short' });
                const yearStr = String(d.getFullYear() % 100);
                return { month: `${monthStr} ${yearStr}`, period: e.period, value: e.value };
              })
            );
          }
        }

        if (dbThresholds.length > 0) setThresholds(dbThresholds);
        if (dbProjects.length > 0)   setOverdueProjects(dbProjects);

        // New module data — always update from DB (not gated on length)
        setComplianceStats(dbComplianceStats);
        if (dbUpcomingEvents.length > 0) setUpcomingEvents(dbUpcomingEvents);
        if (dbDeadlines.length > 0)      setUpcomingDeadlines(dbDeadlines);
        if (dbActions.length > 0)        setOverdueActions(dbActions);
        setUnreadAlertCount(dbAlertCount);

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
    complianceStats,
    upcomingEvents,
    upcomingDeadlines,
    overdueActions,
    unreadAlertCount,
    loading,
    error,
  };
}
