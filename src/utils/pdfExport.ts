import { jsPDF } from 'jspdf';
import { getKpiEntries, getProjects, getSetting, getObligations, getBudgetSummary, getAnapIndicators } from '@/db';
import { getUpcomingEvents } from '@/db/tutelles';
import {
  MOCK_KPIS,
  MOCK_OVERDUE_PROJECTS,
} from '@/pages/dashboard/useDashboardData';
import type { KpiEntry, Project, ComplianceObligation, AnapIndicator } from '@/db/types';
import type { UpcomingEventWithPrep } from '@/db/tutelles';

// ─── Constants ────────────────────────────────────────────────────────────────

const MARGIN = 20;        // mm
const PAGE_W = 210;       // A4 width mm
const PAGE_H = 297;       // A4 height mm
const CONTENT_W = PAGE_W - MARGIN * 2;

// Brand colours (as RGB)
const COLOR_PRIMARY   = [30,  64, 175] as const;  // #1E40AF
const COLOR_DARK      = [15,  23,  42] as const;  // #0F172A
const COLOR_MID       = [71,  85, 105] as const;  // #475569
const COLOR_LIGHT     = [148,163,184] as const;   // #94A3B8
const COLOR_BG_HEADER = [239,246,255] as const;   // very light blue
const COLOR_DANGER    = [220,  38,  38] as const; // #DC2626
const COLOR_WARNING   = [217, 119,   6] as const; // #D97706
const COLOR_OK        = [22, 163,  74] as const;  // #16A34A
const COLOR_WHITE     = [255,255,255] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function setRgb(doc: jsPDF, mode: 'draw' | 'fill' | 'text', rgb: readonly [number, number, number]) {
  if (mode === 'draw') doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
  else if (mode === 'fill') doc.setFillColor(rgb[0], rgb[1], rgb[2]);
  else doc.setTextColor(rgb[0], rgb[1], rgb[2]);
}

