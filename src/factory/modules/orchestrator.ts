import { db } from '../store/db';
import { queue } from '../queue/queue';
import { ORCH_LIMITS } from '../config';
import { newId, nowIso } from '../domain/ids';
import { appendAudit } from '../audit/audit';
import { expireOverdueApprovals } from '../policy/approvals';
import { executeRun, expandFollowUp } from '../agents/runtime';
import type { Agent, AgentRole, Company, Task, TaskId, WorkerId } from '../domain/types';

export type TickResult = {
  workerId: WorkerId;
  durationMs: number;
  expiredApprovals: number;
  staleRunsRecovered: number;
  executed: number;
  doneTasks: number;
  failedTasks: number;
  awaitingApprovalTasks: number;
  deferred: number;
};

function tryClaim(taskId: TaskId, workerId: WorkerId): boolean {
  const task = db().tasks.get(taskId);
  if (!task) return false;
  if (task.status !== 'queued') return false;
  if (task.lockedUntil && Date.parse(task.lockedUntil) > Date.now()) return false;
  const updated = db().tasks.update(taskId, (cur) => {
    if (cur.status !== 'queued') return cur;
    if (cur.lockedUntil && Date.parse(cur.lockedUntil) > Date.now()) return cur;
    return {
      ...cur,
      status: 'running',
      lockedBy: workerId,
      lockedUntil: new Date(Date.now() + ORCH_LIMITS.LEASE_MS).toISOString(),
      attempts: cur.attempts + 1,
      updatedAt: nowIso(),
    };
  });
  return updated.lockedBy === workerId && updated.status === 'running';
}

function release(taskId: TaskId): void {
  db().tasks.update(taskId, (cur) => ({
    ...cur,
    lockedBy: undefined,
    lockedUntil: undefined,
    updatedAt: nowIso(),
  }));
}

function depsAllDone(task: Task): boolean {
  if (task.dependsOn.length === 0) return true;
  for (const depId of task.dependsOn) {
    const dep = db().tasks.get(depId);
    if (!dep) return false;
    if (dep.status !== 'done') return false;
  }
  return true;
}

function depsHaveTerminalNonDone(task: Task): boolean {
  for (const depId of task.dependsOn) {
    const dep = db().tasks.get(depId);
    if (!dep) return true;
    if (dep.status === 'failed' || dep.status === 'cancelled') return true;
  }
  return false;
}

function cancelDependents(parentTaskId: TaskId, reason: string): number {
  let count = 0;
  const visit = (id: TaskId): void => {
    const dependents = queue.findDependents(db().tasks.all(), id);
    for (const dep of dependents) {
      if (dep.status === 'queued' || dep.status === 'awaiting_approval') {
        db().tasks.update(dep.id, (cur) => ({
          ...cur,
          status: 'cancelled',
          lastError: reason,
          updatedAt: nowIso(),
        }));
        appendAudit({
          companyId: dep.companyId,
          kind: 'task.cancelled_cascade',
          actor: 'system',
          payload: { taskId: dep.id, parentId: id, reason },
        });
        count += 1;
        visit(dep.id);
      }
    }
  };
  visit(parentTaskId);
  return count;
}

function sweepStaleRuns(): number {
  const stale = db()
    .tasks.find((t) => t.status === 'running')
    .filter((t) => {
      const runs = db().runs.find((r) => r.taskId === t.id && r.status === 'running');
      const latest = runs.sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
      if (!latest) return true;
      return Date.now() - Date.parse(latest.heartbeatAt) > ORCH_LIMITS.STALE_RUN_MS;
    });
  for (const t of stale) {
    const latest = db()
      .runs.find((r) => r.taskId === t.id && r.status === 'running')
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
    if (latest) {
      db().runs.update(latest.id, (r) => ({
        ...r,
        status: 'failed',
        finishedAt: nowIso(),
        error: 'stale_recovered_by_sweeper',
      }));
    }
    const willRetry = t.attempts < t.maxAttempts;
    db().tasks.update(t.id, (cur) => ({
      ...cur,
      status: willRetry ? 'queued' : 'failed',
      lockedBy: undefined,
      lockedUntil: undefined,
      lastError: 'stale_run_recovered',
      updatedAt: nowIso(),
    }));
    appendAudit({
      companyId: t.companyId,
      kind: 'run.stale_recovered',
      actor: 'system',
      payload: { taskId: t.id, willRetry },
    });
    if (!willRetry) cancelDependents(t.id, 'parent_stale_failed');
  }
  return stale.length;
}

