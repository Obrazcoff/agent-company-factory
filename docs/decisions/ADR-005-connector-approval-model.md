# ADR-005: Connector model — approval is connector metadata, not handler ad-hoc check

- Status: accepted
- Date: 2026-05-14
- Context: [`src/factory/connectors/types.ts`](../../src/factory/connectors/types.ts), [`src/factory/connectors/registry.ts`](../../src/factory/connectors/registry.ts)

## Context

A handler that decides "this needs approval" inline is fragile: each handler has to remember to check, and policy changes require touching every handler. The brief explicitly calls out approval gates as a first-class concern.

## Decision

- **Connectors expose `requiresApproval: boolean` (and per-action override via `requiresApprovalFor(payload)`)**. The runtime enforces the check **before** invoking `connector.call()`.
- When approval is needed, the runtime throws `PauseForApprovalError(action)`. The orchestrator catches it, transitions the task to `awaiting_approval`, and creates an Approval entity.
- After human decision (approve), the orchestrator re-queues the task. The handler re-runs, sees the approval is `approved`, and proceeds.
- 5 mocks: `web_search`, `gmail` (draft no-approval, send requires approval), `sheets`, `crm`, `calendar` (requires approval).

## Consequences

- ✅ Adding a new "must-approve" connector = one boolean flag.
- ✅ Approval logic is in one place (`runtime.ts` + `policy/approvals.ts`), not spread across handlers.
- ✅ Connectors stay testable in isolation; the approval semantics belong to the policy layer.
- ❌ Re-execution of the handler after approval requires it to be **idempotent** for the pre-approval steps. Documented; the role handlers either short-circuit on cached state or perform pure preparation up to the gate.

## Pattern in handler

```ts
// Outreach role handler — abridged
const draft = await runConnector('gmail', 'draft', { to, subject, body });
await runConnector('gmail', 'send', draft); // throws PauseForApprovalError on first call
```

The `runConnector` helper in [`runtime.ts`](../../src/factory/agents/runtime.ts) checks the approval gate and either creates an Approval (first call) or proceeds (after approval).
