import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/factory/store/db';
import { newId } from '@/factory/domain/ids';
import { appendAudit } from '@/factory/audit/audit';
import { HireAgentRequestSchema } from '@/factory/domain/schemas';
import { planSkills } from '@/factory/modules/skillsPlanner';
import type { Agent, EscalationRule } from '@/factory/domain/types';
import { internal, notFound } from '@/factory/api/errors';
import { agentAvatarSlug, buildAgentDisplayName } from '@/factory/modules/agentCodename';

const DEFAULT_ESCALATION: EscalationRule[] = [
  { trigger: 'budget_exceeded', action: 'pause_agent' },
  { trigger: 'max_attempts', action: 'notify_human' },
  { trigger: 'approval_rejected', action: 'cancel_task' },
];

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: companyId } = await params;
    const company = db().companies.get(companyId);
    if (!company) return notFound('company_not_found');
    const body = await request.json();
    const parsed = HireAgentRequestSchema.parse(body);
    const agentId = newId('agt');
    const agent: Agent = {
      id: agentId,
      companyId,
      role: parsed.role,
      name: parsed.name ?? `${parsed.role}-${newId('').slice(1, 6)}`,
      displayName: buildAgentDisplayName(parsed.role, agentId),
      avatarSlug: agentAvatarSlug(agentId),
      systemPrompt: parsed.customPrompt ?? `You are a ${parsed.role} agent in an autonomous company.`,
      permissions: [],
      escalationRules: DEFAULT_ESCALATION,
      status: 'idle',
      costToDateUsd: 0,
    };
    db().agents.create(agent);
    const planned = planSkills([agent], {
      mission: company.mission,
      kpis: company.kpis,
      dailyCapUsd: company.budget.dailyCapUsd,
      approvals: [],
      agents: [],
      initialTasks: [],
    })[0]!;
    appendAudit({
      companyId,
      kind: 'agent.hired',
      actor: 'human',
      payload: { agentId: planned.id, role: planned.role, name: planned.name },
    });
    return NextResponse.json({ agent: planned }, { status: 201 });
  } catch (error) {
    return internal(error);
  }
}
