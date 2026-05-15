import type { LlmBlueprintProgressEvent } from '@/llm/llm-progress';

export type ProposalNdjsonDone = {
  type: 'done';
  proposal: unknown;
  llmCostUsd: number;
};

export type ProposalNdjsonProgress = {
  type: 'progress';
  event: LlmBlueprintProgressEvent;
};

export type ProposalNdjsonError = {
  type: 'error';
  status: number;
  message?: string;
  error?: string;
  issues?: unknown;
};

export type ProposalNdjsonLine = ProposalNdjsonDone | ProposalNdjsonProgress | ProposalNdjsonError;

export function encodeProposalNdjsonLine(obj: ProposalNdjsonLine): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(obj)}\n`);
}
