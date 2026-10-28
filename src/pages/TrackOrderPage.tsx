/**
 * TrackOrderPage component for SARINE.
 * Public customer order tracking using Order Number and 10-digit mobile number.
 * Communicates with /.netlify/functions/track-order.
 * Honest status labels, no fake data, no black hovers, strictly privacy-safe.
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatInr } from '../utils/currency';
import { getApiEndpoint } from '../config/api';
import {
  Package,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  Truck,
  ExternalLink,
  ArrowRight,
  ShieldCheck,
  CreditCard
} from 'lucide-react';

interface TrackedOrderLine {
  name: string;
  image?: string;
  quantity: number;
  unitPrice: number;
}

interface TrackedOrder {
  orderNumber: string;
  publicToken: string;
  createdAt: string;
  lines: TrackedOrderLine[];
  subtotal: number;
  shippingFee: number;
  total: number;
  paymentMethod: string;
  paymentStatus: string;
  orderStatus: string;
  razorpayPaymentId?: string;
  shippingAddress: {
    city?: string;
    state?: string;
    pincode?: string;
  };
  courierName?: string;
  trackingUrl?: string;
  trackingNumber?: string;
  shippedAt?: string;
  deliveredAt?: string;
}

export const TrackOrderPage: React.FC = () => {
  const [orderNumberInput, setOrderNumberInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<TrackedOrder | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNumber = orderNumberInput.trim().toUpperCase();
    const cleanPhone = phoneInput.replace(/\D/g, '').slice(-10);

    if (!cleanNumber) {
      setError('Please enter your order reference number (e.g. SAR-000111).');
      return;
    }

    if (!/^SAR-\d{6}$/.test(cleanNumber)) {
      setError("We couldn't find an order with those details.");
      return;
    }

    if (cleanPhone.length !== 10) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }

    setLoading(true);
    setError(null);
    setOrder(null);

    try {
      const res = await fetch(getApiEndpoint('track-order'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          orderNumber: cleanNumber,
          phone: cleanPhone
        })
      });

      const contentType = res.headers.get('content-type') || '';
      let data: any = {};
      if (contentType.includes('application/json')) {
        data = await res.json();
      }

      if (!res.ok) {
        if (res.status === 429) {
          setError(data.error || 'Too many attempts. Please try again later.');
        } else {
          setError(data.error || "We couldn't find an order with those details.");
        }
        return;
      }

      setOrder(data);
    } catch (err) {
      console.error('[TrackOrder] Network or function error:', err);
      setError("We couldn't find an order with those details.");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return isoString;
    }
  };

  // Payment status honest messaging
  const renderPaymentStatus = () => {
    if (!order) return null;
    const isCod = order.paymentMethod?.toLowerCase() === 'cod';

    if (isCod) {
      return (
        <div className="flex items-center gap-2 text-xs text-[#6F6475]">
          <span className="w-2 h-2 rounded-full bg-[#563568]"></span>
          <span>Cash on delivery</span>
        </div>
      );
    }

    if (order.paymentStatus === 'paid') {
      return (
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-[#15803D]">
            <CheckCircle2 size={14} className="text-[#15803D]" />
            <span className="font-medium">Paid online via Razorpay</span>
          </div>
          {order.razorpayPaymentId && (
            <p className="text-[11px] text-[#6F6475] font-mono">
              Ref: {order.razorpayPaymentId}
            </p>
          )}
        </div>
      );
    }

    if (order.paymentStatus === 'failed') {
      return (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs text-[#DC2626]">
            <AlertCircle size={14} className="text-[#DC2626]" />
            <span className="font-medium">Payment failed</span>
          </div>
          <Link
            to="/checkout"
            className="text-xs text-[#563568] hover:text-[#A184BD] underline underline-offset-2 transition-colors font-medium inline-block"
          >
            Retry checkout →
          </Link>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2 text-xs text-[#563568]">
        <Clock size={14} className="text-[#563568]" />
        <span>Awaiting payment confirmation</span>
      </div>
    );
  };

  // Order status honest steps
  const renderOrderProgress = () => {
    if (!order) return null;

    if (order.orderStatus === 'needs_refund') {
      return (
        <div className="p-4 bg-[#FAF5FC] border border-[#E7DCEB] rounded-xs text-xs text-[#563568] leading-relaxed">
          <div className="flex items-start gap-2">
            <AlertCircle size={16} className="text-[#563568] shrink-0 mt-0.5" />
            <p>Payment received, but an item went out of stock. A full refund will be processed.</p>
          </div>
        </div>
      );
    }

    const hasShipped = Boolean(order.shippedAt || order.orderStatus === 'shipped' || order.orderStatus === 'delivered');
    const hasDelivered = Boolean(order.deliveredAt || order.orderStatus === 'delivered');

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          {/* Step 1: Placed / Confirmed */}
          <div className="flex flex-col items-center">
            <div className="w-8 h-8 rounded-full bg-[#563568] text-white flex items-center justify-center font-medium text-xs">
              <CheckCircle2 size={16} />
            </div>
            <span className="mt-2 font-medium text-[#302438]">Placed & Confirmed</span>
            <span className="text-[10px] text-[#6F6475]">{formatDate(order.createdAt)}</span>
          </div>

          {/* Step 2: Shipped */}
          <div className="flex flex-col items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center font-medium text-xs transition-colors ${
                hasShipped ? 'bg-[#563568] text-white' : 'bg-[#E7DCEB] text-[#6F6475]'
              }`}
            >
              <Truck size={16} />
            </div>
            <span className={`mt-2 font-medium ${hasShipped ? 'text-[#302438]' : 'text-[#6F6475]'}`}>
              Shipped
            </span>
            {order.shippedAt && (
              <span className="text-[10px] text-[#6F6475]">{formatDate(order.shippedAt)}</span>
            )}
          </div>

          {/* Step 3: Delivered */}
          <div className="flex flex-col items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center font-medium text-xs transition-colors ${
                hasDelivered ? 'bg-[#563568] text-white' : 'bg-[#E7DCEB] text-[#6F6475]'
              }`}
            >
              <Package size={16} />
            </div>
            <span className={`mt-2 font-medium ${hasDelivered ? 'text-[#302438]' : 'text-[#6F6475]'}`}>
              Delivered
            </span>
            {order.deliveredAt && (
              <span className="text-[10px] text-[#6F6475]">{formatDate(order.deliveredAt)}</span>
            )}
          </div>
        </div>

        {/* Dispatch notice if not yet shipped */}
        {!hasShipped && (
          <p className="text-center text-xs text-[#6F6475] font-sans pt-1">
            We&apos;ll update this once your order is dispatched.
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#F7F0FA] text-[#302438] font-sans py-12 sm:py-16 lg:py-20">
      <div className="site-container">
        <div className="max-w-xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8 sm:mb-10">
            <span className="text-[10px] uppercase tracking-[0.25em] text-[#6F6475] font-medium block mb-2">
              DISPATCH & DELIVERY
            </span>
            <h1 className="font-serif text-3xl sm:text-4xl text-[#302438] font-normal tracking-tight">
              Track Your Order
            </h1>
            <p className="mt-2 text-xs sm:text-sm text-[#6F6475] leading-relaxed max-w-md mx-auto">
              Check the live status of your jewellery shipment across India. No account required.
            </p>
          </div>

          {/* Lookup Form */}
          <div className="bg-white p-6 sm:p-8 border border-[#E7DCEB] rounded-xs shadow-2xs mb-8">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="orderNumber"
                  className="block text-xs uppercase tracking-wider text-[#302438] font-medium mb-1.5"
                >
                  Order Number
                </label>
                <input
                  id="orderNumber"
                  type="text"
                  value={orderNumberInput}
                  onChange={(e) => setOrderNumberInput(e.target.value)}
                  placeholder="SAR-000111"
                  required
                  className="w-full px-4 py-2.5 bg-[#F7F0FA] border border-[#E7DCEB] text-xs sm:text-sm text-[#302438] placeholder-[#9E90A2] rounded-xs focus:outline-none focus:border-[#B69ACF] focus:ring-1 focus:ring-[#80609A] transition-colors font-mono uppercase"
                />
              </div>

              <div>
                <label
                  htmlFor="phone"
                  className="block text-xs uppercase tracking-wider text-[#302438] font-medium mb-1.5"
                >
                  Mobile Number
                </label>
                <div className="flex items-center">
                  <span className="px-3 py-2.5 bg-[#F0E6F4] border border-r-0 border-[#E7DCEB] text-xs text-[#6F6475] rounded-l-xs font-sans">
                    +91
                  </span>
                  <input
                    id="phone"
                    type="tel"
                    value={phoneInput}
                    onChange={(e) => setPhoneInput(e.target.value)}
                    placeholder="9876543210"
                    maxLength={14}
                    required
                    className="w-full px-4 py-2.5 bg-[#F7F0FA] border border-[#E7DCEB] text-xs sm:text-sm text-[#302438] placeholder-[#9E90A2] rounded-r-xs focus:outline-none focus:border-[#B69ACF] focus:ring-1 focus:ring-[#80609A] transition-colors font-sans"
                  />
                </div>
              </div>

              {error && (
                <div className="p-3 bg-[#FAF5FC] border border-[#E7DCEB] rounded-xs flex items-start gap-2 text-xs text-[#DC2626] animate-fadeIn">
                  <AlertCircle size={15} className="shrink-0 mt-0.5" />
                  <p>{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-[#563568] text-white text-xs sm:text-[13px] font-medium uppercase tracking-wider hover:bg-[#A184BD] transition-colors rounded-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {loading ? (
                  <span>Checking status...</span>
                ) : (
                  <>
                    <Search size={14} />
                    <span>Track Order</span>
                  </>
                )}
              </button>
            </form>

            {/* Trust-strip-style note under the form */}
            <div className="mt-5 pt-4 border-t border-[#E7DCEB] flex items-center justify-center gap-2 text-[11px] sm:text-xs text-[#6F6475] font-sans">
              <ShieldCheck size={14} className="text-[#563568] shrink-0" />
              <span>Use the mobile number you entered at checkout.</span>
            </div>
          </div>

          {/* Result Order Summary Card */}
          {order && (
            <div className="bg-white border border-[#E7DCEB] rounded-xs shadow-xs p-6 sm:p-8 space-y-6 animate-fadeIn">
              {/* Header Row */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-5 border-b border-[#E7DCEB]">
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-[#6F6475] font-medium block">
                    Order Reference
                  </span>
                  <h3 className="font-serif text-xl sm:text-2xl text-[#302438] font-normal mt-0.5">
                    {order.orderNumber}
                  </h3>
                  <span className="text-xs text-[#6F6475] block mt-0.5">
                    Placed on {formatDate(order.createdAt)}
                  </span>
                </div>

                <div className="text-right">
                  <span className="text-[10px] uppercase tracking-wider text-[#6F6475] font-medium block">
                    Destination
                  </span>
                  <span className="text-xs text-[#302438] font-medium block mt-0.5">
                    {order.shippingAddress?.city && order.shippingAddress?.state
                      ? `${order.shippingAddress.city}, ${order.shippingAddress.state}`
                      : order.shippingAddress?.city || 'India'}
                  </span>
                  {order.shippingAddress?.pincode && (
                    <span className="text-xs text-[#6F6475] font-mono block">
                      PIN: {order.shippingAddress.pincode}
                    </span>
                  )}
                </div>
              </div>

              {/* Progress Timeline */}
              <div className="py-2">{renderOrderProgress()}</div>

              {/* Courier details if present */}
              {(order.courierName || order.trackingNumber || order.trackingUrl) && (
                <div className="p-4 bg-[#FAF5FC] border border-[#E7DCEB] rounded-xs space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[#6F6475]">Courier Partner:</span>
                    <span className="font-medium text-[#302438]">{order.courierName || 'Domestic Courier'}</span>
                  </div>
                  {order.trackingNumber && (
                    <div className="flex items-center justify-between font-mono">
                      <span className="text-[#6F6475] font-sans">Airway Bill (AWB):</span>
                      <span className="font-medium text-[#302438]">{order.trackingNumber}</span>
                    </div>
                  )}
                  {order.trackingUrl && (
                    <div className="pt-2 border-t border-[#E7DCEB]">
                      <a
                        href={order.trackingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#563568] hover:text-[#A184BD] font-medium inline-flex items-center gap-1.5 transition-colors"
                      >
                        <span>Open courier tracking</span>
                        <ExternalLink size={12} />
                      </a>
                    </div>
                  )}
                </div>
              )}

              {/* Payment Details */}
              <div className="p-4 bg-[#FAF5FC] border border-[#E7DCEB] rounded-xs flex items-center justify-between gap-4">
                <div className="flex items-center gap-2.5">
                  <CreditCard size={18} className="text-[#6F6475]" />
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-[#6F6475] font-medium block">
                      Payment
                    </span>
                    {renderPaymentStatus()}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase tracking-wider text-[#6F6475] font-medium block">
                    Total
                  </span>
                  <span className="font-serif text-base text-[#302438] font-normal">
                    {formatInr(order.total)}
                  </span>
                </div>
              </div>

              {/* Itemized Lines */}
              <div className="space-y-3">
                <h4 className="text-xs uppercase tracking-wider text-[#302438] font-medium">
                  Ordered Items ({order.lines.length})
                </h4>
                <div className="divide-y divide-[#E7DCEB]">
                  {order.lines.map((line, idx) => (
                    <div key={idx} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-3">
                        {line.image ? (
                          <img
                            src={line.image}
                            alt={line.name}
                            className="w-11 h-11 object-cover rounded-xs border border-[#E7DCEB] bg-[#F7F0FA]"
                          />
                        ) : (
                          <div className="w-11 h-11 rounded-xs border border-[#E7DCEB] bg-[#F7F0FA] flex items-center justify-center text-[#6F6475]">
                            <Package size={16} />
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-[#302438] line-clamp-1">{line.name}</p>
                          <p className="text-[11px] text-[#6F6475]">Qty: {line.quantity}</p>
                        </div>
                      </div>
                      <span className="font-sans text-[#302438] tabular-nums shrink-0">
                        {formatInr(line.unitPrice * line.quantity)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals Breakdown */}
              <div className="pt-3 border-t border-[#E7DCEB] space-y-1.5 text-xs text-[#6F6475]">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="tabular-nums text-[#302438]">{formatInr(order.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Shipping across India</span>
                  <span className="tabular-nums text-[#302438]">
                    {order.shippingFee === 0 ? 'Complimentary (Free)' : formatInr(order.shippingFee)}
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t border-[#E7DCEB] font-medium text-sm text-[#302438]">
                  <span>Total Amount</span>
                  <span className="tabular-nums font-serif text-base">{formatInr(order.total)}</span>
                </div>
              </div>

              {/* View Full Order Details button */}
              {order.publicToken && (
                <div className="pt-2">
                  <Link
                    to={`/order/${order.orderNumber}?t=${order.publicToken}`}
                    className="w-full py-3 bg-transparent border border-[#563568] text-[#563568] text-xs font-sans font-medium hover:bg-[#F0E6F4] hover:border-[#563568] transition-colors rounded-xs flex items-center justify-center gap-2"
                  >
                    <span>View full order details</span>
                    <ArrowRight size={13} />
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
