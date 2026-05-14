import type { RoleHandler } from '../runtime';
import { db } from '../../store/db';

export const opsHandler: RoleHandler = async (ctx) => {
  const taskKind = ctx.task.kind;

  if (taskKind === 'schedule_followups') {
    ctx.emit('followup', 'started', 'Writing follow-up plan to sheets');
    await ctx.call<{ sheet: string; rows: Record<string, unknown>[] }, { written: number }>('sheets', {
      sheet: 'followups',
      rows: [
        { reminder: 'Day 3 follow-up if no reply', target: 'cto@atlas.example' },
        { reminder: 'Day 7 last-touch', target: 'cto@atlas.example' },
      ],
    });
    ctx.emit('followup', 'completed', 'Follow-ups scheduled');
    return { output: { scheduled: 2 } };
  }

  if (taskKind === 'daily_report') {
    const company = ctx.company;
    const tasks = db().tasks.all({ companyId: company.id });
    const audits = db().audits.all({ companyId: company.id });
    const summary = {
      tasksDone: tasks.filter((t) => t.status === 'done').length,
      tasksFailed: tasks.filter((t) => t.status === 'failed').length,
      tasksAwaitingApproval: tasks.filter((t) => t.status === 'awaiting_approval').length,
      auditEvents: audits.length,
      spentTodayUsd: company.budget.spentTodayUsd,
      dailyCapUsd: company.budget.dailyCapUsd,
    };
    ctx.emit('report', 'completed', 'Daily report assembled', summary);
    return { output: { report: summary } };
  }

  return { output: { kind: taskKind, note: 'ops: no-op' } };
};
