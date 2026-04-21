// Demo data seeder + cleaner.
// Used from the Settings page to populate / wipe the local SQLite DB so every
// design v2 feature has realistic content to render.

import { collection, deleteDoc, doc, getDocs, query, where } from 'firebase/firestore';
import { getDb } from '@/db/database';
import { firestore } from '@/services/firebase';
import { createResident } from '@/db/residents';
import { createActivity } from '@/db/activities';
import { createJournalEntry } from '@/db/journal';
import { createProject, createAction } from '@/db/projects';
import { createExpense } from '@/db/budget';
import { createAlbum } from '@/db/photos';
import { createAppointment } from '@/db/appointments';
import { createInventoryItem } from '@/db/inventory';
import { createStaffMember } from '@/db/staff';
import { createSupplier } from '@/db/suppliers';

// ─── Date helpers ────────────────────────────────────────────

function offsetDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Birthday "MM-DD" relative to today, with the given historical year. */
function birthday(historicalYear: number, daysFromToday: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${historicalYear}-${mm}-${dd}`;
}

// ─── Counts returned to the UI after seed ────────────────────

export interface SeedCounts {
  residents: number;
  activities: number;
  journal: number;
  projects: number;
  expenses: number;
  appointments: number;
  albums: number;
  inventory: number;
  staff: number;
  suppliers: number;
}

// ─── Seed ────────────────────────────────────────────────────

export async function seedDemoData(): Promise<SeedCounts> {
  const counts: SeedCounts = {
    residents: 0, activities: 0, journal: 0, projects: 0,
    expenses: 0, appointments: 0, albums: 0,
    inventory: 0, staff: 0, suppliers: 0,
  };
  // Track inserted activity + expense IDs so we can mark them as `synced_from='demo'`
  // after seeding. The sync push filter (`WHERE synced_from IS NULL OR ''`) will then
  // skip them, so they NEVER get pushed to planning-ehpad.
  const insertedActivityIds: number[] = [];
  const insertedExpenseIds: number[] = [];

  // ─── Résidents (12) ───
  // Two birthdays in the next 7 days so the "Anniversaires cette semaine" card lights up.
  const RESIDENTS = [
    { name: 'Jeanne Morel',    room: '12', bdayYear: 1939, bdayOffset:   3, arrivalOffset: -1115, mood: 'happy', prefs: 'musique, lecture',          notes: 'Aime beaucoup la musique classique (Chopin surtout) et les romans policiers. A été professeure de français pendant 38 ans. Apprécie qu\'on l\'appelle par son prénom.', family: 'Claire (fille) · 06 12 34 56 78\nThomas (petit-fils) · visite mensuelle', participation: 'active' },
    { name: 'Paul Lecomte',    room: '08', bdayYear: 1934, bdayOffset:   6, arrivalOffset: -1668, mood: 'sleep', prefs: 'jardin, cartes',             notes: 'Préfère les activités calmes en matinée. Fatigue importante l\'après-midi.', family: 'Martin (fils) · 06 88 77 66 55', participation: 'occasional' },
    { name: 'Michèle Dubois',  room: '15', bdayYear: 1942, bdayOffset: 318, arrivalOffset: -1196, mood: 'calm',  prefs: 'peinture, broderie',         notes: 'Passionnée d\'art. A donné des cours de dessin pendant 20 ans.', family: 'Sophie (fille) · 07 11 22 33 44', participation: 'active' },
    { name: 'André Petit',     room: '03', bdayYear: 1937, bdayOffset:  63, arrivalOffset: -1487, mood: 'happy', prefs: 'chant, marche',              notes: 'Très sociable. Aime entraîner les autres résidents.', family: 'Pierre (fils) · visite hebdomadaire', participation: 'active' },
    { name: 'Odette Bernard',  room: '21', bdayYear: 1934, bdayOffset: 147, arrivalOffset: -1976, mood: 'happy', prefs: 'tricot, café',               notes: 'Tricote des layettes pour le foyer maternel local.', family: 'Anne (nièce)', participation: 'moderate' },
    { name: 'Henri Martin',    room: '17', bdayYear: 1940, bdayOffset:  10, arrivalOffset: -1408, mood: 'quiet', prefs: 'jeux de société, mots fléchés', notes: 'Réservé mais très fidèle aux ateliers de jeux. À encourager.', family: 'Pas de contact direct enregistré.', participation: 'moderate' },
    { name: 'Simone Garcia',   room: '05', bdayYear: 1941, bdayOffset: 236, arrivalOffset: -1157, mood: 'happy', prefs: 'cuisine, thé',               notes: 'Adore les ateliers cuisine. Recettes du Sud-Ouest.', family: 'José (fils) · 06 33 44 55 66', participation: 'active' },
    { name: 'Louis Moreau',    room: '19', bdayYear: 1936, bdayOffset:  72, arrivalOffset: -1640, mood: 'calm',  prefs: 'histoire, lectures',         notes: 'Ancien professeur d\'histoire-géo. Apprécie les conférences.', family: 'Catherine (fille)', participation: 'moderate' },
    { name: 'Alice Lefebvre',  room: '02', bdayYear: 1943, bdayOffset: 280, arrivalOffset:  -595, mood: 'happy', prefs: 'mots croisés, scrabble',     notes: 'Vive d\'esprit. Adore les défis intellectuels.', family: 'Daniel (frère) · visites bi-mensuelles', participation: 'active' },
    { name: 'Robert Girard',   room: '07', bdayYear: 1938, bdayOffset: 110, arrivalOffset: -1326, mood: 'quiet', prefs: 'pétanque, télé',             notes: 'A du mal avec le bruit. Activités en petit groupe.', family: 'Émilie (petite-fille) · 07 22 33 44 55', participation: 'occasional' },
    { name: 'Yvonne Roux',     room: '11', bdayYear: 1932, bdayOffset: 205, arrivalOffset: -2160, mood: 'calm',  prefs: 'poésie, broderie',           notes: 'Doyenne de l\'établissement. Mémoire vive jusqu\'à la guerre.', family: 'Hélène (fille) · 06 99 88 77 66', participation: 'observer' },
    { name: 'Marcel Faure',    room: '16', bdayYear: 1939, bdayOffset:  33, arrivalOffset: -1235, mood: 'happy', prefs: 'accordéon, danse',           notes: 'Joue de l\'accordéon. Met l\'ambiance dans les fêtes !', family: 'Jacques (fils) · visite mensuelle', participation: 'active' },
  ] as const;

  const residentIdsByName = new Map<string, number>();
  for (const r of RESIDENTS) {
    const id = await createResident({
      display_name: r.name,
      room_number: r.room,
      interests: r.prefs,
      animation_notes: r.notes,
      participation_level: r.participation,
      birthday: birthday(r.bdayYear, r.bdayOffset),
      arrival_date: offsetDays(r.arrivalOffset),
      mood: r.mood,
      family_contacts: r.family,
    });
    residentIdsByName.set(r.name, id);
    counts.residents++;
  }
  const idOf = (name: string): number => residentIdsByName.get(name) ?? 0;

  // ─── Activity templates (15 across 6 categories) ───
  const TEMPLATES: Array<{
    title: string; type: string; category: 'memory' | 'creative' | 'body' | 'outing' | 'rdv' | 'prep';
    difficulty: 'facile' | 'moyen' | 'difficile';
    desc: string; max: number; location: string; mat: string;
  }> = [
    { title: 'Atelier souvenirs',         type: 'memoire',  category: 'memory',   difficulty: 'facile', desc: 'Autour d\'objets et photos du passé — ravive les souvenirs.', max: 12, location: 'salle commune', mat: 'photos d\'époque, objets' },
    { title: 'Loto musical',              type: 'memoire',  category: 'memory',   difficulty: 'facile', desc: 'Reconnaître les chansons d\'époque. Grand succès.',          max: 18, location: 'grand salon',   mat: 'enceinte, cartons loto' },
    { title: 'Quiz cinéma',               type: 'memoire',  category: 'memory',   difficulty: 'moyen',  desc: 'Films des années 50-70, à deux équipes.',                    max: 12, location: 'salle TV',      mat: 'projecteur, extraits' },
    { title: 'Gym douce',                 type: 'gym',      category: 'body',     difficulty: 'facile', desc: 'Mouvements assis adaptés à la mobilité réduite.',            max: 14, location: 'salle d\'activité', mat: 'chaises, coussins' },
    { title: 'Marche au jardin',          type: 'gym',      category: 'body',     difficulty: 'facile', desc: 'Petite balade encadrée dans le parc.',                       max: 8,  location: 'jardin',        mat: 'rien' },
    { title: 'Étirements assis',          type: 'gym',      category: 'body',     difficulty: 'facile', desc: 'Souplesse douce pour articulations.',                        max: 12, location: 'petit salon',   mat: 'tapis, élastiques' },
    { title: 'Atelier peinture',          type: 'arts',     category: 'creative', difficulty: 'moyen',  desc: 'Aquarelle ou acrylique selon la saison.',                    max: 8,  location: 'atelier',       mat: 'pinceaux, toiles, peinture' },
    { title: 'Chant & musique',           type: 'arts',     category: 'creative', difficulty: 'facile', desc: 'Chansons françaises classiques. Accordéon de Marcel.',       max: 15, location: 'grand salon',   mat: 'enceinte, recueils' },
    { title: 'Couture & tricot',          type: 'arts',     category: 'creative', difficulty: 'moyen',  desc: 'Atelier intergénérationnel avec l\'école voisine.',          max: 10, location: 'atelier',       mat: 'aiguilles, laine' },
    { title: 'Sortie au marché',          type: 'sortie',   category: 'outing',   difficulty: 'moyen',  desc: 'Marché du samedi avec le minibus.',                          max: 6,  location: 'extérieur',     mat: 'minibus, paniers' },
    { title: 'Goûter intergénérationnel', type: 'social',   category: 'outing',   difficulty: 'facile', desc: 'Avec les enfants de la crèche voisine.',                     max: 20, location: 'grand salon',   mat: 'goûter, jouets' },
    { title: 'Coiffure',                  type: 'rdv',      category: 'rdv',      difficulty: 'facile', desc: 'Coiffeuse extérieure (Mme Lecuyer).',                        max: 1,  location: 'salon coiffure', mat: 'rien' },
    { title: 'Visite docteur',            type: 'rdv',      category: 'rdv',      difficulty: 'facile', desc: 'Consultation médecin coordonnateur.',                        max: 1,  location: 'cabinet',       mat: 'dossier' },
    { title: 'Préparation Famileo',       type: 'prep',     category: 'prep',     difficulty: 'moyen',  desc: 'Tri photos et rédaction édito mensuel.',                     max: 1,  location: 'bureau',        mat: 'ordinateur, photos' },
    { title: 'Réunion équipe',            type: 'prep',     category: 'prep',     difficulty: 'facile', desc: 'Point hebdomadaire animation + soins.',                      max: 8,  location: 'bureau',        mat: 'rien' },
  ];

  for (const t of TEMPLATES) {
    const id = await createActivity({
      title: t.title,
      activity_type: t.type,
      description: t.desc,
      date: '',
      time_start: null, time_end: null,
      location: t.location,
      max_participants: t.max,
      actual_participants: 0,
      animator_name: 'Marie',
      status: 'planned',
      materials_needed: t.mat,
      notes: '',
      linked_project_id: null,
      synced_from: '', last_sync_at: null, external_id: null,
      is_shared: 0, is_template: 1, unit: 'main', is_recurring: 0,
      category: t.category,
      difficulty: t.difficulty,
    });
    insertedActivityIds.push(id);
    counts.activities++;
  }

  // ─── Scheduled activities (mostly today + this week so the timeline lights up) ───
  const SCHEDULED: Array<{
    title: string; type: string; category: 'memory' | 'creative' | 'body' | 'outing' | 'rdv' | 'prep';
    difficulty: 'facile' | 'moyen' | 'difficile';
    dayOffset: number; start: string | null; end: string | null;
    location: string; max: number; actual: number; status: 'planned' | 'completed' | 'cancelled';
  }> = [
    { title: 'Atelier mémoire',                  type: 'memoire', category: 'memory',   difficulty: 'facile', dayOffset:  0, start: '10:00', end: '10:45', location: 'salle commune',     max: 12, actual: 11, status: 'planned' },
    { title: 'Visite famille — Mme Morel',       type: 'rdv',     category: 'rdv',      difficulty: 'facile', dayOffset:  0, start: '11:30', end: '12:30', location: 'salon privé',       max: 1,  actual: 0,  status: 'planned' },
    { title: "Préparer le goûter d'anniversaire", type: 'prep',    category: 'prep',     difficulty: 'facile', dayOffset:  0, start: '14:00', end: '15:00', location: 'cuisine',           max: 1,  actual: 0,  status: 'planned' },
    { title: 'Chant & musique',                  type: 'arts',    category: 'creative', difficulty: 'facile', dayOffset:  0, start: '15:30', end: '16:30', location: 'grand salon',       max: 15, actual: 8,  status: 'planned' },
    { title: 'Compte-rendu atelier mémoire',     type: 'prep',    category: 'prep',     difficulty: 'facile', dayOffset:  0, start: '16:30', end: '17:00', location: 'bureau',            max: 1,  actual: 0,  status: 'planned' },
    { title: 'Gym douce',                        type: 'gym',     category: 'body',     difficulty: 'facile', dayOffset:  1, start: '10:00', end: '10:45', location: 'salle d\'activité', max: 14, actual: 0,  status: 'planned' },
    { title: 'Sortie au marché',                 type: 'sortie',  category: 'outing',   difficulty: 'moyen',  dayOffset:  3, start: '09:30', end: '11:30', location: 'extérieur',         max: 6,  actual: 0,  status: 'planned' },
    { title: 'Loto musical',                     type: 'memoire', category: 'memory',   difficulty: 'facile', dayOffset: -1, start: '15:00', end: '16:00', location: 'grand salon',       max: 18, actual: 16, status: 'completed' },
    { title: 'Atelier peinture',                 type: 'arts',    category: 'creative', difficulty: 'moyen',  dayOffset: -3, start: '14:00', end: '15:30', location: 'atelier',           max: 8,  actual: 7,  status: 'completed' },
    { title: 'Café littéraire',                  type: 'memoire', category: 'memory',   difficulty: 'moyen',  dayOffset: -7, start: '15:00', end: '16:00', location: 'bibliothèque',      max: 8,  actual: 6,  status: 'completed' },
  ];

  for (const a of SCHEDULED) {
    const id = await createActivity({
      title: a.title,
      activity_type: a.type,
      description: '',
      date: offsetDays(a.dayOffset),
      time_start: a.start, time_end: a.end,
      location: a.location,
      max_participants: a.max,
      actual_participants: a.actual,
      animator_name: 'Marie',
      status: a.status,
      materials_needed: '',
      notes: '',
      linked_project_id: null,
      synced_from: '', last_sync_at: null, external_id: null,
      is_shared: 0, is_template: 0, unit: 'main', is_recurring: 0,
      category: a.category,
      difficulty: a.difficulty,
    });
    insertedActivityIds.push(id);
    counts.activities++;
  }

  // ─── Journal (12 entrées, mix shared/private + résidents tagués) ───
  const JOURNAL: Array<{
    dayOffset: number; mood: 'great' | 'good' | 'neutral' | 'difficult' | 'bad';
    content: string; tags: string; shared: boolean; residents: string[];
  }> = [
    { dayOffset:   0, mood: 'good',      content: "Atelier mémoire bien rempli ce matin (11/12). Jeanne a raconté un souvenir d'école qui a fait beaucoup parler le groupe. À refaire avec plus d'objets.", tags: 'mémoire, jeanne, succès',         shared: true,  residents: ['Jeanne Morel'] },
    { dayOffset:   0, mood: 'neutral',   content: "Henri très réservé pendant l'atelier. À revoir : peut-être lui proposer un format duo plutôt que groupe ?",                                                tags: 'henri, observation',              shared: false, residents: ['Henri Martin'] },
    { dayOffset:  -1, mood: 'great',     content: "Loto musical : 16 résidents, ambiance excellente. Marcel a sorti son accordéon, on a fini sur trois chansons à reprendre. Note pour Famileo.",            tags: 'loto, marcel, famileo',           shared: true,  residents: ['Marcel Faure'] },
    { dayOffset:  -2, mood: 'good',      content: "Visite de la fille de Mme Morel hier — elle nous a apporté des photos de la communion de 1948. Idée d'atelier souvenirs personnalisé pour Jeanne.",       tags: 'jeanne, famille, idée',          shared: true,  residents: ['Jeanne Morel'] },
    { dayOffset:  -3, mood: 'good',      content: "Atelier peinture — Michèle est dans son élément, a guidé deux autres résidentes. Toiles à exposer dans le couloir.",                                       tags: 'peinture, michèle',               shared: true,  residents: ['Michèle Dubois'] },
    { dayOffset:  -3, mood: 'difficult', content: "Discussion compliquée avec la famille de Paul — fatigue importante les après-midi. Reprendre rendez-vous avec le médecin coordonnateur.",                  tags: 'paul, famille, médical',          shared: false, residents: ['Paul Lecomte'] },
    { dayOffset:  -5, mood: 'good',      content: "Réunion équipe : on planifie une sortie au Louvre pour septembre. Demander devis bus adapté.",                                                              tags: 'sortie, louvre, équipe',          shared: true,  residents: [] },
    { dayOffset:  -6, mood: 'great',     content: "Goûter intergénérationnel un succès — les enfants de la crèche ont chanté. André très ému. À refaire à Pâques.",                                          tags: 'goûter, intergénérationnel',      shared: true,  residents: ['André Petit'] },
    { dayOffset:  -7, mood: 'good',      content: "Café littéraire : extrait de Camus lu par Jeanne. Beau silence après. Idée de monter un cycle Camus ?",                                                     tags: 'lecture, camus, idée',            shared: true,  residents: ['Jeanne Morel', 'Louis Moreau'] },
    { dayOffset: -10, mood: 'neutral',   content: "Inventaire matériel : il manque des pinceaux et la boîte de peinture commence à être bien usée. Voir budget.",                                              tags: 'matériel, budget, inventaire',    shared: true,  residents: [] },
    { dayOffset: -14, mood: 'difficult', content: "Yvonne semble plus fatiguée. À surveiller. Note perso : ne pas la solliciter sur les ateliers en grand groupe ce mois-ci.",                                  tags: 'yvonne, surveillance',            shared: false, residents: ['Yvonne Roux'] },
    { dayOffset: -21, mood: 'good',      content: "Premier atelier accordéon mené par Marcel — il a été parfait. Les autres résidents l'ont applaudi. Photos à mettre dans le Famileo de mai.",               tags: 'marcel, accordéon, famileo',      shared: true,  residents: ['Marcel Faure'] },
  ];

  for (const j of JOURNAL) {
    const linkedIds = j.residents.map((n) => idOf(n)).filter((id) => id > 0).join(',');
    await createJournalEntry({
      date: offsetDays(j.dayOffset),
      time: '',
      title: '',
      author: 'Marie',
      content: j.content,
      mood: j.mood,
      category: 'prep',
      tags: j.tags,
      is_shared: j.shared ? 1 : 0,
      linked_resident_ids: linkedIds,
    });
    counts.journal++;
  }

  // ─── Projects (6) avec actions ───
  const PROJECTS: Array<{
    title: string; description: string; owner: string; status: 'todo' | 'in_progress' | 'done' | 'overdue';
    dueOffset: number; category: string; nextAction: string;
    actions: Array<{ title: string; progress: number; dueOffset: number; status: 'todo' | 'in_progress' | 'done' }>;
  }> = [
    {
      title: 'Jardin aromatique', description: "Création d'un carré d'herbes aromatiques accessible aux résidents en fauteuil. Budget validé direction.",
      owner: 'Marie Coste', status: 'in_progress', dueOffset: 60, category: 'Jardin & vie',
      nextAction: "Acheter les jardinières surélevées (samedi marché aux fleurs).",
      actions: [
        { title: 'Validation emplacement avec direction',    progress: 100, dueOffset: -20, status: 'done' },
        { title: 'Achat des jardinières surélevées',          progress:  20, dueOffset:   5, status: 'in_progress' },
        { title: 'Plantation avec les résidents',             progress:   0, dueOffset:  21, status: 'todo' },
        { title: 'Atelier cuisine avec les herbes récoltées', progress:   0, dueOffset:  60, status: 'todo' },
      ],
    },
    {
      title: 'Spectacle de Noël', description: "Préparation du spectacle annuel avec la chorale locale et les enfants de l'école Saint-Joseph.",
      owner: 'Marie Coste', status: 'todo', dueOffset: 240, category: 'Événement',
      nextAction: "Premier contact avec la chorale (pré-rentrée septembre).",
      actions: [
        { title: 'Contacter la chorale locale',               progress:   0, dueOffset: 150, status: 'todo' },
        { title: 'Organiser répétitions hebdomadaires',       progress:   0, dueOffset: 180, status: 'todo' },
        { title: 'Décoration salle commune',                  progress:   0, dueOffset: 220, status: 'todo' },
      ],
    },
    {
      title: 'Projet de vie M. Lecomte', description: "Adapter les activités à la fatigue de Paul. Privilégier matinée et formats courts.",
      owner: 'Marie + équipe soins', status: 'in_progress', dueOffset: 30, category: 'Accompagnement',
      nextAction: "Réunion pluridisciplinaire jeudi pour valider planning adapté.",
      actions: [
        { title: 'Bilan avec famille',                        progress: 100, dueOffset: -14, status: 'done' },
        { title: 'Adapter planning hebdo',                    progress:  60, dueOffset:   3, status: 'in_progress' },
        { title: 'Réévaluation à 1 mois',                     progress:   0, dueOffset:  30, status: 'todo' },
      ],
    },
    {
      title: 'Atelier Proust', description: "Cycle de lectures et discussions autour de la mémoire involontaire (madeleines, sons, odeurs).",
      owner: 'Marie + bénévole', status: 'in_progress', dueOffset: 14, category: 'Thérapeutique',
      nextAction: "Préparer la séance 'odeurs d'enfance' (jeudi).",
      actions: [
        { title: 'Sélection des extraits',                    progress: 100, dueOffset: -30, status: 'done' },
        { title: 'Première séance test',                      progress: 100, dueOffset: -14, status: 'done' },
        { title: 'Séances mensuelles régulières',             progress:  50, dueOffset:  14, status: 'in_progress' },
        { title: 'Bilan & restitution',                       progress:   0, dueOffset:  90, status: 'todo' },
      ],
    },
    {
      title: 'Sortie Louvre', description: "Sortie collective au musée du Louvre pour 6 résidents en septembre. Bus adapté.",
      owner: 'Marie + Claire D.', status: 'todo', dueOffset: 150, category: 'Sortie',
      nextAction: "Demander 3 devis bus adapté avant fin du mois.",
      actions: [
        { title: 'Devis bus adapté',                          progress:  10, dueOffset:  10, status: 'in_progress' },
        { title: 'Pré-réservation visite guidée',             progress:   0, dueOffset:  30, status: 'todo' },
        { title: 'Validation médicale par résident',          progress:   0, dueOffset:  90, status: 'todo' },
      ],
    },
    {
      title: 'Poulailler', description: "Mise en place d'un petit poulailler pédagogique. 4 poules, accessible jardin.",
      owner: 'Marie + bénévole', status: 'overdue', dueOffset: -10, category: 'Jardin & vie',
      nextAction: "Relancer le bénévole pour la construction de l'enclos.",
      actions: [
        { title: 'Validation hygiène',                        progress: 100, dueOffset: -60, status: 'done' },
        { title: 'Construction enclos',                       progress:  30, dueOffset: -10, status: 'in_progress' },
        { title: 'Achat des poules',                          progress:   0, dueOffset:  14, status: 'todo' },
      ],
    },
  ];

  for (const p of PROJECTS) {
    const projectId = await createProject({
      title: p.title,
      description: p.description,
      owner_role: p.owner,
      status: p.status,
      start_date: null,
      due_date: offsetDays(p.dueOffset),
      category: p.category,
      next_action: p.nextAction,
    });
    for (const a of p.actions) {
      await createAction({
        project_id: projectId,
        title: a.title,
        progress: a.progress,
        due_date: offsetDays(a.dueOffset),
        status: a.status,
      });
    }
    counts.projects++;
  }

  // ─── Dépenses ───
  // NOTE: on n'appelle plus `upsertBudget` ici — il pourrait écraser un budget réel
  // déjà saisi par l'utilisateur. Le budget total se règle manuellement dans la page Budget.
  const fiscalYear = new Date().getFullYear();

  const EXPENSES: Array<{
    title: string; category: 'intervenants' | 'materiel' | 'sorties' | 'fetes' | 'other';
    amount: number; dayOffset: number; supplier: string; description: string;
  }> = [
    { title: 'Toiles + peinture acrylique',  category: 'materiel',     amount: 87.40,  dayOffset:  -3, supplier: 'Cultura',          description: 'Réassort atelier peinture' },
    { title: 'Gâteau anniversaire Mme Roux', category: 'fetes',        amount: 24.00,  dayOffset:  -7, supplier: 'Boulangerie Renaud', description: '94 ans' },
    { title: 'Intervention musicale',        category: 'intervenants', amount: 140.00, dayOffset: -10, supplier: 'Lucie Robert',     description: 'Atelier chant 2h' },
    { title: 'Jardinières surélevées (×3)',  category: 'materiel',     amount: 215.00, dayOffset:  -8, supplier: 'Botanic',          description: 'Projet jardin aromatique' },
    { title: 'Bus adapté — sortie marché',   category: 'sorties',      amount: 95.00,  dayOffset: -14, supplier: 'TransAdapt',       description: 'Aller-retour' },
    { title: 'Bouquets fleurs salle commune', category: 'fetes',       amount: 38.50,  dayOffset: -21, supplier: 'La Rose',          description: 'Mensuel' },
    { title: 'Pinceaux + crayons',           category: 'materiel',     amount: 42.20,  dayOffset: -28, supplier: 'Cultura',          description: 'Inventaire avril' },
    { title: 'Intervenant kiné',             category: 'intervenants', amount: 80.00,  dayOffset: -30, supplier: 'Thomas Martin',    description: 'Séance bi-mensuelle' },
    { title: 'Boissons goûter intergén.',    category: 'fetes',        amount: 45.80,  dayOffset: -32, supplier: 'Carrefour Market', description: 'Crèche voisine' },
    { title: 'Accordéon Marcel — réparation', category: 'materiel',    amount: 65.00,  dayOffset: -38, supplier: 'Atelier Musical',  description: 'Cordes + soufflet' },
    { title: 'Sortie pâtisserie',            category: 'sorties',      amount: 28.00,  dayOffset: -45, supplier: 'Pâtisserie Dupré', description: '4 résidents' },
    { title: 'Jeux de société (renouv.)',    category: 'materiel',     amount: 56.00,  dayOffset: -55, supplier: 'Cultura',          description: 'Tarot, Scrabble' },
    { title: 'Intervention conteuse',        category: 'intervenants', amount: 120.00, dayOffset: -62, supplier: 'Mme Berthier',     description: 'Atelier histoires' },
    { title: 'Imprimante Famileo (toner)',   category: 'other',        amount: 78.00,  dayOffset: -75, supplier: 'Bureau Vallée',    description: 'Toner couleur' },
    { title: 'Décoration printemps',         category: 'fetes',        amount: 32.50,  dayOffset: -90, supplier: 'Action',           description: 'Guirlandes salle commune' },
  ];

  for (const e of EXPENSES) {
    const id = await createExpense({
      fiscal_year: fiscalYear,
      title: e.title,
      category: e.category,
      amount: e.amount,
      date: offsetDays(e.dayOffset),
      description: e.description,
      supplier: e.supplier,
      invoice_path: null,
      linked_intervenant_id: null,
      synced_from: '', last_sync_at: null, external_id: null,
    });
    insertedExpenseIds.push(id);
    counts.expenses++;
  }

  // ─── Albums (vides — les vraies photos demanderaient des fichiers) ───
  const monthIso = `${new Date().toISOString().slice(0, 7)}-01`;
  const ALBUMS = [
    { title: 'Atelier mémoire — avril',     description: 'Photos des séances mémoire du mois.',           type: 'memoire' },
    { title: 'Goûters & anniversaires — avril', description: 'Souvenirs des anniversaires d\'avril.',       type: 'fetes' },
    { title: 'Sorties — avril',             description: 'Marché, balades au jardin, intergénérationnel.', type: 'sortie' },
  ];
  for (const a of ALBUMS) {
    await createAlbum({
      title: a.title,
      description: a.description,
      activity_date: monthIso,
      cover_path: null,
      activity_id: null,
      activity_type: a.type,
    });
    counts.albums++;
  }

  // ─── Rendez-vous pro ───
  const APPOINTMENTS: Array<{
    title: string; type: 'meeting' | 'supplier' | 'training' | 'interview' | 'other';
    dayOffset: number; start: string | null; end: string | null;
    location: string; participants: string; description: string; status: 'planned' | 'completed' | 'cancelled';
  }> = [
    { title: 'Réunion équipe direction',     type: 'meeting',  dayOffset:  1, start: '09:00', end: '10:00', location: 'bureau direction', participants: 'Direction, Marie, Claire', description: 'Point hebdo + bilan mars',                status: 'planned' },
    { title: 'Fournisseur peinture (Cultura)', type: 'supplier', dayOffset: 3, start: '14:00', end: '15:00', location: 'Cultura',          participants: 'Marie',                    description: 'Devis matériel atelier 2026',             status: 'planned' },
    { title: 'Formation gestes barrières',    type: 'training', dayOffset:  4, start: '10:00', end: '12:00', location: 'salle formation',  participants: 'Toute l\'équipe',          description: 'Formation annuelle obligatoire',           status: 'planned' },
    { title: 'Entretien remplaçante été',     type: 'interview', dayOffset: 7, start: '15:00', end: '16:00', location: 'bureau',           participants: 'Marie, Direction',         description: 'Entretien Léa Dupont (animatrice été)',    status: 'planned' },
    { title: 'Visite famille Mme Garcia',     type: 'meeting',  dayOffset: -1, start: '16:00', end: '16:45', location: 'salon privé',     participants: 'Marie, José Garcia',       description: 'Bilan trimestriel',                        status: 'completed' },
  ];

  for (const a of APPOINTMENTS) {
    await createAppointment({
      title: a.title,
      appointment_type: a.type,
      date: offsetDays(a.dayOffset),
      time_start: a.start, time_end: a.end,
      location: a.location,
      participants: a.participants,
      description: a.description,
      status: a.status,
    });
    counts.appointments++;
  }

  // ─── Inventaire ───
  const INVENTORY: Array<{
    name: string; category: string; quantity: number;
    condition: 'neuf' | 'bon' | 'usage' | 'a_remplacer';
    location: string; notes: string; type: 'consumable' | 'durable';
  }> = [
    { name: 'Pinceaux assortis',     category: 'matériel art',  quantity: 24, condition: 'neuf',        location: 'atelier',         notes: 'Achat avril 2026',           type: 'durable' },
    { name: 'Toiles 30×40',           category: 'matériel art', quantity:  8, condition: 'bon',         location: 'atelier',         notes: '',                            type: 'consumable' },
    { name: 'Enceinte Bluetooth',     category: 'audio',         quantity:  1, condition: 'bon',         location: 'grand salon',     notes: 'Marshall Stanmore',          type: 'durable' },
    { name: 'Cartons loto',           category: 'jeux',          quantity: 30, condition: 'bon',         location: 'placard salon',   notes: '',                            type: 'durable' },
    { name: 'Crayons couleur',        category: 'matériel art',  quantity: 50, condition: 'usage',       location: 'atelier',         notes: 'À renouveler en septembre',  type: 'consumable' },
    { name: 'Boîtes peinture acryl.', category: 'matériel art',  quantity:  6, condition: 'a_remplacer', location: 'atelier',         notes: 'Sèches — racheter',           type: 'consumable' },
    { name: 'Tapis de yoga',          category: 'sport',         quantity:  4, condition: 'bon',         location: 'salle d\'activité', notes: '',                          type: 'durable' },
    { name: 'Hand-grips',             category: 'sport',         quantity:  6, condition: 'neuf',        location: 'salle d\'activité', notes: '',                          type: 'durable' },
  ];

  for (const i of INVENTORY) {
    await createInventoryItem({
      name: i.name,
      category: i.category,
      quantity: i.quantity,
      condition: i.condition,
      location: i.location,
      notes: i.notes,
      inventory_type: i.type,
      synced_from: '', last_sync_at: null, external_id: null,
    });
    counts.inventory++;
  }

  // ─── Annuaire personnel ───
  const STAFF: Array<{
    first: string; last: string; role: string; phone: string; email: string;
    service: string; available: number; notes: string;
    hourlyRate: number | null; sessionRate: number | null;
  }> = [
    { first: 'Marie',   last: 'Coste',    role: 'Animatrice principale',    phone: '06 11 22 33 44', email: 'marie.coste@glycines.fr',  service: 'animation', available: 1, notes: 'Référente projet famileo + résidents.',                hourlyRate: null, sessionRate: null },
    { first: 'Claire',  last: 'Dubois',   role: 'Aide-soignante référente', phone: '06 22 33 44 55', email: 'claire.d@glycines.fr',     service: 'soins',     available: 1, notes: 'Référente animation côté soins. Disponible mardi/jeudi.', hourlyRate: null, sessionRate: null },
    { first: 'Lucie',   last: 'Robert',   role: 'Intervenante musique',     phone: '06 78 99 00 11', email: 'lucie.robert@artmuse.fr',  service: 'externe',   available: 1, notes: 'Vient 2 mardis/mois pour atelier chant.',                hourlyRate: 35, sessionRate: null },
    { first: 'Thomas',  last: 'Martin',   role: 'Kinésithérapeute',         phone: '06 44 55 66 77', email: 'tmartin@kine-libre.fr',    service: 'externe',   available: 1, notes: 'Intervention bi-mensuelle.',                              hourlyRate: null, sessionRate: 80 },
    { first: 'Sophie',  last: 'Petit',    role: 'Bénévole',                 phone: '07 33 22 11 00', email: '',                          service: 'bénévolat', available: 1, notes: 'Atelier lecture à voix haute, samedis.',                  hourlyRate: null, sessionRate: null },
  ];

  for (const s of STAFF) {
    await createStaffMember({
      first_name: s.first,
      last_name: s.last,
      role: s.role,
      phone: s.phone,
      email: s.email,
      service: s.service,
      is_available: s.available,
      notes: s.notes,
      hourly_rate: s.hourlyRate,
      session_rate: s.sessionRate,
      synced_from: '', last_sync_at: null, external_id: null,
    });
    counts.staff++;
  }

  // ─── Fournisseurs ───
  const SUPPLIERS: Array<{
    name: string; category: string; contact: string; phone: string; email: string;
    address: string; website: string; notes: string;
    hourlyRate: number | null; sessionRate: number | null; favorite: number;
  }> = [
    { name: 'Boulangerie Renaud',  category: 'pâtisserie', contact: 'M. Renaud',     phone: '04 76 12 34 56', email: 'contact@boulangerie-renaud.fr', address: '12 rue des Lilas',           website: '', notes: 'Gâteaux d\'anniversaire sur commande 48h.',  hourlyRate: null, sessionRate: null, favorite: 1 },
    { name: 'Conservatoire local', category: 'musique',    contact: 'Mme Lhuillier', phone: '04 76 22 33 44', email: 'animation@conservatoire.fr',     address: 'Place Centrale',             website: 'conservatoire-grenoble.fr', notes: 'Élèves disponibles pour interventions occasionnelles.', hourlyRate: 0, sessionRate: 50, favorite: 0 },
    { name: 'Cultura',             category: 'matériel',   contact: 'Pôle pro',      phone: '04 76 88 99 00', email: 'pro@cultura.com',                address: 'ZA des Glières',             website: 'cultura.com', notes: '10 % pro sur présentation carte.',                  hourlyRate: null, sessionRate: null, favorite: 1 },
    { name: 'Fleuriste La Rose',   category: 'fleurs',     contact: 'Mme Beaumont',  phone: '04 76 55 44 33', email: '',                                address: '4 rue Mistral',              website: '', notes: 'Bouquets mensuels salle commune.',                          hourlyRate: null, sessionRate: null, favorite: 0 },
    { name: 'Pharmacie de la Place', category: 'santé',    contact: 'Dr. Lefèvre',    phone: '04 76 11 22 33', email: 'pharma.place@gmail.com',         address: 'Place de la Mairie',         website: '', notes: 'Pharmacie référente. Livraisons à domicile.',              hourlyRate: null, sessionRate: null, favorite: 1 },
  ];

  for (const s of SUPPLIERS) {
    await createSupplier({
      name: s.name,
      category: s.category,
      contact_name: s.contact,
      phone: s.phone,
      email: s.email,
      address: s.address,
      website: s.website,
      notes: s.notes,
      hourly_rate: s.hourlyRate,
      session_rate: s.sessionRate,
      is_favorite: s.favorite,
    });
    counts.suppliers++;
  }

  // ─── Mark all seeded activities + expenses as DEMO so they're skipped by sync ───
  // The push filter in syncService.ts is `WHERE synced_from = '' OR synced_from IS NULL`,
  // so any non-empty value (here `'demo'`) excludes the row. We also force is_shared=0
  // on activities as belt-and-suspenders.
  const db = await getDb();
  if (insertedActivityIds.length > 0) {
    const ph = insertedActivityIds.map(() => '?').join(',');
    await db.execute(
      `UPDATE activities SET synced_from = 'demo', external_id = 'demo', is_shared = 0 WHERE id IN (${ph})`,
      insertedActivityIds,
    );
  }
  if (insertedExpenseIds.length > 0) {
    const ph = insertedExpenseIds.map(() => '?').join(',');
    await db.execute(
      `UPDATE expenses SET synced_from = 'demo', external_id = 'demo' WHERE id IN (${ph})`,
      insertedExpenseIds,
    );
  }

  return counts;
}

// ─── Cleanup remote demo data (planning-ehpad) ───────────────

/** Demo activity titles — used to identify rows that may have been pushed to
 *  Firestore by an EARLIER demo seed (before the `synced_from='demo'` marker
 *  was introduced). Kept in sync with the activity arrays above. */
const DEMO_ACTIVITY_TITLES = [
  // Templates
  'Atelier souvenirs', 'Loto musical', 'Quiz cinéma', 'Gym douce',
  'Marche au jardin', 'Étirements assis', 'Atelier peinture',
  'Chant & musique', 'Couture & tricot', 'Sortie au marché',
  'Goûter intergénérationnel', 'Coiffure', 'Visite docteur',
  'Préparation Famileo', 'Réunion équipe',
  // Scheduled
  'Atelier mémoire', 'Visite famille — Mme Morel',
  "Préparer le goûter d'anniversaire", 'Compte-rendu atelier mémoire',
  'Café littéraire',
];

const DEMO_EXPENSE_TITLES = [
  'Toiles + peinture acrylique', 'Gâteau anniversaire Mme Roux',
  'Intervention musicale', 'Jardinières surélevées (×3)',
  'Bus adapté — sortie marché', 'Bouquets fleurs salle commune',
  'Pinceaux + crayons', 'Intervenant kiné',
  'Boissons goûter intergén.', 'Accordéon Marcel — réparation',
  'Sortie pâtisserie', 'Jeux de société (renouv.)',
  'Intervention conteuse', 'Imprimante Famileo (toner)',
  'Décoration printemps',
];

export interface CleanupCounts {
  activitiesDeleted: number;
  expensesDeleted: number;
  errors: number;
  scanned: { activities: number; expenses: number };
}

/** Counts how many DEMO rows are currently pushed to Firestore (preview before
 *  user confirms). Looks at local rows whose title matches the demo set AND
 *  which have an external_id (the Firestore doc ID) set by a previous push. */
export async function countRemoteDemoRows(): Promise<{ activities: number; expenses: number }> {
  const db = await getDb();
  const ap = DEMO_ACTIVITY_TITLES.map(() => '?').join(',');
  const acts = await db.select<{ cnt: number }[]>(
    `SELECT COUNT(*) AS cnt FROM activities
     WHERE title IN (${ap})
       AND external_id IS NOT NULL AND external_id != '' AND external_id != 'demo'`,
    DEMO_ACTIVITY_TITLES,
  );
  const ep = DEMO_EXPENSE_TITLES.map(() => '?').join(',');
  const exps = await db.select<{ cnt: number }[]>(
    `SELECT COUNT(*) AS cnt FROM expenses
     WHERE title IN (${ep})
       AND external_id IS NOT NULL AND external_id != '' AND external_id != 'demo'`,
    DEMO_EXPENSE_TITLES,
  );
  return { activities: acts[0]?.cnt ?? 0, expenses: exps[0]?.cnt ?? 0 };
}

/** Deletes Firestore docs whose local rows match a demo title AND have a real
 *  Firestore external_id (i.e. were pushed by an earlier sync). Also removes
 *  the local row to leave a clean state. Untouched: anything created by the
 *  user that doesn't match a demo title. */
export async function cleanupDemoFromFirestore(): Promise<CleanupCounts> {
  const db = await getDb();
  const result: CleanupCounts = {
    activitiesDeleted: 0, expensesDeleted: 0, errors: 0,
    scanned: { activities: 0, expenses: 0 },
  };

  // Activities
  const ap = DEMO_ACTIVITY_TITLES.map(() => '?').join(',');
  const acts = await db.select<{ id: number; external_id: string }[]>(
    `SELECT id, external_id FROM activities
     WHERE title IN (${ap})
       AND external_id IS NOT NULL AND external_id != '' AND external_id != 'demo'`,
    DEMO_ACTIVITY_TITLES,
  );
  result.scanned.activities = acts.length;

  for (const a of acts) {
    try {
      await deleteDoc(doc(firestore, 'activities', a.external_id));
    } catch (err) {
      // Doc might already be gone on Firestore — log but proceed to delete locally.
      console.warn('[cleanup] activity Firestore delete:', err);
    }
    try {
      await db.execute('DELETE FROM activities WHERE id = ?', [a.id]);
      result.activitiesDeleted++;
    } catch (err) {
      console.error('[cleanup] activity local delete failed:', err);
      result.errors++;
    }
  }

  // Expenses
  const ep = DEMO_EXPENSE_TITLES.map(() => '?').join(',');
  const exps = await db.select<{ id: number; external_id: string }[]>(
    `SELECT id, external_id FROM expenses
     WHERE title IN (${ep})
       AND external_id IS NOT NULL AND external_id != '' AND external_id != 'demo'`,
    DEMO_EXPENSE_TITLES,
  );
  result.scanned.expenses = exps.length;

  for (const e of exps) {
    try {
      await deleteDoc(doc(firestore, 'animationExpenses', e.external_id));
    } catch (err) {
      console.warn('[cleanup] expense Firestore delete:', err);
    }
    try {
      await db.execute('DELETE FROM expenses WHERE id = ?', [e.id]);
      result.expensesDeleted++;
    } catch (err) {
      console.error('[cleanup] expense local delete failed:', err);
      result.errors++;
    }
  }

  return result;
}

/** Defensive sweep: also queries Firestore directly by title to catch demo
 *  docs that no longer have a matching local row (e.g. user already deleted
 *  the local copy but the remote remained). Best-effort; ignores errors. */
export async function sweepRemoteDemoFirestore(): Promise<{ activitiesDeleted: number }> {
  let deleted = 0;
  try {
    const q = query(
      collection(firestore, 'activities'),
      where('title', 'in', DEMO_ACTIVITY_TITLES.slice(0, 10)),  // Firestore 'in' max 10
    );
    const snap = await getDocs(q);
    for (const d of snap.docs) {
      try { await deleteDoc(d.ref); deleted++; } catch { /* ignore */ }
    }
    const q2 = query(
      collection(firestore, 'activities'),
      where('title', 'in', DEMO_ACTIVITY_TITLES.slice(10, 20)),
    );
    const snap2 = await getDocs(q2);
    for (const d of snap2.docs) {
      try { await deleteDoc(d.ref); deleted++; } catch { /* ignore */ }
    }
  } catch (err) {
    console.warn('[cleanup] Firestore sweep failed:', err);
  }
  return { activitiesDeleted: deleted };
}

// ─── Clear ───────────────────────────────────────────────────

/** Wipes user-facing data tables. Preserves app_settings, sync_log, alerts,
 *  and other "infrastructure" rows. */
export async function clearAllData(): Promise<void> {
  const db = await getDb();
  // Order matters: delete child rows before parents (actions before projects, etc.).
  const TABLES = [
    'photos',           // before albums
    'photo_albums',
    'actions',          // before projects
    'projects',
    'expenses',
    'animation_budget',
    'journal',
    'activities',
    'appointments',
    'inventory',
    'staff',
    'suppliers',
    'residents',
  ];
  for (const t of TABLES) {
    try {
      await db.execute(`DELETE FROM ${t}`, []);
    } catch (err) {
      // Tables may not exist on legacy installs — log and continue.
      console.warn(`[clearAllData] DELETE FROM ${t} failed:`, err);
    }
  }
  // Reset sync_log so sync indicators don't show stale data.
  try {
    await db.execute('DELETE FROM sync_log', []);
  } catch { /* table may not exist */ }
}
