# Local development

## Requirements

- Node.js 20+
- npm 10+

## Setup

```bash
npm install
cp .env.example .env.local   # optional; defaults work for mock LLM
npm run dev                  # http://localhost:3000
```

## Useful scripts

| Command                    | What                                         |
| -------------------------- | -------------------------------------------- |
| `npm run dev`              | Next.js dev server                           |
| `npm run build`            | Production build                             |
| `npm run check`            | `tsc --noEmit` strict                        |
| `npm test`                 | All tests (unit + integration + e2e)         |
| `npm run test:unit`        | Unit only                                    |
| `npm run test:integration` | Integration only                             |
| `npm run test:e2e`         | E2E (HTTP-level)                             |
| `npm run test:watch`       | Vitest watch                                 |
| `npm run verify`           | check + test (use before PR/demo)            |
| `npm run eval:agent`       | Demo scenario in the terminal (8/8 AC check) |

## Switching to real OpenAI

```bash
export LLM_PROVIDER=openai
export OPENAI_API_KEY=sk-...   # or OPEN_AI_API_KEY
export OPENAI_MODEL=gpt-4o-mini
npm run dev
```

## Environment variables

See [`.env.example`](../../.env.example).

| Var                                  | Default       | Purpose                                             |
| ------------------------------------ | ------------- | --------------------------------------------------- |
| `LLM_PROVIDER`                       | `mock`        | `mock` or `openai`                                  |
| `OPENAI_API_KEY` / `OPEN_AI_API_KEY` | —             | Real LLM key (only when `LLM_PROVIDER=openai`)      |
| `OPENAI_MODEL`                       | `gpt-4o-mini` | Model name                                          |
| `FACTORY_SEED`                       | `42`          | Determinism for mock LLM and id generation in tests |
| `DEFAULT_DAILY_BUDGET_USD`           | `50`          | Default budget when not specified in request        |

## Reset state

In-memory state lives in `db()` singleton. To reset:

- Restart the process (`Ctrl+C`, `npm run dev`).
- In tests: `import { resetState } from 'tests/helpers'`.