function formatDateFr(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

function formatTodayFr(): string {
  return new Date().toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
}

function trendPct(current: number, previous: number): string {
  if (previous === 0) return '0 %';
  const delta = ((current - previous) / previous) * 100;
  return (delta > 0 ? '+' : '') + delta.toFixed(1) + ' %';
}

type KpiStatus = 'ok' | 'warning' | 'critical';

function kpiStatusLabel(status: KpiStatus): string {
  if (status === 'ok')       return '+ OK';
  if (status === 'warning')  return '! Attention';
  return 'x Critique';
}

function kpiStatusColor(status: KpiStatus): readonly [number, number, number] {
  if (status === 'ok')       return COLOR_OK;
  if (status === 'warning')  return COLOR_WARNING;
  return COLOR_DANGER;
}

function occupationStatus(v: number): KpiStatus {
  return v >= 90 ? 'ok' : v >= 80 ? 'warning' : 'critical';
}
function absenteismeStatus(v: number): KpiStatus {
  return v <= 8 ? 'ok' : v <= 12 ? 'warning' : 'critical';
}
function evenementsStatus(v: number): KpiStatus {
  return v <= 3 ? 'ok' : v <= 6 ? 'warning' : 'critical';
}
function budgetStatus(current: number, previous: number): KpiStatus {
  const ratio = previous === 0 ? 1 : current / previous;
  return ratio <= 1.05 ? 'ok' : ratio <= 1.15 ? 'warning' : 'critical';
}

// ─── Drawing primitives ───────────────────────────────────────────────────────

/** Draw page header band (called on each page) */
function drawPageHeader(doc: jsPDF, establishmentName: string, pageNum: number, totalPages: number) {
  // Blue top band
  setRgb(doc, 'fill', COLOR_PRIMARY);
  doc.rect(0, 0, PAGE_W, 14, 'F');

  // Establishment name (left, white)
  setRgb(doc, 'text', COLOR_WHITE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(establishmentName.toUpperCase(), MARGIN, 9);

  // Page number (right, white)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`Page ${pageNum} / ${totalPages}`, PAGE_W - MARGIN, 9, { align: 'right' });
}

/** Draw page footer */
function drawPageFooter(doc: jsPDF, exportDate: string) {
  const y = PAGE_H - 8;
  setRgb(doc, 'draw', COLOR_LIGHT);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, y - 3, PAGE_W - MARGIN, y - 3);

  setRgb(doc, 'text', COLOR_LIGHT);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.text(`Rapport généré le ${exportDate} — EHPADConnect`, MARGIN, y);
  doc.text('Confidentiel', PAGE_W - MARGIN, y, { align: 'right' });
}

/** Draw a section title */
function drawSectionTitle(doc: jsPDF, title: string, y: number): number {
  setRgb(doc, 'fill', COLOR_BG_HEADER);
  doc.rect(MARGIN, y, CONTENT_W, 7, 'F');

  setRgb(doc, 'draw', COLOR_PRIMARY);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, y, MARGIN, y + 7);

  setRgb(doc, 'text', COLOR_PRIMARY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(title.toUpperCase(), MARGIN + 3, y + 5);

  return y + 7 + 5; // returns next Y position (section + gap)
}

/** Draw the 4 KPI cards in a 2x2 grid */
function drawKpiGrid(doc: jsPDF, kpis: KpiBlock[], startY: number): number {
  const cardW = (CONTENT_W - 6) / 2;   // gap of 6 mm
  const cardH = 28;
  const colX = [MARGIN, MARGIN + cardW + 6];

  let maxY = startY;

  kpis.forEach((kpi, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = colX[col];
    const y = startY + row * (cardH + 5);

    // Card background
    setRgb(doc, 'fill', COLOR_WHITE);
    setRgb(doc, 'draw', COLOR_LIGHT);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y, cardW, cardH, 2, 2, 'FD');

    // Left status bar
    setRgb(doc, 'fill', kpiStatusColor(kpi.status));
    doc.rect(x, y, 2.5, cardH, 'F');

    // Label
    setRgb(doc, 'text', COLOR_MID);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(kpi.label, x + 6, y + 6);

    // Value
    setRgb(doc, 'text', COLOR_DARK);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text(kpi.value, x + 6, y + 17);

    // Unit (smaller, next to value)
    if (kpi.unit) {
      const valW = doc.getTextWidth(kpi.value);
      setRgb(doc, 'text', COLOR_MID);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(kpi.unit, x + 6 + valW + 1, y + 17);
    }

    // Trend
    setRgb(doc, 'text', COLOR_MID);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(`Mois précédent : ${kpi.trend}`, x + 6, y + 22);

    // Status badge
    const statusColor = kpiStatusColor(kpi.status);
    setRgb(doc, 'fill', statusColor);
    doc.roundedRect(x + cardW - 28, y + 18, 25, 5.5, 1.5, 1.5, 'F');
    setRgb(doc, 'text', COLOR_WHITE);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.text(kpiStatusLabel(kpi.status), x + cardW - 15.5, y + 22, { align: 'center' });

    maxY = Math.max(maxY, y + cardH);
  });

  return maxY + 8;
}

interface KpiBlock {
  label: string;
  value: string;
  unit: string;
  trend: string;
  status: KpiStatus;
}

/** Draw a simple table with header + rows */
function drawTable(
  doc: jsPDF,
  headers: string[],
  rows: string[][],
  colWidths: number[],
  startY: number,
  rowH = 7,
): number {
  const x0 = MARGIN;
  let y = startY;

  // Header row
  setRgb(doc, 'fill', COLOR_PRIMARY);
  doc.rect(x0, y, CONTENT_W, rowH, 'F');
  setRgb(doc, 'text', COLOR_WHITE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);

  let cx = x0 + 2;
  headers.forEach((h, i) => {
    doc.text(h, cx, y + 5);
    cx += colWidths[i];
  });
  y += rowH;

  // Data rows
  rows.forEach((row, ri) => {
    // Alternating row fill
    if (ri % 2 === 0) {
      setRgb(doc, 'fill', [248, 250, 252]);
      doc.rect(x0, y, CONTENT_W, rowH, 'F');
    }

    // Row border
    setRgb(doc, 'draw', COLOR_LIGHT);
    doc.setLineWidth(0.2);
    doc.rect(x0, y, CONTENT_W, rowH, 'S');

    setRgb(doc, 'text', COLOR_DARK);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);

    cx = x0 + 2;
    row.forEach((cell, i) => {
      const maxW = colWidths[i] - 3;
      const lines = doc.splitTextToSize(cell, maxW) as string[];
      doc.text(lines[0] ?? '', cx, y + 5);
      cx += colWidths[i];
    });

    y += rowH;
  });

  return y + 4;
}

