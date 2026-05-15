import type { CompanyState } from '@/factory/modules/controlPlane';
import type { Blueprint, Company, Agent, Task, CompanyProposal } from '@/factory/domain/types';
import type { TickResult } from '@/factory/modules/orchestrator';
import type { LlmBlueprintProgressEvent } from '@/llm/llm-progress';

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
    const j = JSON.parse(t) as {
      error?: string;
      message?: string;
      issues?: Array<{ path?: unknown; message?: string }>;
    };
    if (typeof j.error === 'string') {
      let detail =
        typeof j.message === 'string' && j.message.trim() ? ` — ${j.message.trim()}` : '';
      if (j.error === 'validation_failed' && Array.isArray(j.issues) && j.issues.length > 0) {
        const bits = j.issues
          .slice(0, 5)
          .map((i) => `${JSON.stringify(i.path ?? [])}: ${i.message ?? 'invalid'}`);
        detail = `${detail ? `${detail}; ` : ' — '}${bits.join('; ')}`;
      }
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

async function readProposalNdjsonStream(
  res: Response,
  onProgress?: (e: LlmBlueprintProgressEvent) => void,
): Promise<ProposalResponse> {
  if (!res.ok) {
    const text = await res.text();
    throw new ApiHttpError(res.status, text);
  }
  const reader = res.body?.getReader();
  if (!reader) {
    return (await res.json()) as ProposalResponse;
  }
  const dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      const row = JSON.parse(line) as {
        type: string;
        event?: LlmBlueprintProgressEvent;
        proposal?: CompanyProposal;
        llmCostUsd?: number;
        status?: number;
        message?: string;
        error?: string;
        issues?: unknown;
      };
      if (row.type === 'progress' && row.event) onProgress?.(row.event);
      if (row.type === 'done' && row.proposal != null && row.llmCostUsd != null) {
        return { proposal: row.proposal, llmCostUsd: row.llmCostUsd };
      }
      if (row.type === 'error') {
        const status = row.status ?? 500;
        const body =
          row.issues !== undefined
            ? JSON.stringify({ error: row.error ?? 'validation_failed', issues: row.issues })
            : JSON.stringify({ error: 'internal_error', message: row.message ?? 'error' });
        throw new ApiHttpError(status, body);
      }
    }
  }
  throw new Error('Proposal stream ended without result');
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
  draftProposal: async (
    body: { missionPrompt: string; dailyBudgetUsd?: number },
    onProgress?: (e: LlmBlueprintProgressEvent) => void,
  ) => {
    const res = await fetch('/api/proposals', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/x-ndjson',
        ...projectHeaders(),
      },
      body: JSON.stringify(body),
    });
    return readProposalNdjsonStream(res, onProgress);
  },
  acceptProposal: (id: string) =>
    request<IntakeResponse & { serverBootId: string }>(`/api/proposals/${id}/accept`, {
      method: 'POST',
    }),
  rebuildProposal: async (
    id: string,
    feedback?: string,
    onProgress?: (e: LlmBlueprintProgressEvent) => void,
  ) => {
    const res = await fetch(`/api/proposals/${id}/rebuild`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/x-ndjson',
        ...projectHeaders(),
      },
      body: JSON.stringify({ feedback }),
    });
    return readProposalNdjsonStream(res, onProgress);
  },
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
