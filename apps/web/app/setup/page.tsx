'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../utils/client';
import { parseAmountToMinorUnits } from '../../utils/money-parser';

function currentMonthInput() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export default function SetupPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [currency, setCurrency] = useState('PKR');
  const [timezone, setTimezone] = useState('Asia/Karachi');
  const [month, setMonth] = useState(currentMonthInput);
  const [salary, setSalary] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    setIsLoading(true);
    setError(null);

    try {
      const {
        data: { user },
        error: authErr,
      } = await supabase.auth.getUser();
      if (authErr || !user) throw new Error('Please sign in first.');

      let salaryMinor = 0;
      if (salary.trim()) {
        salaryMinor = parseAmountToMinorUnits(salary.trim());
      }

      const monthDate = `${month}-01`;

      const { error: profileErr } = await supabase.from('profiles').upsert(
        {
          user_id: user.id,
          currency_code: currency,
          timezone,
        },
        { onConflict: 'user_id' }
      );
      if (profileErr) throw new Error(profileErr.message);

      const { error: salaryErr } = await supabase.from('monthly_salaries').upsert(
        {
          user_id: user.id,
          month: monthDate,
          amount_minor: salaryMinor,
        },
        { onConflict: 'user_id,month' }
      );
      if (salaryErr) throw new Error(salaryErr.message);

      router.push('/');
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to complete setup');
      setIsLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-[var(--ef-bg)] text-[var(--ef-ink)] w-full max-w-[360px] mx-auto">
      <h1 className="text-xl font-semibold mb-6 w-full tracking-tight text-center">First-time setup</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-[var(--ef-muted)]">Currency</label>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="ef-input"
          >
            <option value="PKR">PKR</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-[var(--ef-muted)]">Timezone</label>
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="ef-input"
          >
            <option value="Asia/Karachi">Asia/Karachi</option>
            <option value="UTC">UTC</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-[var(--ef-muted)]">Month</label>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="ef-input"
            required
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-[var(--ef-muted)]">Monthly salary (required, can be 0)</label>
          <input
            type="text"
            inputMode="decimal"
            value={salary}
            onChange={(e) => setSalary(e.target.value)}
            placeholder="150000"
            className="ef-input"
            required
          />
        </div>

        {error && (
          <div role="alert" className="text-[var(--ef-danger)] text-sm mt-1">
            {error}
          </div>
        )}

        <button type="submit" disabled={isLoading} className="ef-btn-accent mt-2 w-full disabled:opacity-50">
          {isLoading ? 'Saving…' : 'Continue'}
        </button>
      </form>
    </main>
  );
}
