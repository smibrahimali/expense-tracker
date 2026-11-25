import { Banknote, CreditCard, Building2 } from 'lucide-react';
import { Badge } from './Badge';

const LABELS: Record<string, string> = {
  cash: 'Cash',
  card: 'Card',
  bank: 'Bank',
  bank_transfer: 'Bank',
};

const ICONS: Record<string, typeof Banknote> = {
  cash: Banknote,
  card: CreditCard,
  bank: Building2,
  bank_transfer: Building2,
};

export function getPaymentLabel(method: string): string {
  return LABELS[method] ?? method;
}

export function PaymentBadge({ method }: { method?: string | null }) {
  if (!method) return <span className="text-[var(--ef-muted)] text-sm">—</span>;
  const Icon = ICONS[method] ?? Banknote;
  return (
    <Badge tone="neutral">
      <Icon size={12} strokeWidth={1.5} aria-hidden />
      {getPaymentLabel(method)}
    </Badge>
  );
}
