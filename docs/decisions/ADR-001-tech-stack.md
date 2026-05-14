# ADR-001: Tech stack — TypeScript + Next.js 15, in-memory infra, mocks for LLM/connectors

- Status: accepted
- Date: 2026-05-14
- Context: project bootstrap

## Context

The original brief lists "Temporal/Airflow + Postgres + Redis + Vector DB" as a reference stack for V1. The MVP is an architectural exercise: prove that the boundaries, contracts, and orchestration model are correct **before** investing in distributed infrastructure. The starting repo is a Next.js 15 + TypeScript codebase.

## Decision

- **Single Next.js 15 process** for both API (route handlers) and UI (App Router).
- **In-memory infrastructure** (`Repository<T>`, `EventBus`, `TaskQueue`, `appendAudit`) behind interfaces designed for swap-out.
- **Mock LLM provider** (deterministic, seeded) and **mock connectors** for all 5 integrations. Real OpenAI is opt-in via `LLM_PROVIDER=openai`.
- **TypeScript strict mode** + **zod** at every API/LLM boundary.
- **Vitest** for unit/integration/e2e tests (HTTP routes called directly via `NextRequest`).
- **Tailwind v4 + shadcn-style UI primitives** for fast, professional UI without committing to a heavy component library.

## Consequences

- ✅ One `npm run dev` and you have everything working — fast iteration, easy to demo.
- ✅ Deterministic tests (mock LLM, fake clock-friendly).
- ✅ Boundary interfaces (`Repository<T>`, `Connector`) make the V1 swap explicit and small.
- ❌ Single-process: no real parallelism, no failure isolation between companies.
- ❌ State lost on restart (acceptable for an architectural MVP; documented in [risks](../risks/risks-and-tradeoffs.md)).
- ❌ Tick-based orchestration is not the V1 model; we explicitly model `TaskQueue` and `Run` so the move to Temporal is mechanical.

## V1 swap

| Interface            | V1 implementation                                                    |
| -------------------- | -------------------------------------------------------------------- |
| `Repository<T>`      | Postgres + Drizzle, with optimistic locking (`version` column).      |
| `TaskQueue.tryClaim` | Postgres `FOR UPDATE SKIP LOCKED` or Redis Streams.                  |
| `EventBus`           | Redis pub/sub or NATS.                                               |
| `tick()`             | Temporal worker activity, scheduled every N seconds + cron sweepers. |
| `appendAudit`        | Postgres + outbox pattern + downstream warehouse.                    |