function failOrRetryTask(
  task: Task,
  reason: string,
  retryable: boolean,
): {
  newStatus: Task['status'];
  attempts: number;
} {
  const willRetry = retryable && task.attempts < task.maxAttempts;
  const newStatus: Task['status'] = willRetry ? 'queued' : 'failed';
  db().tasks.update(task.id, (cur) => ({
    ...cur,
    status: newStatus,
    lockedBy: undefined,
    lockedUntil: undefined,
    lastError: reason,
    updatedAt: nowIso(),
  }));
  if (!willRetry) {
    appendAudit({
      companyId: task.companyId,
      kind: task.attempts >= task.maxAttempts ? 'task.dead_letter' : 'task.failed',
      actor: 'system',
      payload: { taskId: task.id, reason, attempts: task.attempts },
    });
    cancelDependents(task.id, 'parent_failed');
  }
  return { newStatus, attempts: task.attempts };
}

function getRolesByAgent(companyId: string): Map<string, AgentRole> {
  const map = new Map<string, AgentRole>();
  for (const a of db().agents.all({ companyId })) map.set(a.id, a.role);
  return map;
}

async function processOneTask(
  task: Task,
  workerId: WorkerId,
): Promise<{
  done: boolean;
  failed: boolean;
  awaitingApproval: boolean;
}> {
  const outcome = await executeRun(task);

  if (outcome.kind === 'done') {
    db().tasks.update(task.id, (cur) => ({
      ...cur,
      status: 'done',
      lockedBy: undefined,
      lockedUntil: undefined,
      updatedAt: nowIso(),
    }));
    for (const followUp of outcome.followUps) {
      const result = expandFollowUp(task, followUp, outcome.run.id);
      if (!result.ok) {
        appendAudit({
          companyId: task.companyId,
          kind: 'task.rejected_backlog_full',
          actor: 'system',
          payload: { reason: result.reason, parentTaskId: task.id, kind: followUp.kind },
        });
      }
    }
    return { done: true, failed: false, awaitingApproval: false };
  }

  if (outcome.kind === 'awaiting_approval') {
    db().tasks.update(task.id, (cur) => ({
      ...cur,
      status: 'awaiting_approval',
      lockedBy: undefined,
      lockedUntil: undefined,
      updatedAt: nowIso(),
    }));
    return { done: false, failed: false, awaitingApproval: true };
  }

  failOrRetryTask(task, outcome.reason, outcome.retryable);
  return {
    done: false,
    failed: true,
    awaitingApproval: false,
  };
  // workerId is captured in run.attempts via repo update
  void workerId;
}

function resumeApprovedTasks(): number {
  let count = 0;
  const awaiting = db().tasks.find((t) => t.status === 'awaiting_approval');
  for (const t of awaiting) {
    const approvals = db().approvals.find((a) => a.taskId === t.id);
    const hasPending = approvals.some((a) => a.status === 'pending');
    if (hasPending) continue;
    const hasRejected = approvals.some((a) => a.status === 'rejected' || a.status === 'expired');
    const hasApproved = approvals.some((a) => a.status === 'approved');
    if (hasRejected && !hasApproved) {
      db().tasks.update(t.id, (cur) => ({
        ...cur,
        status: 'failed',
        lastError: 'approval_rejected_or_expired',
        updatedAt: nowIso(),
      }));
      appendAudit({
        companyId: t.companyId,
        kind: 'task.failed',
        actor: 'system',
        payload: { taskId: t.id, reason: 'approval_rejected_or_expired' },
      });
      cancelDependents(t.id, 'parent_failed');
      continue;
    }
    if (hasApproved) {
      db().tasks.update(t.id, (cur) => ({
        ...cur,
        status: 'queued',
        lockedBy: undefined,
        lockedUntil: undefined,
        updatedAt: nowIso(),
      }));
      count += 1;
    }
  }
  return count;
}

