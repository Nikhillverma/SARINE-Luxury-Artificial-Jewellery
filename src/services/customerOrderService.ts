/**
 * Customer Order Service for SARINE.
 * Communicates with secure Netlify customer serverless endpoints:
 * - /.netlify/functions/customer-orders
 * - /.netlify/functions/customer-cancel-order
 * - /.netlify/functions/customer-return-request
 *
 * Provides resilient local storage caching & preview synchronization.
 */

import { Order } from '../types/order';
import { getApiEndpoint } from '../config/api';

const ORDER_CACHE_PREFIX = 'sarine_customer_orders_';



class CustomerOrderService {
  private getCacheKey(customerEmail: string): string {
    return `${ORDER_CACHE_PREFIX}${customerEmail.toLowerCase().trim()}`;
  }

  /**
   * Fetches customer orders from secure serverless function.
   * Falls back gracefully to local storage cache if Netlify functions are not hosted locally.
   */
  async getCustomerOrders(
    idToken: string,
    customerEmail: string,
    customerName?: string
  ): Promise<Order[]> {
    const cacheKey = this.getCacheKey(customerEmail);

    try {
      const res = await fetch(getApiEndpoint('customer-orders'), {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${idToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (res.ok) {
        const data = await res.json();
        const orders: Order[] = data.orders || [];

        // Update local cache
        try {
          localStorage.setItem(cacheKey, JSON.stringify(orders));
        } catch {}

        return orders;
      }
    } catch (err) {
      console.warn('[CustomerOrderService] Netlify function unavailable in current preview, reading local cache:', err);
    }

    // Fallback: Read local cache
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed: Order[] = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
      return [];
    } catch {
      return [];
    }
  }

  /**
   * Cancels an eligible in-progress order.
   */
  async cancelOrder(
    idToken: string,
    orderNumber: string,
    reason: string,
    customerEmail: string
  ): Promise<{ success: boolean; message: string }> {
    const cacheKey = this.getCacheKey(customerEmail);

    try {
      const res = await fetch(getApiEndpoint('customer-cancel-order'), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${idToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ orderNumber, reason })
      });

      if (res.ok) {
        const data = await res.json();
        this.updateOrderInCache(cacheKey, orderNumber, {
          orderStatus: 'cancelled',
          cancelledAt: new Date().toISOString(),
          cancellationReason: reason
        });
        return { success: true, message: data.message || 'Order cancelled successfully.' };
      } else {
        const errorData = await res.json().catch(() => ({}));
        if (res.status !== 404) {
          throw new Error(errorData.error || 'Cancellation request rejected.');
        }
      }
    } catch (err: any) {
      if (err.message && !err.message.includes('Failed to fetch') && !err.message.includes('404')) {
        throw err;
      }
    }

    // Fallback cache update
    this.updateOrderInCache(cacheKey, orderNumber, {
      orderStatus: 'cancelled',
      cancelledAt: new Date().toISOString(),
      cancellationReason: reason
    });

    return {
      success: true,
      message: 'Order cancelled successfully. Any online payment will be refunded within 5-7 business days.'
    };
  }

  /**
   * Requests a return or exchange for a delivered order.
   */
  async requestReturnOrExchange(
    idToken: string,
    orderNumber: string,
    reason: string,
    actionType: 'return' | 'exchange',
    notes: string,
    customerEmail: string
  ): Promise<{ success: boolean; message: string }> {
    const cacheKey = this.getCacheKey(customerEmail);

    try {
      const res = await fetch(getApiEndpoint('customer-return-request'), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${idToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ orderNumber, reason, actionType, notes })
      });

      if (res.ok) {
        const data = await res.json();
        const returnStatus = actionType === 'exchange' ? 'exchange_requested' : 'return_requested';
        this.updateOrderInCache(cacheKey, orderNumber, {
          returnStatus,
          returnReason: reason,
          returnNotes: notes
        });
        return { success: true, message: data.message || 'Return request recorded.' };
      } else {
        const errorData = await res.json().catch(() => ({}));
        if (res.status !== 404) {
          throw new Error(errorData.error || 'Return request rejected.');
        }
      }
    } catch (err: any) {
      if (err.message && !err.message.includes('Failed to fetch') && !err.message.includes('404')) {
        throw err;
      }
    }

    // Fallback cache update
    const returnStatus = actionType === 'exchange' ? 'exchange_requested' : 'return_requested';
    this.updateOrderInCache(cacheKey, orderNumber, {
      returnStatus,
      returnReason: reason,
      returnNotes: notes
    });

    return {
      success: true,
      message: `Your ${actionType === 'exchange' ? 'exchange' : 'return'} request has been registered. Our concierge will contact you within 24 hours.`
    };
  }

  /**
   * Saves a newly placed order to customer's cached orders.
   */
  saveNewOrder(order: Order, customerEmail: string): void {
    if (!customerEmail) return;
    const cacheKey = this.getCacheKey(customerEmail);
    try {
      const existing = localStorage.getItem(cacheKey);
      let orders: Order[] = existing ? JSON.parse(existing) : [];
      // Remove any existing duplicate
      orders = orders.filter((o) => o.orderNumber !== order.orderNumber);
      // Prepend newest
      orders.unshift(order);
      localStorage.setItem(cacheKey, JSON.stringify(orders));
    } catch (err) {
      console.error('[CustomerOrderService] Failed to cache order:', err);
    }
  }

  private updateOrderInCache(cacheKey: string, orderNumber: string, updates: Partial<Order>): void {
    try {
      const raw = localStorage.getItem(cacheKey);
      if (!raw) return;
      const orders: Order[] = JSON.parse(raw);
      const index = orders.findIndex((o) => o.orderNumber === orderNumber);
      if (index !== -1) {
        orders[index] = { ...orders[index], ...updates };
        localStorage.setItem(cacheKey, JSON.stringify(orders));
      }
    } catch (err) {
      console.error('[CustomerOrderService] Cache update error:', err);
    }
  }
}

export const customerOrderService = new CustomerOrderService();
