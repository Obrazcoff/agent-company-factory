import { describe, it, expect } from 'vitest';
import { BlueprintSchema } from '@/factory/domain/schemas';

const VALID = {
  mission: 'Run a B2B lead generation company.',
  kpis: [{ name: 'leads', target: 10 }],
  dailyCapUsd: 50,
  approvals: ['gmail', 'calendar'],
  agents: [
    { role: 'PM', name: 'PM', systemPrompt: 's', permissions: [] },
    { role: 'Researcher', name: 'R', systemPrompt: 's', permissions: ['web_search'] },
    { role: 'Outreach', name: 'O', systemPrompt: 's', permissions: ['gmail.send'] },
  ],
  initialTasks: [
    { kind: 'a', role: 'Researcher', input: {} },
    { kind: 'b', role: 'Researcher', input: {} },
    { kind: 'c', role: 'Outreach', input: {} },
    { kind: 'd', role: 'Outreach', input: {} },
    { kind: 'e', role: 'Outreach', input: {} },
  ],
};

describe('BlueprintSchema', () => {
  it('validates a correct blueprint', () => {
    expect(() => BlueprintSchema.parse(VALID)).not.toThrow();
  });

  it('rejects blueprint with <3 agents', () => {
    expect(() => BlueprintSchema.parse({ ...VALID, agents: VALID.agents.slice(0, 2) })).toThrow();
  });

  it('rejects blueprint with <5 initial tasks', () => {
    expect(() => BlueprintSchema.parse({ ...VALID, initialTasks: VALID.initialTasks.slice(0, 4) })).toThrow();
  });

  it('rejects negative dailyCapUsd', () => {
    expect(() => BlueprintSchema.parse({ ...VALID, dailyCapUsd: -1 })).toThrow();
  });
});
