'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '../../utils/client';

export default function TransactionsPage() {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
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

      // Fetch Categories
      const { data: catData } = await supabase.from('categories').select('*').eq('user_id', uid);
      if (catData) setCategories(catData);

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

    const headers = ['Date', 'Category', 'Amount (PKR)', 'Note'];
    
    const csvRows = filteredExpenses.map(exp => {
      const date = exp.spent_on;
      const category = categories.find(c => c.id === exp.category_id)?.name || 'Expense';
      const amount = (exp.amount_minor / 100).toFixed(2);
      const note = exp.note ? `"${exp.note.replace(/"/g, '""')}"` : '';
      
      return `${date},"${category}",${amount},${note}`;
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

  if (!userId) {
    return <div className="min-h-screen flex items-center justify-center"></div>;
  }

  return (
    <div className="min-h-screen p-4 sm:p-8 font-sans text-zinc-900">
      <div className="max-w-2xl mx-auto mt-8 backdrop-blur-2xl bg-white/40 border border-white/50 shadow-2xl rounded-3xl p-6 sm:p-8">
        
        {/* Header & Navigation */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link 
              href="/" 
              className="p-2 bg-white/60 rounded-xl border border-white/50 text-zinc-600 hover:text-zinc-900 hover:bg-white/80 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6" />
              </svg>
            </Link>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">All Transactions</h1>
          </div>
          
          <button 
            onClick={handleExportCSV}
            disabled={filteredExpenses.length === 0}
            className="flex items-center gap-2 text-sm bg-zinc-950 hover:bg-zinc-900 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-xl transition-colors shadow-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span>Export CSV</span>
          </button>
        </div>

        {/* Search & Filter Controls */}
        <div className="bg-white/60 p-4 rounded-2xl border border-white/50 mb-8 space-y-4 shadow-sm">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input 
                type="text" 
                placeholder="Search by note..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white/50 text-zinc-900 placeholder:text-zinc-500 text-sm outline-none focus:ring-2 focus:ring-zinc-200 border border-white/50"
              />
            </div>
            <select 
              value={selectedCategory} 
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full sm:w-48 p-2.5 rounded-xl bg-white/50 text-zinc-900 text-sm outline-none border border-white/50 focus:ring-2 focus:ring-zinc-200"
            >
              <option value="all">All Categories</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center border-t border-zinc-200/50 pt-4">
            <span className="text-zinc-500 text-sm w-full sm:w-auto font-medium">Date Range:</span>
            <input 
              type="date" 
              value={startDate} 
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full sm:w-auto p-2 rounded-xl bg-white/50 text-zinc-900 text-sm outline-none border border-white/50 focus:ring-2 focus:ring-zinc-200 [color-scheme:light]"
            />
            <span className="text-zinc-400 hidden sm:inline">to</span>
            <input 
              type="date" 
              value={endDate} 
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full sm:w-auto p-2 rounded-xl bg-white/50 text-zinc-900 text-sm outline-none border border-white/50 focus:ring-2 focus:ring-zinc-200 [color-scheme:light]"
            />
            {(startDate || endDate) && (
              <button 
                onClick={() => { setStartDate(''); setEndDate(''); }}
                className="text-xs font-medium text-zinc-500 hover:text-zinc-900 transition-colors w-full sm:w-auto text-left sm:text-center mt-1 sm:mt-0 px-2 py-1 bg-white/50 rounded-lg border border-white/50"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Transactions List */}
        <div className="space-y-3">
          {filteredExpenses.length > 0 ? (
            filteredExpenses.map(exp => (
              <div key={exp.id} className="flex justify-between items-center bg-white/60 p-4 rounded-xl border border-white/50 shadow-sm hover:bg-white/80 transition-colors">
                <div className="flex-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <p className="font-semibold text-base sm:text-lg text-zinc-900 truncate">
                      {categories.find(c => c.id === exp.category_id)?.name || 'Expense'}
                    </p>
                    <span className="text-[10px] sm:text-xs text-zinc-600 bg-white/80 px-2 py-0.5 rounded-md whitespace-nowrap shrink-0 border border-zinc-100">
                      {new Date(exp.spent_on).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                  {exp.note && <p className="text-sm text-zinc-500 mt-0.5">{exp.note}</p>}
                </div>
                <div className="flex items-center gap-4">
                  <p className="font-bold text-lg text-zinc-900">PKR {(exp.amount_minor / 100).toFixed(2)}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-12 bg-white/60 rounded-2xl border border-white/50 shadow-sm">
              <p className="text-zinc-500">No transactions match your search criteria.</p>
            </div>
          )}
        </div>
        
      </div>
    </div>
  );
}