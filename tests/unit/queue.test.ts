import { describe, it, expect } from 'vitest';
import { TaskQueue } from '@/factory/queue/queue';
import type { Task, AgentRole } from '@/factory/domain/types';

function mkTask(id: string, agentId: string, dependsOn: string[] = []): Task {
  return {
    id,
    companyId: 'co1',
    agentId,
    kind: 'k',
    input: {},
    status: 'queued',
    dependsOn,
    idempotencyKey: id,
    scheduledAt: '2026-01-01T00:00:00.000Z',
    attempts: 0,
    maxAttempts: 3,
    depth: 0,
    runTimeoutMs: 30_000,
    estCostUsd: 0.01,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('TaskQueue.pickReady', () => {
  it('returns ready tasks sorted by role priority', () => {
    const q = new TaskQueue();
    const tasks = [mkTask('t1', 'a-ops'), mkTask('t2', 'a-pm'), mkTask('t3', 'a-research')];
    const roles = new Map<string, AgentRole>([
      ['a-ops', 'Ops'],
      ['a-pm', 'PM'],
      ['a-research', 'Researcher'],
    ]);
    const out = q.pickReady(tasks, 'co1', () => true, 10, roles);
    expect(out.map((t) => t.id)).toEqual(['t2', 't3', 't1']);
  });

  it('respects limit', () => {
    const q = new TaskQueue();
    const tasks = Array.from({ length: 30 }, (_, i) => mkTask(`t${i}`, 'a'));
    const roles = new Map<string, AgentRole>([['a', 'PM']]);
    expect(q.pickReady(tasks, 'co1', () => true, 5, roles)).toHaveLength(5);
  });

  it('hasCycle detects A->B->A', () => {
    const q = new TaskQueue();
    const tasks = [mkTask('A', 'a'), mkTask('B', 'a', ['A'])];
    expect(q.hasCycle(tasks, ['B'], 'A')).toBe(true);
  });

  it('hasCycle false for valid DAG', () => {
    const q = new TaskQueue();
    const tasks = [mkTask('A', 'a'), mkTask('B', 'a', ['A'])];
    expect(q.hasCycle(tasks, ['A'], 'C')).toBe(false);
  });

  it('findDependents returns tasks that depend on given id', () => {
    const q = new TaskQueue();
    const tasks = [mkTask('A', 'a'), mkTask('B', 'a', ['A']), mkTask('C', 'a', ['A'])];
    expect(
      q
        .findDependents(tasks, 'A')
        .map((t) => t.id)
        .sort(),
    ).toEqual(['B', 'C']);
  });
});
