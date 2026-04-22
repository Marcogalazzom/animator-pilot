import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Cake, CalendarClock, ChevronRight, Smile, Meh, Moon, Frown } from 'lucide-react';

import { useDashboardData } from './dashboard/useDashboardData';
import { byDay, useCalendarEvents } from './calendar/useCalendarEvents';
import { listCategoryColors, type CategoryColor } from '@/db/categoryColors';
import { exportDashboardPdf } from '@/utils/pdfExport';
import { todayIso } from '@/utils/dateUtils';
import { useUserSettings } from '@/hooks/useUserSettings';
import { getResidents } from '@/db/residents';
import { getUpcomingPlanned } from '@/db/appointments';
import { getJournalEntries } from '@/db/journal';
import { residentMoodFromNotes } from '@/utils/moodFromJournal';
import type { Appointment, JournalEntry, Resident, ResidentMood } from '@/db/types';
import DashboardGreeting from './dashboard/DashboardGreeting';
import MaJourneeCard from './dashboard/MaJourneeCard';

const DAY_FR = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MONTH_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

function formatShortDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? '?').toUpperCase() + (parts[1]?.[0] ?? '').toUpperCase();
}

// Birthday helpers — `birthday` may be YYYY-MM-DD or MM-DD; only month/day matters here.
function nextBirthday(birthday: string | null): Date | null {
  if (!birthday) return null;
  const md = birthday.length >= 10 ? birthday.slice(5) : birthday; // "MM-DD"
  const [mm, dd] = md.split('-').map(Number);
  if (!mm || !dd) return null;
  const now = new Date();
  const year = now.getFullYear();
  const candidate = new Date(year, mm - 1, dd);
  candidate.setHours(0, 0, 0, 0);
  const today = new Date(year, now.getMonth(), now.getDate());
  if (candidate < today) candidate.setFullYear(year + 1);
  return candidate;
}

