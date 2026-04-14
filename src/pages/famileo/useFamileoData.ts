import { useState, useEffect, useCallback } from 'react';
import { getFamileoSections, type FamileoSection } from '@/db/famileo';
import { ensureCategoryColors, type CategoryColor } from '@/db/categoryColors';

export interface UIFamileoSection extends FamileoSection {
  included: boolean;
  order: number;
  category: CategoryColor | null;
}

export interface FamileoData {
  sections: UIFamileoSection[];
  loading: boolean;
  setSections: (next: UIFamileoSection[]) => void;
  refresh: () => Promise<void>;
}

export function useFamileoData(year: number, month: number): FamileoData {
  const [sections, setSections] = useState<UIFamileoSection[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const raw = await getFamileoSections(year, month);
      const typeNames = Array.from(new Set(raw.map((s) => s.album.activity_type).filter(Boolean)));
      const cats = await ensureCategoryColors('activities', typeNames).catch(() => [] as CategoryColor[]);
      const catsByName = new Map(cats.map((c) => [c.name, c]));

      setSections(
        raw.map((s, i) => ({
          ...s,
          category: s.album.activity_type ? (catsByName.get(s.album.activity_type) ?? null) : null,
          included: s.photos.length > 0,
          order: i,
        }))
      );
    } catch { /* ignore */ }
    setLoading(false);
  }, [year, month]);

  useEffect(() => { refresh(); }, [refresh]);

  return { sections, loading, setSections, refresh };
}
