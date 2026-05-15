'use client';

import { useState } from 'react';
import { BlueprintLoadingOverlay } from '@/../components/BlueprintLoadingOverlay';
import type { CompanyProposal, ProposedAgent } from '@/factory/domain/types';
import { apiClient } from '@/../lib/api-client';
import { AgentAvatar } from '@/../components/AgentAvatar';
import { Button } from '@/../components/ui/button';
import { useI18n } from '@/../components/i18n/LocaleProvider';
import { X, RotateCcw } from 'lucide-react';

type Props = {
  proposal: CompanyProposal;
  onAccepted: (companyId: string, serverBootId: string) => void;
  onRebuilt: (newProposal: CompanyProposal) => void;
  onError: (msg: string) => void;
};

function labelFor(agent: ProposedAgent): string {
  return agent.displayName ?? agent.name;
}

function slugFor(agent: ProposedAgent): string {
  return agent.avatarSlug ?? 'frog';
}

export function ProposalReview({ proposal, onAccepted, onRebuilt, onError }: Props) {
  const { t, locale } = useI18n();
  const [agents, setAgents] = useState<ProposedAgent[]>(proposal.proposedAgents);
  const [feedback, setFeedback] = useState('');
  const [accepting, setAccepting] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const includedCount = agents.filter((a) => a.included).length;
  const excludedRoles = [...new Set(agents.filter((a) => !a.included).map((a) => a.role))];
  const hasFeedback = feedback.trim().length > 0;

  async function setIncluded(agentId: string, included: boolean) {
    setTogglingId(agentId);
    try {
      const res = await apiClient.excludeAgent(proposal.id, agentId, included);
      setAgents(res.proposal.proposedAgents);
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      setTogglingId(null);
    }
  }

  async function handleAccept() {
    if (includedCount === 0) {
      onError(t('factory.acceptNeedAgent'));
      return;
    }
    setAccepting(true);
    try {
      const result = await apiClient.acceptProposal(proposal.id);
      onAccepted(result.company.id, result.serverBootId);
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      setAccepting(false);
    }
  }

  async function handleRebuild() {
    setRebuilding(true);
    try {
      const result = await apiClient.rebuildProposal(proposal.id, feedback || undefined);
      setAgents(result.proposal.proposedAgents);
      setFeedback('');
      onRebuilt(result.proposal);
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      setRebuilding(false);
    }
  }

  return (
    <div className="space-y-6">
      <BlueprintLoadingOverlay
        key={rebuilding ? `rebuild-${locale}` : 'idle'}
        open={rebuilding}
        locale={locale}
        title={t('proposal.rebuildOverlayTitle')}
        subtitle={t('proposal.rebuildOverlaySub')}
      />
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/85 p-5 shadow-[0_20px_60px_oklch(0.05_0.02_260/0.45)] backdrop-blur-md">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-[var(--color-fg)]">
              {t('proposal.title')}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-[var(--color-muted)]">
              {proposal.blueprint.mission}
            </p>
          </div>
          <span className="shrink-0 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-1 text-xs font-medium text-[var(--color-muted)]">
            {t('proposal.reviewing')}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label={t('proposal.statDaily')} value={`$${proposal.blueprint.dailyCapUsd}`} />
          <Stat label={t('proposal.statKpis')} value={String(proposal.blueprint.kpis.length)} />
          <Stat
            label={t('proposal.statApprovals')}
            value={proposal.blueprint.approvals.join(', ') || t('common.dash')}
          />
        </div>

        {proposal.blueprint.kpis.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2">
            {proposal.blueprint.kpis.map((kpi, i) => (
              <li
                key={i}
                className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-2.5 py-1 text-xs text-[var(--color-muted)]"
              >
                {kpi.name}: {kpi.target} {kpi.unit ?? ''}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h3 className="mb-1 text-sm font-semibold text-[var(--color-fg)]">
          {t('proposal.teamTitle', { included: String(includedCount), total: String(agents.length) })}
        </h3>
        <p className="mb-3 text-xs leading-relaxed text-[var(--color-muted)]">{t('proposal.teamHint')}</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => {
            const busy = togglingId === agent.id;
            return (
              <div
                key={agent.id}
                className={`relative rounded-2xl border-2 p-4 ${busy ? 'opacity-70' : ''} ${
                  agent.included
                    ? 'border-[var(--color-accent)]/35 bg-[var(--color-surface)]/95 shadow-[0_12px_40px_oklch(0.06_0.02_260/0.35)] ring-1 ring-[var(--color-accent)]/20'
                    : 'border-dashed border-[var(--color-warning)]/55 bg-[var(--color-warning)]/[0.07]'
                }`}
              >
                <div className="absolute right-2 top-2 flex gap-0.5">
                  {agent.included ? (
                    <button
                      type="button"
                      title={t('proposal.excludeTitle')}
                      disabled={busy}
                      onClick={() => setIncluded(agent.id, false)}
                      className="rounded-md p-1 text-[var(--color-muted)] hover:bg-[var(--color-bg)] hover:text-[var(--color-danger)] disabled:opacity-40"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      title={t('proposal.includeTitle')}
                      disabled={busy}
                      onClick={() => setIncluded(agent.id, true)}
                      className="rounded-md p-1 text-[var(--color-muted)] hover:bg-[var(--color-bg)] hover:text-[var(--color-success)] disabled:opacity-40"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <div
                  className={`mb-2 inline-flex max-w-[calc(100%-2.5rem)] items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                    agent.included
                      ? 'border-[var(--color-success)]/35 bg-[var(--color-success)]/12 text-[var(--color-success)]'
                      : 'border-[var(--color-warning)]/45 bg-[var(--color-warning)]/15 text-[var(--color-warning)]'
                  }`}
                >
                  {agent.included ? t('proposal.badgeInTeam') : t('proposal.badgeExcluded')}
                </div>

                <div className="flex gap-3 pr-10">
                  <AgentAvatar
                    slug={slugFor(agent)}
                    className={`h-14 w-14 shrink-0 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] object-contain p-1.5 ${
                      agent.included ? '' : 'opacity-55 grayscale'
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
                      {agent.role}
                    </div>
                    <div
                      className={`truncate font-semibold ${agent.included ? 'text-[var(--color-fg)]' : 'text-[var(--color-muted)]'}`}
                    >
                      {labelFor(agent)}
                    </div>
                    <div className="truncate text-xs text-[var(--color-muted)]">{agent.name}</div>
                  </div>
                </div>

                <label
                  className={`mt-3 flex cursor-pointer items-center gap-2 text-xs ${
                    agent.included ? 'text-[var(--color-muted)]' : 'text-[var(--color-warning)]'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={agent.included}
                    disabled={busy}
                    onChange={(e) => setIncluded(agent.id, e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-accent)]"
                  />
                  {t('proposal.includeCheckbox')}
                </label>

                <div className="mt-2 flex flex-wrap gap-1">
                  {agent.permissions.map((p) => (
                    <span
                      key={p}
                      className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-1.5 py-0.5 text-[10px] text-[var(--color-muted)]"
                    >
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-3">
        <label className="block text-sm font-medium text-[var(--color-fg)]">
          {t('proposal.feedbackLabel')}
        </label>
        <textarea
          rows={3}
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder={t('proposal.feedbackPh')}
          className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-muted)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/25"
          disabled={accepting || rebuilding}
        />
        <p className="text-xs leading-relaxed text-[var(--color-muted)]">
          <strong className="text-[var(--color-fg)]">{t('proposal.rebuildHelpLead')}</strong>
          {t('proposal.rebuildHelp1')}
          {hasFeedback ? <> {t('proposal.rebuildWithFeedback')}</> : <> {t('proposal.rebuildNoFeedback')}</>}
          {excludedRoles.length > 0 ? (
            <>
              {' '}
              {t('proposal.rebuildRolesPrefix')}{' '}
              <span className="font-mono text-[11px] text-[var(--color-fg)]">{excludedRoles.join(', ')}</span>
              .
            </>
          ) : (
            <> {t('proposal.rebuildRolesNone')}</>
          )}
        </p>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button
            type="button"
            variant="success"
            className="flex-1 py-2.5 text-sm"
            onClick={() => void handleAccept()}
            disabled={accepting || rebuilding || includedCount === 0}
          >
            {accepting ? t('proposal.accepting') : t('proposal.accept', { count: String(includedCount) })}
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="flex-1 border border-[var(--color-border)] py-2.5 text-sm"
            onClick={() => void handleRebuild()}
            disabled={accepting || rebuilding}
            title={t('proposal.rebuildTitle')}
          >
            {rebuilding ? t('proposal.rebuilding') : t('proposal.rebuild')}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
      <p className="text-xs text-[var(--color-muted)]">{label}</p>
      <p className="mt-0.5 font-semibold text-[var(--color-fg)]">{value}</p>
    </div>
  );
}
