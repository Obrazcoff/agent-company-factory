# Glossary

| Term           | Definition                                                                                         |
| -------------- | -------------------------------------------------------------------------------------------------- |
| Company        | A goal-driven autonomous unit. Has a mission, KPIs, budget, agents, audit trail.                   |
| Blueprint      | LLM-generated plan: mission, KPIs, budget cap, approvals list, agent specs, initial tasks.         |
| Agent          | A role inside a company (PM, Researcher, Outreach, Ops, CEO). Has permissions and a system prompt. |
| Role handler   | Code that implements an agent's behavior given a task.                                             |
| Skill          | A capability requiring one or more connectors.                                                     |
| Connector      | An external integration (web_search, gmail, sheets, crm, calendar). Has `requiresApproval`.        |
| Task           | Unit of work assigned to an agent. Has status, attempts, dependsOn, idempotencyKey.                |
| Run            | One execution attempt of a task. Owns trace events, tool calls, cost, llm/tool counts.             |
| Approval       | First-class entity for human-gated actions. Pending → approved/rejected/expired.                   |
| Budget         | Daily and hard caps; soft cap fails the task, hard cap kill-switches the company.                  |
| AuditEvent     | Append-only log entry. Every state change emits one.                                               |
| Memory         | Stored facts/notes/artifacts. (V1: plain text; V2: vector RAG.)                                    |
| Tick           | One step of the orchestrator: sweep expired/stale, pick ready tasks, execute, expand follow-ups.   |
| Lease / claim  | Atomic CAS that prevents two tick workers from running the same task.                              |
| Heartbeat      | Periodic timestamp update by a Run, used by sweepStaleRuns to detect dead handlers.                |
| Follow-up task | A task enqueued by a role handler during execution; carries `parentRunId`, depth+1.                |
| Dead letter    | A task that exceeded `maxAttempts` and has no further retries.                                     |
| Cascade cancel | When a task fails/cancels, all dependents are cancelled with `parent_failed` reason.               |
| Kill switch    | When `spentTodayUsd >= hardCapUsd`, company is paused, queued tasks cancelled.                     |
