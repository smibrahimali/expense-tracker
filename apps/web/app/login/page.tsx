'use client';
import { useState, useEffect } from 'react';
import { createClient } from '../../utils/client';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // NEW: Toast Notification State
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error'; visible: boolean }>({
    message: '',
    type: 'success',
    visible: false,
  });
  
  const router = useRouter();
  const supabase = createClient();

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type, visible: true });
    // Auto-hide after 5 seconds
    setTimeout(() => {
      setToast((prev) => ({ ...prev, visible: false }));
    }, 5000);
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setToast((prev) => ({ ...prev, visible: false })); // Hide existing toast on new submission

    try {
      if (isSignUp) {
        const { error: signUpError } = await supabase.auth.signUp({ 
          email, 
          password 
        });
        
        if (signUpError) {
          // Intercept "already registered" error
          if (signUpError.message.toLowerCase().includes('already registered') || signUpError.message.toLowerCase().includes('already exists')) {
            throw new Error('This email is already registered. Please sign in instead.');
          }
          throw signUpError;
        }
        
        // Success Popup
        showToast('Success! A verification link has been sent to your inbox shortly.', 'success');
        
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ 
          email, 
          password 
        });
        
        if (signInError) {
          // Intercept generic "invalid credentials" to suggest signing up
          if (signInError.message.toLowerCase().includes('invalid login credentials')) {
            throw new Error('Account not found or invalid password. Please sign up first if you do not have an account.');
          }
          throw signInError;
        }
        
        // On successful login, push user to the main dashboard
        router.push('/');
        router.refresh();
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4 font-sans text-zinc-900 relative overflow-hidden">
      
      {/* Floating Toast Notification (Bottom Right) */}
      {toast.visible && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
          <div className="bg-[#1A1A1A] border border-zinc-800 shadow-2xl rounded-xl p-4 flex items-start gap-3 w-80">
            {toast.type === 'success' ? (
              <div className="text-emerald-500 mt-0.5 shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              </div>
            ) : (
              <div className="text-red-500 mt-0.5 shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              </div>
            )}
            
            <div className="flex-1">
              <h4 className={`text-sm font-bold tracking-wide ${toast.type === 'success' ? 'text-emerald-500' : 'text-red-500'}`}>
                {toast.type === 'success' ? 'Link requested' : 'Authentication Error'}
              </h4>
              <p className="text-xs text-zinc-300 mt-1.5 leading-relaxed font-medium">
                {toast.message}
              </p>
            </div>
            
            <button onClick={() => setToast(prev => ({ ...prev, visible: false }))} className="text-zinc-500 hover:text-white transition-colors shrink-0 cursor-pointer">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>
      )}

      <div className="w-full max-w-md backdrop-blur-2xl bg-white/40 border border-white/50 shadow-2xl rounded-[32px] p-8 sm:p-10">
        
        {/* Branding Header */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-zinc-950 text-white flex items-center justify-center font-black text-2xl tracking-tighter shadow-md">
            A
          </div>
          <h1 className="font-bold text-xl tracking-tight text-zinc-900">ExpenseFlow</h1>
        </div>

        <h2 className="text-2xl font-bold text-zinc-950 mb-8 text-center tracking-tight">
          {isSignUp ? 'Create an Account' : 'Welcome Back'}
        </h2>

        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-600 uppercase tracking-wider mb-1.5 ml-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-white/80 text-zinc-900 placeholder-zinc-400 border border-white/50 outline-none focus:ring-2 focus:ring-zinc-300 transition-all shadow-sm"
              required
            />
          </div>
          
          <div>
            <label className="block text-xs font-semibold text-zinc-600 uppercase tracking-wider mb-1.5 ml-1">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-4 pr-12 py-3 rounded-xl bg-white/80 text-zinc-900 placeholder-zinc-400 border border-white/50 outline-none focus:ring-2 focus:ring-zinc-300 transition-all shadow-sm"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-900 transition-colors p-1 cursor-pointer"
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-zinc-950 text-white py-3.5 rounded-xl font-bold hover:bg-zinc-800 transition-colors disabled:opacity-50 mt-4 shadow-md cursor-pointer tracking-wide"
          >
            {loading ? 'Processing...' : isSignUp ? 'Sign Up' : 'Sign In'}
          </button>
        </form>

        <div className="mt-8 text-center">
          <button
            type="button"
            onClick={() => { setIsSignUp(!isSignUp); setToast((prev) => ({ ...prev, visible: false })); }}
            className="text-sm font-bold text-zinc-600 hover:text-zinc-950 transition-colors cursor-pointer"
          >
            {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
          </button>
        </div>
      </div>
    </div>
  );
}