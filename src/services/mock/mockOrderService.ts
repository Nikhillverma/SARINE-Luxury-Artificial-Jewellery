/**
 * In-memory Mock Order Service for SARINE.
 * Implements IOrderService with persistence in localStorage and simulated network latency.
 *
 * Security & Integrity Rule:
 * Re-fetches every product via productService, recomputes prices and stock bounds,
 * and rejects the order if any product is inactive or out of stock.
 */

import { IOrderService, IProductService } from '../interfaces';
import { Order, CreateOrderInput, OrderLine } from '../../types/order';
import { calculateShippingFee } from '../../config/store';

const ORDERS_STORAGE_KEY = 'sarine_orders_v1';
const SEQ_STORAGE_KEY = 'sarine_order_seq_v1';
const NETWORK_DELAY_MS = 250;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadOrdersFromStorage(): Order[] {
  try {
    const raw = localStorage.getItem(ORDERS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('[MockOrderService] Failed to read orders from storage:', err);
    return [];
  }
}

function saveOrdersToStorage(orders: Order[]): void {
  try {
    localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(orders));
  } catch (err) {
    console.warn('[MockOrderService] Failed to save orders to storage:', err);
  }
}

function getNextOrderNumber(): string {
  try {
    const rawSeq = localStorage.getItem(SEQ_STORAGE_KEY);
    let seq = rawSeq ? parseInt(rawSeq, 10) : 100;
    if (isNaN(seq) || seq < 100) seq = 100;
    seq += 1;
    localStorage.setItem(SEQ_STORAGE_KEY, seq.toString());
    return `SAR-${seq.toString().padStart(6, '0')}`;
  } catch {
    const fallbackSeq = Math.floor(100000 + Math.random() * 900000);
    return `SAR-${fallbackSeq}`;
  }
}

export class MockOrderService implements IOrderService {
  private productService: IProductService;

  constructor(productService: IProductService) {
    this.productService = productService;
  }

  async createOrder(input: CreateOrderInput): Promise<Order> {
    await sleep(NETWORK_DELAY_MS);

    if (!input.lines || input.lines.length === 0) {
      throw new Error('Your shopping bag is empty. Please add pieces before ordering.');
    }

    // Step 1: Re-fetch all products directly from the product service.
    // Never trust client-supplied prices or availability!
    const productIds = input.lines.map((l) => l.productId);
    const liveProducts = await this.productService.getProductsByIds(productIds, {
      includeAll: true
    });

    const liveProductMap = new Map(liveProducts.map((p) => [p.id, p]));

    // Step 2: Validate active status and stock availability for every requested line
    const verifiedLines: OrderLine[] = [];
    let calculatedSubtotal = 0;

    for (const line of input.lines) {
      const product = liveProductMap.get(line.productId);

      if (!product) {
        throw new Error(
          `A selected piece (ID: ${line.productId}) could not be found in our catalogue.`
        );
      }

      if (product.status !== 'active') {
        throw new Error(
          `"${product.name}" is no longer active in our collection.`
        );
      }

      if (product.stock <= 0) {
        throw new Error(
          `"${product.name}" is currently out of stock.`
        );
      }

      if (line.quantity > product.stock) {
        throw new Error(
          `Only ${product.stock} ${product.stock === 1 ? 'piece is' : 'pieces are'} available for "${product.name}". You requested ${line.quantity}.`
        );
      }

      // Re-compute using authoritative price from live product
      const unitPrice = product.price;
      const lineTotal = unitPrice * line.quantity;
      calculatedSubtotal += lineTotal;

      verifiedLines.push({
        productId: product.id,
        name: product.name,
        unitPrice,
        quantity: line.quantity,
        image: product.images[0] || ''
      });

      // Deduct stock in memory mock representation
      product.stock -= line.quantity;
    }

    // Step 3: Compute authoritative shipping fee and total from config
    const shippingFee = calculateShippingFee(calculatedSubtotal);
    const total = calculatedSubtotal + shippingFee;

    // Step 4: Generate order object with immutable snapshots
    const orderNumber = getNextOrderNumber();
    const order: Order = {
      id: `ord-${Date.now()}`,
      orderNumber,
      lines: verifiedLines,
      customer: {
        name: input.customer.name.trim(),
        email: input.customer.email.trim().toLowerCase(),
        phone: input.customer.phone.trim()
      },
      shippingAddress: {
        fullName: input.shippingAddress.fullName.trim(),
        phone: input.shippingAddress.phone.trim(),
        line1: input.shippingAddress.line1.trim(),
        line2: input.shippingAddress.line2?.trim() || undefined,
        city: input.shippingAddress.city.trim(),
        state: input.shippingAddress.state.trim(),
        pincode: input.shippingAddress.pincode.trim()
      },
      subtotal: calculatedSubtotal,
      shippingFee,
      total,
      paymentMethod: input.paymentMethod,
      paymentStatus: 'pending',
      orderStatus: 'placed',
      publicToken: `mock-token-${Date.now()}`,
      createdAt: new Date().toISOString()
    };

    // Step 5: Persist to storage
    const currentOrders = loadOrdersFromStorage();
    currentOrders.unshift(order);
    saveOrdersToStorage(currentOrders);

    return order;
  }

  async getOrderById(id: string): Promise<Order | null> {
    await sleep(NETWORK_DELAY_MS);
    const orders = loadOrdersFromStorage();
    const found = orders.find((o) => o.id === id);
    return found ? { ...found } : null;
  }

  async getOrderByNumber(orderNumber: string, _publicToken?: string): Promise<Order | null> {
    await sleep(NETWORK_DELAY_MS);
    const orders = loadOrdersFromStorage();
    const cleanNumber = orderNumber.trim().toUpperCase();
    const found = orders.find((o) => o.orderNumber.toUpperCase() === cleanNumber);
    return found ? { ...found } : null;
  }
}
