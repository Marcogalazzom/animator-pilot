import { ChevronLeft, ChevronRight, Clock, CalendarDays, MapPin, List, Filter } from 'lucide-react';
import { categoryLabel, type CategoryColor } from '@/db/categoryColors';

export type CalendarView = 'day' | 'week' | 'location' | 'list';

const VIEW_META: Record<CalendarView, { label: string; Icon: typeof Clock }> = {
  day:      { label: 'Jour',    Icon: Clock },
  week:     { label: 'Semaine', Icon: CalendarDays },
  location: { label: 'Lieux',   Icon: MapPin },
  list:     { label: 'Liste',   Icon: List },
};

interface Props {
  view: CalendarView;
  onViewChange: (v: CalendarView) => void;
  date: string;
  onDateChange: (d: string) => void;
  dateLabel: string;
  types: CategoryColor[];
  typeFilter: string;
  onTypeFilterChange: (v: string) => void;
  locations: string[];
  locationFilter: string;
  onLocationFilterChange: (v: string) => void;
  onToday: () => void;
}

function todayIso(): string { return new Date().toISOString().slice(0, 10); }

export default function CalendarToolbar(p: Props) {
  const shift = (days: number) => {
    const d = new Date(p.date + 'T00:00:00');
    d.setDate(d.getDate() + days);
    p.onDateChange(d.toISOString().slice(0, 10));
  };
  const step = p.view === 'week' ? 7 : 1;
  const isToday = p.date === todayIso();

  return (
    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '20px' }}>
      {/* View switcher */}
      <div style={{
        display: 'inline-flex', borderRadius: '10px',
        border: '1px solid var(--color-border)', overflow: 'hidden',
        background: 'var(--color-surface)',
      }}>
        {(Object.keys(VIEW_META) as CalendarView[]).map((v) => {
          const { label, Icon } = VIEW_META[v];
          const active = p.view === v;
          return (
            <button
              key={v}
              onClick={() => p.onViewChange(v)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '8px 14px',
                border: 'none',
                background: active ? 'var(--color-primary)' : 'transparent',
                color: active ? '#fff' : 'var(--color-text-primary)',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: active ? 600 : 500,
                fontFamily: 'var(--font-sans)',
                transition: 'var(--transition-fast)',
                boxShadow: active ? '0 1px 3px rgba(30,64,175,0.3)' : 'none',
              }}
            >
              <Icon size={13} />
              {label}
            </button>
          );
        })}
      </div>

      {/* Date nav */}
      {p.view !== 'list' && (
        <>
          <button onClick={() => shift(-step)} style={chevronBtn} aria-label="Précédent">
            <ChevronLeft size={15} />
          </button>
          <span style={{
            minWidth: '180px', textAlign: 'center', fontWeight: 600, fontSize: '13px',
            padding: '6px 12px', borderRadius: '8px',
            background: 'var(--color-bg-soft)', color: 'var(--color-text-primary)',
            textTransform: p.view === 'day' ? 'capitalize' : 'none',
          }}>
            {p.dateLabel}
          </span>
          <button onClick={() => shift(step)} style={chevronBtn} aria-label="Suivant">
            <ChevronRight size={15} />
          </button>
          <button
            onClick={p.onToday}
            style={{
              padding: '6px 12px', borderRadius: '8px',
              border: '1px solid ' + (isToday ? 'var(--color-border)' : 'var(--color-primary)'),
              background: isToday ? 'var(--color-surface)' : 'var(--color-primary)',
              color: isToday ? 'var(--color-text-secondary)' : '#fff',
              cursor: isToday ? 'default' : 'pointer',
              fontSize: '12px', fontWeight: 500, fontFamily: 'var(--font-sans)',
              transition: 'var(--transition-fast)',
            }}
            disabled={isToday}
          >
            Aujourd'hui
          </button>
        </>
      )}

      {/* Filters */}
      <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
        <div style={filterWrap}>
          <Filter size={12} style={filterIcon} />
          <select
            value={p.typeFilter}
            onChange={(e) => p.onTypeFilterChange(e.target.value)}
            style={selectStyle}
          >
            <option value="">Tous types</option>
            {p.types.map((c) => <option key={c.name} value={c.name}>{categoryLabel(c)}</option>)}
          </select>
        </div>
        <div style={filterWrap}>
          <MapPin size={12} style={filterIcon} />
          <select
            value={p.locationFilter}
            onChange={(e) => p.onLocationFilterChange(e.target.value)}
            style={selectStyle}
          >
            <option value="">Tous lieux</option>
            {p.locations.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
}

const chevronBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  width: '30px', height: '30px', borderRadius: '50%',
  border: '1px solid var(--color-border)',
  background: 'var(--color-surface)', cursor: 'pointer',
  color: 'var(--color-text-primary)',
  transition: 'var(--transition-fast)',
};
const filterWrap: React.CSSProperties = {
  position: 'relative', display: 'inline-flex', alignItems: 'center',
};
const filterIcon: React.CSSProperties = {
  position: 'absolute', left: '10px', color: 'var(--color-text-secondary)', pointerEvents: 'none',
};
const selectStyle: React.CSSProperties = {
  padding: '7px 10px 7px 30px', border: '1px solid var(--color-border)',
  borderRadius: '8px', fontSize: '12px', background: 'var(--color-surface)',
  fontFamily: 'var(--font-sans)', cursor: 'pointer',
};
