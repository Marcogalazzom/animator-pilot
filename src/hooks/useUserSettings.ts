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

// localStorage mirror — double la persistance SQLite. Synchrone, disponible
// AVANT le premier rendu, donc pas de race au chargement. Sert aussi de
// filet de sécurité si la DB est absente ou si un import/export casse la
// table app_settings.
const LS_KEY = 'pilot-animateur:user-settings';

function readLocalStorage(): Partial<UserSettings> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeLocalStorage(s: UserSettings): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(s));
  } catch {
    /* quota ou mode privé — on continue, SQLite prend le relais */
  }
}

function merge(patch: Partial<UserSettings>, base: UserSettings): UserSettings {
  return {
    user_first_name: patch.user_first_name ?? base.user_first_name,
    user_last_name:  patch.user_last_name  ?? base.user_last_name,
    user_role:       patch.user_role       ?? base.user_role,
    residence_name:  patch.residence_name  ?? base.residence_name,
    residence_kind:  patch.residence_kind  ?? base.residence_kind,
  };
}

// État initial : lu SYNCHRONEMENT depuis localStorage → pas de flash
// FALLBACK au premier rendu si l'utilisateur a déjà sauvegardé une fois.
const initialFromLS = readLocalStorage();
const initialSettings = merge(initialFromLS, FALLBACK);
const initialLoaded = Object.keys(initialFromLS).length > 0;

interface UserSettingsStore {
  settings: UserSettings;
  loaded: boolean;
  load: () => Promise<void>;
  save: (patch: Partial<UserSettings>) => Promise<void>;
}

export const useUserSettingsStore = create<UserSettingsStore>((set, get) => ({
  settings: initialSettings,
  loaded: initialLoaded,
  load: async () => {
    // `loaded` signale que le store a déjà des valeurs utiles (depuis LS
    // ou DB). On passe quand même par la DB en arrière-plan pour picker
    // d'éventuelles clés non mirrored (import, etc.).
    try {
      const all = await getAllSettings();
      const fromDb: Partial<UserSettings> = {};
      if (typeof all.user_first_name === 'string') fromDb.user_first_name = all.user_first_name;
      if (typeof all.user_last_name  === 'string') fromDb.user_last_name  = all.user_last_name;
      if (typeof all.user_role       === 'string') fromDb.user_role       = all.user_role;
      if (typeof all.residence_name  === 'string') fromDb.residence_name  = all.residence_name;
      if (typeof all.residence_kind  === 'string') fromDb.residence_kind  = all.residence_kind;

      const next = initialLoaded
        // Si LS avait déjà des valeurs, elles sont prioritaires (source
        // de vérité « dernière saisie utilisateur »). Complète juste les
        // trous depuis la DB.
        ? merge(get().settings, merge(fromDb, FALLBACK))
        // Sinon DB prend la main, fallback sur FALLBACK.
        : merge(fromDb, FALLBACK);

      set({ settings: next, loaded: true });
      writeLocalStorage(next);
    } catch (err) {
      console.error('[user-settings] load failed:', err);
      set({ loaded: true });
    }
  },
  save: async (patch) => {
    const next = merge(patch, get().settings);
    // 1. localStorage D'ABORD (synchrone, infaillible).
    writeLocalStorage(next);
    // 2. Store (réactif à l'UI).
    set({ settings: next });
    // 3. SQLite en dernier — la valeur est déjà persistée via LS même si
    //    ce write échoue.
    try {
      for (const [key, value] of Object.entries(patch)) {
        if (value !== undefined) await setSetting(key, value);
      }
    } catch (err) {
      console.error('[user-settings] SQLite save failed (LS ok):', err);
    }
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
 * True dès que le store a des valeurs utiles (localStorage au démarrage,
 * puis réconciliation DB). Permet à la page Paramètres de ne pas afficher
 * "Chargement…" si l'utilisateur a déjà saisi son identité.
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
