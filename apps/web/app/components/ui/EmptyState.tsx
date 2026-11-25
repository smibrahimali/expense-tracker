import type { ReactNode } from 'react';
import { Inbox } from 'lucide-react';

export function EmptyState({
  icon,
  emoji,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  emoji?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center px-6 py-10">
      <div className="w-11 h-11 rounded-[var(--ef-radius-md)] bg-[var(--ef-gray-200)] border border-[var(--ef-border)] flex items-center justify-center text-[var(--ef-muted)] mb-3.5">
        {emoji ? (
          <span className="ef-emoji text-lg leading-none" aria-hidden>
            {emoji}
          </span>
        ) : (
          icon ?? <Inbox size={18} strokeWidth={1.5} />
        )}
      </div>
      <p className="text-sm font-medium text-[var(--ef-ink)]">{title}</p>
      {description ? (
        <p className="text-sm text-[var(--ef-muted)] mt-1 max-w-xs leading-relaxed">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
