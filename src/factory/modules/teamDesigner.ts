import { db } from '../store/db';
import { newId } from '../domain/ids';
import { appendAudit } from '../audit/audit';
import type { Agent, Blueprint, Company, EscalationRule, ProposedAgent } from '../domain/types';
import { assignAvatarSlugsUnique, buildAgentDisplayName, normalizeAvatarSlug } from './agentCodename';

const DEFAULT_ESCALATION: EscalationRule[] = [
  { trigger: 'budget_exceeded', action: 'pause_agent' },
  { trigger: 'max_attempts', action: 'notify_human' },
  { trigger: 'approval_rejected', action: 'cancel_task' },
];

export function designTeam(company: Company, blueprint: Blueprint): Agent[] {
  const avatarSeed = `${Date.now()}\x1e${newId('av')}\x1e${company.id}\x1e${blueprint.agents.map((a) => `${a.role}:${a.name}`).join('|')}`;
  const slugs = assignAvatarSlugsUnique(blueprint.agents.length, avatarSeed);
  const agents: Agent[] = blueprint.agents.map((spec, i) => {
    const id = newId('agt');
    const avatarSlug = slugs[i]!;
    const agent: Agent = {
      id,
      companyId: company.id,
      role: spec.role,
      name: spec.name,
      displayName: buildAgentDisplayName(spec.role, id, avatarSlug),
      avatarSlug,
      systemPrompt: spec.systemPrompt,
      permissions: spec.permissions,
      escalationRules: DEFAULT_ESCALATION,
      status: 'idle',
      costToDateUsd: 0,
    };
    db().agents.create(agent);
    appendAudit({
      companyId: company.id,
      kind: 'agent.hired',
      actor: 'system',
      payload: { agentId: agent.id, role: agent.role, name: agent.name, permissions: agent.permissions },
    });
    return agent;
  });
  return agents;
}

/**
 * Persist agents from proposal review (same display names / avatars the user saw).
 * `orderedProposed` must align 1:1 with `blueprint.agents` (same order and roles).
 */
export function materializeAgentsFromProposed(company: Company, orderedProposed: ProposedAgent[]): Agent[] {
  const agents: Agent[] = [];
  for (let i = 0; i < orderedProposed.length; i += 1) {
    const pa = orderedProposed[i]!;
    const id = newId('agt');
    const agent: Agent = {
      id,
      companyId: company.id,
      role: pa.role,
      name: pa.name,
      displayName: pa.displayName,
      avatarSlug: normalizeAvatarSlug(pa.avatarSlug),
      systemPrompt: pa.systemPrompt,
      permissions: pa.permissions,
      escalationRules: DEFAULT_ESCALATION,
      status: 'idle',
      costToDateUsd: 0,
    };
    db().agents.create(agent);
    appendAudit({
      companyId: company.id,
      kind: 'agent.hired',
      actor: 'system',
      payload: { agentId: agent.id, role: agent.role, name: agent.name, permissions: agent.permissions },
    });
    agents.push(agent);
  }
  return agents;
}
