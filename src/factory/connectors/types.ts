import type { ConnectorId, ConnectorKind } from '../domain/types';

export type ConnectorContext = {
  companyId: string;
  agentId: string;
  runId: string;
  secretsRef: string;
};

export type ConnectorResult<T = unknown> = {
  output: T;
  costUsd: number;
  latencyMs: number;
};

export interface Connector<I = unknown, O = unknown> {
  id: ConnectorId;
  kind: ConnectorKind;
  name: string;
  requiresApproval: boolean;
  scopes: string[];
  estimateCost(input: I): number;
  call(input: I, ctx: ConnectorContext): Promise<ConnectorResult<O>>;
}
