import { db } from '../store/db';
import { newId, nowIso } from '../domain/ids';
import { ORCH_LIMITS, COST_TABLE } from '../config';
import { appendAudit } from '../audit/audit';
import { canSpend, recordSpend, recordAgentSpend, killSwitchIfHardCap } from '../policy/budget';
import { createApproval, findPendingApprovalForTask } from '../policy/approvals';
import { requireConnector } from '../connectors/registry';
import { createLlmClient, type LlmClient, type LlmMessage } from '@/llm/provider';
import {
  PauseForApprovalError,
  BudgetExceededError,
  RunCallCapExceededError,
  ApprovalRejectedError,
  ConnectorPermissionError,
  TaskTimeoutError,
} from './errors';
import { roleHandlers } from './roles';
import type { Agent, Approval, Company, ConnectorId, Run, Task, TraceEvent } from '../domain/types';
import { enqueueTask } from '../modules/enqueue';

export type FollowUpRequest = {
  agentRole?: string;
  agentId?: string;
  kind: string;
  input: unknown;
  dependsOn?: string[];
  estCostUsd?: number;
};

export type RuntimeCtx = {
  task: Task;
  agent: Agent;
  company: Company;
  run: Run;
  llm: LlmClient;
  call<I = unknown, O = unknown>(
    connectorId: ConnectorId,
    input: I,
    opts?: { description?: string },
  ): Promise<O>;
  llmGenerate(messages: LlmMessage[]): Promise<string>;
  emit(step: string, status: TraceEvent['status'], message?: string, data?: unknown): void;
  followUp(req: FollowUpRequest): void;
};

export type RoleHandler = (ctx: RuntimeCtx) => Promise<{ output?: unknown }>;

export type ExecuteOutcome =
  | { kind: 'done'; run: Run; output?: unknown; followUps: FollowUpRequest[] }
  | { kind: 'awaiting_approval'; run: Run; approvalId: string }
  | { kind: 'failed'; run: Run; reason: string; retryable: boolean };

function findApprovedApproval(taskId: string, connectorId: string): Approval | undefined {
  return db()
    .approvals.find(
      (a) => a.taskId === taskId && a.action.connectorId === connectorId && a.status === 'approved',
    )
    .at(-1);
}

function findRejectedApproval(taskId: string, connectorId: string): Approval | undefined {
  return db()
    .approvals.find(
      (a) =>
        a.taskId === taskId &&
        a.action.connectorId === connectorId &&
        (a.status === 'rejected' || a.status === 'expired'),
    )
    .at(-1);
}

function bumpHeartbeat(runId: string): void {
  db().runs.update(runId, (r) => ({ ...r, heartbeatAt: nowIso() }));
}

