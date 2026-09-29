'use client';
import { useState, useEffect } from 'react';
import { createClient } from '../../utils/client';

export default function Dashboard({ userId }: { userId: string }) {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [note, setNote] = useState('');

  // Routes to your local NestJS server or live Vercel API
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
  const supabase = createClient();

  useEffect(() => {
    // 1. Fetch categories directly from Supabase to populate the dropdown
    supabase.from('categories').select('*').eq('user_id', userId).then(({ data }) => {
      if (data && data.length > 0) {
        setCategories(data);
        setCategoryId(data[0].id);
      }
    });

    // 2. Fetch expenses through your NestJS API
    fetch(`${API_URL}/expenses`, { headers: { 'x-user-id': userId } })
      .then(res => {
        if (!res.ok) throw new Error(`API returned status: ${res.status}`);
        return res.json();
      })
      .then(data => {
        // Enforce that only arrays are saved to state
        setExpenses(Array.isArray(data) ? data : []);
      })
      .catch(err => {
        console.error("Failed to fetch expenses:", err);
        setExpenses([]); 
      });
  }, [userId, supabase, API_URL]);

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch(`${API_URL}/expenses`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-user-id': userId 
      },
      body: JSON.stringify({
        user_id: userId,
        category_id: categoryId,
        amount_minor: Math.round(parseFloat(amount) * 100), 
        spent_on: new Date().toISOString().split('T')[0],
        note
      })
    });

    if (res.ok) {
      const newExpense = await res.json();
      setExpenses([newExpense, ...expenses]);
      setAmount('');
      setNote('');
    }
  };

  return (
    <div className="w-full max-w-2xl mt-8">
      <form onSubmit={handleAddExpense} className="flex gap-4 mb-8 bg-zinc-900 p-4 rounded-lg border border-zinc-800">
        <input 
          type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} 
          placeholder="Amount" required className="p-2 rounded bg-zinc-800 text-white w-24" 
        />
        <select 
          value={categoryId} onChange={(e) => setCategoryId(e.target.value)} 
          className="p-2 rounded bg-zinc-800 text-white flex-1"
        >
          {categories.map(cat => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>
        <input 
          type="text" value={note} onChange={(e) => setNote(e.target.value)} 
          placeholder="Note (optional)" className="p-2 rounded bg-zinc-800 text-white flex-1" 
        />
        <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded font-medium hover:bg-blue-700">Add</button>
      </form>

      <div className="space-y-4">
        {Array.isArray(expenses) && expenses.length > 0 ? (
          expenses.map(exp => (
            <div key={exp.id} className="flex justify-between items-center bg-zinc-900 p-4 rounded-lg border border-zinc-800">
              <div>
                <p className="font-semibold text-lg">{categories.find(c => c.id === exp.category_id)?.name || 'Expense'}</p>
                <p className="text-sm text-zinc-400">{exp.note}</p>
              </div>
              <p className="font-bold text-lg text-emerald-400">PKR {(exp.amount_minor / 100).toFixed(2)}</p>
            </div>
          ))
        ) : (
          <p className="text-zinc-500 text-center py-4">No expenses found or API connection failed.</p>
        )}
      </div>
    </div>
  );
}