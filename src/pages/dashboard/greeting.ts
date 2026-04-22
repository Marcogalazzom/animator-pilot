// Logique pure du texte du bonjour : hello selon l'heure, phrase de contexte
// selon la journée, phrase météo si remarquable, coda italique, mode bilan
// en fin de journée.
//
// Aucun appel React / DOM ici — composable et testable.

import type { CalendarEvent } from '../calendar/useCalendarEvents';
import { REMARKABLE_PHRASES, type WeatherInfo } from '@/utils/weather';
import { timeToMin, deriveState, nowMinutes } from './groupByMoment';

export interface GreetingContent {
  hello: string;              // "Bonjour", "Bon après-midi", ...
  contextLine: string;        // phrase explicative principale
  weatherPhrase: string | null;  // insérée après contextLine si remarquable
  coda: string;               // ligne italique de clôture
  mode: 'day' | 'bilan';
}

export interface GreetingInput {
  now: Date;
  firstName: string;          // "" si pas de prénom (skippé dans le hello)
  events: CalendarEvent[];    // events du jour uniquement (triés par time)
  todayBirthdayNames: string[];  // noms des résidents dont c'est l'anniv
  weather: WeatherInfo | null;   // null si fetch raté ou pas encore arrivé
}

// ───── Pools de phrases ─────

const HELLO_MORNING   = ['Bonjour', 'Bon matin'];
const HELLO_NOON      = ['Bonjour'];
const HELLO_AFTERNOON = ['Bon après-midi'];
const HELLO_EVENING   = ['Bonsoir'];

const CODA_MORNING   = ['Belle journée à toi.', 'Bonne journée.', 'Prends soin de toi.'];
const CODA_AFTERNOON = ['Bel après-midi.', 'Continue comme ça.', 'Belle fin de journée.'];
const CODA_EVENING   = ['Bonne fin de journée.', 'Douce soirée.'];

const CALM_DAY = 'Journée calme — l’occasion de rattraper les transmissions.';

// ───── Helpers internes ─────

