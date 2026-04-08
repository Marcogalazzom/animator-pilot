import {
  getKpiEntries,
  getAlertRules,
  createAlert,
  alertExistsToday,
  getObligations,
  getProjects,
} from '@/db';
import type { AlertModule, AlertSeverity } from '@/db';
import { getDb } from '@/db/database';
import type { AuthorityEvent } from '@/db/types';

async function getAuthorityEvents(): Promise<AuthorityEvent[]> {
  const db = await getDb();
  return db.select<AuthorityEvent[]>(
    "SELECT * FROM authority_events WHERE status != 'cancelled' ORDER BY date_start",
    []
  );
}

async function getBudgetLinesRaw(): Promise<
  { section_id: number; amount_previsionnel: number; amount_realise: number; line_label: string }[]
> {
  const db = await getDb();
  return db.select(
    'SELECT section_id, line_label, amount_previsionnel, amount_realise FROM budget_lines',
    []
  );
}

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export async function evaluateAlerts(): Promise<void> {
  const rules = await getAlertRules(true);

  for (const rule of rules) {
    switch (rule.rule_type) {
      case 'kpi_threshold': {
        if (!rule.target_indicator) break;
        const entries = await getKpiEntries();
        // Get the latest entry for the target indicator
        const matching = entries
          .filter((e) => e.indicator === rule.target_indicator)
          .sort((a, b) => b.period.localeCompare(a.period));
        if (matching.length === 0) break;
        const latest = matching[0];
        const value = latest.value;
        const threshold = rule.condition_value;
        let crossed = false;
        switch (rule.condition_operator) {
          case '>': crossed = value > threshold; break;
          case '>=': crossed = value >= threshold; break;
          case '<': crossed = value < threshold; break;
          case '<=': crossed = value <= threshold; break;
          case '=':
          case '==': crossed = value === threshold; break;
          default: crossed = false;
        }
        if (!crossed) break;
        const title = rule.message_template.replace('{indicator}', rule.target_indicator).replace('{value}', String(value));
        const alreadyExists = await alertExistsToday('kpi' as AlertModule, title);
        if (alreadyExists) break;
        const severity: AlertSeverity = value >= threshold * 1.2 || value <= threshold * 0.8 ? 'critical' : 'warning';
        await createAlert({
          rule_id: rule.id,
          module: 'kpi',
          severity,
          title,
          message: `Valeur actuelle : ${value} (seuil : ${rule.condition_operator} ${threshold})`,
          link_path: '/kpi',
          link_entity_id: null,
          is_read: 0,
        });
        break;
      }

      case 'deadline': {
        const daysThreshold = rule.condition_value;

        if (rule.module === 'compliance') {
          const obligations = await getObligations();
          for (const obl of obligations) {
            if (!obl.next_due_date) continue;
            if (obl.status === 'compliant') continue;
            const days = daysUntil(obl.next_due_date);
            if (days < 0 || days > daysThreshold) continue;
            const title = `Échéance conformité : ${obl.title}`;
            const already = await alertExistsToday('compliance', title);
            if (already) continue;
            const severity: AlertSeverity = days <= 7 ? 'critical' : days <= 30 ? 'warning' : 'info';
            await createAlert({
              rule_id: rule.id,
              module: 'compliance',
              severity,
              title,
              message: days === 0 ? "Échéance aujourd'hui" : days < 0 ? `Échéance dépassée de ${Math.abs(days)} j` : `Échéance dans ${days} jour(s)`,
              link_path: '/compliance',
              link_entity_id: obl.id,
              is_read: 0,
            });
          }
        }

        if (rule.module === 'tutelles') {
          const events = await getAuthorityEvents();
          for (const ev of events) {
            if (!ev.date_start) continue;
            if (ev.status === 'completed' || ev.status === 'cancelled') continue;
            const days = daysUntil(ev.date_start);
            if (days < 0 || days > daysThreshold) continue;
            const title = `Événement tutelle : ${ev.title}`;
            const already = await alertExistsToday('tutelles', title);
            if (already) continue;
            const severity: AlertSeverity = days <= 7 ? 'critical' : days <= 30 ? 'warning' : 'info';
            await createAlert({
              rule_id: rule.id,
              module: 'tutelles',
              severity,
              title,
              message: days === 0 ? "Événement aujourd'hui" : `Dans ${days} jour(s)`,
              link_path: '/tutelles',
              link_entity_id: ev.id,
              is_read: 0,
            });
          }
        }

        if (rule.module === 'projects') {
          const projects = await getProjects();
          for (const proj of projects) {
            if (!proj.due_date) continue;
            if (proj.status === 'done') continue;
            const days = daysUntil(proj.due_date);
            if (days > 0) continue; // Only alert when overdue
            const title = `Projet en retard : ${proj.title}`;
            const already = await alertExistsToday('projects', title);
            if (already) continue;
            await createAlert({
              rule_id: rule.id,
              module: 'projects',
              severity: 'warning',
              title,
              message: `Échéance dépassée de ${Math.abs(days)} jour(s)`,
              link_path: '/projects',
              link_entity_id: proj.id,
              is_read: 0,
            });
          }
        }
        break;
      }

      case 'budget_overrun': {
        const lines = await getBudgetLinesRaw();
        for (const line of lines) {
          if (line.amount_previsionnel <= 0) continue;
          const overrunPct = ((line.amount_realise - line.amount_previsionnel) / line.amount_previsionnel) * 100;
          if (overrunPct <= rule.condition_value) continue;
          const title = `Dépassement budgétaire : ${line.line_label}`;
          const already = await alertExistsToday('budget', title);
          if (already) continue;
          const severity: AlertSeverity = overrunPct >= rule.condition_value * 2 ? 'critical' : 'warning';
          await createAlert({
            rule_id: rule.id,
            module: 'budget',
            severity,
            title,
            message: `Réalisé : ${line.amount_realise.toLocaleString('fr-FR')} € (prévu : ${line.amount_previsionnel.toLocaleString('fr-FR')} €, dépassement : ${Math.round(overrunPct)} %)`,
            link_path: '/budget',
            link_entity_id: null,
            is_read: 0,
          });
        }
        break;
      }
    }
  }
}
