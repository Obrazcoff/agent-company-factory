import { db } from '../store/db';
import { appendAudit } from '../audit/audit';
import { newId, nowIso } from '../domain/ids';
import { ORCH_LIMITS } from '../config';
import type {
  Approval,
  ApprovalAction,
  ApprovalId,
  ApprovalStatus,
  CompanyId,
  RunId,
  TaskId,
} from '../domain/types';

export type CreateApprovalArgs = {
  taskId: TaskId;
  runId: RunId;
  companyId: CompanyId;
  requestedBy: string;
  action: ApprovalAction;
};

export function createApproval(args: CreateApprovalArgs): Approval {
  const now = nowIso();
  const deadline = new Date(Date.now() + ORCH_LIMITS.APPROVAL_DEADLINE_MS).toISOString();
  const approval: Approval = {
    id: newId('apr'),
    taskId: args.taskId,
    runId: args.runId,
    companyId: args.companyId,
    requestedBy: args.requestedBy,
    action: args.action,
    status: 'pending',
    requestedAt: now,
    deadlineAt: deadline,
  };
  db().approvals.create(approval);
  appendAudit({
    companyId: args.companyId,
    kind: 'approval.requested',
    actor: 'agent',
    actorId: args.requestedBy,
    payload: {
      approvalId: approval.id,
      taskId: args.taskId,
      connectorId: args.action.connectorId,
      description: args.action.description,
    },
  });
  return approval;
}

export type DecideResult =
  | { ok: true; approval: Approval }
  | { ok: false; reason: 'not_found' | 'already_decided'; current?: ApprovalStatus };

export function decideApproval(
  id: ApprovalId,
  decision: 'approved' | 'rejected',
  decidedBy = 'human',
  reason?: string,
): DecideResult {
  const existing = db().approvals.get(id);
  if (!existing) return { ok: false, reason: 'not_found' };
  if (existing.status !== 'pending') {
    return { ok: false, reason: 'already_decided', current: existing.status };
  }
  const updated = db().approvals.update(id, (cur) => ({
    ...cur,
    status: decision,
    decidedAt: nowIso(),
    decidedBy,
    reason,
  }));
  appendAudit({
    companyId: updated.companyId,
    kind: 'approval.decided',
    actor: 'human',
    actorId: decidedBy,
    payload: { approvalId: id, decision, reason },
  });
  return { ok: true, approval: updated };
}

export function expireOverdueApprovals(): Approval[] {
  const now = Date.now();
  const pending = db().approvals.find((a) => a.status === 'pending');
  const expired: Approval[] = [];
  for (const a of pending) {
    if (Date.parse(a.deadlineAt) <= now) {
      const upd = db().approvals.update(a.id, (cur) => ({
        ...cur,
        status: 'expired',
        decidedAt: nowIso(),
        decidedBy: 'system',
        reason: 'deadline_exceeded',
      }));
      expired.push(upd);
      appendAudit({
        companyId: upd.companyId,
        kind: 'approval.expired',
        actor: 'system',
        payload: { approvalId: upd.id, taskId: upd.taskId },
      });
    }
  }
  return expired;
}

export function findPendingApprovalForTask(taskId: TaskId): Approval | undefined {
  return db().approvals.find((a) => a.taskId === taskId && a.status === 'pending')[0];
}
