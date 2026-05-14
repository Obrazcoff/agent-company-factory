import { POST as createCompany, GET as listCompanies } from '@/../app/api/companies/route';
import { GET as getCompany } from '@/../app/api/companies/[id]/route';
import { POST as hireAgent } from '@/../app/api/companies/[id]/agents/route';
import { POST as pauseCompanyRoute } from '@/../app/api/companies/[id]/pause/route';
import { POST as enqueueTaskRoute } from '@/../app/api/tasks/route';
import { POST as cancelTaskRoute } from '@/../app/api/tasks/[id]/cancel/route';
import { POST as decideApprovalRoute } from '@/../app/api/approvals/[id]/route';
import { POST as pauseAgentRoute } from '@/../app/api/agents/[id]/pause/route';
import { POST as tickRoute } from '@/../app/api/orchestrator/tick/route';
import { NextRequest } from 'next/server';

function req(url: string, body?: unknown): NextRequest {
  return new NextRequest(`http://localhost${url}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : null,
  });
}

function getReq(url: string): NextRequest {
  return new NextRequest(`http://localhost${url}`, { method: 'GET' });
}

async function readJson<T = unknown>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

export const api = {
  async createCompany(body: { missionPrompt: string; dailyBudgetUsd?: number }) {
    const res = await createCompany(req('/api/companies', body));
    return { status: res.status, data: await readJson(res) };
  },
  async listCompanies() {
    const res = await listCompanies();
    return { status: res.status, data: await readJson(res) };
  },
  async getCompany(id: string) {
    const res = await getCompany(getReq(`/api/companies/${id}`), { params: Promise.resolve({ id }) });
    return { status: res.status, data: await readJson(res) };
  },
  async hireAgent(id: string, body: { role: string; name?: string; customPrompt?: string }) {
    const res = await hireAgent(req(`/api/companies/${id}/agents`, body), {
      params: Promise.resolve({ id }),
    });
    return { status: res.status, data: await readJson(res) };
  },
  async pauseCompany(id: string, paused: boolean) {
    const res = await pauseCompanyRoute(req(`/api/companies/${id}/pause`, { paused }), {
      params: Promise.resolve({ id }),
    });
    return { status: res.status, data: await readJson(res) };
  },
  async enqueueTask(body: {
    companyId: string;
    agentId: string;
    kind: string;
    input?: unknown;
    dependsOn?: string[];
  }) {
    const res = await enqueueTaskRoute(req('/api/tasks', body));
    return { status: res.status, data: await readJson(res) };
  },
  async cancelTask(id: string) {
    const res = await cancelTaskRoute(req(`/api/tasks/${id}/cancel`), { params: Promise.resolve({ id }) });
    return { status: res.status, data: await readJson(res) };
  },
  async decideApproval(id: string, body: { decision: 'approved' | 'rejected'; reason?: string }) {
    const res = await decideApprovalRoute(req(`/api/approvals/${id}`, body), {
      params: Promise.resolve({ id }),
    });
    return { status: res.status, data: await readJson(res) };
  },
  async pauseAgent(id: string, paused: boolean) {
    const res = await pauseAgentRoute(req(`/api/agents/${id}/pause`, { paused }), {
      params: Promise.resolve({ id }),
    });
    return { status: res.status, data: await readJson(res) };
  },
  async tick() {
    const res = await tickRoute();
    return { status: res.status, data: await readJson(res) };
  },
};
