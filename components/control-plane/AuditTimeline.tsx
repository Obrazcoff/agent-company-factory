'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/../components/ui/card';
import { Badge } from '@/../components/ui/badge';
import { useI18n } from '@/../components/i18n/LocaleProvider';
import type { AuditEvent } from '@/factory/domain/types';

const KIND_TONE: Record<string, 'accent' | 'success' | 'warning' | 'danger' | 'neutral'> = {
  'company.created': 'accent',
  'agent.hired': 'accent',
  'task.enqueued': 'neutral',
  'run.started': 'accent',
  'tool.called': 'neutral',
  'task.done': 'success',
  'task.failed': 'danger',
  'task.dead_letter': 'danger',
  'task.cancelled': 'warning',
  'task.cancelled_cascade': 'warning',
  'approval.requested': 'warning',
  'approval.decided': 'success',
  'approval.expired': 'danger',
  'budget.exceeded': 'danger',
  'company.killed': 'danger',
  'company.paused': 'warning',
  'agent.paused': 'warning',
  'run.timeout': 'warning',
  'run.stale_recovered': 'warning',
  'run.call_cap_exceeded': 'danger',
  'action.executed': 'success',
};

export function AuditTimeline({ audits }: { audits: AuditEvent[] }) {
  const { t } = useI18n();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('audit.title')}</CardTitle>
        <span className="text-xs text-[var(--color-muted)]">
          {t('audit.events', { count: String(audits.length) })}
        </span>
      </CardHeader>
      <CardContent>
        <div className="space-y-1.5 max-h-[480px] overflow-y-auto pr-1">
          {audits.slice(0, 200).map((e) => (
            <div
              key={e.id}
              className="flex items-start gap-2 text-xs border-b border-[var(--color-border)]/50 pb-1.5"
            >
              <span className="text-[var(--color-muted)] font-mono w-20 shrink-0">
                {new Date(e.ts).toLocaleTimeString()}
              </span>
              <Badge tone={KIND_TONE[e.kind] ?? 'neutral'}>{e.kind}</Badge>
              <span className="text-[var(--color-muted)]">{e.actor}</span>
              <span className="text-[var(--color-fg)]/80 font-mono truncate">
                {Object.entries(e.payload)
                  .slice(0, 4)
                  .map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
                  .join(' ')}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
