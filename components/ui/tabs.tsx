'use client';
import { type ReactNode } from 'react';
import { cn } from '@/../lib/cn';

export type Tab = { id: string; label: string; badge?: number };

export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: Tab[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1 border-b border-[var(--color-border)]">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={cn(
            '-mb-px border-b-2 px-4 py-3 text-base font-medium transition md:px-5 md:text-lg',
            active === t.id
              ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
              : 'border-transparent text-[var(--color-muted)] hover:text-[var(--color-fg)]',
          )}
        >
          {t.label}
          {typeof t.badge === 'number' && t.badge > 0 ? (
            <span className="ml-2 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-[var(--color-accent)]/20 px-2 py-0.5 text-xs font-semibold text-[var(--color-accent)]">
              {t.badge}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

export function TabPanel({
  active,
  value,
  children,
}: {
  active: string;
  value: string;
  children: ReactNode;
}) {
  if (active !== value) return null;
  return <div className="py-6 md:py-8">{children}</div>;
}
