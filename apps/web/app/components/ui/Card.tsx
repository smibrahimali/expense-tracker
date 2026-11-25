import type { HTMLAttributes, ReactNode } from 'react';

export function Card({
  className = '',
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div
      className={`bg-[var(--ef-surface)]/90 border border-[var(--ef-border)] rounded-[var(--ef-radius-md)] shadow-[var(--ef-shadow-sm)] overflow-hidden backdrop-blur-sm ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  className = '',
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`px-5 pt-5 pb-3 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardBody({
  className = '',
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`px-5 pb-5 ${className}`} {...props}>
      {children}
    </div>
  );
}