// Hash stable ultra-simple — assez pour choisir un index dans un petit pool
// sans flickering intra-journée.
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function pickStable<T>(pool: T[], seed: string): T {
  if (pool.length === 0) throw new Error('pickStable called with empty pool');
  return pool[hash(seed) % pool.length];
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function hourBucket(d: Date): 'morning' | 'noon' | 'afternoon' | 'evening' {
  const h = d.getHours();
  if (h >= 5 && h < 11) return 'morning';
  if (h >= 11 && h < 14) return 'noon';
  if (h >= 14 && h < 18) return 'afternoon';
  return 'evening'; // 18h-5h (nuit incluse)
}

// Phrase naturelle listant jusqu'à 3 titres : "A, B et C" ou "A et B" ou "A".
function joinTitlesFr(titles: string[]): string {
  if (titles.length === 0) return '';
  if (titles.length === 1) return titles[0];
  if (titles.length === 2) return `${titles[0]} et ${titles[1]}`;
  return `${titles.slice(0, -1).join(', ')} et ${titles[titles.length - 1]}`;
}

function birthdaysClause(names: string[]): string {
  if (names.length === 0) return '';
  if (names.length === 1) return `c’est l’anniversaire de ${names[0]}`;
  if (names.length === 2) return `c’est l’anniversaire de ${names[0]} et ${names[1]}`;
  return `c’est l’anniversaire de ${names[0]}, ${names[1]} et ${names[2]}`;
}

// ───── Bilan ─────

function allEventsDone(events: CalendarEvent[], now: Date): boolean {
  if (events.length === 0) return false;
  const cur = nowMinutes(now);
  return events.every((e) => {
    const start = timeToMin(e.time);
    const end = timeToMin(e.timeEnd);
    return deriveState(start, end, cur) === 'done';
  });
}

function buildBilanLine(events: CalendarEvent[], birthdays: string[], now: Date): string {
  const count = events.length;
  const ledWord = count <= 1 ? 'menée' : 'menées';
  const fêtéeClause =
    birthdays.length === 0 ? ''
      : birthdays.length === 1 ? `, ${birthdays[0]} fêté·e`
      : `, ${joinTitlesFr(birthdays)} fêté·e·s`;

  const earlyHour = now.getHours() < 14;
  const opener = earlyHour ? 'Belle matinée' : 'Une belle journée derrière toi';
  return `${opener} — ${count} activité${count > 1 ? 's' : ''} ${ledWord}${fêtéeClause}.`;
}

// ───── Contexte de journée (day mode) ─────

function buildContextLine(
  events: CalendarEvent[],
  residentCount: number | null,
  birthdays: string[],
  firstName: string,
): string {
  // Jour vide : phrase calme, éventuellement teintée par les anniversaires.
  if (events.length === 0) {
    if (birthdays.length > 0) {
      const who = birthdaysClause(birthdays);
      const capitalized = who.charAt(0).toUpperCase() + who.slice(1);
      return `${capitalized} aujourd’hui — une journée plus calme côté activités.`;
    }
    return CALM_DAY;
  }

  // Base : "Tu as N activités aujourd'hui" (avec inflection).
  const count = events.length;
  const head = count === 1
    ? `Une activité aujourd’hui`
    : `${count} activités aujourd’hui`;

  // Détail : si ≤3 events, citer les titres ; sinon résumer.
  const titles = events.map((e) => e.title.trim()).filter((t) => t.length > 0);
  let detail = '';
  if (titles.length > 0 && titles.length <= 3) {
    detail = ` — ${joinTitlesFr(titles)}.`;
  } else if (titles.length > 3) {
    detail = ` — ${titles.slice(0, 2).join(', ')} et d’autres au programme.`;
  } else {
    detail = '.';
  }

  // Anniversaire : clause additionnelle.
  const bdayClause = birthdays.length > 0 ? ` Et ${birthdaysClause(birthdays)}.` : '';

  // Suppression de firstName / residentCount : on évite de répéter le prénom
  // (déjà dans le hello) et on évite de sous-entendre un comptage de résidents
  // qu'on n'a pas toujours précisément pour la journée.
  void residentCount; void firstName;

  return `${head}${detail}${bdayClause}`;
}

// ───── Composition ─────

export function buildGreeting(input: GreetingInput): GreetingContent {
  const { now, firstName, events, todayBirthdayNames, weather } = input;
  const bucket = hourBucket(now);
  const bilan = allEventsDone(events, now);

  // Hello — pool stable dans la journée via seed (date+firstName).
  const helloPool =
    bucket === 'morning'   ? HELLO_MORNING
    : bucket === 'noon'    ? HELLO_NOON
    : bucket === 'afternoon' ? HELLO_AFTERNOON
    : HELLO_EVENING;
  const helloBase = pickStable(helloPool, `hello|${dayKey(now)}|${firstName}`);
  const hello = firstName ? `${helloBase} ${firstName},` : `${helloBase},`;

  // Coda — pool selon moment (bilan → coda soir).
  const codaPool =
    bilan                   ? CODA_EVENING
    : bucket === 'morning'  ? CODA_MORNING
    : bucket === 'noon'     ? CODA_MORNING
    : bucket === 'afternoon' ? CODA_AFTERNOON
    : CODA_EVENING;
  const coda = pickStable(codaPool, `coda|${dayKey(now)}|${firstName}`);

  // Contexte / bilan.
  const contextLine = bilan
    ? buildBilanLine(events, todayBirthdayNames, now)
    : buildContextLine(events, null, todayBirthdayNames, firstName);

  // Météo — uniquement en mode "day" ET si remarquable.
  let weatherPhrase: string | null = null;
  if (!bilan && weather && weather.remarkable && weather.remarkableKind) {
    const pool = REMARKABLE_PHRASES[weather.remarkableKind];
    if (pool && pool.length > 0) {
      weatherPhrase = pickStable(pool, `weather|${dayKey(now)}|${weather.remarkableKind}`);
    }
  }

  return {
    hello,
    contextLine,
    weatherPhrase,
    coda,
    mode: bilan ? 'bilan' : 'day',
  };
}
