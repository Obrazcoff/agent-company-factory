import type { ReactNode } from 'react';
import { cn } from '@/../lib/cn';

type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger';

const tones: Record<Tone, string> = {
  neutral: 'bg-[var(--color-surface-2)] text-[var(--color-fg)] border-[var(--color-border)]',
  accent: 'bg-[var(--color-accent)]/15 text-[var(--color-accent)] border-[var(--color-accent)]/30',
  success: 'bg-[var(--color-success)]/15 text-[var(--color-success)] border-[var(--color-success)]/30',
  warning: 'bg-[var(--color-warning)]/15 text-[var(--color-warning)] border-[var(--color-warning)]/30',
  danger: 'bg-[var(--color-danger)]/15 text-[var(--color-danger)] border-[var(--color-danger)]/30',
};

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full border',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
