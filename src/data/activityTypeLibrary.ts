// Mirror of planning-ehpad's activity type catalogue (web repo: index.html).
// Kept in sync manually — when planning-ehpad adds a new DEFAULT_TYPE or a
// new palette swatch, mirror it here so animator-pilot shows the same label
// and the same color for every activity.

export interface ColorSwatch {
  /** Main text / border color (Tailwind 700 level). */
  hex: string;
  /** Chip background (Tailwind 100 level). */
  hexBg: string;
}

export const COLOR_PALETTE: Record<string, ColorSwatch> = {
  blue:     { hex: '#1d4ed8', hexBg: '#dbeafe' },
  purple:   { hex: '#7e22ce', hexBg: '#f3e8ff' },
  pink:     { hex: '#be185d', hexBg: '#fce7f3' },
  fuchsia:  { hex: '#a21caf', hexBg: '#fae8ff' },
  lime:     { hex: '#4d7c0f', hexBg: '#ecfccb' },
  yellow:   { hex: '#a16207', hexBg: '#fef9c3' },
  orange:   { hex: '#c2410c', hexBg: '#ffedd5' },
  emerald:  { hex: '#047857', hexBg: '#d1fae5' },
  cyan:     { hex: '#0e7490', hexBg: '#cffafe' },
  red:      { hex: '#b91c1c', hexBg: '#fee2e2' },
  indigo:   { hex: '#4338ca', hexBg: '#e0e7ff' },
  amber:    { hex: '#b45309', hexBg: '#fef3c7' },
  violet:   { hex: '#6d28d9', hexBg: '#ede9fe' },
  teal:     { hex: '#0f766e', hexBg: '#ccfbf1' },
  stone:    { hex: '#44403c', hexBg: '#f5f5f4' },
  slate:    { hex: '#334155', hexBg: '#f1f5f9' },
  sky:      { hex: '#0369a1', hexBg: '#e0f2fe' },
  rose:     { hex: '#be123c', hexBg: '#ffe4e6' },
  green:    { hex: '#15803d', hexBg: '#dcfce7' },
  zinc:     { hex: '#3f3f46', hexBg: '#f4f4f5' },
  neutral:  { hex: '#404040', hexBg: '#f5f5f5' },
  warmgray: { hex: '#292524', hexBg: '#e7e5e4' },
  coral:    { hex: '#dc2626', hexBg: '#fff7ed' },
  mint:     { hex: '#059669', hexBg: '#ecfdf5' },
  lavender: { hex: '#7c3aed', hexBg: '#f5f3ff' },
  ocean:    { hex: '#2563eb', hexBg: '#eff6ff' },
  sunset:   { hex: '#ea580c', hexBg: '#fffbeb' },
  berry:    { hex: '#db2777', hexBg: '#fdf4ff' },
};

export interface ActivityTypeDef {
  key: string;
  label: string;
  icon: string;        // FontAwesome class name, not rendered here but preserved
  colorName: string;   // key into COLOR_PALETTE
}

export const DEFAULT_ACTIVITY_TYPES: ActivityTypeDef[] = [
  { key: 'sport',      label: 'Gym / Physique',      icon: 'fa-dumbbell',        colorName: 'blue' },
  { key: 'cognitive',  label: 'Mémoire',             icon: 'fa-brain',           colorName: 'purple' },
  { key: 'creative',   label: 'Art / Créatif',       icon: 'fa-palette',         colorName: 'pink' },
  { key: 'vr',         label: 'Casque RV',           icon: 'fa-vr-cardboard',    colorName: 'fuchsia' },
  { key: 'boardgames', label: 'Jeux de société',     icon: 'fa-dice',            colorName: 'lime' },
  { key: 'music',      label: 'Musique / Chant',     icon: 'fa-music',           colorName: 'yellow' },
  { key: 'food',       label: 'Goûter / Repas',      icon: 'fa-coffee',          colorName: 'orange' },
  { key: 'social',     label: 'Social / Discussion', icon: 'fa-comments',        colorName: 'emerald' },
  { key: 'outing',     label: 'Sortie Extérieure',   icon: 'fa-bus',             colorName: 'cyan' },
  { key: 'festive',    label: 'Festive / Fête',      icon: 'fa-glass-cheers',    colorName: 'red' },
  { key: 'sensory',    label: 'Sensorielle',         icon: 'fa-hand-sparkles',   colorName: 'indigo' },
  { key: 'animal',     label: 'Médiation Animale',   icon: 'fa-paw',             colorName: 'amber' },
  { key: 'religious',  label: 'Religieux / Culte',   icon: 'fa-church',          colorName: 'violet' },
  { key: 'cinema',     label: 'Cinéma / Projection', icon: 'fa-film',            colorName: 'teal' },
  { key: 'reading',    label: 'Lecture',             icon: 'fa-book-open',       colorName: 'stone' },
  { key: 'press',      label: 'Revue de presse',     icon: 'fa-newspaper',       colorName: 'slate' },
  { key: 'volleyball', label: 'Volley-ball',         icon: 'fa-volleyball-ball', colorName: 'sky' },
  { key: 'gardening',  label: 'Jardinage',           icon: 'fa-seedling',        colorName: 'green' },
];

/** Resolves a colorName (or arbitrary hex) to a swatch. Falls back to slate. */
export function resolveSwatch(colorName: string | undefined | null): ColorSwatch {
  if (!colorName) return COLOR_PALETTE.slate;
  return COLOR_PALETTE[colorName] ?? COLOR_PALETTE.slate;
}
