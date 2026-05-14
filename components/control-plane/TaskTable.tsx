'use client';
import { Card, CardHeader, CardTitle, CardContent } from '@/../components/ui/card';
import { Badge } from '@/../components/ui/badge';
import { Button } from '@/../components/ui/button';
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
}: {
  tasks: Task[];
  agents: Agent[];
  onMutate: () => void;
  onApiError?: (message: string) => void;
}) {
  const agentName = (id: string) => {
    const a = agents.find((x) => x.id === id);
    return a ? (a.displayName ?? a.name) : id.slice(-6);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Task queue</CardTitle>
        <span className="text-xs text-[var(--color-muted)]">{tasks.length} tasks</span>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-[var(--color-muted)] text-xs uppercase tracking-wider">
              <tr>
                <th className="py-2 pr-3">Kind</th>
                <th className="py-2 pr-3">Agent</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Attempts</th>
                <th className="py-2 pr-3">Deps</th>
                <th className="py-2 pr-3">Last error</th>
                <th className="py-2 pr-3"></th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => (
                <tr key={t.id} className="border-t border-[var(--color-border)]">
                  <td className="py-2 pr-3 font-mono text-xs">{t.kind}</td>
                  <td className="py-2 pr-3">{agentName(t.agentId)}</td>
                  <td className="py-2 pr-3">
                    <Badge tone={statusTone(t.status)}>{t.status}</Badge>
                  </td>
                  <td className="py-2 pr-3 text-xs">
                    {t.attempts}/{t.maxAttempts}
                  </td>
                  <td className="py-2 pr-3 text-xs text-[var(--color-muted)]">
                    {t.dependsOn.length > 0 ? `${t.dependsOn.length} dep(s)` : '—'}
                  </td>
                  <td className="py-2 pr-3 text-xs text-[var(--color-danger)] max-w-[180px] truncate">
                    {t.lastError ?? ''}
                  </td>
                  <td className="py-2 pr-3 text-right">
                    {t.status === 'queued' || t.status === 'awaiting_approval' ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          try {
                            await apiClient.cancelTask(t.id);
                            onMutate();
                          } catch (e) {
                            onApiError?.(e instanceof Error ? e.message : String(e));
                          }
                        }}
                      >
                        Cancel
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
