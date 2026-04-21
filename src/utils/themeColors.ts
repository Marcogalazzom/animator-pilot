// Sélecteur de couleur dominante de l'app. On expose 6 presets coordonnés
// avec la palette warm-paper (chaque preset = triplet base/soft/deep pour
// les 3 CSS custom properties --terra*). La bascule se fait en écrivant
// directement sur document.documentElement — tout le design system
// consomme via var(--terra*) donc la propagation est instantanée.

export interface ThemePreset {
  key: string;
  label: string;
  base: string;   // → --terra      (fond des éléments actifs / icônes)
  soft: string;   // → --terra-soft (bg des chips et surfaces actives)
  deep: string;   // → --terra-deep (texte primaire + bordures fortes)
}

export const THEME_PRESETS: ThemePreset[] = [
  { key: 'terra',    label: 'Terra',            base: '#e8a5b5', soft: '#fae3ea', deep: '#a84e68' },
  { key: 'sage',     label: 'Sage',             base: '#a8b89e', soft: '#e3ead8', deep: '#556744' },
  { key: 'ocean',    label: 'Océan',            base: '#8eb1d9', soft: '#e0ecf7', deep: '#3d6489' },
  { key: 'lavender', label: 'Lavande',          base: '#b8a4d9', soft: '#ece0f7', deep: '#6b4f9b' },
  { key: 'sunset',   label: 'Coucher de soleil', base: '#e8b48a', soft: '#fbe6d2', deep: '#a8643a' },
  { key: 'mint',     label: 'Menthe',           base: '#96c8b3', soft: '#dcefe6', deep: '#3f7a5e' },
];

export const DEFAULT_THEME = 'terra';
export const THEME_SETTING_KEY = 'theme_color';

export function getThemePreset(key: string): ThemePreset {
  return THEME_PRESETS.find((p) => p.key === key) ?? THEME_PRESETS[0];
}

export function applyThemeColor(key: string): void {
  const preset = getThemePreset(key);
  const root = document.documentElement;
  root.style.setProperty('--terra', preset.base);
  root.style.setProperty('--terra-soft', preset.soft);
  root.style.setProperty('--terra-deep', preset.deep);
}
