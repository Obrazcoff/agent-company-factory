import type { Connector } from './types';
import type { ConnectorId, ConnectorMeta } from '../domain/types';
import { webSearchConnector } from './mocks/webSearch';
import { gmailDraftConnector, gmailSendConnector } from './mocks/gmail';
import { sheetsConnector } from './mocks/sheets';
import { crmConnector } from './mocks/crm';
import { calendarConnector } from './mocks/calendar';

const ALL: Connector[] = [
  webSearchConnector as Connector,
  gmailDraftConnector as Connector,
  gmailSendConnector as Connector,
  sheetsConnector as Connector,
  crmConnector as Connector,
  calendarConnector as Connector,
];

export function listConnectors(): Connector[] {
  return ALL;
}

export function getConnector(id: ConnectorId): Connector | undefined {
  return ALL.find((c) => c.id === id);
}

export function requireConnector(id: ConnectorId): Connector {
  const c = getConnector(id);
  if (!c) throw new Error(`unknown connector: ${id}`);
  return c;
}

export function listConnectorMeta(): ConnectorMeta[] {
  return ALL.map((c) => ({
    id: c.id,
    kind: c.kind,
    name: c.name,
    requiresApproval: c.requiresApproval,
    scopes: c.scopes,
    secretsRef: `vault://factory/${c.id}`,
  }));
}
