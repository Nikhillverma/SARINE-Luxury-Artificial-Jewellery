/**
 * DevFirebaseSeedModal component for SARINE.
 * A developer-only utility to populate Firestore with sample categories and products.
 * Automatically stripped / hidden in production builds.
 */

import React, { useState } from 'react';
import { seedFirestore, SeedResult } from '../services/firebase/seedFirestore';
import { isFirebaseConfigured } from '../lib/firebase';
import { DATA_SOURCE } from '../services';
import { Database, X, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

interface DevFirebaseSeedModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DevFirebaseSeedModal: React.FC<DevFirebaseSeedModalProps> = ({
  isOpen,
  onClose
}) => {
  const [isSeeding, setIsSeeding] = useState(false);
  const [result, setResult] = useState<SeedResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || import.meta.env.PROD) return null;

  const configured = isFirebaseConfigured();

  const handleRunSeed = async () => {
    setIsSeeding(true);
    setError(null);
    setResult(null);

    try {
      const res = await seedFirestore();
      setResult(res);
    } catch (err: any) {
      console.error('Seed failure:', err);
      setError(err.message || 'Failed to seed Firestore collections.');
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#302438]/50 backdrop-blur-xs">
      <div className="bg-white border border-[#E7DCEB] w-full max-w-lg p-6 shadow-xl relative animate-in fade-in duration-200 rounded-md">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[#6F6475] hover:text-[#563568]"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-2 mb-2 text-[#563568]">
          <Database size={20} />
          <span className="text-xs uppercase tracking-widest font-semibold font-sans">
            Developer Tool (Hidden in Production)
          </span>
        </div>

        <h3 className="font-serif text-2xl text-[#302438] font-medium">
          Firestore Seed Utility
        </h3>

        <div className="mt-4 p-3 bg-[#F7F0FA] border border-[#E7DCEB] text-xs font-sans space-y-1.5 text-[#6F6475] rounded-xs">
          <p>
            <strong>Active DATA_SOURCE:</strong>{' '}
            <span className="font-mono text-[#302438] uppercase bg-[#EBDFF2] px-1.5 py-0.5 rounded">
              {DATA_SOURCE}
            </span>
          </p>
          <p>
            <strong>Firebase Credentials:</strong>{' '}
            {configured ? (
              <span className="text-[#15803D] font-semibold">Configured (VITE_FIREBASE_* detected)</span>
            ) : (
              <span className="text-[#B91C1C] font-semibold">
                Not detected — please add VITE_FIREBASE_* in your environment
              </span>
            )}
          </p>
        </div>

        <p className="text-xs text-[#6F6475] mt-3 font-sans leading-relaxed">
          This operation writes 5 categories and 16 products to your Firestore collections
          (<code className="bg-[#F7F0FA] px-1">categories</code> and{' '}
          <code className="bg-[#F7F0FA] px-1">products</code>) using deterministic IDs. It is safe to
          run repeatedly and will overwrite existing records without creating duplicates.
        </p>

        {error && (
          <div className="mt-4 p-3 bg-[#B91C1C]/10 border border-[#B91C1C] text-xs text-[#B91C1C] flex items-start gap-2 rounded-xs">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {result && (
          <div className="mt-4 p-3 bg-[#15803D]/10 border border-[#15803D] text-xs text-[#15803D] flex items-start gap-2 rounded-xs">
            <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">{result.message}</p>
              <p className="text-[11px] mt-0.5 text-[#6F6475]">
                Set <code className="bg-white px-1">VITE_DATA_SOURCE=&quot;firebase&quot;</code> or edit{' '}
                <code className="bg-white px-1">services/index.ts</code> to switch to live Firestore.
              </p>
            </div>
          </div>
        )}

        <div className="mt-6 flex justify-end gap-3 border-t border-[#E7DCEB] pt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-[#E7DCEB] text-xs uppercase tracking-widest text-[#6F6475] hover:bg-[#F7F0FA] rounded-xs"
          >
            Close
          </button>
          <button
            onClick={handleRunSeed}
            disabled={isSeeding || !configured}
            className="px-5 py-2 bg-[#563568] text-white text-xs uppercase tracking-widest font-semibold hover:bg-[#A184BD] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 rounded-xs transition-colors"
          >
            <RefreshCw size={13} className={isSeeding ? 'animate-spin' : ''} />
            <span>{isSeeding ? 'Seeding...' : 'Upload Seed to Firestore'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
