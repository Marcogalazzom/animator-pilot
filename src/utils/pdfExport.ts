import { jsPDF } from 'jspdf';
import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';

async function savePdfWithTauri(doc: jsPDF, defaultFilename: string): Promise<void> {
  try {
    const filePath = await save({
      defaultPath: defaultFilename,
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    });
    if (!filePath) return;
    const arrayBuffer = doc.output('arraybuffer');
    await writeFile(filePath, new Uint8Array(arrayBuffer));
  } catch {
    doc.save(defaultFilename);
  }
}

import { getProjects, getSetting } from '@/db';
import { getUpcomingActivities, getActivityStats } from '@/db/activities';
import type { Project, Activity } from '@/db/types';

// ─── Constants ────────────────────────────────────────────────

const MARGIN = 20;
const PAGE_W = 210;
const CONTENT_W = PAGE_W - MARGIN * 2;

const COLOR_PRIMARY = [124, 58, 237] as const;  // #7C3AED (purple for animator)
const COLOR_DARK    = [15, 23, 42] as const;
const COLOR_MID     = [71, 85, 105] as const;

// ─── exportDashboardPdf ──────────────────────────────────────

export async function exportDashboardPdf(): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const etabName = await getSetting('etablissement_name').catch(() => null) ?? 'Mon EHPAD';
  const now = new Date();
  const dateStr = now.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

  let y = MARGIN;

  // Title
  doc.setFontSize(20);
  doc.setTextColor(...COLOR_PRIMARY);
  doc.text('Pilot Animateur', MARGIN, y);
  y += 8;

  doc.setFontSize(10);
  doc.setTextColor(...COLOR_MID);
  doc.text(`${etabName} — ${dateStr}`, MARGIN, y);
  y += 12;

  // Separator
  doc.setDrawColor(...COLOR_PRIMARY);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, y, MARGIN + CONTENT_W, y);
  y += 10;

  // Activity stats
  const stats = await getActivityStats().catch(() => ({
    thisMonth: 0, totalParticipants: 0, upcoming: 0, completedThisYear: 0,
  }));

  doc.setFontSize(14);
  doc.setTextColor(...COLOR_DARK);
  doc.text('Bilan Animation', MARGIN, y);
  y += 8;

  doc.setFontSize(10);
  doc.setTextColor(...COLOR_MID);
  doc.text(`Activités ce mois : ${stats.thisMonth}`, MARGIN, y); y += 5;
  doc.text(`Total participants (année) : ${stats.totalParticipants}`, MARGIN, y); y += 5;
  doc.text(`Activités à venir : ${stats.upcoming}`, MARGIN, y); y += 5;
  doc.text(`Activités réalisées (année) : ${stats.completedThisYear}`, MARGIN, y); y += 10;

  // Upcoming activities
  const upcoming = await getUpcomingActivities(10).catch(() => [] as Activity[]);
  if (upcoming.length > 0) {
    doc.setFontSize(14);
    doc.setTextColor(...COLOR_DARK);
    doc.text('Prochaines activités', MARGIN, y);
    y += 8;

    doc.setFontSize(9);
    for (const a of upcoming) {
      doc.setTextColor(...COLOR_DARK);
      doc.text(`• ${a.title}`, MARGIN, y);
      doc.setTextColor(...COLOR_MID);
      const dateInfo = new Date(a.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
      doc.text(` — ${dateInfo}${a.time_start ? ' à ' + a.time_start : ''} — ${a.location}`, MARGIN + 60, y);
      y += 5;
    }
    y += 5;
  }

  // Overdue projects
  const projects = await getProjects('overdue').catch(() => [] as Project[]);
  if (projects.length > 0) {
    doc.setFontSize(14);
    doc.setTextColor(...COLOR_DARK);
    doc.text('Projets en retard', MARGIN, y);
    y += 8;

    doc.setFontSize(9);
    for (const p of projects) {
      doc.setTextColor(...COLOR_DARK);
      doc.text(`• ${p.title}`, MARGIN, y);
      doc.setTextColor(...COLOR_MID);
      doc.text(` — ${p.owner_role}`, MARGIN + 80, y);
      y += 5;
    }
  }

  const filename = `pilot-animateur-${now.toISOString().slice(0, 10)}.pdf`;
  await savePdfWithTauri(doc, filename);
}

// Alias for Dashboard export button compatibility
export async function exportMonthlyReport(): Promise<void> {
  return exportDashboardPdf();
}
