'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '../../utils/client';

// --- PRE-DEFINED BROAD CATEGORIES ---
const PREDEFINED_CATEGORIES = [
  "Housing", "Food", "Transportation", "Utilities", "Health", "Shopping", 
  "Entertainment", "Education", "Personal", "Other"
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
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  const supabase = createClient();

  useEffect(() => {
    const fetchUserAndData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      
      const uid = session.user.id;
      setUserId(uid);

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

  const handleDeleteExpense = async (id: string) => {
    const previous = expenses;
    setExpenses(expenses.filter((exp) => exp.id !== id));
    const { error } = await supabase.from('expenses').delete().eq('id', id).eq('user_id', userId);
    if (error) {
      console.error('Failed to delete expense:', error);
      setExpenses(previous);
      alert(error.message);
    }
  };

  // Generate dynamic month list from available expenses (e.g., "2026-10")
  const availableMonths = Array.from(new Set(expenses.map(exp => exp.spent_on.substring(0, 7))))
    .sort((a, b) => b.localeCompare(a))
    .map(ym => {
      const [y, m] = ym.split('-');
      const date = new Date(Number(y), Number(m) - 1);
      return {
        value: ym,
        label: date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
      };
    });

  const filteredExpenses = expenses.filter(exp => {
    const matchesCategory = selectedCategory === 'all' || exp.category_id === selectedCategory;
    const noteText = exp.note ? exp.note.toLowerCase() : '';
    const matchesSearch = noteText.includes(searchQuery.toLowerCase());
    
    // Month Filter Logic
    const matchesMonth = selectedMonth === 'all' || exp.spent_on.startsWith(selectedMonth);
    
    // Date Range Logic
    let matchesDate = true;
    if (startDate) matchesDate = matchesDate && exp.spent_on >= startDate;
    if (endDate) matchesDate = matchesDate && exp.spent_on <= endDate;

    return matchesCategory && matchesSearch && matchesMonth && matchesDate;
  });

  const totalFilteredAmount = filteredExpenses.reduce((sum, exp) => sum + (exp.amount_minor || 0), 0) / 100;

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
    <div className="w-full max-w-6xl mx-auto my-4 sm:my-8 px-4 sm:px-8 font-sans text-zinc-900" style={{ backgroundColor: 'transparent' }}>
      
      {/* Unifying Main Card perfectly matching Dashboard */}
      <div className="backdrop-blur-3xl bg-white/30 border border-white/40 shadow-2xl rounded-[24px] sm:rounded-[36px] p-5 sm:p-10">
        
        {/* Header & Navigation */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-4 mb-6 sm:mb-8 text-center sm:text-left">
          <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 w-full sm:w-auto">
            <Link 
              href="/" 
              className="w-12 h-12 flex items-center justify-center bg-white/40 border border-white/50 shadow-md rounded-[14px] text-zinc-800 hover:text-zinc-950 hover:bg-white/60 transition-all self-start sm:self-auto shrink-0"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6" />
              </svg>
            </Link>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-zinc-950 drop-shadow-sm">📜 Transactions Ledger</h1>
              <p className="text-xs sm:text-sm font-bold text-zinc-700 mt-0.5 sm:mt-1 drop-shadow-sm">View and filter your complete history</p>
            </div>
          </div>
          
          <button 
            onClick={handleExportCSV}
            disabled={filteredExpenses.length === 0}
            className="flex items-center justify-center gap-2 text-xs sm:text-sm bg-zinc-950 hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black w-full sm:w-auto px-5 sm:px-6 py-3 sm:py-3.5 rounded-xl sm:rounded-2xl transition-all shadow-xl cursor-pointer mt-2 sm:mt-0 border border-zinc-800"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" className="sm:w-[18px] sm:h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span>Export CSV</span>
          </button>
        </div>

        {/* High-Contrast Summary Headers */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 mb-6 sm:mb-8">
            <div className="backdrop-blur-md bg-white/30 p-5 sm:p-6 rounded-[20px] sm:rounded-[28px] border border-white/40 shadow-xl flex flex-col justify-center">
                <span className="text-[10px] sm:text-xs font-black text-zinc-700 uppercase tracking-widest mb-1 sm:mb-1.5 drop-shadow-sm">📋 Total Transactions</span>
                <span className="text-3xl sm:text-4xl font-black text-zinc-950 drop-shadow-sm">{filteredExpenses.length}</span>
            </div>
            
            <div className="bg-gradient-to-br from-[#450704] via-[#B42910] to-[#F18535] p-5 sm:p-6 rounded-[20px] sm:rounded-[28px] border border-white/20 shadow-2xl flex flex-col justify-center text-white">
                <span className="text-[10px] sm:text-xs font-black text-white/90 uppercase tracking-widest mb-1 sm:mb-1.5 drop-shadow-sm">💸 Filtered Amount</span>
                <span className="text-3xl sm:text-4xl font-black text-white drop-shadow-md">-PKR {formatMoney(totalFilteredAmount)}</span>
            </div>
        </div>

        {/* Search & Filter Controls */}
        <div className="backdrop-blur-3xl bg-white/30 p-4 sm:p-6 rounded-[24px] sm:rounded-[28px] border border-white/40 mb-6 sm:mb-8 shadow-xl">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            {/* Search Input */}
            <div className="relative w-full">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 sm:w-[18px] sm:h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input 
                type="text" 
                placeholder="Search by note..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 sm:pl-12 pr-4 py-3 sm:py-3.5 rounded-xl sm:rounded-2xl bg-white/60 text-zinc-950 placeholder:text-zinc-600 font-bold text-xs sm:text-sm outline-none border border-white/40 shadow-sm focus:bg-white/80 focus:ring-2 focus:ring-orange-500/30 transition-all"
              />
            </div>

            {/* Category Dropdown */}
            <select 
              value={selectedCategory} 
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-4 py-3 sm:py-3.5 rounded-xl sm:rounded-2xl bg-white/60 text-zinc-950 font-bold text-xs sm:text-sm outline-none border border-white/40 shadow-sm focus:bg-white/80 focus:ring-2 focus:ring-orange-500/30 cursor-pointer transition-all"
            >
              <option value="all">🏷️ All Categories</option>
              {PREDEFINED_CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{getCategoryEmoji(cat)} {cat}</option>
              ))}
            </select>

            {/* Month Filter Dropdown */}
            <select 
              value={selectedMonth} 
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full px-4 py-3 sm:py-3.5 rounded-xl sm:rounded-2xl bg-white/60 text-zinc-950 font-bold text-xs sm:text-sm outline-none border border-white/40 shadow-sm focus:bg-white/80 focus:ring-2 focus:ring-orange-500/30 cursor-pointer transition-all"
            >
              <option value="all">📅 All Months</option>
              {availableMonths.map(month => (
                <option key={month.value} value={month.value}>{month.label}</option>
              ))}
            </select>
          </div>
          
          {/* Advanced Date Range */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-start sm:items-center border-t border-white/30 pt-4 sm:pt-5 mt-4 sm:mt-5">
            <span className="text-zinc-800 text-[10px] sm:text-xs uppercase tracking-widest font-black w-full sm:w-auto drop-shadow-sm">📆 Custom Range:</span>
            
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto items-center">
              <input 
                type="date" 
                value={startDate} 
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full sm:w-auto px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg sm:rounded-xl bg-white/60 text-zinc-950 font-bold text-xs sm:text-sm outline-none border border-white/40 shadow-sm focus:bg-white/80 focus:ring-2 focus:ring-orange-500/30 [color-scheme:light] cursor-pointer transition-all"
              />
              <span className="text-zinc-800 font-black drop-shadow-sm text-xs sm:text-sm">to</span>
              <input 
                type="date" 
                value={endDate} 
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full sm:w-auto px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg sm:rounded-xl bg-white/60 text-zinc-950 font-bold text-xs sm:text-sm outline-none border border-white/40 shadow-sm focus:bg-white/80 focus:ring-2 focus:ring-orange-500/30 [color-scheme:light] cursor-pointer transition-all"
              />
            </div>
            
            {(startDate || endDate) && (
              <button 
                onClick={() => { setStartDate(''); setEndDate(''); }}
                className="text-xs font-black text-[#B42910] hover:text-[#450704] transition-colors w-full sm:w-auto text-center px-4 py-2.5 bg-white/60 hover:bg-white/80 rounded-lg sm:rounded-xl border border-white/40 cursor-pointer shadow-sm mt-2 sm:mt-0"
              >
                ✖️ Clear Range
              </button>
            )}
          </div>
        </div>

        {/* Excel-style Data Grid */}
        <div className="backdrop-blur-3xl bg-white/30 rounded-[20px] sm:rounded-[32px] border border-white/40 shadow-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead>
                <tr className="bg-white/20 border-b border-white/40">
                  <th className="px-4 sm:px-6 py-4 sm:py-5 text-[10px] sm:text-xs font-black uppercase tracking-widest text-zinc-800 w-[15%] drop-shadow-sm">📅 Date</th>
                  <th className="px-4 sm:px-6 py-4 sm:py-5 text-[10px] sm:text-xs font-black uppercase tracking-widest text-zinc-800 w-[25%] drop-shadow-sm">🏷️ Category</th>
                  <th className="px-4 sm:px-6 py-4 sm:py-5 text-[10px] sm:text-xs font-black uppercase tracking-widest text-zinc-800 w-[20%] drop-shadow-sm">💳 Payment</th>
                  <th className="px-4 sm:px-6 py-4 sm:py-5 text-[10px] sm:text-xs font-black uppercase tracking-widest text-zinc-800 w-[25%] drop-shadow-sm">📝 Note</th>
                  <th className="px-4 sm:px-6 py-4 sm:py-5 text-[10px] sm:text-xs font-black uppercase tracking-widest text-zinc-800 text-right w-[10%] drop-shadow-sm">💰 Amount</th>
                  <th className="px-4 sm:px-6 py-4 sm:py-5 text-[10px] sm:text-xs font-black uppercase tracking-widest text-zinc-800 text-center w-[5%] drop-shadow-sm"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/20">
                {filteredExpenses.length > 0 ? (
                  filteredExpenses.map(exp => {
                    const catName = exp.category_id || 'Other';
                    return (
                      <tr key={exp.id} className="hover:bg-white/40 transition-all group border-b border-white/30 last:border-0 bg-white/10">
                        {/* Date */}
                        <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                            <span className="text-xs sm:text-sm font-bold text-zinc-800 tracking-wide drop-shadow-sm">{formatDate(exp.spent_on)}</span>
                        </td>
                        
                        {/* Category */}
                        <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2 sm:gap-3">
                            <span className="w-8 h-8 sm:w-10 sm:h-10 rounded-[10px] sm:rounded-[12px] bg-white/60 border border-white/50 shadow-inner flex items-center justify-center text-base sm:text-lg shrink-0">
                                {getCategoryEmoji(catName)}
                            </span>
                            <span className="text-xs sm:text-sm font-black text-zinc-950 tracking-wide drop-shadow-sm">{catName}</span>
                          </div>
                        </td>

                        {/* Payment Method */}
                        <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                            {exp.payment_method ? (
                                <span className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-md sm:rounded-lg bg-white/60 border border-white/50 text-[10px] sm:text-xs font-black text-zinc-800 capitalize shadow-sm">
                                    {getPaymentEmoji(exp.payment_method)}
                                </span>
                            ) : (
                                <span className="text-zinc-500 text-xs sm:text-sm font-bold">-</span>
                            )}
                        </td>

                        {/* Note */}
                        <td className="px-4 sm:px-6 py-3 sm:py-4">
                            <span className="text-xs sm:text-sm font-bold text-zinc-800 block truncate max-w-[120px] sm:max-w-[200px] drop-shadow-sm">
                                {exp.note || <span className="text-zinc-600 italic">No note</span>}
                            </span>
                        </td>

                        {/* Amount */}
                        <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-right">
                          <span className="text-sm sm:text-base font-black text-[#B42910] drop-shadow-sm">
                            -PKR {formatMoney(exp.amount_minor / 100)}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-center">
                          <button 
                            onClick={() => handleDeleteExpense(exp.id)} 
                            className="text-zinc-600 hover:text-red-700 p-1.5 sm:p-2 bg-white/40 hover:bg-red-50 rounded-lg sm:rounded-xl border border-white/50 shadow-sm cursor-pointer transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100"
                            title="Delete record"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" className="sm:w-[18px] sm:h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 sm:py-20 text-center">
                      <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white/40 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4 text-2xl sm:text-3xl shadow-inner border border-white/50">
                        📭
                      </div>
                      <p className="text-zinc-950 font-black text-lg sm:text-xl drop-shadow-sm">No records found</p>
                      <p className="text-zinc-700 text-xs sm:text-sm font-bold mt-1">Try adjusting your search or date filters.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        
      </div>
    </div>
  );
}