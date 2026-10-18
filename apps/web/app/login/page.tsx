'use client';
import { useState } from 'react';
import { createClient } from '../../utils/client';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  const router = useRouter();
  const supabase = createClient();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isSignUp) {
        const { error: signUpError } = await supabase.auth.signUp({ 
          email, 
          password 
        });
        if (signUpError) throw signUpError;
        alert('Success! Check your email for a confirmation link (or you may be logged in automatically based on your Supabase settings).');
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ 
          email, 
          password 
        });
        if (signInError) throw signInError;
        
        // On successful login, push user to the main dashboard
        router.push('/');
        router.refresh();
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4 font-sans text-zinc-900">
      <div className="w-full max-w-md backdrop-blur-2xl bg-white/40 border border-white/50 shadow-2xl rounded-[32px] p-8 sm:p-10">
        
        {/* Branding Header */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-zinc-950 text-white flex items-center justify-center font-black text-2xl tracking-tighter shadow-md">
            A
          </div>
          <h1 className="font-bold text-xl tracking-tight text-zinc-900">ExpenseFlow</h1>
        </div>

        <h2 className="text-2xl font-bold text-zinc-950 mb-6 text-center tracking-tight">
          {isSignUp ? 'Create an Account' : 'Welcome Back'}
        </h2>
        
        {error && (
          <div className="bg-red-50/80 backdrop-blur-sm border border-red-200 text-red-600 p-3.5 rounded-xl mb-6 text-sm text-center shadow-sm font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-600 uppercase tracking-wider mb-1.5 ml-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-white/60 text-zinc-900 placeholder-zinc-400 border border-white/50 outline-none focus:ring-2 focus:ring-zinc-300 transition-all shadow-sm"
              required
            />
          </div>
          
          <div>
            <label className="block text-xs font-semibold text-zinc-600 uppercase tracking-wider mb-1.5 ml-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-white/60 text-zinc-900 placeholder-zinc-400 border border-white/50 outline-none focus:ring-2 focus:ring-zinc-300 transition-all shadow-sm"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-zinc-950 text-white py-3.5 rounded-xl font-semibold hover:bg-zinc-800 transition-colors disabled:opacity-50 mt-4 shadow-md cursor-pointer"
          >
            {loading ? 'Processing...' : isSignUp ? 'Sign Up' : 'Sign In'}
          </button>
        </form>

        <div className="mt-8 text-center">
          <button
            type="button"
            onClick={() => { setIsSignUp(!isSignUp); setError(null); }}
            className="text-sm font-medium text-zinc-600 hover:text-zinc-950 transition-colors cursor-pointer"
          >
            {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
          </button>
        </div>
      </div>
    </div>
  );
}