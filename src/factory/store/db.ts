import { Repository } from './repository';
import type {
  Agent,
  Approval,
  AuditEvent,
  Company,
  CompanyProposal,
  Memory,
  Run,
  Task,
} from '../domain/types';

export type FactoryDb = {
  companies: Repository<Company>;
  agents: Repository<Agent>;
  tasks: Repository<Task>;
  runs: Repository<Run>;
  approvals: Repository<Approval>;
  audits: Repository<AuditEvent>;
  memories: Repository<Memory>;
  proposals: Repository<CompanyProposal>;
};

let instance: FactoryDb | null = null;

/**
 * Меняется при каждом новом синглтоне репозиториев (cold start, resetDb(), частый случай — HMR
 * пересобрал `db.ts` и обнулил `instance`, пока другой чанк ещё держит старый «boot»).
 * Клиент сравнивает с sessionStorage — не подставлять company id от «пустой» памяти.
 */
let storageEpoch: string | null = null;

export function getStorageEpoch(): string {
  db();
  return storageEpoch as string;
}

export function db(): FactoryDb {
  if (!instance) {
    storageEpoch =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `epoch_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    instance = {
      companies: new Repository<Company>(),
      agents: new Repository<Agent>(),
      tasks: new Repository<Task>(),
      runs: new Repository<Run>(),
      approvals: new Repository<Approval>(),
      audits: new Repository<AuditEvent>(),
      memories: new Repository<Memory>(),
      proposals: new Repository<CompanyProposal>(),
    };
  }
  return instance;
}

export function resetDb(): void {
  instance = null;
}
