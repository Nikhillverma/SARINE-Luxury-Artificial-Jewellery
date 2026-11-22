const API_BASE = (
  import.meta.env.VITE_HOSTINGER_API_BASE_URL ||
  (import.meta.env.DEV ? '/api' : 'https://lavender-goldfish-844589.hostingersite.com/api')
).replace(/\/+$/, '');

export interface AdminIdentity {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface LoginResponse {
  success: boolean;
  admin: AdminIdentity;
}

interface SessionResponse {
  authenticated: boolean;
  admin?: AdminIdentity;
}

export class AdminAuthError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'AdminAuthError';
  }
}

async function authRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(API_BASE + '/admin/auth/' + endpoint, {
      ...options,
      credentials: 'include',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
  } catch {
    throw new AdminAuthError(
      'SARINE could not reach the authentication service. Check your connection and try again.',
      0
    );
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = typeof data.error === 'string'
      ? data.error
      : typeof data.message === 'string'
        ? data.message
        : 'Admin authentication request failed.';
    throw new AdminAuthError(message, response.status);
  }

  return data as T;
}

export async function adminLogin(
  email: string,
  password: string
): Promise<AdminIdentity> {
  const result = await authRequest<LoginResponse>('login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });

  if (!result.success || !result.admin) {
    throw new AdminAuthError('The authentication service returned an invalid response.', 502);
  }

  const session = await authRequest<SessionResponse>('session');
  if (!session.authenticated || !session.admin) {
    throw new AdminAuthError(
      'Sign-in succeeded, but the admin session could not be confirmed. Please try again.',
      401
    );
  }

  return session.admin;
}

export async function getAdminSession(): Promise<AdminIdentity | null> {
  try {
    const result = await authRequest<SessionResponse>('session');
    return result.authenticated && result.admin ? result.admin : null;
  } catch (error) {
    if (error instanceof AdminAuthError && error.status === 401) {
      return null;
    }
    throw error;
  }
}

export async function adminLogout(): Promise<void> {
  await authRequest<{ success: boolean }>('logout', {
    method: 'POST'
  });
}
