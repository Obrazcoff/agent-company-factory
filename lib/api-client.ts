import type { CompanyState } from '@/factory/modules/controlPlane';
import type { Blueprint, Company, Agent, Task, CompanyProposal } from '@/factory/domain/types';
import type { TickResult } from '@/factory/modules/orchestrator';

export class ApiHttpError extends Error {
  readonly status: number;
  readonly body: string;

  constructor(status: number, body: string) {
    const short = formatApiFailure(status, body);
    super(short);
    this.name = 'ApiHttpError';
    this.status = status;
    this.body = body;
  }
}

function formatApiFailure(status: number, body: string): string {
  const t = body.trim();
  try {
    const j = JSON.parse(t) as { error?: string; message?: string };
    if (typeof j.error === 'string') {
      const detail =
        typeof j.message === 'string' && j.message.trim() ? ` — ${j.message.trim()}` : '';
      return `${status}: ${j.error}${detail}`;
    }
    if (typeof j.message === 'string') return `${status}: ${j.message}`;
  } catch {
    /* not JSON */
  }
  if (t.length > 280) return `${status}: ${t.slice(0, 280)}…`;
  return t ? `${status}: ${t}` : `${status}`;
}

function projectHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const pid = localStorage.getItem('factory_project_id');
    if (pid) return { 'x-project-id': pid };
  } catch {
    /* private mode */
  }
  return {};
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...projectHeaders(),
      ...(init?.headers as Record<string, string> | undefined),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new ApiHttpError(res.status, text);
  }
  return (await res.json()) as T;
}

export type IntakeResponse = {
  company: Company;
  blueprint: Blueprint;
  agents: Agent[];
  initialTasks: Task[];
  /** Совпадает с GET /api/health — чтобы не подставлять company id от другого процесса сервера */
  serverBootId: string;
};

export type ProposalResponse = {
  proposal: CompanyProposal;
  llmCostUsd: number;
};

export const apiClient = {
  createCompany: (body: { missionPrompt: string; dailyBudgetUsd: number }) =>
    request<IntakeResponse>('/api/companies', { method: 'POST', body: JSON.stringify(body) }),
  draftProposal: (body: { missionPrompt: string; dailyBudgetUsd?: number }) =>
    request<ProposalResponse>('/api/proposals', { method: 'POST', body: JSON.stringify(body) }),
  acceptProposal: (id: string) =>
    request<IntakeResponse & { serverBootId: string }>(`/api/proposals/${id}/accept`, {
      method: 'POST',
    }),
  rebuildProposal: (id: string, feedback?: string) =>
    request<ProposalResponse>(`/api/proposals/${id}/rebuild`, {
      method: 'POST',
      body: JSON.stringify({ feedback }),
    }),
  excludeAgent: (proposalId: string, agentId: string, included: boolean) =>
    request<{ proposal: CompanyProposal }>(`/api/proposals/${proposalId}/agents/${agentId}`, {
      method: 'PATCH',
      body: JSON.stringify({ included }),
    }),
  getCompany: (id: string) => request<CompanyState>(`/api/companies/${id}`),
  tick: () => request<TickResult>('/api/orchestrator/tick', { method: 'POST' }),
  decideApproval: (id: string, decision: 'approved' | 'rejected') =>
    request<{ approval: unknown }>(`/api/approvals/${id}`, {
      method: 'POST',
      body: JSON.stringify({ decision, decidedBy: 'human' }),
    }),
  pauseAgent: (id: string, paused: boolean) =>
    request(`/api/agents/${id}/pause`, { method: 'POST', body: JSON.stringify({ paused }) }),
  pauseCompany: (id: string, paused: boolean) =>
    request(`/api/companies/${id}/pause`, { method: 'POST', body: JSON.stringify({ paused }) }),
  cancelTask: (id: string) => request(`/api/tasks/${id}/cancel`, { method: 'POST' }),
};
