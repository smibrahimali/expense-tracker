'use client';

import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { MessageSquare, Pencil, Trash2, X, AlertTriangle } from 'lucide-react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  CartesianGrid,
} from 'recharts';
import { createClient } from '../../utils/client';
import { PREDEFINED_CATEGORIES, getCategoryColor, mergeCategoryNames } from '../../utils/categories';
import { formatAmount, formatMoney, abbreviateAmount } from '../../utils/money';
import { parseAmountToMinorUnits } from '../../utils/money-parser';
import { formatDisplayDate, todayLocal } from '../../utils/format';
import ChatLogger from './ChatLogger';
import AppShell from './AppShell';
import {
  Button,
  Input,
  Select,
  Card,
  CardHeader,
  CardBody,
  Dialog,
  EmptyState,
  StatCard,
  PageHeader,
  CategoryTile,
  PaymentBadge,
  Money,
} from './ui';

export default function Dashboard({ userId }: { userId: string }) {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<string[]>([...PREDEFINED_CATEGORIES]);
  const [loading, setLoading] = useState(true);

  const [salary, setSalary] = useState<number>(0);
  const [salariesMap, setSalariesMap] = useState<Record<string, number>>({});
  const [totalHistoricalSalary, setTotalHistoricalSalary] = useState<number>(0);
  const [isEditingSalary, setIsEditingSalary] = useState(false);
  const [salaryInput, setSalaryInput] = useState('');
  const [savingSalary, setSavingSalary] = useState(false);
  const [salaryError, setSalaryError] = useState<string | null>(null);

  const [amount, setAmount] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>(PREDEFINED_CATEGORIES[0]);
  const [note, setNote] = useState('');
  const [expenseDate, setExpenseDate] = useState(todayLocal());
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [adding, setAdding] = useState(false);

  const [pendingExpense, setPendingExpense] = useState<{
    amountMinor: number;
    categoryId: string;
    expenseDate: string;
    note: string;
    paymentMethod: string;
  } | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editPaymentMethod, setEditPaymentMethod] = useState('cash');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const [showAiChat, setShowAiChat] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [timeFilter, setTimeFilter] = useState<'all' | 'month'>('month');
  const [formError, setFormError] = useState<string | null>(null);
  const amountInputRef = useRef<HTMLInputElement>(null);
  const salaryBusyRef = useRef(false);
  const addBusyRef = useRef(false);
  const refreshSeqRef = useRef(0);

  const supabase = createClient();

  const parseMajorToMinor = (raw: string): number | null => {
    try {
      const cleaned = raw.trim().replace(/,/g, '');
      if (!cleaned) return null;
      const minor = parseAmountToMinorUnits(cleaned);
      if (!Number.isSafeInteger(minor) || minor <= 0 || minor > 100_000_000_000) return null;
      return minor;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user?.email) setUserEmail(data.user.email);
    });

    const now = new Date();
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

    Promise.all([
      supabase.from('monthly_salaries').select('month, amount_minor').eq('user_id', userId),
      supabase
        .from('expenses')
        .select('*')
        .eq('user_id', userId)
        .order('spent_on', { ascending: false })
        .order('created_at', { ascending: false }),
      supabase
        .from('categories')
        .select('name')
        .eq('user_id', userId)
        .order('created_at', { ascending: true }),
    ]).then(([salRes, expRes, catRes]) => {
      if (salRes.data) {
        let currentSal = 0;
        let totalSal = 0;
        const sMap: Record<string, number> = {};
        salRes.data.forEach((item) => {
          const val = item.amount_minor / 100;
          totalSal += val;
          sMap[item.month] = val;
          if (item.month === currentMonthStr) currentSal = val;
        });
        setSalariesMap(sMap);
        setSalary(currentSal);
        setTotalHistoricalSalary(totalSal);
      }
      if (expRes.error) {
        console.error('Failed to fetch expenses:', expRes.error);
        setExpenses([]);
      } else {
        setExpenses(Array.isArray(expRes.data) ? expRes.data : []);
      }
      const merged = mergeCategoryNames((catRes.data || []).map((c) => c.name));
      setCategoryOptions(merged);
      setSelectedCategory((prev) => (merged.includes(prev) ? prev : merged[0]));
      setLoading(false);
    });
  }, [userId, supabase]);

  const refreshExpenses = async () => {
    const seq = ++refreshSeqRef.current;
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .eq('user_id', userId)
      .order('spent_on', { ascending: false })
      .order('created_at', { ascending: false });
    if (seq !== refreshSeqRef.current) return;
    if (error) {
      toast.error('Could not refresh expenses');
      return;
    }
    if (data) setExpenses(data);
  };

  const handleSaveSalary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (salaryBusyRef.current) return;
    setSalaryError(null);
    setFormError(null);
    let amountMinor: number;
    try {
      const cleaned = salaryInput.trim().replace(/,/g, '');
      if (!cleaned) {
        setSalaryError('Enter a salary greater than 0.');
        return;
      }
      amountMinor = parseAmountToMinorUnits(cleaned);
    } catch {
      setSalaryError('Enter a valid salary (e.g. 150000 or 150000.50).');
      return;
    }
    if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
      setSalaryError('Salary must be greater than 0.');
      return;
    }
    salaryBusyRef.current = true;
    setSavingSalary(true);
    try {
      const now = new Date();
      const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      const { error } = await supabase.from('monthly_salaries').upsert(
        {
          user_id: userId,
          month: currentMonthStr,
          amount_minor: amountMinor,
        },
        { onConflict: 'user_id,month' }
      );
      if (error) {
        setSalaryError(error.message);
        return;
      }

      const newSalaryVal = amountMinor / 100;
      setSalariesMap((prev) => {
        const next = { ...prev, [currentMonthStr]: newSalaryVal };
        setTotalHistoricalSalary(Object.values(next).reduce((s, v) => s + v, 0));
        return next;
      });
      setSalary(newSalaryVal);
      setIsEditingSalary(false);
      toast.success('Salary updated');
    } finally {
      salaryBusyRef.current = false;
      setSavingSalary(false);
    }
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!selectedCategory) {
      setFormError('Select a category first.');
      return;
    }
    if (!expenseDate || expenseDate > todayLocal()) {
      setFormError('Pick a date that is today or earlier.');
      return;
    }
    const amountMinor = parseMajorToMinor(amount);
    if (amountMinor === null) {
      setFormError('Enter an amount greater than 0 (max 2 decimals).');
      return;
    }
    const trimmedNote = note.trim().slice(0, 140);
    const amountMajor = amountMinor / 100;
    if (salary > 0 && amountMajor >= salary * 0.3) {
      setDialogError(null);
      setPendingExpense({
        amountMinor,
        categoryId: selectedCategory,
        expenseDate,
        note: trimmedNote,
        paymentMethod,
      });
      return;
    }
    await executeAddExpense(amountMinor, selectedCategory, expenseDate, trimmedNote, paymentMethod);
  };

  const executeAddExpense = async (
    amtMinor: number,
    catId: string,
    date: string,
    n: string,
    pMethod: string
  ) => {
    if (addBusyRef.current) return;
    addBusyRef.current = true;
    setAdding(true);
    setDialogError(null);
    try {
      const { data: newExpense, error } = await supabase
        .from('expenses')
        .insert([
          {
            user_id: userId,
            category_id: catId,
            amount_minor: amtMinor,
            spent_on: date,
            note: n || null,
            payment_method: pMethod,
          },
        ])
        .select()
        .single();

      if (error || !newExpense) {
        const msg = error?.message || 'Failed to add expense.';
        if (pendingExpense) setDialogError(msg);
        else setFormError(msg);
        return;
      }

      setExpenses((prev) => [newExpense, ...prev]);
      setAmount('');
      setNote('');
      setPaymentMethod('cash');
      setExpenseDate(todayLocal());
      setPendingExpense(null);
      setDialogError(null);
      toast.success('Expense added');
      requestAnimationFrame(() => amountInputRef.current?.focus());
    } finally {
      addBusyRef.current = false;
      setAdding(false);
    }
  };

  const handleDeleteExpense = async (id: string) => {
    setExpenses((prev) => {
      const previous = prev;
      const next = prev.filter((exp) => exp.id !== id);
      void (async () => {
        const { error } = await supabase.from('expenses').delete().eq('id', id).eq('user_id', userId);
        if (error) {
          setExpenses(previous);
          toast.error(error.message);
        } else {
          toast.success('Expense deleted');
        }
      })();
      return next;
    });
    setDeleteConfirmId(null);
  };

  const handleEditClick = (exp: any) => {
    setFormError(null);
    setEditingId(exp.id);
    setEditAmount((exp.amount_minor / 100).toString());
    setEditCategory(exp.category_id || categoryOptions[0] || PREDEFINED_CATEGORIES[0]);
    setEditNote(exp.note || '');
    setEditDate(exp.spent_on);
    setEditPaymentMethod(exp.payment_method || 'cash');
  };

  const handleSaveEdit = async (id: string) => {
    setFormError(null);
    const amountMinor = parseMajorToMinor(editAmount);
    if (amountMinor === null) {
      toast.error('Enter an amount greater than 0.');
      return;
    }
    if (!editDate || editDate > todayLocal()) {
      toast.error('Pick a date that is today or earlier.');
      return;
    }
    const trimmedNote = editNote.trim().slice(0, 140);
    const { data: updatedExpense, error } = await supabase
      .from('expenses')
      .update({
        category_id: editCategory,
        amount_minor: amountMinor,
        note: trimmedNote || null,
        spent_on: editDate,
        payment_method: editPaymentMethod,
      })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error || !updatedExpense) {
      toast.error(error?.message || 'Failed to update expense.');
      return;
    }
    setExpenses((prev) => prev.map((exp) => (exp.id === id ? { ...exp, ...updatedExpense } : exp)));
    setEditingId(null);
    toast.success('Expense updated');
  };

  const currentMonthKey = (() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  })();

  const filteredExpenses = expenses.filter((exp) => {
    if (timeFilter === 'all') return true;
    return String(exp.spent_on || '').slice(0, 7) === currentMonthKey;
  });

  const totalSpent = filteredExpenses.reduce((sum, exp) => sum + (exp.amount_minor || 0), 0) / 100;
  const totalAllTimeSpent = expenses.reduce((sum, exp) => sum + (exp.amount_minor || 0), 0) / 100;
  const totalSavings = totalHistoricalSalary - totalAllTimeSpent;
  const salarySet = salary > 0;
  // All-time: compare spend to historical salary; month: this month's salary
  const remainingBase = timeFilter === 'all' ? totalHistoricalSalary : salary;
  const remainingSpend = timeFilter === 'all' ? totalAllTimeSpent : totalSpent;
  const remaining = remainingBase - remainingSpend;
  const percentUsed =
    remainingBase > 0 ? (remainingSpend / remainingBase) * 100 : null;

  const expensesByCategory = filteredExpenses.reduce(
    (acc, exp) => {
      const catName = exp.category_id || 'Other';
      const amountVal = exp.amount_minor / 100;
      acc[catName] = (acc[catName] || 0) + amountVal;
      return acc;
    },
    {} as Record<string, number>
  );

  const chartData = Object.entries(expensesByCategory)
    .map(([name, value]) => ({ name, value: Number(value) }))
    .sort((a, b) => b.value - a.value);

  const trendData = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const targetMonth = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthLabel = targetMonth.toLocaleDateString('en-GB', { month: 'short' });
    const fullMonthLabel = targetMonth.toLocaleDateString('en-GB', {
      month: 'long',
      year: 'numeric',
    });
    const targetMonthStr = `${targetMonth.getFullYear()}-${String(targetMonth.getMonth() + 1).padStart(2, '0')}-01`;
    const monthSalary = salariesMap[targetMonthStr] || 0;
    const monthKey = targetMonthStr.slice(0, 7);
    const monthTotal =
      expenses
        .filter((exp) => String(exp.spent_on || '').slice(0, 7) === monthKey)
        .reduce((sum, exp) => sum + (exp.amount_minor || 0), 0) / 100;

    const prevIdx = i + 1;
    let prevTotal = 0;
    if (prevIdx <= 5) {
      const prevMonth = new Date(now.getFullYear(), now.getMonth() - prevIdx, 1);
      const prevKey = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}`;
      prevTotal =
        expenses
          .filter((exp) => String(exp.spent_on || '').slice(0, 7) === prevKey)
          .reduce((sum, exp) => sum + (exp.amount_minor || 0), 0) / 100;
    }

    const monthRemaining = monthSalary > 0 ? monthSalary - monthTotal : null;

    trendData.push({
      month: monthLabel,
      fullMonthLabel,
      amount: monthTotal,
      remaining: monthRemaining,
      change: monthTotal - prevTotal,
      isCurrent: i === 0,
      monthSalary,
    });
  }

  const monthHeading = now.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const stackedTotal = chartData.reduce((s, d) => s + d.value, 0);
  const peakTrendAmount = Math.max(0, ...trendData.map((d) => d.amount));

  return (
    <AppShell email={userEmail}>
      <Dialog
        open={!!pendingExpense}
        onClose={() => setPendingExpense(null)}
        title="Confirm large expense"
        description={
          pendingExpense
            ? `This expense of PKR ${formatAmount(pendingExpense.amountMinor / 100)} is over 30% of your monthly salary. Do you want to log it?`
            : undefined
        }
        footer={
          <>
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => {
                setPendingExpense(null);
                setDialogError(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="accent"
              className="flex-1"
              loading={adding}
              onClick={() =>
                pendingExpense &&
                executeAddExpense(
                  pendingExpense.amountMinor,
                  pendingExpense.categoryId,
                  pendingExpense.expenseDate,
                  pendingExpense.note,
                  pendingExpense.paymentMethod
                )
              }
            >
              Log expense
            </Button>
          </>
        }
      >
        <div className="w-10 h-10 rounded-full bg-[var(--ef-warning-muted)] text-[var(--ef-warning)] flex items-center justify-center mb-1">
          <AlertTriangle size={18} strokeWidth={1.5} />
        </div>
        {dialogError ? (
          <p role="alert" className="text-xs text-[var(--ef-danger)] mt-3">
            {dialogError}
          </p>
        ) : null}
      </Dialog>

      <Dialog
        open={!!deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
        title="Delete expense?"
        description="This cannot be undone."
        footer={
          <>
            <Button variant="secondary" className="flex-1" onClick={() => setDeleteConfirmId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={() => deleteConfirmId && handleDeleteExpense(deleteConfirmId)}
            >
              Delete
            </Button>
          </>
        }
      />

      <PageHeader
        eyebrow={monthHeading}
        title="Overview"
        description="Spending, salary and savings — at a glance."
        action={
          <div className="flex items-center gap-1 p-0.5 rounded-[var(--ef-radius-sm)] bg-[var(--ef-gray-200)] border border-[var(--ef-border)]">
            <button
              type="button"
              onClick={() => setTimeFilter('month')}
              className={`px-3 h-8 rounded-[6px] text-xs font-medium transition-colors cursor-pointer ${
                timeFilter === 'month'
                  ? 'bg-[var(--ef-accent-muted)] text-[var(--ef-accent-warm)] shadow-[var(--ef-shadow-sm)]'
                  : 'text-[var(--ef-muted)] hover:text-[var(--ef-ink)]'
              }`}
            >
              This month
            </button>
            <button
              type="button"
              onClick={() => setTimeFilter('all')}
              className={`px-3 h-8 rounded-[6px] text-xs font-medium transition-colors cursor-pointer ${
                timeFilter === 'all'
                  ? 'bg-[var(--ef-accent-muted)] text-[var(--ef-accent-warm)] shadow-[var(--ef-shadow-sm)]'
                  : 'text-[var(--ef-muted)] hover:text-[var(--ef-ink)]'
              }`}
            >
              All time
            </button>
          </div>
        }
      />

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <StatCard
          label="💸 Total spent"
          value={loading ? null : totalSpent}
          empty={loading}
          secondary={
            percentUsed !== null ? (
              <span className="tabular-nums">{percentUsed.toFixed(1)}% of salary used</span>
            ) : (
              <span>{totalSpent === 0 ? 'No expenses this period' : 'Salary not set yet'}</span>
            )
          }
          progress={percentUsed}
        />
        <StatCard
          label="🧾 Remaining"
          value={
            loading || (timeFilter === 'month' ? !salarySet : totalHistoricalSalary <= 0)
              ? null
              : remaining
          }
          empty={loading || (timeFilter === 'month' ? !salarySet : totalHistoricalSalary <= 0)}
          secondary={
            timeFilter === 'all' ? (
              <span>All-time salary − spend</span>
            ) : salarySet ? (
              isEditingSalary ? (
                <form onSubmit={handleSaveSalary} className="flex gap-2 items-center mt-1">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={salaryInput}
                    onChange={(e) => setSalaryInput(e.target.value)}
                    className="ef-input !h-8 !text-xs flex-1"
                    placeholder="Salary"
                    autoFocus
                  />
                  <Button type="submit" size="sm" variant="accent" loading={savingSalary}>
                    Save
                  </Button>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setSalaryError(null);
                    setSalaryInput(salary > 0 ? salary.toString() : '');
                    setIsEditingSalary(true);
                  }}
                  className="text-[var(--ef-gray-600)] hover:text-[var(--ef-accent-warm)] hover:underline font-medium cursor-pointer tabular-nums"
                >
                  Edit · PKR {formatAmount(salary)}
                </button>
              )
            ) : (
              <span>Needs a salary to calculate</span>
            )
          }
        />
        <StatCard
          label="💼 Salary"
          value={loading || !salarySet ? null : salary}
          empty={loading || !salarySet}
          secondary={
            salarySet ? (
              <span>This month</span>
            ) : isEditingSalary ? (
              <form onSubmit={handleSaveSalary} className="flex gap-2 items-center mt-1">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={salaryInput}
                  onChange={(e) => setSalaryInput(e.target.value)}
                  className="ef-input !h-8 !text-xs flex-1"
                  placeholder="Amount"
                  autoFocus
                />
                <Button type="submit" size="sm" variant="accent" loading={savingSalary}>
                  Save
                </Button>
              </form>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="accent"
                onClick={() => {
                  setSalaryError(null);
                  setSalaryInput('');
                  setIsEditingSalary(true);
                }}
              >
                Set salary
              </Button>
            )
          }
        />
        <StatCard
          label="🏦 Savings"
          value={loading ? null : totalSavings}
          empty={loading}
          secondary={<span>All-time salary − spend</span>}
        />
      </div>

      {/* Trend chart */}
      <Card className="mb-6">
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium text-[var(--ef-ink)]">
              <span className="ef-emoji mr-1.5" aria-hidden>
                📈
              </span>
              Spending trend
            </h2>
            <p className="text-xs text-[var(--ef-muted)] mt-0.5">
              Last 6 months · bars = spent, line = remaining
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0 pt-0.5">
            <span className="inline-flex items-center gap-1.5 text-[11px] text-[var(--ef-muted)]">
              <span className="w-2.5 h-2.5 rounded-sm bg-[var(--ef-accent-warm)]" aria-hidden />
              Spent
            </span>
            <span className="inline-flex items-center gap-1.5 text-[11px] text-[var(--ef-muted)]">
              <span className="w-2.5 h-2.5 rounded-full bg-[var(--ef-success)]" aria-hidden />
              Left
            </span>
          </div>
        </CardHeader>
        <CardBody>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={trendData} barCategoryGap="28%">
                <CartesianGrid
                  vertical={false}
                  stroke="var(--ef-border-strong)"
                  strokeDasharray="4 4"
                />
                <XAxis
                  dataKey="month"
                  tick={{ fill: 'var(--ef-gray-600)', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tickFormatter={abbreviateAmount}
                  tick={{ fill: 'var(--ef-gray-600)', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={44}
                />
                <Tooltip
                  cursor={{ fill: 'var(--ef-accent-muted)', radius: 6 }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload;
                    const change = d.change as number;
                    return (
                      <div className="bg-[var(--ef-surface-elevated)] text-[var(--ef-ink)] px-3.5 py-2.5 rounded-[var(--ef-radius-sm)] shadow-[var(--ef-shadow-md)] border border-[var(--ef-border-strong)] min-w-[170px]">
                        <p className="text-[11px] font-medium text-[var(--ef-muted)] mb-2 border-b border-[var(--ef-border)] pb-1.5">
                          {d.fullMonthLabel}
                        </p>
                        <div className="flex items-center justify-between gap-4 mb-1.5">
                          <span className="inline-flex items-center gap-1.5 text-xs text-[var(--ef-muted)]">
                            <span className="w-2 h-2 rounded-sm bg-[var(--ef-accent-warm)]" aria-hidden />
                            Spent
                          </span>
                          <span className="text-sm font-semibold tabular-nums">
                            PKR {formatAmount(d.amount)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="inline-flex items-center gap-1.5 text-xs text-[var(--ef-muted)]">
                            <span className="w-2 h-2 rounded-full bg-[var(--ef-success)]" aria-hidden />
                            Left
                          </span>
                          <span
                            className={`text-sm font-semibold tabular-nums ${
                              d.remaining == null
                                ? 'text-[var(--ef-muted)]'
                                : d.remaining < 0
                                  ? 'text-[var(--ef-danger)]'
                                  : 'text-[var(--ef-success)]'
                            }`}
                          >
                            {d.remaining == null
                              ? '—'
                              : formatMoney(d.remaining, { showSign: true })}
                          </span>
                        </div>
                        {change !== 0 && (
                          <p
                            className={`text-xs mt-2 tabular-nums ${
                              change > 0 ? 'text-[var(--ef-danger)]' : 'text-[var(--ef-success)]'
                            }`}
                          >
                            {change > 0 ? '▲' : '▼'} PKR {formatAmount(Math.abs(change))} spend vs prior
                          </p>
                        )}
                      </div>
                    );
                  }}
                />
                <Bar dataKey="amount" radius={[8, 8, 0, 0]} maxBarSize={40}>
                  {trendData.map((entry, index) => {
                    const isPeak =
                      peakTrendAmount > 0 && entry.amount === peakTrendAmount && !entry.isCurrent;
                    const fill = entry.isCurrent
                      ? 'var(--ef-accent)'
                      : isPeak
                        ? 'var(--ef-accent-warm)'
                        : 'var(--ef-gray-500)';
                    return <Cell key={`cell-${index}`} fill={fill} />;
                  })}
                </Bar>
                <Line
                  type="monotone"
                  dataKey="remaining"
                  stroke="#34d399"
                  strokeWidth={2.5}
                  connectNulls={false}
                  dot={{
                    r: 3,
                    fill: '#34d399',
                    strokeWidth: 2,
                    stroke: '#1c1a18',
                  }}
                  activeDot={{ r: 5, stroke: '#1c1a18', strokeWidth: 2 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardBody>
      </Card>

      {/* Log expense */}
      <Card className="mb-6">
        <CardHeader>
          <h2 className="text-sm font-medium text-[var(--ef-ink)]">
            <span className="ef-emoji mr-1.5" aria-hidden>
              ✍️
            </span>
            Log expense
          </h2>
          <p className="text-xs text-[var(--ef-muted)] mt-0.5">Date → amount → category → payment</p>
        </CardHeader>
        <CardBody>
          <form
            onSubmit={handleAddExpense}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
          >
            <Input
              label="Date"
              type="date"
              max={todayLocal()}
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
              required
            />
            <Input
              ref={amountInputRef}
              label="Amount (PKR)"
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              placeholder="0.00"
            />
            <Select
              label="Category"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              {categoryOptions.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </Select>
            <Select
              label="Payment"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
            >
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="bank">Bank</option>
            </Select>
            <Input
              label="Note"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional"
              maxLength={140}
            />
            {salaryError ? (
              <p role="alert" className="text-xs text-[var(--ef-danger)] sm:col-span-2 lg:col-span-3">
                {salaryError}
              </p>
            ) : null}
            <div className="flex items-end">
              <Button type="submit" variant="accent" className="w-full" loading={adding}>
                Add expense
              </Button>
            </div>
          </form>
          {formError && (
            <p
              role="alert"
              className="text-[var(--ef-danger)] bg-[var(--ef-danger-muted)] px-3 py-2 rounded-[var(--ef-radius-sm)] text-xs mt-3 font-medium"
            >
              {formError}
            </p>
          )}
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
        {/* Recent transactions */}
        <Card className="lg:col-span-7 overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <h2 className="text-sm font-medium text-[var(--ef-ink)]">
              <span className="ef-emoji mr-1.5" aria-hidden>
                🧾
              </span>
              Recent transactions
            </h2>
            <Link
              href="/transactions"
              className="text-xs font-medium text-[var(--ef-accent-warm)] hover:text-[#ffb06a] transition-colors"
            >
              View all →
            </Link>
          </CardHeader>
          <CardBody className="!pt-0">
            {filteredExpenses.length > 0 ? (
              <ul className="divide-y divide-[var(--ef-border)]">
                {filteredExpenses.slice(0, 5).map((exp) => {
                  const catName = exp.category_id || 'Other';
                  return (
                    <li key={exp.id} className="py-3 first:pt-0 group">
                      {editingId === exp.id ? (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          <Input
                            type="date"
                            max={todayLocal()}
                            value={editDate}
                            onChange={(e) => setEditDate(e.target.value)}
                            className="!h-8 !text-xs"
                          />
                          <Input
                            type="number"
                            step="0.01"
                            value={editAmount}
                            onChange={(e) => setEditAmount(e.target.value)}
                            className="!h-8 !text-xs"
                          />
                          <Select
                            value={editCategory}
                            onChange={(e) => setEditCategory(e.target.value)}
                            className="!h-8 !text-xs"
                          >
                            {categoryOptions.map((cat) => (
                              <option key={cat} value={cat}>
                                {cat}
                              </option>
                            ))}
                          </Select>
                          <Select
                            value={editPaymentMethod}
                            onChange={(e) => setEditPaymentMethod(e.target.value)}
                            className="!h-8 !text-xs"
                          >
                            <option value="cash">Cash</option>
                            <option value="card">Card</option>
                            <option value="bank">Bank</option>
                          </Select>
                          <Input
                            type="text"
                            value={editNote}
                            onChange={(e) => setEditNote(e.target.value)}
                            placeholder="Note"
                            className="!h-8 !text-xs"
                          />
                          <div className="flex gap-2">
                            <Button size="sm" className="flex-1" onClick={() => handleSaveEdit(exp.id)}>
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              className="flex-1"
                              onClick={() => setEditingId(null)}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <CategoryTile name={catName} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-[var(--ef-gray-900)] truncate">
                              {exp.note || catName}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <span className="text-xs text-[var(--ef-muted)]">
                                {formatDisplayDate(exp.spent_on)}
                              </span>
                              <span className="text-xs text-[var(--ef-gray-400)]">·</span>
                              <span className="text-xs text-[var(--ef-muted)]">{catName}</span>
                              {exp.payment_method && <PaymentBadge method={exp.payment_method} />}
                            </div>
                          </div>
                          <Money value={exp.amount_minor / 100} showSign tone="expense" className="text-sm shrink-0" />
                          <div className="flex gap-0.5 opacity-100 sm:opacity-60 sm:group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="!px-2"
                              onClick={() => handleEditClick(exp)}
                              aria-label="Edit expense"
                            >
                              <Pencil size={14} strokeWidth={1.5} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="!px-2 text-[var(--ef-danger)]"
                              onClick={() => setDeleteConfirmId(exp.id)}
                              aria-label="Delete expense"
                            >
                              <Trash2 size={14} strokeWidth={1.5} />
                            </Button>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState
                emoji="📭"
                title={timeFilter === 'month' ? 'No expenses this month' : 'No expenses yet'}
                description={
                  timeFilter === 'month'
                    ? 'Nothing logged this month — add one above, or switch to All time.'
                    : 'Add one above — it will show up here instantly.'
                }
              />
            )}
          </CardBody>
        </Card>

        {/* Category breakdown */}
        <Card className="lg:col-span-5">
          <CardHeader>
            <h2 className="text-sm font-medium text-[var(--ef-ink)]">
              <span className="ef-emoji mr-1.5" aria-hidden>
                🏷️
              </span>
              Category breakdown
            </h2>
          </CardHeader>
          <CardBody>
            {chartData.length > 0 ? (
              <>
                {/* Stacked bar */}
                <div className="h-3 rounded-full overflow-hidden flex bg-[var(--ef-gray-200)] mb-5">
                  {chartData.map((item) => (
                    <div
                      key={item.name}
                      className="h-full first:rounded-l-full last:rounded-r-full"
                      style={{
                        width: `${stackedTotal > 0 ? (item.value / stackedTotal) * 100 : 0}%`,
                        backgroundColor: getCategoryColor(item.name),
                      }}
                      title={`${item.name}: ${((item.value / stackedTotal) * 100).toFixed(1)}%`}
                    />
                  ))}
                </div>
                <ul className="space-y-3">
                  {chartData.slice(0, 6).map((item) => {
                    const pct = stackedTotal > 0 ? (item.value / stackedTotal) * 100 : 0;
                    return (
                      <li key={item.name} className="flex items-center gap-3">
                        <CategoryTile name={item.name} size="sm" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium text-[var(--ef-gray-800)] truncate">
                              {item.name}
                            </span>
                            <span className="text-xs font-medium text-[var(--ef-muted)] tabular-nums shrink-0">
                              {pct.toFixed(1)}%
                            </span>
                          </div>
                          <p className="text-xs text-[var(--ef-muted)] tabular-nums mt-0.5">
                            PKR {formatAmount(item.value)}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </>
            ) : (
              <EmptyState
                emoji="🗂️"
                title="Nothing to break down"
                description="Once you log expenses, shares by category appear here."
              />
            )}
          </CardBody>
        </Card>
      </div>

      {/* AI logger — subdued */}
      <button
        type="button"
        onClick={() => setShowAiChat(!showAiChat)}
        className="fixed bottom-20 md:bottom-6 right-4 sm:right-6 w-11 h-11 bg-[var(--ef-accent)] text-white rounded-full shadow-[var(--ef-shadow-md)] flex items-center justify-center hover:bg-[var(--ef-accent-hover)] transition-colors z-50 cursor-pointer"
        aria-label={showAiChat ? 'Close AI logger' : 'Open AI quick logger'}
      >
        {showAiChat ? <X size={18} strokeWidth={1.5} /> : <MessageSquare size={18} strokeWidth={1.5} />}
      </button>

      <div
        className={`fixed bottom-36 md:bottom-20 right-4 sm:right-6 z-50 ef-animate-in ${
          showAiChat ? '' : 'hidden'
        }`}
        aria-hidden={!showAiChat}
      >
        <ChatLogger onExpenseAdded={refreshExpenses} />
      </div>
    </AppShell>
  );
}
