/**
 * ReturnExchangeModal for SARINE.
 * Captures return/exchange reason, preferred resolution, and guidelines for delivered pieces.
 */

import React, { useState } from 'react';
import { Order } from '../../types/order';
import { AlertCircle, X, RotateCcw, ArrowRightLeft } from 'lucide-react';

interface ReturnExchangeModalProps {
  order: Order;
  isOpen: boolean;
  onClose: () => void;
  onConfirmReturn: (reason: string, actionType: 'return' | 'exchange', notes: string) => Promise<void>;
}

const RETURN_REASONS = [
  'Size or fit adjustment required',
  'Item arrived damaged or scratched',
  'Received different item than ordered',
  'Finish / polish not as expected',
  'Changed mind / no longer needed',
  'Other reason'
];

export const ReturnExchangeModal: React.FC<ReturnExchangeModalProps> = ({
  order,
  isOpen,
  onClose,
  onConfirmReturn
}) => {
  const [actionType, setActionType] = useState<'return' | 'exchange'>('exchange');
  const [selectedReason, setSelectedReason] = useState(RETURN_REASONS[0]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await onConfirmReturn(selectedReason, actionType, notes);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to submit request. Please try again.');
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
              Request Return or Exchange
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs font-sans">
          {error && (
            <div className="p-3 bg-[#DC2626]/5 border border-[#DC2626]/20 text-[#DC2626] rounded-xs flex items-start gap-2">
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Type Selection */}
          <div>
            <label className="block text-[#302438] font-medium mb-1.5">
              Select Preferred Resolution:
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setActionType('exchange')}
                className={`p-3 border rounded-xs text-left cursor-pointer transition-colors ${
                  actionType === 'exchange'
                    ? 'border-[#563568] bg-[#FAF5FC] text-[#563568]'
                    : 'border-[#E7DCEB] text-[#6F6475] hover:bg-[#F7F0FA]'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <ArrowRightLeft size={14} className={actionType === 'exchange' ? 'text-[#563568]' : 'text-[#6F6475]'} />
                  <span className="font-semibold text-xs">Exchange</span>
                </div>
                <p className="text-[10px] text-[#6F6475]">Replace with correct size or alternate style</p>
              </button>

              <button
                type="button"
                onClick={() => setActionType('return')}
                className={`p-3 border rounded-xs text-left cursor-pointer transition-colors ${
                  actionType === 'return'
                    ? 'border-[#563568] bg-[#FAF5FC] text-[#563568]'
                    : 'border-[#E7DCEB] text-[#6F6475] hover:bg-[#F7F0FA]'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <RotateCcw size={14} className={actionType === 'return' ? 'text-[#563568]' : 'text-[#6F6475]'} />
                  <span className="font-semibold text-xs">Return</span>
                </div>
                <p className="text-[10px] text-[#6F6475]">Full refund to original source payment</p>
              </button>
            </div>
          </div>

          {/* Reason Selection */}
          <div>
            <label className="block text-[#302438] font-medium mb-1.5">
              Reason for {actionType === 'exchange' ? 'Exchange' : 'Return'}:
            </label>
            <select
              value={selectedReason}
              onChange={(e) => setSelectedReason(e.target.value)}
              className="w-full p-2.5 bg-[#F7F0FA] border border-[#E7DCEB] focus:border-[#563568] rounded-xs focus:outline-none text-xs"
            >
              {RETURN_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[#6F6475] mb-1">
              Additional notes or specifics (optional):
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="E.g. Please send size 2.6 in exchange for 2.4..."
              className="w-full p-2.5 bg-[#F7F0FA] border border-[#E7DCEB] focus:border-[#563568] rounded-xs focus:outline-none"
            />
          </div>

          {/* Policy Guidance */}
          <div className="p-3.5 bg-[#FAF5FC] border border-[#E7DCEB] rounded-xs text-[11px] text-[#6F6475] space-y-1">
            <span className="font-semibold text-[#563568] block">7-Day Atelier Quality Assurance</span>
            <p>
              Complimentary doorstep reverse pickup will be arranged. Pieces must be unworn, undamaged, and returned with the original SARINE velvet keepsake box and tags intact.
            </p>
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-[#6F6475] hover:text-[#302438] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 bg-[#563568] hover:bg-[#80609A] text-white font-medium rounded-xs transition-colors shadow-xs cursor-pointer disabled:opacity-50"
            >
              {loading ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
