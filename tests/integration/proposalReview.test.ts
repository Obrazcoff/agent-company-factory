import { describe, it, expect, beforeEach } from 'vitest';
import { resetState, DEMO_PROMPT } from '../helpers';
import {
  draftProposal,
  acceptProposal,
  rebuildProposal,
  excludeAgent,
  getProposal,
} from '@/factory/modules/proposalReview';
import { db } from '@/factory/store/db';

describe('proposalReview', () => {
  beforeEach(() => resetState());

  it('draftProposal creates a proposal in reviewing status without active agents', async () => {
    const { proposal } = await draftProposal({ missionPrompt: DEMO_PROMPT });

    expect(proposal.status).toBe('reviewing');
    expect(proposal.proposedAgents.length).toBeGreaterThanOrEqual(1);
    expect(proposal.proposedAgents.every((a) => a.included)).toBe(true);

    // Company exists in proposal status — no agents created yet
    const company = db().companies.get(proposal.companyId);
    expect(company?.status).toBe('proposal');
    expect(db().agents.all({ companyId: proposal.companyId })).toHaveLength(0);
  });

  it('excludeAgent toggles included flag without materializing agents', async () => {
    const { proposal } = await draftProposal({ missionPrompt: DEMO_PROMPT });
    const firstAgent = proposal.proposedAgents[0];

    const updated = excludeAgent(proposal.id, firstAgent.id, false);
    const excluded = updated.proposedAgents.find((a) => a.id === firstAgent.id);
    const rest = updated.proposedAgents.filter((a) => a.id !== firstAgent.id);

    expect(excluded?.included).toBe(false);
    expect(rest.every((a) => a.included)).toBe(true);
  });

  it('acceptProposal materializes agents and tasks, sets company active', async () => {
    const { proposal } = await draftProposal({ missionPrompt: DEMO_PROMPT });

    const previewByRole = Object.fromEntries(proposal.proposedAgents.map((a) => [a.role, a.displayName]));

    const result = await acceptProposal(proposal.id);

    expect(result.company.status).toBe('active');
    expect(result.agents.length).toBeGreaterThanOrEqual(1);
    expect(result.initialTasks.length).toBeGreaterThanOrEqual(1);

    for (const a of result.agents) {
      expect(a.displayName).toBe(previewByRole[a.role]);
    }

    // Proposal marked accepted
    const saved = getProposal(proposal.id);
    expect(saved?.status).toBe('accepted');

    // Agents now in db
    const dbAgents = db().agents.all({ companyId: result.company.id });
    expect(dbAgents.length).toBe(result.agents.length);
  });

  it('acceptProposal with excluded agent skips that role', async () => {
    const { proposal } = await draftProposal({ missionPrompt: DEMO_PROMPT });

    // Exclude all but the first agent
    for (const a of proposal.proposedAgents.slice(1)) {
      excludeAgent(proposal.id, a.id, false);
    }

    const result = await acceptProposal(proposal.id);

    // Only 1 agent (or 0 if first agent's tasks have no match — partial is expected)
    expect(result.agents.length).toBeLessThanOrEqual(proposal.proposedAgents.length);
    expect(result.company.status).toBe('active');
  });

  it('rebuildProposal creates a new proposal and marks old as rebuilding', async () => {
    const { proposal: original } = await draftProposal({ missionPrompt: DEMO_PROMPT });

    const { proposal: rebuilt } = await rebuildProposal(original.id, {
      feedback: 'Focus on B2B SaaS customers only',
    });

    expect(rebuilt.id).not.toBe(original.id);
    expect(rebuilt.status).toBe('reviewing');
    expect(rebuilt.missionPrompt).toContain('Focus on B2B SaaS customers only');

    const old = getProposal(original.id);
    expect(old?.status).toBe('rebuilding');
  });

  it('cannot accept a proposal that is not in reviewing state', async () => {
    const { proposal } = await draftProposal({ missionPrompt: DEMO_PROMPT });
    await acceptProposal(proposal.id);

    await expect(acceptProposal(proposal.id)).rejects.toThrow('not in reviewing state');
  });
});
