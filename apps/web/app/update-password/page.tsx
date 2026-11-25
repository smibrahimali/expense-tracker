'use client';
import { useState, useEffect, useRef } from 'react';
import { createClient } from '../../utils/client';
import { useRouter } from 'next/navigation';

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const router = useRouter();
  const supabase = createClient();
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const establishSession = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');

      if (code) {
        window.location.replace(
          `/auth/callback?code=${encodeURIComponent(code)}&next=/update-password`
        );
        return;
      }

      const { data } = await supabase.auth.getSession();

      if (!data.session) {
        setError('Auth session missing! Please request a new password reset link.');
        setSessionReady(false);
      } else {
        setSessionReady(true);
      }
    };

    establishSession();
    return () => {
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
    };
  }, [supabase]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionReady) return;
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;

      setSuccess('Password updated successfully! Redirecting to Dashboard...');
      redirectTimerRef.current = setTimeout(() => {
        router.push('/');
      }, 2000);
    } catch (err: any) {
      setError(
        err.message ||
          'There was an error updating your password. Please try requesting a new link.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center p-4 overflow-hidden bg-[var(--ef-bg)]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_15%_-5%,rgba(180,41,16,0.38),transparent_55%),radial-gradient(ellipse_70%_45%_at_100%_100%,rgba(241,133,53,0.24),transparent_50%)]"
      />

      <div className="relative w-full max-w-md rounded-2xl border border-[var(--ef-border)] bg-[var(--ef-surface)]/80 backdrop-blur-xl shadow-[var(--ef-shadow-md)] p-8 sm:p-10">
        <div className="flex flex-col items-center gap-3 mb-8 text-center">
          <div className="w-12 h-12 rounded-xl bg-[var(--ef-accent)] text-white flex items-center justify-center shadow-[var(--ef-shadow-sm)]">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <path d="M7 9h4M7 13h2M13 13h4" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--ef-ink)]">
            ExpenseFlow
          </h1>
          <p className="text-sm text-[var(--ef-muted)] leading-relaxed">
            Choose a new password to get back into ExpenseFlow.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="bg-[var(--ef-danger-muted)] border border-[var(--ef-danger)]/30 text-[var(--ef-danger)] p-3 rounded-xl mb-5 text-sm leading-relaxed"
          >
            <span className="ef-emoji mr-1.5" aria-hidden>
              ⚠️
            </span>
            {error}
          </div>
        )}
        {success && (
          <div
            role="status"
            className="bg-[var(--ef-success-muted)] border border-[var(--ef-success)]/30 text-[var(--ef-success)] p-3 rounded-xl mb-5 text-sm leading-relaxed"
          >
            <span className="ef-emoji mr-1.5" aria-hidden>
              ✅
            </span>
            {success}
          </div>
        )}

        <form onSubmit={handleUpdate} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[var(--ef-muted)] mb-1.5">
              New password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="ef-input"
              required
              placeholder="At least 6 characters"
              minLength={6}
              autoComplete="new-password"
              disabled={!sessionReady || loading || !!success}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--ef-muted)] mb-1.5">
              Confirm password
            </label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="ef-input"
              required
              placeholder="Repeat password"
              minLength={6}
              autoComplete="new-password"
              disabled={!sessionReady || loading || !!success}
            />
          </div>
          <button
            type="submit"
            disabled={!sessionReady || loading || !!success}
            className="w-full min-h-11 rounded-xl bg-[var(--ef-accent)] text-white text-sm font-semibold shadow-[var(--ef-shadow-sm)] hover:bg-[var(--ef-accent-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Updating…' : 'Update password'}
          </button>
        </form>
      </div>
    </div>
  );
}
