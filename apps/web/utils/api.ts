import { createBrowserClient } from '@supabase/ssr';

export async function fetchWithAuth(endpoint: string, options: RequestInit = {}) {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  // Maps to the required /api/v1 NestJS prefix
  const url = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1${endpoint}`;

  const response = await fetch(url, { ...options, headers });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `API returned status: ${response.status}`);
  }
  
  return response.json();
}