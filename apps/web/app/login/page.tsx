'use client';
import { useState } from 'react';
import { createClient } from '../../utils/client';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error'; visible: boolean }>({
    message: '',
    type: 'success',
    visible: false,
  });
  
  const router = useRouter();
  const supabase = createClient();

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type, visible: true });
    setTimeout(() => {
      setToast((prev) => ({ ...prev, visible: false }));
    }, 6000);
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setToast((prev) => ({ ...prev, visible: false })); 

    try {
      if (isSignUp) {
        const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
        if (signUpError) throw signUpError;
        if (data?.user && data.user.identities && data.user.identities.length === 0) {
          throw new Error('This email is already registered. Please sign in instead.');
        }
        showToast('Success! A verification link has been sent to your inbox shortly.', 'success');
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) {
          if (signInError.message.toLowerCase().includes('invalid login credentials')) {
            throw new Error('Account not found or invalid password. Please sign up first if you do not have an account.');
          }
          throw signInError;
        }
        router.push('/');
        router.refresh();
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email) {
      showToast('Please enter your email address in the field above first.', 'error');
      return;
    }
    
    setLoading(true);
    setToast((prev) => ({ ...prev, visible: false }));

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/update-password`,
      });
      if (error) throw error;
      showToast('Password reset link sent! Please check your email.', 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4 font-sans text-zinc-900 relative overflow-hidden">
      
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

      <div className="w-full max-w-md backdrop-blur-3xl bg-white/30 border border-white/40 shadow-2xl rounded-[36px] p-8 sm:p-10">
        
        <div className="flex flex-col items-center gap-4 mb-8">
          
          {/* NEW CUSTOM CALCULATOR LOGO */}
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
          {isSignUp ? 'Create an Account' : 'Welcome Back'}
        </h2>

        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label className="block text-xs font-black text-zinc-800 uppercase tracking-widest mb-1.5 ml-1 drop-shadow-sm">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3.5 rounded-xl bg-white/60 text-zinc-900 placeholder-zinc-500 font-bold border border-white/50 outline-none focus:ring-2 focus:ring-orange-500/30 transition-all shadow-sm focus:bg-white/80"
              required
            />
          </div>
          
          <div>
            <div className="flex justify-between items-center mb-1.5 ml-1">
              <label className="block text-xs font-black text-zinc-800 uppercase tracking-widest drop-shadow-sm">Password</label>
              {!isSignUp && (
                <button
                  type="button"
                  onClick={handleResetPassword}
                  className="text-xs font-black text-[#8A210F] hover:text-red-900 transition-colors cursor-pointer drop-shadow-sm"
                >
                  Forgot password?
                </button>
              )}
            </div>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-4 pr-12 py-3.5 rounded-xl bg-white/60 text-zinc-900 placeholder-zinc-500 font-bold border border-white/50 outline-none focus:ring-2 focus:ring-orange-500/30 transition-all shadow-sm focus:bg-white/80"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-950 transition-colors p-1 cursor-pointer"
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-zinc-950 text-white py-4 rounded-xl font-black hover:bg-zinc-800 transition-colors disabled:opacity-50 mt-4 shadow-xl cursor-pointer tracking-widest uppercase text-xs"
          >
            {loading ? 'Processing...' : isSignUp ? 'Sign Up' : 'Sign In'}
          </button>
        </form>

        <div className="mt-8 text-center">
          <button
            type="button"
            onClick={() => { setIsSignUp(!isSignUp); setToast((prev) => ({ ...prev, visible: false })); }}
            className="text-sm font-bold text-zinc-700 hover:text-zinc-950 transition-colors cursor-pointer drop-shadow-sm"
          >
            {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
          </button>
        </div>
      </div>
    </div>
  );
}