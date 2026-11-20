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


export interface CustomerAccountOrderLine {
  productId: string;
  name: string;
  image?: string;
  sku?: string;
  variantLabel?: string;
  variantOptions?: Record<string, string>;
  unitPrice: number;
  quantity: number;
}
export interface CustomerAccountOrder {
  id: string;
  orderNumber: string;
  createdAt?: string;
  customer: { name: string; email: string; phone: string };
  shippingAddress: { fullName: string; phone: string; line1: string; line2?: string; city: string; state: string; pincode: string };
  lines: CustomerAccountOrderLine[];
  subtotal: number;
  shippingFee: number;
  total: number;
  paymentMethod: string;
  paymentStatus: string;
  orderStatus: string;
  courierName?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  shippedAt?: string;
  deliveredAt?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  refundNeeded: boolean;
  refundAmount: number;
  returnStatus: string;
  returnReason?: string;
  returnNotes?: string;
}


export interface CustomerSavedAddress {
  id: string;
  fullName: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
}

export const customerAuthService = {
  async getAddresses(): Promise<CustomerSavedAddress[]> {
    const result = await request<{ addresses: CustomerSavedAddress[] }>("addresses");
    return result.addresses || [];
  },
  async saveAddress(address: Omit<CustomerSavedAddress, "id"> & { id?: string }): Promise<CustomerSavedAddress> {
    const result = address.id
      ? await request<{ address: CustomerSavedAddress }>(`addresses/${encodeURIComponent(address.id)}`, { method: "PATCH", body: JSON.stringify(address) })
      : await request<{ address: CustomerSavedAddress }>("addresses", { method: "POST", body: JSON.stringify(address) });
    return result.address;
  },
  async deleteAddress(id: string): Promise<void> {
    await request(`addresses/${encodeURIComponent(id)}`, { method: "DELETE" });
  },
  async getOrders(): Promise<CustomerAccountOrder[]> {
    const result = await request<{ orders: CustomerAccountOrder[] }>("orders");
    return result.orders || [];
  },
  async cancelOrder(orderNumber: string, reason: string): Promise<{ success: boolean; message: string }> {
    return request("cancel", { method: "POST", body: JSON.stringify({ orderNumber, reason }) });
  },
  async requestReturn(orderNumber: string, requestType: "return" | "exchange", reason: string, notes: string): Promise<{ success: boolean; requestId: number; message: string }> {
    return request("returns", { method: "POST", body: JSON.stringify({ orderNumber, requestType, reason, notes }) });
  },
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
