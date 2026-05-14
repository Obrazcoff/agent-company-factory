# Risks & trade-offs

## Top architectural risks

| ID   | Risk                               | Mitigation in MVP                                           | V1 plan                                                    |
| ---- | ---------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------- |
| R-1  | State lost on restart              | Documented; tests use `resetState()`                        | Postgres persistence; outbox for events                    |
| R-2  | Single process = no isolation      | One company can't crash another (try/catch around handlers) | Per-company workers in Temporal                            |
| R-3  | LLM hallucinations in Blueprint    | Strict zod validation at provider boundary                  | Same; add few-shot exemplars + retries                     |
| R-4  | Connector misuse / approval bypass | Approval enforced in runtime, not handler                   | Same; plus per-connector OPA-style policies                |
| R-5  | Runaway costs                      | Daily soft cap + hard cap kill switch + per-call estimate   | Same; plus per-tenant and per-agent caps                   |
| R-6  | Stuck/looping agents               | 12 orchestrator guards (see ADR-003)                        | Same patterns, DB-level locks                              |
| R-7  | Lock starvation in tick            | `pickReady` priority sort + `TICK_DEADLINE_MS` deferral     | Postgres `SKIP LOCKED` is fair                             |
| R-8  | No multi-tenant isolation          | `tenantId` field present everywhere; default `'default'`    | Row-level security in Postgres                             |
| R-9  | No retry backoff                   | Linear retry with `maxAttempts=3`                           | Exponential backoff + jitter (`runTimeoutMs * 2^attempts`) |
| R-10 | Audit log unbounded growth         | In-memory cap implicit (process restart)                    | Time-partitioned table + warehouse export                  |

## Conscious trade-offs

| Trade-off                                    | Why we made it                                  | What we lose                                                                                          |
| -------------------------------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| In-memory storage                            | Demo speed; isolation of architectural concerns | Persistence, true concurrency                                                                         |
| Manual `tick` button + 2s SWR poll           | Simpler than WebSocket/SSE for MVP              | Real-time UX; addressed in V1 with event stream                                                       |
| `Promise.race` timeouts (handler still runs) | No native cancellation in JS                    | Wasted CPU on timed-out handlers; OK for I/O-bound mocks                                              |
| Mock connectors return synthetic data        | Deterministic tests, no rate limits             | Can't validate real-world quirks                                                                      |
| Single role handler per role                 | Simpler dispatch                                | Can't have multiple Researchers with different specialties; addressed in V1 by per-agent customPrompt |
| `idempotencyKey` is opt-in                   | Most tasks are unique                           | Caller must pass it for safety; documented                                                            |

## What this MVP intentionally does **not** do

- ❌ Real OAuth flows for connectors.
- ❌ Real vector RAG for memory.
- ❌ Multi-tenant authentication / authorization.
- ❌ Persistent queue with durable retries across restarts.
- ❌ Real-time UI via WebSocket/SSE.
- ❌ Distributed tracing (OpenTelemetry hookup).
- ❌ Production secrets management (Vault/SOPS).

All of these are V1 work. The interfaces are positioned so each is a contained swap.
