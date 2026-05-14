import { describe, it, expect, beforeEach } from 'vitest';
import { resetState, createDemoCompany, getAgentByRole } from '../helpers';
import { db } from '@/factory/store/db';
import { executeRun } from '@/factory/agents/runtime';
import { enqueueTask } from '@/factory/modules/enqueue';

beforeEach(() => resetState());

describe('runtime / role handlers', () => {
  it('Researcher.research_companies returns leads + emits trace + records cost', async () => {
    const ctx = await createDemoCompany();
    const researcher = getAgentByRole(ctx.company.id, 'Researcher');
    const r = enqueueTask({
      companyId: ctx.company.id,
      agentId: researcher.id,
      kind: 'research_companies',
      input: { count: 10 },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const out = await executeRun(r.task);
    expect(out.kind).toBe('done');
    if (out.kind === 'done') {
      const leads = (out.output as { leads: unknown[] }).leads;
      expect(leads.length).toBe(10);
      expect(out.run.toolCallCount).toBeGreaterThanOrEqual(3);
      expect(out.run.costUsd).toBeGreaterThan(0);
    }
    const company = db().companies.require(ctx.company.id);
    expect(company.budget.spentTodayUsd).toBeGreaterThan(0);
  });

  it('Outreach.draft_outreach creates a draft and queues a follow-up send task', async () => {
    const ctx = await createDemoCompany();
    const outreach = getAgentByRole(ctx.company.id, 'Outreach');
    const r = enqueueTask({
      companyId: ctx.company.id,
      agentId: outreach.id,
      kind: 'draft_outreach',
      input: { variant: 'A' },
    });
    if (!r.ok) throw new Error(r.reason);
    const out = await executeRun(r.task);
    expect(out.kind).toBe('done');
    if (out.kind === 'done') {
      expect(out.followUps.length).toBe(1);
      expect(out.followUps[0]!.kind).toMatch(/^send_outreach_/);
    }
  });

  it('Outreach.send_outreach pauses for approval (gmail.send requires approval)', async () => {
    const ctx = await createDemoCompany();
    const outreach = getAgentByRole(ctx.company.id, 'Outreach');
    const r = enqueueTask({
      companyId: ctx.company.id,
      agentId: outreach.id,
      kind: 'send_outreach_X_draft1',
      input: {
        draftId: 'draft1',
        to: 'lead@example.com',
        subject: 's',
        body: 'b',
      },
    });
    if (!r.ok) throw new Error(r.reason);
    const out = await executeRun(r.task);
    expect(out.kind).toBe('awaiting_approval');
    expect(db().approvals.find((a) => a.status === 'pending').length).toBe(1);
  });

  it('Ops.daily_report assembles summary including KPI counts', async () => {
    const ctx = await createDemoCompany();
    const ops = getAgentByRole(ctx.company.id, 'Ops');
    const r = enqueueTask({
      companyId: ctx.company.id,
      agentId: ops.id,
      kind: 'daily_report',
      input: {},
    });
    if (!r.ok) throw new Error(r.reason);
    const out = await executeRun(r.task);
    expect(out.kind).toBe('done');
    if (out.kind === 'done') {
      const report = (out.output as { report: Record<string, number> }).report;
      expect(typeof report.tasksDone).toBe('number');
      expect(typeof report.spentTodayUsd).toBe('number');
    }
  });
});
