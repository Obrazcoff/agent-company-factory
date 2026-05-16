import type { AgentRole, Blueprint } from '@/factory/domain/types';
import type { Locale } from '@/i18n/constants';
import { DEFAULT_LOCALE } from '@/i18n/constants';

const SCHEMA_BLOCK = (dailyBudgetUsd: number) => `{
  "mission": string,
  "kpis": [{"name": string, "target": number|string, "unit"?: string}],
  "dailyCapUsd": number,
  "approvals": string[],
  "agents": [{"role": "CEO"|"PM"|"Researcher"|"Outreach"|"Ops", "name": string, "systemPrompt": string, "permissions": string[]}],
  "initialTasks": [{"kind": string, "role": "CEO"|"PM"|"Researcher"|"Outreach"|"Ops", "input": object, "dependsOnIndex"?: number[]}]
}
Constraints: at least 3 agents (include PM + Researcher + Outreach), at least 5 initialTasks, dailyCapUsd = ${dailyBudgetUsd}, approvals must include "gmail" if any outreach happens.

Optional task kinds for content/marketing missions (cosmetics, social posts, SMM):
- "llm_market_research" on Researcher — real LLM JSON market overview; input e.g. {"vertical":"cosmetics"}.
- "llm_social_posts" on Outreach — real LLM JSON array of posts; input e.g. {"postCount":5,"platforms":"Instagram"}; use dependsOnIndex after llm_market_research when both are needed.`;

/** System message for blueprint JSON — user message is the mission in any language. */
export function blueprintSystemPrompt(dailyBudgetUsd: number, locale: Locale = DEFAULT_LOCALE): string {
  if (locale === 'ru') {
    return `Ты проектируешь компании из ИИ-агентов. Ответь ТОЛЬКО JSON по этой схеме (без markdown и пояснений). Поля и структура — как в схеме; тексты mission, KPI names, systemPrompt агентов и прочие человекочитаемые строки пиши на русском.
Если цель — анализ рынка (напр. косметика) и посты для соцсетей, включи задачи llm_market_research (Researcher) и llm_social_posts (Outreach) с dependsOnIndex, как в подсказке к схеме.
${SCHEMA_BLOCK(dailyBudgetUsd)}`;
  }
  return `You design AI agent companies. Reply ONLY with JSON matching this schema (no markdown, no commentary). Human-readable strings (mission, KPI names, agent systemPrompts, etc.) should be in English unless the user's mission is clearly in another language — then mirror that language.
If the mission is market analysis (e.g. cosmetics) plus social posts, include llm_market_research (Researcher) and llm_social_posts (Outreach) with dependsOnIndex as in the schema notes.
${SCHEMA_BLOCK(dailyBudgetUsd)}`;
}

/** Heuristic for mock blueprint + hint to HTTP LLM: cosmetics / SMM style goals. */
export function isContentStudioStyleMission(missionPrompt: string): boolean {
  const s = missionPrompt.toLowerCase();
  return /cosmetics|космет|beauty|смм|social\s*media|соц\s*сет|инста|instagram|\bпост|контент|content\s*studio|рилс|tiktok|youtube shorts?/i.test(
    s,
  );
}

