export type FactoryEventKind =
  | 'company.created'
  | 'company.paused'
  | 'company.killed'
  | 'proposal.created'
  | 'proposal.accepted'
  | 'proposal.rebuilt'
  | 'proposal.rejected'
  | 'agent.hired'
  | 'agent.paused'
  | 'task.enqueued'
  | 'task.started'
  | 'task.done'
  | 'task.failed'
  | 'task.cancelled'
  | 'task.dead_letter'
  | 'task.skipped'
  | 'task.cancelled_cascade'
  | 'task.rejected_cyclic'
  | 'task.rejected_max_depth'
  | 'task.rejected_backlog_full'
  | 'run.started'
  | 'run.timeout'
  | 'run.stale_recovered'
  | 'run.call_cap_exceeded'
  | 'tool.called'
  | 'tool.failed'
  | 'approval.requested'
  | 'approval.decided'
  | 'approval.expired'
  | 'budget.exceeded'
  | 'action.executed';

export type FactoryEvent = {
  kind: FactoryEventKind;
  companyId: string;
  ts: string;
  payload: Record<string, unknown>;
};
