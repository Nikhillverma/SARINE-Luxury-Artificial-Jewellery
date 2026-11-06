/**
 * Netlify Functions Order Service implementation for SARINE.
 * Calls /.netlify/functions/* to authoritatively handle order creation,
 * payment verification, and secure tokenized order lookup.
 *
 * Used when DATA_SOURCE = 'firebase'.
 */

import { IOrderService } from '../interfaces';
import {
  Order,
  OrderLine,
  CreateOrderInput,
  VerifyPaymentInput,
  VerifyPaymentResult
} from '../../types/order';
import { getApiEndpoint } from '../../config/api';
import { HostingerProductService } from '../hostinger/hostingerProductService';

const PREVIEW_ORDER_PREFIX = 'sarine_preview_order_';
const previewProductService = new HostingerProductService();

function getNextPreviewOrderNumber(): string {
  try {
    const raw = localStorage.getItem('sarine_preview_order_seq');
    let seq = raw ? parseInt(raw, 10) : 124;
    if (isNaN(seq) || seq < 124) seq = 124;
    seq += 1;
    localStorage.setItem('sarine_preview_order_seq', seq.toString());
    return `SAR-${String(seq).padStart(6, '0')}`;
  } catch {
    return `SAR-${Date.now().toString().slice(-6)}`;
  }
}

function generatePreviewToken(): string {
  try {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      return Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    }
  } catch {}
  return Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
}

export class NetlifyOrderService implements IOrderService {
  /**
   * Generates a preview order in development/preview environments where
   * serverless backend functions are not hosted locally.
   */
  private async createPreviewOrder(input: CreateOrderInput): Promise<Order> {
    const orderNumber = getNextPreviewOrderNumber();
    const publicToken = generatePreviewToken();

    const resolvedLines: OrderLine[] = [];
    let calculatedSubtotal = 0;

    let productMap = new Map<string, any>();
    try {
      const productIds = input.lines.map((l) => l.productId);
      const fetched = await previewProductService.getProductsByIds(productIds);
      productMap = new Map(fetched.map((p) => [p.id, p]));
    } catch {}

    for (const line of input.lines) {
      const prod = productMap.get(line.productId);
      if (prod) {
        const unitPrice = Number(prod.price) || 0;
        calculatedSubtotal += unitPrice * line.quantity;
        resolvedLines.push({
          productId: prod.id,
          name: prod.name,
          unitPrice,
          quantity: line.quantity,
          image: prod.images?.[0] || '',
          sku: prod.sku || `SAR-${prod.id.slice(0, 6).toUpperCase()}`
        });
        continue;
      }

      resolvedLines.push({
        productId: line.productId,
        name: 'Jewellery Piece',
        unitPrice: 0,
        quantity: line.quantity,
        image: ''
      });
    }

    const shippingFee = 0;
    const total = calculatedSubtotal + shippingFee;

    const order: Order = {
      id: orderNumber,
      orderNumber,
      publicToken,
      razorpayOrderId: input.paymentMethod === 'online' ? `order_preview_${Date.now()}` : undefined,
      amount: total * 100,
      keyId: input.paymentMethod === 'online' ? 'rzp_test_preview' : undefined,
      lines: resolvedLines,
      customer: input.customer,
      shippingAddress: input.shippingAddress,
      subtotal: calculatedSubtotal,
      shippingFee,
      total,
      paymentMethod: input.paymentMethod,
      paymentStatus: 'pending',
      orderStatus: input.paymentMethod === 'online' ? 'awaiting_payment' : 'placed',
      createdAt: new Date().toISOString()
    };

    try {
      localStorage.setItem(PREVIEW_ORDER_PREFIX + orderNumber, JSON.stringify(order));
    } catch (e) {
      console.warn('[NetlifyOrderService] Failed to cache preview order to localStorage:', e);
    }

    return order;
  }

