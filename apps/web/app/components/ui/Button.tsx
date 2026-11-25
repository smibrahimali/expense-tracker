'use client';

import { forwardRef, type ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'accent' | 'destructive';
type Size = 'sm' | 'md';

const variantClass: Record<Variant, string> = {
  primary:
    'bg-[var(--ef-ink)] text-[var(--ef-bg)] hover:opacity-92 border border-transparent shadow-[var(--ef-shadow-sm)]',
  secondary:
    'bg-white/5 text-[var(--ef-ink)] border border-[var(--ef-border)] hover:bg-white/10',
  ghost:
    'bg-transparent text-[var(--ef-gray-600)] border border-transparent hover:bg-white/5 hover:text-[var(--ef-ink)]',
  accent:
    'bg-[var(--ef-accent)] text-white hover:bg-[var(--ef-accent-hover)] border border-transparent shadow-[var(--ef-shadow-sm)]',
  destructive:
    'bg-[var(--ef-danger-muted)] text-[var(--ef-danger)] border border-transparent hover:bg-[rgba(248,113,113,0.18)]',
};

const sizeClass: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'min-h-11 h-11 px-4 text-sm gap-2',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className = '',
      variant = 'primary',
      size = 'md',
      loading,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`inline-flex items-center justify-center font-medium rounded-[var(--ef-radius-sm)] transition-[background-color,transform,opacity] duration-150 ease-out active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none cursor-pointer ${variantClass[variant]} ${sizeClass[size]} ${className}`}
        {...props}
      >
        {loading ? (
          <span
            className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"
            aria-hidden
          />
        ) : null}
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';
