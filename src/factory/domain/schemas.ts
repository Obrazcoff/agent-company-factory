import { z } from 'zod';

export const AgentRoleSchema = z.enum(['CEO', 'PM', 'Researcher', 'Outreach', 'Ops']);

export const KPISchema = z.object({
  name: z.string().min(1),
  target: z.union([z.number(), z.string()]),
  unit: z.string().optional(),
});

export const BlueprintAgentSchema = z.object({
  role: AgentRoleSchema,
  name: z.string().min(1),
  systemPrompt: z.string().min(1),
  permissions: z.array(z.string()),
});

export const BlueprintTaskSchema = z.object({
  kind: z.string().min(1),
  role: AgentRoleSchema,
  input: z.record(z.string(), z.unknown()),
  dependsOnIndex: z.array(z.number().int().nonnegative()).optional(),
});

export const BlueprintSchema = z.object({
  mission: z.string().min(1),
  kpis: z.array(KPISchema).min(1),
  dailyCapUsd: z.number().positive(),
  approvals: z.array(z.string()),
  agents: z.array(BlueprintAgentSchema).min(3),
  initialTasks: z.array(BlueprintTaskSchema).min(5),
});

export type BlueprintInput = z.infer<typeof BlueprintSchema>;

export const CreateCompanyRequestSchema = z.object({
  missionPrompt: z.string().min(10),
  dailyBudgetUsd: z.number().positive().optional(),
});

export const HireAgentRequestSchema = z.object({
  role: AgentRoleSchema,
  name: z.string().optional(),
  customPrompt: z.string().optional(),
});

export const EnqueueTaskRequestSchema = z.object({
  companyId: z.string(),
  agentId: z.string(),
  kind: z.string().min(1),
  input: z.unknown().optional(),
  dependsOn: z.array(z.string()).optional(),
});

export const DecideApprovalRequestSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  reason: z.string().optional(),
  decidedBy: z.string().optional(),
});

export const PauseRequestSchema = z.object({
  paused: z.boolean(),
});
