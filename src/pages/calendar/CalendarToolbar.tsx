import { ChevronLeft, ChevronRight, Clock, CalendarDays, MapPin, List, Filter, CalendarClock } from 'lucide-react';
import { categoryLabel, type CategoryColor } from '@/db/categoryColors';
import { addDays, todayIso } from '@/utils/dateUtils';

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
  showAppointments: boolean;
  onShowAppointmentsChange: (v: boolean) => void;
  onToday: () => void;
}

export default function CalendarToolbar(p: Props) {
  const shift = (days: number) => p.onDateChange(addDays(p.date, days));
  const step = p.view === 'week' ? 7 : 1;
  const isToday = p.date === todayIso();

  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
      {/* View switcher */}
      <div style={{
        display: 'inline-flex', borderRadius: 999,
        border: '1px solid var(--line)', overflow: 'hidden',
        background: 'var(--surface)',
      }}>
        {(Object.keys(VIEW_META) as CalendarView[]).map((v) => {
          const { label, Icon } = VIEW_META[v];
          const active = p.view === v;
          return (
            <button
              key={v}
              onClick={() => p.onViewChange(v)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '7px 14px', border: 'none',
                background: active ? 'var(--terra-soft)' : 'transparent',
                color: active ? 'var(--terra-deep)' : 'var(--ink-2)',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: active ? 600 : 500,
                transition: 'background 0.12s, color 0.12s',
              }}
            >
              <Icon size={13} /> {label}
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
            minWidth: 180, textAlign: 'center', fontWeight: 600, fontSize: 13,
            padding: '6px 12px', borderRadius: 999,
            background: 'var(--surface-2)', color: 'var(--ink)',
            textTransform: p.view === 'day' ? 'capitalize' : 'none',
          }}>
            {p.dateLabel}
          </span>
          <button onClick={() => shift(step)} style={chevronBtn} aria-label="Suivant">
            <ChevronRight size={15} />
          </button>
          <button
            onClick={p.onToday}
            className={isToday ? 'btn sm' : 'btn primary sm'}
            disabled={isToday}
            style={{ opacity: isToday ? 0.7 : 1 }}
          >
            Aujourd'hui
          </button>
        </>
      )}

      {/* Filters */}
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
        <button
          type="button"
          onClick={() => p.onShowAppointmentsChange(!p.showAppointments)}
          title={p.showAppointments ? 'Masquer les rendez-vous' : 'Afficher les rendez-vous'}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '6px 12px', borderRadius: 999,
            border: `1px solid ${p.showAppointments ? 'var(--cat-rdv)' : 'var(--line)'}`,
            background: p.showAppointments ? 'var(--cat-rdv-bg)' : 'var(--surface)',
            color: p.showAppointments ? 'var(--cat-rdv)' : 'var(--ink-3)',
            cursor: 'pointer',
            fontSize: 12, fontWeight: 500,
            transition: 'all 0.15s ease',
          }}
        >
          <CalendarClock size={13} />
          Rendez-vous
        </button>
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
  width: 30, height: 30, borderRadius: '50%',
  border: '1px solid var(--line)',
  background: 'var(--surface)', cursor: 'pointer',
  color: 'var(--ink-2)',
  transition: 'all 0.15s ease',
};
const filterWrap: React.CSSProperties = {
  position: 'relative', display: 'inline-flex', alignItems: 'center',
};
const filterIcon: React.CSSProperties = {
  position: 'absolute', left: 12, color: 'var(--ink-3)', pointerEvents: 'none',
};
const selectStyle: React.CSSProperties = {
  padding: '7px 12px 7px 32px', border: '1px solid var(--line)',
  borderRadius: 999, fontSize: 12.5, background: 'var(--surface)',
  color: 'var(--ink)', cursor: 'pointer', appearance: 'none',
};
