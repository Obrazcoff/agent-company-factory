'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/../components/ui/card';
import { useI18n } from '@/../components/i18n/LocaleProvider';
import type { Company } from '@/factory/domain/types';

export function CostPanel({
  company,
  costByAgent,
}: {
  company: Company;
  costByAgent: Array<{ agentId: string; name: string; role: string; costUsd: number }>;
}) {
  const { t } = useI18n();
  const total = costByAgent.reduce((sum, a) => sum + a.costUsd, 0);
  const max = Math.max(0.0001, ...costByAgent.map((a) => a.costUsd));
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('cost.title')}</CardTitle>
        <span className="text-xs text-[var(--color-muted)]">
          {t('cost.spentLine', {
            spent: company.budget.spentTodayUsd.toFixed(3),
            daily: company.budget.dailyCapUsd.toFixed(2),
          })}
        </span>
      </CardHeader>
      <CardContent>
        <div className="space-y-1.5">
          {costByAgent.map((a) => (
            <div key={a.agentId} className="flex items-center gap-2 text-xs">
              <span className="w-32 truncate">
                <span className="text-[var(--color-muted)]">[{a.role}]</span> {a.name}
              </span>
              <div className="flex-1 h-1.5 rounded-full bg-[var(--color-surface-2)] overflow-hidden">
                <div
                  className="h-full bg-[var(--color-accent)]"
                  style={{ width: `${Math.round((a.costUsd / max) * 100)}%` }}
                />
              </div>
              <span className="font-mono w-16 text-right">${a.costUsd.toFixed(3)}</span>
            </div>
          ))}
          <div className="flex items-center gap-2 text-xs pt-2 border-t border-[var(--color-border)]/50">
            <span className="w-32 font-medium">{t('cost.total')}</span>
            <div className="flex-1" />
            <span className="font-mono w-16 text-right font-semibold">${total.toFixed(3)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
