import { COST_TABLE } from '../../config';
import type { Connector } from '../types';

type Input = { sheet: string; rows: Record<string, unknown>[] };

export const sheetsConnector: Connector<Input, { written: number }> = {
  id: 'sheets',
  kind: 'sheets',
  name: 'Sheets (mock)',
  requiresApproval: false,
  scopes: ['sheets.write'],
  estimateCost: (input) => COST_TABLE.connector_call_usd * Math.max(1, Math.ceil(input.rows.length / 50)),
  async call(input) {
    return {
      output: { written: input.rows.length },
      costUsd: this.estimateCost(input),
      latencyMs: 7,
    };
  },
};
