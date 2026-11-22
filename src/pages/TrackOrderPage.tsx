/**
 * TrackOrderPage component for SARINE.
 * Public customer order tracking using Order Number and 10-digit mobile number.
 * Communicates with the Hostinger MariaDB order-tracking API.
 * Honest status labels, no fake data, no black hovers, strictly privacy-safe.
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatInr } from '../utils/currency';
import { hostingerOrderService } from '../services';
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
  sku?: string;
  variantLabel?: string;
  variantOptions?: Record<string, string>;
}

interface TrackedOrder {
  orderNumber: string;
  publicToken: string;
  createdAt: string;
  lines: TrackedOrderLine[];
  subtotal: number;
  discountAmount?: number;
  promotion?: { id: string; name: string; discountPercent: number; discountAmount: number } | null;
  couponCode?: string;
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
  statusHistory?: Array<{ status: string; createdAt: string }>;
}

export const TrackOrderPage: React.FC = () => {
  const [orderNumberInput, setOrderNumberInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<TrackedOrder | null>(null);
  const [returnFormOpen, setReturnFormOpen] = useState(false);
  const [returnType, setReturnType] = useState<'return' | 'exchange'>('return');
  const [returnReason, setReturnReason] = useState('Item arrived damaged or scratched');
  const [returnNotes, setReturnNotes] = useState('');
  const [returnLoading, setReturnLoading] = useState(false);
  const [returnError, setReturnError] = useState<string | null>(null);
  const [returnSuccess, setReturnSuccess] = useState<string | null>(null);

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
      const data = await hostingerOrderService.trackOrder(cleanNumber, cleanPhone);
      setOrder(data);
    } catch (err: any) {
      console.error('[TrackOrder] Network or function error:', err);
      if (err?.status === 429) {
        setError(err.message || 'Too many attempts. Please try again later.');
      } else {
        setError(err?.message || "We couldn't find an order with those details.");
      }
    } finally {
      setLoading(false);
    }
  };


  const handleReturnRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;
    setReturnLoading(true);
    setReturnError(null);
    setReturnSuccess(null);
    try {
      const result = await hostingerOrderService.requestReturn(
        order.orderNumber, phoneInput, returnType, returnReason, returnNotes
      );
      setReturnSuccess(`Your ${returnType} request has been submitted. Reference #${result.requestId}. Our team will review it.`);
      setReturnFormOpen(false);
      setReturnNotes('');
    } catch (err: any) {
      setReturnError(err?.message || 'Could not submit your request. Please try again.');
    } finally {
      setReturnLoading(false);
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
        <div className="flex items-center gap-2 text-xs text-[var(--body)]">
          <span className="w-2 h-2 rounded-full bg-[var(--plum)]"></span>
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
            <p className="text-[11px] text-[var(--body)] font-mono">
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
            className="text-xs text-[var(--plum)] hover:text-[var(--white)] underline underline-offset-2 transition-colors font-medium inline-block"
          >
            Retry checkout →
          </Link>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2 text-xs text-[var(--plum)]">
        <Clock size={14} className="text-[var(--plum)]" />
        <span>Awaiting payment confirmation</span>
      </div>
    );
  };

  // Five-stage fulfilment timeline. Dates come from the server's order_status_history.
  const renderOrderProgress = () => {
    if (!order) return null;

    if (order.orderStatus === 'needs_refund') {
      return (
        <div className="p-4 bg-[var(--tint)] border border-[var(--border)] rounded-xs text-xs text-[var(--plum)] leading-relaxed">
          <div className="flex items-start gap-2">
            <AlertCircle size={16} className="text-[var(--plum)] shrink-0 mt-0.5" />
            <p>Payment received, but an item went out of stock. A full refund will be processed.</p>
          </div>
        </div>
      );
    }

    const stages = [
      { key: 'confirmed', label: 'Confirmed', icon: CheckCircle2 },
      { key: 'packed', label: 'Packed', icon: Package },
      { key: 'shipped', label: 'Shipped', icon: Truck },
      { key: 'out_for_delivery', label: 'Out for delivery', icon: Truck },
      { key: 'delivered', label: 'Delivered', icon: CheckCircle2 }
    ];
    const stageIndex: Record<string, number> = {
      placed: 0, confirmed: 0, processing: 0, packed: 1, shipped: 2, out_for_delivery: 3, delivered: 4,
      awaiting_payment: -1, pending: -1, failed: -1, cancelled: -1
    };
    const currentIndex = stageIndex[order.orderStatus] ?? -1;
    const history = order.statusHistory || [];
    const latestFor = (key: string) => {
      const entry = [...history].reverse().find(item => item.status === key);
      return entry?.createdAt;
    };
    const hasShipped = ['shipped', 'out_for_delivery', 'delivered'].includes(order.orderStatus);

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-5 gap-1.5 text-center">
          {stages.map((stage, index) => {
            const done = currentIndex >= index;
            const Icon = stage.icon;
            const timestamp = latestFor(stage.key) || (stage.key === 'confirmed' ? order.createdAt : stage.key === 'shipped' ? order.shippedAt : stage.key === 'delivered' ? order.deliveredAt : undefined);
            return (
              <div key={stage.key} className="min-w-0 flex flex-col items-center">
                <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center ${done ? 'bg-[var(--plum)] text-white' : 'bg-[var(--border)] text-[var(--body)]'}`}>
                  <Icon size={15} />
                </div>
                <span className={`mt-2 text-[9px] sm:text-[10px] leading-tight font-medium ${done ? 'text-[var(--heading)]' : 'text-[var(--body)]'}`}>{stage.label}</span>
                {timestamp && done && <span className="mt-1 text-[8px] sm:text-[9px] text-[var(--body)] leading-tight">{formatDate(timestamp)}</span>}
              </div>
            );
          })}
        </div>
        {!hasShipped && (
          <p className="text-center text-xs text-[var(--body)] font-sans pt-1">
            We&apos;ll update each stage as your order is prepared and dispatched.
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-white text-[var(--heading)] font-sans py-12 sm:py-16 lg:py-20">
      <div className="site-container">
        <div className="max-w-xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8 sm:mb-10">
            <span className="text-[10px] uppercase tracking-[0.25em] text-[var(--body)] font-medium block mb-2">
              DISPATCH & DELIVERY
            </span>
            <h1 className="font-serif text-3xl sm:text-4xl text-[var(--heading)] font-normal tracking-tight">
              Track Your Order
            </h1>
            <p className="mt-2 text-xs sm:text-sm text-[var(--body)] leading-relaxed max-w-md mx-auto">
              Check the live status of your jewellery shipment across India. No account required.
            </p>
          </div>

          {/* Lookup Form */}
          <div className="bg-white p-6 sm:p-8 border border-[var(--border)] rounded-xs shadow-2xs mb-8">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="orderNumber"
                  className="block text-xs uppercase tracking-wider text-[var(--heading)] font-medium mb-1.5"
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
                  className="w-full px-4 py-2.5 bg-white border border-[var(--border)] text-xs sm:text-sm text-[var(--heading)] placeholder-[var(--muted)] rounded-xs focus:outline-none focus:border-[var(--gold)] focus:ring-1 focus:ring-[var(--gold)] transition-colors font-mono uppercase"
                />
              </div>

              <div>
                <label
                  htmlFor="phone"
                  className="block text-xs uppercase tracking-wider text-[var(--heading)] font-medium mb-1.5"
                >
                  Mobile Number
                </label>
                <div className="flex items-center">
                  <span className="px-3 py-2.5 bg-[var(--tint)] border border-r-0 border-[var(--border)] text-xs text-[var(--body)] rounded-l-xs font-sans">
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
                    className="w-full px-4 py-2.5 bg-white border border-[var(--border)] text-xs sm:text-sm text-[var(--heading)] placeholder-[var(--muted)] rounded-r-xs focus:outline-none focus:border-[var(--gold)] focus:ring-1 focus:ring-[var(--gold)] transition-colors font-sans"
                  />
                </div>
              </div>

              {error && (
                <div className="p-3 bg-[var(--tint)] border border-[var(--border)] rounded-xs flex items-start gap-2 text-xs text-[#DC2626] animate-fadeIn">
                  <AlertCircle size={15} className="shrink-0 mt-0.5" />
                  <p>{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-[var(--plum)] text-white text-xs sm:text-[13px] font-medium uppercase tracking-wider hover:bg-[var(--gold)] transition-colors rounded-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
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
            <div className="mt-5 pt-4 border-t border-[var(--border)] flex items-center justify-center gap-2 text-[11px] sm:text-xs text-[var(--body)] font-sans">
              <ShieldCheck size={14} className="text-[var(--plum)] shrink-0" />
              <span>Use the mobile number you entered at checkout.</span>
            </div>
          </div>

          {/* Result Order Summary Card */}
          {order && (
            <div className="bg-white border border-[var(--border)] rounded-xs shadow-xs p-6 sm:p-8 space-y-6 animate-fadeIn">
              {/* Header Row */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-5 border-b border-[var(--border)]">
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-[var(--body)] font-medium block">
                    Order Reference
                  </span>
                  <h3 className="font-serif text-xl sm:text-2xl text-[var(--heading)] font-normal mt-0.5">
                    {order.orderNumber}
                  </h3>
                  <span className="text-xs text-[var(--body)] block mt-0.5">
                    Placed on {formatDate(order.createdAt)}
                  </span>
                </div>

                <div className="text-right">
                  <span className="text-[10px] uppercase tracking-wider text-[var(--body)] font-medium block">
                    Destination
                  </span>
                  <span className="text-xs text-[var(--heading)] font-medium block mt-0.5">
                    {order.shippingAddress?.city && order.shippingAddress?.state
                      ? `${order.shippingAddress.city}, ${order.shippingAddress.state}`
                      : order.shippingAddress?.city || 'India'}
                  </span>
                  {order.shippingAddress?.pincode && (
                    <span className="text-xs text-[var(--body)] font-mono block">
                      PIN: {order.shippingAddress.pincode}
                    </span>
                  )}
                </div>
              </div>

              {/* Progress Timeline */}
              <div className="py-2">{renderOrderProgress()}</div>

              {/* Courier details if present */}
              {(order.courierName || order.trackingNumber || order.trackingUrl) && (
                <div className="p-4 bg-[var(--tint)] border border-[var(--border)] rounded-xs space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--body)]">Courier Partner:</span>
                    <span className="font-medium text-[var(--heading)]">{order.courierName || 'Domestic Courier'}</span>
                  </div>
                  {order.trackingNumber && (
                    <div className="flex items-center justify-between font-mono">
                      <span className="text-[var(--body)] font-sans">Airway Bill (AWB):</span>
                      <span className="font-medium text-[var(--heading)]">{order.trackingNumber}</span>
                    </div>
                  )}
                  {order.trackingUrl && (
                    <div className="pt-2 border-t border-[var(--border)]">
                      <a
                        href={order.trackingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[var(--plum)] hover:text-[var(--white)] font-medium inline-flex items-center gap-1.5 transition-colors"
                      >
                        <span>Open courier tracking</span>
                        <ExternalLink size={12} />
                      </a>
                    </div>
                  )}
                </div>
              )}

              {/* Payment Details */}
              <div className="p-4 bg-[var(--tint)] border border-[var(--border)] rounded-xs flex items-center justify-between gap-4">
                <div className="flex items-center gap-2.5">
                  <CreditCard size={18} className="text-[var(--body)]" />
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-[var(--body)] font-medium block">
                      Payment
                    </span>
                    {renderPaymentStatus()}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase tracking-wider text-[var(--body)] font-medium block">
                    Total
                  </span>
                  <span className="font-serif text-base text-[var(--heading)] font-normal">
                    {formatInr(order.total)}
                  </span>
                </div>
              </div>

              {/* Itemized Lines */}
              <div className="space-y-3">
                <h4 className="text-xs uppercase tracking-wider text-[var(--heading)] font-medium">
                  Ordered Items ({order.lines.length})
                </h4>
                <div className="divide-y divide-[var(--border)]">
                  {order.lines.map((line, idx) => (
                    <div key={idx} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-3">
                        {line.image ? (
                          <img
                            src={line.image}
                            alt={line.name}
                            className="w-11 h-11 object-cover rounded-xs border border-[var(--border)] bg-[var(--tint)]"
                          />
                        ) : (
                          <div className="w-11 h-11 rounded-xs border border-[var(--border)] bg-[var(--tint)] flex items-center justify-center text-[var(--body)]">
                            <Package size={16} />
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-[var(--heading)] line-clamp-1">{line.name}</p>
                          {line.variantLabel && <p className="text-[11px] text-[var(--plum)]">{line.variantLabel}{line.sku ? ` · ${line.sku}` : ''}</p>}
                          <p className="text-[11px] text-[var(--body)]">Qty: {line.quantity}</p>
                        </div>
                      </div>
                      <span className="font-sans text-[var(--heading)] tabular-nums shrink-0">
                        {formatInr(line.unitPrice * line.quantity)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals Breakdown */}
              <div className="pt-3 border-t border-[var(--border)] space-y-1.5 text-xs text-[var(--body)]">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="tabular-nums text-[var(--heading)]">{formatInr(order.subtotal)}</span>
                </div>
                {!!order.discountAmount && order.discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <span>{order.promotion?.name || (order.couponCode ? "Coupon (" + order.couponCode + ")" : "Promotion discount")}</span>
                    <span>-{formatInr(order.discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Shipping across India</span>
                  <span className="tabular-nums text-[var(--heading)]">
                    {order.shippingFee === 0 ? 'Complimentary (Free)' : formatInr(order.shippingFee)}
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t border-[var(--border)] font-medium text-sm text-[var(--heading)]">
                  <span>Total Amount</span>
                  <span className="tabular-nums font-serif text-base">{formatInr(order.total)}</span>
                </div>
              </div>


              {order.orderStatus === 'delivered' && order.deliveredAt && (
                <div className="pt-3 border-t border-[var(--border)] space-y-3">
                  {returnSuccess ? (
                    <div role="status" className="rounded-xs border border-[#D8E8D7] bg-[#F2FAF1] p-3 text-xs text-[#27633A]">{returnSuccess}</div>
                  ) : (
                    <>
                      {!returnFormOpen ? (
                        <button type="button" onClick={() => { setReturnFormOpen(true); setReturnError(null); }} className="w-full py-3 border border-[var(--plum)] text-[var(--plum)] text-xs font-medium rounded-xs hover:bg-[var(--tint)]">
                          Request a return or exchange
                        </button>
                      ) : (
                        <form onSubmit={handleReturnRequest} className="rounded-xs border border-[var(--border)] bg-[var(--tint)] p-4 space-y-3">
                          <div><h4 className="font-serif text-lg text-[var(--heading)]">Return or exchange request</h4><p className="text-[11px] text-[var(--body)] mt-1">Requests must be submitted within 7 days of delivery. Your checkout mobile number is used to verify this order.</p></div>
                          <label className="block text-xs text-[var(--heading)]">Request type
                            <select value={returnType} onChange={e => setReturnType(e.target.value as 'return' | 'exchange')} className="mt-1 w-full p-2.5 border border-[var(--border)] bg-white rounded-xs text-xs">
                              <option value="return">Return</option><option value="exchange">Exchange</option>
                            </select>
                          </label>
                          <label className="block text-xs text-[var(--heading)]">Reason
                            <select value={returnReason} onChange={e => setReturnReason(e.target.value)} className="mt-1 w-full p-2.5 border border-[var(--border)] bg-white rounded-xs text-xs">
                              <option>Item arrived damaged or scratched</option><option>Received a different item than ordered</option><option>Manufacturing defect</option><option>Size or fit adjustment required</option><option>Finish or polish not as expected</option><option>Other reason</option>
                            </select>
                          </label>
                          <label className="block text-xs text-[var(--heading)]">Additional details (optional)
                            <textarea value={returnNotes} onChange={e => setReturnNotes(e.target.value)} maxLength={2000} rows={3} placeholder="Describe the issue…" className="mt-1 w-full p-2.5 border border-[var(--border)] bg-white rounded-xs text-xs" />
                          </label>
                          {returnError && <p role="alert" className="text-xs text-red-700">{returnError}</p>}
                          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2">
                            <button type="button" onClick={() => setReturnFormOpen(false)} disabled={returnLoading} className="px-4 py-2 text-xs border border-[var(--border)] rounded-xs">Cancel</button>
                            <button type="submit" disabled={returnLoading} className="px-4 py-2 text-xs bg-[var(--plum)] text-white rounded-xs disabled:opacity-50">{returnLoading ? 'Submitting…' : 'Submit request'}</button>
                          </div>
                        </form>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* View Full Order Details button */}
              {order.publicToken && (
                <div className="pt-2">
                  <Link
                    to={`/order/${order.orderNumber}?t=${order.publicToken}`}
                    className="w-full py-3 bg-transparent border border-[var(--plum)] text-[var(--plum)] text-xs font-sans font-medium hover:bg-[var(--tint)] hover:border-[var(--plum)] transition-colors rounded-xs flex items-center justify-center gap-2"
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
