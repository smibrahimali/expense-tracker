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
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
      } else {
        setUserId(session.user.id);
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
        <p className="text-white/90 font-medium tracking-wide animate-pulse">
          Loading your workspace...
        </p>
      </div>
    );
  }

  // If no user, the useEffect will redirect them. Render nothing in the meantime.
  if (!userId) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="bg-white p-6 rounded-2xl shadow-xl text-center max-w-sm w-full">
          <p className="font-bold text-zinc-900 mb-1">Session Not Found</p>
          <p className="text-sm text-zinc-500 mb-5">We couldn't detect a valid Supabase login.</p>
          <button 
            onClick={() => router.push('/login')} 
            className="bg-zinc-950 text-white px-5 py-2.5 rounded-full text-sm font-medium w-full"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return <Dashboard userId={userId} />;
}