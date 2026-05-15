import { describe, it, expect } from 'vitest';
import { BlueprintSchema } from '@/factory/domain/schemas';
import { normalizeBlueprintPayload } from '@/llm/normalize-blueprint-payload';

const MINIMAL = {
  mission: 'm',
  kpis: [{ name: 'k', target: 1 }],
  dailyCapUsd: 50,
  approvals: ['gmail'],
  agents: [
    { role: 'PM', name: 'PM', systemPrompt: 's', permissions: [] },
    { role: 'Researcher', name: 'R', systemPrompt: 's', permissions: ['web_search'] },
    { role: 'Outreach', name: 'O', systemPrompt: 's', permissions: ['gmail'] },
  ],
  initialTasks: [
    { kind: 'a', role: 'Researcher', input: {} },
    { kind: 'b', role: 'Researcher', input: {} },
    { kind: 'c', role: 'Outreach', input: {} },
    { kind: 'd', role: 'Outreach', input: {} },
    { kind: 'e', role: 'Outreach', input: {} },
  ],
};

describe('normalizeBlueprintPayload', () => {
  it('unwraps nested blueprint + coerces string budget', () => {
    const raw = {
      result: {
        blueprint: {
          ...MINIMAL,
          dailyCapUsd: '50',
        },
      },
    };
    const n = normalizeBlueprintPayload(raw);
    expect(() => BlueprintSchema.parse(n)).not.toThrow();
    const b = BlueprintSchema.parse(n);
    expect(b.dailyCapUsd).toBe(50);
  });

  it('maps snake_case keys and lower-case roles', () => {
    const raw = {
      mission: 'Goal',
      kpis: [{ name: 'x', target: '10' }],
      daily_cap_usd: 40,
      approvals: 'gmail, calendar',
      agents: [
        { role: 'pm', name: 'PM', systemPrompt: 's', permissions: [] },
        { role: 'researcher', name: 'R', systemPrompt: 's', permissions: ['web_search'] },
        { role: 'outreach', name: 'O', systemPrompt: 's', permissions: ['gmail'] },
      ],
      initial_tasks: MINIMAL.initialTasks,
    };
    const n = normalizeBlueprintPayload(raw);
    const b = BlueprintSchema.parse(n);
    expect(b.agents[0]!.role).toBe('PM');
    expect(b.initialTasks[0]!.role).toBe('Researcher');
    expect(b.approvals).toEqual(['gmail', 'calendar']);
  });

  it('lifts blueprint from arbitrary single nested object', () => {
    const { mission, ...rest } = MINIMAL;
    void mission;
    const raw = {
      llm_output: {
        ...rest,
        Mission: 'Nested mission',
      },
    };
    const n = normalizeBlueprintPayload(raw);
    const b = BlueprintSchema.parse(n);
    expect(b.mission).toBe('Nested mission');
  });
});
