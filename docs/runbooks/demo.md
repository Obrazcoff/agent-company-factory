# Demo runbook (5 minutes)

Two ways to run the demo: **CLI** (deterministic, fastest) or **UI** (visual, recommended for the interview).

## Option A — CLI (deterministic, 30 seconds)

```bash
npm run eval:agent
```

Expected output: 8/8 acceptance criteria PASS.

## Option B — UI (recommended for interview)

```bash
npm run dev
# open http://localhost:3000
```

### Script

1. **AC-1, AC-2: Goal → Blueprint.**
   - Land on the form with the default prompt (lead-gen scenario).
   - Click **Create company**.
   - "Mission & budget" card shows the mission, KPIs, daily/hard cap.
   - "Team" panel shows 4 agents (PM, Researcher, Outreach, Ops).
   - "Tasks" tab shows 7 initial tasks.

2. **AC-3, AC-5: Execution loop with observability.**
   - Click **Run tick** 4–5 times.
   - Watch tasks transition `queued → running → done`.
   - Notice "Cost per agent" updating; "Audit timeline" filling with `task.enqueued`, `run.started`, `tool.called`, `task.done`.

3. **AC-4: Approval gate.**
   - After Researcher finishes, Outreach drafts emails. The first `gmail.send` triggers an approval.
   - "Approvals" tab shows 3 pending approvals (one per email).
   - Approve 2, reject 1. Click **Run tick**.
   - Approved emails progress to `done`; the rejected task → `failed`.

4. **AC-4: Manual override.**
   - In "Team", click **Pause** on the Outreach agent. Click **Run tick** — that agent's queued tasks stay `queued`.
   - Resume. Tasks proceed.

5. **AC-6: Final state.**
   - "Cost per agent" shows totals < $0.05.
   - "Audit timeline" has ~50+ events with timestamps.
   - "Tasks" tab shows ≥7 tasks done, ≥1 failed (the rejected one).

## Where each AC lives

| AC   | UI path                              | Code                                                 |
| ---- | ------------------------------------ | ---------------------------------------------------- |
| AC-1 | "Mission & budget" card after create | `goalIntake.ts`, mock blueprint in `llm/provider.ts` |
| AC-2 | "Team" + "Tasks" tab                 | `domain/types.ts`, `teamDesigner.ts`                 |
| AC-3 | "Run tick" button + "Tasks" tab      | `orchestrator.ts`, `runtime.ts`                      |
| AC-4 | "Approvals" tab + "Pause" buttons    | `policy/approvals.ts`, `policy/budget.ts`            |
| AC-5 | "Audit timeline" + "Cost per agent"  | `audit.ts`, `Run.toolCalls`/`traceEvents`            |
| AC-6 | All of the above                     | `scripts/eval-agent.ts`                              |

## Failure scenarios to mention live

Without running them, point at the orchestrator hardening section in [ADR-003](../decisions/ADR-003-orchestrator-hardening.md). All 12 are covered by `tests/integration/orchestrator.test.ts`.
