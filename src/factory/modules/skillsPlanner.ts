import { db } from '../store/db';
import { listConnectorMeta, getConnector } from '../connectors/registry';
import type { Agent, Blueprint } from '../domain/types';

const ROLE_DEFAULT_PERMISSIONS: Record<string, string[]> = {
  PM: [],
  Researcher: ['web_search', 'crm', 'sheets'],
  Outreach: ['gmail.draft', 'gmail.send', 'crm'],
  Ops: ['calendar', 'sheets', 'crm'],
  CEO: [],
};

export function planSkills(agents: Agent[], _blueprint: Blueprint): Agent[] {
  const known = new Set(listConnectorMeta().map((c) => c.id));
  return agents.map((agent) => {
    const declared = agent.permissions.filter((p) => known.has(p));
    const defaults = ROLE_DEFAULT_PERMISSIONS[agent.role] ?? [];
    const merged = Array.from(new Set([...declared, ...defaults.filter((d) => known.has(d))]));
    if (merged.length === agent.permissions.length && merged.every((p) => agent.permissions.includes(p))) {
      return agent;
    }
    return db().agents.update(agent.id, (cur) => ({ ...cur, permissions: merged }));
  });
}

export function checkAgentCanUseConnector(agent: Agent, connectorId: string): boolean {
  if (!agent.permissions.includes(connectorId)) return false;
  return Boolean(getConnector(connectorId));
}
