import { useState, useEffect } from 'react';
import { getProjects } from '@/db';
import { getActivities } from '@/db/activities';
import type { Project, Activity } from '@/db/types';

// ─── Types ────────────────────────────────────────────────────

export type CalendarModule = 'projects' | 'activities';

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  module: CalendarModule;
  link_path: string;
  status?: string;
  rawDate: Date;
}

// ─── Mock data ─────────────────────────────────────────────────

const today = new Date();
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const toISO = (d: Date) => d.toISOString().slice(0, 10);

export const MOCK_CALENDAR_EVENTS: CalendarEvent[] = [
  { id: 'a-1', title: 'Atelier peinture aquarelle', date: toISO(addDays(today, 1)), module: 'activities', link_path: '/activities', status: 'planned', rawDate: addDays(today, 1) },
  { id: 'a-2', title: 'Loto musical', date: toISO(addDays(today, 2)), module: 'activities', link_path: '/activities', status: 'planned', rawDate: addDays(today, 2) },
  { id: 'a-3', title: 'Gym douce', date: toISO(addDays(today, 3)), module: 'activities', link_path: '/activities', status: 'planned', rawDate: addDays(today, 3) },
  { id: 'p-1', title: 'Programme animations été 2026', date: toISO(addDays(today, -5)), module: 'projects', link_path: '/projects', status: 'overdue', rawDate: addDays(today, -5) },
  { id: 'a-4', title: 'Concert chorale école primaire', date: toISO(addDays(today, 7)), module: 'activities', link_path: '/activities', status: 'planned', rawDate: addDays(today, 7) },
  { id: 'a-5', title: 'Fête des anniversaires — Avril', date: toISO(addDays(today, 10)), module: 'activities', link_path: '/activities', status: 'planned', rawDate: addDays(today, 10) },
  { id: 'p-2', title: 'Projet jardin thérapeutique', date: toISO(addDays(today, 30)), module: 'projects', link_path: '/projects', status: 'in_progress', rawDate: addDays(today, 30) },
  { id: 'a-6', title: 'Atelier mémoire — Jeux de société', date: toISO(addDays(today, 14)), module: 'activities', link_path: '/activities', status: 'planned', rawDate: addDays(today, 14) },
  { id: 'a-7', title: 'Sortie Jardin Botanique', date: toISO(addDays(today, 21)), module: 'activities', link_path: '/activities', status: 'planned', rawDate: addDays(today, 21) },
];

// ─── Hook ─────────────────────────────────────────────────────

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
        const [dbProjects, dbActivities] = await Promise.all([
          getProjects().catch(() => [] as Project[]),
          getActivities().catch(() => [] as Activity[]),
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

        // Activities: date where status != 'cancelled'
        for (const a of dbActivities) {
          if (a.status === 'cancelled') continue;
          const d = parseDate(a.date);
          if (!d) continue;
          result.push({
            id: `a-${a.id}`,
            title: a.title,
            date: isoFromDate(d),
            module: 'activities',
            link_path: '/activities',
            status: a.status,
            rawDate: d,
          });
        }

        result.sort((a, b) => a.rawDate.getTime() - b.rawDate.getTime());

        if (result.length > 0) {
          setEvents(result);
        }
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
