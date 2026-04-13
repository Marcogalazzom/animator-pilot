// Helpers ISO-date sans piège de fuseau horaire.
//
// `todayIso()` retourne la date locale du jour (côté utilisateur).
// `addDays()` et `mondayOf()` font de l'arithmétique pure sur la chaîne
// YYYY-MM-DD via Date.UTC, sans dépendre du fuseau du runtime.

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

export function mondayOf(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dow = dt.getUTCDay();
  const offset = dow === 0 ? -6 : 1 - dow;
  return addDays(iso, offset);
}

export function tomorrowIso(): string {
  return addDays(todayIso(), 1);
}
