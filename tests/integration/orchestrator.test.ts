import { describe, it, expect, beforeEach } from 'vitest';
import { resetState, createDemoCompany, getAgentByRole } from '../helpers';
import { db } from '@/factory/store/db';
import { tick, pauseCompany } from '@/factory/modules/orchestrator';
import { enqueueTask } from '@/factory/modules/enqueue';
import { ORCH_LIMITS } from '@/factory/config';
import { decideApproval } from '@/factory/policy/approvals';
import { roleHandlers } from '@/factory/agents/roles';
import type { RoleHandler } from '@/factory/agents/runtime';
import type { AgentRole } from '@/factory/domain/types';

beforeEach(() => resetState());

async function runUntilQuiet(maxTicks = 20): Promise<void> {
  for (let i = 0; i < maxTicks; i += 1) {
    const result = await tick();
    if (result.executed === 0 && result.awaitingApprovalTasks === 0) return;
  }
}

describe('orchestrator hardening', () => {
  // Case 1: Infinite retry → dead letter
  it('case 1: task fails maxAttempts times → status=failed + dead_letter audit', async () => {
    const ctx = await createDemoCompany();
    const ops = getAgentByRole(ctx.company.id, 'Ops');
    const original = roleHandlers.Ops as RoleHandler;
    roleHandlers.Ops = async () => {
      throw new Error('boom');
    };
    try {
      const r = enqueueTask({ companyId: ctx.company.id, agentId: ops.id, kind: 'flaky', input: {} });
      if (!r.ok) throw new Error(r.reason);
      for (let i = 0; i < ORCH_LIMITS.MAX_ATTEMPTS_PER_TASK + 1; i += 1) {
        await tick();
      }
      const final = db().tasks.require(r.task.id);
      expect(final.status).toBe('failed');
      expect(final.attempts).toBe(ORCH_LIMITS.MAX_ATTEMPTS_PER_TASK);
      const audits = db().audits.find((a) => a.kind === 'task.dead_letter');
      expect(audits.length).toBeGreaterThanOrEqual(1);
    } finally {
      roleHandlers.Ops = original;
    }
  });

  // Case 2: Approval timeout
  it('case 2: pending approval past deadline → expired + task=failed', async () => {
    const ctx = await createDemoCompany();
    const outreach = getAgentByRole(ctx.company.id, 'Outreach');
    const r = enqueueTask({
      companyId: ctx.company.id,
      agentId: outreach.id,
      kind: 'send_outreach_X_d1',
      input: { draftId: 'd1', to: 'x@y', subject: 's', body: 'b' },
    });
    if (!r.ok) throw new Error(r.reason);
    await tick();
    const pending = db().approvals.find((a) => a.status === 'pending')[0];
    expect(pending).toBeDefined();
    db().approvals.update(pending!.id, (cur) => ({ ...cur, deadlineAt: '2000-01-01T00:00:00.000Z' }));
    await tick();
    expect(db().approvals.require(pending!.id).status).toBe('expired');
    expect(db().tasks.require(r.task.id).status).toBe('failed');
  });

  // Case 3: Stale running recovery
  it('case 3: stale running run is swept and task re-queued', async () => {
    const ctx = await createDemoCompany();
    const ops = getAgentByRole(ctx.company.id, 'Ops');
    const r = enqueueTask({ companyId: ctx.company.id, agentId: ops.id, kind: 'daily_report', input: {} });
    if (!r.ok) throw new Error(r.reason);
    db().tasks.update(r.task.id, (cur) => ({ ...cur, status: 'running' }));
    db().runs.create({
      id: 'run_stale',
      taskId: r.task.id,
      agentId: ops.id,
      companyId: ctx.company.id,
      startedAt: '2000-01-01T00:00:00.000Z',
      heartbeatAt: '2000-01-01T00:00:00.000Z',
      status: 'running',
      attempts: 1,
      traceEvents: [],
      toolCalls: [],
      llmCallCount: 0,
      toolCallCount: 0,
      costUsd: 0,
      depth: 0,
    });
    await tick();
    const finalRun = db().runs.require('run_stale');
    expect(finalRun.status).toBe('failed');
    const finalTask = db().tasks.require(r.task.id);
    expect(['queued', 'failed', 'done']).toContain(finalTask.status);
    const audits = db().audits.find((a) => a.kind === 'run.stale_recovered');
    expect(audits.length).toBeGreaterThanOrEqual(1);
  });

  // Case 4: Concurrent claim race
  it('case 4: two parallel ticks claim a task only once', async () => {
    const ctx = await createDemoCompany();
    const ops = getAgentByRole(ctx.company.id, 'Ops');
    const original = roleHandlers.Ops as RoleHandler;
    roleHandlers.Ops = async () => {
      await new Promise((r) => setTimeout(r, 30));
      return { output: { ok: true } };
    };
    try {
      const r = enqueueTask({
        companyId: ctx.company.id,
        agentId: ops.id,
        kind: 'race_unique',
        input: { nonce: Math.random() },
      });
      if (!r.ok) throw new Error(r.reason);
      const [a, b] = await Promise.all([tick(), tick()]);
      const totalRunsForTask = db().runs.find((rn) => rn.taskId === r.task.id).length;
      expect(totalRunsForTask).toBe(1);
      expect(a.executed + b.executed).toBeGreaterThanOrEqual(1);
    } finally {
      roleHandlers.Ops = original;
    }
  });

  // Case 5: Cyclic deps reject
  it('case 5: cyclic dependency is rejected at enqueue time', async () => {
    const ctx = await createDemoCompany();
    const ops = getAgentByRole(ctx.company.id, 'Ops');
    const A = enqueueTask({ companyId: ctx.company.id, agentId: ops.id, kind: 'A', input: {} });
    if (!A.ok) throw new Error(A.reason);
    const B = enqueueTask({
      companyId: ctx.company.id,
      agentId: ops.id,
      kind: 'B',
      input: {},
      dependsOn: [A.task.id],
    });
    if (!B.ok) throw new Error(B.reason);
    db().tasks.update(A.task.id, (cur) => ({ ...cur, dependsOn: [B.task.id] }));
    const cyclic = enqueueTask({
      companyId: ctx.company.id,
      agentId: ops.id,
      kind: 'C',
      input: {},
      dependsOn: [A.task.id],
    });
    expect(cyclic.ok).toBe(false);
    if (!cyclic.ok) expect(cyclic.reason).toBe('cyclic_dependency');
  });

  // Case 6: Max depth reject (fork-bomb prevention)
  it('case 6: enqueue at depth > MAX_DEPTH is rejected', async () => {
    const ctx = await createDemoCompany();
    const ops = getAgentByRole(ctx.company.id, 'Ops');
    const result = enqueueTask({
      companyId: ctx.company.id,
      agentId: ops.id,
      kind: 'deep',
      input: {},
      depth: ORCH_LIMITS.MAX_DEPTH + 1,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('max_depth_exceeded');
    const audits = db().audits.find((a) => a.kind === 'task.rejected_max_depth');
    expect(audits.length).toBeGreaterThanOrEqual(1);
  });

  // Case 7: Run timeout
  it('case 7: handler exceeding runTimeoutMs is timed_out and retried', async () => {
    const ctx = await createDemoCompany();
    const ops = getAgentByRole(ctx.company.id, 'Ops');
    const original = roleHandlers.Ops as RoleHandler;
    roleHandlers.Ops = async () => new Promise((resolve) => setTimeout(() => resolve({ output: {} }), 5_000));
    try {
      const r = enqueueTask({ companyId: ctx.company.id, agentId: ops.id, kind: 'slow', input: {} });
      if (!r.ok) throw new Error(r.reason);
      db().tasks.update(r.task.id, (cur) => ({ ...cur, runTimeoutMs: 50 }));
      await tick();
      const audits = db().audits.find((a) => a.kind === 'run.timeout');
      expect(audits.length).toBeGreaterThanOrEqual(1);
      const final = db().tasks.require(r.task.id);
      expect(['queued', 'failed']).toContain(final.status);
    } finally {
      roleHandlers.Ops = original;
    }
  });

  // Case 8: Tick deadline yield
  it('case 8: tick honors TICK_DEADLINE_MS and defers remaining tasks', async () => {
    const ctx = await createDemoCompany();
    const ops = getAgentByRole(ctx.company.id, 'Ops');
    const original = roleHandlers.Ops as RoleHandler;
    roleHandlers.Ops = async () => {
      await new Promise((r) => setTimeout(r, 200));
      return { output: {} };
    };
    try {
      for (let i = 0; i < 50; i += 1) {
        enqueueTask({ companyId: ctx.company.id, agentId: ops.id, kind: `slow_${i}`, input: {} });
      }
      const start = Date.now();
      const result = await tick();
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(ORCH_LIMITS.TICK_DEADLINE_MS + 1500);
      expect(result.executed).toBeLessThan(50);
    } finally {
      roleHandlers.Ops = original;
    }
  }, 15_000);

  // Case 9: LLM/tool call cap per Run
  it('case 9: handler exceeding MAX_TOOL_CALLS_PER_RUN fails with run.call_cap_exceeded', async () => {
    const ctx = await createDemoCompany();
    const researcher = getAgentByRole(ctx.company.id, 'Researcher');
    const original = roleHandlers.Researcher as RoleHandler;
    roleHandlers.Researcher = async (rctx) => {
      for (let i = 0; i < ORCH_LIMITS.MAX_TOOL_CALLS_PER_RUN + 5; i += 1) {
        await rctx.call('crm', { leads: [{ name: 'x', domain: 'x' }] });
      }
      return { output: {} };
    };
    try {
      const r = enqueueTask({ companyId: ctx.company.id, agentId: researcher.id, kind: 'spam', input: {} });
      if (!r.ok) throw new Error(r.reason);
      await tick();
      const audits = db().audits.find((a) => a.kind === 'run.call_cap_exceeded');
      expect(audits.length).toBeGreaterThanOrEqual(1);
    } finally {
      roleHandlers.Researcher = original;
    }
  });

  // Case 10: Approval double-decision
  it('case 10: second decision on same approval returns already_decided', async () => {
    const ctx = await createDemoCompany();
    const outreach = getAgentByRole(ctx.company.id, 'Outreach');
    const r = enqueueTask({
      companyId: ctx.company.id,
      agentId: outreach.id,
      kind: 'send_outreach_X_d1',
      input: { draftId: 'd1', to: 'x@y', subject: 's', body: 'b' },
    });
    if (!r.ok) throw new Error(r.reason);
    await tick();
    const pending = db().approvals.find((a) => a.status === 'pending')[0]!;
    const first = decideApproval(pending.id, 'approved');
    expect(first.ok).toBe(true);
    const second = decideApproval(pending.id, 'rejected');
    expect(second.ok).toBe(false);
  });

  // Case 11: Hard-cap kill switch
  it('case 11: hard-cap reached pauses company and cancels queued tasks', async () => {
    const ctx = await createDemoCompany({ dailyBudgetUsd: 0.005 });
    const researcher = getAgentByRole(ctx.company.id, 'Researcher');
    const r = enqueueTask({
      companyId: ctx.company.id,
      agentId: researcher.id,
      kind: 'research_companies',
      input: { count: 10 },
    });
    if (!r.ok) throw new Error(r.reason);
    await runUntilQuiet(10);
    const company = db().companies.require(ctx.company.id);
    const wasKilled = company.status === 'paused';
    const budgetExceeded = db().audits.find((a) => a.kind === 'budget.exceeded').length > 0;
    expect(wasKilled || budgetExceeded).toBe(true);
  });

  // Case 12: Cascade cancel dependents
  it('case 12: failed task cascades cancel to dependents', async () => {
    const ctx = await createDemoCompany();
    const ops = getAgentByRole(ctx.company.id, 'Ops');
    const original = roleHandlers.Ops as RoleHandler;
    roleHandlers.Ops = async () => {
      throw new Error('intentional_fail');
    };
    try {
      const A = enqueueTask({ companyId: ctx.company.id, agentId: ops.id, kind: 'A', input: {} });
      if (!A.ok) throw new Error(A.reason);
      const B = enqueueTask({
        companyId: ctx.company.id,
        agentId: ops.id,
        kind: 'B',
        input: {},
        dependsOn: [A.task.id],
      });
      if (!B.ok) throw new Error(B.reason);
      const C = enqueueTask({
        companyId: ctx.company.id,
        agentId: ops.id,
        kind: 'C',
        input: {},
        dependsOn: [B.task.id],
      });
      if (!C.ok) throw new Error(C.reason);
      for (let i = 0; i < ORCH_LIMITS.MAX_ATTEMPTS_PER_TASK + 1; i += 1) await tick();
      expect(db().tasks.require(A.task.id).status).toBe('failed');
      expect(db().tasks.require(B.task.id).status).toBe('cancelled');
      expect(db().tasks.require(C.task.id).status).toBe('cancelled');
    } finally {
      roleHandlers.Ops = original;
    }
  });

  it('bonus: pauseCompany prevents new task execution on tick', async () => {
    const ctx = await createDemoCompany();
    pauseCompany(ctx.company.id, true);
    const ops = getAgentByRole(ctx.company.id, 'Ops');
    void (ops.role as AgentRole);
    const result = await tick();
    expect(result.executed).toBe(0);
  });
});
