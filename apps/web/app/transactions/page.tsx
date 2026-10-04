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

  // Apply Search and Filters
  const filteredExpenses = expenses.filter(exp => {
    const matchesCategory = selectedCategory === 'all' || exp.category_id === selectedCategory;
    const noteText = exp.note ? exp.note.toLowerCase() : '';
    const matchesSearch = noteText.includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  if (!userId) {
    return <div className="min-h-screen bg-black text-white flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-black text-white p-4 sm:p-8 font-sans">
      <div className="max-w-2xl mx-auto mt-8">
        
        {/* Header & Navigation */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/" className="p-2 bg-zinc-900 rounded-lg border border-zinc-800 text-zinc-400 hover:text-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-white">All Transactions</h1>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-3 mb-8 bg-zinc-900 p-4 rounded-lg border border-zinc-800">
          <div className="flex-1 relative">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.3-4.3"></path></svg>
            <input 
              type="text" 
              placeholder="Search by note..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded bg-zinc-800 text-white text-sm outline-none focus:border-emerald-500 border border-transparent"
            />
          </div>
          <select 
            value={selectedCategory} 
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full sm:w-48 p-2 rounded bg-zinc-800 text-white text-sm outline-none border border-transparent focus:border-emerald-500"
          >
            <option value="all">All Categories</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </div>

        {/* Transactions List */}
        <div className="space-y-3">
          {filteredExpenses.length > 0 ? (
            filteredExpenses.map(exp => (
              <div key={exp.id} className="flex justify-between items-center bg-zinc-900 p-4 rounded-lg border border-zinc-800">
                <div className="flex-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <p className="font-semibold text-base sm:text-lg text-white truncate">
                      {categories.find(c => c.id === exp.category_id)?.name || 'Expense'}
                    </p>
                    <span className="text-[10px] sm:text-xs text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded whitespace-nowrap shrink-0">
                      {new Date(exp.spent_on).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                  {exp.note && <p className="text-sm text-zinc-400 mt-0.5">{exp.note}</p>}
                </div>
                <div className="flex items-center gap-4">
                  <p className="font-bold text-lg text-emerald-400">PKR {(exp.amount_minor / 100).toFixed(2)}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-12 bg-zinc-900 rounded-lg border border-zinc-800">
              <p className="text-zinc-500">No transactions match your search.</p>
            </div>
          )}
        </div>
        
      </div>
    </div>
  );
}