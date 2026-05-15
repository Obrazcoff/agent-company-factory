import type { AgentRole } from '../domain/types';

/**
 * Animal avatars from **Animal Outlined Sepia Icons** (SVGRepo collection).
 * @see https://www.svgrepo.com/collection/animal-outlined-sepia-icons/
 * Files: `public/agents/<slug>.svg` (CC0 / collection license per SVGRepo).
 */
export const AGENT_AVATAR_SLUGS = [
  'alpaca',
  'anteater',
  'bat',
  'beetle',
  'butterfly',
  'camel',
  'cat',
  'chameleon',
  'cobra',
  'crab',
  'crocodile',
  'dog',
  'duck',
  'elk',
  'elephant',
  'fish',
  'frog',
  'giraffe',
  'hippo',
  'husky',
  'kangaroo',
  'lion',
  'macaw',
  'manatee',
  'mianyang',
  'monkey',
  'mouse',
  'octopus',
  'ostrich',
  'owl',
  'panda',
  'pelican',
  'penguin',
  'pig',
  'raccoon',
  'rhino',
  'rooster',
  'sea-ray',
  'shark',
  'sloth',
  'snake',
  'spider',
  'squirrel',
  'swan',
  'the-cow',
  'tiger',
  'toucan',
  'turtle',
  'whale',
  'white-rabbit',
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

/** Seeded PRNG in [0, 1) — stable for same `seed` string. */
function createRng(seed: string): () => number {
  let state = hashString(seed) >>> 0;
  if (state === 0) state = 0x9e3779b9;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/**
 * Shuffles the full animal pool deterministically from `seed`, then returns the first `count`
 * slugs **without duplicates**. Each new `seed` gives a different random assignment.
 */
export function assignAvatarSlugsUnique(count: number, seed: string): AgentAvatarSlug[] {
  if (count > AGENT_AVATAR_SLUGS.length) {
    throw new Error(
      `assignAvatarSlugsUnique: need ${count} unique avatars but only ${AGENT_AVATAR_SLUGS.length} exist`,
    );
  }
  const pool = [...AGENT_AVATAR_SLUGS] as AgentAvatarSlug[];
  const rng = createRng(seed);
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const t = pool[i]!;
    pool[i] = pool[j]!;
    pool[j] = t;
  }
  return pool.slice(0, count);
}

/** First slug from a shuffled pool that is not in `used` (e.g. existing company agents). */
export function pickUnusedAvatarSlug(usedSlugs: ReadonlySet<string>, seed: string): AgentAvatarSlug {
  const pool = assignAvatarSlugsUnique(AGENT_AVATAR_SLUGS.length, seed);
  for (const s of pool) {
    if (!usedSlugs.has(s)) return s;
  }
  return AGENT_AVATAR_SLUGS[0]!;
}

/** Human label for UI title, e.g. `white-rabbit` → "White Rabbit". */
export function formatAnimalLabel(slug: AgentAvatarSlug): string {
  return slug
    .split('-')
    .map((w) => (w.length ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(' ');
}

/** Fun stable title e.g. "Director Frog" — `avatarSlug` must match the image file. */
export function buildAgentDisplayName(role: AgentRole, agentId: string, avatarSlug: AgentAvatarSlug): string {
  const titles = ROLE_TITLES[role];
  const title = titles[hashString(agentId) % titles.length]!;
  const animal = formatAnimalLabel(avatarSlug);
  return `${title} ${animal}`;
}

export function avatarPublicPath(slug: AgentAvatarSlug): string {
  return `/agents/${slug}.svg`;
}

export function normalizeAvatarSlug(slug: string): AgentAvatarSlug {
  return (AGENT_AVATAR_SLUGS as readonly string[]).includes(slug) ? (slug as AgentAvatarSlug) : 'frog';
}
