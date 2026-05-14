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
    <div className="flex gap-1 border-b border-[var(--color-border)]">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            'px-3 py-2 text-sm font-medium border-b-2 transition -mb-[1px]',
            active === t.id
              ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
              : 'border-transparent text-[var(--color-muted)] hover:text-[var(--color-fg)]',
          )}
        >
          {t.label}
          {typeof t.badge === 'number' && t.badge > 0 ? (
            <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-[var(--color-accent)]/20 text-[var(--color-accent)] text-[10px] font-semibold px-1.5 py-0.5">
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
  return <div className="py-4">{children}</div>;
}
