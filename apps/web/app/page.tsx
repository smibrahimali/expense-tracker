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
        <p className="text-zinc-400 font-medium tracking-wide animate-pulse">Loading session...</p>
      </div>
    );
  }

  // If no user, the useEffect will redirect them. Render nothing in the meantime.
  if (!userId) return null;

  return (
    <main className="flex min-h-screen flex-col items-center p-4 md:p-8">
      <div className="w-full max-w-2xl flex justify-between items-center mb-2 mt-4">
        <h1 className="text-2xl font-bold text-white tracking-tight">Expense Tracker</h1>
        <button 
          onClick={async () => {
            await supabase.auth.signOut();
            router.push('/login');
          }} 
          className="text-sm bg-zinc-800 border border-zinc-700 px-4 py-1.5 rounded-md text-zinc-300 hover:text-white hover:bg-zinc-700 transition-colors"
        >
          Sign Out
        </button>
      </div>
      
      {/* 3. Pass the REAL authenticated user ID to your dashboard */}
      <Dashboard userId={userId} />
    </main>
  );
}