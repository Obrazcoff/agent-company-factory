/**
 * LLMs often wrap the blueprint, use different key casing, or stringify numbers/arrays.
 * Normalize before BlueprintSchema.parse so Neurohub-style JSON still validates.
 */

const CANON = ['mission', 'kpis', 'dailyCapUsd', 'approvals', 'agents', 'initialTasks'] as const;
type CanonKey = (typeof CANON)[number];

const WRAPPER_KEYS = [
  'blueprint',
  'result',
  'data',
  'company',
  'output',
  'payload',
  'response',
  'json',
  'plan',
  'proposal',
];

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function looksLikeBlueprintCore(o: Record<string, unknown>): boolean {
  const missionOk =
    (typeof o.mission === 'string' && o.mission.length > 0) ||
    typeof (o as { Mission?: unknown }).Mission === 'string';
  const agentsOk = Array.isArray(o.agents) || Array.isArray((o as { Agents?: unknown }).Agents);
  return missionOk || agentsOk;
}

function isNestedWrapper(inner: Record<string, unknown>): boolean {
  if (looksLikeBlueprintCore(inner)) return true;
  return WRAPPER_KEYS.some((w) => isPlainObject(inner[w]));
}

/** Unwrap known LLM wrappers (blueprint / result / …) recursively. */
export function unwrapBlueprintish(raw: unknown): unknown {
  if (!isPlainObject(raw)) return raw;
  let cur: Record<string, unknown> = { ...raw };

  for (let d = 0; d < 8; d += 1) {
    if (looksLikeBlueprintCore(cur)) return cur;
    let advanced = false;
    for (const k of WRAPPER_KEYS) {
      const inner = cur[k];
      if (isPlainObject(inner) && isNestedWrapper(inner)) {
        cur = inner;
        advanced = true;
        break;
      }
    }
    if (!advanced) break;
  }

  if (!looksLikeBlueprintCore(cur)) {
    const lifted = liftSingleNestedBlueprint(cur);
    if (lifted) return lifted;
  }
  return cur;
}

function liftSingleNestedBlueprint(o: Record<string, unknown>): Record<string, unknown> | null {
  for (const v of Object.values(o)) {
    if (!isPlainObject(v)) continue;
    if (looksLikeBlueprintCore(v)) return v;
    for (const inner of Object.values(v)) {
      if (isPlainObject(inner) && looksLikeBlueprintCore(inner)) return inner;
    }
  }
  return null;
}

const KEY_ALIASES: Record<CanonKey, readonly string[]> = {
  mission: ['mission'],
  kpis: ['kpis'],
  dailyCapUsd: ['dailycapusd', 'daily_cap_usd', 'dailybudgetusd', 'budget_usd', 'dailybudget'],
  approvals: ['approvals', 'human_approvals', 'required_approvals'],
  agents: ['agents', 'team', 'roles'],
  initialTasks: ['initialtasks', 'initial_tasks', 'tasks', 'seed_tasks', 'startup_tasks'],
};

function acceptedLowerForms(canon: CanonKey): Set<string> {
  return new Set([canon.toLowerCase(), ...KEY_ALIASES[canon]]);
}

/** Map source object to canonical blueprint keys (handles snake_case and common aliases). */
export function pickCanonicalBlueprintKeys(src: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const canon of CANON) {
    const forms = acceptedLowerForms(canon);
    for (const sk of Object.keys(src)) {
      if (forms.has(sk.toLowerCase())) {
        out[canon] = src[sk];
        break;
      }
    }
  }
  return out;
}

function parseJsonArrayish<T>(v: unknown): T[] | undefined {
  if (Array.isArray(v)) return v as T[];
  if (typeof v === 'string') {
    const t = v.trim();
    if (!t) return undefined;
    try {
      const p = JSON.parse(t) as unknown;
      return Array.isArray(p) ? (p as T[]) : undefined;
    } catch {
      return undefined;
    }
  }
  if (isPlainObject(v)) return [v as T];
  return undefined;
}

function coerceStringMission(v: unknown): string | undefined {
  if (typeof v === 'string') return v.trim() || undefined;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (!isPlainObject(v)) return undefined;
  const nested =
    v.mission ??
    v.text ??
    v.summary ??
    v.description ??
    v.content ??
    v.overview ??
    v.goal;
  if (typeof nested === 'string') return nested.trim() || undefined;
  return undefined;
}

function coerceDailyCap(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const cleaned = v.replace(/[$€£\s]/g, '').replace(/,/g, '.');
    const n = Number(cleaned);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function coerceApprovals(v: unknown): string[] | undefined {
  if (Array.isArray(v)) {
    const out = v.map((x) => (typeof x === 'string' ? x : JSON.stringify(x)));
    return out.length ? out : undefined;
  }
  if (typeof v === 'string') {
    const t = v.trim();
    if (!t) return [];
    try {
      const p = JSON.parse(t) as unknown;
      if (Array.isArray(p)) return p.map((x) => String(x));
    } catch {
      /* fall through */
    }
    return t.split(/[,;|]/).map((s) => s.trim()).filter(Boolean);
  }
  return undefined;
}

/** OpenAI schema uses fixed enum labels; models often emit lowercase. */
const AGENT_ROLE_LOWER: Record<string, string> = {
  ceo: 'CEO',
  pm: 'PM',
  researcher: 'Researcher',
  outreach: 'Outreach',
  ops: 'Ops',
};

function normalizeRoleField(role: unknown): unknown {
  if (typeof role !== 'string') return role;
  const t = role.trim();
  return AGENT_ROLE_LOWER[t.toLowerCase()] ?? t;
}

function normalizeAgentsArray(agents: unknown): unknown {
  if (!Array.isArray(agents)) return agents;
  return agents.map((a) => {
    if (!isPlainObject(a)) return a;
    return { ...a, role: normalizeRoleField(a.role) };
  });
}

function normalizeTasksArray(tasks: unknown): unknown {
  if (!Array.isArray(tasks)) return tasks;
  return tasks.map((task) => {
    if (!isPlainObject(task)) return task;
    return { ...task, role: normalizeRoleField(task.role) };
  });
}

/** Apply unwrap + canonical keys + light coercion. Safe to call on any JSON value. */
export function normalizeBlueprintPayload(raw: unknown): unknown {
  const unwrapped = unwrapBlueprintish(raw);
  if (!isPlainObject(unwrapped)) return unwrapped;
  const picked = pickCanonicalBlueprintKeys(unwrapped);
  const out: Record<string, unknown> = { ...picked };

  const rawMission =
    out.mission ??
    unwrapped.mission ??
    (unwrapped as { Mission?: unknown }).Mission ??
    (unwrapped as { MISSION?: unknown }).MISSION;
  const m = coerceStringMission(rawMission);
  if (m !== undefined) out.mission = m;

  const kpis = parseJsonArrayish(out.kpis);
  if (kpis !== undefined) out.kpis = kpis;

  const cap = coerceDailyCap(out.dailyCapUsd);
  if (cap !== undefined) out.dailyCapUsd = cap;

  const appr = coerceApprovals(out.approvals);
  if (appr !== undefined) out.approvals = appr;

  const agents = parseJsonArrayish(out.agents);
  if (agents !== undefined) out.agents = agents;

  const tasks = parseJsonArrayish(out.initialTasks);
  if (tasks !== undefined) out.initialTasks = tasks;

  if (out.agents !== undefined) out.agents = normalizeAgentsArray(out.agents);
  if (out.initialTasks !== undefined) out.initialTasks = normalizeTasksArray(out.initialTasks);

  return out;
}
