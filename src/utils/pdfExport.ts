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

// ─── exportFamileoPdf ────────────────────────────────────────

import { readPhotoBytes } from './photoStorage';
import type { UIFamileoSection } from '@/pages/famileo/useFamileoData';

const MONTHS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

function bytesToDataUrl(bytes: Uint8Array, mime = 'image/jpeg'): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  return `data:${mime};base64,${btoa(binary)}`;
}

function mimeFromPath(path: string): string {
  const m = path.toLowerCase().match(/\.([a-z0-9]+)$/);
  const ext = m?.[1] ?? 'jpg';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  return 'image/jpeg';
}

function jsPdfFormat(mime: string): 'JPEG' | 'PNG' | 'WEBP' {
  if (mime === 'image/png') return 'PNG';
  if (mime === 'image/webp') return 'WEBP';
  return 'JPEG';
}

export interface ExportFamileoOptions {
  year: number;
  month: number;                     // 1-12
  cover: string;                     // intro text (optional)
  sections: UIFamileoSection[];      // already filtered (included=true) and sorted
}

export async function exportFamileoPdf(opts: ExportFamileoOptions): Promise<void> {
  const { year, month, cover, sections } = opts;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const PAGE_H = 297;

  // ── Cover page ──
  doc.setFillColor(124, 58, 237); // #7C3AED
  doc.rect(0, 0, PAGE_W, PAGE_H, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.text('FAMILEO · ANIMATION', PAGE_W / 2, 80, { align: 'center' });

  doc.setFontSize(36);
  doc.setFont('helvetica', 'bold');
  doc.text(`${MONTHS_FR[month - 1]} ${year}`, PAGE_W / 2, 120, { align: 'center' });

  if (cover.trim()) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(cover, CONTENT_W - 20);
    doc.text(lines, PAGE_W / 2, 150, { align: 'center' });
  }

  doc.setFont('helvetica', 'normal');

  // ── Sections ──
  for (const section of sections) {
    doc.addPage();
    let y = MARGIN;
    const { album, photos, text } = section;

    doc.setFillColor(124, 58, 237);
    doc.rect(0, y - 10, PAGE_W, 2, 'F');
    y += 4;

    doc.setTextColor(124, 58, 237);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(album.title, MARGIN, y);
    y += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLOR_MID);
    const metaParts = [album.activity_type, `${photos.length} photo${photos.length > 1 ? 's' : ''}`].filter(Boolean);
    if (metaParts.length) doc.text(metaParts.join(' · '), MARGIN, y);
    y += 8;

    // Photos: up to 4 in 2x2 grid
    if (photos.length > 0) {
      const cellW = (CONTENT_W - 5) / 2;
      const cellH = cellW * 0.75;
      const max = Math.min(photos.length, 4);
      for (let i = 0; i < max; i++) {
        const p = photos[i];
        const col = i % 2;
        const row = Math.floor(i / 2);
        const x = MARGIN + col * (cellW + 5);
        const yy = y + row * (cellH + 5);
        try {
          const path = p.file_path; // embed high-quality original
          const bytes = await readPhotoBytes(path);
          const mime = mimeFromPath(path);
          const dataUrl = bytesToDataUrl(bytes, mime);
          doc.addImage(dataUrl, jsPdfFormat(mime), x, yy, cellW, cellH, undefined, 'FAST');
        } catch (err) {
          doc.setDrawColor(200);
          doc.rect(x, yy, cellW, cellH);
        }
      }
      const rows = Math.ceil(max / 2);
      y += rows * (cellH + 5) + 4;
    }

    // Paragraph
    if (text.trim()) {
      doc.setTextColor(...COLOR_DARK);
      doc.setFontSize(11);
      const lines = doc.splitTextToSize(text, CONTENT_W);
      doc.text(lines, MARGIN, y);
    }
  }

  const filename = `famileo-${year}-${String(month).padStart(2, '0')}.pdf`;
  await savePdfWithTauri(doc, filename);
}
