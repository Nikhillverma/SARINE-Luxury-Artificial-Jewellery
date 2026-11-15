import type { CustomerIdentity } from "../types/customer";

type CustomerRecord = Omit<CustomerIdentity, "displayName" | "uid">;
const mapCustomer = (customer: CustomerRecord): CustomerIdentity => ({
  ...customer,
  uid: customer.id,
  displayName: customer.name
});

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
  const data: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof data === "object" && data !== null && "error" in data && typeof data.error === "string"
      ? data.error
      : "Customer account request failed.";
    throw new Error(message);
  }
  return data as T;
}

export const customerAuthService = {
  async getSession(): Promise<CustomerIdentity | null> {
    try {
      const result = await request<{ authenticated: boolean; customer?: CustomerRecord }>("session");
      return result.authenticated && result.customer ? mapCustomer(result.customer) : null;
    } catch {
      return null;
    }
  },
  async login(email: string, password: string): Promise<CustomerIdentity> {
    const result = await request<{ customer: CustomerRecord }>("login", {
      method: "POST", body: JSON.stringify({ email, password })
    });
    return mapCustomer(result.customer);
  },
  async register(name: string, email: string, password: string): Promise<CustomerIdentity> {
    const result = await request<{ customer: CustomerRecord }>("register", {
      method: "POST", body: JSON.stringify({ name, email, password })
    });
    return mapCustomer(result.customer);
  },
  async logout(): Promise<void> {
    await request<{ success: boolean }>("logout", { method: "POST" });
  }
};
