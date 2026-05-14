# ADR-004: LLM provider — pluggable, deterministic mock, structured output via zod

- Status: accepted
- Date: 2026-05-14
- Context: [`src/llm/provider.ts`](../../src/llm/provider.ts)

## Context

We need to:

- Generate Blueprints from a goal prompt (structured JSON, not free text).
- Make the demo and tests **deterministic** (no real API calls in CI).
- Support real OpenAI for live demo without changing call sites.
- Validate every LLM output (LLMs lie about schemas).

## Decision

- **Single `LlmProvider` interface** with `generateBlueprint(prompt) → { blueprint, cost, tokens }` and a generic `generateJson<T>(prompt, schema)` for any structured output.
- **Mock provider** is the default (`LLM_PROVIDER=mock`). Seeded by `FACTORY_SEED` for reproducibility. Returns a sane Blueprint matching the demo prompt.
- **OpenAI provider** uses `gpt-4o-mini` with response-format JSON. Both `OPENAI_API_KEY` (canonical) and legacy `OPEN_AI_API_KEY` are accepted.
- **All outputs validated by zod** at the provider boundary — bad JSON throws before reaching the domain.

## Consequences

- ✅ Tests run offline, CI is deterministic.
- ✅ Demo works without an API key.
- ✅ Adding Anthropic/Gemini = one new provider class.
- ❌ Mock blueprint is hardcoded for the lead-gen scenario; broader prompts would return the same skeleton in MVP. Acceptable: real provider handles arbitrary prompts.
