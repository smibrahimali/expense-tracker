'use client';
import { useState, useEffect } from 'react';
import { createClient } from '../../utils/client';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

export default function Dashboard({ userId }: { userId: string }) {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [note, setNote] = useState('');
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editCategoryId, setEditCategoryId] = useState('');
  const [editNote, setEditNote] = useState('');

  // Category Management State
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  const [timeFilter, setTimeFilter] = useState<'all' | 'month'>('month');
  const [formError, setFormError] = useState<string | null>(null);
  const supabase = createClient();

  const todayLocal = () => {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${now.getFullYear()}-${month}-${day}`;
  };

  useEffect(() => {
    supabase.from('categories').select('*').eq('user_id', userId).then(({ data }) => {
      if (data && data.length > 0) {
        setCategories(data);
        setCategoryId(data[0].id);
      }
    });

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
      .insert([{
        user_id: userId,
        category_id: categoryId,
        amount_minor: amountMinor,
        spent_on: todayLocal(),
        note: note || null,
      }])
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
  };

  const handleDeleteExpense = async (id: string) => {
    const previous = expenses;
    setExpenses(expenses.filter(exp => exp.id !== id));
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

    setExpenses(expenses.map(exp => (exp.id === id ? { ...exp, ...updatedExpense } : exp)));
    setEditingId(null);
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const colors = ['#EF4444', '#F59E0B', '#3B82F6', '#10B981', '#8B5CF6', '#EC4899'];
    const color = colors[categories.length % colors.length];

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

  const filteredExpenses = expenses.filter(exp => {
    if (timeFilter === 'all') return true;
    const expDate = new Date(exp.spent_on);
    const today = new Date();
    return expDate.getMonth() === today.getMonth() && expDate.getFullYear() === today.getFullYear();
  });

  const totalSpent = filteredExpenses.reduce((sum, exp) => sum + (exp.amount_minor || 0), 0) / 100;

  const expensesByCategory = filteredExpenses.reduce((acc, exp) => {
    const catName = categories.find(c => c.id === exp.category_id)?.name || 'Other';
    const amountVal = exp.amount_minor / 100;
    acc[catName] = (acc[catName] || 0) + amountVal;
    return acc;
  }, {} as Record<string, number>);

  const chartData = Object.entries(expensesByCategory).map(([name, value]) => ({ name, value }));
  const COLORS = ['#34d399', '#60a5fa', '#fbbf24', '#fb7185', '#a78bfa', '#2dd4bf', '#a3e635'];

  return (
    <div className="w-full max-w-2xl mt-8">
      <div className="flex justify-end mb-4">
        <div className="bg-zinc-900 p-1 rounded-lg border border-zinc-800 inline-flex">
          <button onClick={() => setTimeFilter('month')} className={`px-4 py-1.5 text-sm rounded-md transition-colors ${timeFilter === 'month' ? 'bg-zinc-800 text-white font-medium' : 'text-zinc-400 hover:text-white'}`}>This Month</button>
          <button onClick={() => setTimeFilter('all')} className={`px-4 py-1.5 text-sm rounded-md transition-colors ${timeFilter === 'all' ? 'bg-zinc-800 text-white font-medium' : 'text-zinc-400 hover:text-white'}`}>All Time</button>
        </div>
      </div>

      <div className="mb-8 p-6 bg-zinc-900 rounded-lg border border-zinc-800 flex flex-col items-center justify-center">
        <h2 className="text-zinc-400 text-sm font-medium uppercase tracking-wider mb-2">{timeFilter === 'month' ? 'Total Spent This Month' : 'Total Spent'}</h2>
        <p className="text-4xl font-bold text-emerald-400">PKR {totalSpent.toFixed(2)}</p>
      </div>

      {chartData.length > 0 && (
        <div className="mb-8 p-6 bg-zinc-900 rounded-lg border border-zinc-800 h-72">
          <h2 className="text-zinc-400 text-sm font-medium uppercase tracking-wider mb-4 text-center">Spending Breakdown</h2>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={chartData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" stroke="none">
                {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(value: any) => `PKR ${Number(value).toFixed(2)}`} contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', color: '#fff', borderRadius: '8px' }} itemStyle={{ color: '#fff' }} />
              <Legend wrapperStyle={{ paddingTop: '20px' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Category Management UI */}
      <div className="flex justify-between items-end mb-2 px-1 mt-6">
        <h3 className="text-zinc-400 text-sm font-medium uppercase tracking-wider">Log Expense</h3>
        <button 
          onClick={() => setShowCategoryForm(!showCategoryForm)}
          className="text-xs text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
        >
          {showCategoryForm ? 'Close Category Form' : '+ New Category'}
        </button>
      </div>

      {showCategoryForm && (
        <form onSubmit={handleAddCategory} className="flex gap-2 mb-4 bg-zinc-900 p-3 rounded-lg border border-zinc-800">
          <input 
            type="text" 
            value={newCategoryName} 
            onChange={(e) => setNewCategoryName(e.target.value)} 
            placeholder="Category Name (e.g. Padel Match)" 
            required 
            className="p-2 rounded bg-zinc-800 text-white w-full text-sm outline-none focus:border-emerald-500 border border-transparent" 
          />
          <button type="submit" className="bg-zinc-700 text-white px-4 py-2 rounded font-medium hover:bg-zinc-600 text-sm whitespace-nowrap transition-colors">
            Create
          </button>
        </form>
      )}

      <form onSubmit={handleAddExpense} className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8 bg-zinc-900 p-4 rounded-lg border border-zinc-800">
        <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount" required className="p-2 rounded bg-zinc-800 text-white w-full outline-none" />
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="p-2 rounded bg-zinc-800 text-white w-full outline-none">
          {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
        </select>
        <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" className="p-2 rounded bg-zinc-800 text-white w-full outline-none" />
        <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded font-medium hover:bg-blue-700 w-full transition-colors">Add Expense</button>
      </form>
      {formError && (
        <p className="text-red-400 text-sm -mt-6 mb-6">{formError}</p>
      )}

      <div className="space-y-4">
        {Array.isArray(filteredExpenses) && filteredExpenses.length > 0 ? (
          filteredExpenses.map(exp => (
            <div key={exp.id} className="flex justify-between items-center bg-zinc-900 p-4 rounded-lg border border-zinc-800">
              
              {editingId === exp.id ? (
                <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-2 items-center w-full">
                  <input type="number" step="0.01" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} className="p-2 rounded bg-zinc-800 text-white w-full text-sm" />
                  <select value={editCategoryId} onChange={(e) => setEditCategoryId(e.target.value)} className="p-2 rounded bg-zinc-800 text-white w-full text-sm">
                    {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                  </select>
                  <input type="text" value={editNote} onChange={(e) => setEditNote(e.target.value)} className="p-2 rounded bg-zinc-800 text-white w-full text-sm" />
                  <div className="flex gap-2">
                    <button onClick={() => handleSaveEdit(exp.id)} className="bg-emerald-600 text-white px-3 py-1.5 rounded text-sm w-full">Save</button>
                    <button onClick={() => setEditingId(null)} className="bg-zinc-700 text-white px-3 py-1.5 rounded text-sm w-full">Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex-1">
                    <p className="font-semibold text-lg">{categories.find(c => c.id === exp.category_id)?.name || 'Expense'}</p>
                    <p className="text-sm text-zinc-400">{exp.note}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <p className="font-bold text-lg text-emerald-400">PKR {(exp.amount_minor / 100).toFixed(2)}</p>
                    <div className="flex gap-1">
                      <button onClick={() => handleEditClick(exp)} className="text-zinc-600 hover:text-blue-500 transition-colors p-2" title="Edit expense">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                      </button>
                      <button onClick={() => handleDeleteExpense(exp.id)} className="text-zinc-600 hover:text-red-500 transition-colors p-2" title="Delete expense">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ))
        ) : (
          <p className="text-zinc-500 text-center py-4">No expenses found for this period.</p>
        )}
      </div>
    </div>
  );
}