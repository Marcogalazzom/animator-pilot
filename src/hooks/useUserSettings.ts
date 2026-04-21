import { useEffect } from 'react';
import { create } from 'zustand';
import { getAllSettings, setSetting } from '@/db/settings';

export interface UserSettings {
  user_first_name: string;
  user_last_name: string;
  user_role: string;
  residence_name: string;
  residence_kind: string;
}

const FALLBACK: UserSettings = {
  user_first_name: 'Marie',
  user_last_name: 'Coste',
  user_role: 'Animatrice',
  residence_name: 'Les Glycines',
  residence_kind: 'EHPAD',
};

interface UserSettingsStore {
  settings: UserSettings;
  loaded: boolean;
  load: () => Promise<void>;
  save: (patch: Partial<UserSettings>) => Promise<void>;
}

export const useUserSettingsStore = create<UserSettingsStore>((set, get) => ({
  settings: FALLBACK,
  loaded: false,
  load: async () => {
    if (get().loaded) return;
    try {
      const all = await getAllSettings();
      // `??` (pas `||`) pour ne pas retomber sur le FALLBACK si l'utilisateur
      // a explicitement saisi une chaîne vide (sinon impossible de vider un
      // champ).
      set({
        settings: {
          user_first_name: all.user_first_name ?? FALLBACK.user_first_name,
          user_last_name:  all.user_last_name  ?? FALLBACK.user_last_name,
          user_role:       all.user_role       ?? FALLBACK.user_role,
          residence_name:  all.residence_name  ?? FALLBACK.residence_name,
          residence_kind:  all.residence_kind  ?? FALLBACK.residence_kind,
        },
        loaded: true,
      });
    } catch (err) {
      console.error('[user-settings] load failed:', err);
      set({ loaded: true });
    }
  },
  save: async (patch) => {
    // Persiste AVANT de toucher le store, pour qu'une panne disk rende la
    // save observable dès le toast et qu'on n'affiche pas un état non
    // persisté.
    try {
      for (const [key, value] of Object.entries(patch)) {
        if (value !== undefined) await setSetting(key, value);
      }
    } catch (err) {
      console.error('[user-settings] save failed:', err);
      throw err;
    }
    const next = { ...get().settings, ...patch };
    set({ settings: next });
  },
}));

export function useUserSettings(): UserSettings {
  const settings = useUserSettingsStore((s) => s.settings);
  const loaded = useUserSettingsStore((s) => s.loaded);
  const load = useUserSettingsStore((s) => s.load);

  useEffect(() => {
    if (!loaded) load();
  }, [loaded, load]);

  return settings;
}

/**
 * Exposé séparément pour permettre aux écrans de ne monter leur formulaire
 * qu'une fois la lecture DB terminée (évite la race où l'utilisateur tape
 * sur les valeurs FALLBACK puis voit son input écrasé par le load async).
 */
export function useUserSettingsLoaded(): boolean {
  const loaded = useUserSettingsStore((s) => s.loaded);
  const load = useUserSettingsStore((s) => s.load);
  useEffect(() => {
    if (!loaded) load();
  }, [loaded, load]);
  return loaded;
}

export function setUserSettings(patch: Partial<UserSettings>): Promise<void> {
  return useUserSettingsStore.getState().save(patch);
}
