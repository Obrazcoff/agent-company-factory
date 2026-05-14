import { db } from '../store/db';
import { listAudits } from '../audit/audit';
import type { Agent, Approval, AuditEvent, Company, CompanyId, Run, Task } from '../domain/types';

export type CompanyState = {
  company: Company;
  agents: Agent[];
  tasks: Task[];
  runs: Run[];
  approvals: Approval[];
  audits: AuditEvent[];
  costByAgent: Array<{ agentId: string; name: string; role: string; costUsd: number }>;
  pendingApprovals: Approval[];
  stats: {
    queued: number;
    running: number;
    awaitingApproval: number;
    done: number;
    failed: number;
    cancelled: number;
  };
};

export function getCompanyState(companyId: CompanyId): CompanyState | null {
  const company = db().companies.get(companyId);
  if (!company) return null;
  const agents = db().agents.all({ companyId });
  const tasks = db()
    .tasks.all({ companyId })
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const runs = db()
    .runs.all({ companyId })
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  const approvals = db()
    .approvals.all({ companyId })
    .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
  const audits = listAudits(companyId);
  const costByAgent = agents.map((a) => ({
    agentId: a.id,
    name: a.displayName ?? a.name,
    role: a.role,
    costUsd: a.costToDateUsd,
  }));
  const stats = {
    queued: tasks.filter((t) => t.status === 'queued').length,
    running: tasks.filter((t) => t.status === 'running').length,
    awaitingApproval: tasks.filter((t) => t.status === 'awaiting_approval').length,
    done: tasks.filter((t) => t.status === 'done').length,
    failed: tasks.filter((t) => t.status === 'failed').length,
    cancelled: tasks.filter((t) => t.status === 'cancelled').length,
  };
  return {
    company,
    agents,
    tasks,
    runs,
    approvals,
    audits,
    costByAgent,
    pendingApprovals: approvals.filter((a) => a.status === 'pending'),
    stats,
  };
}

export function listCompanies(): Company[] {
  return db()
    .companies.all()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
