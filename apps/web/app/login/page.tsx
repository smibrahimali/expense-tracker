'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { createClient } from '../../utils/client';
import { useRouter, useSearchParams } from 'next/navigation';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);

  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error';
    visible: boolean;
  }>({
    message: '',
    type: 'success',
    visible: false,
  });

  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const err = searchParams.get('error');
    if (err) {
      showToast(decodeURIComponent(err.replace(/_/g, ' ')), 'error');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const showToast = (message: string, type: 'success' | 'error') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, type, visible: true });
    toastTimerRef.current = setTimeout(() => {
      setToast((prev) => ({ ...prev, visible: false }));
    }, 6000);
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!EMAIL_RE.test(email.trim())) {
      showToast('Enter a valid email address.', 'error');
      return;
    }
    setLoading(true);
    setToast((prev) => ({ ...prev, visible: false }));

    try {
      if (isSignUp) {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (signUpError) throw signUpError;
        if (data?.session) {
          router.push('/');
          router.refresh();
          return;
        }
        if (data?.user && data.user.identities && data.user.identities.length === 0) {
          throw new Error('This email is already registered. Please sign in instead.');
        }
        showToast('A verification link has been sent to your inbox.', 'success');
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInError) {
          if (signInError.message.toLowerCase().includes('invalid login credentials')) {
            throw new Error(
              'Account not found or invalid password. Sign up first if you do not have an account.'
            );
          }
          throw signInError;
        }
        const next = searchParams.get('next');
        router.push(next && next.startsWith('/') && !next.startsWith('//') ? next : '/');
        router.refresh();
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!EMAIL_RE.test(email.trim())) {
      showToast('Enter a valid email address first.', 'error');
      return;
    }

    setLoading(true);
    setToast((prev) => ({ ...prev, visible: false }));

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth/callback?next=/update-password`,
      });
      if (error) throw error;
      showToast('Password reset link sent. Check your email.', 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center p-4 overflow-hidden bg-[#121110]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_15%_-5%,rgba(180,41,16,0.38),transparent_55%),radial-gradient(ellipse_70%_45%_at_100%_100%,rgba(241,133,53,0.24),transparent_50%),radial-gradient(ellipse_50%_40%_at_50%_50%,rgba(28,26,24,0.4),transparent_70%)]"
      />

      {toast.visible && (
        <div className="fixed bottom-6 right-6 z-50 max-w-[calc(100vw-2rem)]">
          <div className="bg-[#1c1a18]/95 backdrop-blur-md border border-white/10 shadow-2xl rounded-xl p-4 flex items-start gap-3 w-80">
            <div
              className={`mt-0.5 shrink-0 ${
                toast.type === 'success' ? 'text-emerald-400' : 'text-[#F18535]'
              }`}
            >
              {toast.type === 'success' ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h4
                className={`text-sm font-semibold ${
                  toast.type === 'success' ? 'text-emerald-400' : 'text-[#F18535]'
                }`}
              >
                {toast.type === 'success' ? '✅ Success' : '⚠️ Error'}
              </h4>
              <p className="text-xs text-zinc-300 mt-1 leading-relaxed">{toast.message}</p>
            </div>
            <button
              type="button"
              onClick={() => setToast((prev) => ({ ...prev, visible: false }))}
              className="text-zinc-500 hover:text-white transition-colors shrink-0 min-h-11 min-w-11 inline-flex items-center justify-center"
              aria-label="Dismiss notification"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>
      )}

      <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#1c1a18]/80 backdrop-blur-xl shadow-2xl p-8 sm:p-10 text-zinc-100">
        <div className="flex flex-col items-center gap-3 mb-8 text-center">
          <div className="w-12 h-12 rounded-xl bg-[var(--ef-accent)] text-white flex items-center justify-center shadow-[var(--ef-shadow-sm)]">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <path d="M7 9h4M7 13h2M13 13h4" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            ExpenseFlow
          </h1>
          <p className="text-sm text-zinc-400 max-w-xs leading-relaxed">
            {isSignUp
              ? 'Create an account to start tracking spending.'
              : 'Sign in to log expenses and track your budget.'}
          </p>
        </div>

        <form onSubmit={handleAuth} className="space-y-5">
          <div>
            <label htmlFor="login-email" className="block text-xs font-medium text-zinc-400 mb-2">
              Email
            </label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="w-full min-h-11 rounded-xl border border-white/15 bg-white/5 px-4 text-sm text-white placeholder:text-zinc-500 outline-none transition-[border-color,box-shadow] focus:border-[#F18535]/50 focus:ring-2 focus:ring-[#B42910]/30"
              placeholder="you@example.com"
              required
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-2 gap-3">
              <label htmlFor="login-password" className="block text-xs font-medium text-zinc-400">
                Password
              </label>
              {!isSignUp && (
                <button
                  type="button"
                  onClick={handleResetPassword}
                  disabled={loading}
                  className="text-xs font-medium text-[#F18535] hover:text-[#ffb06a] transition-colors disabled:opacity-50 min-h-11 px-1"
                >
                  Forgot password?
                </button>
              )}
            </div>
            <div className="relative">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
                className="w-full min-h-11 rounded-xl border border-white/15 bg-white/5 pl-4 pr-12 text-sm text-white placeholder:text-zinc-500 outline-none transition-[border-color,box-shadow] focus:border-[#F18535]/50 focus:ring-2 focus:ring-[#B42910]/30"
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white transition-colors min-h-11 min-w-11 inline-flex items-center justify-center rounded-lg"
                title={showPassword ? 'Hide password' : 'Show password'}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-11 mt-1 rounded-xl bg-[var(--ef-accent)] text-white text-sm font-semibold shadow-[var(--ef-shadow-sm)] hover:bg-[var(--ef-accent-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading
              ? isSignUp
                ? 'Creating account…'
                : 'Signing in…'
              : isSignUp
                ? 'Create account'
                : 'Sign in'}
          </button>
        </form>

        <div className="mt-8 text-center">
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setToast((prev) => ({ ...prev, visible: false }));
            }}
            className="text-sm font-medium text-zinc-400 hover:text-white transition-colors min-h-11 px-2"
          >
            {isSignUp ? (
              <>
                Already have an account?{' '}
                <span className="text-white">Sign in</span>
              </>
            ) : (
              <>
                Don&apos;t have an account?{' '}
                <span className="text-white">Sign up</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#121110] text-zinc-400 text-sm">
          Loading…
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
