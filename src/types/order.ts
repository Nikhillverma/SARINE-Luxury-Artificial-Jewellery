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
}

export interface OrderCustomer {
  name: string;
  email: string;
  phone: string;
}

export type PaymentMethod = 'online' | 'cod';

export type PaymentStatus = 'pending' | 'paid' | 'failed';

export type OrderStatus =
  | 'placed'
  | 'awaiting_payment'
  | 'confirmed'
  | 'needs_refund'
  | 'shipped'
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
