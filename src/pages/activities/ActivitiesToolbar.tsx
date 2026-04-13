import { Plus, Search, MapPin, Filter } from 'lucide-react';
import { categoryLabel, type CategoryColor } from '@/db/categoryColors';

export type ActivitiesTab = 'upcoming' | 'past' | 'library';

const TAB_LABELS: Record<ActivitiesTab, string> = {
  upcoming: 'À venir',
  past: 'Passées',
  library: 'Bibliothèque',
};

interface Props {
  tab: ActivitiesTab;
  onTabChange: (t: ActivitiesTab) => void;
  counts: Record<ActivitiesTab, number>;
  search: string;
  onSearchChange: (v: string) => void;
  types: CategoryColor[];
  typeFilter: string;
  onTypeFilterChange: (v: string) => void;
  locations: string[];
  locationFilter: string;
  onLocationFilterChange: (v: string) => void;
  onCreate: () => void;
}

export default function ActivitiesToolbar(p: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <div style={{
          display: 'inline-flex', borderRadius: '10px',
          border: '1px solid var(--color-border)', overflow: 'hidden',
          background: 'var(--color-surface)',
        }}>
          {(Object.keys(TAB_LABELS) as ActivitiesTab[]).map((t) => {
            const active = p.tab === t;
            return (
              <button
                key={t}
                onClick={() => p.onTabChange(t)}
                style={{
                  padding: '8px 16px', border: 'none',
                  background: active ? 'var(--color-primary)' : 'transparent',
                  color: active ? '#fff' : 'var(--color-text-primary)',
                  fontSize: '13px', fontWeight: active ? 600 : 500,
                  fontFamily: 'var(--font-sans)', cursor: 'pointer',
                  transition: 'var(--transition-fast)',
                }}
              >
                {TAB_LABELS[t]} <span style={{ opacity: 0.7, marginLeft: '4px' }}>· {p.counts[t]}</span>
              </button>
            );
          })}
        </div>
        <button
          onClick={p.onCreate}
          style={{
            marginLeft: 'auto',
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            padding: '8px 14px', background: 'var(--color-primary)', color: '#fff',
            border: 'none', borderRadius: '8px',
            fontSize: '13px', fontWeight: 600, fontFamily: 'var(--font-sans)', cursor: 'pointer',
          }}
        >
          <Plus size={14} /> Nouvelle activité
        </button>
      </div>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: '320px' }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-secondary)' }} />
          <input
            type="text" placeholder="Rechercher un titre…" value={p.search}
            onChange={(e) => p.onSearchChange(e.target.value)}
            style={{
              width: '100%', padding: '8px 10px 8px 32px',
              border: '1px solid var(--color-border)', borderRadius: '8px',
              fontSize: '13px', fontFamily: 'var(--font-sans)', background: 'var(--color-surface)',
            }}
          />
        </div>
        <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
          <Filter size={12} style={{ position: 'absolute', left: '10px', color: 'var(--color-text-secondary)', pointerEvents: 'none' }} />
          <select value={p.typeFilter} onChange={(e) => p.onTypeFilterChange(e.target.value)}
            style={{ padding: '7px 10px 7px 30px', border: '1px solid var(--color-border)', borderRadius: '8px', fontSize: '12px', background: 'var(--color-surface)', cursor: 'pointer' }}>
            <option value="">Tous types</option>
            {p.types.map((c) => <option key={c.name} value={c.name}>{categoryLabel(c)}</option>)}
          </select>
        </div>
        <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
          <MapPin size={12} style={{ position: 'absolute', left: '10px', color: 'var(--color-text-secondary)', pointerEvents: 'none' }} />
          <select value={p.locationFilter} onChange={(e) => p.onLocationFilterChange(e.target.value)}
            style={{ padding: '7px 10px 7px 30px', border: '1px solid var(--color-border)', borderRadius: '8px', fontSize: '12px', background: 'var(--color-surface)', cursor: 'pointer' }}>
            <option value="">Tous lieux</option>
            {p.locations.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
}
