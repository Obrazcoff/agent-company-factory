import type { Blueprint } from '@/factory/domain/types';
import { BlueprintSchema } from '@/factory/domain/schemas';
import type { Locale } from '@/i18n/constants';
import { DEFAULT_LOCALE } from '@/i18n/constants';
import { blueprintSystemPrompt, mockDeterministicBlueprint } from '@/llm/locale-prompts';
import { extractJsonStringFromLlmOutput } from '@/llm/extract-json-from-llm';
import { normalizeBlueprintPayload } from '@/llm/normalize-blueprint-payload';
import { preferIpv4DnsOnce } from '@/lib/prefer-ipv4-dns';
import { preflightLlmOriginReachable } from '@/llm/llm-host-preflight';
import {
  aggregateOpenAiSseChatContent,
  shouldTreatAsSseStream,
  type SseReadableResponse,
} from '@/llm/openai-chat-stream';
import type { LlmBlueprintGenerateOptions } from '@/llm/llm-progress';
import { Agent, fetch as undiciFetch } from 'undici';

export type { LlmBlueprintGenerateOptions, LlmBlueprintProgressEvent } from '@/llm/llm-progress';

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
    options?: LlmBlueprintGenerateOptions,
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

function tryStreamingBlueprint(): boolean {
  /** Default off: same host as JSON call — avoids an extra full connect wait when the gateway is down or ignores stream. */
  const v = (process.env.LLM_TRY_STREAMING_BLUEPRINT ?? '0').toLowerCase();
  return v === '1' || v === 'true' || v === 'on';
}

/** Same host: a failed TCP connect on stream POST will repeat on JSON POST — do not wait twice. */
function isLlmConnectTimeoutError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /ConnectTimeout|connect timeout/i.test(msg);
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
    _options?: LlmBlueprintGenerateOptions,
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

/** Longer than Node's default ~10s connect timeout — Neurohub/TLS can be slow from some VPS. */
let llmUndiciAgent: Agent | undefined;

function getLlmUndiciAgent(): Agent {
  if (!llmUndiciAgent) {
    const connect = Math.min(300_000, Math.max(5_000, Number(process.env.LLM_CONNECT_TIMEOUT_MS || 60_000)));
    const headers = Math.min(600_000, Math.max(10_000, Number(process.env.LLM_HEADERS_TIMEOUT_MS || 180_000)));
    const body = Math.min(600_000, Math.max(10_000, Number(process.env.LLM_BODY_TIMEOUT_MS || 180_000)));
    llmUndiciAgent = new Agent({
      connectTimeout: connect,
      headersTimeout: headers,
      bodyTimeout: body,
    });
  }
  return llmUndiciAgent;
}

class OpenAiCompatibleClient implements LlmClient {
  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    private readonly completionsUrl: string,
    private readonly blueprintJsonMode: boolean,
  ) {}

  private finishBlueprintFromAssistantRaw(raw: string): LlmCallResult<Blueprint> {
    const jsonSlice = extractJsonStringFromLlmOutput(raw);
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonSlice);
    } catch {
      throw new Error(`LLM returned invalid JSON: ${raw.slice(0, 400)}`);
    }
    const normalized = normalizeBlueprintPayload(parsed);
    const validated = BlueprintSchema.parse(normalized);
    return { data: validated, raw, costUsd: LLM_TEXT_COST_USD * 5 };
  }

  private async postCompletions(body: Record<string, unknown>) {
    try {
      return await undiciFetch(this.completionsUrl, {
        dispatcher: getLlmUndiciAgent(),
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
        `LLM fetch failed for ${this.completionsUrl}: ${msg}${cause}. If this mentions ConnectTimeout, the server never completed TCP/TLS to the LLM host (not “slow generation”). Check DNS, firewall, IPv4/IPv6, and routing from this machine.`,
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
    options?: LlmBlueprintGenerateOptions,
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

    options?.onProgress?.({ stage: 'preflight_start' });
    const pf = await preflightLlmOriginReachable(this.completionsUrl, this.apiKey);
    options?.onProgress?.({ stage: 'preflight_ok', ms: pf.ms });

    if (tryStreamingBlueprint()) {
      try {
        options?.onProgress?.({ stage: 'llm_stream_attempt' });
        const streamRes = await this.postCompletions({ ...payload, stream: true });
        const sseRes = streamRes as unknown as SseReadableResponse;
        if (streamRes.ok && shouldTreatAsSseStream(sseRes)) {
          const raw = await aggregateOpenAiSseChatContent(sseRes, (total) => {
            options?.onProgress?.({ stage: 'llm_stream_chars', total });
          });
          if (raw.trim().length > 0) {
            return this.finishBlueprintFromAssistantRaw(raw);
          }
        } else if (streamRes.ok) {
          const ct = (streamRes.headers.get('content-type') ?? '').toLowerCase();
          if (ct.includes('application/json')) {
            const json = (await streamRes.json()) as {
              choices?: Array<{ message?: { content?: string } }>;
            };
            const raw = json.choices?.[0]?.message?.content ?? '';
            if (raw.trim().length > 0) {
              return this.finishBlueprintFromAssistantRaw(raw);
            }
          } else {
            try {
              await streamRes.body?.cancel();
            } catch {
              /* ignore */
            }
          }
        } else {
          await streamRes.text().catch(() => {});
        }
      } catch (e) {
        if (isLlmConnectTimeoutError(e)) throw e;
        /* fall through to JSON completion */
      }
    }

    options?.onProgress?.({ stage: 'llm_json_attempt' });
    const response = await this.postCompletions(payload);

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`LLM blueprint failed: ${response.status} ${text}`);
    }

    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = json.choices?.[0]?.message?.content ?? '{}';
    return this.finishBlueprintFromAssistantRaw(raw);
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
