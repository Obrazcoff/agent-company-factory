import type { RoleHandler } from '../runtime';

const TEMPLATES: Record<string, { subject: string; body: (lead: string) => string }> = {
  A: {
    subject: 'Quick idea for {{lead}}',
    body: (lead) =>
      `Hi ${lead} team,\n\nWe help concierge & PropTech teams automate inbound triage. Would a 15-min walkthrough be useful?\n\n— Atlas`,
  },
  B: {
    subject: 'Saw your AI ops note — quick thought for {{lead}}',
    body: (lead) =>
      `Hi ${lead},\n\nYour recent AI-ops update caught my eye. We have a small case study for similar teams — interested?\n\n— Atlas`,
  },
  C: {
    subject: '{{lead}} — pilot idea (no commitment)',
    body: (lead) =>
      `Hi ${lead},\n\nWe run 2-week pilots that prove ROI before any seat fee. Worth a 15-min chat?\n\n— Atlas`,
  },
};

export const outreachHandler: RoleHandler = async (ctx) => {
  const taskKind = ctx.task.kind;
  const input = (ctx.task.input ?? {}) as Record<string, unknown>;

  if (taskKind === 'draft_outreach') {
    const variant = String(input.variant ?? 'A').toUpperCase();
    const template = TEMPLATES[variant] ?? TEMPLATES.A!;
    const leadName = `Atlas Concierge`;
    ctx.emit('draft', 'started', `Drafting variant ${variant}`);
    const draft = await ctx.call<{ to: string; subject: string; body: string }, { draftId: string }>(
      'gmail.draft',
      {
        to: 'cto@atlas.example',
        subject: template.subject.replace('{{lead}}', leadName),
        body: template.body(leadName),
      },
    );
    ctx.emit('draft', 'completed', `Draft created: ${draft.draftId}`);

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
    ctx.emit('send', 'started', `Awaiting approval for send to ${payload.to}`);
    await ctx.call<typeof payload, { messageId: string; sentTo: string }>('gmail.send', payload, {
      description: `Send outbound email to ${payload.to}`,
    });
    ctx.emit('send', 'completed', `Sent ${payload.draftId}`);
    return { output: { sent: true, to: payload.to } };
  }

  return { output: { kind: taskKind, note: 'outreach: no-op' } };
};
