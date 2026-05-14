# ADR-003: Orchestrator hardening — 12 guards against deadlock, runaway, loops

- Status: accepted
- Date: 2026-05-14
- Context: [`src/factory/modules/orchestrator.ts`](../../src/factory/modules/orchestrator.ts), [`src/factory/config.ts`](../../src/factory/config.ts), [`src/factory/agents/runtime.ts`](../../src/factory/agents/runtime.ts), [`tests/integration/orchestrator.test.ts`](../../tests/integration/orchestrator.test.ts)

## Context

LLM-driven multi-agent systems have well-known failure modes: handlers loop, retries explode, approvals are forgotten, costs run away, two workers grab the same task, dependents wait forever for a dead parent. We need explicit, testable guards for each.

## Decision — 12 guards

| #   | Threat                 | Mitigation                                              | Where                  | Test    |
| --- | ---------------------- | ------------------------------------------------------- | ---------------------- | ------- |
| 1   | Infinite retries       | `maxAttempts` (3) + dead-letter audit                   | runtime + orchestrator | case 1  |
| 2   | Forgotten approvals    | `deadlineAt` + `sweepExpiredApprovals()` per tick       | policy + orchestrator  | case 2  |
| 3   | Hung handlers          | `heartbeatAt` + `sweepStaleRuns()` (60s threshold)      | runtime + orchestrator | case 3  |
| 4   | Concurrent claim       | Atomic `tryClaim()` CAS with `lockedBy` + `lockedUntil` | queue                  | case 4  |
| 5   | Cyclic dependencies    | `hasCycle()` DFS at enqueue time                        | queue + enqueue        | case 5  |
| 6   | Recursive expansion    | `Task.depth` + `MAX_DEPTH=5`                            | enqueue                | case 6  |
| 7   | Per-run timeout        | `Promise.race(handler, timeout)` → `timed_out`          | runtime                | case 7  |
| 8   | Tick can't finish      | `TICK_DEADLINE_MS=5000` + `deferred` count              | orchestrator           | case 8  |
| 9   | Tool-call loop         | `MAX_TOOL_CALLS_PER_RUN=20`                             | runtime                | case 9  |
| 10  | Double-decide approval | Atomic CAS in `decideApproval` (single check)           | policy                 | case 10 |
| 11  | Budget runaway         | `dailyCap` (soft, fails task) + `hardCap` (kill switch) | policy                 | case 11 |
| 12  | Cascading deadlock     | `cascadeCancel()` on parent fail/cancel                 | orchestrator           | case 12 |

## Consequences

- ✅ Every failure mode has a name, a guard, and a test.
- ✅ The orchestrator is observable: every guard emits an audit event.
- ✅ Limits are centralized in `ORCH_LIMITS` — easy to tune for V1.
- ❌ Adds complexity to the runtime (errors as control flow: `PauseForApprovalError`, `BudgetExceededError`, `RunCallCapExceededError`, `RunTimeoutError`). Documented and tested.
- ❌ `tryClaim` in-memory works because of single-process; in V1 must move to DB-level locking. Interface preserved.
