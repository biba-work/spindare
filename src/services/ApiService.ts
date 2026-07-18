// Central client for the Nest.js backend that replaced direct supabase-js
// calls throughout the app (Supabase's Postgres project was deleted — see
// CLAUDE.md). Every other service (AuthService, PostService, SocialService,
// NotificationService, SearchService) now calls through here instead of
// importing `supabase` directly.
//
// Auth model: the Nest API verifies the *standard* Clerk session token
// (no Clerk JWT "template" needed, unlike the old supabaseConfig.ts bridge —
// @clerk/backend's verifyToken() checks Clerk's own JWKS directly). App.tsx's
// SupabaseAuthSync effect just needs `await getToken()` with no template arg.

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://127.0.0.1:3000';

let _token: string | null = null;

export const setApiToken = (token: string | null) => {
  _token = token;
};

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers as HeadersInit | undefined);
  headers.set('Content-Type', 'application/json');
  if (_token) headers.set('Authorization', `Bearer ${_token}`);

  const res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new ApiError(res.status, body || res.statusText);
  }

  // Some endpoints (204, plain toggles) return no body.
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

// Kept for the health-check smoke test that already existed in this file.
export async function pingApi() {
  return api.get<{ status: string; service: string }>('/health');
}
