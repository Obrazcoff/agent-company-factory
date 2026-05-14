import { describe, it, expect, beforeEach } from 'vitest';
import { resetState, createDemoCompany } from '../helpers';
import { listConnectorMeta } from '@/factory/connectors/registry';

describe('skillsPlanner', () => {
  beforeEach(() => resetState());

  it('every agent permission corresponds to a registered connector', async () => {
    const result = await createDemoCompany();
    const registered = new Set(listConnectorMeta().map((c) => c.id));
    for (const a of result.agents) {
      for (const p of a.permissions) {
        expect(registered.has(p), `unknown connector "${p}" on ${a.role}`).toBe(true);
      }
    }
  });

  it('Outreach agent has both gmail.draft and gmail.send permissions', async () => {
    const result = await createDemoCompany();
    const outreach = result.agents.find((a) => a.role === 'Outreach');
    expect(outreach?.permissions).toContain('gmail.draft');
    expect(outreach?.permissions).toContain('gmail.send');
  });

  it('Researcher has web_search and crm', async () => {
    const result = await createDemoCompany();
    const r = result.agents.find((a) => a.role === 'Researcher');
    expect(r?.permissions).toContain('web_search');
    expect(r?.permissions).toContain('crm');
  });
});
