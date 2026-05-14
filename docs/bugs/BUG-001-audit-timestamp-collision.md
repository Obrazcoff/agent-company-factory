# BUG-001: Audit events created in the same millisecond sort unstably

- Date: 2026-05-14
- Severity: low
- Status: fixed
- Reporter: @assistant
- Affected: [`src/factory/domain/ids.ts`](../../src/factory/domain/ids.ts), [`src/factory/audit/audit.ts`](../../src/factory/audit/audit.ts)

## Steps to reproduce

```ts
appendAudit({ kind: 'a', companyId, ... });
appendAudit({ kind: 'b', companyId, ... });
const events = listAudits(companyId);
expect(events[0].kind).toBe('a'); // flaky on fast machines
```

## Expected

Events sort in insertion order.

## Actual

Both events have identical `ts` (Date.now() resolution = 1ms). `Array.sort` is stable in V8, but re-sorting a fresh slice or hash-map iteration order makes ordering depend on insertion-time hashing.

## Root cause

`nowIso()` was returning `new Date().toISOString()` directly. Two calls within the same ms produced duplicate timestamps.

## Fix

Sub-millisecond counter inside `nowIso()`:

```ts
let lastMs = 0;
let subSeq = 0;
export function nowIso(): string {
  const ms = Date.now();
  if (ms === lastMs) subSeq = (subSeq + 1) % 1000;
  else {
    lastMs = ms;
    subSeq = 0;
  }
  return new Date(ms).toISOString().replace('Z', `${String(subSeq).padStart(3, '0')}Z`);
}
```

## Regression test

[`tests/unit/audit.test.ts`](../../tests/unit/audit.test.ts) — `'preserves insertion order'` case.
