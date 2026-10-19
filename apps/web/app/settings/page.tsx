'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '../../utils/client';

export default function SettingsPage() {
  const [categories, setCategories] = useState<any[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const supabase = createClient();
  const COLORS = ['#E11D48', '#EA580C', '#D97706', '#10B981', '#3B82F6', '#8B5CF6'];

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
      .update({ name: editName.trim() })
      .eq('id', id)
      .eq('user_id', userId);

    if (updateError) {
      setError(updateError.message);
    } else {
      setSuccess("Category updated successfully.");
      setEditingId(null);
      // Optimistically update the UI
      setCategories(categories.map(cat => 
        cat.id === id ? { ...cat, name: editName.trim() } : cat
      ));
    }
  };

  const handleDelete = async (id: string) => {
    setError(null);
    setSuccess(null);

    // 1. Safety Check
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

    // 2. Optimistic UI update (instantly remove from screen)
    const previousCategories = [...categories];
    setCategories(categories.filter(cat => cat.id !== id));

    // 3. Delete from Database
    const { error: deleteError } = await supabase
      .from('categories')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (deleteError) {
      // Revert the screen if the database fails
      setCategories(previousCategories);
      setError(deleteError.message);
    } else {
      setSuccess("Category deleted successfully.");
    }
  };

  if (!userId) {
    return <div className="min-h-screen flex items-center justify-center"></div>;
  }

  return (
    <div className="min-h-screen p-4 sm:p-8 font-sans text-zinc-900">
      <div className="max-w-xl mx-auto mt-8 backdrop-blur-2xl bg-white/40 border border-white/50 shadow-2xl rounded-[32px] p-6 sm:p-10">
        
        {/* Header & Navigation */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/" className="p-2.5 bg-white/60 rounded-xl border border-white/50 text-zinc-600 hover:text-zinc-900 hover:bg-white/80 transition-colors shadow-sm">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Manage Categories</h1>
        </div>

        {error && <div className="mb-6 p-3.5 bg-red-50/90 backdrop-blur-sm border border-red-200 text-red-600 rounded-xl text-sm font-medium shadow-sm">{error}</div>}
        {success && <div className="mb-6 p-3.5 bg-emerald-50/90 backdrop-blur-sm border border-emerald-200 text-emerald-700 rounded-xl text-sm font-medium shadow-sm">{success}</div>}

        <div className="bg-white/60 rounded-2xl border border-white/50 overflow-hidden shadow-sm">
          <div className="p-5 border-b border-white/50">
            <h2 className="text-zinc-500 text-xs font-bold uppercase tracking-wider">Your Categories</h2>
          </div>
          
          <div className="divide-y divide-white/50">
            {categories.map(cat => (
              <div key={cat.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-white/40 transition-colors">
                {editingId === cat.id ? (
                  <div className="flex-1 flex flex-col sm:flex-row gap-3 w-full">
                    <input 
                      type="text" 
                      value={editName} 
                      onChange={(e) => setEditName(e.target.value)} 
                      className="px-3 py-2.5 rounded-xl bg-white/80 text-zinc-900 flex-1 text-sm outline-none border border-white/50 focus:ring-2 focus:ring-orange-500/30"
                    />
                    
                    <div className="flex gap-2">
                      <button onClick={() => handleSaveEdit(cat.id)} className="bg-zinc-950 text-white px-4 py-2 rounded-xl text-sm whitespace-nowrap hover:bg-zinc-800 font-semibold transition-colors shadow-sm cursor-pointer">Save</button>
                      <button onClick={() => { setEditingId(null); setError(null); }} className="bg-white/80 text-zinc-700 px-4 py-2 rounded-xl text-sm whitespace-nowrap hover:bg-white font-semibold border border-zinc-200 transition-colors cursor-pointer">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3.5">
                     <div className="w-3.5 h-3.5 rounded-full shadow-sm" style={{ backgroundColor: '#C83713' }}></div>
                      <span className="font-semibold text-sm text-zinc-900">{cat.name}</span>
                    </div>
                    <div className="flex gap-1.5">
                      <button onClick={() => handleEditClick(cat)} className="text-zinc-400 hover:text-zinc-900 p-2 transition-colors rounded-lg hover:bg-white/60 cursor-pointer">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                      </button>
                      <button onClick={() => handleDelete(cat.id)} className="text-zinc-400 hover:text-red-600 p-2 transition-colors rounded-lg hover:bg-white/60 cursor-pointer">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
            {categories.length === 0 && (
              <div className="p-8 text-center text-zinc-500 text-sm font-medium">No categories found. Create some on the dashboard!</div>
            )}
          </div>
        </div>
        
      </div>
    </div>
  );
}