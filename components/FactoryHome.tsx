'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
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
import { TaskOrchestrationHint } from '@/../components/control-plane/TaskOrchestrationHint';
import { ApprovalsList } from '@/../components/control-plane/ApprovalsList';
import { AuditTimeline } from '@/../components/control-plane/AuditTimeline';
import { CostPanel } from '@/../components/control-plane/CostPanel';
import {
  OrchestratorActivity,
  type LastOrchestratorRun,
} from '@/../components/control-plane/OrchestratorActivity';
import { ProposalReview } from '@/../components/ProposalReview';
import { BlueprintLoadingOverlay } from '@/../components/BlueprintLoadingOverlay';
import { ConfirmModal } from '@/../components/ui/ConfirmModal';
import { llmBlueprintProgressLine } from '@/../components/llmBlueprintProgressLabel';
import { useI18n } from '@/../components/i18n/LocaleProvider';
import { LanguageSwitcher } from '@/../components/i18n/LanguageSwitcher';
import type { CompanyState } from '@/factory/modules/controlPlane';
import type { TickResult } from '@/factory/modules/orchestrator';
import type { CompanyProposal } from '@/factory/domain/types';

/** Последний company id + эпоха RAM-хранилища (см. `getStorageEpoch` / GET /api/health). */
const SESSION_COMPANY_ID = 'agent-factory:company-id';
/** Вместе с company id — эпоха in-memory DB (`getStorageEpoch` в `db.ts`), а не отдельный UUID. */
const SESSION_SERVER_BOOT_ID = 'agent-factory:server-boot-id';

/** Макс. тиков подряд в «Run until idle» (см. `handleRunUntilIdle`). */
const MAX_IDLE_TICKS = 50;

