'use client';
import { Card, CardHeader, CardTitle, CardContent } from '@/../components/ui/card';
import { Badge } from '@/../components/ui/badge';
import { Button } from '@/../components/ui/button';
import { AgentAvatar } from '@/../components/AgentAvatar';
import { useI18n } from '@/../components/i18n/LocaleProvider';
import { apiClient } from '@/../lib/api-client';
import type { Agent } from '@/factory/domain/types';

const ROLE_ORDER: Agent['role'][] = ['CEO', 'PM', 'Researcher', 'Outreach', 'Ops'];

function tone(status: Agent['status']) {
  if (status === 'busy') return 'accent' as const;
  if (status === 'paused') return 'warning' as const;
  return 'neutral' as const;
}

export function OrgChart({
  agents,
  onMutate,
  onApiError,
}: {
  agents: Agent[];
  onMutate: () => void;
  onApiError?: (message: string) => void;
}) {
  const { t } = useI18n();
  const grouped = ROLE_ORDER.map((role) => ({
    role,
    agents: agents.filter((a) => a.role === role),
  })).filter((g) => g.agents.length > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('org.title')}</CardTitle>
        <span className="text-xs text-[var(--color-muted)]">
          {t('org.agents', { count: String(agents.length) })}
        </span>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {grouped.map((g) => (
            <div key={g.role} className="space-y-2">
              <div className="text-xs uppercase tracking-wider text-[var(--color-muted)]">{g.role}</div>
              {g.agents.map((a) => (
                <div
                  key={a.id}
                  className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3"
                >
                  <div className="flex gap-2 mb-1.5">
                    <AgentAvatar
                      slug={a.avatarSlug}
                      className="h-9 w-9 shrink-0 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] object-contain p-0.5"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-sm font-medium truncate">{a.displayName}</span>
                        <Badge tone={tone(a.status)}>{a.status}</Badge>
                      </div>
                      <div className="text-[10px] text-[var(--color-muted)] truncate">{a.name}</div>
                    </div>
                  </div>
                  <div className="text-[11px] text-[var(--color-muted)] mb-2">
                    {t('org.spent', { amount: a.costToDateUsd.toFixed(3) })}
                  </div>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {a.permissions.map((p) => (
                      <span
                        key={p}
                        className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono rounded bg-[var(--color-bg)] text-[var(--color-muted)] border border-[var(--color-border)]"
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      try {
                        await apiClient.pauseAgent(a.id, a.status !== 'paused');
                        onMutate();
                      } catch (e) {
                        onApiError?.(e instanceof Error ? e.message : String(e));
                      }
                    }}
                  >
                    {a.status === 'paused' ? t('org.resume') : t('org.pause')}
                  </Button>
                </div>
              ))}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
