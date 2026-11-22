/**
 * OrderConfirmationPage component for SARINE.
 * Displays order reference number, items snapshot, delivery address, totals,
 * and current statuses in clear, honest language without marketing fluff.
 */

import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { orderService } from '../services';
import { Order } from '../types/order';
import { formatInr } from '../utils/currency';
import {
  CheckCircle2,
  Package,
  MapPin,
  CreditCard,
  Printer,
  ArrowRight,
  Clock,
  AlertCircle
} from 'lucide-react';

export const OrderConfirmationPage: React.FC = () => {
  const { orderNumber } = useParams<{ orderNumber: string }>();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('t') || undefined;

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isCancelled = false;

    async function loadOrder() {
      console.log('[OrderConfirmation] Page load for order:', orderNumber, 'token present:', Boolean(token));

      if (!orderNumber) {
        console.error('[OrderConfirmation] Could not find order: orderNumber parameter is undefined or empty.');
        setLoading(false);
        return;
      }
      setLoading(true);

      try {
        const found = await orderService.getOrderByNumber(orderNumber, token);
        if (!isCancelled) {
          if (!found) {
            console.error(
              `[OrderConfirmation] Could not find order: No order found matching reference "${orderNumber}" with authorization token.`
            );
          } else {
            console.info('[OrderConfirmation] Order loaded successfully:', orderNumber);
          }
          setOrder(found);
        }
      } catch (err) {
        console.error(`[OrderConfirmation] Failed to load order "${orderNumber}" due to error:`, err);
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    loadOrder();

    return () => {
      isCancelled = true;
    };
  }, [orderNumber, token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--tint)] flex items-center justify-center p-8">
        <p className="text-xs uppercase tracking-widest text-[var(--body)] animate-pulse">
          Retrieving order confirmation...
        </p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-[var(--tint)] flex flex-col items-center justify-center p-8 text-center">
        <h2 className="font-serif text-3xl text-[var(--heading)]">We couldn't find this order</h2>
        <p className="text-xs sm:text-sm text-[var(--body)] mt-2 font-sans max-w-md">
          We could not locate an order matching reference &quot;{orderNumber}&quot;. Please verify the order number and secure link.
        </p>
        <Link
          to="/shop"
          className="mt-6 px-6 py-2.5 bg-[var(--plum)] text-white text-xs uppercase tracking-widest hover:bg-[var(--gold)] transition-colors rounded-xs shadow-xs"
        >
          Return to Shop
        </Link>
      </div>
    );
  }

  const parsedOrderDate = order.createdAt ? new Date(order.createdAt) : null;
  const hasValidOrderDate = Boolean(
    parsedOrderDate &&
    !Number.isNaN(parsedOrderDate.getTime()) &&
    parsedOrderDate.getFullYear() > 1970
  );
  const orderDate = hasValidOrderDate
    ? parsedOrderDate!.toLocaleString('en-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : 'Date unavailable';

  const isFailed = order.paymentStatus === 'failed' || order.orderStatus === 'failed';
  const isNeedsRefund = order.orderStatus === 'needs_refund';
  const isPendingOnline = order.paymentMethod === 'online' && order.paymentStatus === 'pending' && !isFailed && !isNeedsRefund;
  const isConfirmedOrPlaced =
    !isFailed &&
    !isNeedsRefund &&
    !isPendingOnline &&
    (order.paymentMethod === 'cod' || (order.paymentMethod === 'online' && order.paymentStatus === 'paid'));

  // Header display logic
  let headerBadge = 'Order Confirmed';
  let headerTitle = `Thank you, ${order.customer.name}`;
  let headerSubtitle = `Your order has been recorded in our system under reference ${order.orderNumber}.`;
  let headerIcon = <CheckCircle2 size={28} className="text-[var(--plum)]" />;
  let headerBorderColor = 'border-[var(--plum)]';

  if (isNeedsRefund) {
    headerBadge = 'Order Update';
    headerTitle = 'Payment received, but an item went out of stock. A full refund will be processed.';
    headerSubtitle = `Your payment was received, but one or more pieces went out of stock before final authorization. Our concierge has queued an immediate full refund for order ${order.orderNumber}.`;
    headerIcon = <AlertCircle size={28} className="text-[#DC2626]" />;
    headerBorderColor = 'border-[#DC2626]';
  } else if (isFailed) {
    headerBadge = 'Payment Failed';
    headerTitle = 'Payment failed';
    headerSubtitle = `We were unable to verify payment for order ${order.orderNumber}. No items have been charged to your account.`;
    headerIcon = <AlertCircle size={28} className="text-[#DC2626]" />;
    headerBorderColor = 'border-[#DC2626]';
  } else if (isPendingOnline) {
    headerBadge = 'Awaiting payment confirmation';
    headerTitle = 'Awaiting payment confirmation';
    headerSubtitle = `We are confirming your payment with the bank for order ${order.orderNumber}. Please allow a few moments.`;
    headerIcon = <Clock size={28} className="text-[var(--plum)]" />;
    headerBorderColor = 'border-[var(--plum)]';
  }

  // Payment status area text
  let paymentStatusText = 'Awaiting payment confirmation';
  let paymentNoticeText = 'Your payment is currently being confirmed by the payment gateway.';

  if (isNeedsRefund) {
    paymentStatusText = order.razorpayPaymentId
      ? `Paid online via Razorpay (${order.razorpayPaymentId})`
      : 'Paid online via Razorpay';
    paymentNoticeText = 'Payment was captured, but an item went out of stock. A full refund will be processed.';
  } else if (isFailed) {
    paymentStatusText = 'Payment failed';
    paymentNoticeText = 'Payment failed. You may retry your purchase at checkout.';
  } else if (order.paymentMethod === 'cod') {
    paymentStatusText = 'Cash on delivery, pay when your order arrives';
    paymentNoticeText = 'Cash on delivery, pay when your order arrives. A tracking link will be provided once your dispatch parcel is scanned by our courier partner.';
  } else if (order.paymentStatus === 'paid') {
    paymentStatusText = order.razorpayPaymentId
      ? `Paid online via Razorpay (${order.razorpayPaymentId})`
      : 'Paid online via Razorpay';
    paymentNoticeText = `Paid online via Razorpay${order.razorpayPaymentId ? ` (Payment ID: ${order.razorpayPaymentId})` : ''}. A tracking link will be provided once your dispatch parcel is scanned by our courier partner.`;
  } else {
    paymentStatusText = 'Awaiting payment confirmation';
    paymentNoticeText = 'Awaiting payment confirmation from your bank or UPI app.';
  }

  const isGreenStatusDot = order.orderStatus === 'confirmed' || order.orderStatus === 'placed';

  return (
    <div className="min-h-screen bg-[var(--tint)] pb-20 text-[var(--heading)]">
      {/* Editorial Header */}
      <div className="bg-[var(--tint)] border-b border-[var(--border)] py-10 px-4 text-center">
        <div className="site-container">
          <div className="max-w-[760px] mx-auto">
            <div
              className={`w-14 h-14 bg-white border ${headerBorderColor} rounded-full flex items-center justify-center mx-auto mb-3 shadow-xs`}
            >
              {headerIcon}
            </div>

            <span className="text-xs uppercase tracking-[0.25em] text-[var(--plum)] font-semibold font-sans block mb-1">
              {headerBadge}
            </span>
            <h1 className="font-serif text-2xl sm:text-3xl text-[var(--heading)] font-normal leading-snug">
              {headerTitle}
            </h1>
            <p className="mt-2 text-xs sm:text-sm text-[var(--body)] font-sans">
              {headerSubtitle}
            </p>

            {isFailed && (
              <div className="mt-6">
                <Link
                  to="/checkout"
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-[var(--plum)] text-white text-xs uppercase tracking-widest font-semibold hover:bg-[var(--gold)] transition-colors shadow-xs rounded-xs"
                >
                  <span>Return to Checkout</span>
                  <ArrowRight size={14} />
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="site-container pt-8">
        <main className="max-w-[1000px] mx-auto space-y-8">
        {/* Order Meta Bar */}
        <div className="bg-white border border-[var(--border)] p-5 sm:p-6 grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs font-sans rounded-sm shadow-xs">
          <div>
            <span className="text-[var(--body)] block uppercase tracking-wider text-[10px]">Order Number</span>
            <span className="font-mono font-semibold text-[var(--heading)] text-sm mt-0.5 block">
              {order.orderNumber}
            </span>
          </div>

          <div>
            <span className="text-[var(--body)] block uppercase tracking-wider text-[10px]">Date Placed</span>
            <span className="text-[var(--heading)] font-medium mt-0.5 block">{orderDate}</span>
          </div>

          <div>
            <span className="text-[var(--body)] block uppercase tracking-wider text-[10px]">Order Status</span>
            <span className="inline-flex items-center gap-1.5 font-semibold capitalize mt-0.5 text-[var(--heading)]">
              {isGreenStatusDot ? (
                <span className="w-2 h-2 rounded-full bg-[#15803D]"></span>
              ) : isFailed ? (
                <span className="w-2 h-2 rounded-full bg-[#DC2626]"></span>
              ) : (
                <span className="w-2 h-2 rounded-full bg-[var(--plum)]"></span>
              )}
              <span>{order.orderStatus.replace('_', ' ')}</span>
            </span>
          </div>

          <div>
            <span className="text-[var(--body)] block uppercase tracking-wider text-[10px]">Payment Status</span>
            <span className="inline-flex items-center gap-1 font-semibold mt-0.5 text-[var(--heading)]">
              {order.paymentStatus === 'paid' ? (
                <CheckCircle2 size={12} className="text-[#15803D]" />
              ) : isFailed ? (
                <AlertCircle size={12} className="text-[#DC2626]" />
              ) : (
                <Clock size={12} className="text-[var(--plum)]" />
              )}
              <span className="capitalize">{paymentStatusText}</span>
            </span>
          </div>
        </div>

        {/* Two Columns: Ordered Items (7 cols) and Delivery Address & Summary (5 cols) */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          {/* Purchased Items Snapshot */}
          <div className="md:col-span-7 bg-white border border-[var(--border)] p-6 space-y-4 rounded-sm shadow-xs">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <h2 className="font-serif text-xl text-[var(--heading)] font-medium flex items-center gap-2">
                <Package size={18} className="text-[var(--plum)]" />
                <span>Pieces Ordered ({order.lines.length})</span>
              </h2>
            </div>

            <div className="divide-y divide-[var(--border)]">
              {order.lines.map((line, idx) => (
                <div key={idx} className="py-3 flex gap-3 items-center">
                  <div className="w-16 h-20 bg-[var(--tint)] border border-[var(--border)] shrink-0 overflow-hidden rounded-xs">
                    <img
                      src={line.image}
                      alt={line.name}
                      className="w-full h-full object-cover object-center"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-serif text-base text-[var(--heading)] font-medium line-clamp-1">
                      {line.name}
                    </p>
                    {line.variantLabel && <p className="text-[11px] text-[var(--plum)]">{line.variantLabel}{line.sku ? ` · SKU: ${line.sku}` : ''}</p>}
                    <p className="text-xs text-[var(--body)] font-sans mt-0.5">
                      Qty: {line.quantity} × {formatInr(line.unitPrice)}
                    </p>
                  </div>
                  <div className="text-right text-sm font-semibold text-[var(--heading)]">
                    {formatInr(line.unitPrice * line.quantity)}
                  </div>
                </div>
              ))}
            </div>

            {/* Subtotal & Total breakdown */}
            <div className="pt-4 border-t border-[var(--border)] space-y-2 text-xs font-sans">
              <div className="flex justify-between text-[var(--body)]">
                <span>Items Subtotal</span>
                <span>{formatInr(order.subtotal)}</span>
              </div>
              {!!order.discountAmount && order.discountAmount > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>{order.promotion?.name || (order.couponCode ? "Coupon (" + order.couponCode + ")" : "Promotion discount")}</span>
                  <span>-{formatInr(order.discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-[var(--body)]">
                <span>Standard Delivery (India)</span>
                <span>{order.shippingFee === 0 ? 'Complimentary' : formatInr(order.shippingFee)}</span>
              </div>
              <div className="flex justify-between text-[var(--heading)] font-semibold text-base pt-2 border-t border-[var(--border)]">
                <span className="font-serif">Total Amount</span>
                <span className="font-serif text-xl">{formatInr(order.total)}</span>
              </div>
            </div>
          </div>

          {/* Customer & Shipping Destination Snapshot */}
          <div className="md:col-span-5 space-y-6">
            <div className="bg-white border border-[var(--border)] p-6 space-y-4 rounded-sm shadow-xs">
              <h2 className="font-serif text-lg text-[var(--heading)] font-medium flex items-center gap-2 border-b border-[var(--border)] pb-3">
                <MapPin size={18} className="text-[var(--plum)]" />
                <span>Shipping Address</span>
              </h2>

              <div className="text-xs font-sans text-[var(--body)] space-y-1 leading-relaxed">
                <p className="font-semibold text-[var(--heading)]">{order.shippingAddress.fullName}</p>
                <p>{order.shippingAddress.line1}</p>
                {order.shippingAddress.line2 && <p>{order.shippingAddress.line2}</p>}
                <p>
                  {order.shippingAddress.city}, {order.shippingAddress.state} -{' '}
                  <span className="font-mono">{order.shippingAddress.pincode}</span>
                </p>
                <p className="pt-2 text-[var(--heading)]">
                  <strong>Phone:</strong> +91 {order.shippingAddress.phone}
                </p>
                <p className="text-[var(--heading)]">
                  <strong>Email:</strong> {order.customer.email}
                </p>
              </div>
            </div>

            <div className="bg-white border border-[var(--border)] p-6 space-y-3 rounded-sm shadow-xs">
              <h2 className="font-serif text-lg text-[var(--heading)] font-medium flex items-center gap-2 border-b border-[var(--border)] pb-3">
                <CreditCard size={18} className="text-[var(--plum)]" />
                <span>Payment Notice</span>
              </h2>

              <p className="text-xs text-[var(--body)] leading-relaxed font-sans">
                {paymentNoticeText}
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-[var(--border)]">
          <button
            onClick={() => window.print()}
            className="w-full sm:w-auto px-5 py-2.5 border border-[var(--border)] text-xs uppercase tracking-widest text-[var(--heading)] hover:bg-[var(--tint)] transition-colors inline-flex items-center justify-center gap-2 rounded-xs"
          >
            <Printer size={14} />
            <span>Print Receipt</span>
          </button>

          <Link
            to="/shop"
            className="w-full sm:w-auto px-8 py-3 bg-[var(--plum)] text-white text-xs uppercase tracking-[0.2em] font-semibold hover:bg-[var(--gold)] transition-colors inline-flex items-center justify-center gap-2 rounded-xs shadow-xs"
          >
            <span>Explore More Pieces</span>
            <ArrowRight size={14} />
          </Link>
        </div>
      </main>
    </div>
  </div>
  );
};
