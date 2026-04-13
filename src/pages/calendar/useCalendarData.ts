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
  const [events, setEvents]   = useState<CalendarEvent[]>([]);
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

        setEvents(result);
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
