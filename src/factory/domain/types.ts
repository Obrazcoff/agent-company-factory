import type { Locale } from '@/i18n/constants';

export type TenantId = string;
export type CompanyId = string;
export type AgentId = string;
export type TaskId = string;
export type RunId = string;
export type ApprovalId = string;
export type SkillId = string;
export type ConnectorId = string;
export type MemoryId = string;
export type AuditId = string;
export type WorkerId = string;

export type ISODate = string;

export type AgentRole = 'CEO' | 'PM' | 'Researcher' | 'Outreach' | 'Ops';

export type KPI = {
  name: string;
  target: number | string;
  unit?: string;
};

export type EscalationRule = {
  trigger: 'budget_exceeded' | 'tool_failed' | 'approval_rejected' | 'max_attempts';
  action: 'notify_human' | 'pause_agent' | 'cancel_task';
};

export type Budget = {
  dailyCapUsd: number;
  hardCapUsd: number;
  spentTodayUsd: number;
  lastResetAt: ISODate;
};

export type CompanyStatus = 'proposal' | 'active' | 'paused' | 'archived';

export type Company = {
  id: CompanyId;
  tenantId: TenantId;
  missionPrompt: string;
  mission: string;
  kpis: KPI[];
  budget: Budget;
  status: CompanyStatus;
  createdAt: ISODate;
  /** UI / demo copy (e.g. outreach) — from request locale at company creation. */
  contentLocale?: Locale;
};

export type ProposalId = string;

/** A proposed agent within a CompanyProposal — not yet materialized in db().agents */
export type ProposedAgent = {
  id: string;
  role: AgentRole;
  /** Blueprint / LLM name (technical) */
  name: string;
  /** Fun stable label for UI, e.g. "Director Frog" */
  displayName: string;
  /** Slug for `/agents/{slug}.svg` */
  avatarSlug: string;
  systemPrompt: string;
  permissions: ConnectorId[];
  /** Client can toggle this before accepting */
  included: boolean;
};

export type ProposalStatus = 'reviewing' | 'accepted' | 'rejected' | 'rebuilding';

export type CompanyProposal = {
  id: ProposalId;
  companyId: CompanyId;
  missionPrompt: string;
  feedback?: string;
  blueprint: Blueprint;
  proposedAgents: ProposedAgent[];
  status: ProposalStatus;
  llmCostUsd: number;
  createdAt: ISODate;
  updatedAt: ISODate;
};

export type Agent = {
  id: AgentId;
  companyId: CompanyId;
  role: AgentRole;
  /** Blueprint / LLM name */
  name: string;
  /** Fun stable label for UI */
  displayName: string;
  avatarSlug: string;
  systemPrompt: string;
  permissions: ConnectorId[];
  escalationRules: EscalationRule[];
  status: 'idle' | 'busy' | 'paused';
  costToDateUsd: number;
};

export type Skill = {
  id: SkillId;
  name: string;
  description: string;
  requiredConnectors: ConnectorId[];
};

export type ConnectorKind = 'web_search' | 'gmail' | 'sheets' | 'crm' | 'calendar';

export type ConnectorMeta = {
  id: ConnectorId;
  name: string;
  kind: ConnectorKind;
  requiresApproval: boolean;
  scopes: string[];
  secretsRef: string;
};

export type TaskStatus = 'queued' | 'running' | 'awaiting_approval' | 'done' | 'failed' | 'cancelled';

export type Task = {
  id: TaskId;
  companyId: CompanyId;
  agentId: AgentId;
  kind: string;
  input: unknown;
  status: TaskStatus;
  dependsOn: TaskId[];
  idempotencyKey: string;
  scheduledAt: ISODate;
  attempts: number;
  maxAttempts: number;
  lockedBy?: WorkerId;
  lockedUntil?: ISODate;
  parentRunId?: RunId;
  depth: number;
  runTimeoutMs: number;
  estCostUsd: number;
  lastError?: string;
  createdAt: ISODate;
  updatedAt: ISODate;
};

export type ToolCall = {
  connectorId: ConnectorId;
  input: unknown;
  output?: unknown;
  error?: string;
  costUsd: number;
  latencyMs: number;
  ts: ISODate;
};

export type TraceEvent = {
  step: string;
  status: 'started' | 'completed' | 'failed';
  message?: string;
  data?: unknown;
  ts: ISODate;
};

export type RunStatus = 'running' | 'done' | 'failed' | 'timed_out';

export type Run = {
  id: RunId;
  taskId: TaskId;
  agentId: AgentId;
  companyId: CompanyId;
  startedAt: ISODate;
  heartbeatAt: ISODate;
  finishedAt?: ISODate;
  status: RunStatus;
  attempts: number;
  traceEvents: TraceEvent[];
  toolCalls: ToolCall[];
  llmCallCount: number;
  toolCallCount: number;
  costUsd: number;
  output?: unknown;
  error?: string;
  depth: number;
};

export type MemoryKind = 'fact' | 'note' | 'artifact';

export type Memory = {
  id: MemoryId;
  companyId: CompanyId;
  agentId?: AgentId;
  kind: MemoryKind;
  content: string;
  refs: string[];
  createdAt: ISODate;
};

export type ApprovalAction = {
  connectorId: ConnectorId;
  payload: unknown;
  description: string;
};

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired';

export type Approval = {
  id: ApprovalId;
  taskId: TaskId;
  runId: RunId;
  companyId: CompanyId;
  requestedBy: AgentId;
  action: ApprovalAction;
  status: ApprovalStatus;
  requestedAt: ISODate;
  deadlineAt: ISODate;
  decidedAt?: ISODate;
  decidedBy?: string;
  reason?: string;
};

export type AuditActor = 'system' | 'agent' | 'human';

export type AuditEvent = {
  id: AuditId;
  companyId: CompanyId;
  ts: ISODate;
  actor: AuditActor;
  actorId?: string;
  kind: string;
  payload: Record<string, unknown>;
};

export type Blueprint = {
  mission: string;
  kpis: KPI[];
  dailyCapUsd: number;
  approvals: ConnectorId[];
  agents: Array<{
    role: AgentRole;
    name: string;
    systemPrompt: string;
    permissions: ConnectorId[];
  }>;
  initialTasks: Array<{
    kind: string;
    role: AgentRole;
    input: Record<string, unknown>;
    dependsOnIndex?: number[];
  }>;
};
