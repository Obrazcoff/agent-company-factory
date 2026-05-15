'use client';
import { Card, CardHeader, CardTitle, CardContent } from '@/../components/ui/card';
import { Badge } from '@/../components/ui/badge';
import { Button } from '@/../components/ui/button';
import { useI18n } from '@/../components/i18n/LocaleProvider';
import { apiClient } from '@/../lib/api-client';
import type { Approval } from '@/factory/domain/types';

function approvalTone(s: Approval['status']) {
  if (s === 'approved') return 'success' as const;
  if (s === 'rejected') return 'danger' as const;
  if (s === 'expired') return 'warning' as const;
  return 'accent' as const;
}

export function ApprovalsList({
  approvals,
  onMutate,
  onApiError,
}: {
  approvals: Approval[];
  onMutate: () => void;
  onApiError?: (message: string) => void;
}) {
  const { t } = useI18n();
  const pending = approvals.filter((a) => a.status === 'pending').length;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('approvals.title')}</CardTitle>
        <span className="text-xs text-[var(--color-muted)]">
          {t('approvals.pending', { count: String(pending) })}
        </span>
      </CardHeader>
      <CardContent>
        {approvals.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">{t('approvals.empty')}</p>
        ) : (
          <>
            <div className="space-y-2">
              {approvals.map((a) => (
                <div
                  key={a.id}
                  className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3"
                >
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      <Badge tone={approvalTone(a.status)}>{a.status}</Badge>
                      <span className="text-xs font-mono text-[var(--color-muted)]">
                        {a.action.connectorId}
                      </span>
                    </div>
                    {a.status === 'pending' && (
                      <div className="flex gap-2">
                        <Button
                          variant="success"
                          size="sm"
                          onClick={async () => {
                            try {
                              await apiClient.decideApproval(a.id, 'approved');
                              onMutate();
                            } catch (e) {
                              onApiError?.(e instanceof Error ? e.message : String(e));
                            }
                          }}
                        >
                          {t('approvals.approve')}
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={async () => {
                            try {
                              await apiClient.decideApproval(a.id, 'rejected');
                              onMutate();
                            } catch (e) {
                              onApiError?.(e instanceof Error ? e.message : String(e));
                            }
                          }}
                        >
                          {t('approvals.reject')}
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className="text-sm mb-1.5">{a.action.description}</div>
                  <pre className="text-[11px] font-mono bg-[var(--color-bg)] border border-[var(--color-border)] rounded p-2 overflow-x-auto max-h-32">
                    {JSON.stringify(a.action.payload, null, 2)}
                  </pre>
                  <div className="text-[10px] text-[var(--color-muted)] mt-1.5">
                    {t('approvals.requested')} {new Date(a.requestedAt).toLocaleTimeString()} ·{' '}
                    {t('approvals.deadline')} {new Date(a.deadlineAt).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4 border-t border-[var(--color-border)] pt-4 text-sm leading-relaxed text-[var(--color-muted)]">
              {t('approvals.afterApprove')}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
