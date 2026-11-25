const currencyFormatter = new Intl.NumberFormat('en-PK', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const currencyFormatterPrecise = new Intl.NumberFormat('en-PK', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Format a major-unit amount as digits only, e.g. "78,042". */
export function formatAmount(value: number, precise = false): string {
  const abs = Math.abs(value);
  return (precise ? currencyFormatterPrecise : currencyFormatter).format(abs);
}

/** Format as "PKR 78,042" with optional sign. Returns "—" when value is nullish/missing. */
export function formatMoney(
  value: number | null | undefined,
  opts?: { precise?: boolean; showSign?: boolean; empty?: string }
): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return opts?.empty ?? '—';
  }
  const sign = opts?.showSign && value < 0 ? '−' : '';
  return `${sign}PKR ${formatAmount(value, opts?.precise)}`;
}

/** Split for UI that styles currency code separately. */
export function splitMoney(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return { sign: '', code: 'PKR', whole: '—', empty: true as const };
  }
  return {
    sign: value < 0 ? '−' : '',
    code: 'PKR',
    whole: formatAmount(value),
    empty: false as const,
  };
}

/** Abbreviate for chart axes: 10k, 50k, 1.2M */
export function abbreviateAmount(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(abs >= 10_000 ? 0 : 1).replace(/\.0$/, '')}k`;
  return formatAmount(value);
}
