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
  CreateOrderInput,
  VerifyPaymentInput,
  VerifyPaymentResult
} from '../../types/order';

export class NetlifyOrderService implements IOrderService {
  /**
   * Creates an order on the server.
   * Prices, inventory, order number, and public tokens are strictly decided server-side.
   */
  async createOrder(input: CreateOrderInput): Promise<Order> {
    let res: Response;
    try {
      res = await fetch('/.netlify/functions/create-order', {
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
    } catch (netErr: any) {
      throw new Error(
        'Unable to reach the secure order server. If testing locally in preview, ensure Netlify Functions are running.'
      );
    }

    if (res.status === 404) {
      throw new Error(
        'The secure order function (/.netlify/functions/create-order) is not hosted in this preview environment. Deploy to Netlify or run "netlify dev" to test server-side payments.'
      );
    }

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(
        data.error ||
          'We were unable to process your order with the server. Please check your details and try again.'
      );
    }

    // Return Order object populated with server tokens and Razorpay order ID
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
      subtotal: data.total ? data.total : (data.amount ? Math.round(data.amount / 100) : 0),
      shippingFee: 0,
      total: data.total ? data.total : (data.amount ? Math.round(data.amount / 100) : 0),
      paymentMethod: input.paymentMethod,
      paymentStatus: 'pending',
      orderStatus: input.paymentMethod === 'online' ? 'awaiting_payment' : 'placed',
      createdAt: new Date().toISOString()
    };
  }

  /**
   * Verifies payment signature with the server and finalizes inventory reduction.
   */
  async verifyPayment(input: VerifyPaymentInput): Promise<VerifyPaymentResult> {
    let res: Response;
    try {
      res = await fetch('/.netlify/functions/verify-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(input)
      });
    } catch (netErr: any) {
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
      const url = `/.netlify/functions/get-order?orderNumber=${encodeURIComponent(
        orderNumber.trim()
      )}&t=${encodeURIComponent(publicToken.trim())}`;

      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!res.ok) {
        return null;
      }

      const data = await res.json();
      return data;
    } catch (err) {
      console.error('[NetlifyOrderService] Failed to fetch order:', err);
      return null;
    }
  }

  /**
   * Retrieves order by ID.
   */
  async getOrderById(id: string): Promise<Order | null> {
    return this.getOrderByNumber(id);
  }
}
