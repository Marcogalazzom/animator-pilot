import { useEffect } from 'react';
import { create } from 'zustand';
import { getSetting, setSetting } from '@/db/settings';
import {
  applyThemeColor, DEFAULT_THEME, THEME_SETTING_KEY,
} from '@/utils/themeColors';

interface ThemeColorStore {
  current: string;
  loaded: boolean;
  load: () => Promise<void>;
  setTheme: (key: string) => Promise<void>;
}

const useThemeColorStore = create<ThemeColorStore>((set, get) => ({
  current: DEFAULT_THEME,
  loaded: false,
  load: async () => {
    if (get().loaded) return;
    try {
      const raw = await getSetting(THEME_SETTING_KEY);
      const key = raw ?? DEFAULT_THEME;
      applyThemeColor(key);
      set({ current: key, loaded: true });
    } catch (err) {
      console.error('[theme] load failed:', err);
      applyThemeColor(DEFAULT_THEME);
      set({ loaded: true });
    }
  },
  setTheme: async (key) => {
    // Applique AVANT d'attendre la DB : UX instantanée même si le disque
    // est lent.
    applyThemeColor(key);
    set({ current: key });
    try {
      await setSetting(THEME_SETTING_KEY, key);
    } catch (err) {
      console.error('[theme] save failed:', err);
    }
  },
}));

/**
 * Hook side-effect : charge la préférence de thème au premier mount et
 * applique l'override sur :root. Retourne la clé courante.
 */
export function useThemeColor(): string {
  const current = useThemeColorStore((s) => s.current);
  const loaded = useThemeColorStore((s) => s.loaded);
  const load = useThemeColorStore((s) => s.load);
  useEffect(() => {
    if (!loaded) load();
  }, [loaded, load]);
  return current;
}

export function setThemeColor(key: string): Promise<void> {
  return useThemeColorStore.getState().setTheme(key);
}
