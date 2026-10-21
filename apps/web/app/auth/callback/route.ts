import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') ?? '/';

  if (code) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          async getAll() {
            // FIXED: Added await for Next.js async cookies
            const cookieStore = await cookies();
            return cookieStore.getAll();
          },
          async setAll(cookiesToSet) {
            try {
              // FIXED: Added await for Next.js async cookies
              const cookieStore = await cookies();
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch (error) {
              // This is safe to ignore. The middleware handles cookie updates.
            }
          },
        },
      }
    );

    // Exchange the secure email code for an active session cookie
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, requestUrl.origin));
    }
  }

  // If the link is expired or invalid, send them back to login
  return NextResponse.redirect(new URL('/login?error=Invalid_Token', requestUrl.origin));
}