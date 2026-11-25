'use client';

import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button } from './Button';

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[rgba(8,7,6,0.72)] backdrop-blur-sm"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ef-dialog-title"
        className="bg-[var(--ef-surface-elevated)] border border-[var(--ef-border)] shadow-[var(--ef-shadow-md)] rounded-[var(--ef-radius-md)] p-6 max-w-sm w-full ef-animate-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h3 id="ef-dialog-title" className="text-base font-medium tracking-tight text-[var(--ef-gray-900)]">
              {title}
            </h3>
            {description ? (
              <p className="text-sm text-[var(--ef-muted)] mt-1.5 leading-relaxed">{description}</p>
            ) : null}
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close dialog" className="!px-2 shrink-0">
            <X size={16} strokeWidth={1.5} />
          </Button>
        </div>
        {children}
        {footer ? <div className="flex gap-2 mt-5">{footer}</div> : null}
      </div>
    </div>
  );
}
