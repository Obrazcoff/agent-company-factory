import { COST_TABLE } from '../../config';
import type { Connector } from '../types';

type Input = { query?: string; count?: number; missionPrompt?: string };
type Lead = {
  name: string;
  domain: string;
  industry: string;
  size: string;
  rationale: string;
};

const FAKE_LEADS: Lead[] = [
  {
    name: 'Northwind PropTech',
    domain: 'northwind.example',
    industry: 'PropTech',
    size: '50-200',
    rationale: 'launching AI assistant',
  },
  {
    name: 'Helios Stays',
    domain: 'helios.example',
    industry: 'Hospitality',
    size: '20-100',
    rationale: 'concierge automation interest',
  },
  {
    name: 'Stratus Realty',
    domain: 'stratus.example',
    industry: 'Real Estate',
    size: '100-500',
    rationale: 'recent funding for AI',
  },
  {
    name: 'Ember Hosts',
    domain: 'ember.example',
    industry: 'Short-term Rentals',
    size: '10-50',
    rationale: 'ops bottleneck signals',
  },
  {
    name: 'Lumen Suites',
    domain: 'lumen.example',
    industry: 'Hospitality',
    size: '50-200',
    rationale: 'job posts mention AI ops',
  },
  {
    name: 'Vanta Living',
    domain: 'vanta.example',
    industry: 'Multifamily',
    size: '200-1000',
    rationale: 'CTO posted about agents',
  },
  {
    name: 'Tide Hospitality',
    domain: 'tide.example',
    industry: 'Hospitality',
    size: '50-200',
    rationale: 'expansion to 3 cities',
  },
  {
    name: 'Crater Stays',
    domain: 'crater.example',
    industry: 'Short-term Rentals',
    size: '10-50',
    rationale: 'ops Slack hiring',
  },
  {
    name: 'Pioneer PMS',
    domain: 'pioneer.example',
    industry: 'PropTech',
    size: '20-100',
    rationale: 'integration partner program',
  },
  {
    name: 'Atlas Concierge',
    domain: 'atlas.example',
    industry: 'Concierge',
    size: '5-20',
    rationale: 'direct ICP match',
  },
];

export const webSearchConnector: Connector<Input, { leads: Lead[] }> = {
  id: 'web_search',
  kind: 'web_search',
  name: 'Web Search (mock)',
  requiresApproval: false,
  scopes: ['search:read'],

  estimateCost(input) {
    const count = input.count ?? 10;
    return COST_TABLE.connector_call_usd * Math.max(1, Math.ceil(count / 10));
  },

  async call(input) {
    const count = Math.min(input.count ?? 10, FAKE_LEADS.length);
    return {
      output: { leads: FAKE_LEADS.slice(0, count) },
      costUsd: this.estimateCost(input),
      latencyMs: 12,
    };
  },
};
