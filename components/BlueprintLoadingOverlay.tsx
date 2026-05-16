'use client';

import { useEffect, useState } from 'react';
import type { Locale } from '@/i18n/constants';
import { createNoRepeatPhrasePicker } from '@/lib/blueprint-loading-phrases';

type Props = {
  open: boolean;
  locale: Locale;
  title: string;
  subtitle?: string;
  /** Server-reported stage (preflight / streaming / JSON wait). */
  progressDetail?: string | null;
};

const MIN_MS = 2200;
const MAX_MS = 3800;

export function BlueprintLoadingOverlay({ open, locale, title, subtitle, progressDetail }: Props) {
  const [phrase, setPhrase] = useState('');

  useEffect(() => {
    if (!open) return;
    const picker = createNoRepeatPhrasePicker(locale);
    let cancelled = false;
    let tid: ReturnType<typeof setTimeout>;

    const loop = () => {
      tid = setTimeout(
        () => {
          if (cancelled) return;
          setPhrase(picker());
          loop();
        },
        MIN_MS + Math.random() * (MAX_MS - MIN_MS),
      );
    };

    tid = setTimeout(() => {
      if (cancelled) return;
      setPhrase(picker());
      loop();
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(tid);
    };
  }, [open, locale]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-[oklch(0.12_0.02_260/0.72)] px-4 backdrop-blur-sm"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 shadow-[0_24px_80px_oklch(0.05_0.03_260/0.55)] md:max-w-lg md:p-10">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full border-2 border-[var(--color-accent)] border-t-transparent animate-spin md:h-16 md:w-16" />
        <h2 className="text-center text-lg font-semibold tracking-tight text-[var(--color-fg)] md:text-xl">
          {title}
        </h2>
        {subtitle ? (
          <p className="mt-2 text-center text-sm text-[var(--color-muted)] md:text-base">{subtitle}</p>
        ) : null}
        {progressDetail ? (
          <p className="mt-3 rounded-lg border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 px-3 py-2 text-center text-xs font-medium text-[var(--color-fg)] md:text-sm">
            {progressDetail}
          </p>
        ) : null}
        <p className="mt-6 min-h-[3.5rem] text-center text-base leading-relaxed text-[var(--color-fg)] md:min-h-[4rem] md:text-lg">
          {phrase}
        </p>
      </div>
    </div>
  );
}
