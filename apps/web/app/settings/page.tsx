'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '../../utils/client';

export default function SettingsPage() {
  const [categories, setCategories] = useState<any[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const supabase = createClient();
  const COLORS = ['#EF4444', '#F59E0B', '#3B82F6', '#10B981', '#8B5CF6', '#EC4899', '#34d399', '#60a5fa', '#fbbf24', '#fb7185', '#a78bfa', '#2dd4bf', '#a3e635'];

  useEffect(() => {
    fetchData();
  }, [supabase]);

  const fetchData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    setUserId(session.user.id);

    const { data } = await supabase.from('categories').select('*').eq('user_id', session.user.id).order('created_at', { ascending: true });
    if (data) setCategories(data);
  };

  const handleEditClick = (cat: any) => {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditColor(cat.color || COLORS[0]);
    setError(null);
    setSuccess(null);
  };

  const handleSaveEdit = async (id: string) => {
    setError(null);
    setSuccess(null);
    
    if (!editName.trim()) {
      setError("Category name cannot be empty.");
      return;
    }

    const { error: updateError } = await supabase
      .from('categories')
      .update({ name: editName.trim(), color: editColor })
      .eq('id', id)
      .eq('user_id', userId);

    if (updateError) {
      setError(updateError.message);
    } else {
      setSuccess("Category updated successfully.");
      setEditingId(null);
      fetchData();
    }
  };

  const handleDelete = async (id: string) => {
    setError(null);
    setSuccess(null);

    // 1. Safety Check: Verify if category is being used by any expenses
    const { count, error: countError } = await supabase
      .from('expenses')
      .select('*', { count: 'exact', head: true })
      .eq('category_id', id)
      .eq('user_id', userId);

    if (countError) {
      setError("Failed to check category usage.");
      return;
    }

    if (count && count > 0) {
      setError(`Cannot delete this category because it is tied to ${count} transaction(s). Please edit or delete those expenses first.`);
      return;
    }

    // 2. Delete if clear
    const { error: deleteError } = await supabase
      .from('categories')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (deleteError) {
      setError(deleteError.message);
    } else {
      setSuccess("Category deleted successfully.");
      fetchData();
    }
  };

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
          <h1 className="text-2xl font-bold tracking-tight text-white">Manage Categories</h1>
        </div>

        {error && <div className="mb-4 p-3 bg-red-900/50 border border-red-800 text-red-200 rounded-lg text-sm">{error}</div>}
        {success && <div className="mb-4 p-3 bg-emerald-900/50 border border-emerald-800 text-emerald-200 rounded-lg text-sm">{success}</div>}

        <div className="bg-zinc-900 rounded-lg border border-zinc-800 overflow-hidden">
          <div className="p-4 border-b border-zinc-800">
            <h2 className="text-zinc-400 text-sm font-medium uppercase tracking-wider">Your Categories</h2>
          </div>
          
          <div className="divide-y divide-zinc-800">
            {categories.map(cat => (
              <div key={cat.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                {editingId === cat.id ? (
                  <div className="flex-1 flex flex-col sm:flex-row gap-3 w-full">
                    <input 
                      type="text" 
                      value={editName} 
                      onChange={(e) => setEditName(e.target.value)} 
                      className="p-2 rounded bg-zinc-800 text-white flex-1 text-sm outline-none border border-transparent focus:border-emerald-500"
                    />
                    <select 
                      value={editColor} 
                      onChange={(e) => setEditColor(e.target.value)}
                      className="p-2 rounded bg-zinc-800 text-white text-sm outline-none border border-transparent focus:border-emerald-500 font-medium"
                      style={{ color: editColor }}
                    >
                      {COLORS.map(c => <option key={c} value={c} style={{ color: c }}>{c}</option>)}
                    </select>
                    <div className="flex gap-2">
                      <button onClick={() => handleSaveEdit(cat.id)} className="bg-emerald-600 text-white px-3 py-2 rounded text-sm whitespace-nowrap hover:bg-emerald-700 font-medium transition-colors">Save</button>
                      <button onClick={() => { setEditingId(null); setError(null); }} className="bg-zinc-700 text-white px-3 py-2 rounded text-sm whitespace-nowrap hover:bg-zinc-600 font-medium transition-colors">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 rounded-full shadow-sm" style={{ backgroundColor: cat.color || '#3B82F6' }}></div>
                      <span className="font-medium text-white">{cat.name}</span>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleEditClick(cat)} className="text-zinc-500 hover:text-blue-400 p-2 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                      </button>
                      <button onClick={() => handleDelete(cat.id)} className="text-zinc-500 hover:text-red-400 p-2 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
            {categories.length === 0 && (
              <div className="p-8 text-center text-zinc-500">No categories found. Create some on the dashboard!</div>
            )}
          </div>
        </div>
        
      </div>
    </div>
  );
}