import type { Blueprint } from '@/factory/domain/types';
import { BlueprintSchema } from '@/factory/domain/schemas';
import type { Locale } from '@/i18n/constants';
import { DEFAULT_LOCALE } from '@/i18n/constants';
import { blueprintSystemPrompt, mockDeterministicBlueprint } from '@/llm/locale-prompts';
import { extractJsonStringFromLlmOutput } from '@/llm/extract-json-from-llm';
import { preferIpv4DnsOnce } from '@/lib/prefer-ipv4-dns';

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

  private async postCompletions(body: Record<string, unknown>): Promise<Response> {
    try {
      return await fetch(this.completionsUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const cause =
        err instanceof Error && err.cause !== undefined ? ` cause=${String(err.cause)}` : '';
      throw new Error(
        `LLM fetch failed for ${this.completionsUrl}: ${msg}${cause}. From this server, the URL must be reachable (DNS, TLS, firewall, IPv6/IPv4).`,
      );
    }
  }

  async generate(messages: LlmMessage[]): Promise<string> {
    const response = await this.postCompletions({ model: this.model, messages, temperature: 0.3 });

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

    const response = await this.postCompletions(payload);

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`LLM blueprint failed: ${response.status} ${text}`);
    }

    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = json.choices?.[0]?.message?.content ?? '{}';
    const jsonSlice = extractJsonStringFromLlmOutput(raw);
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonSlice);
    } catch {
      throw new Error(`LLM returned invalid JSON: ${raw.slice(0, 400)}`);
    }
    const validated = BlueprintSchema.parse(parsed);
    return { data: validated, raw, costUsd: LLM_TEXT_COST_USD * 5 };
  }
}

export function defaultEnvRuntime(): LlmRuntimeConfig {
  const raw = (process.env.LLM_PROVIDER || 'mock').toLowerCase();
  if (raw === 'neurohub') {
    return {
      provider: 'neurohub',
      baseUrl:
        process.env.NEUROHUB_BASE_URL ||
        process.env.OPENAI_BASE_URL ||
        'https://ai.nova01.click/neurohub/v1',
      /** Prefer NEUROHUB_* so OPENAI_API_KEY in the same .env does not shadow (Neurohub → 401). */
      apiKey: process.env.NEUROHUB_API_KEY || process.env.OPENAI_API_KEY,
      model: process.env.NEUROHUB_MODEL || process.env.OPENAI_MODEL || 'Qwen/Qwen3.5-27B',
      blueprintJsonMode: false,
    };
  }
  if (raw === 'openai') {
    return {
      provider: 'openai',
      baseUrl:
        process.env.OPENAI_BASE_URL ||
        process.env.NEUROHUB_BASE_URL ||
        'https://api.openai.com/v1',
      apiKey: process.env.OPENAI_API_KEY || process.env.NEUROHUB_API_KEY,
      model: process.env.OPENAI_MODEL || process.env.NEUROHUB_MODEL || 'gpt-4o-mini',
      blueprintJsonMode: true,
    };
  }
  return { provider: 'mock' };
}

export function createLlmClient(runtime?: LlmRuntimeConfig | null): LlmClient {
  preferIpv4DnsOnce();
  const cfg = runtime ?? defaultEnvRuntime();
  if (cfg.provider === 'mock') return new MockLlmClient();

  const apiKey = cfg.apiKey;
  if (!apiKey) {
    throw new Error(
      'LLM apiKey missing for non-mock provider (set profile or OPENAI_API_KEY / NEUROHUB_API_KEY)',
    );
  }
  const model =
    cfg.model?.trim() ||
    (cfg.provider === 'neurohub'
      ? process.env.NEUROHUB_MODEL || 'Qwen/Qwen3.5-27B'
      : 'gpt-4o-mini');
  const base =
    cfg.baseUrl?.trim() ||
    (cfg.provider === 'neurohub'
      ? process.env.NEUROHUB_BASE_URL || 'https://ai.nova01.click/neurohub/v1'
      : 'https://api.openai.com/v1');
  const url = chatCompletionsUrl(base);
  const blueprintJsonMode = cfg.blueprintJsonMode ?? cfg.provider !== 'neurohub';
  return new OpenAiCompatibleClient(apiKey, model, url, blueprintJsonMode);
}
