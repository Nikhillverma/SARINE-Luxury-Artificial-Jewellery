import { CustomerIdentity } from "../types/customer";

const API_BASE = (
  import.meta.env.VITE_HOSTINGER_API_BASE_URL ||
  (import.meta.env.DEV ? "/api" : "https://lavender-goldfish-844589.hostingersite.com/api")
).replace(/\/+$/, "");

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}/customer/auth/${path}`, {
    ...options,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options.headers }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof data.error === "string" ? data.error : "Customer account request failed.");
  }
  return data as T;
}

export const customerAuthService = {
  async getSession(): Promise<CustomerIdentity | null> {
    try {
      const result = await request<{ authenticated: boolean; customer?: Omit<CustomerIdentity, "displayName"> }>("session");
      return result.authenticated && result.customer
        ? { ...result.customer, uid: result.customer.id, displayName: result.customer.name }
        : null;
    } catch {
      return null;
    }
  },
  async login(email: string, password: string): Promise<CustomerIdentity> {
    const result = await request<{ success: boolean; customer: Omit<CustomerIdentity, "displayName"> }>("login", {
      method: "POST", body: JSON.stringify({ email, password })
    });
    return { ...result.customer, displayName: result.customer.name };
  },
  async register(name: string, email: string, password: string): Promise<CustomerIdentity> {
    const result = await request<{ success: boolean; customer: Omit<CustomerIdentity, "displayName"> }>("register", {
      method: "POST", body: JSON.stringify({ name, email, password })
    });
    return { ...result.customer, displayName: result.customer.name };
  },
  async logout(): Promise<void> {
    await request<{ success: boolean }>("logout", { method: "POST" });
  },
  async updateProfile(name: string, phone: string): Promise<CustomerIdentity> {
    const result = await request<{ success: boolean; customer: Omit<CustomerIdentity, "displayName"> }>("profile", {
      method: "PATCH", body: JSON.stringify({ name, phone })
    });
    return { ...result.customer, displayName: result.customer.name };
  }
};
