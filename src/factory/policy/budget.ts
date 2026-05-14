import { db } from '../store/db';
import { appendAudit } from '../audit/audit';
import { nowIso } from '../domain/ids';
import type { Company, CompanyId } from '../domain/types';

function maybeReset(company: Company): Company {
  const today = new Date().toISOString().slice(0, 10);
  const lastDay = (company.budget.lastResetAt ?? '').slice(0, 10);
  if (today !== lastDay) {
    return {
      ...company,
      budget: { ...company.budget, spentTodayUsd: 0, lastResetAt: nowIso() },
    };
  }
  return company;
}

export type BudgetCheck =
  | { allowed: true }
  | { allowed: false; reason: 'soft_cap' | 'hard_cap'; spent: number; cap: number };

export function canSpend(companyId: CompanyId, estUsd: number): BudgetCheck {
  let company = db().companies.require(companyId);
  const reset = maybeReset(company);
  if (reset !== company) {
    company = db().companies.upsert(reset);
  }

  const wouldSpend = company.budget.spentTodayUsd + estUsd;
  if (wouldSpend > company.budget.hardCapUsd) {
    return {
      allowed: false,
      reason: 'hard_cap',
      spent: company.budget.spentTodayUsd,
      cap: company.budget.hardCapUsd,
    };
  }
  if (wouldSpend > company.budget.dailyCapUsd) {
    return {
      allowed: false,
      reason: 'soft_cap',
      spent: company.budget.spentTodayUsd,
      cap: company.budget.dailyCapUsd,
    };
  }
  return { allowed: true };
}

export function recordSpend(companyId: CompanyId, usd: number): void {
  db().companies.update(companyId, (c) => {
    const reset = maybeReset(c);
    return {
      ...reset,
      budget: { ...reset.budget, spentTodayUsd: reset.budget.spentTodayUsd + usd },
    };
  });
}

export function recordAgentSpend(agentId: string, usd: number): void {
  const agent = db().agents.get(agentId);
  if (!agent) return;
  db().agents.update(agentId, (a) => ({ ...a, costToDateUsd: a.costToDateUsd + usd }));
}

export function killSwitchIfHardCap(companyId: CompanyId): boolean {
  const company = db().companies.require(companyId);
  if (company.budget.spentTodayUsd >= company.budget.hardCapUsd && company.status !== 'paused') {
    db().companies.update(companyId, (c) => ({ ...c, status: 'paused' }));
    const queued = db().tasks.find(
      (t) => t.companyId === companyId && (t.status === 'queued' || t.status === 'awaiting_approval'),
    );
    for (const t of queued) {
      db().tasks.update(t.id, (cur) => ({
        ...cur,
        status: 'cancelled',
        lastError: 'company_killed_by_hard_cap',
        updatedAt: nowIso(),
      }));
    }
    appendAudit({
      companyId,
      kind: 'company.killed',
      actor: 'system',
      payload: { cancelledTasks: queued.length, reason: 'hard_cap_reached' },
    });
    return true;
  }
  return false;
}
