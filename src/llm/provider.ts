import type { Blueprint } from '@/factory/domain/types';
import { BlueprintSchema } from '@/factory/domain/schemas';

export type LlmMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type LlmCallResult<T> = {
  data: T;
  raw: string;
  costUsd: number;
};

export type LlmClient = {
  generate(messages: LlmMessage[]): Promise<string>;
  generateBlueprint(missionPrompt: string, dailyBudgetUsd: number): Promise<LlmCallResult<Blueprint>>;
};

/** Resolved from env or per-project DB profile (OpenAI-compatible HTTP). */
export type LlmRuntimeConfig = {
  provider: 'mock' | 'openai' | 'neurohub';
  /** e.g. https://api.openai.com/v1 or https://neurohub.example/v1 — trailing slash optional */
  baseUrl?: string;
  apiKey?: string;
  model?: string;
};

const LLM_TEXT_COST_USD = 0.01;

const BLUEPRINT_SYSTEM_PROMPT = (
  dailyBudgetUsd: number,
) => `You design AI agent companies. Reply ONLY with JSON matching this schema (no markdown, no commentary):
{
  "mission": string,
  "kpis": [{"name": string, "target": number|string, "unit"?: string}],
  "dailyCapUsd": number,
  "approvals": string[],
  "agents": [{"role": "CEO"|"PM"|"Researcher"|"Outreach"|"Ops", "name": string, "systemPrompt": string, "permissions": string[]}],
  "initialTasks": [{"kind": string, "role": "CEO"|"PM"|"Researcher"|"Outreach"|"Ops", "input": object, "dependsOnIndex"?: number[]}]
}
Constraints: at least 3 agents (include PM + Researcher + Outreach), at least 5 initialTasks, dailyCapUsd = ${dailyBudgetUsd}, approvals must include "gmail" if any outreach happens.`;

function lastUserContent(messages: LlmMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message.role === 'user') return message.content;
  }
  return '';
}

function deterministicBlueprint(missionPrompt: string, dailyBudgetUsd: number): Blueprint {
  return {
    mission:
      'Run an autonomous B2B lead generation company that finds prospects, enriches them, prepares outreach, and books qualified discovery calls under a strict daily budget and human approval for outbound communication.',
    kpis: [
      { name: 'qualified_leads_per_day', target: 10, unit: 'leads' },
      { name: 'booked_calls_per_week', target: 5, unit: 'calls' },
      { name: 'cost_per_lead_usd', target: 5, unit: 'usd' },
    ],
    dailyCapUsd: dailyBudgetUsd,
    approvals: ['gmail', 'calendar'],
    agents: [
      {
        role: 'PM',
        name: 'PM-Atlas',
        systemPrompt:
          'You are the project manager. You decompose company goals into concrete tasks, balance workload across agents, and enforce KPI focus. You never call external tools yourself.',
        permissions: [],
      },
      {
        role: 'Researcher',
        name: 'Researcher-Nova',
        systemPrompt:
          'You research B2B prospects using web search and CRM. You output structured lead lists with company name, industry, size, and rationale. You never write outbound messages.',
        permissions: ['web_search', 'crm', 'sheets'],
      },
      {
        role: 'Outreach',
        name: 'Outreach-Vega',
        systemPrompt:
          'You craft personalized outreach drafts based on enriched lead data. You produce email drafts that always require human approval before being sent.',
        permissions: ['gmail', 'crm'],
      },
      {
        role: 'Ops',
        name: 'Ops-Lyra',
        systemPrompt:
          'You handle follow-ups, scheduling, and produce daily reports. Calendar invites require human approval.',
        permissions: ['calendar', 'sheets', 'crm'],
      },
    ],
    initialTasks: [
      { kind: 'research_companies', role: 'Researcher', input: { count: 10, missionPrompt } },
      { kind: 'enrich_leads', role: 'Researcher', input: {}, dependsOnIndex: [0] },
      { kind: 'draft_outreach', role: 'Outreach', input: { variant: 'A' }, dependsOnIndex: [1] },
      { kind: 'draft_outreach', role: 'Outreach', input: { variant: 'B' }, dependsOnIndex: [1] },
      { kind: 'draft_outreach', role: 'Outreach', input: { variant: 'C' }, dependsOnIndex: [1] },
      { kind: 'schedule_followups', role: 'Ops', input: {}, dependsOnIndex: [2, 3, 4] },
      { kind: 'daily_report', role: 'Ops', input: {}, dependsOnIndex: [5] },
    ],
  };
}

