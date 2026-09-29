import { createClient } from '../../utils/supabase/server';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function LoginPage() {
  async function login(formData: FormData) {
    'use server';
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const supabase = await createClient();
    
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      console.error("SUPABASE LOGIN ERROR:", error.message);
    } else {
      redirect('/');
    }
  }

  async function signup(formData: FormData) {
    'use server';
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const supabase = await createClient();
    
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      console.error("SUPABASE SIGNUP ERROR:", error.message);
    } else {
      redirect('/');
    }
  }

  return (
    <div className="flex justify-center items-center min-h-screen p-4">
      <form className="flex flex-col gap-4 border border-zinc-800 p-8 rounded-lg w-full max-w-sm">
        <h2 className="text-2xl font-bold text-center mb-4">Expense Tracker</h2>
        <input 
          name="email" 
          type="email" 
          placeholder="Email address" 
          required 
          className="p-3 rounded bg-zinc-900 border border-zinc-800 text-white"
        />
        <input 
          name="password" 
          type="password" 
          placeholder="Password" 
          required 
          className="p-3 rounded bg-zinc-900 border border-zinc-800 text-white"
        />
        <div className="flex gap-4 mt-2">
          <button formAction={login} className="bg-blue-600 text-white p-3 rounded w-full hover:bg-blue-700">
            Log In
          </button>
          <button formAction={signup} className="bg-zinc-800 text-white p-3 rounded w-full hover:bg-zinc-700">
            Sign Up
          </button>
        </div>
      </form>
    </div>
  );
}