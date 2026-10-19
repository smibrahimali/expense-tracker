'use client';
import { useState, useEffect } from 'react';
import { createClient } from '../../utils/client';
import { useRouter } from 'next/navigation';

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    // Verify the user was successfully logged in by the password reset link
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.push('/login');
      }
    });
  }, [router, supabase]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      // Securely update the password for the currently authenticated user
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      
      setSuccess('Password updated successfully! Redirecting...');
      setTimeout(() => {
        router.push('/');
      }, 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4 font-sans text-zinc-900 relative overflow-hidden">
      <div className="w-full max-w-md backdrop-blur-2xl bg-white/40 border border-white/50 shadow-2xl rounded-[32px] p-8 sm:p-10">
        
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-zinc-950 text-white flex items-center justify-center font-black text-2xl tracking-tighter shadow-md">
            A
          </div>
          <h1 className="font-bold text-xl tracking-tight text-zinc-900">ExpenseFlow</h1>
        </div>

        <h2 className="text-2xl font-bold text-zinc-950 mb-8 text-center tracking-tight">
          Set New Password
        </h2>

        {error && <div className="bg-red-50/90 backdrop-blur-sm border border-red-200 text-red-600 p-3.5 rounded-xl mb-6 text-sm text-center shadow-sm font-medium">{error}</div>}
        {success && <div className="bg-emerald-50/90 backdrop-blur-sm border border-emerald-200 text-emerald-700 p-3.5 rounded-xl mb-6 text-sm text-center shadow-sm font-medium">{success}</div>}

        <form onSubmit={handleUpdate} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-600 uppercase tracking-wider mb-1.5 ml-1">New Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-white/80 text-zinc-900 placeholder-zinc-400 border border-white/50 outline-none focus:ring-2 focus:ring-zinc-300 transition-all shadow-sm"
              required
              minLength={6}
            />
          </div>
          <button type="submit" disabled={loading} className="w-full bg-zinc-950 text-white py-3.5 rounded-xl font-bold hover:bg-zinc-800 transition-colors disabled:opacity-50 mt-4 shadow-md cursor-pointer tracking-wide">
            {loading ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
}