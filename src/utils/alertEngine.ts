import {
  getAlertRules,
  createAlert,
  alertExistsToday,
  getProjects,
} from '@/db';
import type { AlertModule, AlertSeverity } from '@/db';
import { getDb } from '@/db/database';

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
      case 'deadline': {
        if (rule.module === 'projects') {
          const projects = await getProjects();
          for (const proj of projects) {
            if (!proj.due_date) continue;
            if (proj.status === 'done') continue;
            const days = daysUntil(proj.due_date);
            if (days > 0) continue;
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
