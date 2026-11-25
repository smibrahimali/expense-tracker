import { splitMoney } from '../../../utils/money';

export function Money({
  value,
  precise,
  showSign,
  className = '',
  tone = 'neutral',
}: {
  value: number | null | undefined;
  precise?: boolean;
  showSign?: boolean;
  className?: string;
  tone?: 'neutral' | 'expense' | 'income' | 'muted';
}) {
  const money = splitMoney(value);
  if (money.empty) {
    return <span className={`text-[var(--ef-gray-500)] ${className}`}>—</span>;
  }

  const toneClass =
    tone === 'income'
      ? 'text-[var(--ef-success)]'
      : tone === 'expense'
        ? 'text-[var(--ef-gray-900)]'
        : tone === 'muted'
          ? 'text-[var(--ef-muted)]'
          : 'text-[var(--ef-gray-900)]';

  const sign = showSign && value !== undefined && value !== null && value < 0 ? '−' : showSign && tone === 'expense' ? '−' : money.sign;

  // Re-format if precise needed
  const whole = precise
    ? Math.abs(value ?? 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : money.whole;

  return (
    <span className={`tabular-nums font-medium ${toneClass} ${className}`} data-money>
      <span className="text-[0.7em] font-normal text-[var(--ef-muted)] mr-1">
        {sign}
        {money.code}
      </span>
      {whole}
    </span>
  );
}
