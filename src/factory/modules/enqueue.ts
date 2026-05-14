import { db } from '../store/db';
import { queue } from '../queue/queue';
import { ORCH_LIMITS } from '../config';
import { newId, nowIso } from '../domain/ids';
import { appendAudit } from '../audit/audit';
import type { CompanyId, AgentId, Task, TaskId, RunId } from '../domain/types';

export type EnqueueArgs = {
  companyId: CompanyId;
  agentId: AgentId;
  kind: string;
  input: unknown;
  dependsOn?: TaskId[];
  parentRunId?: RunId;
  depth?: number;
  estCostUsd?: number;
};

export type EnqueueResult =
  | { ok: true; task: Task; reused?: boolean }
  | {
      ok: false;
      reason:
        | 'company_paused'
        | 'agent_unknown'
        | 'company_unknown'
        | 'cyclic_dependency'
        | 'max_depth_exceeded'
        | 'backlog_full'
        | 'unknown_dependency';
    };

function hashIdempotency(args: EnqueueArgs): string {
  return `${args.companyId}:${args.agentId}:${args.kind}:${JSON.stringify(args.input ?? null)}`;
}

export function enqueueTask(args: EnqueueArgs): EnqueueResult {
  const company = db().companies.get(args.companyId);
  if (!company) return { ok: false, reason: 'company_unknown' };
  if (company.status === 'paused') {
    appendAudit({
      companyId: args.companyId,
      kind: 'task.rejected_backlog_full',
      actor: 'system',
      payload: { reason: 'company_paused', kind: args.kind },
    });
    return { ok: false, reason: 'company_paused' };
  }
  const agent = db().agents.get(args.agentId);
  if (!agent || agent.companyId !== args.companyId) {
    return { ok: false, reason: 'agent_unknown' };
  }

  const depth = args.depth ?? 0;
  if (depth > ORCH_LIMITS.MAX_DEPTH) {
    appendAudit({
      companyId: args.companyId,
      kind: 'task.rejected_max_depth',
      actor: 'system',
      payload: { kind: args.kind, depth, max: ORCH_LIMITS.MAX_DEPTH },
    });
    return { ok: false, reason: 'max_depth_exceeded' };
  }

  const dependsOn = args.dependsOn ?? [];
  for (const depId of dependsOn) {
    if (!db().tasks.get(depId)) return { ok: false, reason: 'unknown_dependency' };
  }

  const key = hashIdempotency(args);
  const existing = db().tasks.find((t) => t.idempotencyKey === key);
  if (existing.length > 0) {
    return { ok: true, task: existing[0]!, reused: true };
  }

  const allTasks = db().tasks.all({ companyId: args.companyId });
  const queuedCount = allTasks.filter(
    (t) => t.status === 'queued' || t.status === 'awaiting_approval' || t.status === 'running',
  ).length;
  if (queuedCount >= ORCH_LIMITS.MAX_QUEUED_PER_COMPANY) {
    appendAudit({
      companyId: args.companyId,
      kind: 'task.rejected_backlog_full',
      actor: 'system',
      payload: { kind: args.kind, queuedCount },
    });
    return { ok: false, reason: 'backlog_full' };
  }

  const candidateId: TaskId = newId('tsk');
  if (queue.hasCycle(allTasks, dependsOn, candidateId)) {
    appendAudit({
      companyId: args.companyId,
      kind: 'task.rejected_cyclic',
      actor: 'system',
      payload: { kind: args.kind, dependsOn },
    });
    return { ok: false, reason: 'cyclic_dependency' };
  }

  const task: Task = {
    id: candidateId,
    companyId: args.companyId,
    agentId: args.agentId,
    kind: args.kind,
    input: args.input,
    status: 'queued',
    dependsOn,
    idempotencyKey: key,
    scheduledAt: nowIso(),
    attempts: 0,
    maxAttempts: ORCH_LIMITS.MAX_ATTEMPTS_PER_TASK,
    parentRunId: args.parentRunId,
    depth,
    runTimeoutMs: ORCH_LIMITS.RUN_TIMEOUT_MS,
    estCostUsd: args.estCostUsd ?? 0.02,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  db().tasks.create(task);
  appendAudit({
    companyId: args.companyId,
    kind: 'task.enqueued',
    actor: 'system',
    payload: { taskId: task.id, kind: task.kind, agentId: task.agentId, depth },
  });
  return { ok: true, task };
}
