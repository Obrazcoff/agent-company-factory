import { describe, it, expect, beforeEach } from 'vitest';
import { resetState, createDemoCompany } from '../helpers';

describe('teamDesigner', () => {
  beforeEach(() => resetState());

  it('produces unique roles including PM, Researcher, Outreach', async () => {
    const result = await createDemoCompany();
    const roles = result.agents.map((a) => a.role);
    expect(roles).toContain('PM');
    expect(roles).toContain('Researcher');
    expect(roles).toContain('Outreach');
  });

  it('every agent has non-empty system prompt', async () => {
    const result = await createDemoCompany();
    for (const a of result.agents) {
      expect(a.systemPrompt.length).toBeGreaterThan(0);
    }
  });

  it('agents start in idle state', async () => {
    const result = await createDemoCompany();
    for (const a of result.agents) {
      expect(a.status).toBe('idle');
    }
  });
});
