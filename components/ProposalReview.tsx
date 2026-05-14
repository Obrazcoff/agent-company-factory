'use client';

import { useState } from 'react';
import type { CompanyProposal, ProposedAgent } from '@/factory/domain/types';
import { apiClient } from '@/../lib/api-client';
import { AgentAvatar } from '@/../components/AgentAvatar';
import { X, Trash2, RotateCcw } from 'lucide-react';

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
  const [agents, setAgents] = useState<ProposedAgent[]>(proposal.proposedAgents);
  const [feedback, setFeedback] = useState('');
  const [accepting, setAccepting] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const includedCount = agents.filter((a) => a.included).length;

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
      onError('Select at least one agent before accepting.');
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
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-blue-900">Blueprint Proposal</h2>
            <p className="mt-1 text-sm text-blue-700">{proposal.blueprint.mission}</p>
          </div>
          <span className="shrink-0 rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800">
            Reviewing
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label="Daily budget" value={`$${proposal.blueprint.dailyCapUsd}`} />
          <Stat label="KPIs" value={String(proposal.blueprint.kpis.length)} />
          <Stat label="Approvals needed" value={proposal.blueprint.approvals.join(', ') || '—'} />
        </div>

        {proposal.blueprint.kpis.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2">
            {proposal.blueprint.kpis.map((kpi, i) => (
              <li key={i} className="rounded-md bg-white px-2 py-1 text-xs text-gray-600 shadow-sm">
                {kpi.name}: {kpi.target} {kpi.unit ?? ''}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold text-gray-700">
          Proposed team ({includedCount}/{agents.length} active)
        </h3>
        <p className="mb-3 text-xs text-gray-500">
          Remove with X or trash — excluded roles are sent to the LLM on Rebuild. Restore with the arrow.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => (
            <div
              key={agent.id}
              className={`relative rounded-xl border p-4 shadow-sm transition ${
                agent.included
                  ? 'border-gray-200 bg-white'
                  : 'border-dashed border-gray-300 bg-gray-50 opacity-70'
              }`}
            >
              <div className="absolute right-2 top-2 flex gap-0.5">
                {agent.included ? (
                  <>
                    <button
                      type="button"
                      title="Exclude"
                      disabled={togglingId === agent.id}
                      onClick={() => setIncluded(agent.id, false)}
                      className="rounded p-1 text-gray-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                    >
                      <X className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      title="Remove from proposal"
                      disabled={togglingId === agent.id}
                      onClick={() => setIncluded(agent.id, false)}
                      className="rounded p-1 text-gray-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    title="Include again"
                    disabled={togglingId === agent.id}
                    onClick={() => setIncluded(agent.id, true)}
                    className="rounded p-1 text-gray-500 hover:bg-green-50 hover:text-green-700 disabled:opacity-40"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="flex gap-3 pr-14">
                <AgentAvatar
                  slug={slugFor(agent)}
                  className="h-14 w-14 rounded-lg border border-gray-200 bg-amber-50/50 object-contain p-1"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium uppercase tracking-wide text-gray-500">
                    {agent.role}
                  </div>
                  <div className="truncate font-semibold text-gray-900">{labelFor(agent)}</div>
                  <div className="truncate text-xs text-gray-500">{agent.name}</div>
                </div>
              </div>

              <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs text-gray-600">
                <input
                  type="checkbox"
                  checked={agent.included}
                  disabled={togglingId === agent.id}
                  onChange={(e) => setIncluded(agent.id, e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600"
                />
                Include in final team
              </label>

              <div className="mt-2 flex flex-wrap gap-1">
                {agent.permissions.map((p) => (
                  <span key={p} className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600">
                    {p}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-700">Feedback for rebuild (optional)</label>
        <textarea
          rows={3}
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="e.g. Focus on B2B SaaS, fewer Outreach variants…"
          className="w-full rounded-lg border border-gray-300 p-3 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
          disabled={accepting || rebuilding}
        />

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={handleAccept}
            disabled={accepting || rebuilding || includedCount === 0}
            className="flex-1 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {accepting ? 'Activating…' : `Accept & activate (${includedCount})`}
          </button>
          <button
            type="button"
            onClick={handleRebuild}
            disabled={accepting || rebuilding}
            className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {rebuilding ? 'Rebuilding…' : 'Rebuild blueprint'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white p-3 shadow-sm">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-0.5 font-semibold text-gray-800">{value}</p>
    </div>
  );
}
