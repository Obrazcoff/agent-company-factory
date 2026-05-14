import { db } from '../store/db';
import { newId } from '../domain/ids';
import { appendAudit } from '../audit/audit';
import type { Agent, Blueprint, Company, EscalationRule } from '../domain/types';
import { agentAvatarSlug, buildAgentDisplayName } from './agentCodename';

const DEFAULT_ESCALATION: EscalationRule[] = [
  { trigger: 'budget_exceeded', action: 'pause_agent' },
  { trigger: 'max_attempts', action: 'notify_human' },
  { trigger: 'approval_rejected', action: 'cancel_task' },
];

export function designTeam(company: Company, blueprint: Blueprint): Agent[] {
  const agents: Agent[] = blueprint.agents.map((spec) => {
    const id = newId('agt');
    const avatarSlug = agentAvatarSlug(id);
    const agent: Agent = {
      id,
      companyId: company.id,
      role: spec.role,
      name: spec.name,
      displayName: buildAgentDisplayName(spec.role, id),
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
