# ADR-006: Client-Facing Proposal Review Stage

**Status:** Accepted  
**Date:** 2026-05-14  
**Context:** Agent Company Factory MVP

---

## Context

In the initial MVP the flow was a single step: POST mission prompt → company + agents + tasks materialized immediately. There was no opportunity for the client to review, approve, or modify the blueprint before resources were committed.

Clients need to:

- See which AI agents the system proposes to hire.
- Exclude specific roles they find unnecessary.
- Request a rebuild with revised instructions.
- Accept the final configuration before tasks start.

---

## Decision

Introduce a lightweight **Proposal Review** stage between prompt entry and company activation.

### Flow

```
                        Client
                           │
                     POST /api/proposals   (draftProposal)
                           │
                    ┌──────▼──────┐
                    │  Proposal   │  status: reviewing
                    │  CompanyProposal │  company.status: proposal
                    └──────┬──────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
   PATCH agent.included  POST rebuild     POST accept
   (excludeAgent)         (rebuildProposal)  (acceptProposal)
          │                │                │
   Update flag         New proposal      Materialize:
   in memory           same companyId    agents + tasks
                       status: reviewing  company → active
```

### Domain additions

| Entity            | Change                                                                  |
| ----------------- | ----------------------------------------------------------------------- |
| `Company.status`  | Added `'proposal'` variant                                              |
| `CompanyProposal` | New entity — holds blueprint + `ProposedAgent[]` with `included` flags  |
| `ProposedAgent`   | Lightweight preview agent (not persisted to `db().agents` until accept) |

### API surface

| Method | Path                                 | Description                                                      |
| ------ | ------------------------------------ | ---------------------------------------------------------------- |
| POST   | `/api/proposals`                     | Create a draft proposal (LLM call, no agents persisted)          |
| GET    | `/api/proposals/:id`                 | Fetch proposal state                                             |
| POST   | `/api/proposals/:id/accept`          | Materialize included agents + tasks                              |
| POST   | `/api/proposals/:id/rebuild`         | Re-call LLM with optional feedback, new proposal on same company |
| PATCH  | `/api/proposals/:id/agents/:agentId` | Toggle `included` flag                                           |

### Key design choices

1. **Draft does NOT persist agents.** `db().agents` is only written on `accept`. This keeps the RAM store clean; a rebuild simply discards the old proposal and creates a new one on the same company entity.
2. **Company entity created early** (status `proposal`) so we have a stable `companyId` for audit events and the proposal FK throughout the review cycle.
3. **Filtering on accept.** Only blueprint agents whose role appears in the included `ProposedAgent` list are passed to `intakeAndCreateCompany`. Tasks referencing excluded roles are simply omitted (audited as `task.skipped`).
4. **Rebuild reuses the existing company.** No orphaned company entities pile up; the old proposal transitions to `rebuilding` status and a new one is created under the same `companyId`.
5. **UI path is additive.** "Skip review" still calls `POST /api/companies` directly — existing integrations and tests are unaffected.

---

## Alternatives Considered

| Alternative                                                                  | Why Rejected                                                                                  |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Create proposal as a completely separate entity with no company until accept | Complicates audit trail — no FK for pre-accept events                                         |
| Store proposed agents in `db().agents` with a `proposed` flag                | Pollutes the agent repository with transient data; orchestrator would need to filter them out |
| Single endpoint accept-or-reject without rebuild                             | Doesn't support iterative refinement based on client feedback                                 |

---

## Consequences

- An additional repository (`db().proposals`) is added to the in-memory store.
- `intakeAndCreateCompany` now accepts an optional `prebuiltBlueprint` and `existingCompanyId` to support the accept path without a second LLM call.
- `CompanyStatus` type now includes `'proposal'`.
- UI gains a two-step flow: "Review Blueprint" → `ProposalReview` component → Control Plane.
