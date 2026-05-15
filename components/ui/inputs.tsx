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
        'h-11 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 text-base',
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
          'min-h-[160px] w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4 text-base leading-relaxed',
          'focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40',
          className,
        )}
        {...rest}
      />
    );
  },
);
