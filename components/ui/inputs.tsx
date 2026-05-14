'use client';
import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/../lib/cn';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cn(
        'h-9 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 text-sm',
        'focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40',
        className,
      )}
      {...rest}
    />
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...rest }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn(
          'min-h-[120px] w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3 text-sm font-mono leading-relaxed',
          'focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40',
          className,
        )}
        {...rest}
      />
    );
  },
);
