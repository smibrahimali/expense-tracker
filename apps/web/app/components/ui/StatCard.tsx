'use client';

import type { ReactNode } from 'react';
import { splitMoney } from '../../../utils/money';

export function StatCard({
  label,
  value,
  secondary,
  progress,
  empty,
}: {
  label: string;
  /** Major-unit amount, or null for empty */
  value: number | null;
  secondary?: ReactNode;
  /** 0–100 progress bar */
  progress?: number | null;
  empty?: boolean;
}) {
  const money = empty || value === null ? null : splitMoney(value);

  return (
    <div className="bg-[var(--ef-surface)] border border-[var(--ef-border)] rounded-[var(--ef-radius-md)] shadow-[var(--ef-shadow-sm)] p-5 flex flex-col gap-2.5 min-h-[120px]">
      <p className="text-xs font-medium text-[var(--ef-gray-600)] tracking-wide">
        <span className="ef-emoji">{label}</span>
      </p>
      {money && !money.empty ? (
        <p className="text-2xl font-semibold tracking-tight text-[var(--ef-ink)] tabular-nums leading-none" data-money>
          <span className="text-sm font-medium text-[var(--ef-muted)] mr-1.5 align-baseline">
            {money.sign}
            {money.code}
          </span>
          {money.whole}
        </p>
      ) : (
        <p className="text-2xl font-medium tracking-tight text-[var(--ef-gray-500)]">—</p>
      )}
      {secondary ? <div className="text-xs text-[var(--ef-muted)] mt-auto leading-relaxed">{secondary}</div> : null}
      {typeof progress === 'number' ? (
        <div className="h-1.5 rounded-full bg-[var(--ef-gray-200)] overflow-hidden mt-0.5">
          <div
            className="h-full rounded-full bg-[var(--ef-accent)] transition-[width] duration-300 ease-out"
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}