export function mockDeterministicBlueprint(
  missionPrompt: string,
  dailyBudgetUsd: number,
  locale: Locale = DEFAULT_LOCALE,
): Blueprint {
  if (isContentStudioStyleMission(missionPrompt)) {
    const missionLine =
      locale === 'ru'
        ? `Контент-студия: анализ рынка и ${dailyBudgetUsd}$/день бюджет на закупки инструментов. Исходная цель: ${missionPrompt.slice(0, 400)}`
        : `Content studio: market scan + $${dailyBudgetUsd}/day tool budget. Original goal: ${missionPrompt.slice(0, 400)}`;
    const agents =
      locale === 'ru'
        ? [
            {
              role: 'PM' as const,
              name: 'PM-Content',
              systemPrompt:
                'Ты проджект контент-команды: согласуешь воронку «исследование → посты», следишь за KPI охватов и конверсий.',
              permissions: [] as string[],
            },
            {
              role: 'Researcher' as const,
              name: 'Researcher-Beauty',
              systemPrompt:
                'Ты аналитик beauty-рынка. Запускаешь llm_market_research (реальный LLM), структурируешь вывод для SMM.',
              permissions: ['web_search', 'sheets'],
            },
            {
              role: 'Outreach' as const,
              name: 'Outreach-SMM',
              systemPrompt:
                'Ты SMM: после обзора рынка генерируешь пакет постов через llm_social_posts (реальный LLM).',
              permissions: ['gmail', 'crm'],
            },
            {
              role: 'Ops' as const,
              name: 'Ops-Publish',
              systemPrompt: 'Ты операции: отчёты, календарь публикаций (мок-коннекторы), контроль ритма.',
              permissions: ['calendar', 'sheets', 'crm'],
            },
          ]
        : [
            {
              role: 'PM' as const,
              name: 'PM-Content',
              systemPrompt: 'You run the content squad: align research → posts, track reach/conversion KPIs.',
              permissions: [] as string[],
            },
            {
              role: 'Researcher' as const,
              name: 'Researcher-Beauty',
              systemPrompt:
                'You analyze the beauty market; run llm_market_research (real LLM) and structure output for SMM.',
              permissions: ['web_search', 'sheets'],
            },
            {
              role: 'Outreach' as const,
              name: 'Outreach-SMM',
              systemPrompt:
                'You own social copy; after market scan run llm_social_posts (real LLM) for the feed.',
              permissions: ['gmail', 'crm'],
            },
            {
              role: 'Ops' as const,
              name: 'Ops-Publish',
              systemPrompt: 'You handle reporting and publishing rhythm (mock connectors for now).',
              permissions: ['calendar', 'sheets', 'crm'],
            },
          ];
    const kpis =
      locale === 'ru'
        ? [
            { name: 'posts_per_batch', target: 5, unit: 'posts' },
            { name: 'market_briefs', target: 1, unit: 'doc' },
            { name: 'engagement_rate_target', target: 3, unit: 'pct' },
          ]
        : [
            { name: 'posts_per_batch', target: 5, unit: 'posts' },
            { name: 'market_briefs', target: 1, unit: 'doc' },
            { name: 'engagement_rate_target', target: 3, unit: 'pct' },
          ];
    return {
      mission: missionLine,
      kpis,
      dailyCapUsd: dailyBudgetUsd,
      approvals: [],
      agents,
      initialTasks: [
        { kind: 'llm_market_research', role: 'Researcher', input: { vertical: 'cosmetics' } },
        {
          kind: 'llm_social_posts',
          role: 'Outreach',
          input: { postCount: 5, platforms: 'Instagram, TikTok' },
          dependsOnIndex: [0],
        },
        { kind: 'brief_pm_ack', role: 'PM', input: { phase: 'after_social' }, dependsOnIndex: [1] },
        { kind: 'daily_report', role: 'Ops', input: {}, dependsOnIndex: [2] },
        { kind: 'schedule_followups', role: 'Ops', input: {}, dependsOnIndex: [3] },
      ],
    };
  }
  if (locale === 'ru') {
    return {
      mission:
        'Автономная B2B-компания по лидогенерации: поиск перспектив, обогащение данных, персонализированный аутрич и запись квалифицированных созвонов при строгом дневном бюджете и обязательном human approval для исходящих сообщений.',
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
            'Ты проджект-менеджер. Раскладываешь цели компании на задачи, балансируешь нагрузку между агентами и держишь фокус на KPI. Сам внешние инструменты не вызываешь.',
          permissions: [],
        },
        {
          role: 'Researcher',
          name: 'Researcher-Nova',
          systemPrompt:
            'Ты исследуешь B2B-перспективы (поиск, CRM). Выдаёшь структурированные списки лидов: компания, отрасль, размер, обоснование. Исходящие письма не пишешь.',
          permissions: ['web_search', 'crm', 'sheets'],
        },
        {
          role: 'Outreach',
          name: 'Outreach-Vega',
          systemPrompt:
            'Ты готовишь персонализированные черновики аутрича по обогащённым данным. Черновики писем всегда требуют одобрения человека перед отправкой.',
          permissions: ['gmail', 'crm'],
        },
        {
          role: 'Ops',
          name: 'Ops-Lyra',
          systemPrompt:
            'Ты ведёшь фоллоу-апы, планирование и ежедневные отчёты. Приглашения в календарь — только с human approval.',
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

export function buildRebuildUserPromptParts(
  missionAndPrior: string,
  feedback: string | undefined,
  excludedRoles: string[],
  locale: Locale = DEFAULT_LOCALE,
): string {
  const trimmed = feedback?.trim();
  let out = missionAndPrior;

  if (trimmed) {
    out +=
      locale === 'ru'
        ? `\n\nКомментарий клиента для пересборки:\n${trimmed}`
        : `\n\nRevision feedback from the client:\n${trimmed}`;
  }

  if (excludedRoles.length > 0) {
    const list = excludedRoles.join(', ');
    out +=
      locale === 'ru'
        ? `\n\nКлиент исключил эти роли из предыдущего предложения — не возвращай их, если миссию без них выполнить нельзя; тогда кратко обоснуй: ${list}.`
        : `\n\nThe client removed these roles from the previous proposal — omit them unless the mission cannot be fulfilled without one; then justify briefly: ${list}.`;
  }

  return out;
}

export function defaultHireSystemPrompt(role: AgentRole, locale: Locale = DEFAULT_LOCALE): string {
  if (locale === 'ru') {
    return `Вы агент роли ${role} в автономной компании.`;
  }
  return `You are a ${role} agent in an autonomous company.`;
}
