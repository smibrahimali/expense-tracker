import type { ReactNode } from 'react';

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-xs font-medium text-[var(--ef-muted)] mb-1">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-2xl sm:text-[1.75rem] font-medium tracking-tight text-[var(--ef-ink)]">
          {title}
        </h1>
        {description ? (
          <p className="text-sm text-[var(--ef-muted)] mt-1.5 max-w-xl leading-relaxed">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0 flex items-center gap-2">{action}</div> : null}
    </div>
  );
}
