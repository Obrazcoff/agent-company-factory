import { COST_TABLE } from '../../config';
import type { Connector } from '../types';

type Input = { title: string; startsAt: string; attendees: string[] };

export const calendarConnector: Connector<Input, { eventId: string }> = {
  id: 'calendar',
  kind: 'calendar',
  name: 'Calendar (mock, requires approval)',
  requiresApproval: true,
  scopes: ['calendar.write'],
  estimateCost: () => COST_TABLE.connector_call_usd,
  async call() {
    return {
      output: { eventId: `evt_${Date.now()}` },
      costUsd: COST_TABLE.connector_call_usd,
      latencyMs: 9,
    };
  },
};
