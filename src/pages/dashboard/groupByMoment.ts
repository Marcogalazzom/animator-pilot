// Partitionne les events du jour en moments (ce matin / midi / cet après-midi /
// en fin de journée), et dérive pour chaque event son état par rapport à
// l'heure courante : terminé / en cours / à venir.
//
// Module pur — testable sans DOM, sans React.

import type { CalendarEvent } from '../calendar/useCalendarEvents';

export type Moment = 'matin' | 'midi' | 'apres-midi' | 'fin-journee';
export type EventState = 'done' | 'now' | 'next';

export interface MomentGroup {
  moment: Moment;
  label: string;      // "Ce matin", "Ce midi", ...
  items: MomentItem[];
}

export interface MomentItem {
  event: CalendarEvent;
  state: EventState;
  startMin: number | null;
  endMin: number | null;
}

// Durée par défaut si time_end n'est pas renseigné. Aligne avec l'heuristique
// historique de Dashboard (active si <= 60min après le start).
const DEFAULT_DURATION_MIN = 60;

const MOMENT_LABELS: Record<Moment, string> = {
  'matin':        'Ce matin',
  'midi':         'Ce midi',
  'apres-midi':   'Cet après-midi',
  'fin-journee':  'En fin de journée',
};

const MOMENT_ORDER: Moment[] = ['matin', 'midi', 'apres-midi', 'fin-journee'];

export function timeToMin(t: string | null): number | null {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

export function momentOf(startMin: number | null): Moment {
  // Pas d'heure → on range dans "matin" pour que l'event reste visible
  // en haut de la journée (évite qu'il disparaisse en bas).
  if (startMin === null) return 'matin';
  if (startMin < 12 * 60) return 'matin';
  if (startMin < 14 * 60) return 'midi';
  if (startMin < 18 * 60) return 'apres-midi';
  return 'fin-journee';
}

export function deriveState(
  startMin: number | null,
  endMin: number | null,
  nowMin: number,
): EventState {
  // Sans heure de début on ne peut pas trancher — on traite comme "à venir"
  // (plus sûr que de marquer done).
  if (startMin === null) return 'next';
  const effectiveEnd = endMin ?? startMin + DEFAULT_DURATION_MIN;
  if (nowMin < startMin) return 'next';
  if (nowMin > effectiveEnd) return 'done';
  return 'now';
}

export function nowMinutes(now: Date): number {
  return now.getHours() * 60 + now.getMinutes();
}

export function groupEventsByMoment(
  events: CalendarEvent[],
  now: Date,
): MomentGroup[] {
  const cur = nowMinutes(now);
  const buckets: Record<Moment, MomentItem[]> = {
    'matin': [],
    'midi': [],
    'apres-midi': [],
    'fin-journee': [],
  };

  for (const event of events) {
    const startMin = timeToMin(event.time);
    const endMin = timeToMin(event.timeEnd);
    const state = deriveState(startMin, endMin, cur);
    buckets[momentOf(startMin)].push({ event, state, startMin, endMin });
  }

  return MOMENT_ORDER
    .filter((m) => buckets[m].length > 0)
    .map((moment) => ({
      moment,
      label: MOMENT_LABELS[moment],
      items: buckets[moment],
    }));
}

// True si tous les events du jour sont en état "done" (mode bilan).
export function allDone(groups: MomentGroup[]): boolean {
  if (groups.length === 0) return false;
  return groups.every((g) => g.items.every((it) => it.state === 'done'));
}

// Heures formatées "HHhMM" (ou "HHh" si pile), utilisé pour "terminé à 10h30".
export function formatHourFr(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`;
}
