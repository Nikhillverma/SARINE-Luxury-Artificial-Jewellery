import type { IOrderService } from "../interfaces";
import type { Order, CreateOrderInput, VerifyPaymentInput, VerifyPaymentResult } from "../../types/order";

const API_BASE = (
  import.meta.env.VITE_HOSTINGER_API_BASE_URL ||
  (import.meta.env.DEV ? "/api" : "https://lavender-goldfish-844589.hostingersite.com/api")
).replace(/\/+$/, "");

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options.headers }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof data.error === "string" ? data.error : `SARINE API request failed (${response.status}).`);
  }
  return data as T;
}

interface CreateOrderResponse {
  orderNumber: string;
  publicToken: string;
  orderStatus: Order["orderStatus"];
  subtotal: number;
  shippingFee: number;
  discountAmount?: number;
  couponCode?: string | null;
  total: number;
  razorpayOrderId?: string;
  amount?: number;
  keyId?: string;
}

export class HostingerOrderService implements IOrderService {
  async createOrder(input: CreateOrderInput): Promise<Order> {
    const result = await request<CreateOrderResponse>("/orders/create", {
      method: "POST",
      body: JSON.stringify({
        items: input.lines.map((line) => ({
          productId: line.productId,
          quantity: line.quantity
        })),
        customer: {
          name: input.customer.name,
          email: input.customer.email,
          phone: input.customer.phone
        },
        shippingAddress: input.shippingAddress,
        paymentMethod: input.paymentMethod
      })
    });

    return {
      id: result.orderNumber,
      orderNumber: result.orderNumber,
      lines: [],
      customer: input.customer,
      shippingAddress: input.shippingAddress,
      subtotal: Number(result.subtotal) || 0,
      shippingFee: Number(result.shippingFee) || 0,
      total: Number(result.total) || 0,
      paymentMethod: input.paymentMethod,
      paymentStatus: input.paymentMethod === "cod" ? "pending" : "pending",
      orderStatus: result.orderStatus,
      createdAt: new Date().toISOString(),
      publicToken: result.publicToken,
      razorpayOrderId: result.razorpayOrderId,
      amount: result.amount,
      keyId: result.keyId
    };
  }

  async getOrderById(_id: string): Promise<Order | null> {
    return null;
  }

  async getOrderByNumber(orderNumber: string, publicToken?: string): Promise<Order | null> {
    if (!publicToken) return null;
    try {
      return await request<Order>(
        `/orders/${encodeURIComponent(orderNumber)}?t=${encodeURIComponent(publicToken)}`
      );
    } catch (error) {
      if (error instanceof Error && error.message.includes("(404)")) return null;
      throw error;
    }
  }

  async verifyPayment(input: VerifyPaymentInput): Promise<VerifyPaymentResult> {
    return request<VerifyPaymentResult>("/orders/verify", {
      method: "POST",
      body: JSON.stringify(input)
    });
  }
}
