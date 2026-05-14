# ADR-002: Domain model — Approval is a first-class entity, Run is split from Task

- Status: accepted
- Date: 2026-05-14
- Context: [`src/factory/domain/types.ts`](../../src/factory/domain/types.ts)

## Context

Two design choices we considered carefully:

1. Should "approval needed" be a flag on Task, or a separate entity?
2. Should retry attempts share the same Task record, or each be a separate Run?

## Decision

- **Approval is its own entity** with its own state machine (`pending → approved/rejected/expired`), deadline, requester, decider, and audit trail. A task references the approval by id (when it's in `awaiting_approval`).
- **Run is separate from Task.** Each execution attempt creates a new Run with its own trace, tool calls, cost, and outcome. Task carries `attempts` count; Runs carry the actual evidence.

## Consequences

- ✅ Approvals are queryable, expirable, decidable independently. Multiple approvals per task become trivial (one per risky tool call).
- ✅ Per-attempt cost and trace are preserved — failed attempts don't get overwritten by the next retry.
- ✅ Cost-per-agent and cost-per-company aggregations are sums over Runs, not over Tasks (more accurate).
- ❌ More joins for the UI; mitigated by the [Control Plane aggregator](../../src/factory/modules/controlPlane.ts).
- ❌ Two state machines to keep consistent — explicit guards in the orchestrator handle this.

## Rejected alternative

`Task.requiresApproval: boolean + Task.approvedBy: string?` is simpler but cannot express:

- multi-step approvals within one task,
- approval expiry independent of task expiry,
- audit of who approved what at what time without polluting Task.
