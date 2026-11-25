import type { HTMLAttributes, ReactNode } from 'react';

type Tone = 'neutral' | 'success' | 'danger' | 'warning' | 'accent';

const toneClass: Record<Tone, string> = {
  neutral: 'bg-[var(--ef-gray-100)] text-[var(--ef-gray-700)] border-[var(--ef-border)]',
  success: 'bg-[var(--ef-success-muted)] text-[var(--ef-success)] border-transparent',
  danger: 'bg-[var(--ef-danger-muted)] text-[var(--ef-danger)] border-transparent',
  warning: 'bg-[var(--ef-warning-muted)] text-[var(--ef-warning)] border-transparent',
  accent: 'bg-[var(--ef-accent-muted)] text-[var(--ef-accent-warm)] border-transparent',
};

export function Badge({
  tone = 'neutral',
  className = '',
  children,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-[var(--ef-radius-sm)] text-[11px] font-medium border ${toneClass[tone]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}
