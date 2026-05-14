export class PauseForApprovalError extends Error {
  readonly approvalId: string;
  readonly connectorId: string;
  constructor(approvalId: string, connectorId: string) {
    super(`pause_for_approval:${approvalId}`);
    this.name = 'PauseForApprovalError';
    this.approvalId = approvalId;
    this.connectorId = connectorId;
  }
}

export class BudgetExceededError extends Error {
  readonly cap: number;
  readonly spent: number;
  readonly hard: boolean;
  constructor(spent: number, cap: number, hard: boolean) {
    super(`budget_exceeded:${spent.toFixed(4)}/${cap}${hard ? ':hard' : ''}`);
    this.name = 'BudgetExceededError';
    this.cap = cap;
    this.spent = spent;
    this.hard = hard;
  }
}

export class RunCallCapExceededError extends Error {
  constructor(
    public readonly kind: 'llm' | 'tool',
    public readonly limit: number,
  ) {
    super(`run_call_cap:${kind}:${limit}`);
    this.name = 'RunCallCapExceededError';
  }
}

export class ApprovalRejectedError extends Error {
  constructor(public readonly approvalId: string) {
    super(`approval_rejected:${approvalId}`);
    this.name = 'ApprovalRejectedError';
  }
}

export class ConnectorPermissionError extends Error {
  constructor(public readonly connectorId: string) {
    super(`connector_not_permitted:${connectorId}`);
    this.name = 'ConnectorPermissionError';
  }
}

export class TaskTimeoutError extends Error {
  constructor(public readonly timeoutMs: number) {
    super(`task_timeout:${timeoutMs}ms`);
    this.name = 'TaskTimeoutError';
  }
}
