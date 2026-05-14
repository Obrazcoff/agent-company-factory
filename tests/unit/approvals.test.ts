import { describe, it, expect, beforeEach } from 'vitest';
import { resetState } from '../helpers';
import { db } from '@/factory/store/db';
import { createApproval, decideApproval, expireOverdueApprovals } from '@/factory/policy/approvals';
import { nowIso } from '@/factory/domain/ids';

beforeEach(() => {
  resetState();
  db().companies.create({
    id: 'co1',
    tenantId: 'default',
    missionPrompt: 'p',
    mission: 'm',
    kpis: [{ name: 'k', target: 1 }],
    budget: { dailyCapUsd: 50, hardCapUsd: 75, spentTodayUsd: 0, lastResetAt: nowIso() },
    status: 'active',
    createdAt: nowIso(),
  });
});

describe('approvals policy', () => {
  it('createApproval stores pending + audit', () => {
    const a = createApproval({
      taskId: 't1',
      runId: 'r1',
      companyId: 'co1',
      requestedBy: 'agt1',
      action: { connectorId: 'gmail.send', payload: {}, description: 'send' },
    });
    expect(a.status).toBe('pending');
    expect(db().audits.find((e) => e.kind === 'approval.requested')).toHaveLength(1);
  });

  it('decideApproval transitions pending -> approved exactly once (CAS)', () => {
    const a = createApproval({
      taskId: 't1',
      runId: 'r1',
      companyId: 'co1',
      requestedBy: 'agt1',
      action: { connectorId: 'gmail.send', payload: {}, description: 's' },
    });
    const first = decideApproval(a.id, 'approved');
    expect(first.ok).toBe(true);
    const second = decideApproval(a.id, 'rejected');
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.reason).toBe('already_decided');
  });

  it('expireOverdueApprovals expires past-deadline pending approvals', () => {
    const a = createApproval({
      taskId: 't1',
      runId: 'r1',
      companyId: 'co1',
      requestedBy: 'agt1',
      action: { connectorId: 'gmail.send', payload: {}, description: 's' },
    });
    db().approvals.update(a.id, (cur) => ({ ...cur, deadlineAt: '2000-01-01T00:00:00.000Z' }));
    const expired = expireOverdueApprovals();
    expect(expired).toHaveLength(1);
    expect(db().approvals.require(a.id).status).toBe('expired');
  });
});
