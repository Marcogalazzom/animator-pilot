import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Palette, Users, Camera, Package, Heart,
  Clock, CalendarX, ChevronRight, Download,
  Bell, AlertTriangle,
} from 'lucide-react';

import KpiCard from '@/components/KpiCard';
import { useDashboardData } from './dashboard/useDashboardData';
import { exportDashboardPdf } from '@/utils/pdfExport';
import { useCalendarEvents } from './calendar/useCalendarEvents';
import TodayTimeline from './dashboard/TodayTimeline';
import UpcomingFeed from './dashboard/UpcomingFeed';
import './Dashboard.css';

// ─── Helpers ──────────────────────────────────────────────────

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
}

// ─── Main component ───────────────────────────────────────────

export default function Dashboard() {
  const {
    activityStats, overdueProjects,
    residentCount, inventoryToReplace, albumCount,
    unreadAlertCount, loading, error,
  } = useDashboardData();

  const { events: calendarEvents } = useCalendarEvents();

  const [exporting, setExporting] = useState(false);
  const navigate = useNavigate();

  const handleExportPdf = useCallback(async () => {
    if (exporting) return;
    setExporting(true);
    try {
      await exportDashboardPdf();
    } finally {
      setExporting(false);
    }
  }, [exporting]);

  // ── Loading skeleton ──
  if (loading) {
    return (
      <div style={{ padding: '0', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div>
          <div style={{ width: '200px', height: '28px', borderRadius: '6px', background: 'var(--color-border)', marginBottom: '8px' }} className="shimmer" />
          <div style={{ width: '280px', height: '16px', borderRadius: '4px', background: 'var(--color-border)' }} className="shimmer" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
          {[0,1,2,3].map(i => (
            <div key={i} style={{
              height: '112px', borderRadius: '8px', background: 'var(--color-surface)',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)', borderLeft: '3px solid var(--color-border)',
            }} className="shimmer" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1400px' }}>

      {/* ── A. Page header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
        <div>
          <h1 style={{
            fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: 700,
            color: 'var(--color-text-primary)', margin: 0, lineHeight: 1.15,
            letterSpacing: '-0.01em',
          }}>
            Tableau de bord
          </h1>
          <p style={{
            fontSize: '13px', color: 'var(--color-text-secondary)',
            margin: '6px 0 0', fontFamily: 'var(--font-sans)',
            textTransform: 'capitalize',
          }}>
            {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          {unreadAlertCount > 0 && (
            <button
              onClick={() => navigate('/settings')}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '8px 14px', backgroundColor: 'rgba(220,38,38,0.08)',
                color: 'var(--color-danger)', border: '1px solid rgba(220,38,38,0.2)',
                borderRadius: '6px', fontSize: '13px', fontWeight: 600,
                fontFamily: 'var(--font-sans)', cursor: 'pointer',
              }}
            >
              <Bell size={14} />
              {unreadAlertCount} alerte{unreadAlertCount > 1 ? 's' : ''}
            </button>
          )}

          <button
            onClick={handleExportPdf}
            disabled={exporting}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '8px 16px',
              backgroundColor: exporting ? 'var(--color-border)' : 'var(--color-primary)',
              color: '#fff', border: 'none', borderRadius: '6px',
              fontSize: '13px', fontWeight: 600, fontFamily: 'var(--font-sans)',
              cursor: exporting ? 'not-allowed' : 'pointer',
              opacity: exporting ? 0.7 : 1,
            }}
          >
            <Download size={14} />
            {exporting ? 'Export en cours…' : 'Exporter PDF'}
          </button>
        </div>
      </div>

      {/* ── DB error warning ── */}
      {error && (
        <div role="alert" style={{
          backgroundColor: 'rgba(217,119,6,0.06)', border: '1px solid var(--color-warning)',
          borderRadius: '8px', padding: '10px 16px', fontSize: '13px',
          color: 'var(--color-warning)', fontFamily: 'var(--font-sans)',
        }}>
          Données de démonstration — la base de données n'est pas accessible.
        </div>
      )}

      {/* ── B. KPI Cards row ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px',
      }}>
        <div onClick={() => navigate('/activities')} style={{ cursor: 'pointer' }}>
          <KpiCard
            label="Activités ce mois"
            value={activityStats.thisMonth.toString()}
            status="ok"
            icon={<Palette size={16} />}
          />
        </div>
        <div onClick={() => navigate('/activities')} style={{ cursor: 'pointer' }}>
          <KpiCard
            label="Participants (année)"
            value={activityStats.totalParticipants.toString()}
            status="ok"
            icon={<Users size={16} />}
          />
        </div>
        <div onClick={() => navigate('/residents')} style={{ cursor: 'pointer' }}>
          <KpiCard
            label="Résidents"
            value={residentCount.toString()}
            status="ok"
            icon={<Heart size={16} />}
          />
        </div>
        <div onClick={() => navigate('/photos')} style={{ cursor: 'pointer' }}>
          <KpiCard
            label="Albums photos"
            value={albumCount.toString()}
            status="ok"
            icon={<Camera size={16} />}
          />
        </div>
      </div>

      {/* ── C. Today + Upcoming ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
        <TodayTimeline events={calendarEvents} />
        <UpcomingFeed events={calendarEvents} />
      </div>

      {/* ── D. Quick access cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>

        {/* Inventory alert card */}
        <div
          onClick={() => navigate('/inventory')}
          style={{
            backgroundColor: 'var(--color-surface)', borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)', padding: '20px',
            borderLeft: '3px solid var(--color-warning)', cursor: 'pointer',
          }}
          className="overdue-project-item"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <Package size={16} style={{ color: 'var(--color-warning)' }} />
            <h2 style={{
              fontFamily: 'var(--font-sans)', fontSize: '14px', fontWeight: 600,
              color: 'var(--color-text-primary)', margin: 0, flex: 1,
            }}>
              Inventaire
            </h2>
            <ChevronRight size={14} style={{ color: 'var(--color-border)' }} />
          </div>
          {inventoryToReplace > 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={14} style={{ color: 'var(--color-warning)' }} />
              <span style={{ fontSize: '13px', color: 'var(--color-warning)', fontWeight: 500, fontFamily: 'var(--font-sans)' }}>
                {inventoryToReplace} article{inventoryToReplace > 1 ? 's' : ''} à remplacer
              </span>
            </div>
          ) : (
            <span style={{ fontSize: '13px', color: 'var(--color-success)', fontFamily: 'var(--font-sans)' }}>
              Tout le matériel est en bon état
            </span>
          )}
          <p style={{ margin: '8px 0 0', fontSize: '11px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-sans)' }}>
            Synchronisé depuis planning-ehpad
          </p>
        </div>

        {/* Stats card */}
        <div
          onClick={() => navigate('/activities')}
          style={{
            backgroundColor: 'var(--color-surface)', borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)', padding: '20px',
            borderLeft: '3px solid var(--color-success)', cursor: 'pointer',
          }}
          className="overdue-project-item"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <Palette size={16} style={{ color: 'var(--color-success)' }} />
            <h2 style={{
              fontFamily: 'var(--font-sans)', fontSize: '14px', fontWeight: 600,
              color: 'var(--color-text-primary)', margin: 0, flex: 1,
            }}>
              Bilan animation
            </h2>
            <ChevronRight size={14} style={{ color: 'var(--color-border)' }} />
          </div>
          <div style={{ display: 'flex', gap: '20px' }}>
            <div style={{ textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: 'var(--color-success)', fontFamily: 'var(--font-sans)' }}>
                {activityStats.completedThisYear}
              </p>
              <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-sans)' }}>
                réalisées (année)
              </p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#7C3AED', fontFamily: 'var(--font-sans)' }}>
                {activityStats.upcoming}
              </p>
              <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-sans)' }}>
                à venir
              </p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: 'var(--color-primary)', fontFamily: 'var(--font-sans)' }}>
                {activityStats.totalParticipants}
              </p>
              <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-sans)' }}>
                participants
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── E. Overdue projects ── */}
      <div style={{
        backgroundColor: 'var(--color-surface)', borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden',
      }}>
        <div style={{
          padding: '16px 20px',
          borderBottom: overdueProjects.length > 0 ? '1px solid var(--color-border)' : 'none',
          display: 'flex', alignItems: 'center', gap: '10px',
        }}>
          <CalendarX size={16} style={{ color: 'var(--color-danger)' }} />
          <h2 style={{
            fontFamily: 'var(--font-sans)', fontSize: '14px', fontWeight: 600,
            color: 'var(--color-text-primary)', margin: 0,
          }}>
            Projets en retard
          </h2>
          {overdueProjects.length > 0 && (
            <span style={{
              backgroundColor: 'var(--color-danger)', color: '#fff',
              fontSize: '11px', fontWeight: 700, borderRadius: '10px',
              padding: '1px 7px', lineHeight: '18px', fontFamily: 'var(--font-sans)',
            }}>
              {overdueProjects.length}
            </span>
          )}
        </div>

        {overdueProjects.length === 0 ? (
          <div style={{
            padding: '24px 20px', display: 'flex', alignItems: 'center', gap: '10px',
            color: 'var(--color-text-secondary)',
          }}>
            <span style={{ fontSize: '13px', fontFamily: 'var(--font-sans)' }}>
              Aucun projet en retard
            </span>
          </div>
        ) : (
          <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
            {overdueProjects.map((project, i) => (
              <li
                key={project.id}
                className="overdue-project-item"
                onClick={() => navigate('/projects')}
                style={{
                  padding: '12px 20px',
                  borderBottom: i < overdueProjects.length - 1 ? '1px solid var(--color-border)' : 'none',
                  display: 'flex', alignItems: 'center', gap: '12px',
                  cursor: 'pointer',
                }}
              >
                <div style={{
                  width: '8px', height: '8px', borderRadius: '50%',
                  backgroundColor: 'var(--color-danger)', flexShrink: 0,
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    margin: 0, fontSize: '13px', fontWeight: 600,
                    color: 'var(--color-text-primary)', fontFamily: 'var(--font-sans)',
                  }}>
                    {project.title}
                  </p>
                  <p style={{
                    margin: '2px 0 0', fontSize: '12px',
                    color: 'var(--color-text-secondary)', fontFamily: 'var(--font-sans)',
                  }}>
                    {project.owner_role}
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
                  <Clock size={12} style={{ color: 'var(--color-danger)' }} />
                  <span style={{
                    fontSize: '12px', color: 'var(--color-danger)', fontWeight: 500,
                    fontFamily: 'var(--font-sans)',
                  }}>
                    {formatDate(project.due_date)}
                  </span>
                </div>
                <ChevronRight size={14} style={{ color: 'var(--color-border)', flexShrink: 0 }} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
