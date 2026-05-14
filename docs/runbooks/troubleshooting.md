# Troubleshooting

## "Cannot find module '@/factory/...'" in tests

Vitest uses `vitest.config.ts` aliases. Make sure the file exists and points `@` → `src/`. Restart the test process.

## Type errors after `git pull`

```bash
rm -rf .next tsconfig.tsbuildinfo
npm run check
```

## State doesn't reset between tests

Tests must call `beforeEach(() => resetState())` from `tests/helpers.ts`. The in-memory db is process-global.

## "approval already_decided" 409 in UI

Two clicks landed at once (the SWR refresh + manual click). Refresh the page — the second click is correctly rejected by the CAS guard.

## Real OpenAI returns invalid JSON

The provider validates with zod and throws. Check the prompt in `llm/provider.ts`; consider switching back to `LLM_PROVIDER=mock` for the demo.

## UI shows stale data

SWR polls every 2s. After a manual mutation we call `mutate()` immediately, but a slow tick can still lag. Click **Run tick** explicitly.

## "Port 3000 in use"

```bash
lsof -i :3000
kill -9 <pid>
# or:
PORT=3001 npm run dev
```
