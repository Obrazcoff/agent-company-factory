import { describe, it, expect, beforeEach } from 'vitest';
import { resetState } from '../helpers';
import { appendAudit, listAudits } from '@/factory/audit/audit';

describe('audit', () => {
  beforeEach(() => resetState());

  it('append + list returns events in reverse chronological order', () => {
    appendAudit({ companyId: 'co1', kind: 'company.created', actor: 'system' });
    appendAudit({ companyId: 'co1', kind: 'task.enqueued', actor: 'system' });
    appendAudit({ companyId: 'co2', kind: 'company.created', actor: 'system' });
    const audits = listAudits('co1');
    expect(audits).toHaveLength(2);
    expect(audits[0]!.kind).toBe('task.enqueued');
  });
});
