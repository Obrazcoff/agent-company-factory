import type { RoleHandler } from '../runtime';

type Lead = {
  name: string;
  domain: string;
  industry: string;
  size: string;
  rationale: string;
};

export const researcherHandler: RoleHandler = async (ctx) => {
  const taskKind = ctx.task.kind;
  const input = (ctx.task.input ?? {}) as Record<string, unknown>;

  if (taskKind === 'research_companies') {
    ctx.emit('research', 'started', 'Searching prospects via web_search');
    const search = await ctx.call<{ count: number }, { leads: Lead[] }>('web_search', {
      count: Number(input.count ?? 10),
    });
    ctx.emit('crm.upsert', 'started', `Upserting ${search.leads.length} leads`);
    await ctx.call<{ leads: Lead[] }, { upserted: number }>('crm', { leads: search.leads });
    await ctx.call<{ sheet: string; rows: Lead[] }, { written: number }>('sheets', {
      sheet: 'leads',
      rows: search.leads,
    });
    ctx.emit('research', 'completed', `Found ${search.leads.length} leads`);
    return { output: { leads: search.leads } };
  }

  if (taskKind === 'enrich_leads') {
    ctx.emit('enrich', 'started', 'Lightweight enrichment via crm');
    await ctx.call<{ leads: Lead[] }, { upserted: number }>('crm', {
      leads: [
        {
          name: 'Atlas Concierge',
          domain: 'atlas.example',
          industry: 'Concierge',
          size: '5-20',
          rationale: 'enriched_placeholder',
        },
      ],
    });
    ctx.emit('enrich', 'completed', 'Enrichment done');
    return { output: { enriched: true } };
  }

  return { output: { kind: taskKind, note: 'researcher: no-op for unknown kind' } };
};
