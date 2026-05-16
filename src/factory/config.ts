export const ORCH_LIMITS = {
  MAX_ATTEMPTS_PER_TASK: 3,
  MAX_DEPTH: 5,
  MAX_QUEUED_PER_COMPANY: 100,
  MAX_TASKS_PER_TICK_PER_COMPANY: 20,
  MAX_LLM_CALLS_PER_RUN: 5,
  MAX_TOOL_CALLS_PER_RUN: 20,
  /** LLM-heavy tasks (market + social copy) may exceed 30s on remote gateways. */
  RUN_TIMEOUT_MS: 120_000,
  TICK_DEADLINE_MS: 5_000,
  STALE_RUN_MS: 60_000,
  LEASE_MS: 30_000,
  HEARTBEAT_INTERVAL_MS: 5_000,
  APPROVAL_DEADLINE_MS: 24 * 60 * 60_000,
} as const;

export const COST_TABLE = {
  llm_call_usd: 0.01,
  connector_call_usd: 0.001,
} as const;

export const FACTORY_DEFAULTS = {
  seed: Number(process.env.FACTORY_SEED ?? 42),
  tenantId: 'default',
  dailyBudgetUsd: Number(process.env.DEFAULT_DAILY_BUDGET_USD ?? 50),
  hardCapMultiplier: 1.5,
} as const;
