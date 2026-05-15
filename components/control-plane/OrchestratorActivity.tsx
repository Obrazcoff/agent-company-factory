'use client';

import type { CompanyState } from '@/factory/modules/controlPlane';
import type { TickResult } from '@/factory/modules/orchestrator';
import { Badge } from '@/../components/ui/badge';
import { useI18n } from '@/../components/i18n/LocaleProvider';

export type LastOrchestratorRun =
  | { kind: 'single'; at: number; result: TickResult }
  | {
      kind: 'untilIdle';
      at: number;
      tickCount: number;
      lastResult: TickResult;
      stoppedBecause: 'idle' | 'cap';
    };

type PhaseKey = 'paused' | 'approval' | 'awaitResume' | 'working' | 'idle';

function phaseFromState(input: {
  companyStatus: CompanyState['company']['status'];
  pendingApprovals: number;
  stats: CompanyState['stats'];
}): { tone: 'success' | 'warning' | 'accent' | 'neutral'; phaseKey: PhaseKey; workCount?: number } {
  if (input.companyStatus === 'paused') {
    return { tone: 'warning', phaseKey: 'paused' };
  }
  if (input.pendingApprovals > 0) {
    return { tone: 'accent', phaseKey: 'approval' };
  }
  const { queued, running, awaitingApproval } = input.stats;
  if (awaitingApproval > 0) {
    return { tone: 'accent', phaseKey: 'awaitResume' };
  }
  const inFlight = queued + running;
  if (inFlight > 0) {
    return { tone: 'success', phaseKey: 'working', workCount: inFlight };
  }
  return { tone: 'neutral', phaseKey: 'idle' };
}

function formatTickLine(r: TickResult): string {
  const parts = [
    `executed=${r.executed}`,
    `done=${r.doneTasks}`,
    `fail=${r.failedTasks}`,
    `await_appr=${r.awaitingApprovalTasks}`,
    `defer=${r.deferred}`,
    `${r.durationMs}ms`,
  ];
  if (r.expiredApprovals || r.staleRunsRecovered) {
    parts.push(`exp_appr=${r.expiredApprovals}`, `stale=${r.staleRunsRecovered}`);
  }
  return parts.join(' · ');
}

const PHASE_LABEL: Record<PhaseKey, string> = {
  paused: 'orchestrator.phasePausedLabel',
  approval: 'orchestrator.phaseApprovalLabel',
  awaitResume: 'orchestrator.phaseAwaitResumeLabel',
  working: 'orchestrator.phaseWorkingLabel',
  idle: 'orchestrator.phaseIdleLabel',
};

const PHASE_HINT: Record<PhaseKey, string> = {
  paused: 'orchestrator.phasePausedHint',
  approval: 'orchestrator.phaseApprovalHint',
  awaitResume: 'orchestrator.phaseAwaitResumeHint',
  working: 'orchestrator.phaseWorkingHint',
  idle: 'orchestrator.phaseIdleHint',
};

export function OrchestratorActivity({
  company,
  stats,
  pendingApprovalCount,
  lastRun,
}: {
  company: CompanyState['company'];
  stats: CompanyState['stats'];
  pendingApprovalCount: number;
  lastRun: LastOrchestratorRun | null;
}) {
  const { t } = useI18n();
  const phase = phaseFromState({
    companyStatus: company.status,
    pendingApprovals: pendingApprovalCount,
    stats,
  });
  const labelKey = PHASE_LABEL[phase.phaseKey];
  const hintKey = PHASE_HINT[phase.phaseKey];
  const hint =
    phase.phaseKey === 'working' && phase.workCount !== undefined
      ? t(hintKey, { count: String(phase.workCount) })
      : t(hintKey);

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)]/50 px-4 py-3 md:px-5 md:py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted)]">
              {t('orchestrator.sectionTitle')}
            </span>
            <Badge tone={phase.tone}>{t(labelKey)}</Badge>
          </div>
          <p className="text-sm leading-relaxed text-[var(--color-muted)]">{hint}</p>
        </div>
        {lastRun && (
          <div className="shrink-0 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-xs font-mono text-[var(--color-fg)] sm:max-w-[min(100%,28rem)]">
            <div className="mb-1 text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
              {t('orchestrator.lastRun')}
            </div>
            {lastRun.kind === 'single' ? (
              <span className="break-all">
                {t('orchestrator.tickLine')}
                {formatTickLine(lastRun.result)}
              </span>
            ) : (
              <span className="break-all">
                {t('orchestrator.untilIdleLine', {
                  count: String(lastRun.tickCount),
                  cap: lastRun.stoppedBecause === 'cap' ? t('orchestrator.capSuffix') : '',
                })}
                {formatTickLine(lastRun.lastResult)}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