async function runWithTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new TaskTimeoutError(timeoutMs)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function executeRun(task: Task): Promise<ExecuteOutcome> {
  const company = db().companies.require(task.companyId);
  const agent = db().agents.require(task.agentId);

  const run: Run = {
    id: newId('run'),
    taskId: task.id,
    agentId: agent.id,
    companyId: company.id,
    startedAt: nowIso(),
    heartbeatAt: nowIso(),
    status: 'running',
    attempts: task.attempts + 1,
    traceEvents: [],
    toolCalls: [],
    llmCallCount: 0,
    toolCallCount: 0,
    costUsd: 0,
    depth: task.depth,
  };
  db().runs.create(run);
  appendAudit({
    companyId: company.id,
    kind: 'run.started',
    actor: 'agent',
    actorId: agent.id,
    payload: { runId: run.id, taskId: task.id, attempt: run.attempts, depth: run.depth },
  });

  db().agents.update(agent.id, (a) => ({ ...a, status: 'busy' }));

  const followUps: FollowUpRequest[] = [];
  const heartbeatTimer = setInterval(() => bumpHeartbeat(run.id), ORCH_LIMITS.HEARTBEAT_INTERVAL_MS);

  const ctx: RuntimeCtx = {
    task,
    agent,
    company,
    run,
    llm: createLlmClient(),
    emit(step, status, message, data) {
      const event: TraceEvent = { step, status, message, data, ts: nowIso() };
      db().runs.update(run.id, (r) => ({ ...r, traceEvents: [...r.traceEvents, event] }));
    },
    followUp(req) {
      followUps.push(req);
    },
    async llmGenerate(messages) {
      const updated = db().runs.require(run.id);
      if (updated.llmCallCount + 1 > ORCH_LIMITS.MAX_LLM_CALLS_PER_RUN) {
        throw new RunCallCapExceededError('llm', ORCH_LIMITS.MAX_LLM_CALLS_PER_RUN);
      }
      const check = canSpend(company.id, COST_TABLE.llm_call_usd);
      if (!check.allowed) {
        throw new BudgetExceededError(check.spent, check.cap, check.reason === 'hard_cap');
      }
      const result = await ctx.llm.generate(messages);
      recordSpend(company.id, COST_TABLE.llm_call_usd);
      recordAgentSpend(agent.id, COST_TABLE.llm_call_usd);
      db().runs.update(run.id, (r) => ({
        ...r,
        llmCallCount: r.llmCallCount + 1,
        costUsd: r.costUsd + COST_TABLE.llm_call_usd,
      }));
      return result;
    },
    async call<I, O>(connectorId: ConnectorId, input: I, opts?: { description?: string }): Promise<O> {
      if (!agent.permissions.includes(connectorId)) {
        throw new ConnectorPermissionError(connectorId);
      }
      const updated = db().runs.require(run.id);
      if (updated.toolCallCount + 1 > ORCH_LIMITS.MAX_TOOL_CALLS_PER_RUN) {
        throw new RunCallCapExceededError('tool', ORCH_LIMITS.MAX_TOOL_CALLS_PER_RUN);
      }
      const connector = requireConnector(connectorId);

      if (connector.requiresApproval) {
        const rejected = findRejectedApproval(task.id, connectorId);
        if (rejected) throw new ApprovalRejectedError(rejected.id);
        const approved = findApprovedApproval(task.id, connectorId);
        if (!approved) {
          const pending = findPendingApprovalForTask(task.id);
          if (pending) throw new PauseForApprovalError(pending.id, pending.action.connectorId);
          const approval = createApproval({
            taskId: task.id,
            runId: run.id,
            companyId: company.id,
            requestedBy: agent.id,
            action: {
              connectorId,
              payload: input,
              description: opts?.description ?? `${connector.name}`,
            },
          });
          throw new PauseForApprovalError(approval.id, connectorId);
        }
      }

      const estCost = connector.estimateCost(input as never);
      const check = canSpend(company.id, estCost);
      if (!check.allowed) {
        throw new BudgetExceededError(check.spent, check.cap, check.reason === 'hard_cap');
      }

      try {
        const result = await connector.call(input as never, {
          companyId: company.id,
          agentId: agent.id,
          runId: run.id,
          secretsRef: `vault://factory/${connectorId}`,
        });
        recordSpend(company.id, result.costUsd);
        recordAgentSpend(agent.id, result.costUsd);
        db().runs.update(run.id, (r) => ({
          ...r,
          toolCallCount: r.toolCallCount + 1,
          costUsd: r.costUsd + result.costUsd,
          toolCalls: [
            ...r.toolCalls,
            {
              connectorId,
              input,
              output: result.output,
              costUsd: result.costUsd,
              latencyMs: result.latencyMs,
              ts: nowIso(),
            },
          ],
        }));
        appendAudit({
          companyId: company.id,
          kind: 'tool.called',
          actor: 'agent',
          actorId: agent.id,
          payload: { runId: run.id, connectorId, costUsd: result.costUsd },
        });
        if (connector.requiresApproval) {
          appendAudit({
            companyId: company.id,
            kind: 'action.executed',
            actor: 'agent',
            actorId: agent.id,
            payload: { runId: run.id, connectorId, summary: opts?.description },
          });
        }
        return result.output as O;
      } catch (error) {
        appendAudit({
          companyId: company.id,
          kind: 'tool.failed',
          actor: 'agent',
          actorId: agent.id,
          payload: { runId: run.id, connectorId, error: String(error) },
        });
        throw error;
      }
    },
  };

  const handler = roleHandlers[agent.role];

  try {
    if (!handler) throw new Error(`no handler for role ${agent.role}`);
    const result = await runWithTimeout(handler(ctx), task.runTimeoutMs);

    db().runs.update(run.id, (r) => ({ ...r, status: 'done', finishedAt: nowIso(), output: result.output }));
    db().agents.update(agent.id, (a) => ({ ...a, status: 'idle' }));
    appendAudit({
      companyId: company.id,
      kind: 'task.done',
      actor: 'agent',
      actorId: agent.id,
      payload: { runId: run.id, taskId: task.id, costUsd: db().runs.require(run.id).costUsd },
    });
    killSwitchIfHardCap(company.id);
    return { kind: 'done', run: db().runs.require(run.id), output: result.output, followUps };
  } catch (error) {
    db().agents.update(agent.id, (a) => ({ ...a, status: 'idle' }));

    if (error instanceof PauseForApprovalError) {
      db().runs.update(run.id, (r) => ({
        ...r,
        status: 'done',
        finishedAt: nowIso(),
        output: { paused: true, approvalId: error.approvalId },
      }));
      return { kind: 'awaiting_approval', run: db().runs.require(run.id), approvalId: error.approvalId };
    }

    if (error instanceof BudgetExceededError) {
      db().runs.update(run.id, (r) => ({
        ...r,
        status: 'failed',
        finishedAt: nowIso(),
        error: error.message,
      }));
      appendAudit({
        companyId: company.id,
        kind: 'budget.exceeded',
        actor: 'system',
        payload: { runId: run.id, taskId: task.id, spent: error.spent, cap: error.cap, hard: error.hard },
      });
      killSwitchIfHardCap(company.id);
      return { kind: 'failed', run: db().runs.require(run.id), reason: error.message, retryable: false };
    }

    if (error instanceof RunCallCapExceededError) {
      db().runs.update(run.id, (r) => ({
        ...r,
        status: 'failed',
        finishedAt: nowIso(),
        error: error.message,
      }));
      appendAudit({
        companyId: company.id,
        kind: 'run.call_cap_exceeded',
        actor: 'system',
        payload: { runId: run.id, taskId: task.id, kind: error.kind, limit: error.limit },
      });
      return { kind: 'failed', run: db().runs.require(run.id), reason: error.message, retryable: false };
    }

    if (error instanceof TaskTimeoutError) {
      db().runs.update(run.id, (r) => ({
        ...r,
        status: 'timed_out',
        finishedAt: nowIso(),
        error: error.message,
      }));
      appendAudit({
        companyId: company.id,
        kind: 'run.timeout',
        actor: 'system',
        payload: { runId: run.id, taskId: task.id, timeoutMs: error.timeoutMs },
      });
      return { kind: 'failed', run: db().runs.require(run.id), reason: error.message, retryable: true };
    }

    const message = error instanceof Error ? error.message : String(error);
    db().runs.update(run.id, (r) => ({ ...r, status: 'failed', finishedAt: nowIso(), error: message }));
    return { kind: 'failed', run: db().runs.require(run.id), reason: message, retryable: true };
  } finally {
    clearInterval(heartbeatTimer);
  }
}

export function expandFollowUp(
  task: Task,
  followUp: FollowUpRequest,
  parentRunId: string,
): { ok: boolean; reason?: string } {
  const company = db().companies.require(task.companyId);
  const agentId =
    followUp.agentId ??
    db().agents.find(
      (a) => a.companyId === task.companyId && a.role === (followUp.agentRole as Agent['role']),
    )[0]?.id;
  if (!agentId) return { ok: false, reason: 'no_agent_for_role' };
  const result = enqueueTask({
    companyId: company.id,
    agentId,
    kind: followUp.kind,
    input: followUp.input,
    dependsOn: followUp.dependsOn,
    parentRunId,
    depth: task.depth + 1,
    estCostUsd: followUp.estCostUsd,
  });
  return result.ok ? { ok: true } : { ok: false, reason: result.reason };
}
