'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '../../utils/client';

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

export default function TransactionsPage() {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  
  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  const supabase = createClient();

  useEffect(() => {
    const fetchUserAndData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      
      const uid = session.user.id;
      setUserId(uid);

      // Fetch ALL Expenses
      const { data: expData, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('user_id', uid)
        .order('spent_on', { ascending: false })
        .order('created_at', { ascending: false });
        
      if (!error && expData) {
        setExpenses(expData);
      }
    };

    fetchUserAndData();
  }, [supabase]);

  // Apply Search, Category, and Date Filters
  const filteredExpenses = expenses.filter(exp => {
    const matchesCategory = selectedCategory === 'all' || exp.category_id === selectedCategory;
    const noteText = exp.note ? exp.note.toLowerCase() : '';
    const matchesSearch = noteText.includes(searchQuery.toLowerCase());
    
    let matchesDate = true;
    if (startDate) matchesDate = matchesDate && exp.spent_on >= startDate;
    if (endDate) matchesDate = matchesDate && exp.spent_on <= endDate;

    return matchesCategory && matchesSearch && matchesDate;
  });

  // Export to CSV Logic
  const handleExportCSV = () => {
    if (filteredExpenses.length === 0) return;

    const headers = ['Date', 'Category', 'Amount (PKR)', 'Payment Method', 'Note'];
    
    const csvRows = filteredExpenses.map(exp => {
      const date = exp.spent_on;
      const category = exp.category_id || 'Other';
      const amount = (exp.amount_minor / 100).toFixed(2);
      const payment = exp.payment_method || 'cash';
      const note = exp.note ? `"${exp.note.replace(/"/g, '""')}"` : '';
      
      return `${date},"${category}",${amount},"${payment}",${note}`;
    });

    const csvContent = [headers.join(','), ...csvRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `transactions_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const datePart = dateStr.split('T')[0];
    const [y, m, d] = datePart.split('-');
    return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  };

  const formatMoney = (val: number) => {
    return val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  if (!userId) {
    return <div className="min-h-screen flex items-center justify-center"></div>;
  }

  return (
    <div className="min-h-screen p-4 sm:p-8 font-sans text-zinc-900">
      <div 
        className="max-w-4xl mx-auto mt-8 backdrop-blur-3xl border border-white/50 shadow-2xl rounded-[36px] p-6 sm:p-10"
        style={{ backgroundColor: 'rgba(250, 249, 246, 0.95)' }}
      >
        
        {/* Header & Navigation */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <Link 
              href="/" 
              className="p-3 bg-white border border-zinc-200 shadow-sm rounded-xl text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6" />
              </svg>
            </Link>
            <div>
              <h1 className="text-3xl font-black tracking-tight text-zinc-900">Transactions</h1>
              <p className="text-sm font-semibold text-zinc-500 mt-1">View and filter your complete history</p>
            </div>
          </div>
          
          <button 
            onClick={handleExportCSV}
            disabled={filteredExpenses.length === 0}
            className="flex items-center gap-2 text-sm bg-zinc-950 hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold px-5 py-3 rounded-xl transition-colors shadow-lg cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span>Export CSV</span>
          </button>
        </div>

        {/* Search & Filter Controls */}
        <div className="bg-white/60 p-5 rounded-2xl border border-white/50 mb-8 shadow-sm">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input 
                type="text" 
                placeholder="Search by note..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-white text-zinc-900 placeholder:text-zinc-400 font-semibold text-sm outline-none focus:ring-2 focus:ring-orange-500/20 border border-zinc-200 shadow-sm transition-all"
              />
            </div>
            <select 
              value={selectedCategory} 
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full sm:w-56 px-4 py-3 rounded-xl bg-white text-zinc-900 font-semibold text-sm outline-none border border-zinc-200 shadow-sm focus:ring-2 focus:ring-orange-500/20 cursor-pointer transition-all"
            >
              <option value="all">All Categories</option>
              {PREDEFINED_CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center border-t border-zinc-200/60 pt-4 mt-4">
            <span className="text-zinc-600 text-xs uppercase tracking-wider font-bold w-full sm:w-auto">Date Range:</span>
            <input 
              type="date" 
              value={startDate} 
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full sm:w-auto px-3 py-2 rounded-xl bg-white text-zinc-900 font-semibold text-sm outline-none border border-zinc-200 shadow-sm focus:ring-2 focus:ring-orange-500/20 [color-scheme:light] cursor-pointer"
            />
            <span className="text-zinc-400 hidden sm:inline font-bold">to</span>
            <input 
              type="date" 
              value={endDate} 
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full sm:w-auto px-3 py-2 rounded-xl bg-white text-zinc-900 font-semibold text-sm outline-none border border-zinc-200 shadow-sm focus:ring-2 focus:ring-orange-500/20 [color-scheme:light] cursor-pointer"
            />
            {(startDate || endDate) && (
              <button 
                onClick={() => { setStartDate(''); setEndDate(''); }}
                className="text-xs font-bold text-red-600 hover:text-red-800 transition-colors w-full sm:w-auto text-left sm:text-center mt-1 sm:mt-0 px-3 py-2 bg-red-50 hover:bg-red-100 rounded-lg border border-red-100 cursor-pointer"
              >
                Clear Dates
              </button>
            )}
          </div>
        </div>

        {/* Transactions List */}
        <div className="space-y-3">
          {filteredExpenses.length > 0 ? (
            filteredExpenses.map(exp => {
              const catName = exp.category_id || 'Other';
              
              return (
                <div key={exp.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-[24px] border border-zinc-200 shadow-sm hover:shadow-md transition-all">
                  <div className="flex-1 flex items-center gap-4 min-w-0">
                    <div className="w-12 h-12 rounded-[16px] bg-orange-50 border border-orange-200 shadow-sm flex items-center justify-center text-xl shrink-0">
                      {getCategoryEmoji(catName)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-sm sm:text-base text-zinc-950 truncate tracking-wide">
                        {exp.note || catName}
                      </p>
                      <p className="text-xs text-zinc-600 flex items-center gap-1.5 mt-1 font-semibold">
                        <span>{formatDate(exp.spent_on)}</span>
                        {exp.payment_method && (
                          <>
                            <span className="text-zinc-300">•</span>
                            <span className="capitalize bg-zinc-50 border border-zinc-200 px-2 py-0.5 rounded-md text-[10px] text-zinc-700 font-bold shadow-xs">
                              {getPaymentEmoji(exp.payment_method)}
                            </span>
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between sm:justify-end gap-4">
                    <span className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-zinc-50 text-zinc-800 border border-zinc-200 shadow-sm hidden sm:inline-block">
                      {catName}
                    </span>
                    <p className="font-black text-lg text-[#D92D20] whitespace-nowrap">
                      -PKR {(exp.amount_minor / 100).toFixed(2)}
                    </p>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-16 bg-white/60 rounded-[32px] border border-white/50 shadow-sm">
              <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl shadow-inner border border-zinc-200">
                📭
              </div>
              <p className="text-zinc-900 font-black text-lg">No transactions found</p>
              <p className="text-zinc-500 text-sm font-semibold mt-1">Try adjusting your search or date filters.</p>
            </div>
          )}
        </div>
        
      </div>
    </div>
  );
}