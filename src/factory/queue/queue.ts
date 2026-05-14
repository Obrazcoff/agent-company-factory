import type { Task, TaskId, AgentRole, CompanyId } from '../domain/types';

const ROLE_PRIORITY: Record<AgentRole, number> = {
  CEO: 0,
  PM: 1,
  Researcher: 2,
  Outreach: 3,
  Ops: 4,
};

export type ReadyPredicate = (task: Task) => boolean;

export class TaskQueue {
  pickReady(
    tasks: Task[],
    companyId: CompanyId,
    isReady: ReadyPredicate,
    limit: number,
    rolesByAgent: Map<string, AgentRole>,
  ): Task[] {
    const candidates = tasks
      .filter((t) => t.companyId === companyId && t.status === 'queued' && isReady(t))
      .sort((a, b) => {
        const ra = rolesByAgent.get(a.agentId) ?? 'Ops';
        const rb = rolesByAgent.get(b.agentId) ?? 'Ops';
        const priorityDiff = ROLE_PRIORITY[ra] - ROLE_PRIORITY[rb];
        if (priorityDiff !== 0) return priorityDiff;
        return a.scheduledAt.localeCompare(b.scheduledAt);
      });
    return candidates.slice(0, limit);
  }

  hasCycle(allTasks: Task[], newDependsOn: TaskId[], newTaskId: TaskId): boolean {
    if (newDependsOn.length === 0) return false;
    const adj = new Map<TaskId, TaskId[]>();
    for (const t of allTasks) {
      adj.set(t.id, [...t.dependsOn]);
    }
    adj.set(newTaskId, [...newDependsOn]);

    const visiting = new Set<TaskId>();
    const visited = new Set<TaskId>();

    const dfs = (node: TaskId): boolean => {
      if (visiting.has(node)) return true;
      if (visited.has(node)) return false;
      visiting.add(node);
      for (const next of adj.get(node) ?? []) {
        if (dfs(next)) return true;
      }
      visiting.delete(node);
      visited.add(node);
      return false;
    };

    return dfs(newTaskId);
  }

  findDependents(allTasks: Task[], parentId: TaskId): Task[] {
    return allTasks.filter((t) => t.dependsOn.includes(parentId));
  }
}

export const queue = new TaskQueue();
