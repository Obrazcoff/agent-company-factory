'use client';

import { Button } from '@/../components/ui/button';
import { useI18n } from '@/../components/i18n/LocaleProvider';
import type { Agent, Company, Task } from '@/factory/domain/types';

export type TickPhase = null | { mode: 'single' } | { mode: 'until_idle'; n: number };

export function TaskOrchestrationHint({
  company,
  tasks,
  agents,
  onRunTick,
  onRunUntilIdle,
  tickPhase,
  maxIdleTicks,
}: {
  company: Company;
  tasks: Task[];
  agents: Agent[];
  onRunTick: () => void;
  onRunUntilIdle: () => void;
  tickPhase: TickPhase;
  maxIdleTicks: number;
}) {
  const { t } = useI18n();
  const queued = tasks.filter((x) => x.status === 'queued');
  const pausedBlocking = new Set<string>();
  for (const q of queued) {
    const a = agents.find((x) => x.id === q.agentId);
    if (a?.status === 'paused') pausedBlocking.add(a.displayName ?? a.name);
  }
  const ticking = tickPhase !== null;
  const companyPaused = company.status === 'paused';

  return (
    <div className="mt-4 space-y-4 border-t border-[var(--color-border)] pt-4">
      <div className="space-y-2 text-sm leading-relaxed text-[var(--color-muted)]">
        <p>
          <strong className="text-[var(--color-fg)]">{t('taskHint.what')}</strong>{' '}
          <code className="rounded bg-[var(--color-bg)] px-1 py-0.5 text-[11px] text-[var(--color-fg)]">
            queued
          </code>{' '}
          {t('taskHint.queuedExplain')}
        </p>
        <p>
          <strong className="text-[var(--color-fg)]">{t('taskHint.howRun')}</strong>{' '}
          {t('taskHint.howRunDetail')}
        </p>
        {companyPaused && (
          <p className="rounded-md border border-[var(--color-warning)]/40 bg-[var(--color-warning)]/10 px-3 py-2 text-[var(--color-warning)]">
            {t('taskHint.companyPaused')}
          </p>
        )}
        {pausedBlocking.size > 0 && (
          <p className="rounded-md border border-[var(--color-warning)]/40 bg-[var(--color-warning)]/10 px-3 py-2 text-[var(--color-warning)]">
            {t('taskHint.agentPaused', { names: Array.from(pausedBlocking).join(', ') })}
          </p>
        )}
        {queued.some((x) => x.kind.startsWith('send_outreach')) && (
          <p>
            <code className="rounded bg-[var(--color-bg)] px-1 py-0.5 text-[11px] text-[var(--color-fg)]">
              send_outreach_*
            </code>{' '}
            {t('taskHint.sendOutreach')}
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={ticking || companyPaused}
          title={t('factory.runTickTitle')}
          onClick={onRunTick}
        >
          {tickPhase?.mode === 'single' ? t('factory.runTickShort') : t('factory.runTick')}
        </Button>
        <Button
          size="sm"
          disabled={ticking || companyPaused}
          title={t('factory.runUntilIdleTitle', { max: String(maxIdleTicks) })}
          onClick={onRunUntilIdle}
        >
          {tickPhase?.mode === 'until_idle'
            ? t('factory.untilIdleProgress', { n: String(tickPhase.n) })
            : t('factory.runUntilIdle')}
        </Button>
      </div>
    </div>
  );
}
