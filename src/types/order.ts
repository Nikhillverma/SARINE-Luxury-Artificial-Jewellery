/**
 * Order domain types for SARINE jewellery store.
 * Stores immutable snapshots of items and customer details at purchase time.
 */

export interface Address {
  fullName: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
}

export interface OrderLine {
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  image: string;
  sku?: string;
}

export interface OrderCustomer {
  name: string;
  email: string;
  phone: string;
  userId?: string;
}

export type PaymentMethod = 'online' | 'cod';

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded' | 'partially_refunded';

export type OrderStatus =
  | 'placed'
  | 'awaiting_payment'
  | 'confirmed'
  | 'processing'
  | 'needs_refund'
  | 'shipped'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled'
  | 'failed';

export interface Order {
  id: string;
  orderNumber: string; // e.g. "SAR-000123"
  lines: OrderLine[];
  customer: OrderCustomer;
  shippingAddress: Address;
  subtotal: number;
  shippingFee: number;
  total: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  createdAt: string;

  // Optional online payment fields
  publicToken?: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  amount?: number; // amount in paise for Razorpay
  keyId?: string; // Razorpay Key ID

  // Fulfillment & tracking metadata
  courierName?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  shippedAt?: string;
  deliveredAt?: string;
  estimatedDelivery?: string;

  // Cancellation & Returns metadata
  cancelledAt?: string;
  cancellationReason?: string;
  refundNeeded?: boolean;
  refundAmount?: number;
  returnStatus?: 'none' | 'return_requested' | 'return_approved' | 'returned' | 'exchange_requested';
  returnReason?: string;
  returnNotes?: string;
}

/**
 * Payload sent by checkout to create an order.
 * Notice: Only product IDs and quantities are accepted from the client;
 * product prices and snapshot data are re-fetched server-side/service-side.
 */
export interface CreateOrderInput {
  lines: { productId: string; quantity: number }[];
  customer: OrderCustomer;
  shippingAddress: Address;
  paymentMethod: PaymentMethod;
}

export interface VerifyPaymentInput {
  orderNumber: string;
  publicToken: string;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export interface VerifyPaymentResult {
  success: boolean;
  orderNumber?: string;
  paymentStatus?: PaymentStatus;
  orderStatus?: OrderStatus;
  needsRefund?: boolean;
  pending?: boolean;
  message?: string;
}
