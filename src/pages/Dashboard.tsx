import { useMemo, useId } from 'react';
import {
  BedDouble, Euro, Users, AlertTriangle,
  Clock, CalendarX, ChevronRight,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';

import KpiCard       from '@/components/KpiCard';
import AlertBanner   from '@/components/AlertBanner';
import type { AlertItem } from '@/components/AlertBanner';
import type { KpiStatus } from '@/components/KpiCard';
import { useDashboardData } from './dashboard/useDashboardData';
import './Dashboard.css';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function trendPct(current: number, previous: number): string {
  if (previous === 0) return '0%';
  const delta = ((current - previous) / previous) * 100;
  return (delta > 0 ? '+' : '') + delta.toFixed(1) + '%';
}

function trendDir(current: number, previous: number): 'up' | 'down' | 'neutral' {
  if (current > previous) return 'up';
  if (current < previous) return 'down';
  return 'neutral';
}

function occupationStatus(value: number): KpiStatus {
  if (value >= 90) return 'ok';
  if (value >= 80) return 'warning';
  return 'critical';
}

function absenteismeStatus(value: number): KpiStatus {
  if (value <= 8)  return 'ok';
  if (value <= 12) return 'warning';
  return 'critical';
}

function evenementsStatus(value: number): KpiStatus {
  if (value <= 3) return 'ok';
  if (value <= 6) return 'warning';
  return 'critical';
}

function budgetStatus(current: number, previous: number): KpiStatus {
  const ratio = previous === 0 ? 1 : current / previous;
  if (ratio <= 1.05) return 'ok';
  if (ratio <= 1.15) return 'warning';
  return 'critical';
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ─── Custom Recharts components ───────────────────────────────────────────────

interface TooltipProps {
  active?:  boolean;
  payload?: Array<{ value: number; name: string; color: string }>;
  label?:   string;
}

function OccupationTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: '6px',
      padding: '8px 12px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
      fontFamily: 'var(--font-sans)',
    }}>
      <p style={{ margin: 0, fontSize: '11px', color: 'var(--color-text-secondary)', marginBottom: '2px' }}>{label}</p>
      <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--color-primary)' }}>
        {payload[0].value}%
      </p>
    </div>
  );
}

function BudgetTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: '6px',
      padding: '8px 12px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
      fontFamily: 'var(--font-sans)',
      minWidth: '120px',
    }}>
      <p style={{ margin: 0, fontSize: '11px', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: p.color }}>
          {p.name}: {p.value} k€
        </p>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Dashboard() {
  const { kpis, occupationMonths, budgetMonths, overdueProjects, loading, error } = useDashboardData();
  const gradientId = useId();

  // Derive KPI statuses
  const occupStatus   = occupationStatus(kpis.taux_occupation.current);
  const absentStatus  = absenteismeStatus(kpis.taux_absenteisme.current);
  const evenemStatus  = evenementsStatus(kpis.evenements_indesirables.current);
  const budgetSt      = budgetStatus(kpis.budget_realise.current, kpis.budget_realise.previous);

  // Build alerts list
  const alerts = useMemo<AlertItem[]>(() => {
    const list: AlertItem[] = [];
    if (absentStatus !== 'ok') {
      list.push({
        indicator: 'taux_absenteisme',
        value:     kpis.taux_absenteisme.current,
        threshold: absentStatus === 'warning' ? 8 : 12,
        severity:  absentStatus,
        unit:      '%',
      });
    }
    if (occupStatus !== 'ok') {
      list.push({
        indicator: 'taux_occupation',
        value:     kpis.taux_occupation.current,
        threshold: occupStatus === 'warning' ? 80 : 90,
        severity:  occupStatus,
        unit:      '%',
      });
    }
    if (evenemStatus !== 'ok') {
      list.push({
        indicator: 'evenements_indesirables',
        value:     kpis.evenements_indesirables.current,
        threshold: evenemStatus === 'warning' ? 3 : 6,
        severity:  evenemStatus,
        unit:      '',
      });
    }
    return list;
  }, [kpis, absentStatus, occupStatus, evenemStatus]);

  // ── Skeleton shimmer while loading ──
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
              height: '112px',
              borderRadius: '8px',
              background: 'var(--color-surface)',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
              borderLeft: '3px solid var(--color-border)',
            }} className="shimmer" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '24px',
      maxWidth: '1400px',
    }}>

      {/* ── A. Page header ── */}
      <div>
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: '24px',
          fontWeight: 700,
          color: 'var(--color-text-primary)',
          margin: 0,
          lineHeight: 1.2,
        }}>
          Tableau de bord
        </h1>
        <p style={{
          fontSize: '14px',
          color: 'var(--color-text-secondary)',
          margin: '4px 0 0',
          fontFamily: 'var(--font-sans)',
        }}>
          Vue d'ensemble de votre établissement
        </p>
      </div>

      {/* ── DB error warning ── */}
      {error && (
        <div role="alert" style={{
          backgroundColor: 'rgba(217,119,6,0.06)',
          border: '1px solid var(--color-warning)',
          borderRadius: '8px',
          padding: '10px 16px',
          fontSize: '13px',
          color: 'var(--color-warning)',
          fontFamily: 'var(--font-sans)',
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
        <KpiCard
          label="Taux d'occupation"
          value={kpis.taux_occupation.current.toFixed(1)}
          unit="%"
          status={occupStatus}
          icon={<BedDouble size={16} />}
          trend={{
            direction: trendDir(kpis.taux_occupation.current, kpis.taux_occupation.previous),
            value:     trendPct(kpis.taux_occupation.current, kpis.taux_occupation.previous),
            upIsGood:  true,
          }}
        />
        <KpiCard
          label="Budget réalisé"
          value={kpis.budget_realise.current.toString()}
          unit="k€"
          status={budgetSt}
          icon={<Euro size={16} />}
          trend={{
            direction: trendDir(kpis.budget_realise.current, kpis.budget_realise.previous),
            value:     trendPct(kpis.budget_realise.current, kpis.budget_realise.previous),
            upIsGood:  false,
          }}
        />
        <KpiCard
          label="Taux d'absentéisme"
          value={kpis.taux_absenteisme.current.toFixed(1)}
          unit="%"
          status={absentStatus}
          icon={<Users size={16} />}
          trend={{
            direction: trendDir(kpis.taux_absenteisme.current, kpis.taux_absenteisme.previous),
            value:     trendPct(kpis.taux_absenteisme.current, kpis.taux_absenteisme.previous),
            upIsGood:  false,
          }}
        />
        <KpiCard
          label="Événements indésirables"
          value={kpis.evenements_indesirables.current.toString()}
          status={evenemStatus}
          icon={<AlertTriangle size={16} />}
          trend={{
            direction: trendDir(kpis.evenements_indesirables.current, kpis.evenements_indesirables.previous),
            value:     trendPct(kpis.evenements_indesirables.current, kpis.evenements_indesirables.previous),
            upIsGood:  false,
          }}
        />
      </div>

      {/* ── D. Alerts banner (shown before charts for prominence) ── */}
      {alerts.length > 0 && <AlertBanner alerts={alerts} />}

      {/* ── C. Charts section ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
        gap: '16px',
      }}>

        {/* Occupation line chart */}
        <div style={{
          backgroundColor: 'var(--color-surface)',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          padding: '20px',
        }}>
          <h2 style={{
            fontFamily: 'var(--font-sans)',
            fontSize: '14px',
            fontWeight: 600,
            color: 'var(--color-text-primary)',
            margin: '0 0 4px',
          }}>
            Taux d'occupation
          </h2>
          <p style={{
            fontSize: '12px',
            color: 'var(--color-text-secondary)',
            margin: '0 0 16px',
          }}>
            Évolution sur 12 mois
          </p>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={occupationMonths} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#1E40AF" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#1E40AF" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: 'var(--color-text-secondary)', fontFamily: 'var(--font-sans)' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={[80, 100]}
                tick={{ fontSize: 11, fill: 'var(--color-text-secondary)', fontFamily: 'var(--font-sans)' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => `${v}%`}
              />
              <Tooltip content={<OccupationTooltip />} />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#1E40AF"
                strokeWidth={2}
                fill={`url(#${gradientId})`}
                dot={{ r: 3, fill: '#1E40AF', strokeWidth: 0 }}
                activeDot={{ r: 5, fill: '#1E40AF', stroke: '#fff', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Budget bar chart */}
        <div style={{
          backgroundColor: 'var(--color-surface)',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          padding: '20px',
        }}>
          <h2 style={{
            fontFamily: 'var(--font-sans)',
            fontSize: '14px',
            fontWeight: 600,
            color: 'var(--color-text-primary)',
            margin: '0 0 4px',
          }}>
            Budget
          </h2>
          <p style={{
            fontSize: '12px',
            color: 'var(--color-text-secondary)',
            margin: '0 0 16px',
          }}>
            Prévisionnel vs réalisé (k€)
          </p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={budgetMonths} margin={{ top: 4, right: 8, left: -20, bottom: 0 }} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: 'var(--color-text-secondary)', fontFamily: 'var(--font-sans)' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'var(--color-text-secondary)', fontFamily: 'var(--font-sans)' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<BudgetTooltip />} />
              <Legend
                verticalAlign="top"
                align="right"
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: '11px', fontFamily: 'var(--font-sans)', paddingBottom: '8px' }}
              />
              <Bar dataKey="prevu"   name="Prévisionnel" fill="#CBD5E1" radius={[3,3,0,0]} />
              <Bar dataKey="realise" name="Réalisé"       fill="#1E40AF" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── E. Overdue projects ── */}
      <div style={{
        backgroundColor: 'var(--color-surface)',
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        overflow: 'hidden',
      }}>
        {/* Section header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: overdueProjects.length > 0 ? '1px solid var(--color-border)' : 'none',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}>
          <CalendarX size={16} style={{ color: 'var(--color-danger)' }} />
          <h2 style={{
            fontFamily: 'var(--font-sans)',
            fontSize: '14px',
            fontWeight: 600,
            color: 'var(--color-text-primary)',
            margin: 0,
          }}>
            Projets en retard
          </h2>
          {overdueProjects.length > 0 && (
            <span style={{
              backgroundColor: 'var(--color-danger)',
              color: '#fff',
              fontSize: '11px',
              fontWeight: 700,
              borderRadius: '10px',
              padding: '1px 7px',
              lineHeight: '18px',
              fontFamily: 'var(--font-sans)',
            }}>
              {overdueProjects.length}
            </span>
          )}
        </div>

        {/* Project list or empty state */}
        {overdueProjects.length === 0 ? (
          <div style={{
            padding: '24px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
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
                style={{
                  padding: '12px 20px',
                  borderBottom: i < overdueProjects.length - 1 ? '1px solid var(--color-border)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  transition: 'background-color 0.15s ease',
                }}
              >
                {/* Status dot */}
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--color-danger)',
                  flexShrink: 0,
                }} />

                {/* Title + meta */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    margin: 0,
                    fontSize: '13px',
                    fontWeight: 600,
                    color: 'var(--color-text-primary)',
                    fontFamily: 'var(--font-sans)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {project.title}
                  </p>
                  <p style={{
                    margin: '2px 0 0',
                    fontSize: '12px',
                    color: 'var(--color-text-secondary)',
                    fontFamily: 'var(--font-sans)',
                  }}>
                    {project.owner_role}
                  </p>
                </div>

                {/* Due date */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  flexShrink: 0,
                }}>
                  <Clock size={12} style={{ color: 'var(--color-danger)' }} />
                  <span style={{
                    fontSize: '12px',
                    color: 'var(--color-danger)',
                    fontWeight: 500,
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
