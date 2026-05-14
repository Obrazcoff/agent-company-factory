# BUG-002: Orchestrator concurrent-claim test relied on a task with unmet dependencies

- Date: 2026-05-14
- Severity: low (test only)
- Status: fixed
- Affected: [`tests/integration/orchestrator.test.ts`](../../tests/integration/orchestrator.test.ts)

## Steps to reproduce

Run `npm run test:integration -- tests/integration/orchestrator.test.ts` with `case 4: two parallel ticks claim a task only once`.

## Expected

`Promise.all([tick(), tick()])` results in exactly **one** Run for the enqueued task.

## Actual

Zero Runs for the enqueued task — assertion `expect(totalRunsForTask).toBe(1)` fails.

## Root cause

The test enqueued a task with the same `kind` as one already in the demo company's blueprint. The idempotency key matched the existing task (which had unmet `dependsOn`), so the test's task was never actually executable in the queue.

## Fix

Use a unique `kind` (`'race_unique'`) and a randomized `nonce` to bypass any idempotency match. Replace the Ops handler with a slow stub (30ms) so both ticks really overlap on the claim attempt:

```ts
const original = roleHandlers.Ops as RoleHandler;
roleHandlers.Ops = async () => {
  await sleep(30);
  return { output: { ok: true } };
};
try {
  const r = enqueueTask({ companyId, agentId: ops.id, kind: 'race_unique', input: { nonce: Math.random() } });
  const [a, b] = await Promise.all([tick(), tick()]);
  expect(db().runs.find((rn) => rn.taskId === r.task.id).length).toBe(1);
} finally {
  roleHandlers.Ops = original;
}
```

## Lesson

When testing concurrency primitives, isolate the unit under test from collateral state (idempotency, blueprint defaults). A "minimal repro task" is worth the extra setup.
