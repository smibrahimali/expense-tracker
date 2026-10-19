'use client';
import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { createClient } from '../../utils/client';
import { useRouter } from 'next/navigation';
import {
  BarChart,
  Bar,
  XAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

const todayLocal = () => {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
};

export default function Dashboard({ userId }: { userId: string }) {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);

  // Salary State
  const [salary, setSalary] = useState<number>(0);
  const [totalHistoricalSalary, setTotalHistoricalSalary] = useState<number>(0);
  const [isEditingSalary, setIsEditingSalary] = useState(false);
  const [salaryInput, setSalaryInput] = useState('');

  // Add Expense State
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [note, setNote] = useState('');
  const [expenseDate, setExpenseDate] = useState(todayLocal());
  const [paymentMethod, setPaymentMethod] = useState('cash'); // NEW

  // Edit Expense State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editCategoryId, setEditCategoryId] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editPaymentMethod, setEditPaymentMethod] = useState('cash'); // NEW

  // Category Management State
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  const [timeFilter, setTimeFilter] = useState<'all' | 'month'>('month');
  const [formError, setFormError] = useState<string | null>(null);
  const amountInputRef = useRef<HTMLInputElement>(null);
  
  const supabase = createClient();
  const router = useRouter();

  // Sign Out Handler
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  // Helper to format numbers with commas
  const formatMoney = (val: number) => {
    return val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Helper to split whole numbers and decimals like the reference UI ($1,842.56)
  const splitMoney = (val: number) => {
    const abs = Math.abs(val);
    const formatted = abs.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    const [whole, dec] = formatted.split('.');
    return {
      sign: val < 0 ? '-' : '',
      whole: whole || '0',
      dec: dec || '00',
    };
  };

  // Timezone-safe date formatter
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const datePart = dateStr.split('T')[0];
    const [y, m, d] = datePart.split('-');
    return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  useEffect(() => {
    // Fetch Categories
    supabase
      .from('categories')
      .select('*')
      .eq('user_id', userId)
      .then(({ data }) => {
        if (data && data.length > 0) {
          setCategories(data);
          setCategoryId(data[0].id);
        }
      });

    // Fetch All Historical Salaries
    const now = new Date();
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

    supabase
      .from('monthly_salaries')
      .select('month, amount_minor')
      .eq('user_id', userId)
      .then(({ data }) => {
        if (data) {
          let currentSal = 0;
          let totalSal = 0;
          data.forEach((item) => {
            const val = item.amount_minor / 100;
            totalSal += val;
            if (item.month === currentMonthStr) {
              currentSal = val;
            }
          });
          setSalary(currentSal);
          setTotalHistoricalSalary(totalSal);
        } else {
          setSalary(0);
          setTotalHistoricalSalary(0);
        }
      });

    // Fetch Expenses
    supabase
      .from('expenses')
      .select('*')
      .eq('user_id', userId)
      .order('spent_on', { ascending: false })
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          console.error('Failed to fetch expenses:', error);
          setExpenses([]);
          return;
        }
        setExpenses(Array.isArray(data) ? data : []);
      });
  }, [userId, supabase]);

  const handleSaveSalary = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const amountMinor = Math.round(parseFloat(salaryInput) * 100);
    if (!Number.isFinite(amountMinor) || amountMinor < 0) {
      setFormError('Enter a valid salary amount (0 or more).');
      return;
    }

    const now = new Date();
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

    const { data: existing } = await supabase
      .from('monthly_salaries')
      .select('id')
      .eq('user_id', userId)
      .eq('month', currentMonthStr)
      .single();

    if (existing) {
      const { error } = await supabase
        .from('monthly_salaries')
        .update({ amount_minor: amountMinor })
        .eq('id', existing.id);
      if (error) {
        setFormError(error.message);
        return;
      }
    } else {
      const { error } = await supabase
        .from('monthly_salaries')
        .insert([{ user_id: userId, month: currentMonthStr, amount_minor: amountMinor }]);
      if (error) {
        setFormError(error.message);
        return;
      }
    }

    const newSalaryVal = amountMinor / 100;
    const difference = newSalaryVal - salary;
    setTotalHistoricalSalary((prev) => prev + difference);
    setSalary(newSalaryVal);
    setIsEditingSalary(false);
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!categoryId) {
      setFormError('Create or select a category first.');
      return;
    }

    const amountMinor = Math.round(parseFloat(amount) * 100);
    if (!Number.isFinite(amountMinor) || amountMinor <= 0) {
      setFormError('Enter an amount greater than 0.');
      return;
    }

    const { data: newExpense, error } = await supabase
      .from('expenses')
      .insert([
        {
          user_id: userId,
          category_id: categoryId,
          amount_minor: amountMinor,
          spent_on: expenseDate,
          note: note || null,
          payment_method: paymentMethod, // NEW
        },
      ])
      .select()
      .single();

    if (error || !newExpense) {
      console.error('Failed to add expense:', error);
      setFormError(error?.message || 'Failed to add expense.');
      return;
    }

    setExpenses([newExpense, ...expenses]);
    setAmount('');
    setNote('');
    setPaymentMethod('cash'); // Reset
    setExpenseDate(todayLocal());
  };

  const handleDeleteExpense = async (id: string) => {
    const previous = expenses;
    setExpenses(expenses.filter((exp) => exp.id !== id));
    const { error } = await supabase.from('expenses').delete().eq('id', id).eq('user_id', userId);
    if (error) {
      console.error('Failed to delete expense:', error);
      setExpenses(previous);
      setFormError(error.message);
    }
  };

  const handleEditClick = (exp: any) => {
    setEditingId(exp.id);
    setEditAmount((exp.amount_minor / 100).toString());
    setEditCategoryId(exp.category_id);
    setEditNote(exp.note || '');
    setEditDate(exp.spent_on);
    setEditPaymentMethod(exp.payment_method || 'cash'); // NEW
  };

  const handleSaveEdit = async (id: string) => {
    const amountMinor = Math.round(parseFloat(editAmount) * 100);
    if (!Number.isFinite(amountMinor) || amountMinor <= 0) {
      setFormError('Enter an amount greater than 0.');
      return;
    }

    const { data: updatedExpense, error } = await supabase
      .from('expenses')
      .update({
        category_id: editCategoryId,
        amount_minor: amountMinor,
        note: editNote || null,
        spent_on: editDate,
        payment_method: editPaymentMethod, // NEW
      })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error || !updatedExpense) {
      console.error('Failed to update expense:', error);
      setFormError(error?.message || 'Failed to update expense.');
      return;
    }

    setExpenses(expenses.map((exp) => (exp.id === id ? { ...exp, ...updatedExpense } : exp)));
    setEditingId(null);
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const color = '#C83713';

    const { data, error } = await supabase
      .from('categories')
      .insert([{ name: newCategoryName, user_id: userId, color }])
      .select();

    if (error) {
      console.error('Failed to add category:', error);
      setFormError(error.message);
      return;
    }

    if (data && data.length > 0) {
      setCategories([...categories, data[0]]);
      setCategoryId(data[0].id);
    }
    setNewCategoryName('');
    setShowCategoryForm(false);
  };

  // Calculations
  const filteredExpenses = expenses.filter((exp) => {
    if (timeFilter === 'all') return true;
    const expDate = new Date(exp.spent_on);
    const today = new Date();
    return expDate.getMonth() === today.getMonth() && expDate.getFullYear() === today.getFullYear();
  });

  const totalSpent = filteredExpenses.reduce((sum, exp) => sum + (exp.amount_minor || 0), 0) / 100;
  const remaining = salary - totalSpent;
  const percentUsed = salary > 0 ? ((totalSpent / salary) * 100).toFixed(1) : null;

  // Total All-Time Calculations (Rollover)
  const totalAllTimeSpent = expenses.reduce((sum, exp) => sum + (exp.amount_minor || 0), 0) / 100;
  const totalSavings = totalHistoricalSalary - totalAllTimeSpent;

  // Chart Data Preparation
  const expensesByCategory = filteredExpenses.reduce((acc, exp) => {
    const catName = categories.find((c) => c.id === exp.category_id)?.name || 'Other';
    const amountVal = exp.amount_minor / 100;
    acc[catName] = (acc[catName] || 0) + amountVal;
    return acc;
  }, {} as Record<string, number>);

  const chartData = Object.entries(expensesByCategory)
    .map(([name, value]) => ({ name, value: Number(value) }))
    .sort((a, b) => b.value - a.value);

  // Calculate 6-Month Trend Data
  const trendData = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const targetMonth = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthLabel = targetMonth.toLocaleDateString('en-GB', { month: 'short' });
    const fullMonthLabel = targetMonth.toLocaleDateString('en-GB', {
      month: 'long',
      year: 'numeric',
    });

    const monthTotal =
      expenses
        .filter((exp) => {
          const expDate = new Date(exp.spent_on);
          return (
            expDate.getMonth() === targetMonth.getMonth() &&
            expDate.getFullYear() === targetMonth.getFullYear()
          );
        })
        .reduce((sum, exp) => sum + (exp.amount_minor || 0), 0) / 100;

    trendData.push({ month: monthLabel, fullMonthLabel, amount: monthTotal });
  }

  const spentSplit = splitMoney(totalSpent);
  const remainingSplit = splitMoney(remaining);
  const savingsSplit = splitMoney(totalSavings);

  return (
    <div 
      className="w-full max-w-6xl mx-auto my-4 sm:my-8 backdrop-blur-3xl text-zinc-900 rounded-[36px] p-5 sm:p-10 shadow-2xl border border-white/80" 
      style={{ backgroundColor: 'rgba(250, 249, 246, 0.95)' }}
    >
      
      {/* Top Pill Navigation Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-zinc-950 text-white flex items-center justify-center font-black text-lg tracking-tighter">
            A
          </div>
          <span className="font-bold text-base tracking-tight text-zinc-900">ExpenseFlow</span>
        </div>

        <div className="bg-white p-1.5 rounded-full shadow-xs border border-zinc-200/70 inline-flex items-center gap-1">
          <span className="bg-zinc-950 text-white px-5 py-2 rounded-full text-xs sm:text-sm font-medium">
            Dashboard
          </span>
          <Link
            href="/transactions"
            className="text-zinc-700 hover:text-zinc-950 px-5 py-2 rounded-full text-xs sm:text-sm font-medium transition-colors"
          >
            Transactions
          </Link>
          <Link
            href="/settings"
            className="text-zinc-700 hover:text-zinc-950 px-5 py-2 rounded-full text-xs sm:text-sm font-medium transition-colors"
          >
            Categories
          </Link>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleSignOut}
            className="text-xs font-semibold text-zinc-600 hover:text-red-600 px-4 py-2 rounded-full bg-white border border-zinc-200/80 shadow-sm transition-colors cursor-pointer"
          >
            Sign Out
          </button>
          <button
            onClick={() => alert('No new notifications!')}
            className="w-10 h-10 rounded-full bg-white border border-zinc-200/80 flex items-center justify-center text-zinc-700 hover:text-zinc-950 shadow-2xs transition-colors cursor-pointer"
            title="Notifications"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
          </button>
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#6B0F06] to-[#F38636] text-white font-bold text-xs flex items-center justify-center shadow-sm">
            IA
          </div>
        </div>
      </div>

      {/* Welcome Title & Create Report Button */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div>
          <p className="text-zinc-700 text-xs sm:text-sm mb-1 font-medium">
            Take control of your finances with real-time insights
          </p>
          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-zinc-950">
            Welcome Back!
          </h1>
        </div>

        <Link
          href="/transactions"
          className="inline-flex items-center justify-center gap-2 bg-zinc-950 hover:bg-zinc-800 text-white text-xs sm:text-sm font-medium px-6 py-3.5 rounded-full transition-colors shadow-sm"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
          Create Report
        </Link>
      </div>

      {/* Top Hero Row: Two Signature Crimson-to-Orange Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6">
        
        {/* Left Hero Card: Overview + 6-Month Chart */}
        <div className="lg:col-span-7 rounded-[28px] p-6 sm:p-8 text-white bg-gradient-to-b from-[#450704] via-[#B42910] to-[#F18535] shadow-lg flex flex-col justify-between min-h-[370px]">
          <div>
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="text-white/90 text-sm sm:text-base font-medium">Overview</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setTimeFilter(timeFilter === 'month' ? 'all' : 'month')}
                  className="bg-white/15 hover:bg-white/25 backdrop-blur-md border border-white/15 px-3.5 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 transition-colors"
                >
                  <span>{timeFilter === 'month' ? 'This Month' : 'All Time'}</span>
                  <span className="text-[10px]">▼</span>
                </button>
              </div>
            </div>

            <div className="text-3xl sm:text-5xl font-bold tracking-tight mb-3">
              <span>PKR {spentSplit.whole}</span>
              <span className="text-white/70">.{spentSplit.dec}</span>
            </div>

            <div className="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur-md border border-white/10 rounded-full px-3.5 py-1 text-xs text-white/95">
              <span>↗ {percentUsed !== null ? `${percentUsed}%` : '0.0%'} this month</span>
            </div>
          </div>

          <div className="h-44 mt-6 -mx-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendData} barCategoryGap="20%">
                <XAxis
                  dataKey="month"
                  stroke="rgba(255,255,255,0.85)"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.12)', radius: 8 }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const val = Number(payload[0].value || 0);
                      const p = splitMoney(val);
                      return (
                        <div className="bg-white text-zinc-900 px-4 py-3 rounded-2xl shadow-xl border border-zinc-100">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-bold text-base">
                              PKR {p.whole}
                              <span className="text-zinc-500">.{p.dec}</span>
                            </span>
                            <span className="bg-zinc-950 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
                              ↗ {percentUsed || '0'}%
                            </span>
                          </div>
                          <p className="text-xs text-zinc-500">
                            for {payload[0].payload.fullMonthLabel}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar
                  dataKey="amount"
                  fill="rgba(255, 255, 255, 0.85)"
                  radius={[6, 6, 6, 6]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right Hero Card: Balance, Salary & Stacked Savings Card */}
        <div className="lg:col-span-5 rounded-[28px] p-6 sm:p-8 text-white bg-gradient-to-b from-[#450704] via-[#B42910] to-[#F18535] shadow-lg flex flex-col justify-between min-h-[370px]">
          <div>
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="text-white/90 text-sm sm:text-base font-medium">Balance & Salary</span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => {
                    setSalaryInput(salary > 0 ? salary.toString() : '');
                    setIsEditingSalary(!isEditingSalary);
                  }}
                  className="bg-white/15 hover:bg-white/25 backdrop-blur-md border border-white/15 px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors"
                >
                  {isEditingSalary ? 'Cancel' : 'Edit Salary'}
                </button>
                <button
                  onClick={() => setShowCategoryForm(!showCategoryForm)}
                  className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-md border border-white/15 flex items-center justify-center text-sm font-bold transition-colors"
                  title="Add New Category"
                >
                  +
                </button>
              </div>
            </div>

            {isEditingSalary ? (
              <form onSubmit={handleSaveSalary} className="flex gap-2 items-center my-2">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={salaryInput}
                  onChange={(e) => setSalaryInput(e.target.value)}
                  className="w-full px-4 py-2 bg-black/30 backdrop-blur-md text-white placeholder-white/60 rounded-full text-sm outline-none border border-white/30"
                  placeholder="Monthly Salary (PKR)"
                  autoFocus
                />
                <button
                  type="submit"
                  className="bg-white text-zinc-950 px-4 py-2 rounded-full text-xs font-bold hover:bg-zinc-100 transition-colors shrink-0"
                >
                  Save
                </button>
              </form>
            ) : (
              <div className="text-3xl sm:text-5xl font-bold tracking-tight mb-3">
                <span>
                  {remainingSplit.sign}PKR {remainingSplit.whole}
                </span>
                <span className="text-white/70">.{remainingSplit.dec}</span>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 mb-5">
              <div className="inline-flex items-center gap-1 bg-white/15 backdrop-blur-md border border-white/10 rounded-full px-3 py-1 text-xs">
                <span>↗ {percentUsed !== null ? `${percentUsed}% used` : 'Set Salary'}</span>
              </div>
              <div className="inline-flex items-center gap-1 bg-white/15 backdrop-blur-md border border-white/10 rounded-full px-3 py-1 text-xs">
                <span>Salary: PKR {formatMoney(salary)}</span>
              </div>
            </div>

            {/* White Pill Action Buttons (Deposit / Withdraw Style) */}
            <div className="flex items-center gap-2.5 mb-5">
              <button
                type="button"
                onClick={() => {
                  setSalaryInput(salary > 0 ? salary.toString() : '');
                  setIsEditingSalary(true);
                }}
                className="flex-1 bg-white hover:bg-zinc-50 text-zinc-950 font-semibold text-xs sm:text-sm py-3 px-4 rounded-full shadow-sm flex items-center justify-center gap-1.5 transition-transform active:scale-95"
              >
                <span>↗ Salary</span>
              </button>
              <Link
                href="/transactions"
                className="w-11 h-11 rounded-full bg-white hover:bg-zinc-50 text-zinc-950 flex items-center justify-center shadow-sm shrink-0 font-bold transition-transform active:scale-95"
                title="All Transactions"
              >
                ⇅
              </Link>
              <button
                type="button"
                onClick={() => amountInputRef.current?.focus()}
                className="flex-1 bg-white hover:bg-zinc-50 text-zinc-950 font-semibold text-xs sm:text-sm py-3 px-4 rounded-full shadow-sm flex items-center justify-center gap-1.5 transition-transform active:scale-95"
              >
                <span>↘ Expense</span>
              </button>
            </div>
          </div>

          {/* Stacked Frosted Glass Card for Total Rollover Savings */}
          <div className="relative pt-2 mt-auto">
            <div className="mx-6 h-2.5 rounded-t-2xl bg-white/15 backdrop-blur-md border-t border-x border-white/20" />
            <div className="mx-3 h-2.5 rounded-t-2xl bg-white/25 backdrop-blur-md border-t border-x border-white/25" />
            <div className="p-4 sm:p-5 rounded-2xl bg-white/30 backdrop-blur-md border border-white/35 flex items-center justify-between shadow-inner">
              <div>
                <p className="text-[11px] font-medium text-white/90 tracking-wider">
                  •••• SAVED &nbsp; {String(now.getMonth() + 1).padStart(2, '0')} / {String(now.getFullYear()).slice(-2)}
                </p>
                <p className="text-base sm:text-lg font-bold text-white mt-0.5">
                  {savingsSplit.sign}PKR {savingsSplit.whole}.{savingsSplit.dec}
                </p>
              </div>
              <span className="text-base sm:text-lg font-black tracking-widest italic text-white/90">
                VISA
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Collapsible New Category Form */}
      {showCategoryForm && (
        <form
          onSubmit={handleAddCategory}
          className="flex gap-2 mb-6 bg-white p-3.5 rounded-2xl border border-zinc-200 shadow-xs"
        >
          <input
            type="text"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            placeholder="Category Name (e.g. Padel Match)"
            required
            className="px-4 py-2.5 rounded-xl bg-zinc-100 text-zinc-900 w-full text-sm outline-none focus:ring-2 focus:ring-orange-500/30"
          />
          <button
            type="submit"
            className="bg-zinc-950 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-zinc-800 text-sm whitespace-nowrap transition-colors"
          >
            Create
          </button>
        </form>
      )}

      {/* Quick Add Expense Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-[24px] border border-zinc-200/70 shadow-2xs mb-6">
        <div className="flex justify-between items-center mb-3 px-1">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-600">
            Log New Expense
          </h3>
          <div className="flex gap-4">
            <Link
              href="/settings"
              className="text-xs text-zinc-600 hover:text-zinc-900 transition-colors font-medium"
            >
              Manage Categories
            </Link>
            <button
              type="button"
              onClick={() => setShowCategoryForm(!showCategoryForm)}
              className="text-xs text-[#C83713] hover:text-[#9E1C0C] font-semibold transition-colors"
            >
              {showCategoryForm ? 'Close' : '+ New Category'}
            </button>
          </div>
        </div>

        {/* UPDATED TO 6 COLUMNS: Includes Payment Method dropdown */}
        <form onSubmit={handleAddExpense} className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <input
            type="date"
            value={expenseDate}
            onChange={(e) => setExpenseDate(e.target.value)}
            required
            className="px-4 py-3 rounded-2xl bg-[#F6F6F7] text-zinc-900 w-full text-sm outline-none border border-transparent focus:border-orange-500 [color-scheme:light] cursor-pointer"
          />
          <input
            ref={amountInputRef}
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount (PKR)"
            required
            className="px-4 py-3 rounded-2xl bg-[#F6F6F7] text-zinc-900 w-full text-sm outline-none border border-transparent focus:border-orange-500"
          />
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="px-4 py-3 rounded-2xl bg-[#F6F6F7] text-zinc-900 w-full text-sm outline-none border border-transparent focus:border-orange-500 cursor-pointer"
          >
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            className="px-4 py-3 rounded-2xl bg-[#F6F6F7] text-zinc-900 w-full text-sm outline-none border border-transparent focus:border-orange-500 cursor-pointer"
          >
            <option value="cash">Cash</option>
            <option value="card">Card</option>
            <option value="bank">Bank Transfer</option>
          </select>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note (optional)"
            className="px-4 py-3 rounded-2xl bg-[#F6F6F7] text-zinc-900 w-full text-sm outline-none border border-transparent focus:border-orange-500"
          />
          <button
            type="submit"
            className="bg-zinc-950 hover:bg-zinc-800 text-white px-6 py-3 rounded-2xl font-semibold text-sm w-full transition-colors cursor-pointer"
          >
            Add
          </button>
        </form>
        {formError && <p className="text-red-600 text-xs mt-2 px-1">{formError}</p>}
      </div>

      {/* Bottom Row: Recent Transactions (Left) + Category Bento Grid & Glass Bubbles (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left: Recent Transactions */}
        <div className="lg:col-span-7 bg-[#F3F3F5] p-6 rounded-[28px]">
          <div className="flex justify-between items-center mb-5">
            <h3 className="text-base font-semibold text-zinc-900">Recent Transactions</h3>
            <Link
              href="/transactions"
              className="text-xs font-medium text-zinc-700 hover:text-zinc-950 transition-colors"
            >
              View All
            </Link>
          </div>

          {Array.isArray(filteredExpenses) && filteredExpenses.length > 0 ? (
            <div className="space-y-3">
              {filteredExpenses.slice(0, 5).map((exp) => {
                const cat = categories.find((c) => c.id === exp.category_id);
                const catName = cat?.name || 'Expense';

                return (
                  <div
                    key={exp.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl shadow-2xs border border-zinc-200/40"
                  >
                    {editingId === exp.id ? (
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-6 gap-2 items-center w-full">
                        <input
                          type="date"
                          value={editDate}
                          onChange={(e) => setEditDate(e.target.value)}
                          className="p-2 rounded-xl bg-zinc-100 text-zinc-900 w-full text-xs border border-zinc-200"
                        />
                        <input
                          type="number"
                          step="0.01"
                          value={editAmount}
                          onChange={(e) => setEditAmount(e.target.value)}
                          className="p-2 rounded-xl bg-zinc-100 text-zinc-900 w-full text-xs"
                        />
                        <select
                          value={editCategoryId}
                          onChange={(e) => setEditCategoryId(e.target.value)}
                          className="p-2 rounded-xl bg-zinc-100 text-zinc-900 w-full text-xs"
                        >
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                        <select
                          value={editPaymentMethod}
                          onChange={(e) => setEditPaymentMethod(e.target.value)}
                          className="p-2 rounded-xl bg-zinc-100 text-zinc-900 w-full text-xs"
                        >
                          <option value="cash">Cash</option>
                          <option value="card">Card</option>
                          <option value="bank">Bank</option>
                        </select>
                        <input
                          type="text"
                          value={editNote}
                          onChange={(e) => setEditNote(e.target.value)}
                          className="p-2 rounded-xl bg-zinc-100 text-zinc-900 w-full text-xs"
                        />
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => handleSaveEdit(exp.id)}
                            className="bg-zinc-950 text-white px-3 py-1.5 rounded-xl text-xs w-full"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="bg-zinc-200 text-zinc-800 px-3 py-1.5 rounded-xl text-xs w-full"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className="w-10 h-10 rounded-full bg-orange-50 border border-orange-200/60 flex items-center justify-center text-[#C83713] font-bold text-xs shrink-0">
                            {catName.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-sm text-zinc-900 truncate">
                              {exp.note || catName}
                            </p>
                            <p className="text-xs text-zinc-600 flex items-center gap-1.5">
                              <span>{formatDate(exp.spent_on)}</span>
                              {exp.payment_method && (
                                <>
                                  <span className="text-zinc-300">•</span>
                                  <span className="capitalize bg-zinc-100 px-1.5 py-0.5 rounded text-[10px] text-zinc-600 font-medium">
                                    {exp.payment_method}
                                  </span>
                                </>
                              )}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-4">
                          <span className="px-3 py-1 rounded-full text-[11px] font-medium bg-orange-50 text-orange-700">
                            {catName}
                          </span>

                          <p className="font-bold text-sm sm:text-base text-[#D92D20] whitespace-nowrap">
                            -PKR {formatMoney(exp.amount_minor / 100)}
                          </p>

                          <div className="flex gap-1">
                            <button
                              onClick={() => handleEditClick(exp)}
                              className="text-zinc-500 hover:text-zinc-900 transition-colors p-1.5"
                              title="Edit expense"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                            </button>
                            <button
                              onClick={() => handleDeleteExpense(exp.id)}
                              className="text-zinc-500 hover:text-red-600 transition-colors p-1.5"
                              title="Delete expense"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-zinc-600 text-center py-8 text-sm">
              No expenses found for this period.
            </p>
          )}
        </div>

        {/* Right: 2x2 Category Bento Cards + Frosted Glass Bubble Chart */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-4">
            {chartData.length > 0 ? (
              chartData.slice(0, 4).map((item) => {
                const p = splitMoney(item.value);
                const pct =
                  totalSpent > 0 ? ((item.value / totalSpent) * 100).toFixed(1) : '0.0';

                return (
                  <div
                    key={item.name}
                    className="bg-white p-5 rounded-[24px] shadow-2xs border border-zinc-200/50 flex flex-col justify-between min-h-[140px]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-zinc-700 truncate">
                        {item.name}
                      </span>
                      <span className="text-zinc-500 text-xs">↗</span>
                    </div>

                    <div className="mt-4">
                      <p className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-950 truncate">
                        PKR {p.whole}
                        <span className="text-zinc-500 font-semibold">.{p.dec}</span>
                      </p>
                      <p className="text-[11px] font-medium text-[#C83713] mt-1">
                        ↗ {pct}% of spending
                      </p>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="col-span-2 bg-white p-6 rounded-[24px] text-center text-zinc-600 text-sm">
                Log expenses to see category cards
              </div>
            )}
          </div>

          {/* Warm Orange Frosted Glass Category Bubbles */}
          {chartData.length > 0 && (
            <div className="rounded-[28px] p-6 bg-gradient-to-br from-[#B42910] to-[#F18535] text-white shadow-md">
              <p className="text-xs uppercase tracking-wider text-white/80 font-semibold mb-4">
                Category Share
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                {chartData.slice(0, 4).map((item, idx) => {
                  const pct =
                    totalSpent > 0 ? ((item.value / totalSpent) * 100).toFixed(1) : '0.0';
                  const sizes = [
                    'w-28 h-28',
                    'w-24 h-24',
                    'w-24 h-24',
                    'w-20 h-20',
                  ];
                  return (
                    <div
                      key={item.name}
                      className={`${sizes[idx] || 'w-24 h-24'} rounded-full bg-white/20 backdrop-blur-md border border-white/35 flex flex-col items-center justify-center text-center p-2 shadow-inner`}
                    >
                      <span className="text-[11px] font-medium text-white/90 line-clamp-1 px-1">
                        {item.name}
                      </span>
                      <span className="text-sm font-bold text-white mt-0.5">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}