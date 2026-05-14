# Agent Company Factory — docs

Architectural MVP: from one goal prompt — to a Company Blueprint, a team of agents, an execution loop with approvals/budget, and a control plane.

## Sections

- [`architecture/`](./architecture/) — diagrams, data model, API contracts, state machines.
- [`decisions/`](./decisions/) — ADRs (Architecture Decision Records).
- [`runbooks/`](./runbooks/) — how to run the demo, local dev setup, troubleshooting.
- [`risks/`](./risks/) — top risks + threat model.
- [`bugs/`](./bugs/) — bug log with templates.
- [`learnings/`](./learnings/) — post-session notes and lessons.
- [`glossary.md`](./glossary.md) — domain terms.

## Conventions

- Significant architectural choices → new ADR in `decisions/ADR-NNN-*.md`. Use `decisions/_template.md`.
- Bugs → new file in `bugs/BUG-NNN-*.md`. Use `bugs/_template.md`.
- Post-session notes → `learnings/YYYY-MM-DD-*.md` from `learnings/_template.md`.
- Diagrams → mermaid (renders in GitHub/Cursor).

## Quick links

- [Component diagram](./architecture/component-diagram.md)
- [Sequence diagram](./architecture/sequence-diagram.md)
- [Data model](./architecture/data-model.md)
- [API contracts](./architecture/api-contracts.md)
- [State machines](./architecture/state-machines.md)
- [Risks & trade-offs](./risks/risks-and-tradeoffs.md)
- [Threat model](./risks/threat-model.md)
- [Demo runbook](./runbooks/demo.md)
- [Local dev](./runbooks/local-dev.md)

## Acceptance criteria mapping

| ID   | Criterion                  | Where it's covered                                                                  |
| ---- | -------------------------- | ----------------------------------------------------------------------------------- |
| AC-1 | Blueprint from goal prompt | `src/factory/modules/goalIntake.ts` + `tests/integration/goalIntake.test.ts`        |
| AC-2 | Data model (9 entities)    | `src/factory/domain/types.ts` + `tests/unit/blueprint.test.ts`                      |
| AC-3 | Execution loop             | `src/factory/modules/orchestrator.ts` + `tests/integration/orchestrator.test.ts`    |
| AC-4 | Safety rails               | `src/factory/policy/*.ts` + tests/integration/orchestrator (cases 1, 2, 10, 11, 12) |
| AC-5 | Observability              | `Run.traceEvents`, `AuditEvent`, `tests/e2e/demo-scenario.test.ts`                  |
| AC-6 | E2E demo                   | `scripts/eval-agent.ts` + `tests/e2e/demo-scenario.test.ts` + UI                    |
