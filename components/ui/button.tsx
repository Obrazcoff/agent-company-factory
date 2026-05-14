'use client';
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/../lib/cn';

type Variant = 'default' | 'secondary' | 'ghost' | 'danger' | 'success';
type Size = 'sm' | 'md';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variants: Record<Variant, string> = {
  default: 'bg-[var(--color-accent)] text-black hover:opacity-90',
  secondary: 'bg-[var(--color-surface-2)] text-[var(--color-fg)] hover:bg-[var(--color-border)]',
  ghost: 'bg-transparent text-[var(--color-fg)] hover:bg-[var(--color-surface-2)]',
  danger: 'bg-[var(--color-danger)] text-black hover:opacity-90',
  success: 'bg-[var(--color-success)] text-black hover:opacity-90',
};

const sizes: Record<Size, string> = {
  sm: 'h-7 px-2.5 text-xs rounded-md',
  md: 'h-9 px-3.5 text-sm rounded-md',
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { className, variant = 'default', size = 'md', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 font-medium transition border border-transparent',
        'focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40',
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    />
  );
});
