import type { Blueprint } from '@/factory/domain/types';
import { BlueprintSchema } from '@/factory/domain/schemas';
import type { Locale } from '@/i18n/constants';
import { DEFAULT_LOCALE } from '@/i18n/constants';
import { blueprintSystemPrompt, mockDeterministicBlueprint } from '@/llm/locale-prompts';

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
  generateBlueprint(
    missionPrompt: string,
    dailyBudgetUsd: number,
    locale?: Locale,
  ): Promise<LlmCallResult<Blueprint>>;
};

/** Resolved from env or per-project DB profile (OpenAI-compatible HTTP). */
export type LlmRuntimeConfig = {
  provider: 'mock' | 'openai' | 'neurohub';
  /** e.g. https://api.openai.com/v1 or https://neurohub.example/v1 — trailing slash optional */
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  /**
   * Many OpenAI-compatible hosts (e.g. Neurohub) reject `response_format: json_object`.
   * When false, blueprint request omits response_format and relies on prompt + JSON parse.
   */
  blueprintJsonMode?: boolean;
};

const LLM_TEXT_COST_USD = 0.01;

function lastUserContent(messages: LlmMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message.role === 'user') return message.content;
  }
  return '';
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

  async generateBlueprint(
    missionPrompt: string,
    dailyBudgetUsd: number,
    locale: Locale = DEFAULT_LOCALE,
  ): Promise<LlmCallResult<Blueprint>> {
    const data = mockDeterministicBlueprint(missionPrompt, dailyBudgetUsd, locale);
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
    private readonly blueprintJsonMode: boolean,
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

  async generateBlueprint(
    missionPrompt: string,
    dailyBudgetUsd: number,
    locale: Locale = DEFAULT_LOCALE,
  ): Promise<LlmCallResult<Blueprint>> {
    const systemPrompt = blueprintSystemPrompt(dailyBudgetUsd, locale);

    const payload: Record<string, unknown> = {
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: missionPrompt },
      ],
      temperature: 0.2,
    };
    if (this.blueprintJsonMode) {
      payload.response_format = { type: 'json_object' };
    }

    const response = await fetch(this.completionsUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
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
  const resolved = provider === 'openai' || provider === 'neurohub' ? provider : 'mock';
  return {
    provider: resolved,
    baseUrl: process.env.NEUROHUB_BASE_URL || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    apiKey: process.env.OPENAI_API_KEY || process.env.NEUROHUB_API_KEY,
    model: process.env.OPENAI_MODEL || process.env.NEUROHUB_MODEL || 'gpt-4o-mini',
    blueprintJsonMode: resolved !== 'neurohub',
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
  const blueprintJsonMode = cfg.blueprintJsonMode ?? cfg.provider !== 'neurohub';
  return new OpenAiCompatibleClient(apiKey, model, url, blueprintJsonMode);
}
