const API_BASE = (
  import.meta.env.VITE_HOSTINGER_API_BASE_URL ||
  'https://greenyellow-cat-956048.hostingersite.com/api'
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

async function authRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_BASE}/admin/auth/${endpoint}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      typeof data.message === 'string'
        ? data.message
        : 'Admin authentication request failed.'
    );
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
    throw new Error('Invalid email or password.');
  }

  return result.admin;
}

export async function getAdminSession(): Promise<AdminIdentity | null> {
  try {
    const result = await authRequest<SessionResponse>('session');

    return result.authenticated && result.admin
      ? result.admin
      : null;
  } catch {
    return null;
  }
}

export async function adminLogout(): Promise<void> {
  await authRequest<{ success: boolean }>('logout', {
    method: 'POST'
  });
}
