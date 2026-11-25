'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Dashboard from './components/Dashboard';
import { createClient } from '../utils/client';

export default function Home() {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    // 1. Check for an existing session on load
    const checkUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
      } else {
        setUserId(user.id);
      }
      setLoading(false);
    };

    checkUser();

    // 2. Listen for auth changes (like signing out)
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        router.push('/login');
      } else {
        setUserId(session.user.id);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [router, supabase]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <p className="text-[var(--ef-muted)] text-sm font-medium animate-pulse">Loading workspace…</p>
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="ef-panel p-6 text-center max-w-sm w-full">
          <p className="font-semibold text-[var(--ef-ink)] mb-1">Session not found</p>
          <p className="text-sm text-[var(--ef-muted)] mb-5">We couldn&apos;t detect a valid login.</p>
          <button
            onClick={() => router.push('/login')}
            className="ef-btn-primary w-full"
          >
            Go to login
          </button>
        </div>
      </div>
    );
  }

  return <Dashboard userId={userId} />;
}