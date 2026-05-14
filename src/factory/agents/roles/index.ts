import type { AgentRole } from '../../domain/types';
import type { RoleHandler } from '../runtime';
import { researcherHandler } from './researcher';
import { outreachHandler } from './outreach';
import { opsHandler } from './ops';
import { pmHandler } from './pm';

export const roleHandlers: Partial<Record<AgentRole, RoleHandler>> = {
  PM: pmHandler,
  CEO: pmHandler,
  Researcher: researcherHandler,
  Outreach: outreachHandler,
  Ops: opsHandler,
};
