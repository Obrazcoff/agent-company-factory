'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import useSWR from 'swr';
import { apiClient } from '@/../lib/api-client';
import { Button } from '@/../components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/../components/ui/card';
import { Badge } from '@/../components/ui/badge';
import { Input, Textarea } from '@/../components/ui/inputs';
import { Tabs, TabPanel, type Tab } from '@/../components/ui/tabs';
import { BlueprintCard } from '@/../components/control-plane/BlueprintCard';
import { OrgChart } from '@/../components/control-plane/OrgChart';
import { TaskTable } from '@/../components/control-plane/TaskTable';
import { ApprovalsList } from '@/../components/control-plane/ApprovalsList';
import { AuditTimeline } from '@/../components/control-plane/AuditTimeline';
import { CostPanel } from '@/../components/control-plane/CostPanel';
import { ProposalReview } from '@/../components/ProposalReview';
import type { CompanyState } from '@/factory/modules/controlPlane';
import type { CompanyProposal } from '@/factory/domain/types';

const DEFAULT_PROMPT =
  'Launch an autonomous B2B lead generation company for an AI-concierge service. Find target companies, enrich them, draft personalized outreach, and book qualified discovery calls. Daily budget $50. All outbound emails require human approval before being sent.';

/** Последний company id + эпоха RAM-хранилища (см. `getStorageEpoch` / GET /api/health). */
const SESSION_COMPANY_ID = 'agent-factory:company-id';
/** Вместе с company id — эпоха in-memory DB (`getStorageEpoch` в `db.ts`), а не отдельный UUID. */
const SESSION_SERVER_BOOT_ID = 'agent-factory:server-boot-id';

