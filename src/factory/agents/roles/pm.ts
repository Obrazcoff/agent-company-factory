import type { RoleHandler } from '../runtime';

export const pmHandler: RoleHandler = async (ctx) => {
  ctx.emit('plan', 'completed', 'PM acknowledges task and lets specialist agents handle it', {
    kind: ctx.task.kind,
  });
  return { output: { acknowledged: true, kind: ctx.task.kind } };
};
