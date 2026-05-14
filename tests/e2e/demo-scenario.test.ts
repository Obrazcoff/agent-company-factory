import { describe, it, expect, beforeEach } from 'vitest';
import { resetState, DEMO_PROMPT } from '../helpers';
import { api } from './api-client';
import type { CompanyState } from '@/factory/modules/controlPlane';
import type { Approval, Task } from '@/factory/domain/types';

beforeEach(() => resetState());

describe('E2E demo scenario (covers AC-1 .. AC-6)', () => {
  it('full happy path through HTTP layer', async () => {
    // AC-1: Blueprint from a single goal prompt
    const created = await api.createCompany({ missionPrompt: DEMO_PROMPT, dailyBudgetUsd: 50 });
    expect(created.status).toBe(201);
    const intake = created.data as {
      company: { id: string };
      blueprint: { mission: string; kpis: unknown[] };
      agents: Array<{ id: string; role: string }>;
      initialTasks: Array<{ id: string }>;
    };
    expect(intake.company.id).toBeDefined();
    expect(intake.blueprint.mission.length).toBeGreaterThan(20);
    expect(intake.blueprint.kpis.length).toBeGreaterThanOrEqual(1);

    // AC-2: Data model — agents + initial tasks
    expect(intake.agents.length).toBeGreaterThanOrEqual(3);
    expect(intake.initialTasks.length).toBeGreaterThanOrEqual(5);

    const companyId = intake.company.id;

    // AC-3 + AC-6: execution loop via tick
    let totalDone = 0;
    let pendingApproval: Approval | undefined;
    for (let i = 0; i < 30; i += 1) {
      const tickRes = await api.tick();
      totalDone += (tickRes.data as { doneTasks: number }).doneTasks;
      const stateRes = await api.getCompany(companyId);
      const state = stateRes.data as CompanyState;
      pendingApproval = state.pendingApprovals[0];
      if (pendingApproval) break;
      if (state.stats.queued === 0 && state.stats.running === 0) break;
    }
    expect(totalDone).toBeGreaterThan(0);
    expect(pendingApproval).toBeDefined();

    // AC-5: observability — runs/tool calls/audit timeline + cost
    const stateRes = await api.getCompany(companyId);
    const state = stateRes.data as CompanyState;
    expect(state.audits.length).toBeGreaterThanOrEqual(10);
    expect(state.runs.some((r) => r.toolCalls.length > 0)).toBe(true);
    expect(state.company.budget.spentTodayUsd).toBeGreaterThan(0);
    expect(state.company.budget.spentTodayUsd).toBeLessThanOrEqual(state.company.budget.dailyCapUsd);

    // AC-4: approve the pending action -> task progresses to done
    const decideRes = await api.decideApproval(pendingApproval!.id, { decision: 'approved' });
    expect(decideRes.status).toBe(200);
    let approvedTaskDone = false;
    for (let i = 0; i < 5; i += 1) {
      await api.tick();
      const after = await api.getCompany(companyId);
      const t = (after.data as CompanyState).tasks.find((x: Task) => x.id === pendingApproval!.taskId);
      if (t?.status === 'done') {
        approvedTaskDone = true;
        break;
      }
    }
    expect(approvedTaskDone).toBe(true);

    // AC-4: pause an agent -> their queued tasks are not executed
    const outreachAgent = intake.agents.find((a) => a.role === 'Outreach');
    expect(outreachAgent).toBeDefined();
    await api.pauseAgent(outreachAgent!.id, true);
    const before = (await api.getCompany(companyId)).data as CompanyState;
    const outreachQueuedBefore = before.tasks.filter(
      (t) => t.agentId === outreachAgent!.id && t.status === 'queued',
    ).length;
    await api.tick();
    const after = (await api.getCompany(companyId)).data as CompanyState;
    const outreachQueuedAfter = after.tasks.filter(
      (t) => t.agentId === outreachAgent!.id && t.status === 'queued',
    ).length;
    expect(outreachQueuedAfter).toBe(outreachQueuedBefore);
  });

  it('AC-4 negative: tiny budget triggers budget.exceeded audit', async () => {
    const created = await api.createCompany({ missionPrompt: DEMO_PROMPT, dailyBudgetUsd: 0.005 });
    const intake = created.data as { company: { id: string } };
    const companyId = intake.company.id;
    for (let i = 0; i < 10; i += 1) await api.tick();
    const state = (await api.getCompany(companyId)).data as CompanyState;
    const budgetEvents = state.audits.filter((a) => a.kind === 'budget.exceeded');
    const killEvents = state.audits.filter((a) => a.kind === 'company.killed');
    expect(budgetEvents.length + killEvents.length).toBeGreaterThan(0);
  });

  it('AC-4 reject approval cascades to task=failed', async () => {
    const created = await api.createCompany({ missionPrompt: DEMO_PROMPT, dailyBudgetUsd: 50 });
    const intake = created.data as { company: { id: string } };
    const companyId = intake.company.id;
    let pending: Approval | undefined;
    for (let i = 0; i < 30; i += 1) {
      await api.tick();
      const state = (await api.getCompany(companyId)).data as CompanyState;
      pending = state.pendingApprovals[0];
      if (pending) break;
    }
    expect(pending).toBeDefined();
    await api.decideApproval(pending!.id, { decision: 'rejected', reason: 'not_now' });
    for (let i = 0; i < 3; i += 1) await api.tick();
    const state = (await api.getCompany(companyId)).data as CompanyState;
    const t = state.tasks.find((x) => x.id === pending!.taskId);
    expect(t?.status).toBe('failed');
  });
});
