/**
 * Proposal Review Module
 *
 * Manages the client-facing review stage before a company is materialized.
 * Flow: draftProposal → (excludeAgent*) → [acceptProposal | rebuildProposal] → intakeAndCreateCompany
 */
import { db } from '../store/db';
import { newId, nowIso } from '../domain/ids';
import { appendAudit } from '../audit/audit';
import { createLlmClient, type LlmClient } from '@/llm/provider';
import { buildRebuildUserPromptParts } from '@/llm/locale-prompts';
import type { Locale } from '@/i18n/constants';
import { DEFAULT_LOCALE } from '@/i18n/constants';
import { BlueprintSchema } from '../domain/schemas';
import { FACTORY_DEFAULTS } from '../config';
import { intakeAndCreateCompany } from './goalIntake';
import type { Blueprint, Company, CompanyProposal, ProposedAgent } from '../domain/types';
import type { IntakeResult } from './goalIntake';
import { assignAvatarSlugsUnique, buildAgentDisplayName } from './agentCodename';

function buildProposedAgents(blueprint: Blueprint, avatarSeed: string): ProposedAgent[] {
  const slugs = assignAvatarSlugsUnique(blueprint.agents.length, avatarSeed);
  return blueprint.agents.map((spec, i) => {
    const id = newId('pa');
    const avatarSlug = slugs[i]!;
    return {
      id,
      role: spec.role,
      name: spec.name,
      displayName: buildAgentDisplayName(spec.role, id, avatarSlug),
      avatarSlug,
      systemPrompt: spec.systemPrompt,
      permissions: spec.permissions,
      included: true,
    };
  });
}

export type DraftProposalRequest = {
  missionPrompt: string;
  dailyBudgetUsd?: number;
  tenantId?: string;
};

export type DraftProposalResult = {
  proposal: CompanyProposal;
  llmCostUsd: number;
};

export type RebuildRequest = {
  feedback?: string;
};

