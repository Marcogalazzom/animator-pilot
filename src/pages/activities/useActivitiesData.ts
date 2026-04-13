import { useState, useEffect, useCallback } from 'react';
import { getUpcomingPlanned, getPast, getTemplates } from '@/db/activities';
import { ensureCategoryColors, type CategoryColor } from '@/db/categoryColors';
import { mondayOf, addDays } from '@/utils/dateUtils';
import type { Activity } from '@/db/types';

export type { Activity };

export type UpcomingBucket = "Aujourd'hui" | 'Demain' | 'Cette semaine' | 'La semaine prochaine' | 'Plus tard';
const BUCKET_ORDER: UpcomingBucket[] = ["Aujourd'hui", 'Demain', 'Cette semaine', 'La semaine prochaine', 'Plus tard'];

export function bucketize(items: Activity[], today: string): Record<UpcomingBucket, Activity[]> {
  const result: Record<UpcomingBucket, Activity[]> = {
    "Aujourd'hui": [], 'Demain': [], 'Cette semaine': [], 'La semaine prochaine': [], 'Plus tard': [],
  };
  const tomorrow = addDays(today, 1);
  const sundayThisWeek = addDays(mondayOf(today), 6);
  const sundayNextWeek = addDays(sundayThisWeek, 7);
  for (const a of items) {
    if (a.date === today) result["Aujourd'hui"].push(a);
    else if (a.date === tomorrow) result['Demain'].push(a);
    else if (a.date <= sundayThisWeek) result['Cette semaine'].push(a);
    else if (a.date <= sundayNextWeek) result['La semaine prochaine'].push(a);
    else result['Plus tard'].push(a);
  }
  return result;
}

export interface PastSections {
  toConfirm: Activity[];
  completed: Activity[];
  cancelled: Activity[];
}

export function splitPast(items: Activity[], today: string): PastSections {
  const toConfirm: Activity[] = [];
  const completed: Activity[] = [];
  const cancelled: Activity[] = [];
  for (const a of items) {
    if (a.status === 'cancelled') cancelled.push(a);
    else if (a.status === 'completed') completed.push(a);
    else if (a.date < today) toConfirm.push(a);
  }
  toConfirm.sort((a, b) => b.date.localeCompare(a.date));
  return { toConfirm, completed, cancelled };
}

export const BUCKETS = BUCKET_ORDER;

export interface ActivitiesData {
  upcoming: Activity[];
  past: Activity[];
  templates: Activity[];
  types: CategoryColor[];
  loading: boolean;
  refresh: () => Promise<void>;
}

export function useActivitiesData(): ActivitiesData {
  const [upcoming, setUpcoming] = useState<Activity[]>([]);
  const [past, setPast] = useState<Activity[]>([]);
  const [templates, setTemplates] = useState<Activity[]>([]);
  const [types, setTypes] = useState<CategoryColor[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [u, p, t] = await Promise.all([getUpcomingPlanned(), getPast(), getTemplates()]);
      setUpcoming(u); setPast(p); setTemplates(t);
      const allTypes = [...u, ...p, ...t].map((a) => a.activity_type);
      const cats = await ensureCategoryColors('activities', allTypes);
      setTypes(cats);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { upcoming, past, templates, types, loading, refresh };
}