export async function tick(): Promise<TickResult> {
  const workerId = newId('wrk');
  const tickStart = Date.now();
  const result: TickResult = {
    workerId,
    durationMs: 0,
    expiredApprovals: 0,
    staleRunsRecovered: 0,
    executed: 0,
    doneTasks: 0,
    failedTasks: 0,
    awaitingApprovalTasks: 0,
    deferred: 0,
  };

  const expired = expireOverdueApprovals();
  result.expiredApprovals = expired.length;
  result.staleRunsRecovered = sweepStaleRuns();
  resumeApprovedTasks();

  const companies: Company[] = db()
    .companies.all()
    .filter((c) => c.status === 'active');

  for (const company of companies) {
    if (Date.now() - tickStart > ORCH_LIMITS.TICK_DEADLINE_MS) {
      result.deferred += db().tasks.find((t) => t.companyId === company.id && t.status === 'queued').length;
      break;
    }

    const allTasks = db().tasks.all({ companyId: company.id });
    const rolesByAgent = getRolesByAgent(company.id);
    const ready = queue.pickReady(
      allTasks,
      company.id,
      depsAllDone,
      ORCH_LIMITS.MAX_TASKS_PER_TICK_PER_COMPANY,
      rolesByAgent,
    );

    const orphaned = allTasks.filter(
      (t) => t.status === 'queued' && !depsAllDone(t) && depsHaveTerminalNonDone(t),
    );
    for (const o of orphaned) {
      db().tasks.update(o.id, (cur) => ({
        ...cur,
        status: 'cancelled',
        lastError: 'parent_failed_or_cancelled',
        updatedAt: nowIso(),
      }));
      appendAudit({
        companyId: o.companyId,
        kind: 'task.cancelled_cascade',
        actor: 'system',
        payload: { taskId: o.id, reason: 'parent_failed_or_cancelled' },
      });
    }

    for (const candidate of ready) {
      if (Date.now() - tickStart > ORCH_LIMITS.TICK_DEADLINE_MS) {
        result.deferred += 1;
        continue;
      }
      const agent: Agent | undefined = db().agents.get(candidate.agentId);
      if (!agent || agent.status === 'paused') {
        result.deferred += 1;
        continue;
      }
      if (!tryClaim(candidate.id, workerId)) {
        result.deferred += 1;
        continue;
      }
      const claimed = db().tasks.require(candidate.id);
      const out = await processOneTask(claimed, workerId);
      result.executed += 1;
      if (out.done) result.doneTasks += 1;
      if (out.failed) result.failedTasks += 1;
      if (out.awaitingApproval) result.awaitingApprovalTasks += 1;
    }
  }

  result.durationMs = Date.now() - tickStart;
  return result;
}

export function pauseAgent(agentId: string, paused: boolean): Agent {
  const updated = db().agents.update(agentId, (a) => ({ ...a, status: paused ? 'paused' : 'idle' }));
  appendAudit({
    companyId: updated.companyId,
    kind: 'agent.paused',
    actor: 'human',
    payload: { agentId, paused },
  });
  return updated;
}

export function pauseCompany(companyId: string, paused: boolean): Company {
  const updated = db().companies.update(companyId, (c) => ({ ...c, status: paused ? 'paused' : 'active' }));
  appendAudit({
    companyId,
    kind: 'company.paused',
    actor: 'human',
    payload: { paused },
  });
  return updated;
}

export function cancelTask(taskId: string, reason = 'human_override'): Task {
  const t = db().tasks.require(taskId);
  const updated = db().tasks.update(taskId, (cur) => ({
    ...cur,
    status: 'cancelled',
    lastError: reason,
    updatedAt: nowIso(),
  }));
  appendAudit({
    companyId: t.companyId,
    kind: 'task.cancelled',
    actor: 'human',
    payload: { taskId, reason },
  });
  cancelDependents(taskId, 'parent_cancelled');
  return updated;
}
