import type { RoleHandler } from '../runtime';
import { runLlmSocialPosts } from '../llmContentTasks';
import type { Locale } from '@/i18n/constants';
import { DEFAULT_LOCALE } from '@/i18n/constants';
import type { Company } from '@/factory/domain/types';

type Template = { subject: string; body: (lead: string) => string };

const TEMPLATES_EN: Record<string, Template> = {
  A: {
    subject: 'Quick idea for {{lead}}',
    body: (lead) =>
      `Hi ${lead} team,\n\nWe help concierge & PropTech teams automate inbound triage. Would a 15-min walkthrough be useful?\n\n— Atlas`,
  },
  B: {
    subject: 'Saw your AI ops note — quick thought for {{lead}}',
    body: (lead) =>
      `Hi ${lead},\n\nYour recent AI-ops update caught our eye. We have a small case study for similar teams — interested?\n\n— Atlas`,
  },
  C: {
    subject: '{{lead}} — pilot idea (no commitment)',
    body: (lead) =>
      `Hi ${lead},\n\nWe run 2-week pilots that prove ROI before any seat fee. Worth a 15-min chat?\n\n— Atlas`,
  },
};

const TEMPLATES_RU: Record<string, Template> = {
  A: {
    subject: 'Короткая идея для {{lead}}',
    body: (lead) =>
      `Здравствуйте, команда ${lead},\n\nПомогаем командам консьержа и PropTech автоматизировать разбор входящих обращений. Удобно ли созвон на 15 минут?\n\n— Atlas`,
  },
  B: {
    subject: 'Заметили материал про AI-ops — мысль для {{lead}}',
    body: (lead) =>
      `Здравствуйте, ${lead},\n\nВаш недавний материал про AI-ops привлёк внимание. Есть небольшой кейс для похожих команд — интересно обсудить?\n\n— Atlas`,
  },
  C: {
    subject: '{{lead}} — пилот без обязательств',
    body: (lead) =>
      `Здравствуйте, ${lead},\n\nДелаем двухнедельные пилоты с измеримым ROI до оплаты мест. Готовы к короткому созвону на 15 минут?\n\n— Atlas`,
  },
};

function outreachLocale(company: Company): Locale {
  return company.contentLocale ?? DEFAULT_LOCALE;
}

function templatesFor(locale: Locale): Record<string, Template> {
  return locale === 'ru' ? TEMPLATES_RU : TEMPLATES_EN;
}

export const outreachHandler: RoleHandler = async (ctx) => {
  const loc = outreachLocale(ctx.company);
  const TEMPLATES = templatesFor(loc);
  const taskKind = ctx.task.kind;
  const input = (ctx.task.input ?? {}) as Record<string, unknown>;

  if (taskKind === 'llm_social_posts') {
    const out = await runLlmSocialPosts({
      company: ctx.company,
      task: ctx.task,
      input,
      llmGenerate: (m) => ctx.llmGenerate(m),
      emit: ctx.emit,
    });
    return { output: out };
  }

  if (taskKind === 'draft_outreach') {
    const variant = String(input.variant ?? 'A').toUpperCase();
    const template = TEMPLATES[variant] ?? TEMPLATES.A!;
    const leadName = 'Atlas Concierge';
    ctx.emit(
      'draft',
      'started',
      loc === 'ru' ? `Черновик, вариант ${variant}` : `Drafting variant ${variant}`,
    );
    const draft = await ctx.call<{ to: string; subject: string; body: string }, { draftId: string }>(
      'gmail.draft',
      {
        to: 'cto@atlas.example',
        subject: template.subject.replace('{{lead}}', leadName),
        body: template.body(leadName),
      },
    );
    ctx.emit(
      'draft',
      'completed',
      loc === 'ru' ? `Черновик создан: ${draft.draftId}` : `Draft created: ${draft.draftId}`,
    );

    ctx.followUp({
      kind: `send_outreach_${variant}_${draft.draftId}`,
      agentRole: 'Outreach',
      input: {
        draftId: draft.draftId,
        variant,
        to: 'cto@atlas.example',
        subject: template.subject.replace('{{lead}}', leadName),
        body: template.body(leadName),
      },
    });
    return { output: { draftId: draft.draftId, variant } };
  }

  if (taskKind.startsWith('send_outreach_')) {
    const payload = (ctx.task.input ?? {}) as {
      draftId: string;
      to: string;
      subject: string;
      body: string;
    };
    const locSend = outreachLocale(ctx.company);
    ctx.emit(
      'send',
      'started',
      locSend === 'ru'
        ? `Ожидается одобрение отправки на ${payload.to}`
        : `Awaiting approval for send to ${payload.to}`,
    );
    await ctx.call<typeof payload, { messageId: string; sentTo: string }>('gmail.send', payload, {
      description:
        locSend === 'ru'
          ? `Отправить исходящее письмо на ${payload.to}`
          : `Send outbound email to ${payload.to}`,
    });
    ctx.emit(
      'send',
      'completed',
      locSend === 'ru' ? `Отправлено ${payload.draftId}` : `Sent ${payload.draftId}`,
    );
    return { output: { sent: true, to: payload.to } };
  }

  return { output: { kind: taskKind, note: 'outreach: no-op' } };
};
