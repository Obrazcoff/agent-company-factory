import { resetDb, db } from '@/factory/store/db';
import { resetBus } from '@/factory/events/bus';
import { intakeAndCreateCompany } from '@/factory/modules/goalIntake';
import type { Agent, AgentRole, Company } from '@/factory/domain/types';
import type { Locale } from '@/i18n/constants';

export const DEMO_PROMPT =
  'Launch an autonomous B2B lead generation company for an AI-concierge service. Find target companies, enrich them, draft personalized outreach, and book qualified discovery calls. Daily budget $50. All outbound emails require human approval before being sent.';

export function resetState(): void {
  resetDb();
  resetBus();
}

export async function createDemoCompany(opts?: { dailyBudgetUsd?: number; locale?: Locale }) {
  resetState();
  const result = await intakeAndCreateCompany(
    {
      missionPrompt: DEMO_PROMPT,
      dailyBudgetUsd: opts?.dailyBudgetUsd ?? 50,
    },
    undefined,
    undefined,
    opts?.locale ? { locale: opts.locale } : undefined,
  );
  return result;
}

export function getAgentByRole(companyId: string, role: AgentRole): Agent {
  const found = db().agents.find((a) => a.companyId === companyId && a.role === role)[0];
  if (!found) throw new Error(`no agent for role ${role}`);
  return found;
}

export function getCompany(companyId: string): Company {
  return db().companies.require(companyId);
}
