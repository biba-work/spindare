import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase URL or Anon Key missing in environment.');
}

// Holds the current Clerk JWT — set by SupabaseAuthSync in App.tsx whenever
// the Clerk session changes. When present, every Supabase request is made as
// the signed-in user (role = authenticated) so RLS owner policies apply.
// Falls back gracefully to anon role if no token is available.
let _clerkToken: string | null = null;

export const setSupabaseToken = (token: string | null) => {
    _clerkToken = token;
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
        fetch: (url: RequestInfo | URL, options: RequestInit = {}) => {
            const headers = new Headers(options.headers as HeadersInit | undefined);
            if (_clerkToken) {
                headers.set('Authorization', `Bearer ${_clerkToken}`);
            }
            return fetch(url, { ...options, headers });
        },
    },
    realtime: {
        params: { apikey: supabaseAnonKey },
    },
});
