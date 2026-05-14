# ADR-007: B2B Lead Research Strategy — Connectors vs Enrichment vs Perplexity

**Status:** Accepted (for MVP scope) / Open (connector selection pending)  
**Date:** 2026-05-14

---

## Context

A core use case of Agent Company Factory is deploying an autonomous B2B lead generation company. The system must recommend and implement how agents discover, enrich, and engage potential clients. Three candidate approaches were discussed:

1. **LinkedIn / Sales Navigator** — richest data, strict legal/API constraints.
2. **Enrichment APIs** (Clearbit, Apollo, ZoomInfo) — structured contact data via official APIs.
3. **Perplexity / web search** — market intelligence and fresh context via LLM-powered search.

---

## Decision: A Composable Matrix, Not a Single Channel

The right architecture is **not** choosing one channel — it is a configurable matrix of connectors, selected per ICP (Ideal Customer Profile) in the blueprint:

```
ICP definition (blueprint)
        │
        ├─► web_search connector      ← Perplexity / Brave / Google CSE
        │    (market landscape, fresh company info)
        │
        ├─► enrichment connector      ← Apollo / Clearbit / ZoomInfo API
        │    (contact data: email, title, company size)
        │
        └─► crm connector             ← HubSpot / Salesforce
             (deduplication, sequence tracking)
```

LinkedIn is handled as a **data source through enrichment APIs** (which acquire data legally), not via direct scraping or unofficial automation.

---

## Channel Analysis

### LinkedIn / Sales Navigator

| Dimension    | Assessment                                                                                                              |
| ------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Data quality | Very high — rich professional graph                                                                                     |
| Legal        | `robots.txt` bans scraping; official API is gated behind a partnership program and does not expose lead search at scale |
| Automation   | Only via official Sales Navigator API (no programmatic search for free tiers); violating ToS risks account ban          |
| **Verdict**  | Use as _inspiration_ for ICP, not as a direct connector in MVP. Enrichment APIs often source from LinkedIn anyway.      |

### Enrichment APIs (Apollo, Clearbit, ZoomInfo)

| Dimension          | Assessment                                                                                |
| ------------------ | ----------------------------------------------------------------------------------------- |
| Data quality       | High for contact-level data (email, phone, title)                                         |
| Legal              | Governed by API ToS + GDPR/CCPA — must honor opt-outs                                     |
| Cost               | Pay-per-record; needs budget tracking (`estCostUsd` per tool call)                        |
| Integration effort | Simple REST APIs, easy to wrap as an `EnrichmentConnector`                                |
| **Verdict**        | **Primary connector for contact discovery.** Implement as `connector_kind: 'enrichment'`. |

### Perplexity / Web Search as Research Connector

| Dimension         | Assessment                                                                                                                                                                                           |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Use case          | Market landscape, competitor analysis, company news, ICP validation                                                                                                                                  |
| Quality           | High freshness; can hallucinate — always validate with structured data                                                                                                                               |
| Cost              | Per-query; Perplexity Pro API ≈ $0.001–0.005/query                                                                                                                                                   |
| Requires approval | No for read-only research; yes if output triggers an outreach action                                                                                                                                 |
| **Verdict**       | **Secondary connector for research tasks.** Replaces/extends the mock `web_search` connector. Wrap as `PerplexityConnector` with rate-limit and optional human-in-the-loop before acting on results. |

---

## Implementation Plan (future V1 swaps)

| Current (MVP)               | V1 Target                                                                                         |
| --------------------------- | ------------------------------------------------------------------------------------------------- |
| Mock `web_search` connector | `PerplexityConnector` — real HTTP, API key from `.env`, `APPROVAL_GATE: false` for research reads |
| Mock `crm` connector        | HubSpot connector — OAuth2, rate-limited, deduplication by domain                                 |
| No enrichment connector     | `ApolloConnector` — REST, per-record billing, quota guard in `policy/budget.ts`                   |

---

## Guardrails

1. **All outbound actions** (email drafts, CRM writes, calendar invites) **require human approval** regardless of channel — see `ApprovalGatePolicy`.
2. **Perplexity results** feeding into outreach must be flagged `requiresApproval: true` on the connector — hallucinations in email copy are high-risk.
3. **Enrichment API costs** must be tracked per `toolCall.costUsd` and deducted from the company budget via `policy/budget.ts`.
4. **GDPR opt-out** signals from enrichment APIs must be surfaced to the Outreach agent before sending — implement as a `Memory` entry tagged `kind: 'fact'` with `content: 'opted_out'`.

---

## Consequences

- Blueprint will gain an optional `researchConnectors` field specifying which connectors the Researcher agent should use.
- `COST_TABLE` in `src/factory/config.ts` will need entries for `perplexity_query`, `apollo_contact_lookup`, etc.
- The existing mock `web_search` connector is the correct shape — real connectors implement the same interface.
