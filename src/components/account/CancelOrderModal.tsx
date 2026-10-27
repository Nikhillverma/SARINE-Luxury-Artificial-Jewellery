/**
 * CancelOrderModal for SARINE.
 * Provides order cancellation reason capture, policy assurances, and confirmed dispatch.
 */

import React, { useState } from 'react';
import { Order } from '../../types/order';
import { formatInr } from '../../utils/currency';
import { AlertCircle, X, Check } from 'lucide-react';

interface CancelOrderModalProps {
  order: Order;
  isOpen: boolean;
  onClose: () => void;
  onConfirmCancel: (reason: string) => Promise<void>;
}

const CANCEL_REASONS = [
  'Placed order by mistake',
  'Need to modify delivery address',
  'Want to change payment method or item',
  'Selected alternative jewellery piece',
  'Delivery timeline does not meet requirement',
  'Other reasons'
];

export const CancelOrderModal: React.FC<CancelOrderModalProps> = ({
  order,
  isOpen,
  onClose,
  onConfirmCancel
}) => {
  const [selectedReason, setSelectedReason] = useState(CANCEL_REASONS[0]);
  const [customNote, setCustomNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const finalReason = selectedReason === 'Other reasons' && customNote.trim()
      ? `Other: ${customNote.trim()}`
      : selectedReason;

    try {
      await onConfirmCancel(finalReason);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to cancel order. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#302438]/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-[#E7DCEB] shadow-2xl w-full max-w-md overflow-hidden rounded-xs animate-fadeIn">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E7DCEB] flex items-center justify-between bg-[#F7F0FA]/50">
          <div>
            <h3 className="font-serif text-base text-[#302438] font-normal">
              Request Order Cancellation
            </h3>
            <span className="text-xs text-[#6F6475]">Order #{order.orderNumber}</span>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-[#6F6475] hover:text-[#302438] p-1 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs font-sans">
          {error && (
            <div className="p-3 bg-[#DC2626]/5 border border-[#DC2626]/20 text-[#DC2626] rounded-xs flex items-start gap-2">
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-[#302438] font-medium mb-1.5">
              Please select a cancellation reason:
            </label>
            <div className="space-y-1.5">
              {CANCEL_REASONS.map((reason) => (
                <label
                  key={reason}
                  className={`flex items-center gap-2.5 p-2.5 border rounded-xs cursor-pointer transition-colors ${
                    selectedReason === reason
                      ? 'border-[#563568] bg-[#FAF5FC] text-[#563568]'
                      : 'border-[#E7DCEB] hover:bg-[#F7F0FA] text-[#6F6475]'
                  }`}
                >
                  <input
                    type="radio"
                    name="cancelReason"
                    value={reason}
                    checked={selectedReason === reason}
                    onChange={() => setSelectedReason(reason)}
                    className="accent-[#563568]"
                  />
                  <span>{reason}</span>
                </label>
              ))}
            </div>
          </div>

          {selectedReason === 'Other reasons' && (
            <div>
              <label className="block text-[#6F6475] mb-1">Additional details (optional):</label>
              <textarea
                value={customNote}
                onChange={(e) => setCustomNote(e.target.value)}
                rows={2}
                placeholder="Let us know how we can improve..."
                className="w-full p-2.5 bg-[#F7F0FA] border border-[#E7DCEB] focus:border-[#563568] rounded-xs focus:outline-none"
              />
            </div>
          )}

          {/* Refund Notice */}
          <div className="p-3.5 bg-[#FAF5FC] border border-[#E7DCEB] rounded-xs text-[11px] text-[#6F6475] space-y-1">
            <span className="font-semibold text-[#563568] block">SARINE Refund Policy</span>
            <p>
              {order.paymentMethod === 'online' && order.paymentStatus === 'paid'
                ? `The full payment of ${formatInr(order.total)} will be refunded back to your original payment method within 5-7 business days.`
                : 'Since this is a Cash on Delivery order, no amount was charged.'}
            </p>
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-[#6F6475] hover:text-[#302438] transition-colors cursor-pointer"
            >
              Keep Order
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 bg-[#DC2626] hover:bg-[#B91C1C] text-white font-medium rounded-xs transition-colors shadow-xs cursor-pointer disabled:opacity-50"
            >
              {loading ? 'Cancelling...' : 'Confirm Cancellation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
