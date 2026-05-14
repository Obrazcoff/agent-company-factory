import { db } from '../store/db';
import { newId, nowIso } from '../domain/ids';
import { appendAudit } from '../audit/audit';
import { createLlmClient, type LlmClient } from '@/llm/provider';
import { BlueprintSchema } from '../domain/schemas';
import { FACTORY_DEFAULTS } from '../config';
import type { Agent, AgentRole, Blueprint, Company, Task } from '../domain/types';
import { designTeam } from './teamDesigner';
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
 */
export async function intakeAndCreateCompany(
  req: IntakeRequest,
  prebuiltBlueprint?: Blueprint,
  existingCompanyId?: string,
  deps?: { llm?: LlmClient },
): Promise<IntakeResult> {
  const dailyBudget = req.dailyBudgetUsd ?? FACTORY_DEFAULTS.dailyBudgetUsd;
  let blueprint: Blueprint;
  let llmCostUsd = 0;

  if (prebuiltBlueprint) {
    blueprint = prebuiltBlueprint;
  } else {
    const llm = deps?.llm ?? createLlmClient();
    const blueprintCall = await llm.generateBlueprint(req.missionPrompt, dailyBudget);
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

  const agents = designTeam(company, blueprint);
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