/** Create a blueprint + proposed agents WITHOUT persisting agents/tasks */
export async function draftProposal(
  req: DraftProposalRequest,
  deps?: { llm?: LlmClient; locale?: Locale },
): Promise<DraftProposalResult> {
  const dailyBudget = req.dailyBudgetUsd ?? FACTORY_DEFAULTS.dailyBudgetUsd;
  const llm = deps?.llm ?? createLlmClient();
  const locale = deps?.locale ?? DEFAULT_LOCALE;
  const blueprintCall = await llm.generateBlueprint(req.missionPrompt, dailyBudget, locale);
  const blueprint = BlueprintSchema.parse(blueprintCall.data);

  // Create company in proposal status (no agents or tasks created yet)
  const tempCompany: Company = {
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
    status: 'proposal',
    createdAt: nowIso(),
    contentLocale: locale,
  };
  db().companies.create(tempCompany);

  const avatarSeed = `${nowIso()}\x1e${newId('av')}\x1e${tempCompany.id}\x1e${blueprint.agents.map((a) => `${a.role}:${a.name}`).join('|')}`;
  const proposedAgents = buildProposedAgents(blueprint, avatarSeed);

  const proposal: CompanyProposal = {
    id: newId('prop'),
    companyId: tempCompany.id,
    missionPrompt: req.missionPrompt,
    blueprint,
    proposedAgents,
    status: 'reviewing',
    llmCostUsd: blueprintCall.costUsd,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  db().proposals.create(proposal);

  appendAudit({
    companyId: tempCompany.id,
    kind: 'company.created',
    actor: 'system',
    payload: {
      proposalId: proposal.id,
      mission: blueprint.mission,
      dailyCapUsd: blueprint.dailyCapUsd,
      agentCount: proposedAgents.length,
      status: 'proposal',
    },
  });

  return { proposal, llmCostUsd: blueprintCall.costUsd };
}

/** Toggle a proposed agent in/out of the proposal */
export function excludeAgent(proposalId: string, agentId: string, included: boolean): CompanyProposal {
  const proposal = db().proposals.get(proposalId);
  if (!proposal) throw new Error(`Proposal ${proposalId} not found`);
  if (proposal.status !== 'reviewing')
    throw new Error(`Proposal is not in reviewing state (current: ${proposal.status})`);

  const updatedAgents = proposal.proposedAgents.map((a: ProposedAgent) =>
    a.id === agentId ? { ...a, included } : a,
  );
  const updated: CompanyProposal = {
    ...proposal,
    proposedAgents: updatedAgents,
    updatedAt: nowIso(),
  };
  db().proposals.update(proposalId, () => updated);

  appendAudit({
    companyId: proposal.companyId,
    kind: 'action.executed',
    actor: 'human',
    payload: { action: 'agent.exclude_toggled', agentId, included, proposalId },
  });

  return updated;
}

/** Accept the proposal — materialize company+agents+tasks from included agents */
export async function acceptProposal(proposalId: string): Promise<IntakeResult> {
  const proposal = db().proposals.get(proposalId);
  if (!proposal) throw new Error(`Proposal ${proposalId} not found`);
  if (proposal.status !== 'reviewing')
    throw new Error(`Proposal is not in reviewing state (current: ${proposal.status})`);

  // Filter blueprint agents to only included ones before materializing
  const includedRoles = new Set(
    proposal.proposedAgents.filter((a: ProposedAgent) => a.included).map((a: ProposedAgent) => a.role),
  );
  const filteredBlueprint: Blueprint = {
    ...proposal.blueprint,
    agents: proposal.blueprint.agents.filter((a) => includedRoles.has(a.role)),
    initialTasks: proposal.blueprint.initialTasks.filter((t) => includedRoles.has(t.role)),
  };

  // Mark company as active
  const company = db().companies.get(proposal.companyId);
  if (!company) throw new Error(`Company ${proposal.companyId} not found`);
  db().companies.update(company.id, (cur) => ({ ...cur, status: 'active' }));

  // Mark proposal accepted
  db().proposals.update(proposalId, (cur) => ({ ...cur, status: 'accepted', updatedAt: nowIso() }));

  // Re-run intake but skip the LLM call — pass the filtered blueprint directly
  const result = await intakeAndCreateCompany(
    {
      missionPrompt: proposal.missionPrompt,
      dailyBudgetUsd: filteredBlueprint.dailyCapUsd,
      tenantId: company.tenantId,
    },
    filteredBlueprint,
    company.id,
    {},
  );

  appendAudit({
    companyId: proposal.companyId,
    kind: 'action.executed',
    actor: 'human',
    payload: {
      action: 'proposal.accepted',
      proposalId,
      agentsIncluded: includedRoles.size,
      tasksCreated: result.initialTasks.length,
    },
  });

  return result;
}

/** Rebuild the proposal with optional feedback */
export async function rebuildProposal(
  proposalId: string,
  req: RebuildRequest,
  deps?: { llm?: LlmClient; locale?: Locale },
): Promise<DraftProposalResult> {
  const proposal = db().proposals.get(proposalId);
  if (!proposal) throw new Error(`Proposal ${proposalId} not found`);
  if (proposal.status !== 'reviewing')
    throw new Error(`Proposal is not in reviewing state (current: ${proposal.status})`);

  // Mark old proposal as rebuilding
  db().proposals.update(proposalId, (cur) => ({ ...cur, status: 'rebuilding', updatedAt: nowIso() }));

  const company = db().companies.get(proposal.companyId);
  if (!company) throw new Error(`Company ${proposal.companyId} not found`);

  const excludedRoles = proposal.proposedAgents
    .filter((a) => !a.included)
    .map((a) => a.role)
    .filter((r, i, arr) => arr.indexOf(r) === i);
  const locale = deps?.locale ?? DEFAULT_LOCALE;
  const prompt = buildRebuildUserPromptParts(proposal.missionPrompt, req.feedback, excludedRoles, locale);

  // Create a new proposal on the same company
  const newDraft = await draftProposalForCompany(company, prompt, proposal.blueprint.dailyCapUsd, deps);

  appendAudit({
    companyId: proposal.companyId,
    kind: 'action.executed',
    actor: 'human',
    payload: {
      action: 'proposal.rebuilt',
      oldProposalId: proposalId,
      newProposalId: newDraft.proposal.id,
      hasFeedback: Boolean(req.feedback),
    },
  });

  return newDraft;
}

/** Internal: draft a new proposal for an existing company (used by rebuild) */
async function draftProposalForCompany(
  company: Company,
  prompt: string,
  dailyBudget: number,
  deps?: { llm?: LlmClient; locale?: Locale },
): Promise<DraftProposalResult> {
  const llm = deps?.llm ?? createLlmClient();
  const locale = deps?.locale ?? DEFAULT_LOCALE;
  const blueprintCall = await llm.generateBlueprint(prompt, dailyBudget, locale);
  const blueprint = BlueprintSchema.parse(blueprintCall.data);

  const avatarSeed = `${nowIso()}\x1e${newId('av')}\x1e${company.id}\x1e${blueprint.agents.map((a) => `${a.role}:${a.name}`).join('|')}`;
  const proposedAgents = buildProposedAgents(blueprint, avatarSeed);

  const proposal: CompanyProposal = {
    id: newId('prop'),
    companyId: company.id,
    missionPrompt: prompt,
    blueprint,
    proposedAgents,
    status: 'reviewing',
    llmCostUsd: blueprintCall.costUsd,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  db().proposals.create(proposal);

  return { proposal, llmCostUsd: blueprintCall.costUsd };
}

export function getProposal(proposalId: string): CompanyProposal | undefined {
  return db().proposals.get(proposalId);
}

export function listProposalsByCompany(companyId: string): CompanyProposal[] {
  return db().proposals.all({ companyId });
}
