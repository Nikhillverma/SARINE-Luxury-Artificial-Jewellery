/**
 * OrderDetailsModal for SARINE.
 * Complete, luxurious order details view displaying order summary, itemized line snapshot,
 * distinct product types vs total units count, payment details, courier tracking timeline,
 * and context-aware action buttons (Invoice download, Track order, Cancel order, Return request, Buy again).
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Order, OrderStatus } from '../../types/order';
import { formatInr } from '../../utils/currency';
import { useCart } from '../../context/CartContext';
import { TaxInvoiceModal } from './TaxInvoiceModal';
import { CancelOrderModal } from './CancelOrderModal';
import { ReturnExchangeModal } from './ReturnExchangeModal';
import {
  X,
  Package,
  Truck,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  RotateCcw,
  ShoppingBag,
  ExternalLink,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  Banknote,
  ShieldCheck,
  Sparkles,
  ChevronRight
} from 'lucide-react';

interface OrderDetailsModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onCancelOrder: (orderNumber: string, reason: string) => Promise<void>;
  onReturnOrder: (orderNumber: string, reason: string, actionType: 'return' | 'exchange', notes: string) => Promise<void>;
}

export const OrderDetailsModal: React.FC<OrderDetailsModalProps> = ({
  order,
  isOpen,
  onClose,
  onCancelOrder,
  onReturnOrder
}) => {
  const { addItem, openDrawer } = useCart();
  const [isInvoiceOpen, setIsInvoiceOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  if (!isOpen || !order) return null;

  // Counts
  const distinctProductTypes = order.lines.length;
  const totalUnits = order.lines.reduce((sum, line) => sum + (line.quantity || 1), 0);

  // Formatted date & time
  const orderDate = new Date(order.createdAt).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
  const orderTime = new Date(order.createdAt).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit'
  });

  // Status mapping
  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'placed':
      case 'confirmed':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#B69ACF]/20 text-[#563568] border border-[#B69ACF]/40">
            <span className="w-1.5 h-1.5 rounded-full bg-[#563568]" />
            Confirmed
          </span>
        );
      case 'processing':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#D9B8A0]/25 text-[#735135] border border-[#D9B8A0]/50">
            <span className="w-1.5 h-1.5 rounded-full bg-[#735135] animate-pulse" />
            Processing in Atelier
          </span>
        );
      case 'shipped':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#3B82F6]/10 text-[#1D4ED8] border border-[#3B82F6]/30">
            <Truck size={12} />
            Shipped
          </span>
        );
      case 'out_for_delivery':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#8B5CF6]/10 text-[#6D28D9] border border-[#8B5CF6]/30">
            <Truck size={12} />
            Out for Delivery
          </span>
        );
      case 'delivered':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#10B981]/15 text-[#047857] border border-[#10B981]/30">
            <CheckCircle2 size={12} />
            Delivered
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#DC2626]/10 text-[#DC2626] border border-[#DC2626]/30">
            <AlertCircle size={12} />
            Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
            {status}
          </span>
        );
    }
  };

  // Eligibility
  const canCancel = ['placed', 'pending', 'confirmed', 'awaiting_payment'].includes(order.orderStatus);
  const canReturn = order.orderStatus === 'delivered' && order.returnStatus !== 'return_requested' && order.returnStatus !== 'exchange_requested';
  const hasInvoice = order.orderStatus !== 'cancelled' && order.orderStatus !== 'failed';

  // Buy Again
  const handleBuyAgain = () => {
    order.lines.forEach((line) => {
      addItem({
        id: line.productId,
        slug: line.productId,
        name: line.name,
        description: line.name,
        price: line.unitPrice,
        images: line.image ? [line.image] : [],
        categoryId: 'earrings',
        collectionSlugs: [],
        jewelleryType: 'earrings',
        stock: 50,
        status: 'active',
        createdAt: new Date().toISOString(),
        tags: []
      }, line.quantity || 1);
    });
    setToastMessage('Items added back to your bag!');
    setTimeout(() => setToastMessage(null), 3000);
    openDrawer();
  };

  return (
    <>
      <div className="fixed inset-0 z-50 overflow-y-auto bg-[#302438]/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-fadeIn">
        <div className="bg-white border border-[#E7DCEB] shadow-2xl w-full max-w-3xl overflow-hidden rounded-xs max-h-[92vh] flex flex-col">
          {/* Header */}
          <div className="px-6 py-4 border-b border-[#E7DCEB] flex items-center justify-between bg-[#F7F0FA]/70 shrink-0">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="font-serif text-lg sm:text-xl text-[#302438] font-normal">
                  Order #{order.orderNumber}
                </h2>
                {getStatusBadge(order.orderStatus)}
              </div>
              <p className="text-xs text-[#6F6475] mt-0.5">
                Placed on {orderDate} at {orderTime}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-[#6F6475] hover:text-[#302438] p-1.5 rounded-full hover:bg-white transition-colors cursor-pointer"
              aria-label="Close details"
            >
              <X size={20} strokeWidth={1.5} />
            </button>
          </div>

          {/* Toast Notice */}
          {toastMessage && (
            <div className="bg-[#10B981] text-white text-xs py-2 px-6 text-center font-medium">
              {toastMessage}
            </div>
          )}

          {/* Scrollable Body */}
          <div className="p-6 overflow-y-auto space-y-6 text-xs font-sans text-[#302438] divide-y divide-[#E7DCEB]">
            {/* 1. Fulfillment Tracker / Progress Steps */}
            {order.orderStatus !== 'cancelled' ? (
              <div className="space-y-3 pb-6">
                <span className="text-[10px] uppercase tracking-wider text-[#563568] font-semibold block">
                  Delivery Timeline
                </span>
                <div className="grid grid-cols-4 gap-2 text-center text-[11px]">
                  {/* Step 1: Placed */}
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 rounded-full bg-[#563568] text-white flex items-center justify-center shadow-xs">
                      <CheckCircle2 size={16} />
                    </div>
                    <span className="mt-1.5 font-medium text-[#302438]">Confirmed</span>
                    <span className="text-[10px] text-[#6F6475]">{orderDate}</span>
                  </div>

                  {/* Step 2: Processing */}
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center shadow-xs ${
                        ['processing', 'shipped', 'out_for_delivery', 'delivered'].includes(order.orderStatus)
                          ? 'bg-[#563568] text-white'
                          : 'bg-[#F7F0FA] text-[#6F6475] border border-[#E7DCEB]'
                      }`}
                    >
                      <Package size={16} />
                    </div>
                    <span className="mt-1.5 font-medium text-[#302438]">Packed</span>
                    <span className="text-[10px] text-[#6F6475]">Atelier Quality Check</span>
                  </div>

                  {/* Step 3: Shipped */}
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center shadow-xs ${
                        ['shipped', 'out_for_delivery', 'delivered'].includes(order.orderStatus)
                          ? 'bg-[#563568] text-white'
                          : 'bg-[#F7F0FA] text-[#6F6475] border border-[#E7DCEB]'
                      }`}
                    >
                      <Truck size={16} />
                    </div>
                    <span className="mt-1.5 font-medium text-[#302438]">Shipped</span>
                    <span className="text-[10px] text-[#6F6475]">
                      {order.courierName || 'Express Courier'}
                    </span>
                  </div>

                  {/* Step 4: Delivered */}
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center shadow-xs ${
                        order.orderStatus === 'delivered'
                          ? 'bg-[#10B981] text-white'
                          : 'bg-[#F7F0FA] text-[#6F6475] border border-[#E7DCEB]'
                      }`}
                    >
                      <CheckCircle2 size={16} />
                    </div>
                    <span className="mt-1.5 font-medium text-[#302438]">Delivered</span>
                    <span className="text-[10px] text-[#6F6475]">
                      {order.deliveredAt ? new Date(order.deliveredAt).toLocaleDateString('en-IN') : 'Expected in 3-5 days'}
                    </span>
                  </div>
                </div>

                {/* Tracking metadata pill if available */}
                {order.trackingNumber && (
                  <div className="p-3 bg-[#FAF5FC] border border-[#E7DCEB] rounded-xs flex items-center justify-between mt-3 text-xs">
                    <div>
                      <span className="text-[10px] text-[#6F6475] uppercase block">Courier Tracking:</span>
                      <span className="font-semibold text-[#563568]">{order.courierName} — {order.trackingNumber}</span>
                    </div>
                    <Link
                      to={`/track-order?orderNumber=${order.orderNumber}`}
                      className="px-3 py-1 bg-white border border-[#B69ACF] text-[#563568] hover:bg-[#F7F0FA] rounded-xs font-medium text-xs transition-colors flex items-center gap-1"
                    >
                      <span>Track Live</span>
                      <ExternalLink size={11} />
                    </Link>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 bg-[#DC2626]/5 border border-[#DC2626]/20 rounded-xs pb-6">
                <span className="font-semibold text-[#DC2626] block mb-1">Order Cancelled</span>
                <p className="text-xs text-[#6F6475]">
                  Reason: {order.cancellationReason || 'Customer requested cancellation.'}
                </p>
                {order.cancelledAt && (
                  <p className="text-[11px] text-[#6F6475] mt-0.5">
                    Cancelled on: {new Date(order.cancelledAt).toLocaleString('en-IN')}
                  </p>
                )}
              </div>
            )}

            {/* 2. Purchased Items List */}
            <div className="pt-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider text-[#563568] font-semibold">
                  Items Purchased
                </span>
                <span className="text-xs text-[#6F6475] font-medium">
                  {distinctProductTypes} Product {distinctProductTypes === 1 ? 'Type' : 'Types'} • {totalUnits} Total {totalUnits === 1 ? 'Unit' : 'Units'}
                </span>
              </div>

              <div className="space-y-3">
                {order.lines.map((line, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 bg-[#F7F0FA]/50 border border-[#E7DCEB] rounded-xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={line.image || 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=300&q=80'}
                        alt={line.name}
                        className="w-14 h-14 object-cover border border-[#E7DCEB] rounded-xs shrink-0 bg-white"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                      <div className="min-w-0">
                        <h4 className="font-serif text-xs sm:text-sm text-[#302438] truncate">{line.name}</h4>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-[#6F6475]">
                          {line.sku && <span className="font-mono text-[10px]">SKU: {line.sku}</span>}
                          <span>Qty: {line.quantity}</span>
                          <span>•</span>
                          <span>Unit: {formatInr(line.unitPrice)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0 pl-3">
                      <span className="font-semibold text-xs text-[#302438]">
                        {formatInr(line.unitPrice * line.quantity)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 3. Delivery & Payment Information (2 Columns) */}
            <div className="pt-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Delivery Details */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-[#563568] font-semibold">
                  <MapPin size={14} />
                  <span className="text-[10px] uppercase tracking-wider">Delivery Address</span>
                </div>
                <div className="p-3 bg-[#F7F0FA]/40 border border-[#E7DCEB] rounded-xs text-xs space-y-1">
                  <p className="font-medium text-[#302438]">{order.shippingAddress.fullName}</p>
                  <p className="text-[#6F6475]">
                    {order.shippingAddress.line1}
                    {order.shippingAddress.line2 ? `, ${order.shippingAddress.line2}` : ''}
                  </p>
                  <p className="text-[#6F6475]">
                    {order.shippingAddress.city}, {order.shippingAddress.state} — {order.shippingAddress.pincode}
                  </p>
                  <p className="text-[#6F6475] pt-1 border-t border-[#E7DCEB]/50 mt-1">
                    Phone: +91 {order.shippingAddress.phone}
                  </p>
                </div>
              </div>

              {/* Payment Details */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-[#563568] font-semibold">
                  {order.paymentMethod === 'online' ? <CreditCard size={14} /> : <Banknote size={14} />}
                  <span className="text-[10px] uppercase tracking-wider">Payment Information</span>
                </div>
                <div className="p-3 bg-[#F7F0FA]/40 border border-[#E7DCEB] rounded-xs text-xs space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-[#6F6475]">Method:</span>
                    <span className="font-medium capitalize text-[#302438]">
                      {order.paymentMethod === 'online' ? 'Online Prepaid (Razorpay / UPI / Cards)' : 'Cash on Delivery (COD)'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6F6475]">Payment Status:</span>
                    <span className="font-semibold uppercase text-[#563568]">{order.paymentStatus}</span>
                  </div>
                  {order.razorpayPaymentId && (
                    <div className="flex justify-between text-[11px]">
                      <span className="text-[#6F6475]">Txn Reference:</span>
                      <span className="font-mono text-[#302438]">{order.razorpayPaymentId}</span>
                    </div>
                  )}
                  {order.paymentMethod === 'cod' && order.paymentStatus !== 'paid' && (
                    <div className="flex justify-between pt-1 border-t border-[#E7DCEB]/50">
                      <span className="text-[#6F6475]">COD Due on Delivery:</span>
                      <span className="font-semibold text-[#563568]">{formatInr(order.total)}</span>
                    </div>
                  )}
                  {order.refundNeeded && (
                    <div className="flex justify-between pt-1 border-t border-[#E7DCEB]/50 text-[#DC2626]">
                      <span>Refund Status:</span>
                      <span className="font-semibold">Processing ({formatInr(order.refundAmount || order.total)})</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 4. Financial Cost Summary */}
            <div className="pt-6">
              <div className="bg-[#FAF5FC] border border-[#E7DCEB] p-4 rounded-xs space-y-2 max-w-sm ml-auto">
                <div className="flex justify-between text-[#6F6475]">
                  <span>Item Subtotal ({distinctProductTypes} items):</span>
                  <span>{formatInr(order.subtotal)}</span>
                </div>
                <div className="flex justify-between text-[#6F6475]">
                  <span>Shipping & Handling:</span>
                  <span className="text-[#047857] font-medium">
                    {order.shippingFee > 0 ? formatInr(order.shippingFee) : 'FREE (Complimentary)'}
                  </span>
                </div>
                <div className="flex justify-between text-[#6F6475] text-[11px]">
                  <span>Taxes:</span>
                  <span>Inclusive of 3% GST</span>
                </div>
                <div className="flex justify-between font-serif text-base text-[#563568] font-normal pt-2 border-t border-[#E7DCEB]">
                  <span>Total Amount Paid / Payable:</span>
                  <span className="font-semibold">{formatInr(order.total)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-4 sm:p-5 bg-white border-t border-[#E7DCEB] flex flex-wrap items-center justify-between gap-3 shrink-0">
            {/* Left Utility Actions */}
            <div className="flex items-center gap-2">
              {hasInvoice && (
                <button
                  onClick={() => setIsInvoiceOpen(true)}
                  className="px-3.5 py-2 border border-[#E7DCEB] hover:border-[#563568] text-[#563568] rounded-xs text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <FileText size={13} />
                  <span>Download Tax Invoice</span>
                </button>
              )}

              <Link
                to={`/track-order?orderNumber=${order.orderNumber}`}
                className="px-3.5 py-2 border border-[#E7DCEB] hover:border-[#563568] text-[#563568] rounded-xs text-xs font-medium transition-colors flex items-center gap-1.5 shadow-2xs"
              >
                <Truck size={13} />
                <span>Track Order</span>
              </Link>
            </div>

            {/* Right Contextual Actions */}
            <div className="flex items-center gap-2">
              {canCancel && (
                <button
                  onClick={() => setIsCancelModalOpen(true)}
                  className="px-3.5 py-2 border border-[#DC2626]/30 text-[#DC2626] hover:bg-[#DC2626]/5 rounded-xs text-xs font-medium transition-colors cursor-pointer"
                >
                  Request Cancellation
                </button>
              )}

              {canReturn && (
                <button
                  onClick={() => setIsReturnModalOpen(true)}
                  className="px-3.5 py-2 border border-[#563568] text-[#563568] hover:bg-[#FAF5FC] rounded-xs text-xs font-medium transition-colors cursor-pointer"
                >
                  Return / Exchange
                </button>
              )}

              <button
                onClick={handleBuyAgain}
                className="px-4 py-2 bg-[#563568] hover:bg-[#80609A] text-white rounded-xs text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <ShoppingBag size={13} />
                <span>Buy Again</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tax Invoice Modal */}
      <TaxInvoiceModal
        order={order}
        isOpen={isInvoiceOpen}
        onClose={() => setIsInvoiceOpen(false)}
      />

      {/* Cancellation Reason Modal */}
      <CancelOrderModal
        order={order}
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        onConfirmCancel={async (reason) => {
          await onCancelOrder(order.orderNumber, reason);
        }}
      />

      {/* Return / Exchange Modal */}
      <ReturnExchangeModal
        order={order}
        isOpen={isReturnModalOpen}
        onClose={() => setIsReturnModalOpen(false)}
        onConfirmReturn={async (reason, actionType, notes) => {
          await onReturnOrder(order.orderNumber, reason, actionType, notes);
        }}
      />
    </>
  );
};
