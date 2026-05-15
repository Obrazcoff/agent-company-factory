'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/../components/ui/card';
import { Badge } from '@/../components/ui/badge';
import { useI18n } from '@/../components/i18n/LocaleProvider';
import type { Company } from '@/factory/domain/types';

export function BlueprintCard({ company }: { company: Company }) {
  const { t } = useI18n();
  const budget = company.budget;
  const pct = Math.min(100, Math.round((budget.spentTodayUsd / budget.dailyCapUsd) * 100));
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('blueprint.title')}</CardTitle>
        <Badge tone={company.status === 'active' ? 'success' : 'warning'}>{company.status}</Badge>
      </CardHeader>
      <CardContent>
        <p className="leading-relaxed text-[var(--color-fg)] mb-3">{company.mission}</p>
        <div className="flex flex-wrap gap-2 mb-3">
          {company.kpis.map((k) => (
            <Badge key={k.name} tone="accent">
              {k.name}: {String(k.target)}
              {k.unit ? ` ${k.unit}` : ''}
            </Badge>
          ))}
        </div>
        <div className="text-sm text-[var(--color-muted)] mb-2 md:text-base">
          {t('blueprint.spent', {
            spent: budget.spentTodayUsd.toFixed(3),
            daily: budget.dailyCapUsd.toFixed(2),
            hard: budget.hardCapUsd.toFixed(2),
          })}
        </div>
        <div className="h-2 w-full rounded-full bg-[var(--color-surface-2)] overflow-hidden">
          <div className="h-full bg-[var(--color-accent)] transition-all" style={{ width: `${pct}%` }} />
        </div>
      </CardContent>
    </Card>
  );
}
