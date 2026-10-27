/**
 * TaxInvoiceModal for SARINE.
 * Renders an official, printable Tax Invoice with demi-fine jewellery specifications,
 * GSTIN details, itemized lines, and print/download trigger.
 */

import React from 'react';
import { Order } from '../../types/order';
import { formatInr } from '../../utils/currency';
import { Printer, X, Download, ShieldCheck } from 'lucide-react';

interface TaxInvoiceModalProps {
  order: Order;
  isOpen: boolean;
  onClose: () => void;
}

export const TaxInvoiceModal: React.FC<TaxInvoiceModalProps> = ({
  order,
  isOpen,
  onClose
}) => {
  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const invoiceDate = new Date(order.createdAt).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  const invoiceNumber = `INV-${order.orderNumber.replace('SAR-', '')}`;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#302438]/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 print:p-0 print:bg-white">
      <div className="bg-white border border-[#E7DCEB] shadow-2xl w-full max-w-3xl overflow-hidden rounded-xs print:border-none print:shadow-none">
        {/* Top Control Bar (Hidden when printing) */}
        <div className="bg-[#563568] text-white px-6 py-3.5 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <span className="font-serif text-sm tracking-wider uppercase font-medium">
              SARINE ATELIER — OFFICIAL TAX INVOICE
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 bg-[#B69ACF] hover:bg-[#A184BD] text-[#302438] text-xs font-semibold rounded-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
              title="Print or Save as PDF"
            >
              <Printer size={14} />
              <span>Print / Download PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-white/80 hover:text-white transition-colors cursor-pointer"
              aria-label="Close invoice"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Printable Invoice Body */}
        <div className="p-6 sm:p-10 font-sans text-[#302438] text-xs space-y-6">
          {/* Header */}
          <div className="flex justify-between items-start border-b border-[#E7DCEB] pb-6">
            <div>
              <span className="font-serif text-2xl tracking-[0.22em] text-[#563568] uppercase font-normal block mb-1">
                SARINE
              </span>
              <p className="text-[11px] text-[#6F6475] leading-relaxed">
                Sarine Atelier Private Limited<br />
                Plot No. 42, Road No. 36, Jubilee Hills<br />
                Hyderabad, Telangana — 500033<br />
                GSTIN: 36AABCS1429P1Z7 • PAN: AABCS1429P
              </p>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase tracking-wider text-[#563568] font-bold block mb-1">
                TAX INVOICE
              </span>
              <p className="font-mono text-sm text-[#302438] font-semibold">{invoiceNumber}</p>
              <p className="text-[11px] text-[#6F6475] mt-1">Invoice Date: {invoiceDate}</p>
              <p className="text-[11px] text-[#6F6475]">Order Ref: {order.orderNumber}</p>
            </div>
          </div>

          {/* Billing & Shipping Details */}
          <div className="grid grid-cols-2 gap-6 border-b border-[#E7DCEB] pb-6">
            <div>
              <span className="text-[10px] uppercase tracking-wider text-[#6F6475] font-semibold block mb-1.5">
                Billed To:
              </span>
              <p className="font-medium text-[#302438]">{order.customer.name}</p>
              <p className="text-[11px] text-[#6F6475]">{order.customer.email}</p>
              <p className="text-[11px] text-[#6F6475]">Mobile: +91 {order.customer.phone}</p>
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-wider text-[#6F6475] font-semibold block mb-1.5">
                Shipped To:
              </span>
              <p className="font-medium text-[#302438]">{order.shippingAddress.fullName}</p>
              <p className="text-[11px] text-[#6F6475]">
                {order.shippingAddress.line1}
                {order.shippingAddress.line2 ? `, ${order.shippingAddress.line2}` : ''}
              </p>
              <p className="text-[11px] text-[#6F6475]">
                {order.shippingAddress.city}, {order.shippingAddress.state} — {order.shippingAddress.pincode}
              </p>
              <p className="text-[11px] text-[#6F6475]">Delivery Phone: +91 {order.shippingAddress.phone}</p>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E7DCEB] bg-[#F7F0FA]/60 text-[11px] uppercase tracking-wider text-[#563568]">
                  <th className="py-2.5 px-3 font-semibold">#</th>
                  <th className="py-2.5 px-3 font-semibold">Item & Description</th>
                  <th className="py-2.5 px-3 font-semibold">HSN / SKU</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Unit Price</th>
                  <th className="py-2.5 px-3 font-semibold text-center">Qty</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7DCEB] text-xs">
                {order.lines.map((line, idx) => (
                  <tr key={idx} className="hover:bg-[#F7F0FA]/30">
                    <td className="py-3 px-3 text-[#6F6475]">{idx + 1}</td>
                    <td className="py-3 px-3">
                      <span className="font-medium text-[#302438] block">{line.name}</span>
                      <span className="text-[10px] text-[#6F6475]">Demi-Fine 18K Polish Fashion Jewellery</span>
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px] text-[#6F6475]">
                      {line.sku || '71179090'}
                    </td>
                    <td className="py-3 px-3 text-right font-medium">{formatInr(line.unitPrice)}</td>
                    <td className="py-3 px-3 text-center">{line.quantity}</td>
                    <td className="py-3 px-3 text-right font-medium">
                      {formatInr(line.unitPrice * line.quantity)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Financial Calculation */}
          <div className="flex justify-between items-start pt-2 border-t border-[#E7DCEB]">
            <div className="space-y-1 text-[11px] text-[#6F6475] max-w-xs">
              <p className="font-medium text-[#302438]">Payment Summary:</p>
              <p>Method: {order.paymentMethod === 'online' ? 'Prepaid (Razorpay / UPI / Cards)' : 'Cash on Delivery (COD)'}</p>
              <p>Status: {order.paymentStatus.toUpperCase()}</p>
              {order.razorpayPaymentId && (
                <p className="font-mono text-[10px]">Txn ID: {order.razorpayPaymentId}</p>
              )}
            </div>

            <div className="w-64 space-y-2 text-xs">
              <div className="flex justify-between text-[#6F6475]">
                <span>Item Subtotal:</span>
                <span>{formatInr(order.subtotal)}</span>
              </div>
              <div className="flex justify-between text-[#6F6475]">
                <span>Shipping Charges:</span>
                <span>{order.shippingFee > 0 ? formatInr(order.shippingFee) : 'FREE'}</span>
              </div>
              <div className="flex justify-between text-[#6F6475]">
                <span>IGST / CGST (3% Included):</span>
                <span>{formatInr(Math.round(order.total * 0.03))}</span>
              </div>
              <div className="flex justify-between font-serif text-sm font-normal text-[#563568] pt-2 border-t border-[#E7DCEB]">
                <span>Total Amount:</span>
                <span>{formatInr(order.total)}</span>
              </div>
            </div>
          </div>

          {/* Terms & Footer */}
          <div className="pt-6 border-t border-[#E7DCEB] text-[10px] text-[#6F6475] flex justify-between items-center">
            <p>
              This is a computer-generated invoice. Authorized signatory not required.<br />
              For customer support or queries, contact concierge@sarine.in or call +91 98765 43210.
            </p>
            <div className="flex items-center gap-1.5 text-[#563568] font-medium">
              <ShieldCheck size={14} />
              <span>Certified 18K Micron Polish</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
