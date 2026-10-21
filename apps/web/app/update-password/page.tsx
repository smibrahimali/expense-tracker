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
    const establishSession = async () => {
      // 1. Check if Supabase sent a secure PKCE code in the URL parameters
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');

      if (code) {
        // 2. Securely exchange the code for an active session directly in the browser
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          setError('Failed to verify link: ' + exchangeError.message);
        } else {
          // 3. Clean up the URL so the code disappears and the address bar looks clean
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      } else {
        // 4. Fallback: check if they already have an active session (e.g. they just refreshed the page)
        const { data } = await supabase.auth.getSession();
        
        // Also check for legacy hash fragments just in case
        if (!data.session && !window.location.hash.includes('type=recovery')) {
          setError('Auth session missing! Please request a new password reset link.');
        }
      }
    };

    establishSession();
  }, [supabase]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      
      setSuccess('Password updated successfully! Redirecting to Dashboard...');
      setTimeout(() => {
        router.push('/');
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'There was an error updating your password. Please try requesting a new link.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4 font-sans text-zinc-900 relative overflow-hidden bg-gradient-to-br from-[#E54826] to-[#B42910]">
      <div className="w-full max-w-md backdrop-blur-3xl bg-white/30 border border-white/40 shadow-2xl rounded-[36px] p-8 sm:p-10">
        
        <div className="flex flex-col items-center gap-4 mb-8">
          <div className="w-16 h-16 rounded-[20px] bg-zinc-950 flex items-center justify-center shadow-2xl border border-zinc-800 relative overflow-hidden shrink-0">
            <div className="absolute inset-0 bg-gradient-to-br from-[#F38636]/20 to-[#6B0F06]/20 opacity-60"></div>
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="relative z-10">
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
          <h1 className="font-black text-2xl tracking-tight text-zinc-950 drop-shadow-sm">ExpenseFlow</h1>
        </div>

        <h2 className="text-xl font-bold text-zinc-800 mb-8 text-center tracking-tight drop-shadow-sm">
          Set New Password
        </h2>

        {error && <div className="bg-red-50/90 backdrop-blur-sm border border-red-200 text-red-600 p-3.5 rounded-xl mb-6 text-sm text-center shadow-sm font-bold">{error}</div>}
        {success && <div className="bg-emerald-50/90 backdrop-blur-sm border border-emerald-200 text-emerald-700 p-3.5 rounded-xl mb-6 text-sm text-center shadow-sm font-bold">{success}</div>}

        <form onSubmit={handleUpdate} className="space-y-4">
          <div>
            <label className="block text-xs font-black text-zinc-800 uppercase tracking-widest mb-1.5 ml-1 drop-shadow-sm">New Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3.5 rounded-xl bg-white/60 text-zinc-900 placeholder-zinc-500 font-bold border border-white/50 outline-none focus:ring-2 focus:ring-orange-500/30 transition-all shadow-sm focus:bg-white/80"
              required
              placeholder="••••••••"
              minLength={6}
            />
          </div>
          <button type="submit" disabled={loading} className="w-full bg-zinc-950 text-white py-4 rounded-xl font-black hover:bg-zinc-800 transition-colors disabled:opacity-50 mt-4 shadow-xl cursor-pointer tracking-widest uppercase text-xs">
            {loading ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
}