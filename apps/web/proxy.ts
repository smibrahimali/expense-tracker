import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

function copyCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach(({ name, value, ...rest }) => {
    to.cookies.set(name, value, rest);
  });
  return to;
}

export default async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isApi = path.startsWith('/api');

  // Unauthenticated API → JSON 401 (never HTML redirect)
  if (!user && isApi) {
    const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return copyCookies(supabaseResponse, res);
  }

  if (
    !user &&
    path !== '/login' &&
    !path.startsWith('/login/') &&
    !path.startsWith('/auth') &&
    !path.startsWith('/update-password')
  ) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    const next = path + request.nextUrl.search;
    if (next && next !== '/') url.searchParams.set('next', next);
    const res = NextResponse.redirect(url);
    return copyCookies(supabaseResponse, res);
  }

  if (user && (path === '/login' || path.startsWith('/login/'))) {
    const url = request.nextUrl.clone();
    const next = request.nextUrl.searchParams.get('next');
    url.pathname = next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
    url.search = '';
    // Preserve error query only when staying on login — here we leave login
    const res = NextResponse.redirect(url);
    return copyCookies(supabaseResponse, res);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
