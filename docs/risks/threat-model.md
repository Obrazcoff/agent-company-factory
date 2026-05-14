# Threat model (lite)

Scope: the MVP architecture. Not exhaustive — focused on what an interviewer might probe.

## Assets

| Asset                            | Sensitivity         |
| -------------------------------- | ------------------- |
| Mission prompt                   | low (user-supplied) |
| Connector secrets (`secretsRef`) | high (V1)           |
| Approval decisions               | high (auditability) |
| Audit log                        | high (immutability) |
| Run output / memory              | medium              |
| Cost data                        | medium              |

## Threat actors

- Malicious user prompts (prompt injection into Blueprint generation).
- Compromised connector (returns malicious payloads).
- Internal misuse (operator approves things they shouldn't).
- Bug-induced runaway (handler in infinite loop).

## STRIDE quick-pass

| Threat                     | Vector                                          | Mitigation                                                                                      |
| -------------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| **S**poofing               | Forge "human" actor on approval                 | V1: auth on `/api/approvals/:id` + signed JWT; MVP: stub user identity                          |
| **T**ampering              | Modify audit events                             | Audits are append-only via `appendAudit`; no update/delete API; V1: hash chain + DB constraints |
| **R**epudiation            | "I didn't approve that"                         | Audit captures `decidedBy` + `ts`; V1: cryptographic signature                                  |
| **I**nformation disclosure | Leak `secretsRef` value in audit payload        | Connectors never log raw secrets; payloads are sanitized; V1: redaction layer                   |
| **D**enial of service      | Spam `POST /api/companies`                      | V1: rate limit per IP/tenant; MVP: documented                                                   |
| **E**levation of privilege | Agent calls connector outside its `permissions` | Runtime enforces `agent.permissions.includes(connectorId)` before `runConnector`                |

## Prompt injection

Goal Intake feeds `missionPrompt` into the LLM to produce a Blueprint. Mitigations:

- **Output validation by zod** — model can't change the contract.
- **Allowlist of roles, connectors, kinds** — anything off-list is rejected by `BlueprintSchema`.
- **No tool-use during Blueprint generation** — it's pure text→JSON, no side effects.
- **Re-validation at hire / enqueue** — even if Blueprint slipped through, the team designer and enqueue helper re-check.

## Approval bypass

Mitigations:

- Approval check is in `runtime.ts` **before** `connector.call`. Handlers cannot opt out.
- Approval `decideApproval` is atomic CAS — no double-approve.
- Approvals expire (`deadlineAt`) — pending forever ≠ implicit yes.
- Audit captures the chain: `approval.requested → approval.decided → action.executed`.

## Budget bypass

Mitigations:

- `policy/budget.ts` `canSpend()` is called **before** every LLM/tool call.
- Hard cap = kill switch: company moves to `paused`, all queued tasks → `cancelled`, audit `company.killed`.
- Per-agent and per-company costs are sums over Run records — independently verifiable.

## What V1 must add

- TLS everywhere, signed audit chain, per-tenant secrets isolation, real authn/authz, rate limiting, abuse detection on prompts (LLM Guard / Lakera), automated red-teaming on Blueprint generation, supply-chain SBOM.
