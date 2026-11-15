import { Order } from "../types/order";

const API_BASE = (
  import.meta.env.VITE_HOSTINGER_API_BASE_URL ||
  (import.meta.env.DEV ? "/api" : "https://lavender-goldfish-844589.hostingersite.com/api")
).replace(/\/+$/, "");

async function customerRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}/customer/auth/${path}`, {
    ...options,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options.headers }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Customer request failed.");
  return data as T;
}

class CustomerOrderService {
  async getCustomerOrders(): Promise<Order[]> {
    const result = await customerRequest<{ orders: Order[] }>("orders");
    return Array.isArray(result.orders) ? result.orders : [];
  }

  async cancelOrder(orderNumber: string, reason: string): Promise<{ success: boolean; message: string }> {
    return customerRequest<{ success: boolean; message: string }>("cancel", {
      method: "POST",
      body: JSON.stringify({ orderNumber, reason })
    });
  }

  async requestReturnOrExchange(
    orderNumber: string,
    reason: string,
    actionType: "return" | "exchange",
    notes: string
  ): Promise<{ success: boolean; message: string }> {
    return customerRequest<{ success: boolean; message: string }>("returns", {
      method: "POST",
      body: JSON.stringify({ orderNumber, reason, requestType: actionType, notes })
    });
  }
}

export const customerOrderService = new CustomerOrderService();
