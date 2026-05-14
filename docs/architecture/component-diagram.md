# Component diagram

```mermaid
flowchart LR
  UI["Next.js Control Plane (app/page.tsx)"] -->|HTTP JSON, SWR poll 2s| API["Next.js Route Handlers (app/api/**)"]
  API --> GoalIntake["3.1 Goal Intake & Blueprint"]
  API --> TeamDesigner["3.2 Agent Team Designer"]
  API --> SkillsPlanner["3.3 Skills & Connectors Planner"]
  API --> Orchestrator["3.4 Runtime Orchestrator (tick)"]
  API --> ControlPlaneSvc["3.5 Control Plane Aggregator"]
  GoalIntake --> LLM["LLM Provider (mock or OpenAI)"]
  TeamDesigner --> LLM
  Orchestrator -->|dispatch| AgentRuntime["Agent Runtime"]
  AgentRuntime --> Connectors["Connector Registry (5 mocks)"]
  AgentRuntime --> Policy["Policy Engine (approvals + budget)"]
  AgentRuntime --> Audit["Audit Log"]
  Orchestrator --> Queue["TaskQueue (in-memory, priority + cycle check)"]
  Orchestrator --> Bus["EventBus (in-memory pub/sub)"]
  GoalIntake --> Store["Repositories (in-memory)"]
  TeamDesigner --> Store
  Orchestrator --> Store
  ControlPlaneSvc --> Store
  Policy --> Store
  Audit --> Store
```

## Module boundaries

| Module               | Owns                                   | Reads                   | Writes                                           |
| -------------------- | -------------------------------------- | ----------------------- | ------------------------------------------------ |
| Goal Intake (3.1)    | Blueprint generation, Company creation | LLM                     | companies, agents, tasks (initial), audits       |
| Team Designer (3.2)  | Agent role allocation                  | blueprint               | agents, audits                                   |
| Skills Planner (3.3) | Permission allocation                  | connector registry      | agents                                           |
| Orchestrator (3.4)   | tick loop, sweepers, lease, retries    | tasks, runs, approvals  | tasks, runs, audits, agents (status)             |
| Agent Runtime        | Single Run execution                   | task, agent, connectors | runs (trace, toolCalls, cost), audits, approvals |
| Control Plane (3.5)  | Aggregated read API                    | all repositories        | nothing                                          |
| Policy Engine        | Budget + approvals                     | companies, approvals    | companies (budget), approvals                    |
| Connectors           | External I/O (mocked)                  | input                   | nothing in MVP                                   |

## Where to swap for V1

| MVP component               | V1 target                                         |
| --------------------------- | ------------------------------------------------- |
| `Repository<T>` (in-memory) | Postgres + Drizzle/Prisma + outbox pattern        |
| `TaskQueue`                 | Redis Streams or NATS JetStream                   |
| `EventBus`                  | Same Redis/NATS topic                             |
| `tick()` polling            | Temporal worker + scheduled cron                  |
| Mock connectors             | Real OAuth-backed adapters; secrets via Vault     |
| Mock LLM                    | OpenAI/Anthropic via env, with structured outputs |
| `secretsRef` strings        | Vault/SOPS resolver                               |
