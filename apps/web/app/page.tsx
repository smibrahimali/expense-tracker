import { createClient } from '../utils/supabase/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import Dashboard from './components/Dashboard';

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  async function signOut() {
    'use server';
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect('/');
  }

  return (
    <main className="flex min-h-screen flex-col items-center p-8 md:p-24">
      {user ? (
        <div className="flex flex-col items-center w-full">
          <div className="flex justify-between w-full max-w-2xl items-center border-b border-zinc-800 pb-6">
            <div>
              <h1 className="text-2xl font-bold">Your Dashboard</h1>
              <p className="text-sm text-zinc-400">{user.email}</p>
            </div>
            <form action={signOut}>
              <button className="text-sm bg-red-500/10 text-red-500 border border-red-500/20 px-4 py-2 rounded hover:bg-red-500/20">
                Sign Out
              </button>
            </form>
          </div>
          
          <Dashboard userId={user.id} />
          
        </div>
      ) : (
        <div className="flex flex-col items-center gap-6 mt-20">
          <h1 className="text-4xl font-bold">Expense Tracker</h1>
          <p className="text-zinc-400">Securely manage your personal finances.</p>
          <Link className="bg-white text-black px-6 py-3 rounded font-medium hover:bg-zinc-200" href="/login">
            Get Started
          </Link>
        </div>
      )}
    </main>
  );
}