export function FactoryHome() {
  const { status: authStatus } = useSession();
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [budget, setBudget] = useState(50);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [proposal, setProposal] = useState<CompanyProposal | null>(null);
  const [drafting, setDrafting] = useState(false);

  useEffect(() => {
    if (authStatus !== 'authenticated') return;
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/api/me');
        if (!r.ok || cancelled) return;
        const j = (await r.json()) as { defaultProjectId?: string | null };
        if (j.defaultProjectId) {
          try {
            localStorage.setItem('factory_project_id', j.defaultProjectId);
          } catch {
            /* ignore */
          }
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authStatus]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let serverBootId = '';
      try {
        const r = await fetch('/api/health');
        if (!r.ok) return;
        const j = (await r.json()) as { serverBootId?: string };
        serverBootId = j.serverBootId ?? '';
      } catch {
        return;
      }
      if (cancelled || !serverBootId) return;
      try {
        const storedBoot = sessionStorage.getItem(SESSION_SERVER_BOOT_ID);
        const storedCo = sessionStorage.getItem(SESSION_COMPANY_ID);
        if (storedCo && storedBoot === serverBootId) {
          const gv = await fetch(`/api/companies/${storedCo}`);
          if (cancelled) return;
          if (gv.ok) {
            setCompanyId(storedCo);
          } else {
            sessionStorage.removeItem(SESSION_COMPANY_ID);
            sessionStorage.removeItem(SESSION_SERVER_BOOT_ID);
          }
        } else if (storedCo && storedBoot !== serverBootId) {
          sessionStorage.removeItem(SESSION_COMPANY_ID);
          sessionStorage.removeItem(SESSION_SERVER_BOOT_ID);
        }
      } catch {
        /* private mode */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  const [creating, setCreating] = useState(false);
  const [ticking, setTicking] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [pollPaused, setPollPaused] = useState(false);

  const {
    data,
    mutate,
    isLoading,
    error: swrError,
  } = useSWR<CompanyState>(
    companyId ? `/api/companies/${companyId}` : null,
    async (url: string) => {
      const r = await fetch(url);
      if (!r.ok) {
        const body = await r.text();
        throw new Error(`${r.status}: ${body}`);
      }
      return (await r.json()) as CompanyState;
    },
    {
      refreshInterval: pollPaused ? 0 : 2000,
      shouldRetryOnError: false,
      // onError is an event handler — setState is allowed here
      onError: (err: Error) => {
        setPollPaused(true);
        if (!err.message.startsWith('404')) return;
        setCompanyId(null);
        try {
          sessionStorage.removeItem(SESSION_COMPANY_ID);
          sessionStorage.removeItem(SESSION_SERVER_BOOT_ID);
        } catch {
          /* ignore */
        }
      },
    },
  );

  async function handleDraftProposal() {
    setDrafting(true);
    setError(null);
    try {
      const result = await apiClient.draftProposal({ missionPrompt: prompt, dailyBudgetUsd: budget });
      setProposal(result.proposal);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setDrafting(false);
    }
  }

  function handleProposalAccepted(acceptedCompanyId: string, serverBootId: string) {
    setProposal(null);
    setPollPaused(false);
    setCompanyId(acceptedCompanyId);
    try {
      sessionStorage.setItem(SESSION_COMPANY_ID, acceptedCompanyId);
      sessionStorage.setItem(SESSION_SERVER_BOOT_ID, serverBootId);
    } catch {
      /* ignore */
    }
    setActiveTab('overview');
  }

  async function handleCreate() {
    setCreating(true);
    setError(null);
    setPollPaused(false);
    try {
      const created = await apiClient.createCompany({ missionPrompt: prompt, dailyBudgetUsd: budget });
      setActionError(null);
      setCompanyId(created.company.id);
      try {
        sessionStorage.setItem(SESSION_COMPANY_ID, created.company.id);
        sessionStorage.setItem(SESSION_SERVER_BOOT_ID, created.serverBootId);
      } catch {
        /* ignore */
      }
      setActiveTab('overview');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCreating(false);
    }
  }

  async function handleTick() {
    setActionError(null);
    setTicking(true);
    try {
      await apiClient.tick();
      await mutate();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setTicking(false);
    }
  }

  const MAX_IDLE_TICKS = 50;

  async function handleRunUntilIdle() {
    setActionError(null);
    setTicking(true);
    try {
      for (let i = 0; i < MAX_IDLE_TICKS; i++) {
        const t = await apiClient.tick();
        await mutate();
        if (t.executed === 0) break;
      }
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setTicking(false);
    }
  }

  const queuedRunning = (data?.stats?.queued ?? 0) + (data?.stats?.running ?? 0);
  const tabs: Tab[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'tasks', label: 'Tasks', badge: queuedRunning > 0 ? queuedRunning : undefined },
    { id: 'approvals', label: 'Approvals', badge: data?.pendingApprovals?.length ?? 0 },
    { id: 'audit', label: 'Audit' },
  ];

  return (
    <main className="max-w-7xl mx-auto p-6 space-y-6">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold">Agent Company Factory</h1>
          <p className="text-xs text-[var(--color-muted)]">
            Architectural MVP — control plane for autonomous agent companies
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <nav className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1 text-xs text-[var(--color-muted)]">
            {authStatus === 'authenticated' ? (
              <>
                <Link href="/settings/llm" className="underline hover:text-gray-800">
                  LLM / project
                </Link>
                <button
                  type="button"
                  className="underline hover:text-gray-800"
                  onClick={() => void signOut()}
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link href="/login" className="underline hover:text-gray-800">
                  Login
                </Link>
                <Link href="/register" className="underline hover:text-gray-800">
                  Register
                </Link>
              </>
            )}
          </nav>
          {data && (
            <div className="flex flex-wrap gap-2 items-center justify-end">
              <Badge tone={data.company.status === 'active' ? 'success' : 'warning'}>
                {data.company.status}
              </Badge>
              <Button
                variant="secondary"
                size="sm"
                onClick={async () => {
                  setActionError(null);
                  try {
                    await apiClient.pauseCompany(data.company.id, data.company.status === 'active');
                    await mutate();
                  } catch (e) {
                    setActionError(e instanceof Error ? e.message : String(e));
                  }
                }}
              >
                {data.company.status === 'active' ? 'Pause company' : 'Resume company'}
              </Button>
              <Button variant="secondary" size="sm" onClick={handleTick} disabled={ticking}>
                {ticking ? 'Ticking…' : 'Run tick'}
              </Button>
              <Button size="sm" onClick={handleRunUntilIdle} disabled={ticking}>
                Run until idle
              </Button>
            </div>
          )}
        </div>
      </header>

      {data && (
        <p className="text-[11px] text-[var(--color-muted)] -mt-2">
          Планировщик MVP — <strong>тиковый</strong>: один тик забирает ограниченную пачку задач. «Run until
          idle» повторяет тик, пока в тике не было <code className="text-[10px]">executed === 0</code> (макс.{' '}
          {MAX_IDLE_TICKS}). Состояние компании в RAM процесса; LLM-профиль проекта — после входа и{' '}
          <code className="text-[10px]">factory_project_id</code> в localStorage.
        </p>
      )}

      {actionError && (
        <div
          role="alert"
          className="flex items-start justify-between gap-3 rounded-md border border-[var(--color-danger)]/50 bg-[var(--color-danger)]/10 px-3 py-2 text-sm text-[var(--color-danger)]"
        >
          <span className="min-w-0 break-words">{actionError}</span>
          <button
            type="button"
            className="shrink-0 text-xs underline opacity-80 hover:opacity-100"
            onClick={() => setActionError(null)}
          >
            Закрыть
          </button>
        </div>
      )}

      {!companyId && !proposal && (
        <Card>
          <CardHeader>
            <CardTitle>1. Define a goal</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={6} />
              <div className="flex items-center gap-3 flex-wrap">
                <label className="text-xs text-[var(--color-muted)]">Daily budget USD</label>
                <Input
                  type="number"
                  min={1}
                  step={1}
                  value={budget}
                  onChange={(e) => setBudget(Number(e.target.value))}
                  className="w-32"
                />
                <Button onClick={handleDraftProposal} disabled={drafting || creating || prompt.length < 10}>
                  {drafting ? 'Generating blueprint…' : '→ Review Blueprint'}
                </Button>
                <Button
                  variant="secondary"
                  onClick={handleCreate}
                  disabled={creating || drafting || prompt.length < 10}
                >
                  {creating ? 'Creating…' : 'Skip review'}
                </Button>
              </div>
              {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}
              <p className="text-[11px] text-[var(--color-muted)]">
                <strong>Review Blueprint</strong> — просмотр и редактирование предложения перед созданием
                компании. <strong>Skip review</strong> — создать сразу. Данные только в RAM процесса dev.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {proposal && !companyId && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>2. Review Blueprint</CardTitle>
              <button
                type="button"
                onClick={() => setProposal(null)}
                className="text-xs text-[var(--color-muted)] underline hover:text-gray-700"
              >
                ← Back
              </button>
            </div>
          </CardHeader>
          <CardContent>
            <ProposalReview
              key={proposal.id}
              proposal={proposal}
              onAccepted={handleProposalAccepted}
              onRebuilt={(newProposal) => setProposal(newProposal)}
              onError={setActionError}
            />
          </CardContent>
        </Card>
      )}

      {companyId && isLoading && !data && !swrError && (
        <Card>
          <CardContent>Loading state…</CardContent>
        </Card>
      )}

      {companyId && swrError && (
        <Card>
          <CardContent>
            <p className="text-sm text-[var(--color-danger)] mb-2">
              Company state unavailable: {swrError.message}
            </p>
            <p className="text-xs text-[var(--color-muted)] mb-3">
              Данные не в Postgres/SQLite — только RAM процесса Next.js (
              <code className="text-[10px]">src/factory/store/db.ts</code>
              ). После перезапуска <code className="text-[10px]">npm run dev</code> или HMR, сбросившего
              модуль, сервер «забывает» компании; браузер мог сохранить старый id в sessionStorage — нажми
              Reset и создай компанию заново.
            </p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setCompanyId(null);
                try {
                  sessionStorage.removeItem(SESSION_COMPANY_ID);
                  sessionStorage.removeItem(SESSION_SERVER_BOOT_ID);
                } catch {
                  /* ignore */
                }
              }}
            >
              Reset
            </Button>
          </CardContent>
        </Card>
      )}

      {data && data.stats && (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <BlueprintCard company={data.company} />
            <CostPanel company={data.company} costByAgent={data.costByAgent} />
          </div>

          <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} />

          <TabPanel value="overview" active={activeTab}>
            <div className="space-y-4">
              <OrgChart agents={data.agents} onMutate={() => mutate()} onApiError={setActionError} />
              <div className="grid gap-4 lg:grid-cols-2">
                <ApprovalsList
                  approvals={data.pendingApprovals}
                  onMutate={() => mutate()}
                  onApiError={setActionError}
                />
                <AuditTimeline audits={data.audits.slice(0, 30)} />
              </div>
            </div>
          </TabPanel>

          <TabPanel value="tasks" active={activeTab}>
            <TaskTable
              tasks={data.tasks}
              agents={data.agents}
              onMutate={() => mutate()}
              onApiError={setActionError}
            />
          </TabPanel>

          <TabPanel value="approvals" active={activeTab}>
            <ApprovalsList approvals={data.approvals} onMutate={() => mutate()} onApiError={setActionError} />
          </TabPanel>

          <TabPanel value="audit" active={activeTab}>
            <AuditTimeline audits={data.audits} />
          </TabPanel>
        </>
      )}
    </main>
  );
}
