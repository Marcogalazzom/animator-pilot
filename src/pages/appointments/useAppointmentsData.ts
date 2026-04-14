import { useState, useEffect, useCallback } from 'react';
import { getUpcomingPlanned, getPast } from '@/db/appointments';
import { ensureCategoryColors, type CategoryColor } from '@/db/categoryColors';
import { mondayOf, addDays } from '@/utils/dateUtils';
import type { Appointment } from '@/db/types';

export type { Appointment };

export type UpcomingBucket = "Aujourd'hui" | 'Demain' | 'Cette semaine' | 'La semaine prochaine' | 'Plus tard';
const BUCKET_ORDER: UpcomingBucket[] = ["Aujourd'hui", 'Demain', 'Cette semaine', 'La semaine prochaine', 'Plus tard'];

export function bucketize(items: Appointment[], today: string): Record<UpcomingBucket, Appointment[]> {
  const result: Record<UpcomingBucket, Appointment[]> = {
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
  toConfirm: Appointment[];
  completed: Appointment[];
  cancelled: Appointment[];
}

export function splitPast(items: Appointment[], today: string): PastSections {
  const toConfirm: Appointment[] = [];
  const completed: Appointment[] = [];
  const cancelled: Appointment[] = [];
  for (const a of items) {
    if (a.status === 'cancelled') cancelled.push(a);
    else if (a.status === 'completed') completed.push(a);
    else if (a.date < today) toConfirm.push(a);
  }
  toConfirm.sort((a, b) => b.date.localeCompare(a.date));
  return { toConfirm, completed, cancelled };
}

export const BUCKETS = BUCKET_ORDER;

// Types par défaut suggérés — seront auto-complétés par ensureCategoryColors
const DEFAULT_TYPES = ['meeting', 'supplier', 'training', 'interview', 'other'];
const TYPE_LABELS: Record<string, string> = {
  meeting: 'Réunion',
  supplier: 'Fournisseur',
  training: 'Formation',
  interview: 'Entretien',
  other: 'Autre',
};

export function appointmentTypeLabel(name: string): string {
  return TYPE_LABELS[name] ?? name;
}

export interface AppointmentsData {
  upcoming: Appointment[];
  past: Appointment[];
  types: CategoryColor[];
  loading: boolean;
  refresh: () => Promise<void>;
}

export function useAppointmentsData(): AppointmentsData {
  const [upcoming, setUpcoming] = useState<Appointment[]>([]);
  const [past, setPast] = useState<Appointment[]>([]);
  const [types, setTypes] = useState<CategoryColor[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [u, p] = await Promise.all([getUpcomingPlanned(), getPast()]);
      setUpcoming(u); setPast(p);
      const allTypes = [...DEFAULT_TYPES, ...u.map((a) => a.appointment_type), ...p.map((a) => a.appointment_type)];
      const cats = await ensureCategoryColors('appointments', allTypes);
      // Override labels pour les types par défaut
      const withLabels = cats.map((c) =>
        c.label ? c : { ...c, label: TYPE_LABELS[c.name] ?? null }
      );
      setTypes(withLabels);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { upcoming, past, types, loading, refresh };
}
