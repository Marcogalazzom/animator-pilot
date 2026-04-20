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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>

      {/* Segmented tabs + primary action */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div style={{
          display: 'inline-flex', borderRadius: 999,
          border: '1px solid var(--line)', overflow: 'hidden',
          background: 'var(--surface)',
        }}>
          {(Object.keys(TAB_LABELS) as ActivitiesTab[]).map((t) => {
            const active = p.tab === t;
            return (
              <button
                key={t}
                onClick={() => p.onTabChange(t)}
                style={{
                  padding: '7px 16px', border: 'none',
                  background: active ? 'var(--terra-soft)' : 'transparent',
                  color: active ? 'var(--terra-deep)' : 'var(--ink-2)',
                  fontSize: 13, fontWeight: active ? 600 : 500,
                  cursor: 'pointer',
                  transition: 'background 0.12s, color 0.12s',
                }}
              >
                {TAB_LABELS[t]}
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 11.5,
                  marginLeft: 6,
                  color: active ? 'var(--terra-deep)' : 'var(--ink-3)',
                  opacity: 0.85,
                }}>
                  {p.counts[t]}
                </span>
              </button>
            );
          })}
        </div>
        <div style={{ flex: 1 }} />
        <button className="btn primary" onClick={p.onCreate}>
          <Plus size={13} strokeWidth={2.5} /> Nouvelle activité
        </button>
      </div>

      {/* Filters row */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: 320 }}>
          <Search size={14} style={{
            position: 'absolute', left: 12, top: '50%',
            transform: 'translateY(-50%)', color: 'var(--ink-3)',
          }} />
          <input
            type="text"
            placeholder="Rechercher un titre…"
            value={p.search}
            onChange={(e) => p.onSearchChange(e.target.value)}
            style={{
              width: '100%', padding: '7px 12px 7px 34px',
              border: '1px solid var(--line)', borderRadius: 999,
              fontSize: 13, background: 'var(--surface)', color: 'var(--ink)',
              outline: 'none',
            }}
            onFocus={(e) => (e.currentTarget.style.boxShadow = '0 0 0 3px var(--terra-soft)')}
            onBlur={(e) => (e.currentTarget.style.boxShadow = 'none')}
          />
        </div>

        <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
          <Filter size={12} style={{ position: 'absolute', left: 12, color: 'var(--ink-3)', pointerEvents: 'none' }} />
          <select
            value={p.typeFilter}
            onChange={(e) => p.onTypeFilterChange(e.target.value)}
            style={{
              padding: '7px 12px 7px 32px',
              border: '1px solid var(--line)', borderRadius: 999,
              fontSize: 12.5, background: 'var(--surface)', color: 'var(--ink)',
              cursor: 'pointer', appearance: 'none',
            }}
          >
            <option value="">Tous types</option>
            {p.types.map((c) => <option key={c.name} value={c.name}>{categoryLabel(c)}</option>)}
          </select>
        </div>

        <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
          <MapPin size={12} style={{ position: 'absolute', left: 12, color: 'var(--ink-3)', pointerEvents: 'none' }} />
          <select
            value={p.locationFilter}
            onChange={(e) => p.onLocationFilterChange(e.target.value)}
            style={{
              padding: '7px 12px 7px 32px',
              border: '1px solid var(--line)', borderRadius: 999,
              fontSize: 12.5, background: 'var(--surface)', color: 'var(--ink)',
              cursor: 'pointer', appearance: 'none',
            }}
          >
            <option value="">Tous lieux</option>
            {p.locations.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
}
