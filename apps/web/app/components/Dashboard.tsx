'use client';
import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { createClient } from '../../utils/client';
import { useRouter } from 'next/navigation';
import {
  ComposedChart,
  Bar,
  Line,
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

// --- PRE-DEFINED BROAD CATEGORIES ---
const PREDEFINED_CATEGORIES = [
  "Housing",
  "Food",
  "Transportation",
  "Utilities",
  "Health",
  "Shopping",
  "Entertainment",
  "Education",
  "Personal",
  "Other"
];

// --- SMART EMOJI HELPERS ---
const getCategoryEmoji = (name: string) => {
  if (!name) return '🏷️';
  const lower = name.toLowerCase();
  if (lower.includes('education') || lower.includes('school') || lower.includes('college') || lower.includes('uni')) return '🎓';
  if (lower.includes('food') || lower.includes('burger') || lower.includes('eat') || lower.includes('restaurant') || lower.includes('dine')) return '🍔';
  if (lower.includes('grocer') || lower.includes('mart') || lower.includes('supermarket')) return '🛒';
  if (lower.includes('coffee') || lower.includes('cafe') || lower.includes('tea')) return '☕';
  if (lower.includes('petrol') || lower.includes('fuel') || lower.includes('gas')) return '⛽';
  if (lower.includes('transportation') || lower.includes('car') || lower.includes('vehicle') || lower.includes('taxi') || lower.includes('uber')) return '🚗';
  if (lower.includes('travel') || lower.includes('flight') || lower.includes('trip')) return '✈️';
  if (lower.includes('utilit') || lower.includes('bill') || lower.includes('electric') || lower.includes('internet')) return '⚡';
  if (lower.includes('housing') || lower.includes('rent') || lower.includes('house') || lower.includes('home')) return '🏠';
  if (lower.includes('health') || lower.includes('med') || lower.includes('doctor') || lower.includes('pharmacy')) return '💊';
  if (lower.includes('sport') || lower.includes('gym') || lower.includes('fitness') || lower.includes('padel')) return '🎾';
  if (lower.includes('shop') || lower.includes('cloth') || lower.includes('apparel') || lower.includes('shoes')) return '🛍️';
  if (lower.includes('sub') || lower.includes('software') || lower.includes('app') || lower.includes('tech')) return '💻';
  if (lower.includes('entertainment') || lower.includes('movie') || lower.includes('cinema') || lower.includes('netflix') || lower.includes('game')) return '🍿';
  if (lower.includes('gift') || lower.includes('charity') || lower.includes('donation')) return '🎁';
  if (lower.includes('personal') || lower.includes('grooming') || lower.includes('salon')) return '✂️';
  return '🏷️';
};

const getPaymentEmoji = (method: string) => {
  if (method === 'cash') return '💵 Cash';
  if (method === 'card') return '💳 Card';
  if (method === 'bank') return '🏦 Bank';
  return method;
};

export default function Dashboard({ userId }: { userId: string }) {
  const [expenses, setExpenses] = useState<any[]>([]);

  // Salary State
  const [salary, setSalary] = useState<number>(0);
  const [salariesMap, setSalariesMap] = useState<Record<string, number>>({});
  const [totalHistoricalSalary, setTotalHistoricalSalary] = useState<number>(0);
  const [isEditingSalary, setIsEditingSalary] = useState(false);
  const [salaryInput, setSalaryInput] = useState('');

  // Add Expense State
  const [amount, setAmount] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(PREDEFINED_CATEGORIES[0]);
  const [note, setNote] = useState('');
  const [expenseDate, setExpenseDate] = useState(todayLocal());
  const [paymentMethod, setPaymentMethod] = useState('cash');

  // Edit Expense State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editPaymentMethod, setEditPaymentMethod] = useState('cash');

  // UI & Menu States
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [userEmail, setUserEmail] = useState('');

  const [timeFilter, setTimeFilter] = useState<'all' | 'month'>('month');
  const [formError, setFormError] = useState<string | null>(null);
  const amountInputRef = useRef<HTMLInputElement>(null);
  
  const supabase = createClient();
  const router = useRouter();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const formatMoney = (val: number) => {
    return val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const splitMoney = (val: number) => {
    const abs = Math.abs(val);
    const formatted = abs.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    const [whole, dec] = formatted.split('.');
    return { sign: val < 0 ? '-' : '', whole: whole || '0', dec: dec || '00' };
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const datePart = dateStr.split('T')[0];
    const [y, m, d] = datePart.split('-');
    return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  };

  useEffect(() => {
    // Fetch User Email for Profile Menu
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user?.email) setUserEmail(data.user.email);
    });

    const now = new Date();
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

    supabase.from('monthly_salaries').select('month, amount_minor').eq('user_id', userId).then(({ data }) => {
      if (data) {
        let currentSal = 0;
        let totalSal = 0;
        const sMap: Record<string, number> = {};
        
        data.forEach((item) => {
          const val = item.amount_minor / 100;
          totalSal += val;
          sMap[item.month] = val;
          if (item.month === currentMonthStr) currentSal = val;
        });
        
        setSalariesMap(sMap);
        setSalary(currentSal);
        setTotalHistoricalSalary(totalSal);
      } else {
        setSalary(0);
        setTotalHistoricalSalary(0);
        setSalariesMap({});
      }
    });

    supabase.from('expenses').select('*').eq('user_id', userId).order('spent_on', { ascending: false }).order('created_at', { ascending: false }).then(({ data, error }) => {
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

    const { data: existing } = await supabase.from('monthly_salaries').select('id').eq('user_id', userId).eq('month', currentMonthStr).single();

    if (existing) {
      const { error } = await supabase.from('monthly_salaries').update({ amount_minor: amountMinor }).eq('id', existing.id);
      if (error) { setFormError(error.message); return; }
    } else {
      const { error } = await supabase.from('monthly_salaries').insert([{ user_id: userId, month: currentMonthStr, amount_minor: amountMinor }]);
      if (error) { setFormError(error.message); return; }
    }

    const newSalaryVal = amountMinor / 100;
    const difference = newSalaryVal - salary;
    setTotalHistoricalSalary((prev) => prev + difference);
    setSalary(newSalaryVal);
    setSalariesMap(prev => ({ ...prev, [currentMonthStr]: newSalaryVal }));
    setIsEditingSalary(false);
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!selectedCategory) { setFormError('Select a category first.'); return; }

    const amountMinor = Math.round(parseFloat(amount) * 100);
    if (!Number.isFinite(amountMinor) || amountMinor <= 0) { setFormError('Enter an amount greater than 0.'); return; }

    const { data: newExpense, error } = await supabase.from('expenses').insert([{
      user_id: userId, 
      category_id: selectedCategory, 
      amount_minor: amountMinor, 
      spent_on: expenseDate, 
      note: note || null, 
      payment_method: paymentMethod,
    }]).select().single();

    if (error || !newExpense) { setFormError(error?.message || 'Failed to add expense.'); return; }

    setExpenses([newExpense, ...expenses]);
    setAmount('');
    setNote('');
    setPaymentMethod('cash');
    setExpenseDate(todayLocal());
  };

  const handleDeleteExpense = async (id: string) => {
    const previous = expenses;
    setExpenses(expenses.filter((exp) => exp.id !== id));
    const { error } = await supabase.from('expenses').delete().eq('id', id).eq('user_id', userId);
    if (error) { setExpenses(previous); setFormError(error.message); }
  };

  const handleEditClick = (exp: any) => {
    setEditingId(exp.id);
    setEditAmount((exp.amount_minor / 100).toString());
    setEditCategory(exp.category_id || PREDEFINED_CATEGORIES[0]);
    setEditNote(exp.note || '');
    setEditDate(exp.spent_on);
    setEditPaymentMethod(exp.payment_method || 'cash');
  };

  const handleSaveEdit = async (id: string) => {
    const amountMinor = Math.round(parseFloat(editAmount) * 100);
    if (!Number.isFinite(amountMinor) || amountMinor <= 0) { setFormError('Enter an amount greater than 0.'); return; }

    const { data: updatedExpense, error } = await supabase.from('expenses').update({
      category_id: editCategory, 
      amount_minor: amountMinor, 
      note: editNote || null, 
      spent_on: editDate, 
      payment_method: editPaymentMethod,
    }).eq('id', id).eq('user_id', userId).select().single();

    if (error || !updatedExpense) { setFormError(error?.message || 'Failed to update expense.'); return; }

    setExpenses(expenses.map((exp) => (exp.id === id ? { ...exp, ...updatedExpense } : exp)));
    setEditingId(null);
  };

  const filteredExpenses = expenses.filter((exp) => {
    if (timeFilter === 'all') return true;
    const expDate = new Date(exp.spent_on);
    const today = new Date();
    return expDate.getMonth() === today.getMonth() && expDate.getFullYear() === today.getFullYear();
  });

  const totalSpent = filteredExpenses.reduce((sum, exp) => sum + (exp.amount_minor || 0), 0) / 100;
  const remaining = salary - totalSpent;
  const percentUsed = salary > 0 ? ((totalSpent / salary) * 100).toFixed(1) : null;

  const totalAllTimeSpent = expenses.reduce((sum, exp) => sum + (exp.amount_minor || 0), 0) / 100;
  const totalSavings = totalHistoricalSalary - totalAllTimeSpent;

  const expensesByCategory = filteredExpenses.reduce((acc, exp) => {
    const catName = exp.category_id || 'Other'; 
    const amountVal = exp.amount_minor / 100;
    acc[catName] = (acc[catName] || 0) + amountVal;
    return acc;
  }, {} as Record<string, number>);

  const chartData = Object.entries(expensesByCategory)
    .map(([name, value]) => ({ name, value: Number(value) }))
    .sort((a, b) => b.value - a.value);

  const trendData = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const targetMonth = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthLabel = targetMonth.toLocaleDateString('en-GB', { month: 'short' });
    const fullMonthLabel = targetMonth.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    
    const targetMonthStr = `${targetMonth.getFullYear()}-${String(targetMonth.getMonth() + 1).padStart(2, '0')}-01`;
    const monthSalary = salariesMap[targetMonthStr] || 0;

    const monthTotal = expenses.filter((exp) => {
      const expDate = new Date(exp.spent_on);
      return expDate.getMonth() === targetMonth.getMonth() && expDate.getFullYear() === targetMonth.getFullYear();
    }).reduce((sum, exp) => sum + (exp.amount_minor || 0), 0) / 100;

    const monthRemaining = monthSalary > 0 ? monthSalary - monthTotal : 0;

    trendData.push({ month: monthLabel, fullMonthLabel, amount: monthTotal, remaining: monthRemaining });
  }

  const spentSplit = splitMoney(totalSpent);
  const remainingSplit = splitMoney(remaining);
  const savingsSplit = splitMoney(totalSavings);

  return (
    <div 
      className="w-full max-w-6xl mx-auto my-4 sm:my-8 backdrop-blur-3xl text-zinc-900 rounded-[36px] p-5 sm:p-10 shadow-2xl border border-white/80" 
      style={{ backgroundColor: 'rgba(250, 249, 246, 0.95)' }}
    >
      
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-zinc-950 text-white flex items-center justify-center font-black text-xl tracking-tighter shadow-md border border-zinc-800">
            A
          </div>
          <span className="font-bold text-lg tracking-tight text-zinc-900 drop-shadow-sm">ExpenseFlow</span>
        </div>

        <div className="bg-white p-1.5 rounded-full shadow-md border border-zinc-200 inline-flex items-center gap-1">
          <span className="bg-zinc-950 text-white px-5 py-2 rounded-full text-xs sm:text-sm font-bold shadow-sm border border-zinc-200">
            Dashboard
          </span>
          <Link href="/transactions" className="text-zinc-700 hover:text-zinc-950 px-5 py-2 rounded-full text-xs sm:text-sm font-bold transition-colors">
            Transactions
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={() => alert('No new notifications!')} className="w-11 h-11 rounded-full bg-white border border-zinc-300 flex items-center justify-center text-zinc-700 hover:text-zinc-950 shadow-sm transition-colors cursor-pointer hover:bg-zinc-50" title="Notifications">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
          </button>
          
          <div className="relative">
            <button 
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="w-11 h-11 rounded-full bg-gradient-to-br from-[#6B0F06] to-[#F38636] text-white font-black text-sm flex items-center justify-center shadow-md border border-orange-700/50 hover:scale-105 transition-transform cursor-pointer"
            >
              IA
            </button>

            {showProfileMenu && (
              <div className="absolute right-0 mt-3 w-64 bg-white/95 backdrop-blur-3xl rounded-2xl shadow-2xl border border-zinc-200/80 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="px-5 py-4 border-b border-zinc-200/80">
                  <p className="text-sm font-black text-zinc-900">Ibrahim Ali</p>
                  <p className="text-xs font-semibold text-zinc-500 truncate mt-0.5">{userEmail || 'Loading...'}</p>
                </div>
                
                <div className="py-1.5 border-t border-zinc-200/80 bg-red-50/30">
                  <button onClick={handleSignOut} className="w-full flex items-center gap-3 px-5 py-3 text-sm font-black text-red-600 hover:bg-red-50 transition-colors cursor-pointer">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
                    Logout
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col mb-8">
        <p className="text-zinc-700 text-sm mb-1.5 font-semibold">
          Take control of your finances with real-time insights
        </p>
        <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-zinc-950">
          Welcome Back!
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
        
        <div className="lg:col-span-7 rounded-[32px] p-6 sm:p-8 text-white bg-gradient-to-b from-[#450704] via-[#B42910] to-[#F18535] shadow-2xl border border-white/20 flex flex-col justify-between min-h-[370px]">
          <div>
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="text-white/90 text-sm sm:text-base font-bold tracking-wide">📉 Overview</span>
              <button onClick={() => setTimeFilter(timeFilter === 'month' ? 'all' : 'month')} className="bg-white/15 hover:bg-white/25 backdrop-blur-md border border-white/20 px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 transition-colors shadow-sm cursor-pointer">
                <span>{timeFilter === 'month' ? 'This Month' : 'All Time'}</span>
                <span className="text-[10px]">▼</span>
              </button>
            </div>

            <div className="text-4xl sm:text-6xl font-black tracking-tight mb-4 drop-shadow-md">
              <span>PKR {spentSplit.whole}</span>
              <span className="text-white/70">.{spentSplit.dec}</span>
            </div>

            <div className="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur-md border border-white/20 shadow-sm rounded-full px-4 py-1.5 text-xs text-white font-medium tracking-wide">
              <span>↗ {percentUsed !== null ? `${percentUsed}%` : '0.0%'} this month</span>
            </div>
          </div>

          <div className="h-44 mt-8 -mx-2">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={trendData} barCategoryGap="22%">
                <XAxis dataKey="month" stroke="rgba(255,255,255,0.9)" fontSize={12} tickLine={false} axisLine={false} fontWeight={600} />
                
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.15)', radius: 8 }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const spent = Number(payload.find(p => p.dataKey === 'amount')?.value || 0);
                      const remaining = Number(payload.find(p => p.dataKey === 'remaining')?.value || 0);
                      const sp = splitMoney(spent);
                      const rp = splitMoney(remaining);
                      
                      return (
                        <div className="backdrop-blur-xl bg-white/95 text-zinc-900 px-5 py-4 rounded-2xl shadow-xl border border-white/50 min-w-[180px]">
                          <p className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-3 border-b border-zinc-200/80 pb-2">
                            {payload[0].payload.fullMonthLabel}
                          </p>
                          
                          <div className="flex items-center justify-between gap-6 mb-2">
                            <div className="flex items-center gap-1.5">
                              <div className="w-2.5 h-2.5 rounded-sm bg-zinc-300" />
                              <span className="text-xs font-bold text-zinc-600">Spent</span>
                            </div>
                            <span className="font-black text-sm text-zinc-900">
                              PKR {sp.whole}<span className="text-zinc-500">.{sp.dec}</span>
                            </span>
                          </div>
                          
                          <div className="flex items-center justify-between gap-6">
                            <div className="flex items-center gap-1.5">
                              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                              <span className="text-xs font-bold text-zinc-600">Left</span>
                            </div>
                            <span className="font-black text-sm text-emerald-600">
                              {rp.sign}PKR {rp.whole}<span className="opacity-70">.{rp.dec}</span>
                            </span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="amount" fill="rgba(255, 255, 255, 0.9)" radius={[8, 8, 8, 8]} />
                <Line type="monotone" dataKey="remaining" stroke="#10B981" strokeWidth={3} dot={{ r: 4, fill: '#10B981', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-5 rounded-[32px] p-6 sm:p-8 text-white bg-gradient-to-b from-[#450704] via-[#B42910] to-[#F18535] shadow-2xl border border-white/20 flex flex-col justify-between min-h-[370px]">
          <div>
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="text-white/90 text-sm sm:text-base font-bold tracking-wide">💰 Balance & Salary</span>
              <button onClick={() => { setSalaryInput(salary > 0 ? salary.toString() : ''); setIsEditingSalary(!isEditingSalary); }} className="bg-white/15 hover:bg-white/25 backdrop-blur-md border border-white/20 shadow-sm px-4 py-2 rounded-full text-xs font-bold transition-colors cursor-pointer">
                {isEditingSalary ? 'Cancel' : 'Edit Salary'}
              </button>
            </div>

            {isEditingSalary ? (
              <form onSubmit={handleSaveSalary} className="flex gap-2 items-center my-3">
                <input type="number" step="0.01" min="0" value={salaryInput} onChange={(e) => setSalaryInput(e.target.value)} className="w-full px-5 py-3 bg-black/30 backdrop-blur-md text-white placeholder-white/60 rounded-full text-sm font-bold outline-none border border-white/30 shadow-inner" placeholder="Monthly Salary (PKR)" autoFocus />
                <button type="submit" className="bg-white text-zinc-950 px-6 py-3 rounded-full text-sm font-black hover:bg-zinc-100 transition-colors shrink-0 shadow-lg cursor-pointer">Save</button>
              </form>
            ) : (
              <div className="text-4xl sm:text-6xl font-black tracking-tight mb-4 drop-shadow-md">
                <span>{remainingSplit.sign}PKR {remainingSplit.whole}</span>
                <span className="text-white/70">.{remainingSplit.dec}</span>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
              <div className="inline-flex items-center gap-1 bg-white/15 backdrop-blur-md border border-white/20 shadow-sm rounded-full px-4 py-1.5 text-xs font-medium tracking-wide">
                <span>↗ {percentUsed !== null ? `${percentUsed}% used` : 'Set Salary'}</span>
              </div>
              <div className="inline-flex items-center gap-1 bg-white/15 backdrop-blur-md border border-white/20 shadow-sm rounded-full px-4 py-1.5 text-xs font-medium tracking-wide">
                <span>Salary: PKR {formatMoney(salary)}</span>
              </div>
            </div>
          </div>

          <div className="relative pt-6 mt-auto">
            <div className="mx-6 h-3 rounded-t-3xl bg-white/15 backdrop-blur-md border-t border-x border-white/30" />
            <div className="mx-3 h-3 rounded-t-3xl bg-white/25 backdrop-blur-md border-t border-x border-white/40" />
            <div className="p-5 sm:p-6 rounded-[24px] bg-white/30 backdrop-blur-2xl border border-white/50 flex items-center justify-between shadow-inner">
              <div>
                <p className="text-xs font-bold text-white/90 tracking-widest uppercase mb-1">
                  🏦 SAVED &nbsp; {String(now.getMonth() + 1).padStart(2, '0')} / {String(now.getFullYear()).slice(-2)}
                </p>
                <p className="text-xl sm:text-2xl font-black text-white drop-shadow-sm">
                  {savingsSplit.sign}PKR {savingsSplit.whole}.{savingsSplit.dec}
                </p>
              </div>
              <span className="text-xl sm:text-2xl font-black tracking-widest italic text-white/90 drop-shadow-sm">VISA</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 sm:p-8 rounded-[32px] border border-zinc-200 shadow-xl mb-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 px-1">
          <h3 className="text-sm font-black uppercase tracking-widest text-zinc-900 drop-shadow-sm">Log New Expense</h3>
        </div>

        <form onSubmit={handleAddExpense} className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <input type="date" max={todayLocal()} value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} required className="px-4 py-3.5 rounded-xl bg-[#F6F6F7] text-zinc-900 font-semibold w-full text-sm outline-none border border-zinc-200 shadow-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 [color-scheme:light] cursor-pointer transition-all" />
          <input ref={amountInputRef} type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount (PKR)" required className="px-4 py-3.5 rounded-xl bg-[#F6F6F7] text-zinc-900 placeholder:text-zinc-500 font-semibold w-full text-sm outline-none border border-zinc-200 shadow-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all" />
          <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="px-4 py-3.5 rounded-xl bg-[#F6F6F7] text-zinc-900 font-semibold w-full text-sm outline-none border border-zinc-200 shadow-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 cursor-pointer transition-all">
            {PREDEFINED_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{getCategoryEmoji(cat)} {cat}</option>
            ))}
          </select>
          <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="px-4 py-3.5 rounded-xl bg-[#F6F6F7] text-zinc-900 font-semibold w-full text-sm outline-none border border-zinc-200 shadow-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 cursor-pointer transition-all">
            <option value="cash">💵 Cash</option>
            <option value="card">💳 Card</option>
            <option value="bank">🏦 Bank Transfer</option>
          </select>
          <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" className="px-4 py-3.5 rounded-xl bg-[#F6F6F7] text-zinc-900 placeholder:text-zinc-500 font-semibold w-full text-sm outline-none border border-zinc-200 shadow-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all" />
          <button type="submit" className="bg-zinc-950 hover:bg-zinc-800 text-white px-6 py-3.5 rounded-xl font-black text-sm w-full transition-colors cursor-pointer shadow-md">
            Add
          </button>
        </form>
        {formError && <p className="text-red-700 bg-red-50 px-4 py-2 rounded-lg text-xs mt-4 font-bold border border-red-200">{formError}</p>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white p-6 sm:p-8 rounded-[32px] border border-zinc-200 shadow-xl">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-base font-black text-zinc-900 drop-shadow-sm uppercase tracking-wider">Recent Transactions</h3>
            <Link href="/transactions" className="text-xs font-bold text-zinc-700 hover:text-zinc-950 transition-colors border border-zinc-200 bg-zinc-50 px-4 py-2 rounded-xl shadow-sm hover:bg-zinc-100">
              View All
            </Link>
          </div>

          {Array.isArray(filteredExpenses) && filteredExpenses.length > 0 ? (
            <div className="space-y-3">
              {filteredExpenses.slice(0, 5).map((exp) => {
                const catName = exp.category_id || 'Other';
                const catEmoji = getCategoryEmoji(catName);

                return (
                  <div key={exp.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#F8F8F9] p-4 rounded-2xl shadow-sm border border-zinc-200 hover:border-zinc-300 transition-all">
                    {editingId === exp.id ? (
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-6 gap-2 items-center w-full">
                        <input type="date" max={todayLocal()} value={editDate} onChange={(e) => setEditDate(e.target.value)} className="p-2.5 rounded-xl bg-white text-zinc-900 font-semibold w-full text-xs border border-zinc-200 focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20" />
                        <input type="number" step="0.01" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} className="p-2.5 rounded-xl bg-white text-zinc-900 font-semibold w-full text-xs border border-zinc-200 focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20" />
                        <select value={editCategory} onChange={(e) => setEditCategory(e.target.value)} className="p-2.5 rounded-xl bg-white text-zinc-900 font-semibold w-full text-xs border border-zinc-200 focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20">
                          {PREDEFINED_CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                        </select>
                        <select value={editPaymentMethod} onChange={(e) => setEditPaymentMethod(e.target.value)} className="p-2.5 rounded-xl bg-white text-zinc-900 font-semibold w-full text-xs border border-zinc-200 focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20">
                          <option value="cash">Cash</option><option value="card">Card</option><option value="bank">Bank</option>
                        </select>
                        <input type="text" value={editNote} onChange={(e) => setEditNote(e.target.value)} className="p-2.5 rounded-xl bg-white text-zinc-900 font-semibold w-full text-xs border border-zinc-200 focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20" />
                        <div className="flex gap-1.5">
                          <button onClick={() => handleSaveEdit(exp.id)} className="bg-zinc-950 text-white px-3 py-1.5 rounded-xl text-xs font-bold w-full shadow-sm">Save</button>
                          <button onClick={() => setEditingId(null)} className="bg-white border border-zinc-300 text-zinc-800 px-3 py-1.5 rounded-xl text-xs font-bold w-full shadow-sm hover:bg-zinc-50">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-4 min-w-0">
                          <div className="w-12 h-12 rounded-[16px] bg-white border border-zinc-200 shadow-sm flex items-center justify-center text-xl shrink-0">
                            {catEmoji}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-sm text-zinc-950 truncate tracking-wide">
                              {exp.note || catName}
                            </p>
                            <p className="text-xs text-zinc-600 flex items-center gap-1.5 mt-1 font-semibold">
                              <span>{formatDate(exp.spent_on)}</span>
                              {exp.payment_method && (
                                <>
                                  <span className="text-zinc-300">•</span>
                                  <span className="capitalize bg-white border border-zinc-200 px-2 py-0.5 rounded-md text-[10px] text-zinc-700 font-bold shadow-sm">
                                    {getPaymentEmoji(exp.payment_method)}
                                  </span>
                                </>
                              )}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-4">
                          <span className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-white text-zinc-900 border border-zinc-200 shadow-sm">
                            {catName}
                          </span>

                          <p className="font-black text-base sm:text-lg text-[#D92D20] whitespace-nowrap">
                            -PKR {formatMoney(exp.amount_minor / 100)}
                          </p>

                          <div className="flex gap-1.5">
                            <button onClick={() => handleEditClick(exp)} className="text-zinc-500 hover:text-zinc-900 transition-colors p-2 bg-white hover:bg-zinc-50 rounded-xl border border-zinc-200 shadow-sm cursor-pointer" title="Edit expense">
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                            </button>
                            <button onClick={() => handleDeleteExpense(exp.id)} className="text-zinc-500 hover:text-red-700 transition-colors p-2 bg-white hover:bg-red-50 rounded-xl border border-zinc-200 shadow-sm cursor-pointer" title="Delete expense">
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
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
            <div className="bg-zinc-50 rounded-[20px] border border-zinc-200 p-8 text-center shadow-inner">
              <p className="text-zinc-500 text-sm font-bold">No expenses found for this period.</p>
            </div>
          )}
        </div>

        <div className="lg:col-span-5 flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-4">
            {chartData.length > 0 ? (
              chartData.slice(0, 4).map((item) => {
                const p = splitMoney(item.value);
                const pct = totalSpent > 0 ? ((item.value / totalSpent) * 100).toFixed(1) : '0.0';

                return (
                  <div key={item.name} className="bg-white p-6 rounded-[28px] shadow-xl border border-zinc-200 flex flex-col justify-between min-h-[140px] hover:shadow-2xl transition-all">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-black text-zinc-900 truncate tracking-wide">
                        {getCategoryEmoji(item.name)} {item.name}
                      </span>
                      <span className="text-zinc-400 text-xs font-black">↗</span>
                    </div>
                    <div className="mt-4">
                      <p className="text-xl sm:text-2xl font-black tracking-tight text-zinc-950 truncate drop-shadow-sm">
                        PKR {p.whole}
                        <span className="text-zinc-500 font-bold">.{p.dec}</span>
                      </p>
                      <p className="text-[11px] font-black text-[#8A210F] mt-2 bg-orange-50 border border-orange-200 shadow-sm inline-block px-2.5 py-1 rounded-lg">
                        ↗ {pct}% of spending
                      </p>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="col-span-2 bg-white p-6 rounded-[28px] text-center text-zinc-500 text-sm border border-zinc-200 shadow-xl font-bold">
                Log expenses to see category cards
              </div>
            )}
          </div>

          {chartData.length > 0 && (
            <div className="rounded-[32px] p-6 sm:p-8 bg-gradient-to-br from-[#B42910] to-[#F18535] text-white shadow-2xl border border-white/20">
              <p className="text-xs uppercase tracking-widest text-white/90 font-black mb-5 drop-shadow-sm">
                Category Share
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                {chartData.slice(0, 4).map((item, idx) => {
                  const pct = totalSpent > 0 ? ((item.value / totalSpent) * 100).toFixed(1) : '0.0';
                  const sizes = ['w-28 h-28', 'w-24 h-24', 'w-24 h-24', 'w-20 h-20'];
                  return (
                    <div key={item.name} className={`${sizes[idx] || 'w-24 h-24'} rounded-full bg-white/20 backdrop-blur-md border border-white/40 flex flex-col items-center justify-center text-center p-2 shadow-inner`}>
                      <span className="text-[11px] font-bold text-white line-clamp-1 px-1 tracking-widest uppercase drop-shadow-md">
                        {getCategoryEmoji(item.name)} {item.name}
                      </span>
                      <span className="text-sm font-black text-white mt-1 drop-shadow-md">{pct}%</span>
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