export function FactoryHome() {
  const { t, locale } = useI18n();
  const defaultMission = useMemo(() => t('factory.defaultMissionPrompt'), [t]);
  const [prompt, setPrompt] = useState(defaultMission);
  const prevLocaleRef = useRef(locale);

  useEffect(() => {
    if (prevLocaleRef.current !== locale) {
      prevLocaleRef.current = locale;
      setPrompt(defaultMission);
    }
  }, [locale, defaultMission]);
  const { status: authStatus } = useSession();
  const [budget, setBudget] = useState(50);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [newCompanyDialogOpen, setNewCompanyDialogOpen] = useState(false);
  const [proposal, setProposal] = useState<CompanyProposal | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [llmProgressLine, setLlmProgressLine] = useState<string | null>(null);

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
  /** Прогресс тика: одиночный или цепочка until idle (номер тика для UI). */
  const [tickPhase, setTickPhase] = useState<null | { mode: 'single' } | { mode: 'until_idle'; n: number }>(
    null,
  );
  const [lastRunEntry, setLastRunEntry] = useState<{ companyId: string; run: LastOrchestratorRun } | null>(
    null,
  );
  const lastRun = companyId && lastRunEntry?.companyId === companyId ? lastRunEntry.run : null;
  const ticking = tickPhase !== null;
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
    setLlmProgressLine(t('factory.llmProgress.clientSending'));
    setError(null);
    try {
      const result = await apiClient.draftProposal({ missionPrompt: prompt, dailyBudgetUsd: budget }, (e) => {
        setLlmProgressLine(llmBlueprintProgressLine(e, t));
      });
      setProposal(result.proposal);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setDrafting(false);
      setLlmProgressLine(null);
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
    if (!companyId) return;
    const cid = companyId;
    setActionError(null);
    setTickPhase({ mode: 'single' });
    try {
      const t = await apiClient.tick();
      setLastRunEntry({ companyId: cid, run: { kind: 'single', at: Date.now(), result: t } });
      await mutate();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setTickPhase(null);
    }
  }

  async function handleRunUntilIdle() {
    if (!companyId) return;
    const cid = companyId;
    setActionError(null);
    try {
      let last: TickResult | undefined;
      for (let i = 0; i < MAX_IDLE_TICKS; i++) {
        setTickPhase({ mode: 'until_idle', n: i + 1 });
        const t = await apiClient.tick();
        last = t;
        await mutate();
        if (t.executed === 0) {
          setLastRunEntry({
            companyId: cid,
            run: {
              kind: 'untilIdle',
              at: Date.now(),
              tickCount: i + 1,
              lastResult: t,
              stoppedBecause: 'idle',
            },
          });
          return;
        }
      }
      if (last) {
        setLastRunEntry({
          companyId: cid,
          run: {
            kind: 'untilIdle',
            at: Date.now(),
            tickCount: MAX_IDLE_TICKS,
            lastResult: last,
            stoppedBecause: 'cap',
          },
        });
      }
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setTickPhase(null);
    }
  }

  const queuedRunning = (data?.stats?.queued ?? 0) + (data?.stats?.running ?? 0);
  const tabs: Tab[] = useMemo(
    () => [
      { id: 'overview', label: t('factory.tabOverview') },
      { id: 'tasks', label: t('factory.tabTasks'), badge: queuedRunning > 0 ? queuedRunning : undefined },
      { id: 'approvals', label: t('factory.tabApprovals'), badge: data?.pendingApprovals?.length ?? 0 },
      { id: 'audit', label: t('factory.tabAudit') },
    ],
    [t, queuedRunning, data?.pendingApprovals?.length],
  );

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6 md:space-y-10 md:px-8 md:py-12 lg:max-w-7xl">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-fg)] md:text-3xl">
            {t('factory.title')}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-[var(--color-muted)] md:text-base">
            {t('factory.subtitle')}
          </p>
        </div>
        <div className="flex flex-col items-end gap-3">
          <div className="flex flex-wrap items-center justify-end gap-3">
            <LanguageSwitcher />
            <nav className="flex flex-wrap items-center justify-end gap-x-5 gap-y-2 text-sm text-[var(--color-muted)] md:text-base">
              {authStatus === 'authenticated' ? (
                <>
                  <Link href="/settings/llm" className="underline hover:text-[var(--color-fg)]">
                    {t('nav.llmProject')}
                  </Link>
                  {data && (
                    <button
                      type="button"
                      className="underline hover:text-[var(--color-fg)]"
                      disabled={ticking}
                      onClick={() => setNewCompanyDialogOpen(true)}
                    >
                      {t('nav.newCompany')}
                    </button>
                  )}
                  <button
                    type="button"
                    className="underline hover:text-[var(--color-fg)]"
                    onClick={() => void signOut({ redirectTo: '/' })}
                  >
                    {t('nav.signOut')}
                  </button>
                </>
              ) : (
                <>
                  <Link href="/login" className="underline hover:text-[var(--color-fg)]">
                    {t('nav.login')}
                  </Link>
                  <Link href="/register" className="underline hover:text-[var(--color-fg)]">
                    {t('nav.register')}
                  </Link>
                </>
              )}
            </nav>
          </div>
          {data && (
            <div className="flex flex-wrap items-center justify-end gap-2 md:gap-3">
              <Badge tone={data.company.status === 'active' ? 'success' : 'warning'}>
                {data.company.status}
              </Badge>
              <Button
                variant="secondary"
                className="h-11 min-w-[8rem] text-sm md:h-12 md:text-base"
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
                {data.company.status === 'active' ? t('factory.pauseCompany') : t('factory.resumeCompany')}
              </Button>
              <Button
                variant="secondary"
                className="h-11 text-sm md:h-12 md:text-base"
                onClick={handleTick}
                disabled={ticking}
                title={t('factory.runTickTitle')}
              >
                {tickPhase?.mode === 'single' ? t('factory.runTickShort') : t('factory.runTick')}
              </Button>
              <Button
                className="h-11 text-sm md:h-12 md:text-base"
                onClick={handleRunUntilIdle}
                disabled={ticking}
                title={t('factory.runUntilIdleTitle', { max: String(MAX_IDLE_TICKS) })}
              >
                {tickPhase?.mode === 'until_idle'
                  ? t('factory.untilIdleProgress', { n: String(tickPhase.n) })
                  : t('factory.runUntilIdle')}
              </Button>
            </div>
          )}
        </div>
      </header>

      {data && (
        <p className="-mt-2 text-sm leading-relaxed text-[var(--color-muted)] md:text-base">
          {t('factory.scheduler', { maxTicks: String(MAX_IDLE_TICKS) })}
        </p>
      )}

      {actionError && (
        <div
          role="alert"
          className="flex items-start justify-between gap-4 rounded-lg border border-[var(--color-danger)]/50 bg-[var(--color-danger)]/10 px-4 py-3 text-base text-[var(--color-danger)] md:px-5 md:py-4"
        >
          <span className="min-w-0 break-words">{actionError}</span>
          <button
            type="button"
            className="shrink-0 text-sm underline opacity-80 hover:opacity-100"
            onClick={() => setActionError(null)}
          >
            {t('common.close')}
          </button>
        </div>
      )}

      {!companyId && !proposal && (
        <div className="space-y-6">
          <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)]/40 px-5 py-5 md:px-7 md:py-6">
            <h2 className="text-lg font-semibold text-[var(--color-fg)] md:text-xl">
              {t('factory.howToTitle')}
            </h2>
            <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm text-[var(--color-muted)] marker:text-[var(--color-accent)] md:text-base md:leading-relaxed">
              <li>{t('factory.howTo1')}</li>
              <li>{t('factory.howTo2')}</li>
              <li>{t('factory.howTo3')}</li>
            </ol>
            <p className="mt-4 text-sm text-[var(--color-muted)] md:text-base">{t('factory.howToRam')}</p>
          </section>

          <Card>
            <CardHeader>
              <CardTitle>{t('factory.defineGoal')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-5 md:gap-6">
                <Textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={8}
                  className="min-h-[220px] font-sans md:min-h-[260px]"
                />
                <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <label className="text-sm font-medium text-[var(--color-muted)] md:text-base">
                      {t('factory.dailyBudget')}
                    </label>
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      value={budget}
                      onChange={(e) => setBudget(Number(e.target.value))}
                      className="w-full sm:w-36 md:w-40"
                    />
                  </div>
                  <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:justify-end">
                    <Button
                      className="h-12 min-h-12 w-full px-6 text-base sm:w-auto md:h-14 md:px-8 md:text-lg"
                      onClick={handleDraftProposal}
                      disabled={drafting || creating || prompt.length < 10}
                    >
                      {drafting ? t('factory.generatingBlueprint') : t('factory.reviewBlueprintBtn')}
                    </Button>
                    <Button
                      variant="secondary"
                      className="h-12 min-h-12 w-full px-6 text-base sm:w-auto md:h-14 md:px-8 md:text-lg"
                      onClick={handleCreate}
                      disabled={creating || drafting || prompt.length < 10}
                    >
                      {creating ? t('factory.creating') : t('factory.skipReview')}
                    </Button>
                  </div>
                </div>
                {error && <p className="text-sm text-[var(--color-danger)] md:text-base">{error}</p>}
                <p className="text-sm leading-relaxed text-[var(--color-muted)] md:text-base">
                  {t('factory.goalHint')}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {proposal && !companyId && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{t('factory.reviewTitle')}</CardTitle>
              <button
                type="button"
                onClick={() => setProposal(null)}
                className="text-sm text-[var(--color-muted)] underline hover:text-[var(--color-fg)] md:text-base"
              >
                {t('factory.back')}
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
          <CardContent className="py-8 text-center text-base text-[var(--color-muted)] md:text-lg">
            {t('factory.loadingState')}
          </CardContent>
        </Card>
      )}

      {companyId && swrError && (
        <Card>
          <CardContent>
            <p className="mb-3 text-base text-[var(--color-danger)] md:text-lg">
              {t('factory.companyUnavailable')} {swrError.message}
            </p>
            <p className="mb-4 text-sm leading-relaxed text-[var(--color-muted)] md:text-base">
              {t('factory.ramExplainer')}
            </p>
            <Button
              variant="secondary"
              className="h-11 text-base"
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
              {t('factory.reset')}
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

          <OrchestratorActivity
            company={data.company}
            stats={data.stats}
            pendingApprovalCount={data.pendingApprovals.length}
            lastRun={lastRun}
          />

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
              footer={
                <TaskOrchestrationHint
                  company={data.company}
                  tasks={data.tasks}
                  agents={data.agents}
                  onRunTick={handleTick}
                  onRunUntilIdle={handleRunUntilIdle}
                  tickPhase={tickPhase}
                  maxIdleTicks={MAX_IDLE_TICKS}
                />
              }
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

      <ConfirmModal
        open={newCompanyDialogOpen}
        title={t('nav.newCompanyDialogTitle')}
        description={t('nav.newCompanyConfirm')}
        cancelLabel={t('common.cancel')}
        confirmLabel={t('nav.newCompanyDialogConfirm')}
        onCancel={() => setNewCompanyDialogOpen(false)}
        onConfirm={() => {
          setNewCompanyDialogOpen(false);
          setCompanyId(null);
          setLastRunEntry(null);
          setActiveTab('overview');
          setPollPaused(false);
          try {
            sessionStorage.removeItem(SESSION_COMPANY_ID);
            sessionStorage.removeItem(SESSION_SERVER_BOOT_ID);
          } catch {
            /* ignore */
          }
        }}
      />

      <BlueprintLoadingOverlay
        key={drafting ? `draft-${locale}` : 'idle'}
        open={drafting}
        locale={locale}
        title={t('factory.blueprintOverlayTitle')}
        subtitle={t('factory.blueprintOverlaySub')}
        progressDetail={llmProgressLine}
      />
    </main>
  );
}
