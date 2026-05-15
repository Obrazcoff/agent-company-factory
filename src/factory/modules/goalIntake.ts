import { db } from '../store/db';
import { newId, nowIso } from '../domain/ids';
import { appendAudit } from '../audit/audit';
import { createLlmClient, type LlmClient } from '@/llm/provider';
import type { Locale } from '@/i18n/constants';
import { DEFAULT_LOCALE } from '@/i18n/constants';
import { BlueprintSchema } from '../domain/schemas';
import { FACTORY_DEFAULTS } from '../config';
import type { Agent, AgentRole, Blueprint, Company, ProposedAgent, Task } from '../domain/types';
import { designTeam, materializeAgentsFromProposed } from './teamDesigner';
import { planSkills } from './skillsPlanner';
import { enqueueTask } from './enqueue';

export type IntakeRequest = {
  missionPrompt: string;
  dailyBudgetUsd?: number;
  tenantId?: string;
};

export type SkippedTask = {
  index: number;
  role: AgentRole;
  kind: string;
  reason: string;
};

export type IntakeResult = {
  company: Company;
  blueprint: Blueprint;
  agents: Agent[];
  initialTasks: Task[];
  skippedTasks: SkippedTask[];
  llmCostUsd: number;
  /** true when at least one initialTask was skipped */
  partial: boolean;
};

/**
 * @param req - intake request
 * @param prebuiltBlueprint - skip LLM call, use this blueprint (used when accepting a proposal)
 * @param existingCompanyId - reuse an existing company entity (used when accepting a proposal)
 * @param deps.proposedAgents - when accepting a proposal: same order as blueprint.agents, reuses review UI names
 */
export async function intakeAndCreateCompany(
  req: IntakeRequest,
  prebuiltBlueprint?: Blueprint,
  existingCompanyId?: string,
  deps?: { llm?: LlmClient; locale?: Locale; proposedAgents?: ProposedAgent[] },
): Promise<IntakeResult> {
  const dailyBudget = req.dailyBudgetUsd ?? FACTORY_DEFAULTS.dailyBudgetUsd;
  let blueprint: Blueprint;
  let llmCostUsd = 0;

  if (prebuiltBlueprint) {
    blueprint = prebuiltBlueprint;
  } else {
    const llm = deps?.llm ?? createLlmClient();
    const locale = deps?.locale ?? DEFAULT_LOCALE;
    const blueprintCall = await llm.generateBlueprint(req.missionPrompt, dailyBudget, locale);
    blueprint = BlueprintSchema.parse(blueprintCall.data);
    llmCostUsd = blueprintCall.costUsd;
  }

  let company: Company;
  if (existingCompanyId) {
    const existing = db().companies.get(existingCompanyId);
    if (!existing) throw new Error(`Company ${existingCompanyId} not found`);
    company = existing;
  } else {
    company = {
      id: newId('co'),
      tenantId: req.tenantId ?? FACTORY_DEFAULTS.tenantId,
      missionPrompt: req.missionPrompt,
      mission: blueprint.mission,
      kpis: blueprint.kpis,
      budget: {
        dailyCapUsd: blueprint.dailyCapUsd,
        hardCapUsd: blueprint.dailyCapUsd * FACTORY_DEFAULTS.hardCapMultiplier,
        spentTodayUsd: 0,
        lastResetAt: nowIso(),
      },
      status: 'active',
      createdAt: nowIso(),
      contentLocale: deps?.locale,
    };
    db().companies.create(company);
  }
  appendAudit({
    companyId: company.id,
    kind: 'company.created',
    actor: 'system',
    payload: {
      mission: blueprint.mission,
      dailyCapUsd: blueprint.dailyCapUsd,
      kpiCount: blueprint.kpis.length,
    },
  });

  const proposed = deps?.proposedAgents;
  if (prebuiltBlueprint && proposed !== undefined && proposed.length !== blueprint.agents.length) {
    throw new Error(
      `proposedAgents length (${proposed.length}) does not match blueprint.agents (${blueprint.agents.length})`,
    );
  }
  const useProposed =
    Boolean(prebuiltBlueprint) && proposed !== undefined && proposed.length === blueprint.agents.length;
  if (useProposed) {
    for (let i = 0; i < proposed!.length; i += 1) {
      if (proposed![i]!.role !== blueprint.agents[i]!.role) {
        throw new Error(
          `proposedAgents[${i}].role (${proposed![i]!.role}) !== blueprint.agents[${i}].role (${blueprint.agents[i]!.role})`,
        );
      }
    }
  }
  const agents = useProposed
    ? materializeAgentsFromProposed(company, proposed!)
    : designTeam(company, blueprint);
  const planned = planSkills(agents, blueprint);

  const agentByRole = new Map<AgentRole, Agent>();
  for (const a of planned) agentByRole.set(a.role, a);

  const indexToTaskId = new Map<number, string>();
  const initialTasks: Task[] = [];
  const skippedTasks: SkippedTask[] = [];

  blueprint.initialTasks.forEach((bt, idx) => {
    const target = agentByRole.get(bt.role);
    if (!target) {
      const skipped: SkippedTask = {
        index: idx,
        role: bt.role,
        kind: bt.kind,
        reason: `No agent found for role "${bt.role}" in the designed team`,
      };
      skippedTasks.push(skipped);
      appendAudit({
        companyId: company.id,
        kind: 'task.skipped',
        actor: 'system',
        payload: skipped,
      });
      return;
    }
    const dependsOn = (bt.dependsOnIndex ?? [])
      .map((i) => indexToTaskId.get(i))
      .filter((x): x is string => Boolean(x));
    const result = enqueueTask({
      companyId: company.id,
      agentId: target.id,
      kind: bt.kind,
      input: bt.input,
      dependsOn,
      depth: 0,
    });
    if (result.ok) {
      indexToTaskId.set(idx, result.task.id);
      initialTasks.push(result.task);
    } else {
      const skipped: SkippedTask = {
        index: idx,
        role: bt.role,
        kind: bt.kind,
        reason: result.reason,
      };
      skippedTasks.push(skipped);
      appendAudit({
        companyId: company.id,
        kind: 'task.skipped',
        actor: 'system',
        payload: skipped,
      });
    }
  });

  return {
    company,
    blueprint,
    agents: planned,
    initialTasks,
    skippedTasks,
    partial: skippedTasks.length > 0,
    llmCostUsd,
  };
}
