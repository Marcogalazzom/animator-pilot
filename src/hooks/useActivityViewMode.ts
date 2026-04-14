import { useEffect, useState, useCallback } from 'react';

export type ActivityViewMode = 'animations' | 'pasa';

export const ACTIVITY_VIEW_MODE_KEY = 'activity_view_mode';
const CHANGE_EVENT = 'activity-view-mode-change';
const DEFAULT_MODE: ActivityViewMode = 'animations';

function parseMode(raw: string | null): ActivityViewMode {
  return raw === 'pasa' ? 'pasa' : 'animations';
}

export function getActivityViewMode(): ActivityViewMode {
  if (typeof window === 'undefined') return DEFAULT_MODE;
  try {
    return parseMode(window.localStorage.getItem(ACTIVITY_VIEW_MODE_KEY));
  } catch {
    return DEFAULT_MODE;
  }
}

export function isPasaLocation(location: string | null | undefined): boolean {
  if (!location) return false;
  return location.trim().toLowerCase() === 'pasa';
}

export function filterByViewMode<T extends { location?: string | null }>(
  items: T[],
  mode: ActivityViewMode,
): T[] {
  if (mode === 'pasa') return items.filter((i) => isPasaLocation(i.location));
  return items.filter((i) => !isPasaLocation(i.location));
}

export function useActivityViewMode(): [ActivityViewMode, (m: ActivityViewMode) => void] {
  const [mode, setModeState] = useState<ActivityViewMode>(() => getActivityViewMode());

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === ACTIVITY_VIEW_MODE_KEY) setModeState(parseMode(e.newValue));
    };
    const onCustom = () => setModeState(getActivityViewMode());
    window.addEventListener('storage', onStorage);
    window.addEventListener(CHANGE_EVENT, onCustom);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(CHANGE_EVENT, onCustom);
    };
  }, []);

  const setMode = useCallback((m: ActivityViewMode) => {
    try {
      window.localStorage.setItem(ACTIVITY_VIEW_MODE_KEY, m);
    } catch {
      /* ignore quota / private mode */
    }
    setModeState(m);
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
  }, []);

  return [mode, setMode];
}
