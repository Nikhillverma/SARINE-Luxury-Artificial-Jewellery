import type { CustomerIdentity } from "../types/customer";

type CustomerRecord = Omit<CustomerIdentity, "displayName" | "uid">;
type AuthResult = { customer: CustomerRecord; created?: boolean };
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
  async getMethods(): Promise<{ email: { enabled: boolean; provider: string; reason: string | null }; phone: { enabled: boolean; provider: string; reason: string | null }; google: { enabled: boolean } }> {
    return request("methods");
  },
  async getSession(): Promise<CustomerIdentity | null> {
    try {
      const result = await request<{ authenticated: boolean; customer?: CustomerRecord }>("session");
      return result.authenticated && result.customer ? mapCustomer(result.customer) : null;
    } catch {
      return null;
    }
  },
  async login(email: string, password: string): Promise<CustomerIdentity> {
    const result = await request<AuthResult>("login", { method: "POST", body: JSON.stringify({ email, password }) });
    return mapCustomer(result.customer);
  },
  async register(name: string, email: string, password: string): Promise<CustomerIdentity> {
    const result = await request<AuthResult>("register", { method: "POST", body: JSON.stringify({ name, email, password }) });
    return mapCustomer(result.customer);
  },
  async requestOtp(method: "email" | "phone", identifier: string): Promise<{ challengeId: string; expiresInSeconds: number; resendAfterSeconds: number }> {
    return request("otp/request", { method: "POST", body: JSON.stringify({ method, identifier }) });
  },
  async verifyOtp(challengeId: string, otp: string, name?: string): Promise<{ customer: CustomerIdentity; created: boolean }> {
    const result = await request<AuthResult & { created?: boolean }>("otp/verify", {
      method: "POST", body: JSON.stringify({ challengeId, otp, name })
    });
    return { customer: mapCustomer(result.customer), created: Boolean(result.created) };
  },
  async requestPasswordRecovery(method: "email" | "phone", identifier: string): Promise<{ challengeId: string }> {
    return request("password/forgot/request", { method: "POST", body: JSON.stringify({ method, identifier }) });
  },
  async verifyPasswordRecovery(challengeId: string, otp: string): Promise<string> {
    const result = await request<{ resetToken: string }>("password/forgot/verify", {
      method: "POST", body: JSON.stringify({ challengeId, otp })
    });
    return result.resetToken;
  },
  async resetPassword(resetToken: string, password: string): Promise<void> {
    await request("password/forgot/reset", { method: "POST", body: JSON.stringify({ resetToken, password }) });
  },
  async requestIdentityLink(method: "email" | "phone", identifier: string): Promise<{ challengeId?: string; alreadyLinked?: boolean }> {
    return request("identity/link/request", { method: "POST", body: JSON.stringify({ method, identifier }) });
  },
  async verifyIdentityLink(challengeId: string, otp: string): Promise<CustomerIdentity> {
    const result = await request<{ customer: CustomerRecord }>("identity/link/verify", {
      method: "POST", body: JSON.stringify({ challengeId, otp })
    });
    return mapCustomer(result.customer);
  },
  async loginWithGoogle(credential: string): Promise<CustomerIdentity> {
    const result = await request<AuthResult>("google", { method: "POST", body: JSON.stringify({ credential }) });
    return mapCustomer(result.customer);
  },
  async logout(): Promise<void> {
    await request<{ success: boolean }>("logout", { method: "POST" });
  }
};
