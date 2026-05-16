import { z } from 'zod';
import { db } from '../store/db';
import type { Company, Task, TraceEvent } from '../domain/types';
import type { Locale } from '@/i18n/constants';
import { DEFAULT_LOCALE } from '@/i18n/constants';
import type { LlmMessage } from '@/llm/provider';
import { extractJsonStringFromLlmOutput } from '@/llm/extract-json-from-llm';

const MarketResearchSchema = z.object({
  summary: z.string(),
  trends: z.array(z.string()).optional(),
  segments: z.array(z.string()).optional(),
  competitors: z.array(z.string()).optional(),
});

const SocialPostsSchema = z.object({
  posts: z.array(
    z.object({
      title: z.string(),
      body: z.string(),
      hashtags: z.array(z.string()).optional(),
      platform: z.string().optional(),
    }),
  ),
});

export type LlmTaskEmit = (
  step: string,
  status: TraceEvent['status'],
  message?: string,
  data?: unknown,
) => void;

function companyLocale(company: Company): Locale {
  return company.contentLocale ?? DEFAULT_LOCALE;
}

function missionText(company: Company): string {
  return (
    [company.missionPrompt?.trim(), company.mission?.trim()].filter(Boolean).join('\n\n') || company.mission
  );
}

/** Latest successful run output per dependency task id (order preserved). */
export function dependencyDoneOutputs(task: Task): unknown[] {
  const out: unknown[] = [];
  for (const depId of task.dependsOn ?? []) {
    const runs = db().runs.find((r) => r.taskId === depId && r.status === 'done');
    const last = runs
      .sort((a, b) => {
        const ta = a.finishedAt ?? a.startedAt;
        const tb = b.finishedAt ?? b.startedAt;
        return ta.localeCompare(tb);
      })
      .at(-1);
    if (last?.output !== undefined) out.push(last.output);
  }
  return out;
}

function parseJsonObject(raw: string): unknown {
  const s = extractJsonStringFromLlmOutput(raw);
  return JSON.parse(s) as unknown;
}

export function fallbackMarketResearch(company: Company): z.infer<typeof MarketResearchSchema> {
  const m = missionText(company).slice(0, 400);
  return {
    summary:
      companyLocale(company) === 'ru'
        ? `Черновой обзор рынка (модель вернула не-JSON или сработал mock LLM). Исходная цель: ${m}`
        : `Draft market overview (model returned non-JSON or mock LLM). Goal: ${m}`,
    trends: ['D2C', 'marketplaces', 'influencer-led discovery'],
    segments: ['skincare', 'color cosmetics'],
  };
}

export function fallbackSocialPosts(company: Company, postCount: number): z.infer<typeof SocialPostsSchema> {
  const m = missionText(company).slice(0, 160);
  const ru = companyLocale(company) === 'ru';
  return {
    posts: Array.from({ length: postCount }, (_, i) => ({
      title: ru ? `Пост ${i + 1}: фокус на продукт` : `Post ${i + 1}: product spotlight`,
      body: ru
        ? `Черновик (fallback). Тема из цели: ${m}… При подключённом LLM здесь будет уникальный текст.`
        : `Draft (fallback). Theme from goal: ${m}… With a real LLM this will be unique copy.`,
      hashtags: ['#beauty', '#cosmetics'],
      platform: 'Instagram',
    })),
  };
}

