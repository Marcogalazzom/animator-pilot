import type { JournalEntry, JournalMood, ResidentMood } from '@/db/types';

// Mapping des humeurs du journal (auteur) vers celles des résidents.
// Pas de cible 'sleep' : c'est un état physique, pas un ressenti noté.
const JOURNAL_TO_RESIDENT: Record<JournalMood, ResidentMood> = {
  great:     'happy',
  good:      'happy',
  neutral:   'calm',
  difficult: 'quiet',
  bad:       'quiet',
};

/**
 * Humeur "du jour" d'un résident : prend celle de la note de journal la
 * plus récente qui le mentionne. Si aucune note ne le mentionne, retourne
 * le `fallback` (typiquement `resident.mood` — la valeur stockée).
 */
export function residentMoodFromNotes(
  residentId: number,
  notes: JournalEntry[],
  fallback: ResidentMood,
): ResidentMood {
  const sorted = [...notes].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return (b.time || '').localeCompare(a.time || '');
  });
  for (const e of sorted) {
    const linked = e.linked_resident_ids
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n));
    if (linked.includes(residentId)) {
      return JOURNAL_TO_RESIDENT[e.mood] ?? fallback;
    }
  }
  return fallback;
}
