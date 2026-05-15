'use client';
import type { ReactNode } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/../components/ui/card';
import { Badge } from '@/../components/ui/badge';
import { Button } from '@/../components/ui/button';
import { useI18n } from '@/../components/i18n/LocaleProvider';
import { apiClient } from '@/../lib/api-client';
import type { Agent, Task } from '@/factory/domain/types';

function statusTone(s: Task['status']) {
  switch (s) {
    case 'done':
      return 'success' as const;
    case 'failed':
      return 'danger' as const;
    case 'running':
      return 'accent' as const;
    case 'awaiting_approval':
      return 'warning' as const;
    case 'cancelled':
      return 'neutral' as const;
    default:
      return 'neutral' as const;
  }
}

export function TaskTable({
  tasks,
  agents,
  onMutate,
  onApiError,
  footer,
}: {
  tasks: Task[];
  agents: Agent[];
  onMutate: () => void;
  onApiError?: (message: string) => void;
  footer?: ReactNode;
}) {
  const { t } = useI18n();
  const agentName = (id: string) => {
    const a = agents.find((x) => x.id === id);
    return a ? (a.displayName ?? a.name) : id.slice(-6);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('taskTable.title')}</CardTitle>
        <span className="text-xs text-[var(--color-muted)]">
          {t('taskTable.tasksCount', { count: String(tasks.length) })}
        </span>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-[var(--color-muted)] text-xs uppercase tracking-wider">
              <tr>
                <th className="py-2 pr-3">{t('taskTable.kind')}</th>
                <th className="py-2 pr-3">{t('taskTable.agent')}</th>
                <th className="py-2 pr-3">{t('taskTable.status')}</th>
                <th className="py-2 pr-3">{t('taskTable.attempts')}</th>
                <th className="py-2 pr-3">{t('taskTable.deps')}</th>
                <th className="py-2 pr-3">{t('taskTable.lastError')}</th>
                <th className="py-2 pr-3"></th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task.id} className="border-t border-[var(--color-border)]">
                  <td className="py-2 pr-3 font-mono text-xs">{task.kind}</td>
                  <td className="py-2 pr-3">{agentName(task.agentId)}</td>
                  <td className="py-2 pr-3">
                    <Badge tone={statusTone(task.status)}>{task.status}</Badge>
                  </td>
                  <td className="py-2 pr-3 text-xs">
                    {task.attempts}/{task.maxAttempts}
                  </td>
                  <td className="py-2 pr-3 text-xs text-[var(--color-muted)]">
                    {task.dependsOn.length > 0
                      ? t('taskTable.depsCount', { n: String(task.dependsOn.length) })
                      : t('common.dash')}
                  </td>
                  <td className="py-2 pr-3 text-xs text-[var(--color-danger)] max-w-[180px] truncate">
                    {task.lastError ?? ''}
                  </td>
                  <td className="py-2 pr-3 text-right">
                    {task.status === 'queued' || task.status === 'awaiting_approval' ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          try {
                            await apiClient.cancelTask(task.id);
                            onMutate();
                          } catch (e) {
                            onApiError?.(e instanceof Error ? e.message : String(e));
                          }
                        }}
                      >
                        {t('common.cancel')}
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {footer}
      </CardContent>
    </Card>
  );
}
