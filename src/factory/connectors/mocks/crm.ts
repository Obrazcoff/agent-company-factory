import { COST_TABLE } from '../../config';
import type { Connector } from '../types';

type Input = { leads: Array<{ name: string; domain: string; [k: string]: unknown }> };

export const crmConnector: Connector<Input, { upserted: number }> = {
  id: 'crm',
  kind: 'crm',
  name: 'CRM (mock)',
  requiresApproval: false,
  scopes: ['crm.write'],
  estimateCost: (input) => COST_TABLE.connector_call_usd * Math.max(1, input.leads.length),
  async call(input) {
    return {
      output: { upserted: input.leads.length },
      costUsd: this.estimateCost(input),
      latencyMs: 10,
    };
  },
};
