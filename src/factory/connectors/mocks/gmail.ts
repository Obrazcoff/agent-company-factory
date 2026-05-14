import { COST_TABLE } from '../../config';
import type { Connector } from '../types';

type DraftInput = { to: string; subject: string; body: string };
type SendInput = { draftId: string; to: string; subject: string; body: string };

let draftSeq = 0;

export const gmailDraftConnector: Connector<DraftInput, { draftId: string }> = {
  id: 'gmail.draft',
  kind: 'gmail',
  name: 'Gmail Draft (mock)',
  requiresApproval: false,
  scopes: ['gmail.compose'],
  estimateCost: () => COST_TABLE.connector_call_usd,
  async call() {
    draftSeq += 1;
    return {
      output: { draftId: `draft_${draftSeq}` },
      costUsd: COST_TABLE.connector_call_usd,
      latencyMs: 8,
    };
  },
};

export const gmailSendConnector: Connector<SendInput, { messageId: string; sentTo: string }> = {
  id: 'gmail.send',
  kind: 'gmail',
  name: 'Gmail Send (mock, requires approval)',
  requiresApproval: true,
  scopes: ['gmail.send'],
  estimateCost: () => COST_TABLE.connector_call_usd,
  async call(input) {
    return {
      output: { messageId: `msg_${Date.now()}`, sentTo: input.to },
      costUsd: COST_TABLE.connector_call_usd,
      latencyMs: 15,
    };
  },
};
