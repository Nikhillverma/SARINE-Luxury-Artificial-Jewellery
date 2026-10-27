/**
 * CheckoutPage component for SARINE.
 * Provides shipping address collection with Indian mobile and PIN code validation,
 * payment method selection, order summary panel, double-submit protection,
 * and orderService.createOrder integration.
 */

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { orderService } from '../services';
import { customerOrderService } from '../services/customerOrderService';
import { formatInr } from '../utils/currency';
import { COD_ENABLED, calculateShippingFee } from '../config/store';
import { PaymentMethod } from '../types/order';
import {
  Lock,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  CreditCard,
  Banknote
} from 'lucide-react';

const INDIAN_STATES_AND_UTS = [
  'Andaman and Nicobar Islands',
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chandigarh',
  'Chhattisgarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jammu and Kashmir',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Ladakh',
  'Lakshadweep',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Puducherry',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal'
];

interface FormErrors {
  fullName?: string;
  email?: string;
  phone?: string;
  line1?: string;
  city?: string;
  state?: string;
  pincode?: string;
}

// Helper to load Razorpay checkout script dynamically
function loadRazorpayCheckoutScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window !== 'undefined' && (window as any).Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export const CheckoutPage: React.FC = () => {
  const navigate = useNavigate();
  const { items, subtotal, clearCart, isHydrating } = useCart();

  // State and ref to track if an order is being placed or was placed successfully
  const [orderPlaced, setOrderPlaced] = useState(false);
  const orderPlacedRef = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVerifyingPayment, setIsVerifyingPayment] = useState(false);
  const [submitNotice, setSubmitNotice] = useState<string | null>(null);

  // Redirect to /bag if bag is empty after initial hydration.
  // Must NOT run while an order is being placed or after one succeeded.
  useEffect(() => {
    if (orderPlaced || orderPlacedRef.current || isSubmitting) {
      return;
    }
    if (!isHydrating && items.length === 0) {
      navigate('/bag', { replace: true });
    }
  }, [items.length, isHydrating, isSubmitting, orderPlaced, navigate]);

  // Form fields state
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [line1, setLine1] = useState('');
  const [line2, setLine2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pincode, setPincode] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('online');

  // UI state
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Computed shipping and total
  const shippingFee = calculateShippingFee(subtotal);
  const total = subtotal + shippingFee;

  // Validation function
  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!fullName.trim()) {
      newErrors.fullName = 'Please enter your full name.';
    }

    if (!email.trim()) {
      newErrors.email = 'Please enter your email address.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      newErrors.email = 'Please enter a valid email address.';
    }

    const cleanPhone = phone.replace(/\D/g, '');
    if (!cleanPhone) {
      newErrors.phone = 'Please enter your 10-digit mobile number.';
    } else if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      newErrors.phone = 'Please enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.';
    }

    if (!line1.trim()) {
      newErrors.line1 = 'Please enter your house/flat number and street address.';
    }

    if (!city.trim()) {
      newErrors.city = 'Please enter your city.';
    }

    if (!state.trim()) {
      newErrors.state = 'Please select your state or union territory.';
    }

    const cleanPincode = pincode.trim();
    if (!cleanPincode) {
      newErrors.pincode = 'Please enter your postal PIN code.';
    } else if (!/^[1-9][0-9]{5}$/.test(cleanPincode)) {
      newErrors.pincode = 'Please enter a valid 6-digit Indian PIN code (cannot start with 0).';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitNotice(null);

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const order = await orderService.createOrder({
        lines: items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity
        })),
        customer: {
          name: fullName.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.replace(/\D/g, '')
        },
        shippingAddress: {
          fullName: fullName.trim(),
          phone: phone.replace(/\D/g, ''),
          line1: line1.trim(),
          line2: line2.trim() || undefined,
          city: city.trim(),
          state: state.trim(),
          pincode: pincode.trim()
        },
        paymentMethod
      });

      console.log('[Checkout] Order created on server:', order.orderNumber, order);

      // Online payment via Razorpay Checkout
      if (paymentMethod === 'online') {
        // If paymentMethod is 'online' and razorpayOrderId or keyId is missing,
        // show "Could not start payment, please try again", keep the cart and form, and do NOT navigate. Only COD may skip Razorpay.
        if (!order.razorpayOrderId || !order.keyId) {
          setSubmitError('Could not start payment, please try again');
          setIsSubmitting(false);
          return;
        }

        const isLoaded = await loadRazorpayCheckoutScript();
        if (!isLoaded) {
          setSubmitError('Payment failed or cancelled, please try again.');
          setIsSubmitting(false);
          return;
        }

        const options = {
          key: order.keyId,
          amount: order.amount,
          currency: 'INR',
          name: 'SARINE',
          description: `Order ${order.orderNumber}`,
          order_id: order.razorpayOrderId,
          prefill: {
            name: fullName.trim(),
            email: email.trim(),
            contact: phone.replace(/\D/g, '')
          },
          theme: {
            color: '#1C1917'
          },
          handler: async (response: {
            razorpay_order_id: string;
            razorpay_payment_id: string;
            razorpay_signature: string;
          }) => {
            console.log('[Checkout] Razorpay returned payment authorization, verifying signature...');
            setIsVerifyingPayment(true);
            try {
              if (!orderService.verifyPayment) {
                throw new Error('Payment verification service is unavailable.');
              }

              const verifyResult = await orderService.verifyPayment({
                orderNumber: order.orderNumber,
                publicToken: order.publicToken || '',
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature
              });

              // If verifyPayment returns pending: true (or success: true), navigate to the order page and clear the cart
              if (verifyResult.success || verifyResult.pending) {
                console.log('[Checkout] Payment verification handled (success or pending):', order.orderNumber);
                setOrderPlaced(true);
                orderPlacedRef.current = true;

                // Save full order snapshot for Customer Account My Orders
                customerOrderService.saveNewOrder(
                  {
                    ...order,
                    lines: items.map((it) => ({
                      productId: it.productId,
                      name: it.product.name,
                      unitPrice: it.product.price,
                      quantity: it.quantity,
                      image: it.product.images[0] || '',
                      sku: `SAR-${it.productId.slice(0, 6).toUpperCase()}`
                    })),
                    customer: {
                      name: fullName.trim(),
                      email: email.trim().toLowerCase(),
                      phone: phone.replace(/\D/g, '')
                    },
                    shippingAddress: {
                      fullName: fullName.trim(),
                      phone: phone.replace(/\D/g, ''),
                      line1: line1.trim(),
                      line2: line2.trim() || undefined,
                      city: city.trim(),
                      state: state.trim(),
                      pincode: pincode.trim()
                    },
                    subtotal,
                    shippingFee,
                    total,
                    paymentMethod: 'online',
                    paymentStatus: 'paid',
                    orderStatus: 'confirmed',
                    createdAt: new Date().toISOString()
                  },
                  email.trim().toLowerCase()
                );

                const targetUrl = order.publicToken
                  ? `/order/${order.orderNumber}?t=${order.publicToken}`
                  : `/order/${order.orderNumber}`;
                console.log(`[Checkout] Navigating to: ${targetUrl}`);
                navigate(targetUrl, { replace: true });
                clearCart();
              } else {
                setSubmitError('Payment failed or cancelled, please try again.');
              }
            } catch (vErr: any) {
              console.error('[Checkout] Payment verification failure:', vErr);
              setSubmitError('Payment failed or cancelled, please try again.');
            } finally {
              setIsVerifyingPayment(false);
              setIsSubmitting(false);
            }
          },
          modal: {
            ondismiss: () => {
              console.log('[Checkout] Razorpay checkout dismissed by shopper');
              setIsSubmitting(false);
              setSubmitError('Payment failed or cancelled, please try again.');
            }
          }
        };

        const rzp = new (window as any).Razorpay(options);
        rzp.on('payment.failed', (resp: any) => {
          console.error('[Checkout] Payment failed:', resp.error);
          setIsSubmitting(false);
          setSubmitError('Payment failed or cancelled, please try again.');
        });
        rzp.open();
        return;
      }

      // Only COD may skip Razorpay
      if (paymentMethod === 'cod') {
        setOrderPlaced(true);
        orderPlacedRef.current = true;

        // Save full order snapshot for Customer Account My Orders
        customerOrderService.saveNewOrder(
          {
            ...order,
            lines: items.map((it) => ({
              productId: it.productId,
              name: it.product.name,
              unitPrice: it.product.price,
              quantity: it.quantity,
              image: it.product.images[0] || '',
              sku: `SAR-${it.productId.slice(0, 6).toUpperCase()}`
            })),
            customer: {
              name: fullName.trim(),
              email: email.trim().toLowerCase(),
              phone: phone.replace(/\D/g, '')
            },
            shippingAddress: {
              fullName: fullName.trim(),
              phone: phone.replace(/\D/g, ''),
              line1: line1.trim(),
              line2: line2.trim() || undefined,
              city: city.trim(),
              state: state.trim(),
              pincode: pincode.trim()
            },
            subtotal,
            shippingFee,
            total,
            paymentMethod: 'cod',
            paymentStatus: 'pending',
            orderStatus: 'placed',
            createdAt: new Date().toISOString()
          },
          email.trim().toLowerCase()
        );

        const targetUrl = order.publicToken
          ? `/order/${order.orderNumber}?t=${order.publicToken}`
          : `/order/${order.orderNumber}`;
        console.log(`[Checkout] Navigating to: ${targetUrl}`);
        navigate(targetUrl, { replace: true });
        clearCart();
        return;
      }
    } catch (err: any) {
      console.error('Failed to place order:', err);
      setSubmitError(
        err.message ||
          'We encountered an issue verifying your order. Please review your bag and try again.'
      );
      setIsSubmitting(false);
    }
  };

  if (orderPlaced || orderPlacedRef.current) {
    return (
      <div className="min-h-screen bg-[#F7F0FA] flex items-center justify-center p-8">
        <p className="text-xs uppercase tracking-widest text-[#6F6475]">Transferring to order confirmation...</p>
      </div>
    );
  }

  if (isHydrating || items.length === 0) {
    return (
      <div className="min-h-screen bg-[#F7F0FA] flex items-center justify-center p-8">
        <p className="text-xs uppercase tracking-widest text-[#6F6475]">Loading checkout...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F0FA] pb-20 text-[#302438]">
      {/* Editorial Header */}
      <div className="bg-[#F0E6F4]/50 border-b border-[#E7DCEB] py-8 text-center">
        <div className="site-container">
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="h-[1px] w-8 bg-[#D9B8A0]"></span>
            <span className="text-xs uppercase tracking-[0.25em] text-[#563568] font-medium font-sans">
              Secured Checkout
            </span>
            <span className="h-[1px] w-8 bg-[#D9B8A0]"></span>
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl text-[#302438] font-normal">
            Order & Delivery Details
          </h1>
        </div>
      </div>

      <main className="site-container pt-8">
        <div className="max-w-[1000px] mx-auto w-full">
        {/* Navigation Breadcrumb */}
        <div className="mb-6">
          <Link
            to="/bag"
            className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-[#6F6475] hover:text-[#563568] transition-colors"
          >
            <ArrowLeft size={14} />
            <span>Return to Shopping Bag</span>
          </Link>
        </div>

        {/* Dismissal Notice Banner */}
        {submitNotice && (
          <div className="mb-8 p-4 bg-[#F7F0FA] border border-[#B69ACF] text-xs text-[#6F6475] flex items-start gap-3 rounded-xs">
            <CheckCircle2 size={18} className="text-[#563568]" />
            <div className="flex-1">
              <strong className="block font-semibold text-[#302438] mb-0.5">Order In Progress</strong>
              <span>{submitNotice}</span>
            </div>
          </div>
        )}

        {/* Global Error Banner */}
        {submitError && (
          <div className="mb-8 p-4 bg-[#DC2626]/10 border border-[#DC2626] text-xs text-[#DC2626] flex items-start gap-3 rounded-xs">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <div className="flex-1">
              <strong className="block font-semibold mb-1">Order Submission Issue</strong>
              <span>{submitError}</span>
              <div className="mt-2">
                <Link to="/bag" className="underline font-semibold hover:text-[#302438]">
                  View bag to adjust piece quantities
                </Link>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          {/* Left Column: Checkout Form (7 cols) */}
          <div className="lg:col-span-7 bg-white border border-[#E7DCEB] p-6 sm:p-8 rounded-sm shadow-xs">
            <form onSubmit={handleSubmit} noValidate className="space-y-6">
              {/* Customer Contact Section */}
              <div>
                <h2 className="font-serif text-xl text-[#302438] font-medium border-b border-[#E7DCEB] pb-2 mb-4">
                  1. Contact Information
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-[#6F6475] font-medium mb-1">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Radhika Sharma"
                      disabled={isSubmitting}
                      className={`w-full px-3 py-2 text-sm bg-[#F7F0FA] border rounded-xs focus:bg-white focus:outline-none transition-colors ${
                        errors.fullName ? 'border-[#DC2626]' : 'border-[#E7DCEB] focus:border-[#B69ACF]'
                      }`}
                    />
                    {errors.fullName && (
                      <p className="text-[11px] text-[#DC2626] mt-1">{errors.fullName}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs uppercase tracking-wider text-[#6F6475] font-medium mb-1">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. radhika@example.com"
                      disabled={isSubmitting}
                      className={`w-full px-3 py-2 text-sm bg-[#F7F0FA] border rounded-xs focus:bg-white focus:outline-none transition-colors ${
                        errors.email ? 'border-[#DC2626]' : 'border-[#E7DCEB] focus:border-[#B69ACF]'
                      }`}
                    />
                    {errors.email && (
                      <p className="text-[11px] text-[#DC2626] mt-1">{errors.email}</p>
                    )}
                  </div>
                </div>

                <div className="mt-4">
                  <label className="block text-xs uppercase tracking-wider text-[#6F6475] font-medium mb-1">
                    Mobile Number (10 digits) *
                  </label>
                  <div className="flex">
                    <span className="inline-flex items-center px-3 text-xs bg-[#F0E6F4] border border-r-0 border-[#E7DCEB] text-[#6F6475] font-mono rounded-l-xs">
                      +91
                    </span>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="9876543210"
                      maxLength={10}
                      disabled={isSubmitting}
                      className={`w-full px-3 py-2 text-sm bg-[#F7F0FA] border rounded-r-xs focus:bg-white focus:outline-none transition-colors font-mono ${
                        errors.phone ? 'border-[#DC2626]' : 'border-[#E7DCEB] focus:border-[#B69ACF]'
                      }`}
                    />
                  </div>
                  {errors.phone ? (
                    <p className="text-[11px] text-[#DC2626] mt-1">{errors.phone}</p>
                  ) : (
                    <p className="text-[11px] text-[#6F6475] mt-1">
                      Used for delivery dispatch notifications and courier tracking updates.
                    </p>
                  )}
                </div>
              </div>

              {/* Delivery Address Section */}
              <div className="pt-4 border-t border-[#E7DCEB]">
                <h2 className="font-serif text-xl text-[#302438] font-medium border-b border-[#E7DCEB] pb-2 mb-4">
                  2. Shipping Address
                </h2>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-[#6F6475] font-medium mb-1">
                      Street Address / House / Flat No. *
                    </label>
                    <input
                      type="text"
                      value={line1}
                      onChange={(e) => setLine1(e.target.value)}
                      placeholder="e.g. 402, Lotus Apartments, 14th Main Road"
                      disabled={isSubmitting}
                      className={`w-full px-3 py-2 text-sm bg-[#F7F0FA] border rounded-xs focus:bg-white focus:outline-none transition-colors ${
                        errors.line1 ? 'border-[#DC2626]' : 'border-[#E7DCEB] focus:border-[#B69ACF]'
                      }`}
                    />
                    {errors.line1 && (
                      <p className="text-[11px] text-[#DC2626] mt-1">{errors.line1}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs uppercase tracking-wider text-[#6F6475] font-medium mb-1">
                      Apartment, Suite, Landmark (Optional)
                    </label>
                    <input
                      type="text"
                      value={line2}
                      onChange={(e) => setLine2(e.target.value)}
                      placeholder="e.g. Near City Center Park"
                      disabled={isSubmitting}
                      className="w-full px-3 py-2 text-sm bg-[#F7F0FA] border border-[#E7DCEB] rounded-xs focus:bg-white focus:outline-none focus:border-[#B69ACF] transition-colors"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs uppercase tracking-wider text-[#6F6475] font-medium mb-1">
                        City *
                      </label>
                      <input
                        type="text"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="e.g. Jaipur"
                        disabled={isSubmitting}
                        className={`w-full px-3 py-2 text-sm bg-[#F7F0FA] border rounded-xs focus:bg-white focus:outline-none transition-colors ${
                          errors.city ? 'border-[#DC2626]' : 'border-[#E7DCEB] focus:border-[#B69ACF]'
                        }`}
                      />
                      {errors.city && (
                        <p className="text-[11px] text-[#DC2626] mt-1">{errors.city}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs uppercase tracking-wider text-[#6F6475] font-medium mb-1">
                        State / UT *
                      </label>
                      <select
                        value={state}
                        onChange={(e) => setState(e.target.value)}
                        disabled={isSubmitting}
                        className={`w-full px-3 py-2 text-sm bg-[#F7F0FA] border rounded-xs focus:bg-white focus:outline-none transition-colors ${
                          errors.state ? 'border-[#DC2626]' : 'border-[#E7DCEB] focus:border-[#B69ACF]'
                        }`}
                      >
                        <option value="">Select State</option>
                        {INDIAN_STATES_AND_UTS.map((st) => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        ))}
                      </select>
                      {errors.state && (
                        <p className="text-[11px] text-[#DC2626] mt-1">{errors.state}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs uppercase tracking-wider text-[#6F6475] font-medium mb-1">
                        PIN Code *
                      </label>
                      <input
                        type="text"
                        value={pincode}
                        onChange={(e) => setPincode(e.target.value)}
                        placeholder="e.g. 302001"
                        maxLength={6}
                        disabled={isSubmitting}
                        className={`w-full px-3 py-2 text-sm bg-[#F7F0FA] border rounded-xs focus:bg-white focus:outline-none transition-colors font-mono ${
                          errors.pincode ? 'border-[#DC2626]' : 'border-[#E7DCEB] focus:border-[#B69ACF]'
                        }`}
                      />
                      {errors.pincode && (
                        <p className="text-[11px] text-[#DC2626] mt-1">{errors.pincode}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment Method Section */}
              <div className="pt-4 border-t border-[#E7DCEB]">
                <h2 className="font-serif text-xl text-[#302438] font-medium border-b border-[#E7DCEB] pb-2 mb-4">
                  3. Payment Method
                </h2>

                <div className="space-y-3">
                  {/* Online payment option */}
                  <label
                    className={`block p-4 border rounded-sm cursor-pointer transition-colors ${
                      paymentMethod === 'online'
                        ? 'border-[#563568] bg-[#FAF5FC] ring-1 ring-[#563568]'
                        : 'border-[#E7DCEB] bg-white hover:border-[#B69ACF]'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="radio"
                        name="paymentMethod"
                        value="online"
                        checked={paymentMethod === 'online'}
                        onChange={() => setPaymentMethod('online')}
                        className="mt-0.5 accent-[#563568]"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <CreditCard size={16} className="text-[#563568]" />
                          <span className="text-xs uppercase tracking-wider font-semibold text-[#302438]">
                            Pay Online (Cards / UPI / Netbanking)
                          </span>
                        </div>
                        <p className="text-xs text-[#6F6475] mt-1 font-sans">
                          Pay securely via Credit/Debit Cards, UPI, or Netbanking powered by Razorpay.
                        </p>
                      </div>
                    </div>
                  </label>

                  {/* Cash on Delivery option (only if COD_ENABLED is true) */}
                  {COD_ENABLED && (
                    <label
                      className={`block p-4 border rounded-sm cursor-pointer transition-colors ${
                        paymentMethod === 'cod'
                          ? 'border-[#563568] bg-[#FAF5FC] ring-1 ring-[#563568]'
                          : 'border-[#E7DCEB] bg-white hover:border-[#B69ACF]'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="radio"
                          name="paymentMethod"
                          value="cod"
                          checked={paymentMethod === 'cod'}
                          onChange={() => setPaymentMethod('cod')}
                          className="mt-0.5 accent-[#563568]"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Banknote size={16} className="text-[#563568]" />
                            <span className="text-xs uppercase tracking-wider font-semibold text-[#302438]">
                              Cash on Delivery
                            </span>
                          </div>
                          <p className="text-xs text-[#6F6475] mt-1 font-sans">
                            Pay with exact cash or UPI QR upon courier arrival.
                          </p>
                        </div>
                      </div>
                    </label>
                  )}
                </div>
              </div>

              {/* Submit Button (double-submit safe) */}
              <div className="pt-4 border-t border-[#E7DCEB]">
                <button
                  type="submit"
                  disabled={isSubmitting || isVerifyingPayment}
                  className="w-full py-4 bg-[#563568] text-white text-xs uppercase tracking-[0.2em] font-semibold hover:bg-[#A184BD] disabled:bg-[#E7DCEB] disabled:text-[#6F6475] disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 shadow-xs rounded-xs"
                >
                  <Lock size={15} />
                  <span>
                    {isVerifyingPayment
                      ? 'Authorizing with Bank...'
                      : isSubmitting
                      ? 'Connecting to Secure Gateway...'
                      : paymentMethod === 'online'
                      ? `Pay Online • ${formatInr(total)}`
                      : `Place Order • ${formatInr(total)}`}
                  </span>
                </button>
                <p className="text-center text-[11px] text-[#6F6475] mt-2 font-sans">
                  By clicking Pay Online, an authentic Razorpay gateway window will open. Prices and stock are verified by our server.
                </p>
              </div>
            </form>
          </div>

          {/* Right Column: Order Summary Panel (5 cols) */}
          <div className="lg:col-span-5 bg-white border border-[#E7DCEB] p-6 space-y-4 rounded-sm shadow-xs">
            <h2 className="font-serif text-xl text-[#302438] font-medium border-b border-[#E7DCEB] pb-3">
              Order Summary ({items.length} {items.length === 1 ? 'piece' : 'pieces'})
            </h2>

            {/* Item Miniatures List */}
            <div className="divide-y divide-[#E7DCEB] max-h-80 overflow-y-auto pr-1">
              {items.map((item) => (
                <div key={item.productId} className="py-3 flex gap-3 items-center">
                  <div className="w-14 h-16 bg-[#F7F0FA] border border-[#E7DCEB] shrink-0 overflow-hidden rounded-xs">
                    <img
                      src={item.product.images[0]}
                      alt={item.product.name}
                      className="w-full h-full object-cover object-center"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-serif text-sm text-[#302438] font-medium line-clamp-1">
                      {item.product.name}
                    </p>
                    <p className="text-[11px] text-[#6F6475] font-sans">
                      Qty: {item.quantity} × {formatInr(item.unitPrice)}
                    </p>
                  </div>
                  <div className="text-right text-xs font-semibold text-[#302438]">
                    {formatInr(item.lineTotal)}
                  </div>
                </div>
              ))}
            </div>

            {/* Calculations Breakdown */}
            <div className="pt-3 border-t border-[#E7DCEB] space-y-2 text-xs font-sans">
              <div className="flex justify-between text-[#6F6475]">
                <span>Bag Subtotal</span>
                <span>{formatInr(subtotal)}</span>
              </div>
              <div className="flex justify-between text-[#6F6475]">
                <span>Standard Delivery (India)</span>
                <span>{shippingFee === 0 ? 'Complimentary' : formatInr(shippingFee)}</span>
              </div>
              <div className="flex justify-between text-[#302438] font-semibold text-base pt-2 border-t border-[#E7DCEB]">
                <span className="font-serif">Total Amount</span>
                <span className="font-serif text-xl">{formatInr(total)}</span>
              </div>
            </div>

            {/* Safety Assurance */}
            <div className="p-3.5 bg-[#F7F0FA] border border-[#E7DCEB] text-[11px] text-[#6F6475] space-y-1.5 rounded-xs">
              <div className="flex items-center gap-1.5 font-semibold text-[#302438]">
                <ShieldCheck size={14} className="text-[#563568]" />
                <span>SARINE Order Integrity Guarantee</span>
              </div>
              <p>Prices and stock availability are re-verified with the inventory system before final placement.</p>
            </div>
          </div>
        </div>
        </div>
      </main>
    </div>
  );
};