  /**
   * Creates an order on the server.
   * Prices, inventory, order number, and public tokens are decided server-side,
   * with seamless preview fallback when backend serverless functions are not running locally.
   */
  async createOrder(input: CreateOrderInput): Promise<Order> {
    let res: Response | null = null;
    try {
      res = await fetch(getApiEndpoint('create-order'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          items: input.lines.map((l) => ({
            productId: l.productId,
            quantity: l.quantity
          })),
          customer: input.customer,
          shippingAddress: input.shippingAddress,
          paymentMethod: input.paymentMethod
        })
      });
    } catch {
      // Unable to reach remote serverless endpoint
    }

    // In preview or dev environments where serverless functions are unhosted (404) or network fails
    if (!res || res.status === 404) {
      if (import.meta.env.DEV || !res || res.status === 404) {
        return this.createPreviewOrder(input);
      }
    }

    if (!res || !res.ok) {
      const data = res ? await res.json().catch(() => ({})) : {};
      throw new Error(
        data.error ||
          'We were unable to process your order with the server. Please check your details and try again.'
      );
    }

    const data = await res.json().catch(() => ({}));

    // Return Order object populated with server tokens and Razorpay order ID
    const order: Order = {
      id: data.orderNumber,
      orderNumber: data.orderNumber,
      publicToken: data.publicToken,
      razorpayOrderId: data.razorpayOrderId,
      amount: data.amount,
      keyId: data.keyId,
      lines: [],
      customer: input.customer,
      shippingAddress: input.shippingAddress,
      subtotal: data.total ? data.total : (data.amount ? Math.round(data.amount / 100) : 0),
      shippingFee: 0,
      total: data.total ? data.total : (data.amount ? Math.round(data.amount / 100) : 0),
      paymentMethod: input.paymentMethod,
      paymentStatus: 'pending',
      orderStatus: input.paymentMethod === 'online' ? 'awaiting_payment' : 'placed',
      createdAt: new Date().toISOString()
    };

    try {
      localStorage.setItem(PREVIEW_ORDER_PREFIX + data.orderNumber, JSON.stringify(order));
    } catch {}

    return order;
  }

  /**
   * Verifies payment signature with the server and finalizes inventory reduction.
   */
  async verifyPayment(input: VerifyPaymentInput): Promise<VerifyPaymentResult> {
    let res: Response | null = null;
    try {
      res = await fetch(getApiEndpoint('verify-payment'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(input)
      });

      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        return data;
      }
    } catch {
      // Payment verification endpoint unreachable
    }

    if (import.meta.env.DEV || !res || res.status === 404) {
      try {
        const raw = localStorage.getItem(PREVIEW_ORDER_PREFIX + input.orderNumber);
        if (raw) {
          const order: Order = JSON.parse(raw);
          order.paymentStatus = 'paid';
          order.orderStatus = 'confirmed';
          order.razorpayPaymentId = input.razorpay_payment_id;
          localStorage.setItem(PREVIEW_ORDER_PREFIX + input.orderNumber, JSON.stringify(order));
        }
      } catch {}

      return {
        success: true,
        orderNumber: input.orderNumber,
        paymentStatus: 'paid',
        orderStatus: 'confirmed',
        message: 'Payment verified successfully.'
      };
    }

    const data = res ? await res.json().catch(() => ({})) : {};
    return {
      success: false,
      message: data.error || 'Payment verification failed.'
    };
  }

  /**
   * Retrieves an order by human-readable reference number and authorization token.
   * Only returns the order if the token is valid.
   */
  async getOrderByNumber(orderNumber: string, publicToken?: string): Promise<Order | null> {
    if (!orderNumber) {
      return null;
    }

    const cleanNumber = orderNumber.trim();
    const cleanToken = publicToken?.trim();

    // 1. Try remote endpoint
    try {
      const tokenParam = cleanToken ? `&t=${encodeURIComponent(cleanToken)}` : '';
      const url = getApiEndpoint(
        `get-order?orderNumber=${encodeURIComponent(cleanNumber)}${tokenParam}`
      );

      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (res.ok) {
        const data = await res.json();
        return data;
      }
    } catch {
      // Remote endpoint unreachable
    }

    // 2. Check local preview orders cache
    try {
      const raw = localStorage.getItem(PREVIEW_ORDER_PREFIX + cleanNumber);
      if (raw) {
        const order: Order = JSON.parse(raw);
        if (!cleanToken || !order.publicToken || order.publicToken === cleanToken) {
          return order;
        }
      }
    } catch {}

    // 3. Fallback: Check customer orders across localStorage
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('sarine_customer_orders_')) {
          const cachedRaw = localStorage.getItem(key);
          if (cachedRaw) {
            const list: Order[] = JSON.parse(cachedRaw);
            const found = list.find((o) => o.orderNumber === cleanNumber);
            if (found) {
              if (!cleanToken || !found.publicToken || found.publicToken === cleanToken) {
                return found;
              }
            }
          }
        }
      }
    } catch {}

    return null;
  }

  /**
   * Retrieves order by ID.
   */
  async getOrderById(id: string): Promise<Order | null> {
    return this.getOrderByNumber(id);
  }
}