// ─── Main export function ─────────────────────────────────────────────────────

export async function exportDashboardPdf(): Promise<void> {
  // ── 1. Fetch data ──────────────────────────────────────────────────────────
  const [dbEntries, dbProjects, rawName] = await Promise.all([
    getKpiEntries().catch(() => [] as KpiEntry[]),
    getProjects('overdue').catch(() => [] as Project[]),
    getSetting('establishment_name').catch(() => null),
  ]);

  const establishmentName = rawName ?? 'Mon EHPAD';
  const exportDate = formatTodayFr();

  // Resolve KPIs: use DB data if available, else mock
  let kpiValues = MOCK_KPIS;

  if (dbEntries.length > 0) {
    const byIndicator = new Map<string, KpiEntry[]>();
    for (const e of dbEntries) {
      const list = byIndicator.get(e.indicator) ?? [];
      list.push(e);
      byIndicator.set(e.indicator, list);
    }
    const pick = (ind: string) =>
      (byIndicator.get(ind) ?? []).sort((a, b) => b.period.localeCompare(a.period))[0]?.value ?? 0;
    const pickPrev = (ind: string) => {
      const sorted = (byIndicator.get(ind) ?? []).sort((a, b) => b.period.localeCompare(a.period));
      return sorted[1]?.value ?? sorted[0]?.value ?? 0;
    };
    kpiValues = {
      taux_occupation:        { current: pick('taux_occupation'),        previous: pickPrev('taux_occupation') },
      budget_realise:         { current: pick('budget_realise'),         previous: pickPrev('budget_realise') },
      taux_absenteisme:       { current: pick('taux_absenteisme'),       previous: pickPrev('taux_absenteisme') },
      evenements_indesirables:{ current: pick('evenements_indesirables'),previous: pickPrev('evenements_indesirables') },
    };
  }

  const overdueProjects = dbProjects.length > 0 ? dbProjects : MOCK_OVERDUE_PROJECTS;

  // KPI entries for detail table (recent 10)
  const recentEntries = dbEntries
    .sort((a, b) => b.period.localeCompare(a.period))
    .slice(0, 10);

  const hasDetailPage = recentEntries.length > 0 || overdueProjects.length > 0;
  const totalPages = hasDetailPage ? 2 : 1;

  // ── 2. Build jsPDF document ────────────────────────────────────────────────
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  // ── PAGE 1: Dashboard Summary ──────────────────────────────────────────────
  drawPageHeader(doc, establishmentName, 1, totalPages);
  drawPageFooter(doc, exportDate);

  let y = 22; // below header band

  // ── Report title
  setRgb(doc, 'text', COLOR_DARK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('Rapport de pilotage', MARGIN, y);
  y += 7;

  setRgb(doc, 'text', COLOR_PRIMARY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(establishmentName, MARGIN, y);
  y += 5;

  setRgb(doc, 'text', COLOR_MID);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Date d'export : ${exportDate}`, MARGIN, y);
  y += 3;

  // Separator line
  setRgb(doc, 'draw', COLOR_LIGHT);
  doc.setLineWidth(0.4);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 8;

  // ── KPI Summary section
  y = drawSectionTitle(doc, 'Indicateurs clés de performance', y);

  const kpiBlocks: KpiBlock[] = [
    {
      label:  "Taux d'occupation",
      value:  kpiValues.taux_occupation.current.toFixed(1),
      unit:   '%',
      trend:  trendPct(kpiValues.taux_occupation.current, kpiValues.taux_occupation.previous),
      status: occupationStatus(kpiValues.taux_occupation.current),
    },
    {
      label:  'Budget réalisé',
      value:  kpiValues.budget_realise.current.toString(),
      unit:   'k€',
      trend:  trendPct(kpiValues.budget_realise.current, kpiValues.budget_realise.previous),
      status: budgetStatus(kpiValues.budget_realise.current, kpiValues.budget_realise.previous),
    },
    {
      label:  "Taux d'absentéisme",
      value:  kpiValues.taux_absenteisme.current.toFixed(1),
      unit:   '%',
      trend:  trendPct(kpiValues.taux_absenteisme.current, kpiValues.taux_absenteisme.previous),
      status: absenteismeStatus(kpiValues.taux_absenteisme.current),
    },
    {
      label:  'Evénements indésirables',
      value:  kpiValues.evenements_indesirables.current.toString(),
      unit:   '',
      trend:  trendPct(kpiValues.evenements_indesirables.current, kpiValues.evenements_indesirables.previous),
      status: evenementsStatus(kpiValues.evenements_indesirables.current),
    },
  ];

  y = drawKpiGrid(doc, kpiBlocks, y);

  // ── Summary note
  const alertCount = kpiBlocks.filter(k => k.status !== 'ok').length;
  if (alertCount > 0) {
    setRgb(doc, 'fill', [255, 247, 237]);
    setRgb(doc, 'draw', COLOR_WARNING);
    doc.setLineWidth(0.3);
    doc.roundedRect(MARGIN, y, CONTENT_W, 12, 2, 2, 'FD');
    setRgb(doc, 'text', [146, 64, 14]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text(
      `Attention : ${alertCount} indicateur${alertCount > 1 ? 's' : ''} nécessite${alertCount > 1 ? 'nt' : ''} votre attention.`,
      MARGIN + 4,
      y + 5,
    );
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    setRgb(doc, 'text', COLOR_MID);
    doc.text('Consultez la page Indicateurs pour plus de détails.', MARGIN + 4, y + 9.5);
    y += 18;
  } else {
    setRgb(doc, 'fill', [240, 253, 244]);
    setRgb(doc, 'draw', COLOR_OK);
    doc.setLineWidth(0.3);
    doc.roundedRect(MARGIN, y, CONTENT_W, 8, 2, 2, 'FD');
    setRgb(doc, 'text', [21, 128, 61]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text('Tous les indicateurs sont dans les seuils acceptables.', MARGIN + 4, y + 5.5);
    y += 14;
  }

  // ── Overdue projects summary on page 1
  y = drawSectionTitle(doc, 'Projets en retard', y);

  if (overdueProjects.length === 0) {
    setRgb(doc, 'text', COLOR_MID);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.text('Aucun projet en retard.', MARGIN + 3, y + 2);
    y += 10;
  } else {
    const overdueRows = overdueProjects.map(p => [
      p.title,
      p.owner_role,
      formatDateFr(p.due_date),
    ]);
    const colWidths = [95, 55, 20];
    y = drawTable(
      doc,
      ['Titre du projet', 'Responsable', 'Echéance'],
      overdueRows,
      colWidths,
      y,
    );
  }

  // ── PAGE 2: Detail (if applicable) ────────────────────────────────────────
  if (hasDetailPage) {
    doc.addPage();
    drawPageHeader(doc, establishmentName, 2, totalPages);
    drawPageFooter(doc, exportDate);

    y = 22;

    // Sub-title
    setRgb(doc, 'text', COLOR_DARK);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('Détails — Historique des indicateurs', MARGIN, y);
    y += 10;

    if (recentEntries.length > 0) {
      y = drawSectionTitle(doc, 'Dernières saisies de KPI', y);
      const kpiRows = recentEntries.map(e => [
        e.indicator.replace(/_/g, ' '),
        e.period,
        e.value.toString(),
        e.category,
        e.source,
      ]);
      const colWidths2 = [62, 28, 20, 28, 32];
      y = drawTable(
        doc,
        ['Indicateur', 'Période', 'Valeur', 'Catégorie', 'Source'],
        kpiRows,
        colWidths2,
        y,
      );
      y += 5;
    }

    if (overdueProjects.length > 0) {
      y = drawSectionTitle(doc, 'Détail des projets en retard', y);
      const projRows = overdueProjects.map(p => [
        p.title,
        p.owner_role,
        formatDateFr(p.start_date),
        formatDateFr(p.due_date),
      ]);
      const colWidths3 = [80, 50, 25, 15];
      y = drawTable(
        doc,
        ['Titre', 'Responsable', 'Début', 'Echéance'],
        projRows,
        colWidths3,
        y,
      );
    }
  }

  // ── 3. Save the file ───────────────────────────────────────────────────────
  const filename = `rapport-pilotage-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}

// ─── Monthly report ───────────────────────────────────────────────────────────

const MONTH_FR_LONG = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

const COLOR_PURPLE = [147, 51, 234] as const;

function currentMonthLabel(): string {
  const now = new Date();
  return `${MONTH_FR_LONG[now.getMonth()]} ${now.getFullYear()}`;
}

function statusLabel(status: string): string {
  switch (status) {
    case 'compliant':     return 'Conforme';
    case 'in_progress':   return 'En cours';
    case 'non_compliant': return 'Non conforme';
    case 'to_plan':       return 'À planifier';
    default:              return status;
  }
}

function projectStatusLabel(status: string): string {
  switch (status) {
    case 'todo':        return 'À faire';
    case 'in_progress': return 'En cours';
    case 'done':        return 'Terminé';
    case 'overdue':     return 'En retard';
    default:            return status;
  }
}

export async function exportMonthlyReport(): Promise<void> {
  // ── 1. Fetch all data ──────────────────────────────────────────────────────
  const currentYear = new Date().getFullYear();

  const [
    rawName,
    dbEntries,
    dbProjects,
    dbObligations,
    dbBudgetSummary,
    dbUpcomingEvents,
    dbAnapIndicators,
  ] = await Promise.all([
    getSetting('establishment_name').catch(() => null),
    getKpiEntries().catch(() => [] as KpiEntry[]),
    getProjects().catch(() => [] as Project[]),
    getObligations().catch(() => [] as ComplianceObligation[]),
    getBudgetSummary(currentYear).catch(() => [] as Awaited<ReturnType<typeof getBudgetSummary>>),
    getUpcomingEvents(90).catch(() => [] as UpcomingEventWithPrep[]),
    getAnapIndicators(currentYear).catch(() => [] as AnapIndicator[]),
  ]);

  const establishmentName = rawName ?? 'Mon EHPAD';
  const exportDate = formatTodayFr();
  const monthLabel = currentMonthLabel();

  // ── KPI resolution ─────────────────────────────────────────────────────────
  let kpiValues = MOCK_KPIS;
  if (dbEntries.length > 0) {
    const byInd = new Map<string, KpiEntry[]>();
    for (const e of dbEntries) {
      const l = byInd.get(e.indicator) ?? [];
      l.push(e);
      byInd.set(e.indicator, l);
    }
    const pick = (ind: string) =>
      (byInd.get(ind) ?? []).sort((a, b) => b.period.localeCompare(a.period))[0]?.value ?? 0;
    const pickPrev = (ind: string) => {
      const s = (byInd.get(ind) ?? []).sort((a, b) => b.period.localeCompare(a.period));
      return s[1]?.value ?? s[0]?.value ?? 0;
    };
    kpiValues = {
      taux_occupation:         { current: pick('taux_occupation'),         previous: pickPrev('taux_occupation') },
      budget_realise:          { current: pick('budget_realise'),          previous: pickPrev('budget_realise') },
      taux_absenteisme:        { current: pick('taux_absenteisme'),        previous: pickPrev('taux_absenteisme') },
      evenements_indesirables: { current: pick('evenements_indesirables'), previous: pickPrev('evenements_indesirables') },
    };
  }

  const kpiBlocks: KpiBlock[] = [
    {
      label:  "Taux d'occupation",
      value:  kpiValues.taux_occupation.current.toFixed(1),
      unit:   '%',
      trend:  trendPct(kpiValues.taux_occupation.current, kpiValues.taux_occupation.previous),
      status: occupationStatus(kpiValues.taux_occupation.current),
    },
    {
      label:  'Budget réalisé',
      value:  kpiValues.budget_realise.current.toString(),
      unit:   'k€',
      trend:  trendPct(kpiValues.budget_realise.current, kpiValues.budget_realise.previous),
      status: budgetStatus(kpiValues.budget_realise.current, kpiValues.budget_realise.previous),
    },
    {
      label:  "Taux d'absentéisme",
      value:  kpiValues.taux_absenteisme.current.toFixed(1),
      unit:   '%',
      trend:  trendPct(kpiValues.taux_absenteisme.current, kpiValues.taux_absenteisme.previous),
      status: absenteismeStatus(kpiValues.taux_absenteisme.current),
    },
    {
      label:  'Evénements indésirables',
      value:  kpiValues.evenements_indesirables.current.toString(),
      unit:   '',
      trend:  trendPct(kpiValues.evenements_indesirables.current, kpiValues.evenements_indesirables.previous),
      status: evenementsStatus(kpiValues.evenements_indesirables.current),
    },
  ];

  // ── Prepare data ───────────────────────────────────────────────────────────
  const activeProjects = (dbProjects.length > 0 ? dbProjects : MOCK_OVERDUE_PROJECTS)
    .filter(p => p.status !== 'done')
    .slice(0, 20);

  const topObligations = (dbObligations.length > 0 ? dbObligations : [])
    .filter(o => o.status !== 'compliant')
    .sort((a, b) => {
      if (!a.next_due_date) return 1;
      if (!b.next_due_date) return -1;
      return a.next_due_date.localeCompare(b.next_due_date);
    })
    .slice(0, 15);

  const upcomingIn90 = dbUpcomingEvents.slice(0, 10);

  const topAnap = (dbAnapIndicators.length > 0 ? dbAnapIndicators : []).slice(0, 12);

  const totalPages = 3;

  // ── 2. Build document ──────────────────────────────────────────────────────
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  // ══════════════════════════════════════════════════════════════════════════
  // PAGE 1 — KPIs + Budget
  // ══════════════════════════════════════════════════════════════════════════
  drawPageHeader(doc, establishmentName, 1, totalPages);
  drawPageFooter(doc, exportDate);

  let y = 22;

  // Report title
  setRgb(doc, 'text', COLOR_DARK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Rapport mensuel', MARGIN, y);
  y += 7;

  setRgb(doc, 'text', COLOR_PRIMARY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(`${establishmentName} — ${monthLabel}`, MARGIN, y);
  y += 5;

  setRgb(doc, 'text', COLOR_MID);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(`Généré le ${exportDate}`, MARGIN, y);
  y += 3;

  setRgb(doc, 'draw', COLOR_LIGHT);
  doc.setLineWidth(0.4);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 8;

  // KPI section
  y = drawSectionTitle(doc, 'Indicateurs clés de performance', y);
  y = drawKpiGrid(doc, kpiBlocks, y);

  // Budget synthesis
  y = drawSectionTitle(doc, `Synthèse budgétaire — ${currentYear}`, y);

  if (dbBudgetSummary.length > 0) {
    const budgetRows = dbBudgetSummary.map(s => {
      const chargesR = s.totalChargesRealise;
      const produitsR = s.totalProduitsRealise;
      const resultat = produitsR - chargesR;
      return [
        s.section,
        chargesR > 0 ? `${chargesR.toLocaleString('fr-FR')} €` : '—',
        produitsR > 0 ? `${produitsR.toLocaleString('fr-FR')} €` : '—',
        (resultat >= 0 ? '+' : '') + `${resultat.toLocaleString('fr-FR')} €`,
      ];
    });
    const budgetCols = [75, 35, 35, 25];
    y = drawTable(
      doc,
      ['Section', 'Charges réalisées', 'Produits réalisés', 'Résultat'],
      budgetRows,
      budgetCols,
      y,
    );
  } else {
    // Mock budget summary
    const mockBudgetRows = [
      ['Section soins', '1 250 000 €', '1 280 000 €', '+30 000 €'],
      ['Section hébergement', '890 000 €', '920 000 €', '+30 000 €'],
      ['Section dépendance', '650 000 €', '680 000 €', '+30 000 €'],
    ];
    const budgetCols = [75, 35, 35, 25];
    y = drawTable(
      doc,
      ['Section', 'Charges réalisées', 'Produits réalisés', 'Résultat'],
      mockBudgetRows,
      budgetCols,
      y,
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PAGE 2 — Conformité + Tutelles
  // ══════════════════════════════════════════════════════════════════════════
  doc.addPage();
  drawPageHeader(doc, establishmentName, 2, totalPages);
  drawPageFooter(doc, exportDate);

  y = 22;

  setRgb(doc, 'text', COLOR_DARK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('Conformité & Tutelles', MARGIN, y);
  y += 10;

  // Compliance table
  y = drawSectionTitle(doc, 'Obligations de conformité (top 15 non conformes)', y);

  if (topObligations.length > 0) {
    const complianceRows = topObligations.map(o => [
      o.title.length > 48 ? o.title.slice(0, 48) + '…' : o.title,
      statusLabel(o.status),
      formatDateFr(o.next_due_date),
    ]);
    const complianceCols = [100, 35, 35];
    y = drawTable(
      doc,
      ['Obligation', 'Statut', 'Prochaine échéance'],
      complianceRows,
      complianceCols,
      y,
    );
  } else {
    // Mock compliance rows
    const mockCompRows = [
      ['Renouvellement document incendie', 'En cours', '15/04/2026'],
      ['Évaluation risque professionnel', 'Non conforme', '01/05/2026'],
      ['Rapport activité trimestriel', 'À planifier', '30/06/2026'],
      ['Mise à jour procédure urgence', 'En cours', '15/07/2026'],
    ];
    y = drawTable(
      doc,
      ['Obligation', 'Statut', 'Prochaine échéance'],
      mockCompRows,
      [100, 35, 35],
      y,
    );
  }

  y += 4;

  // Tutelles events coming in next 90 days
  y = drawSectionTitle(doc, 'Événements tutelles — 90 prochains jours', y);

  if (upcomingIn90.length > 0) {
    const AUTHORITY_LABELS_PDF: Record<string, string> = {
      ars: 'ARS', cd: 'Conseil Dép.', has: 'HAS',
      prefecture: 'Préfecture', other: 'Autre',
    };
    const EVENT_TYPE_LABELS_PDF: Record<string, string> = {
      cpom: 'CPOM', budget_campaign: 'Budget', evaluation: 'Évaluation',
      inspection: 'Inspection', commission: 'Commission', dialogue: 'Dialogue', other: 'Autre',
    };
    const eventRows = upcomingIn90.map(e => [
      e.title.length > 50 ? e.title.slice(0, 50) + '…' : e.title,
      AUTHORITY_LABELS_PDF[e.authority] ?? e.authority,
      EVENT_TYPE_LABELS_PDF[e.event_type] ?? e.event_type,
      formatDateFr(e.date_start),
    ]);
    const eventCols = [85, 25, 30, 30];
    y = drawTable(
      doc,
      ['Titre', 'Autorité', 'Type', 'Date'],
      eventRows,
      eventCols,
      y,
    );
  } else {
    // Mock event rows
    const mockEventRows = [
      ['Visite HAS — Évaluation externe', 'HAS', 'Évaluation', formatDateFr(new Date(Date.now() + 12 * 86400000).toISOString())],
      ['Dialogue de gestion ARS', 'ARS', 'Dialogue', formatDateFr(new Date(Date.now() + 28 * 86400000).toISOString())],
    ];
    y = drawTable(
      doc,
      ['Titre', 'Autorité', 'Type', 'Date'],
      mockEventRows,
      [85, 25, 30, 30],
      y,
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PAGE 3 — Projets + ANAP
  // ══════════════════════════════════════════════════════════════════════════
  doc.addPage();
  drawPageHeader(doc, establishmentName, 3, totalPages);
  drawPageFooter(doc, exportDate);

  y = 22;

  setRgb(doc, 'text', COLOR_DARK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('Projets & Benchmarking ANAP', MARGIN, y);
  y += 10;

  // Active/overdue projects
  y = drawSectionTitle(doc, 'Projets actifs et en retard', y);

  if (activeProjects.length > 0) {
    const projectRows = activeProjects.map(p => [
      p.title.length > 52 ? p.title.slice(0, 52) + '…' : p.title,
      p.owner_role.length > 22 ? p.owner_role.slice(0, 22) + '…' : p.owner_role,
      projectStatusLabel(p.status),
      formatDateFr(p.due_date),
    ]);
    const projectCols = [85, 40, 25, 20];
    y = drawTable(
      doc,
      ['Titre', 'Responsable', 'Statut', 'Échéance'],
      projectRows,
      projectCols,
      y,
    );
  } else {
    setRgb(doc, 'text', COLOR_MID);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.text('Aucun projet actif ou en retard.', MARGIN + 3, y + 2);
    y += 10;
  }

  y += 4;

  // ANAP positioning table
  y = drawSectionTitle(doc, `Positionnement ANAP — ${currentYear}`, y);

  if (topAnap.length > 0) {
    const anapRows = topAnap.map(ind => {
      const etab = ind.value_etablissement !== null ? `${ind.value_etablissement} ${ind.unit}` : '—';
      const nat  = ind.value_national !== null ? `${ind.value_national} ${ind.unit}` : '—';
      let ecart = '—';
      if (ind.value_etablissement !== null && ind.value_national !== null) {
        const diff = ind.value_etablissement - ind.value_national;
        ecart = (diff >= 0 ? '+' : '') + diff.toFixed(1) + ' ' + ind.unit;
      }
      return [
        ind.label.length > 60 ? ind.label.slice(0, 60) + '…' : ind.label,
        etab,
        nat,
        ecart,
      ];
    });
    const anapCols = [90, 30, 30, 20];
    y = drawTable(
      doc,
      ['Indicateur', 'Établissement', 'National', 'Écart'],
      anapRows,
      anapCols,
      y,
    );
  } else {
    setRgb(doc, 'text', COLOR_MID);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.text('Aucune donnée ANAP disponible pour cet exercice.', MARGIN + 3, y + 2);
    y += 10;
  }

  // ANAP legend note
  if (y < PAGE_H - 30) {
    y += 4;
    setRgb(doc, 'fill', [248, 250, 252]);
    setRgb(doc, 'draw', COLOR_LIGHT);
    doc.setLineWidth(0.3);
    doc.roundedRect(MARGIN, y, CONTENT_W, 10, 2, 2, 'FD');
    setRgb(doc, 'text', COLOR_MID);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.text(
      `Source : données ANAP — exercice ${currentYear}. Un écart positif indique une performance supérieure à la moyenne nationale.`,
      MARGIN + 3,
      y + 4,
    );
    doc.text(
      'Ce rapport est généré automatiquement. Pour plus de détails, consultez le module ANAP de l\'application.',
      MARGIN + 3,
      y + 8,
    );
  }

  // ── 3. Save the file ───────────────────────────────────────────────────────
  // Suppress unused variable warning for COLOR_PURPLE - it's available for future use
  void COLOR_PURPLE;

  const filename = `rapport-mensuel-${new Date().toISOString().slice(0, 7)}.pdf`;
  doc.save(filename);
}
