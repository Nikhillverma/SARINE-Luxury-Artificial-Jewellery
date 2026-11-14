/**
 * Hostinger MariaDB Order Service implementation for SARINE.
 * Communicates with /api/orders/* on the Hostinger Express backend to authoritatively
 * handle order creation, live price/stock validation, payment verification,
 * and secure tokenized order lookup.
 */

import type { IOrderService } from '../interfaces';
import type {
  Order,
  CreateOrderInput,
  VerifyPaymentInput,
  VerifyPaymentResult
} from '../../types/order';

function resolveApiBase(): string {
  if (import.meta.env.VITE_HOSTINGER_API_BASE_URL) {
    return import.meta.env.VITE_HOSTINGER_API_BASE_URL.replace(/\/+$/, '');
  }
  if (import.meta.env.DEV) {
    return '/api';
  }
  return 'https://lavender-goldfish-844589.hostingersite.com/api';
}

export class HostingerOrderService implements IOrderService {
  /**
   * Creates an order on the Hostinger MariaDB backend.
   * Prices, inventory, sequential SAR order numbers, and public tokens are strictly decided server-side.
   */
  async createOrder(input: CreateOrderInput): Promise<Order> {
    const apiBase = resolveApiBase();
    let res: Response;
    try {
      res = await fetch(`${apiBase}/orders/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({
          items: input.lines.map((l) => ({
            productId: l.productId,
            quantity: l.quantity
          })),
          customer: input.customer,
          shippingAddress: input.shippingAddress,
          paymentMethod: input.paymentMethod,
          couponCode: input.couponCode
        })
      });
    } catch (netErr: any) {
      console.error('[HostingerOrderService] Network error during createOrder:', netErr);
      throw new Error(
        'Unable to reach the secure order server. Please check your internet connection and try again.'
      );
    }

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(
        data.error ||
          'We were unable to process your order with the server. Please check your details and try again.'
      );
    }

    return {
      id: data.orderNumber,
      orderNumber: data.orderNumber,
      publicToken: data.publicToken,
      razorpayOrderId: data.razorpayOrderId,
      amount: data.amount,
      keyId: data.keyId,
      lines: [],
      customer: input.customer,
      shippingAddress: input.shippingAddress,
      subtotal: data.subtotal !== undefined ? Number(data.subtotal) : (data.total ? Number(data.total) : (data.amount ? Math.round(data.amount / 100) : 0)),
      shippingFee: data.shippingFee !== undefined ? Number(data.shippingFee) : 0,
      discountAmount: Number(data.discountAmount || 0),
      couponCode: data.couponCode || undefined,
      total: data.total ? Number(data.total) : (data.amount ? Math.round(data.amount / 100) : 0),
      paymentMethod: input.paymentMethod,
      paymentStatus: 'pending',
      orderStatus: input.paymentMethod === 'online' ? 'awaiting_payment' : 'placed',
      createdAt: new Date().toISOString()
    };
  }

  /**
   * Verifies Razorpay payment signature with the Hostinger server and finalizes inventory reduction.
   */
  async verifyPayment(input: VerifyPaymentInput): Promise<VerifyPaymentResult> {
    const apiBase = resolveApiBase();
    let res: Response;
    try {
      res = await fetch(`${apiBase}/orders/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify(input)
      });
    } catch (netErr: any) {
      console.error('[HostingerOrderService] Network error during verifyPayment:', netErr);
      throw new Error('Unable to connect to the payment verification server.');
    }

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return {
        success: false,
        message: data.error || 'Payment verification failed.'
      };
    }

    return data;
  }

  /**
   * Retrieves an order by human-readable reference number and authorization token.
   * Only returns the order if the token is valid.
   */
  async getOrderByNumber(orderNumber: string, publicToken?: string): Promise<Order | null> {
    if (!orderNumber || !publicToken) {
      return null;
    }

    try {
      const apiBase = resolveApiBase();
      const url = `${apiBase}/orders/${encodeURIComponent(
        orderNumber.trim()
      )}?t=${encodeURIComponent(publicToken.trim())}`;

      const res = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json'
        }
      });

      if (!res.ok) {
        return null;
      }

      const data = await res.json();
      return data;
    } catch (err) {
      console.error('[HostingerOrderService] Failed to fetch order:', err);
      return null;
    }
  }

  /**
   * Retrieves order by ID.
   */
  async getOrderById(id: string): Promise<Order | null> {
    return this.getOrderByNumber(id);
  }

  /**
   * Tracks order status via phone verification against Hostinger MariaDB.
   */
  async trackOrder(orderNumber: string, phone: string): Promise<any> {
    const apiBase = resolveApiBase();
    const res = await fetch(`${apiBase}/orders/track`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({
        orderNumber: orderNumber.trim(),
        phone: phone.trim()
      })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err: any = new Error(data.error || "We couldn't find an order with those details.");
      err.status = res.status;
      throw err;
    }

    return data;


  /** Submit a return or exchange request using the same order-number + phone verification as tracking. */
  async requestReturn(orderNumber: string, phone: string, requestType: 'return' | 'exchange', reason: string, notes: string) {
    const apiBase = resolveApiBase();
    const res = await fetch(`${apiBase}/orders/returns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ orderNumber: orderNumber.trim(), phone: phone.trim(), requestType, reason, notes })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err: any = new Error(data.error || 'Could not submit your return request.');
      err.status = res.status;
      throw err;
    }
    return data as { success: boolean; requestId: number; orderNumber: string; status: string };
  }

  }
}