export async function runLlmMarketResearch(args: {
  company: Company;
  task: Task;
  input: Record<string, unknown>;
  llmGenerate: (messages: LlmMessage[]) => Promise<string>;
  emit: LlmTaskEmit;
}): Promise<z.infer<typeof MarketResearchSchema>> {
  const loc = companyLocale(args.company);
  const mission = missionText(args.company);
  const vertical = String(args.input.vertical ?? args.input.focus ?? '').trim() || 'cosmetics / beauty';

  args.emit('llm_market', 'started', loc === 'ru' ? 'LLM: обзор рынка' : 'LLM: market scan');

  const system =
    loc === 'ru'
      ? 'Ты маркетинговый аналитик. Ответь ТОЛЬКО JSON без markdown: {"summary": string, "trends"?: string[], "segments"?: string[], "competitors"?: string[]}. Пиши на русском.'
      : 'You are a market analyst. Reply ONLY with JSON (no markdown): {"summary": string, "trends"?: string[], "segments"?: string[], "competitors"?: string[]}.';

  const user =
    loc === 'ru'
      ? `Вертикаль/фокус: ${vertical}\n\nЦель компании (контекст):\n${mission}\n\nСделай краткий обзор рынка и ключевые тренды.`
      : `Vertical / focus: ${vertical}\n\nCompany goal (context):\n${mission}\n\nProduce a concise market overview and key trends.`;

  let raw: string;
  try {
    raw = await args.llmGenerate([
      { role: 'system', content: system },
      { role: 'user', content: user },
    ]);
  } catch (e) {
    args.emit('llm_market', 'failed', String(e));
    return fallbackMarketResearch(args.company);
  }

  try {
    const parsed = MarketResearchSchema.parse(parseJsonObject(raw));
    args.emit('llm_market', 'completed', loc === 'ru' ? 'Обзор получен' : 'Overview ready', {
      summaryLen: parsed.summary.length,
    });
    return parsed;
  } catch {
    args.emit(
      'llm_market',
      'completed',
      loc === 'ru' ? 'Невалидный JSON от LLM — используем fallback' : 'Invalid LLM JSON — using fallback',
    );
    return fallbackMarketResearch(args.company);
  }
}

export async function runLlmSocialPosts(args: {
  company: Company;
  task: Task;
  input: Record<string, unknown>;
  llmGenerate: (messages: LlmMessage[]) => Promise<string>;
  emit: LlmTaskEmit;
}): Promise<z.infer<typeof SocialPostsSchema>> {
  const loc = companyLocale(args.company);
  const mission = missionText(args.company);
  const postCount = Math.min(12, Math.max(1, Number(args.input.postCount ?? 5)));
  const platforms = String(args.input.platforms ?? 'Instagram, TikTok').trim();

  const prior = dependencyDoneOutputs(args.task);
  const priorText =
    prior.length > 0
      ? JSON.stringify(prior, null, 2)
      : loc === 'ru'
        ? '(нет завершённых зависимых задач — опирайся только на цель)'
        : '(no completed dependency tasks — rely on the goal only)';

  args.emit('llm_social', 'started', loc === 'ru' ? `LLM: ${postCount} постов` : `LLM: ${postCount} posts`);

  const system =
    loc === 'ru'
      ? `Ты SMM-копирайтер. Ответь ТОЛЬКО JSON без markdown: {"posts":[{"title":string,"body":string,"hashtags"?:string[],"platform"?:string}]}. Ровно ${postCount} элементов в posts. Тексты на русском.`
      : `You are a social copywriter. Reply ONLY with JSON (no markdown): {"posts":[{"title":string,"body":string,"hashtags"?:string[],"platform"?:string}]}. Exactly ${postCount} items in "posts".`;

  const user =
    loc === 'ru'
      ? `Площадки: ${platforms}\n\nЦель компании:\n${mission}\n\nКонтекст из предыдущих шагов (обзор рынка и т.д.):\n${priorText}\n\nСгенерируй ${postCount} разных постов для соцсетей (UGC-friendly, без ложных обещаний).`
      : `Platforms: ${platforms}\n\nCompany goal:\n${mission}\n\nContext from upstream steps (market research etc.):\n${priorText}\n\nGenerate ${postCount} distinct social posts (UGC-friendly, no false claims).`;

  let raw: string;
  try {
    raw = await args.llmGenerate([
      { role: 'system', content: system },
      { role: 'user', content: user },
    ]);
  } catch (e) {
    args.emit('llm_social', 'failed', String(e));
    return fallbackSocialPosts(args.company, postCount);
  }

  try {
    const parsed = SocialPostsSchema.parse(parseJsonObject(raw));
    const posts = parsed.posts.slice(0, postCount);
    while (posts.length < postCount) {
      posts.push({
        title: loc === 'ru' ? `Доп. пост ${posts.length + 1}` : `Extra post ${posts.length + 1}`,
        body: mission.slice(0, 200),
      });
    }
    args.emit('llm_social', 'completed', loc === 'ru' ? 'Посты готовы' : 'Posts ready', {
      count: posts.length,
    });
    return { posts };
  } catch {
    args.emit(
      'llm_social',
      'completed',
      loc === 'ru' ? 'Невалидный JSON от LLM — fallback' : 'Invalid LLM JSON — fallback',
    );
    return fallbackSocialPosts(args.company, postCount);
  }
}
