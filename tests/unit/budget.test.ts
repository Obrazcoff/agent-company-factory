import { describe, it, expect, beforeEach } from 'vitest';
import { resetState } from '../helpers';
import { db } from '@/factory/store/db';
import { canSpend, recordSpend, killSwitchIfHardCap } from '@/factory/policy/budget';
import { nowIso } from '@/factory/domain/ids';
import type { Company } from '@/factory/domain/types';

function mkCompany(daily = 50, hardMul = 1.5): Company {
  return {
    id: 'co1',
    tenantId: 'default',
    missionPrompt: 'p',
    mission: 'm',
    kpis: [{ name: 'k', target: 1 }],
    budget: {
      dailyCapUsd: daily,
      hardCapUsd: daily * hardMul,
      spentTodayUsd: 0,
      lastResetAt: nowIso(),
    },
    status: 'active',
    createdAt: nowIso(),
  };
}

describe('budget policy', () => {
  beforeEach(() => resetState());

  it('canSpend allows within daily cap', () => {
    db().companies.create(mkCompany(10));
    expect(canSpend('co1', 5).allowed).toBe(true);
  });

  it('canSpend rejects when soft cap exceeded', () => {
    db().companies.create(mkCompany(10));
    recordSpend('co1', 9.5);
    const check = canSpend('co1', 1);
    expect(check.allowed).toBe(false);
    if (!check.allowed) expect(check.reason).toBe('soft_cap');
  });

  it('canSpend rejects with hard_cap when over hardCap', () => {
    db().companies.create(mkCompany(10, 1.2));
    recordSpend('co1', 12);
    const check = canSpend('co1', 1);
    expect(check.allowed).toBe(false);
    if (!check.allowed) expect(check.reason).toBe('hard_cap');
  });

  it('killSwitchIfHardCap pauses company and cancels queued tasks', () => {
    db().companies.create(mkCompany(10, 1.2));
    db().tasks.create({
      id: 'tA',
      companyId: 'co1',
      agentId: 'agt1',
      kind: 'k',
      input: {},
      status: 'queued',
      dependsOn: [],
      idempotencyKey: 'i1',
      scheduledAt: nowIso(),
      attempts: 0,
      maxAttempts: 3,
      depth: 0,
      runTimeoutMs: 30_000,
      estCostUsd: 0.01,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    recordSpend('co1', 13);
    const triggered = killSwitchIfHardCap('co1');
    expect(triggered).toBe(true);
    expect(db().companies.require('co1').status).toBe('paused');
    expect(db().tasks.require('tA').status).toBe('cancelled');
  });
});
