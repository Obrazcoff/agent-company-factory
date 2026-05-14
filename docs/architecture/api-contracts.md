# API contracts

All endpoints accept/return JSON. Validation via zod ([`src/factory/domain/schemas.ts`](../../src/factory/domain/schemas.ts)).

## POST /api/companies

Create a new company from a goal prompt. Generates Blueprint, hires agents, enqueues initial tasks.

**Request**

```json
{
  "missionPrompt": "Launch an autonomous B2B lead generation company...",
  "dailyBudgetUsd": 50
}
```

**Response 201**

```json
{
  "company": { "id": "co_...", "mission": "...", "budget": { "dailyCapUsd": 50, "hardCapUsd": 75, ... } },
  "blueprint": { "mission": "...", "kpis": [...], "agents": [...], "initialTasks": [...] },
  "agents": [...],
  "initialTasks": [...]
}
```

## GET /api/companies/:id

Full state for the control plane (single endpoint for UI polling).

**Response 200**: `CompanyState` (see [`src/factory/modules/controlPlane.ts`](../../src/factory/modules/controlPlane.ts))

## POST /api/companies/:id/agents

Hire an additional agent.

**Request**

```json
{ "role": "Researcher", "name": "Optional", "customPrompt": "Optional" }
```

## POST /api/companies/:id/pause

Pause/resume a whole company.

**Request**

```json
{ "paused": true }
```

## POST /api/tasks

Manually enqueue a task (most tasks come from initial backlog or follow-ups).

**Request**

```json
{
  "companyId": "co_...",
  "agentId": "agt_...",
  "kind": "research_companies",
  "input": {},
  "dependsOn": ["tsk_..."]
}
```

**Errors**

- `400 cyclic_dependency`, `400 max_depth_exceeded`, `400 unknown_dependency`
- `409 backlog_full`, `409 company_paused`

## POST /api/tasks/:id/cancel

Human override — mark task and its dependents as cancelled.

## POST /api/approvals/:id

Decide a pending approval. Atomic — second decision returns 409.

**Request**

```json
{ "decision": "approved", "reason": "looks good", "decidedBy": "human" }
```

**Errors**: `404 approval_not_found`, `409 already_decided { current: 'approved' }`

## POST /api/agents/:id/pause

Pause/resume a single agent.

```json
{ "paused": true }
```

## POST /api/orchestrator/tick

Advance the orchestrator one step. In V1 this is a cron/Temporal worker; in MVP it's a manual button + tests poll it.

**Response 200**

```json
{
  "workerId": "wrk_...",
  "durationMs": 12,
  "expiredApprovals": 0,
  "staleRunsRecovered": 0,
  "executed": 4,
  "doneTasks": 1,
  "failedTasks": 0,
  "awaitingApprovalTasks": 3,
  "deferred": 0
}
```

## Curl examples

```bash
# 1. Create
curl -s -X POST http://localhost:3000/api/companies \
  -H 'Content-Type: application/json' \
  -d '{"missionPrompt":"Launch a B2B lead gen company","dailyBudgetUsd":50}' | jq .

# 2. Tick a few times
for i in 1 2 3 4 5; do curl -s -X POST http://localhost:3000/api/orchestrator/tick | jq .; done

# 3. Approve first pending action
ID=$(curl -s http://localhost:3000/api/companies/co_xxx | jq -r '.pendingApprovals[0].id')
curl -s -X POST http://localhost:3000/api/approvals/$ID \
  -H 'Content-Type: application/json' -d '{"decision":"approved"}' | jq .
```
