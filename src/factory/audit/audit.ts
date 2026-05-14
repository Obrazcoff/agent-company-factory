import { db } from '../store/db';
import { bus } from '../events/bus';
import type { FactoryEventKind } from '../events/types';
import { newId, nowIso } from '../domain/ids';
import type { AuditActor, AuditEvent, CompanyId } from '../domain/types';

export type AppendArgs = {
  companyId: CompanyId;
  kind: FactoryEventKind;
  actor: AuditActor;
  actorId?: string;
  payload?: Record<string, unknown>;
};

export function appendAudit(args: AppendArgs): AuditEvent {
  const event: AuditEvent = {
    id: newId('aud'),
    companyId: args.companyId,
    ts: nowIso(),
    actor: args.actor,
    actorId: args.actorId,
    kind: args.kind,
    payload: args.payload ?? {},
  };
  db().audits.create(event);
  bus().publish({
    kind: args.kind,
    companyId: args.companyId,
    ts: event.ts,
    payload: event.payload,
  });
  return event;
}

export function listAudits(companyId: CompanyId): AuditEvent[] {
  return db()
    .audits.all({ companyId })
    .sort((a, b) => b.ts.localeCompare(a.ts));
}
