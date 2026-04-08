import { useState, useEffect } from 'react';
import { getProjects, getObligations, getTrainings } from '@/db';
import { getEvents } from '@/db/tutelles';
import type { Project, ComplianceObligation, AuthorityEvent, TrainingTracking } from '@/db/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export type CalendarModule = 'projects' | 'compliance' | 'tutelles' | 'training';

export interface CalendarEvent {
  id: string;
  title: string;
  date: string; // ISO date string YYYY-MM-DD
  module: CalendarModule;
  link_path: string;
  status?: string;
  rawDate: Date;
}

// ─── Mock data ─────────────────────────────────────────────────────────────────

const today = new Date();
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const toISO = (d: Date) => d.toISOString().slice(0, 10);

export const MOCK_CALENDAR_EVENTS: CalendarEvent[] = [
  {
    id: 'p-1',
    title: 'Mise à jour protocole hygiène',
    date: toISO(addDays(today, -5)),
    module: 'projects',
    link_path: '/projects',
    status: 'overdue',
    rawDate: addDays(today, -5),
  },
  {
    id: 'c-1',
    title: 'Renouvellement document incendie',
    date: toISO(addDays(today, 7)),
    module: 'compliance',
    link_path: '/compliance',
    status: 'in_progress',
    rawDate: addDays(today, 7),
  },
  {
    id: 't-1',
    title: 'Visite HAS — Évaluation externe',
    date: toISO(addDays(today, 12)),
    module: 'tutelles',
    link_path: '/tutelles',
    status: 'planned',
    rawDate: addDays(today, 12),
  },
  {
    id: 'p-2',
    title: 'Formation gestes barrières',
    date: toISO(addDays(today, 18)),
    module: 'projects',
    link_path: '/projects',
    status: 'in_progress',
    rawDate: addDays(today, 18),
  },
  {
    id: 'c-2',
    title: 'Rapport d\'activité trimestriel',
    date: toISO(addDays(today, 22)),
    module: 'compliance',
    link_path: '/compliance',
    status: 'to_plan',
    rawDate: addDays(today, 22),
  },
  {
    id: 't-2',
    title: 'Dialogue de gestion ARS',
    date: toISO(addDays(today, 28)),
    module: 'tutelles',
    link_path: '/tutelles',
    status: 'planned',
    rawDate: addDays(today, 28),
  },
  {
    id: 'tr-1',
    title: 'Formation soins palliatifs',
    date: `${today.getFullYear()}-12-31`,
    module: 'training',
    link_path: '/veille',
    rawDate: new Date(today.getFullYear(), 11, 31),
  },
  {
    id: 'p-3',
    title: 'Plan de continuité d\'activité',
    date: toISO(addDays(today, 45)),
    module: 'projects',
    link_path: '/projects',
    status: 'todo',
    rawDate: addDays(today, 45),
  },
  {
    id: 'c-3',
    title: 'Évaluation risque professionnel',
    date: toISO(addDays(today, 60)),
    module: 'compliance',
    link_path: '/compliance',
    status: 'non_compliant',
    rawDate: addDays(today, 60),
  },
];

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface CalendarData {
  events: CalendarEvent[];
  loading: boolean;
  error: string | null;
}

function parseDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

function isoFromDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function useCalendarData(): CalendarData {
  const [events, setEvents]   = useState<CalendarEvent[]>(MOCK_CALENDAR_EVENTS);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [dbProjects, dbObligations, dbEvents, dbTrainings] = await Promise.all([
          getProjects().catch(() => [] as Project[]),
          getObligations().catch(() => [] as ComplianceObligation[]),
          getEvents().catch(() => [] as AuthorityEvent[]),
          getTrainings().catch(() => [] as TrainingTracking[]),
        ]);

        if (cancelled) return;

        const result: CalendarEvent[] = [];

        // Projects: due_date where status != 'done'
        for (const p of dbProjects) {
          if (p.status === 'done') continue;
          const d = parseDate(p.due_date);
          if (!d) continue;
          result.push({
            id: `p-${p.id}`,
            title: p.title,
            date: isoFromDate(d),
            module: 'projects',
            link_path: '/projects',
            status: p.status,
            rawDate: d,
          });
        }

        // Compliance: next_due_date where status != 'compliant'
        for (const o of dbObligations) {
          if (o.status === 'compliant') continue;
          const d = parseDate(o.next_due_date);
          if (!d) continue;
          result.push({
            id: `c-${o.id}`,
            title: o.title,
            date: isoFromDate(d),
            module: 'compliance',
            link_path: '/compliance',
            status: o.status,
            rawDate: d,
          });
        }

        // Tutelles: date_start where status != 'completed' && != 'cancelled'
        for (const e of dbEvents) {
          if (e.status === 'completed' || e.status === 'cancelled') continue;
          const d = parseDate(e.date_start);
          if (!d) continue;
          result.push({
            id: `t-${e.id}`,
            title: e.title,
            date: isoFromDate(d),
            module: 'tutelles',
            link_path: '/tutelles',
            status: e.status,
            rawDate: d,
          });
        }

        // Training: approximate end date = Dec 31 of fiscal_year
        for (const tr of dbTrainings) {
          const d = new Date(tr.fiscal_year, 11, 31); // Dec 31
          result.push({
            id: `tr-${tr.id}`,
            title: tr.title,
            date: isoFromDate(d),
            module: 'training',
            link_path: '/veille',
            rawDate: d,
          });
        }

        // Sort by date ASC
        result.sort((a, b) => a.rawDate.getTime() - b.rawDate.getTime());

        if (result.length > 0) {
          setEvents(result);
        }
        // else keep mock data
      } catch (err) {
        if (!cancelled) setError(String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return { events, loading, error };
}
