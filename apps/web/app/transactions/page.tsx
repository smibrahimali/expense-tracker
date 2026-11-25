'use client';

import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { Search, Download, Trash2 } from 'lucide-react';
import { createClient } from '../../utils/client';
import { PREDEFINED_CATEGORIES, mergeCategoryNames } from '../../utils/categories';
import { formatAmount } from '../../utils/money';
import { formatDisplayDate, formatDateGroupLabel, todayLocal } from '../../utils/format';
import AppShell from '../components/AppShell';
import {
  Button,
  Input,
  Select,
  Card,
  Dialog,
  EmptyState,
  PageHeader,
  CategoryTile,
  PaymentBadge,
  Money,
  Skeleton,
  RowSkeleton,
} from '../components/ui';

export default function TransactionsPage() {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [categoryOptions, setCategoryOptions] = useState<string[]>([...PREDEFINED_CATEGORIES]);

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(50);

  const supabase = createClient();

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 250);
    return () => clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => {
    const fetchUserAndData = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          setUserId(null);
          return;
        }

        const uid = user.id;
        setUserId(uid);

        const [{ data: expData, error }, { data: catData }] = await Promise.all([
          supabase
            .from('expenses')
            .select('*')
            .eq('user_id', uid)
            .order('spent_on', { ascending: false })
            .order('created_at', { ascending: false }),
          supabase
            .from('categories')
            .select('name')
            .eq('user_id', uid)
            .order('created_at', { ascending: true }),
        ]);

        if (!error && expData) setExpenses(expData);
        setCategoryOptions(mergeCategoryNames((catData || []).map((c) => c.name)));
      } finally {
        setLoading(false);
      }
    };

    fetchUserAndData();
  }, [supabase]);

  const handleDeleteExpense = async (id: string) => {
    const previous = expenses;
    setExpenses(expenses.filter((exp) => exp.id !== id));
    setDeleteId(null);
    const { error } = await supabase.from('expenses').delete().eq('id', id).eq('user_id', userId);
    if (error) {
      setExpenses(previous);
      toast.error(error.message);
    } else {
      toast.success('Expense deleted');
    }
  };

  const availableMonths = Array.from(
    new Set(expenses.map((exp) => exp.spent_on.substring(0, 7)))
  )
    .sort((a, b) => b.localeCompare(a))
    .map((ym) => {
      const [y, m] = ym.split('-');
      const date = new Date(Number(y), Number(m) - 1);
      return {
        value: ym,
        label: date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
      };
    });

  const filteredExpenses = expenses.filter((exp) => {
    const matchesCategory = selectedCategory === 'all' || exp.category_id === selectedCategory;
    const noteText = exp.note ? exp.note.toLowerCase() : '';
    const matchesSearch = noteText.includes(debouncedSearch.toLowerCase());
    const matchesMonth = selectedMonth === 'all' || exp.spent_on.startsWith(selectedMonth);
    let matchesDate = true;
    if (startDate) matchesDate = matchesDate && exp.spent_on >= startDate;
    if (endDate) matchesDate = matchesDate && exp.spent_on <= endDate;
    return matchesCategory && matchesSearch && matchesMonth && matchesDate;
  });

  const totalFilteredAmount =
    filteredExpenses.reduce((sum, exp) => sum + (exp.amount_minor || 0), 0) / 100;
  const average =
    filteredExpenses.length > 0 ? totalFilteredAmount / filteredExpenses.length : null;

  const activeChips = useMemo(() => {
    const chips: { key: string; label: string; clear: () => void }[] = [];
    if (debouncedSearch)
      chips.push({
        key: 'search',
        label: `Search: ${debouncedSearch}`,
        clear: () => setSearchQuery(''),
      });
    if (selectedCategory !== 'all')
      chips.push({
        key: 'cat',
        label: selectedCategory,
        clear: () => setSelectedCategory('all'),
      });
    if (selectedMonth !== 'all') {
      const m = availableMonths.find((x) => x.value === selectedMonth);
      chips.push({
        key: 'month',
        label: m?.label || selectedMonth,
        clear: () => setSelectedMonth('all'),
      });
    }
    if (startDate || endDate)
      chips.push({
        key: 'range',
        label: `${startDate || '…'} → ${endDate || '…'}`,
        clear: () => {
          setStartDate('');
          setEndDate('');
        },
      });
    return chips;
  }, [debouncedSearch, selectedCategory, selectedMonth, startDate, endDate, availableMonths]);

  const clearAllFilters = () => {
    setSearchQuery('');
    setSelectedCategory('all');
    setSelectedMonth('all');
    setStartDate('');
    setEndDate('');
    setVisibleCount(50);
  };

  useEffect(() => {
    setVisibleCount(50);
  }, [debouncedSearch, selectedCategory, selectedMonth, startDate, endDate]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof filteredExpenses>();
    for (const exp of filteredExpenses.slice(0, visibleCount)) {
      const key = exp.spent_on.split('T')[0];
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(exp);
    }
    return Array.from(map.entries());
  }, [filteredExpenses, visibleCount]);

  const handleExportCSV = () => {
    if (filteredExpenses.length === 0) return;
    const escapeCell = (value: string) => {
      let v = value ?? '';
      if (/^[=+\-@]/.test(v)) v = `'${v}`;
      return `"${v.replace(/"/g, '""')}"`;
    };
    const headers = ['Date', 'Category', 'Amount (PKR)', 'Payment Method', 'Note'];
    const csvRows = filteredExpenses.map((exp) => {
      const date = String(exp.spent_on || '').slice(0, 10);
      const category = exp.category_id || 'Other';
      const amount = (exp.amount_minor / 100).toFixed(2);
      const payment = exp.payment_method || 'cash';
      const note = exp.note || '';
      return [date, category, amount, payment, note].map(escapeCell).join(',');
    });
    const csvContent = '\uFEFF' + [headers.join(','), ...csvRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const localStamp = todayLocal();
    link.setAttribute('download', `transactions_export_${localStamp}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <AppShell>
        <PageHeader title="Transactions" description="Review, filter and export your spending history." />
        <div className="space-y-3">
          <Skeleton className="h-12 w-full" />
          <Card className="p-4">
            <RowSkeleton />
            <RowSkeleton />
            <RowSkeleton />
          </Card>
        </div>
      </AppShell>
    );
  }

  if (!userId) {
    return (
      <AppShell>
        <EmptyState title="Session not found" description="Please sign in again." />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <Dialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Delete transaction?"
        description="This cannot be undone."
        footer={
          <>
            <Button variant="secondary" className="flex-1" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={() => deleteId && handleDeleteExpense(deleteId)}
            >
              Delete
            </Button>
          </>
        }
      />

      <PageHeader
        title="Transactions"
        description="Find, filter and export spending — scan left for what, right for how much."
        action={
          <Button
            variant="secondary"
            onClick={handleExportCSV}
            disabled={filteredExpenses.length === 0}
          >
            <Download size={16} strokeWidth={1.5} />
            Export CSV
          </Button>
        }
      />

      {/* Compact summary bar */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-4 px-1 text-sm">
        <span className="text-[var(--ef-muted)]">
          <span className="ef-emoji mr-1" aria-hidden>
            📋
          </span>
          <span className="font-medium text-[var(--ef-ink)] tabular-nums">
            {filteredExpenses.length}
          </span>{' '}
          transactions
        </span>
        <span className="text-[var(--ef-muted)]">
          Total{' '}
          <span className="font-medium text-[var(--ef-ink)] tabular-nums">
            PKR {formatAmount(totalFilteredAmount, true)}
          </span>
        </span>
        {average !== null && (
          <span className="text-[var(--ef-muted)]">
            Avg{' '}
            <span className="font-medium text-[var(--ef-ink)] tabular-nums">
              PKR {formatAmount(average, true)}
            </span>
          </span>
        )}
      </div>

      {/* Filters */}
      <Card className="p-3 sm:p-4 mb-4">
        <div className="flex flex-col lg:flex-row gap-2 lg:items-center">
          <div className="relative flex-1 min-w-[180px]">
            <Search
              size={16}
              strokeWidth={1.5}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ef-muted)] pointer-events-none"
            />
            <input
              type="text"
              placeholder="Search notes"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="ef-input !pl-9"
              aria-label="Search by note"
            />
          </div>
          <Select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="lg:w-44"
            aria-label="Category filter"
          >
            <option value="all">All categories</option>
            {categoryOptions.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </Select>
          <Select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="lg:w-44"
            aria-label="Month filter"
          >
            <option value="all">All months</option>
            {availableMonths.map((month) => (
              <option key={month.value} value={month.value}>
                {month.label}
              </option>
            ))}
          </Select>
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="lg:!w-36"
              aria-label="Start date"
            />
            <span className="text-xs text-[var(--ef-muted)]">to</span>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="lg:!w-36"
              aria-label="End date"
            />
          </div>
        </div>

        {activeChips.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-[var(--ef-border)]">
            {activeChips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={chip.clear}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[var(--ef-radius-sm)] text-xs font-medium bg-[var(--ef-gray-200)] text-[var(--ef-gray-700)] border border-[var(--ef-border)] hover:bg-[var(--ef-gray-300)] cursor-pointer"
              >
                {chip.label}
                <span aria-hidden>×</span>
              </button>
            ))}
            <button
              type="button"
              onClick={clearAllFilters}
              className="text-xs font-medium text-[var(--ef-accent-warm)] hover:underline cursor-pointer ml-1"
            >
              Clear all
            </button>
          </div>
        )}
      </Card>

      {/* Date-grouped cards (same clean layout on mobile + desktop) */}
      <div className="space-y-4">
        {grouped.length > 0 ? (
          grouped.map(([dateKey, rows]) => (
            <div key={dateKey}>
              <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--ef-muted)] mb-2 px-1">
                {formatDateGroupLabel(dateKey)}
              </p>
              <Card className="divide-y divide-[var(--ef-border)]">
                {rows.map((exp) => {
                  const catName = exp.category_id || 'Other';
                  return (
                    <div
                      key={exp.id}
                      className="flex items-center gap-3 p-3.5 hover:bg-[var(--ef-gray-50)] transition-colors"
                    >
                      <CategoryTile name={catName} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[var(--ef-ink)] truncate">
                          {exp.note || catName}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-xs text-[var(--ef-muted)]">{catName}</span>
                          <span className="text-xs text-[var(--ef-gray-500)]">·</span>
                          <span className="text-xs text-[var(--ef-muted)] tabular-nums">
                            {formatDisplayDate(exp.spent_on)}
                          </span>
                          <PaymentBadge method={exp.payment_method} />
                        </div>
                      </div>
                      <Money
                        value={exp.amount_minor / 100}
                        showSign
                        tone="expense"
                        className="text-sm shrink-0"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="!px-2 text-[var(--ef-danger)]"
                        aria-label="Delete"
                        onClick={() => setDeleteId(exp.id)}
                      >
                        <Trash2 size={14} strokeWidth={1.5} />
                      </Button>
                    </div>
                  );
                })}
              </Card>
            </div>
          ))
        ) : (
          <Card>
            <EmptyState
              emoji="🔍"
              title="No transactions match"
              description="Try adjusting search or filters."
              action={
                activeChips.length > 0 ? (
                  <Button variant="secondary" size="sm" onClick={clearAllFilters}>
                    Clear filters
                  </Button>
                ) : undefined
              }
            />
          </Card>
        )}
        {visibleCount < filteredExpenses.length && (
          <div className="text-center">
            <Button variant="secondary" size="sm" onClick={() => setVisibleCount((c) => c + 50)}>
              Load more
            </Button>
          </div>
        )}
      </div>
    </AppShell>
  );
}
