'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchWithAuth } from '@/utils/api';
import { parseAmountToMinorUnits } from '@/utils/money-parser';

export default function SetupPage() {
  const router = useRouter();
  const [currency, setCurrency] = useState('PKR');
  const [timezone, setTimezone] = useState('Asia/Karachi');
  const [month, setMonth] = useState('2026-09');
  const [salary, setSalary] = useState('');
  
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      let salaryMinor = 0;
      if (salary) {
        salaryMinor = parseAmountToMinorUnits(salary);
      }

      // Sends the profile and salary setup to your NestJS backend
      await fetchWithAuth('/setup', {
        method: 'POST',
        body: JSON.stringify({
          currency_code: currency,
          timezone,
          month: `${month}-01`,
          salary_minor: salaryMinor,
        }),
      });

      router.push('/');
    } catch (err: any) {
      // Keeps the typed data on the screen and displays the error
      setError(err.message || 'Failed to complete setup');
      setIsLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-black text-white w-full max-w-[360px] mx-auto">
      <h1 className="text-xl font-bold mb-6 w-full uppercase tracking-wider text-center">First-Time Setup</h1>
      
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full">
        <div className="flex flex-col gap-1">
          <label className="text-sm text-gray-400">Currency</label>
          <select 
            value={currency} 
            onChange={(e) => setCurrency(e.target.value)}
            className="p-3 bg-gray-900 border border-gray-700 rounded focus:outline-none focus:border-blue-500"
          >
            <option value="PKR">PKR</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm text-gray-400">Timezone</label>
          <select 
            value={timezone} 
            onChange={(e) => setTimezone(e.target.value)}
            className="p-3 bg-gray-900 border border-gray-700 rounded focus:outline-none focus:border-blue-500"
          >
            <option value="Asia/Karachi">Asia/Karachi</option>
            <option value="UTC">UTC</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm text-gray-400">Month</label>
          <input 
            type="month" 
            value={month} 
            onChange={(e) => setMonth(e.target.value)}
            className="p-3 bg-gray-900 border border-gray-700 rounded focus:outline-none focus:border-blue-500"
            required
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm text-gray-400">Monthly salary (0 is allowed)</label>
          <input 
            type="text" 
            inputMode="decimal"
            value={salary} 
            onChange={(e) => setSalary(e.target.value)}
            placeholder="150000"
            className="p-3 bg-gray-900 border border-gray-700 rounded focus:outline-none focus:border-blue-500"
            required
          />
        </div>

        {error && <div className="text-red-400 text-sm mt-2">{error}</div>}

        <button 
          type="submit" 
          disabled={isLoading}
          className="mt-4 p-3 bg-blue-600 rounded text-white font-medium disabled:opacity-50"
        >
          {isLoading ? 'Saving...' : 'Continue'}
        </button>
      </form>
    </main>
  );
}