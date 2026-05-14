import type { AgentRole } from '../domain/types';

/** File names under /public/agents/ (outline-style, project-owned assets). */
export const AGENT_AVATAR_SLUGS = [
  'frog',
  'fox',
  'owl',
  'bear',
  'wolf',
  'hawk',
  'deer',
  'otter',
  'lynx',
  'crane',
  'raven',
  'badger',
] as const;

export type AgentAvatarSlug = (typeof AGENT_AVATAR_SLUGS)[number];

const ROLE_TITLES: Record<AgentRole, readonly string[]> = {
  CEO: ['Chief', 'Director', 'Principal', 'Executive'],
  PM: ['Lead', 'Program', 'Delivery', 'Senior'],
  Researcher: ['Field', 'Scout', 'Insight', 'Senior'],
  Outreach: ['Growth', 'Partner', 'Bridge', 'Senior'],
  Ops: ['Systems', 'Runtime', 'Steward', 'Senior'],
};

function hashString(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) {
    h = (h << 5) - h + input.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

export function agentAvatarSlug(agentId: string): AgentAvatarSlug {
  const i = hashString(agentId) % AGENT_AVATAR_SLUGS.length;
  return AGENT_AVATAR_SLUGS[i]!;
}

function capitalize(word: string): string {
  return word.length ? word[0]!.toUpperCase() + word.slice(1) : word;
}

/** Stable fun title e.g. "Director Frog" from id + role (same id always same name). */
export function buildAgentDisplayName(role: AgentRole, agentId: string): string {
  const titles = ROLE_TITLES[role];
  const title = titles[hashString(agentId) % titles.length]!;
  const animal = capitalize(agentAvatarSlug(agentId));
  return `${title} ${animal}`;
}

export function avatarPublicPath(slug: AgentAvatarSlug): string {
  return `/agents/${slug}.svg`;
}

export function normalizeAvatarSlug(slug: string): AgentAvatarSlug {
  return (AGENT_AVATAR_SLUGS as readonly string[]).includes(slug) ? (slug as AgentAvatarSlug) : 'frog';
}
