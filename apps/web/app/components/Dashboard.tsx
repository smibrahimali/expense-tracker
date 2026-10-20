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

  // Warning Modal State
  const [pendingExpense, setPendingExpense] = useState<{
    amountMinor: number;
    categoryId: string;
    expenseDate: string;
    note: string;
    paymentMethod: string;
  } | null>(null);

  // Edit Expense State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editPaymentMethod, setEditPaymentMethod] = useState('cash');

  // UI & Menu States
  const [showCategoryForm, setShowCategoryForm] = useState(false);
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

    const amountMajor = amountMinor / 100;
    if (salary > 0 && amountMajor >= salary * 0.3) {
      setPendingExpense({ amountMinor, categoryId: selectedCategory, expenseDate, note, paymentMethod });
      return; 
    }

    await executeAddExpense(amountMinor, selectedCategory, expenseDate, note, paymentMethod);
  };

  const executeAddExpense = async (amtMinor: number, catId: string, date: string, n: string, pMethod: string) => {
    const { data: newExpense, error } = await supabase.from('expenses').insert([{
      user_id: userId, category_id: catId, amount_minor: amtMinor, spent_on: date, note: n || null, payment_method: pMethod,
    }]).select().single();

    if (error || !newExpense) { setFormError(error?.message || 'Failed to add expense.'); return; }

    setExpenses([newExpense, ...expenses]);
    setAmount('');
    setNote('');
    setPaymentMethod('cash');
    setExpenseDate(todayLocal());
    setPendingExpense(null); 
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
      category_id: editCategory, amount_minor: amountMinor, note: editNote || null, spent_on: editDate, payment_method: editPaymentMethod,
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
      className="w-full max-w-6xl mx-auto my-4 sm:my-8 px-4 sm:px-8 text-zinc-900" 
      style={{ backgroundColor: 'transparent' }}
    >
      {/* WARNING MODAL OVERLAY */}
      {pendingExpense && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white/95 backdrop-blur-3xl border border-white/50 shadow-2xl rounded-[32px] p-8 max-w-sm w-full text-center">
            <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-5 text-3xl shadow-inner border border-red-100">
              ⚠️
            </div>
            <h3 className="text-xl font-black text-zinc-950 mb-2">High Expense Warning</h3>
            <p className="text-sm font-semibold text-zinc-600 mb-8 leading-relaxed">
              This expense of <strong className="text-zinc-950">PKR {formatMoney(pendingExpense.amountMinor / 100)}</strong> is <strong className="text-red-600 border-b border-red-200 pb-0.5">over 30%</strong> of your monthly salary. Are you sure you want to log it?
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setPendingExpense(null)} 
                className="flex-1 bg-white border border-zinc-200 text-zinc-800 py-3.5 rounded-xl font-bold shadow-sm hover:bg-zinc-50 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button 
                onClick={() => executeAddExpense(pendingExpense.amountMinor, pendingExpense.categoryId, pendingExpense.expenseDate, pendingExpense.note, pendingExpense.paymentMethod)} 
                className="flex-1 bg-gradient-to-br from-[#B42910] to-[#D92D20] text-white py-3.5 rounded-xl font-black shadow-lg transition-all cursor-pointer hover:opacity-90"
              >
                Yes, log it
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-10">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-[14px] bg-zinc-950 flex items-center justify-center shadow-lg border border-zinc-800 relative overflow-hidden shrink-0">
            <div className="absolute inset-0 bg-gradient-to-br from-[#F38636]/20 to-[#6B0F06]/20 opacity-60"></div>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="relative z-10">
              <rect x="3" y="3" width="14" height="18" rx="2" ry="2"></rect>
              <rect x="6" y="6" width="8" height="3" rx="0.5" fill="rgba(255,255,255,0.2)" stroke="none"></rect>
              <line x1="6" y1="12" x2="8" y2="12" strokeWidth="2"></line>
              <line x1="10" y1="12" x2="12" y2="12" strokeWidth="2"></line>
              <line x1="6" y1="15" x2="8" y2="15" strokeWidth="2"></line>
              <line x1="10" y1="15" x2="12" y2="15" strokeWidth="2"></line>
              <line x1="6" y1="18" x2="8" y2="18" strokeWidth="2"></line>
              <circle cx="16" cy="16" r="6" fill="#09090b" stroke="#F38636" strokeWidth="2"></circle>
              <line x1="20.24" y1="20.24" x2="23" y2="23" stroke="#F38636" strokeWidth="2.5"></line>
              <path d="M16 13v6" stroke="#F38636" strokeWidth="1.5"></path>
              <path d="M14.5 14.5c-.8 0-1.5.3-1.5 1s.7 1 1.5 1 1.5.3 1.5 1-.7 1-1.5 1" stroke="#F38636" strokeWidth="1.5"></path>
            </svg>
          </div>
          <span className="font-bold text-xl tracking-tight text-white drop-shadow-md">ExpenseFlow</span>
        </div>

        <div className="backdrop-blur-2xl bg-white/30 p-1.5 rounded-full shadow-lg border border-white/40 inline-flex items-center gap-1 w-full sm:w-auto overflow-x-auto justify-start sm:justify-center">
          <span className="bg-zinc-950 text-white px-5 py-2.5 rounded-full text-xs sm:text-sm font-bold shadow-sm border border-zinc-800 flex items-center gap-2 whitespace-nowrap">
            <span>🏠</span> Dashboard
          </span>
          <Link href="/transactions" className="text-zinc-900 hover:bg-white/50 px-5 py-2.5 rounded-full text-xs sm:text-sm font-bold transition-colors flex items-center gap-2 whitespace-nowrap">
            <span>📜</span> Transactions
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <button 
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="w-11 h-11 rounded-full bg-gradient-to-br from-[#6B0F06] to-[#F38636] text-white font-black text-sm flex items-center justify-center shadow-lg border border-orange-500/50 hover:scale-105 transition-transform cursor-pointer"
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

      <div className="flex flex-col mb-8 text-center sm:text-left">
        <p className="text-white/80 text-sm sm:text-base mb-1.5 font-semibold drop-shadow-md">
          Take control of your finances with real-time insights
        </p>
        <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white drop-shadow-xl">
          Welcome Back!
        </h1>
      </div>

      {/* Hero Dashboards */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
        <div className="lg:col-span-7 rounded-[32px] p-5 sm:p-8 text-white bg-gradient-to-b from-[#450704] via-[#B42910] to-[#F18535] shadow-2xl border border-white/20 flex flex-col justify-between min-h-[300px] sm:min-h-[370px]">
          <div>
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="text-white/90 text-sm sm:text-base font-bold tracking-wide">📉 Overview</span>
              <button onClick={() => setTimeFilter(timeFilter === 'month' ? 'all' : 'month')} className="bg-white/15 hover:bg-white/25 backdrop-blur-md border border-white/20 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs font-bold flex items-center gap-2 transition-colors shadow-sm cursor-pointer">
                <span>{timeFilter === 'month' ? 'This Month' : 'All Time'}</span>
                <span className="text-[10px]">▼</span>
              </button>
            </div>
            <div className="text-3xl sm:text-6xl font-black tracking-tight mb-4 drop-shadow-md flex items-end">
              <span>PKR {spentSplit.whole}</span>
              <span className="text-white/70 text-2xl sm:text-4xl pb-1 sm:pb-1.5">.{spentSplit.dec}</span>
            </div>
            <div className="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur-md border border-white/20 shadow-sm rounded-full px-3 sm:px-4 py-1 sm:py-1.5 text-xs text-white font-medium tracking-wide">
              <span>↗ {percentUsed !== null ? `${percentUsed}%` : '0.0%'} this month</span>
            </div>
          </div>
          <div className="h-32 sm:h-44 mt-6 sm:mt-8 -mx-2">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={trendData} barCategoryGap="22%">
                <XAxis dataKey="month" stroke="rgba(255,255,255,0.9)" fontSize={10} tickLine={false} axisLine={false} fontWeight={600} />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.15)', radius: 8 }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const spent = Number(payload.find(p => p.dataKey === 'amount')?.value || 0);
                      const remaining = Number(payload.find(p => p.dataKey === 'remaining')?.value || 0);
                      const sp = splitMoney(spent);
                      const rp = splitMoney(remaining);
                      return (
                        <div className="backdrop-blur-xl bg-white/95 text-zinc-900 px-4 sm:px-5 py-3 sm:py-4 rounded-2xl shadow-xl border border-white/50 min-w-[150px] sm:min-w-[180px]">
                          <p className="text-[10px] sm:text-xs font-black text-zinc-400 uppercase tracking-widest mb-2 sm:mb-3 border-b border-zinc-200/80 pb-2">
                            {payload[0].payload.fullMonthLabel}
                          </p>
                          <div className="flex items-center justify-between gap-4 sm:gap-6 mb-2">
                            <div className="flex items-center gap-1.5">
                              <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-sm bg-zinc-300" />
                              <span className="text-[10px] sm:text-xs font-bold text-zinc-600">Spent</span>
                            </div>
                            <span className="font-black text-xs sm:text-sm text-zinc-900">
                              PKR {sp.whole}<span className="text-zinc-500">.{sp.dec}</span>
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-4 sm:gap-6">
                            <div className="flex items-center gap-1.5">
                              <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-emerald-500" />
                              <span className="text-[10px] sm:text-xs font-bold text-zinc-600">Left</span>
                            </div>
                            <span className="font-black text-xs sm:text-sm text-emerald-600">
                              {rp.sign}PKR {rp.whole}<span className="opacity-70">.{rp.dec}</span>
                            </span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="amount" fill="rgba(255, 255, 255, 0.9)" radius={[6, 6, 6, 6]} />
                <Line type="monotone" dataKey="remaining" stroke="#10B981" strokeWidth={2.5} dot={{ r: 3, fill: '#10B981', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 5 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-5 rounded-[32px] p-5 sm:p-8 text-white bg-gradient-to-b from-[#450704] via-[#B42910] to-[#F18535] shadow-2xl border border-white/20 flex flex-col justify-between min-h-[300px] sm:min-h-[370px]">
          <div>
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="text-white/90 text-sm sm:text-base font-bold tracking-wide">💰 Balance & Salary</span>
              <button onClick={() => { setSalaryInput(salary > 0 ? salary.toString() : ''); setIsEditingSalary(!isEditingSalary); }} className="bg-white/15 hover:bg-white/25 backdrop-blur-md border border-white/20 shadow-sm px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs font-bold transition-colors cursor-pointer">
                {isEditingSalary ? 'Cancel' : 'Edit Salary'}
              </button>
            </div>
            {isEditingSalary ? (
              <form onSubmit={handleSaveSalary} className="flex gap-2 items-center my-3">
                <input type="number" step="0.01" min="0" value={salaryInput} onChange={(e) => setSalaryInput(e.target.value)} className="w-full px-4 sm:px-5 py-2.5 sm:py-3 bg-black/30 backdrop-blur-md text-white placeholder-white/60 rounded-full text-sm font-bold outline-none border border-white/30 shadow-inner" placeholder="Monthly Salary (PKR)" autoFocus />
                <button type="submit" className="bg-white text-zinc-950 px-4 sm:px-6 py-2.5 sm:py-3 rounded-full text-sm font-black hover:bg-zinc-100 transition-colors shrink-0 shadow-lg cursor-pointer">Save</button>
              </form>
            ) : (
              <div className="text-3xl sm:text-6xl font-black tracking-tight mb-4 drop-shadow-md flex items-end">
                <span>{remainingSplit.sign}PKR {remainingSplit.whole}</span>
                <span className="text-white/70 text-2xl sm:text-4xl pb-1 sm:pb-1.5">.{remainingSplit.dec}</span>
              </div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
              <div className="inline-flex items-center gap-1 bg-white/15 backdrop-blur-md border border-white/20 shadow-sm rounded-full px-3 sm:px-4 py-1 sm:py-1.5 text-xs font-medium tracking-wide">
                <span>↗ {percentUsed !== null ? `${percentUsed}% used` : 'Set Salary'}</span>
              </div>
              <div className="inline-flex items-center gap-1 bg-white/15 backdrop-blur-md border border-white/20 shadow-sm rounded-full px-3 sm:px-4 py-1 sm:py-1.5 text-xs font-medium tracking-wide">
                <span>Salary: PKR {formatMoney(salary)}</span>
              </div>
            </div>
          </div>
          <div className="relative pt-6 mt-auto">
            <div className="mx-4 sm:mx-6 h-2 sm:h-3 rounded-t-2xl sm:rounded-t-3xl bg-white/15 backdrop-blur-md border-t border-x border-white/30" />
            <div className="mx-2 sm:mx-3 h-2 sm:h-3 rounded-t-2xl sm:rounded-t-3xl bg-white/25 backdrop-blur-md border-t border-x border-white/40" />
            <div className="p-4 sm:p-6 rounded-[20px] sm:rounded-[24px] bg-white/30 backdrop-blur-2xl border border-white/50 flex items-center justify-between shadow-inner">
              <div>
                <p className="text-[10px] sm:text-xs font-bold text-white/90 tracking-widest uppercase mb-0.5 sm:mb-1">
                  🏦 SAVED &nbsp; {String(now.getMonth() + 1).padStart(2, '0')} / {String(now.getFullYear()).slice(-2)}
                </p>
                <p className="text-lg sm:text-2xl font-black text-white drop-shadow-sm">
                  {savingsSplit.sign}PKR {savingsSplit.whole}.{savingsSplit.dec}
                </p>
              </div>
              <span className="text-lg sm:text-2xl font-black tracking-widest italic text-white/90 drop-shadow-sm">VISA</span>
            </div>
          </div>
        </div>
      </div>

      {/* Log New Expense Bar */}
      <div className="backdrop-blur-3xl bg-white/30 p-5 sm:p-8 rounded-[24px] sm:rounded-[32px] border border-white/40 shadow-2xl mb-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-4 mb-4 sm:mb-6 px-1">
          <h3 className="text-sm font-black uppercase tracking-widest text-zinc-900 drop-shadow-sm">Log New Expense</h3>
        </div>
        <form onSubmit={handleAddExpense} className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <input type="date" max={todayLocal()} value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} required className="px-4 py-3 sm:py-3.5 rounded-xl bg-white/60 text-zinc-900 font-bold w-full text-sm outline-none border border-white/40 shadow-sm focus:bg-white/80 focus:ring-2 focus:ring-orange-500/30 [color-scheme:light] cursor-pointer transition-all" />
          <input ref={amountInputRef} type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount (PKR)" required className="px-4 py-3 sm:py-3.5 rounded-xl bg-white/60 text-zinc-900 placeholder:text-zinc-600 font-bold w-full text-sm outline-none border border-white/40 shadow-sm focus:bg-white/80 focus:ring-2 focus:ring-orange-500/30 transition-all" />
          <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="px-4 py-3 sm:py-3.5 rounded-xl bg-white/60 text-zinc-900 font-bold w-full text-sm outline-none border border-white/40 shadow-sm focus:bg-white/80 focus:ring-2 focus:ring-orange-500/30 cursor-pointer transition-all">
            {PREDEFINED_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{getCategoryEmoji(cat)} {cat}</option>
            ))}
          </select>
          <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="px-4 py-3 sm:py-3.5 rounded-xl bg-white/60 text-zinc-900 font-bold w-full text-sm outline-none border border-white/40 shadow-sm focus:bg-white/80 focus:ring-2 focus:ring-orange-500/30 cursor-pointer transition-all">
            <option value="cash">💵 Cash</option>
            <option value="card">💳 Card</option>
            <option value="bank">🏦 Bank Transfer</option>
          </select>
          <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" className="px-4 py-3 sm:py-3.5 rounded-xl bg-white/60 text-zinc-900 placeholder:text-zinc-600 font-bold w-full text-sm outline-none border border-white/40 shadow-sm focus:bg-white/80 focus:ring-2 focus:ring-orange-500/30 transition-all" />
          <button type="submit" className="bg-zinc-950 hover:bg-zinc-800 text-white px-6 py-3 sm:py-3.5 rounded-xl font-black text-sm w-full transition-colors cursor-pointer shadow-xl border border-zinc-800">
            ➕ Add
          </button>
        </form>
        {formError && <p className="text-red-800 bg-red-100/80 px-4 py-2 rounded-lg text-xs mt-4 font-bold border border-red-200">{formError}</p>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* RECENT TRANSACTIONS CONTAINER */}
        <div className="lg:col-span-7 backdrop-blur-3xl bg-white/30 p-5 sm:p-8 rounded-[24px] sm:rounded-[32px] border border-white/40 shadow-2xl overflow-hidden w-full">
          <div className="flex justify-between items-center mb-5 sm:mb-6">
            <h3 className="text-sm sm:text-base font-black text-zinc-900 drop-shadow-sm uppercase tracking-wider">Recent Transactions</h3>
            <Link href="/transactions" className="text-xs font-bold text-zinc-900 hover:bg-white/80 transition-colors border border-white/50 bg-white/50 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl shadow-sm">
              View All
            </Link>
          </div>

          {Array.isArray(filteredExpenses) && filteredExpenses.length > 0 ? (
            <div className="space-y-3">
              {filteredExpenses.slice(0, 5).map((exp) => {
                const catName = exp.category_id || 'Other';
                const catEmoji = getCategoryEmoji(catName);

                return (
                  <div key={exp.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 bg-white/50 p-3 sm:p-4 rounded-xl sm:rounded-2xl shadow-sm border border-white/40 hover:bg-white/70 transition-all w-full overflow-hidden">
                    
                    {/* EDIT STATE */}
                    {editingId === exp.id ? (
                      <div className="flex-1 grid grid-cols-2 md:grid-cols-3 gap-3 w-full">
                        <input type="date" max={todayLocal()} value={editDate} onChange={(e) => setEditDate(e.target.value)} className="p-2 sm:p-2.5 rounded-lg sm:rounded-xl bg-white/80 text-zinc-900 font-bold w-full text-[10px] sm:text-xs border border-white/50 focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30" />
                        <input type="number" step="0.01" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} className="p-2 sm:p-2.5 rounded-lg sm:rounded-xl bg-white/80 text-zinc-900 font-bold w-full text-[10px] sm:text-xs border border-white/50 focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30" />
                        <select value={editCategory} onChange={(e) => setEditCategory(e.target.value)} className="p-2 sm:p-2.5 rounded-lg sm:rounded-xl bg-white/80 text-zinc-900 font-bold w-full text-[10px] sm:text-xs border border-white/50 focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30">
                          {PREDEFINED_CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                        </select>
                        <select value={editPaymentMethod} onChange={(e) => setEditPaymentMethod(e.target.value)} className="p-2 sm:p-2.5 rounded-lg sm:rounded-xl bg-white/80 text-zinc-900 font-bold w-full text-[10px] sm:text-xs border border-white/50 focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30">
                          <option value="cash">Cash</option><option value="card">Card</option><option value="bank">Bank</option>
                        </select>
                        <input type="text" value={editNote} onChange={(e) => setEditNote(e.target.value)} className="p-2 sm:p-2.5 rounded-lg sm:rounded-xl bg-white/80 text-zinc-900 font-bold w-full text-[10px] sm:text-xs border border-white/50 focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30" placeholder="Note" />
                        <div className="flex gap-2 w-full">
                          <button onClick={() => handleSaveEdit(exp.id)} className="flex-1 bg-zinc-950 text-white px-2 py-1.5 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-bold shadow-sm cursor-pointer">Save</button>
                          <button onClick={() => setEditingId(null)} className="flex-1 bg-white/60 border border-white/50 text-zinc-900 px-2 py-1.5 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-bold shadow-sm hover:bg-white/80 cursor-pointer">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* NORMAL STATE - LEFT COLUMN (Icon, Title, Date) */}
                        <div className="flex items-center gap-3 sm:gap-4 w-full md:flex-1 min-w-0">
                          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-[12px] sm:rounded-[16px] bg-white/60 border border-white/50 shadow-inner flex items-center justify-center text-lg sm:text-xl shrink-0">
                            {catEmoji}
                          </div>
                          <div className="flex flex-col min-w-0 flex-1">
                            <p className="font-bold text-xs sm:text-sm text-zinc-950 tracking-wide break-words leading-tight">
                              {exp.note || catName}
                            </p>
                            <div className="flex items-center gap-1.5 sm:gap-2 mt-0.5 sm:mt-1 flex-wrap">
                              <span className="text-[10px] sm:text-xs text-zinc-800 font-bold whitespace-nowrap">{formatDate(exp.spent_on)}</span>
                              {exp.payment_method && (
                                <span className="capitalize bg-white/80 border border-white/50 px-1.5 py-0.5 rounded-md text-[9px] sm:text-[10px] text-zinc-800 font-bold shadow-xs whitespace-nowrap">
                                  {getPaymentEmoji(exp.payment_method)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* NORMAL STATE - CENTER COLUMN (Category Pill) */}
                        <div className="hidden md:flex md:flex-1 items-center justify-center border-l border-r border-white/30 px-2 min-w-0">
                          <span className="px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[10px] sm:text-[11px] font-bold bg-white/60 text-zinc-900 border border-white/50 shadow-sm truncate max-w-full">
                            {catName}
                          </span>
                        </div>

                        {/* NORMAL STATE - RIGHT COLUMN (Amount, Actions) - FIXED OVERLAP */}
                        <div className="flex items-center justify-between md:justify-end gap-2 sm:gap-3 w-full md:w-auto md:flex-1 mt-2 md:mt-0 pt-2 md:pt-0 border-t md:border-0 border-white/30 min-w-0 md:pl-6">
                          
                          <span className="md:hidden px-2 py-1 rounded-md text-[9px] font-bold bg-white/60 text-zinc-900 border border-white/50 shadow-sm truncate max-w-[90px] shrink-0">
                            {catName}
                          </span>

                          <p className="font-black text-sm sm:text-base text-[#B42910] drop-shadow-sm ml-auto text-right leading-tight">
                            -PKR {formatMoney(exp.amount_minor / 100)}
                          </p>

                          {/* DO NOT CHANGE DELETE SECTION AS REQUESTED */}
                          <div className="flex gap-1 sm:gap-1.5 shrink-0 ml-1 sm:ml-2">
                            <button onClick={() => handleEditClick(exp)} className="text-zinc-600 hover:text-zinc-950 transition-colors p-1.5 sm:p-2 bg-white/40 hover:bg-white/80 rounded-lg sm:rounded-xl border border-white/50 shadow-sm cursor-pointer" title="Edit expense">
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" className="sm:w-4 sm:h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                            </button>
                            <button onClick={() => handleDeleteExpense(exp.id)} className="text-zinc-600 hover:text-red-700 transition-colors p-1.5 sm:p-2 bg-white/40 hover:bg-red-50 rounded-lg sm:rounded-xl border border-white/50 shadow-sm cursor-pointer" title="Delete expense">
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" className="sm:w-4 sm:h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
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
            <div className="bg-white/40 rounded-[16px] sm:rounded-[20px] border border-white/50 p-6 sm:p-8 text-center shadow-sm">
              <p className="text-zinc-700 text-xs sm:text-sm font-bold">No expenses found for this period.</p>
            </div>
          )}
        </div>

        <div className="lg:col-span-5 flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {chartData.length > 0 ? (
              chartData.slice(0, 4).map((item) => {
                const p = splitMoney(item.value);
                const pct = totalSpent > 0 ? ((item.value / totalSpent) * 100).toFixed(1) : '0.0';

                return (
                  <div key={item.name} className="backdrop-blur-3xl bg-white/30 p-4 sm:p-5 lg:p-6 rounded-[20px] sm:rounded-[28px] shadow-xl border border-white/40 flex flex-col justify-between min-h-[120px] sm:min-h-[140px] hover:bg-white/40 transition-all overflow-hidden">
                    <div className="flex items-center justify-between gap-1 sm:gap-2">
                      <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
                        <span className="text-base sm:text-xl drop-shadow-sm shrink-0">{getCategoryEmoji(item.name)}</span>
                        <span className="text-[10px] sm:text-xs lg:text-sm font-black text-zinc-900 truncate tracking-wide drop-shadow-sm uppercase">
                          {item.name}
                        </span>
                      </div>
                      <span className="text-zinc-700 text-[10px] sm:text-xs font-black shrink-0">↗</span>
                    </div>
                    <div className="mt-3 sm:mt-4">
                      {/* FIXED: Dynamic Scaling for PKR Amounts */}
                      <p className="text-[17px] sm:text-xl lg:text-2xl font-black tracking-tight text-zinc-950 drop-shadow-sm leading-tight break-words">
                        PKR {p.whole}
                        <span className="text-zinc-700 font-bold text-sm lg:text-lg">.{p.dec}</span>
                      </p>
                      <p className="text-[9px] sm:text-[11px] font-black text-[#8A210F] mt-1.5 sm:mt-2 bg-white/50 border border-white/40 shadow-sm inline-block px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-md sm:rounded-lg break-words max-w-full">
                        ↗ {pct}% of spending
                      </p>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="col-span-2 backdrop-blur-3xl bg-white/30 p-5 sm:p-6 rounded-[20px] sm:rounded-[28px] text-center text-zinc-800 text-xs sm:text-sm border border-white/40 shadow-xl font-bold">
                Log expenses to see category cards
              </div>
            )}
          </div>

          {/* BUBBLE CHART */}
          {chartData.length > 0 && (
            <div className="rounded-[24px] sm:rounded-[32px] p-5 sm:p-8 bg-gradient-to-br from-[#B42910] to-[#F18535] text-white shadow-2xl border border-white/20">
              <p className="text-[10px] sm:text-xs uppercase tracking-widest text-white/90 font-black mb-4 sm:mb-5 drop-shadow-sm text-center sm:text-left">
                Category Share
              </p>
              <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 lg:gap-8">
                {chartData.slice(0, 4).map((item) => {
                  const pct = totalSpent > 0 ? ((item.value / totalSpent) * 100).toFixed(1) : '0.0';
                  // FIXED: Uniform aspect-square sizing so bubbles are perfect circles
                  return (
                    <div key={item.name} className="w-24 h-24 sm:w-28 sm:h-28 lg:w-32 lg:h-32 aspect-square rounded-full bg-white/20 backdrop-blur-md border border-white/40 flex flex-col items-center justify-center text-center p-2 shadow-inner shrink-0">
                      <span className="text-xl sm:text-2xl lg:text-3xl drop-shadow-md mb-1">{getCategoryEmoji(item.name)}</span>
                      <span className="text-[8px] sm:text-[9px] lg:text-[10px] font-bold text-white line-clamp-2 leading-tight px-1 tracking-widest uppercase drop-shadow-md w-full text-center break-words">
                        {item.name}
                      </span>
                      <span className="text-xs sm:text-sm lg:text-base font-black text-white mt-1 drop-shadow-md">{pct}%</span>
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