class MockLlmClient implements LlmClient {
  async generate(messages: LlmMessage[]): Promise<string> {
    const userMessage = lastUserContent(messages);
    return [
      'Mock LLM response.',
      'Input summary:',
      userMessage.slice(0, 500),
      '',
      'Recommended direction:',
      '- focus on one vertical slice',
      '- keep traceability',
      '- gate risky actions behind human approval',
    ].join('\n');
  }

  async generateBlueprint(missionPrompt: string, dailyBudgetUsd: number): Promise<LlmCallResult<Blueprint>> {
    const data = deterministicBlueprint(missionPrompt, dailyBudgetUsd);
    return {
      data,
      raw: JSON.stringify(data),
      costUsd: LLM_TEXT_COST_USD,
    };
  }
}

function chatCompletionsUrl(base: string): string {
  const b = base.replace(/\/$/, '');
  if (b.endsWith('/chat/completions')) return b;
  return `${b}/chat/completions`;
}

class OpenAiCompatibleClient implements LlmClient {
  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    private readonly completionsUrl: string,
  ) {}

  async generate(messages: LlmMessage[]): Promise<string> {
    const response = await fetch(this.completionsUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: this.model, messages, temperature: 0.3 }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`LLM request failed: ${response.status} ${text}`);
    }

    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return json.choices?.[0]?.message?.content ?? '';
  }

  async generateBlueprint(missionPrompt: string, dailyBudgetUsd: number): Promise<LlmCallResult<Blueprint>> {
    const systemPrompt = BLUEPRINT_SYSTEM_PROMPT(dailyBudgetUsd);

    const response = await fetch(this.completionsUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: missionPrompt },
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`LLM blueprint failed: ${response.status} ${text}`);
    }

    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = json.choices?.[0]?.message?.content ?? '{}';
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error(`LLM returned invalid JSON: ${raw.slice(0, 200)}`);
    }
    const validated = BlueprintSchema.parse(parsed);
    return { data: validated, raw, costUsd: LLM_TEXT_COST_USD * 5 };
  }
}

function defaultEnvRuntime(): LlmRuntimeConfig {
  const provider = (process.env.LLM_PROVIDER || 'mock') as LlmRuntimeConfig['provider'];
  return {
    provider: provider === 'openai' || provider === 'neurohub' ? provider : 'mock',
    baseUrl: process.env.NEUROHUB_BASE_URL || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    apiKey: process.env.OPENAI_API_KEY || process.env.NEUROHUB_API_KEY,
    model: process.env.OPENAI_MODEL || process.env.NEUROHUB_MODEL || 'gpt-4o-mini',
  };
}

export function createLlmClient(runtime?: LlmRuntimeConfig | null): LlmClient {
  const cfg = runtime ?? defaultEnvRuntime();
  if (cfg.provider === 'mock') return new MockLlmClient();

  const apiKey = cfg.apiKey;
  if (!apiKey) {
    throw new Error(
      'LLM apiKey missing for non-mock provider (set profile or OPENAI_API_KEY / NEUROHUB_API_KEY)',
    );
  }
  const model = cfg.model || 'gpt-4o-mini';
  const base = cfg.baseUrl || 'https://api.openai.com/v1';
  const url = chatCompletionsUrl(base);
  return new OpenAiCompatibleClient(apiKey, model, url);
}