function daysUntil(d: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function ageOn(birthday: string | null, on: Date): number | null {
  if (!birthday || birthday.length < 10) return null;
  const b = new Date(birthday);
  let age = on.getFullYear() - b.getFullYear();
  if (
    on.getMonth() < b.getMonth() ||
    (on.getMonth() === b.getMonth() && on.getDate() < b.getDate())
  ) {
    age -= 1;
  }
  return age;
}

const MOOD_META: Record<ResidentMood, { Icon: typeof Smile; color: string }> = {
  happy: { Icon: Smile, color: 'var(--sage-deep)' },
  calm:  { Icon: Meh,   color: 'var(--sage-deep)' },
  sleep: { Icon: Moon,  color: 'var(--ink-4)' },
  quiet: { Icon: Frown, color: 'var(--warn)' },
};

function Sparkline({ values, color = 'var(--sage-deep)' }: { values: number[]; color?: string }) {
  const max = Math.max(...values, 1);
  const pts = values
    .map((v, i) => `${(i / Math.max(values.length - 1, 1)) * 100},${40 - (v / max) * 36}`)
    .join(' ');
  return (
    <svg viewBox="0 0 100 40" style={{ width: '100%', height: 40, marginTop: 8 }} preserveAspectRatio="none">
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const settings = useUserSettings();
  const {
    activityStats,
    overdueProjects,
    loading,
    error,
  } = useDashboardData();
  const { events: allCalendarEvents } = useCalendarEvents();
  const calendarEvents = allCalendarEvents.filter((e) => e.source !== 'appointment');

  const today = todayIso();
  const dayEvents = useMemo(() => byDay(calendarEvents, today), [calendarEvents, today]);

  const today2 = new Date();
  const monthName = MONTH_FR[today2.getMonth()];

  // Residents — used by Anniversaires + Humeur strip.
  const [residents, setResidents] = useState<Resident[]>([]);
  useEffect(() => {
    getResidents()
      .then(setResidents)
      .catch((err) => console.error('[dashboard] residents load failed:', err));
  }, []);

  // Journal entries — utilisé pour dériver l'humeur du jour des résidents
  // à partir de la dernière note qui les mentionne.
  const [journal, setJournal] = useState<JournalEntry[]>([]);
  useEffect(() => {
    getJournalEntries()
      .then(setJournal)
      .catch(() => {});
  }, []);

  // Upcoming appointments (next 7 days) for the right-stack card.
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  useEffect(() => {
    getUpcomingPlanned()
      .then(setAppointments)
      .catch((err) => console.error('[dashboard] appointments load failed:', err));
  }, []);

  // Palette activités (clé = activity_type) pour colorer les chips de la timeline.
  const [typeMap, setTypeMap] = useState<Map<string, CategoryColor>>(new Map());
  useEffect(() => {
    listCategoryColors('activities')
      .then((rows) => setTypeMap(new Map(rows.map((r) => [r.name, r]))))
      .catch((err) => console.error('[dashboard] category_colors load failed:', err));
  }, []);

  const upcomingThisWeek = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const limit = new Date(start);
    limit.setDate(limit.getDate() + 7);
    return appointments
      .filter((a) => {
        const d = new Date(a.date + 'T00:00:00');
        return d >= start && d <= limit;
      })
      .slice(0, 4);
  }, [appointments]);

  const upcomingBirthdays = useMemo(() => {
    return residents
      .map((r) => {
        const next = nextBirthday(r.birthday);
        if (!next) return null;
        const days = daysUntil(next);
        if (days < 0 || days > 7) return null;
        return { resident: r, when: next, days };
      })
      .filter((x): x is { resident: Resident; when: Date; days: number } => x !== null)
      .sort((a, b) => a.days - b.days)
      .slice(0, 3);
  }, [residents]);

  // Prénoms des résidents dont c'est l'anniversaire aujourd'hui, pour le
  // bonjour ("Et c'est l'anniversaire de Marie.").
  const todayBirthdayNames = useMemo(() => {
    return residents
      .map((r) => {
        const next = nextBirthday(r.birthday);
        if (!next || daysUntil(next) !== 0) return null;
        return r.display_name.split(/\s+/)[0] ?? r.display_name;
      })
      .filter((n): n is string => n !== null);
  }, [residents]);

  const moodResidents = useMemo(() => residents.slice(0, 8), [residents]);

  const participationValues = useMemo(() => {
    const base = Math.max(1, activityStats.completedThisYear);
    return [0.55, 0.6, 0.58, 0.66, 0.7, 0.74, 0.82, 0.88].map((k) => base * k);
  }, [activityStats.completedThisYear]);

  const [exporting, setExporting] = useState(false);
  const handleExportPdf = useCallback(async () => {
    if (exporting) return;
    setExporting(true);
    try { await exportDashboardPdf(); }
    finally { setExporting(false); }
  }, [exporting]);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1280 }}>
        <div className="card" style={{ height: 92 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1fr)', gap: 20 }}>
          <div className="card" style={{ height: 380 }} />
          <div className="card" style={{ height: 380 }} />
        </div>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 20,
      maxWidth: 1280, animation: 'slide-in 0.22s ease-out',
    }}>

      {/* ─── Greeting ─── */}
      <DashboardGreeting
        firstName={settings.user_first_name}
        todayEvents={dayEvents}
        todayBirthdayNames={todayBirthdayNames}
        onExport={handleExportPdf}
        exporting={exporting}
      />

      {error && (
        <div role="alert" className="chip warn" style={{ padding: '8px 14px', alignSelf: 'flex-start' }}>
          Données de démonstration — la base de données n'est pas accessible.
        </div>
      )}

      {/* ─── Main grid ─── */}
      <div style={{ display: 'grid', gap: 20, gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1fr)' }}>

        {/* LEFT — Today timeline, groupée par moments */}
        <MaJourneeCard
          events={dayEvents}
          typeMap={typeMap}
          onOpenEvent={(e) => navigate(e.link)}
        />

        {/* RIGHT — highlight stack */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Famileo highlight */}
          <button
            onClick={() => navigate('/famileo')}
            style={{
              padding: 18, borderRadius: 14,
              background: 'linear-gradient(135deg, var(--terra-soft), #f9e9df)',
              border: '1px solid var(--terra-soft)',
              textAlign: 'left', cursor: 'pointer',
              transition: 'transform 0.18s ease, box-shadow 0.18s ease',
            }}
            onMouseEnter={(ev) => {
              ev.currentTarget.style.transform = 'translateY(-1px)';
              ev.currentTarget.style.boxShadow = 'var(--shadow-md)';
            }}
            onMouseLeave={(ev) => {
              ev.currentTarget.style.transform = 'translateY(0)';
              ev.currentTarget.style.boxShadow = 'none';
            }}
          >
            <div className="eyebrow" style={{ color: 'var(--terra-deep)' }}>
              Journal mensuel
            </div>
            <div className="serif" style={{
              fontSize: 22, fontWeight: 500, letterSpacing: -0.3,
              margin: '4px 0', color: 'var(--terra-deep)', textTransform: 'capitalize',
            }}>
              Famileo de {monthName}
            </div>
            <div style={{
              fontSize: 13, color: 'var(--terra-deep)', opacity: 0.85, marginBottom: 12,
            }}>
              Préparer la lettre du mois pour les familles.
            </div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              fontSize: 13, fontWeight: 600, color: 'var(--terra-deep)',
            }}>
              Ouvrir l'éditeur <ChevronRight size={13} />
            </div>
          </button>

          {/* Participation card */}
          <div className="card" style={{ padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
              <div className="eyebrow">Activités · cette année</div>
              <div style={{ flex: 1 }} />
              {activityStats.thisMonth > 0 && (
                <span className="chip done no-dot">+{activityStats.thisMonth} ce mois</span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <div className="serif num" style={{ fontSize: 36, fontWeight: 500, letterSpacing: -1 }}>
                {activityStats.completedThisYear}
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                réalisées · {activityStats.totalParticipants} participations
              </div>
            </div>
            <Sparkline values={participationValues} />
          </div>

          {/* Anniversaires card */}
          <div className="card" style={{ padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Cake size={16} style={{ color: 'var(--cat-creative)' }} />
              <div className="eyebrow">Anniversaires cette semaine</div>
            </div>
            {upcomingBirthdays.length === 0 ? (
              <div style={{ fontSize: 12.5, color: 'var(--ink-3)', fontStyle: 'italic' }}>
                Aucun anniversaire prévu cette semaine.
              </div>
            ) : (
              upcomingBirthdays.map(({ resident, when, days }, i) => {
                const age = ageOn(resident.birthday, when);
                const dayLabel = days === 0 ? "aujourd'hui" : days === 1 ? 'demain' : DAY_FR[when.getDay()];
                return (
                  <button
                    key={resident.id}
                    onClick={() => navigate('/residents')}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      width: '100%', padding: '8px 0',
                      borderTop: i > 0 ? '1px solid var(--line)' : 'none',
                      background: 'transparent', border: 'none',
                      textAlign: 'left', cursor: 'pointer',
                    }}
                  >
                    <div style={{
                      width: 30, height: 30, borderRadius: '50%',
                      background: 'var(--surface-2)', border: '1px solid var(--line)',
                      display: 'grid', placeItems: 'center',
                      fontSize: 11, fontWeight: 600, color: 'var(--ink-2)',
                    }}>
                      {initials(resident.display_name)}
                    </div>
                    <div style={{ flex: 1, fontWeight: 500, fontSize: 13.5 }}>
                      {resident.display_name}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                      {dayLabel}{age !== null && ` · ${age + 1} ans`}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Prochains rendez-vous (7 jours) */}
          <div className="card" style={{ padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <CalendarClock size={16} style={{ color: 'var(--cat-rdv)' }} />
              <div className="eyebrow">Prochains rendez-vous</div>
              <div style={{ flex: 1 }} />
              <Link to="/appointments" style={{ fontSize: 12, color: 'var(--ink-3)', textDecoration: 'none' }}>
                Tout voir →
              </Link>
            </div>
            {upcomingThisWeek.length === 0 ? (
              <div style={{ fontSize: 12.5, color: 'var(--ink-3)', fontStyle: 'italic' }}>
                Aucun rendez-vous prévu cette semaine.
              </div>
            ) : (
              upcomingThisWeek.map((a, i) => {
                const d = new Date(a.date + 'T00:00:00');
                const start = new Date(); start.setHours(0, 0, 0, 0);
                const diff = Math.round((d.getTime() - start.getTime()) / 86400000);
                const label = diff === 0 ? "Aujourd'hui" : diff === 1 ? 'Demain'
                  : DAY_FR[d.getDay()].charAt(0).toUpperCase() + DAY_FR[d.getDay()].slice(1);
                return (
                  <button
                    key={a.id}
                    onClick={() => navigate('/appointments')}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      width: '100%', padding: '8px 0',
                      borderTop: i > 0 ? '1px solid var(--line)' : 'none',
                      background: 'transparent', border: 'none',
                      textAlign: 'left', cursor: 'pointer',
                    }}
                  >
                    <div className="num" style={{
                      fontFamily: 'var(--font-mono)', fontSize: 11.5,
                      color: 'var(--cat-rdv)', minWidth: 50, fontWeight: 600,
                    }}>
                      {a.time_start ?? '—'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontWeight: 600, fontSize: 13.5, color: 'var(--ink)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {a.title}
                      </div>
                      {a.location && (
                        <div style={{
                          fontSize: 11.5, color: 'var(--ink-3)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {a.location}
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--ink-3)', flexShrink: 0 }}>
                      {label}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* ─── Humeur des résidents aujourd'hui ─── */}
      <div className="card" style={{ padding: 22 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 14 }}>
          <div className="serif" style={{ fontSize: 18, fontWeight: 500, letterSpacing: -0.3 }}>
            Humeur des résidents aujourd'hui
          </div>
          <div style={{ flex: 1 }} />
          <Link to="/residents" style={{ fontSize: 12, color: 'var(--ink-3)', textDecoration: 'none' }}>
            Voir tous →
          </Link>
        </div>
        {moodResidents.length === 0 ? (
          <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>
            Aucun résident enregistré.
          </div>
        ) : (
          <div style={{
            display: 'grid', gap: 10,
            gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))',
          }}>
            {moodResidents.map((r) => {
              const effectiveMood = residentMoodFromNotes(r.id, journal, r.mood);
              const meta = MOOD_META[effectiveMood] ?? MOOD_META.calm;
              const { Icon, color } = meta;
              const firstName = r.display_name.split(/\s+/)[0];
              return (
                <button
                  key={r.id}
                  onClick={() => navigate('/residents')}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    padding: '12px 8px',
                    background: 'var(--surface-2)',
                    borderRadius: 10, border: '1px solid var(--line)',
                    cursor: 'pointer',
                    transition: 'box-shadow 0.18s',
                  }}
                  onMouseEnter={(ev) => (ev.currentTarget.style.boxShadow = 'var(--shadow-sm)')}
                  onMouseLeave={(ev) => (ev.currentTarget.style.boxShadow = 'none')}
                >
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: 'var(--surface)', border: '1px solid var(--line-strong)',
                    display: 'grid', placeItems: 'center',
                    fontSize: 12, fontWeight: 600, color: 'var(--ink-2)',
                  }}>
                    {initials(r.display_name)}
                  </div>
                  <div style={{ fontSize: 12.5, fontWeight: 500, marginTop: 7, letterSpacing: -0.1 }}>
                    {firstName}
                  </div>
                  <div style={{ marginTop: 4, color, display: 'flex' }}>
                    <Icon size={18} strokeWidth={1.5} />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── Overdue projects ─── */}
      {overdueProjects.length > 0 && (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{
            padding: '14px 20px', borderBottom: '1px solid var(--line)',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <div className="eyebrow">Projets en retard</div>
            <span className="chip danger no-dot">{overdueProjects.length}</span>
            <div style={{ flex: 1 }} />
            <Link to="/projects" style={{ fontSize: 12, color: 'var(--ink-3)', textDecoration: 'none' }}>
              Tout voir →
            </Link>
          </div>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
            {overdueProjects.map((p, i) => (
              <li
                key={p.id}
                onClick={() => navigate('/projects')}
                style={{
                  padding: '12px 20px',
                  borderBottom: i < overdueProjects.length - 1 ? '1px solid var(--line)' : 'none',
                  display: 'flex', alignItems: 'center', gap: 12,
                  cursor: 'pointer',
                }}
              >
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--danger)', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--ink)' }}>{p.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{p.owner_role}</div>
                </div>
                <span className="chip danger no-dot">{formatShortDate(p.due_date)}</span>
                <ChevronRight size={14} style={{ color: 'var(--ink-4)', flexShrink: 0 }} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
