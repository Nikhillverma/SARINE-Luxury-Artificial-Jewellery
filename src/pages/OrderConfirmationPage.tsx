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
            console.log('[OrderConfirmation] Order found and loaded successfully:', found);
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
      <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center p-8">
        <p className="text-xs uppercase tracking-widest text-[#6B635D] animate-pulse">
          Retrieving order confirmation...
        </p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] flex flex-col items-center justify-center p-8 text-center">
        <h2 className="font-serif text-3xl text-[#1C1917]">We couldn't find this order</h2>
        <p className="text-xs sm:text-sm text-[#6B635D] mt-2 font-sans max-w-md">
          We could not locate an order matching reference &quot;{orderNumber}&quot;. Please verify the order number and secure link.
        </p>
        <Link
          to="/shop"
          className="mt-6 px-6 py-2.5 bg-[#1C1917] text-[#FAF8F5] text-xs uppercase tracking-widest hover:bg-[#B89758] transition-colors"
        >
          Return to Shop
        </Link>
      </div>
    );
  }

  const orderDate = new Date(order.createdAt).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

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
  let headerIcon = <CheckCircle2 size={28} className="text-[#B89758]" />;
  let headerBorderColor = 'border-[#B89758]';

  if (isNeedsRefund) {
    headerBadge = 'Order Update';
    headerTitle = 'Payment received, but an item went out of stock. A full refund will be processed.';
    headerSubtitle = `Your payment was received, but one or more pieces went out of stock before final authorization. Our concierge has queued an immediate full refund for order ${order.orderNumber}.`;
    headerIcon = <AlertCircle size={28} className="text-[#8C2F2F]" />;
    headerBorderColor = 'border-[#8C2F2F]';
  } else if (isFailed) {
    headerBadge = 'Payment Failed';
    headerTitle = 'Payment failed';
    headerSubtitle = `We were unable to verify payment for order ${order.orderNumber}. No items have been charged to your account.`;
    headerIcon = <AlertCircle size={28} className="text-[#8C2F2F]" />;
    headerBorderColor = 'border-[#8C2F2F]';
  } else if (isPendingOnline) {
    headerBadge = 'Awaiting payment confirmation';
    headerTitle = 'Awaiting payment confirmation';
    headerSubtitle = `We are confirming your payment with the bank for order ${order.orderNumber}. Please allow a few moments.`;
    headerIcon = <Clock size={28} className="text-[#B89758]" />;
    headerBorderColor = 'border-[#B89758]';
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
    <div className="min-h-screen bg-[#FAF8F5] pb-20">
      {/* Editorial Header */}
      <div className="bg-[#F3EEE7]/50 border-b border-[#E6DFD5] py-10 px-4 text-center">
        <div className="max-w-[760px] mx-auto">
          <div
            className={`w-14 h-14 bg-[#FAF8F5] border ${headerBorderColor} rounded-full flex items-center justify-center mx-auto mb-3 shadow-xs`}
          >
            {headerIcon}
          </div>

          <span className="text-xs uppercase tracking-[0.25em] text-[#B89758] font-semibold font-sans block mb-1">
            {headerBadge}
          </span>
          <h1 className="font-serif text-2xl sm:text-3xl text-[#1C1917] font-normal leading-snug">
            {headerTitle}
          </h1>
          <p className="mt-2 text-xs sm:text-sm text-[#6B635D] font-sans">
            {headerSubtitle}
          </p>

          {isFailed && (
            <div className="mt-6">
              <Link
                to="/checkout"
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#1C1917] text-[#FAF8F5] text-xs uppercase tracking-widest font-semibold hover:bg-[#B89758] transition-colors shadow-xs"
              >
                <span>Return to Checkout</span>
                <ArrowRight size={14} />
              </Link>
            </div>
          )}
        </div>
      </div>

      <main className="max-w-[1000px] mx-auto px-4 sm:px-8 pt-8 space-y-8">
        {/* Order Meta Bar */}
        <div className="bg-white border border-[#E6DFD5] p-5 sm:p-6 grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs font-sans">
          <div>
            <span className="text-[#6B635D] block uppercase tracking-wider text-[10px]">Order Number</span>
            <span className="font-mono font-semibold text-[#1C1917] text-sm mt-0.5 block">
              {order.orderNumber}
            </span>
          </div>

          <div>
            <span className="text-[#6B635D] block uppercase tracking-wider text-[10px]">Date Placed</span>
            <span className="text-[#1C1917] font-medium mt-0.5 block">{orderDate}</span>
          </div>

          <div>
            <span className="text-[#6B635D] block uppercase tracking-wider text-[10px]">Order Status</span>
            <span className="inline-flex items-center gap-1.5 font-semibold capitalize mt-0.5 text-[#1C1917]">
              {isGreenStatusDot ? (
                <span className="w-2 h-2 rounded-full bg-[#2F593E]"></span>
              ) : isFailed ? (
                <span className="w-2 h-2 rounded-full bg-[#8C2F2F]"></span>
              ) : (
                <span className="w-2 h-2 rounded-full bg-[#B89758]"></span>
              )}
              <span>{order.orderStatus.replace('_', ' ')}</span>
            </span>
          </div>

          <div>
            <span className="text-[#6B635D] block uppercase tracking-wider text-[10px]">Payment Status</span>
            <span className="inline-flex items-center gap-1 font-semibold mt-0.5 text-[#1C1917]">
              {order.paymentStatus === 'paid' ? (
                <CheckCircle2 size={12} className="text-[#2F593E]" />
              ) : isFailed ? (
                <AlertCircle size={12} className="text-[#8C2F2F]" />
              ) : (
                <Clock size={12} className="text-[#B89758]" />
              )}
              <span className="capitalize">{paymentStatusText}</span>
            </span>
          </div>
        </div>

        {/* Two Columns: Ordered Items (7 cols) and Delivery Address & Summary (5 cols) */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          {/* Purchased Items Snapshot */}
          <div className="md:col-span-7 bg-white border border-[#E6DFD5] p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#F0EAE1] pb-3">
              <h2 className="font-serif text-xl text-[#1C1917] font-medium flex items-center gap-2">
                <Package size={18} className="text-[#B89758]" />
                <span>Pieces Ordered ({order.lines.length})</span>
              </h2>
            </div>

            <div className="divide-y divide-[#F0EAE1]">
              {order.lines.map((line, idx) => (
                <div key={idx} className="py-3 flex gap-3 items-center">
                  <div className="w-16 h-20 bg-[#F3EEE7] border border-[#E6DFD5] shrink-0 overflow-hidden">
                    <img
                      src={line.image}
                      alt={line.name}
                      className="w-full h-full object-cover object-center"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-serif text-base text-[#1C1917] font-medium line-clamp-1">
                      {line.name}
                    </p>
                    <p className="text-xs text-[#6B635D] font-sans mt-0.5">
                      Qty: {line.quantity} × {formatInr(line.unitPrice)}
                    </p>
                  </div>
                  <div className="text-right text-sm font-semibold text-[#1C1917]">
                    {formatInr(line.unitPrice * line.quantity)}
                  </div>
                </div>
              ))}
            </div>

            {/* Subtotal & Total breakdown */}
            <div className="pt-4 border-t border-[#F0EAE1] space-y-2 text-xs font-sans">
              <div className="flex justify-between text-[#57534E]">
                <span>Items Subtotal</span>
                <span>{formatInr(order.subtotal)}</span>
              </div>
              <div className="flex justify-between text-[#57534E]">
                <span>Standard Delivery (India)</span>
                <span>{order.shippingFee === 0 ? 'Complimentary' : formatInr(order.shippingFee)}</span>
              </div>
              <div className="flex justify-between text-[#1C1917] font-semibold text-base pt-2 border-t border-[#F0EAE1]">
                <span className="font-serif">Total Amount</span>
                <span className="font-serif text-xl">{formatInr(order.total)}</span>
              </div>
            </div>
          </div>

          {/* Customer & Shipping Destination Snapshot */}
          <div className="md:col-span-5 space-y-6">
            <div className="bg-white border border-[#E6DFD5] p-6 space-y-4">
              <h2 className="font-serif text-lg text-[#1C1917] font-medium flex items-center gap-2 border-b border-[#F0EAE1] pb-3">
                <MapPin size={18} className="text-[#B89758]" />
                <span>Shipping Address</span>
              </h2>

              <div className="text-xs font-sans text-[#57534E] space-y-1 leading-relaxed">
                <p className="font-semibold text-[#1C1917]">{order.shippingAddress.fullName}</p>
                <p>{order.shippingAddress.line1}</p>
                {order.shippingAddress.line2 && <p>{order.shippingAddress.line2}</p>}
                <p>
                  {order.shippingAddress.city}, {order.shippingAddress.state} -{' '}
                  <span className="font-mono">{order.shippingAddress.pincode}</span>
                </p>
                <p className="pt-2 text-[#1C1917]">
                  <strong>Phone:</strong> +91 {order.shippingAddress.phone}
                </p>
                <p className="text-[#1C1917]">
                  <strong>Email:</strong> {order.customer.email}
                </p>
              </div>
            </div>

            <div className="bg-white border border-[#E6DFD5] p-6 space-y-3">
              <h2 className="font-serif text-lg text-[#1C1917] font-medium flex items-center gap-2 border-b border-[#F0EAE1] pb-3">
                <CreditCard size={18} className="text-[#B89758]" />
                <span>Payment Notice</span>
              </h2>

              <p className="text-xs text-[#57534E] leading-relaxed font-sans">
                {paymentNoticeText}
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-[#E6DFD5]">
          <button
            onClick={() => window.print()}
            className="w-full sm:w-auto px-5 py-2.5 border border-[#8C847C] text-xs uppercase tracking-widest text-[#1C1917] hover:bg-[#F3EEE7] transition-colors inline-flex items-center justify-center gap-2"
          >
            <Printer size={14} />
            <span>Print Receipt</span>
          </button>

          <Link
            to="/shop"
            className="w-full sm:w-auto px-8 py-3 bg-[#1C1917] text-[#FAF8F5] text-xs uppercase tracking-[0.2em] font-semibold hover:bg-[#B89758] transition-colors inline-flex items-center justify-center gap-2"
          >
            <span>Explore More Pieces</span>
            <ArrowRight size={14} />
          </Link>
        </div>
      </main>
    </div>
  );
};
