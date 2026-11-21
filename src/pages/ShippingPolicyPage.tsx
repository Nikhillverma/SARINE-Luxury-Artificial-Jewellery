/**
 * Shipping & Delivery Policy page for SARINE.
 * Transparent details on domestic India coverage, dispatch window (2-3 days),
 * transit timeline (5-7 days), fees, tracking, and no international delivery notice.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { useCheckoutConfig } from '../hooks/useCheckoutConfig';
import { PolicyLayout } from '../components/PolicyLayout';
import { Truck, Clock, MapPin, PackageCheck, AlertCircle } from 'lucide-react';

export const ShippingPolicyPage: React.FC = () => {
  const { config } = useCheckoutConfig();
  const feeDisplay = config.shippingFlatFee === 0 ? 'Complimentary (Free)' : `₹${config.shippingFlatFee}`;
  const thresholdDisplay = `₹${config.freeShippingThreshold.toLocaleString('en-IN')}`;

  return (
    <PolicyLayout
      title="Shipping & Delivery Policy"
      subtitle="We package and dispatch each piece of jewellery with utmost care to ensure it reaches you safely, securely, and in pristine condition across India."
      categoryName="Fulfillment & Logistics"
    >
      <div className="space-y-10 text-xs sm:text-sm text-[#6F6475] leading-relaxed font-sans">
        {/* Effective Date Note */}
        <div className="bg-[#FAF5FC] border-l-2 border-[#563568] p-4 text-xs text-[#6F6475]">
          <strong className="text-[#302438] font-medium">Effective Date:</strong> 21 October 2026 | Applicable across all domestic shipments within India.
        </div>

        {/* Section 1: Coverage */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <MapPin size={16} className="text-[#563568]" />
            <h2 className="font-serif text-lg sm:text-xl text-[#302438]">
              1. Delivery Coverage Across India
            </h2>
          </div>
          <p>
            SARINE delivers to almost all serviceable postal PIN codes across India through established domestic logistics partners (including Blue Dart, Delhivery, and DTDC).
          </p>
          <div className="p-4 bg-[#FAF5FC] border border-[#E7DCEB] flex items-start gap-3 rounded-xs">
            <AlertCircle size={18} className="text-[#563568] shrink-0 mt-0.5" />
            <div className="text-xs text-[#6F6475]">
              <strong className="text-[#302438] block font-medium mb-1">Domestic Delivery Only</strong>
              At this time, SARINE ships exclusively within the Republic of India. We do not support international shipments or cross-border delivery.
            </div>
          </div>
        </section>

        {/* Section 2: Timelines */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-[#563568]" />
            <h2 className="font-serif text-lg sm:text-xl text-[#302438]">2. Dispatch & Delivery Updates</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div className="p-4 bg-[#FAF5FC] border border-[#E7DCEB] rounded-xs">
              <h3 className="text-xs uppercase tracking-wider text-[#302438] font-semibold">Order Processing</h3>
              <p className="font-serif text-xl text-[#563568] mt-1">After confirmation</p>
              <p className="text-xs text-[#6F6475] mt-2">Orders are prepared for dispatch after order confirmation. Processing time may vary with product availability and order volume.</p>
            </div>
            <div className="p-4 bg-[#FAF5FC] border border-[#E7DCEB] rounded-xs">
              <h3 className="text-xs uppercase tracking-wider text-[#302438] font-semibold">Courier Tracking</h3>
              <p className="font-serif text-xl text-[#563568] mt-1">After dispatch</p>
              <p className="text-xs text-[#6F6475] mt-2">Tracking details become available after the shipment is handed to the courier. Use the Track Order page to check the latest recorded status.</p>
            </div>
          </div>
        </section>

        {/* Section 3: Shipping Fees */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Truck size={16} className="text-[#563568]" />
            <h2 className="font-serif text-lg sm:text-xl text-[#302438]">
              3. Shipping Fees & Free Delivery
            </h2>
          </div>
          <p>
            We believe in honest, upfront pricing with no hidden charges at final payment:
          </p>
          <div className="p-4 bg-[#FAF5FC] border border-[#E7DCEB] space-y-2 text-xs rounded-xs">
            <div className="flex justify-between items-center py-1 border-b border-[#E7DCEB]">
              <span className="text-[#6F6475]">Standard Shipping Fee:</span>
              <span className="font-medium text-[#302438]">{feeDisplay}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-[#E7DCEB]">
              <span className="text-[#6F6475]">Free Shipping Eligibility:</span>
              <span className="font-medium text-[#302438]">
                {config.shippingFlatFee === 0 ? 'All orders across India' : `On orders of ${thresholdDisplay} or more`}
              </span>
            </div>
            <p className="text-[#6F6475] pt-1">
              The shipping fee shown above is applied at checkout. Free shipping is applied automatically when the order subtotal reaches or exceeds the threshold.
            </p>
          </div>
        </section>

        {/* Section 4: Tracking */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <PackageCheck size={16} className="text-[#563568]" />
            <h2 className="font-serif text-lg sm:text-xl text-[#302438]">
              4. Order Tracking & Parcel Handover
            </h2>
          </div>
          <p>
            As soon as your parcel is dispatched from our atelier:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-xs text-[#6F6475]">
            <li>When tracking details are available, you can check the latest recorded shipment status on the Track Order page.</li>
            <li>You can monitor the live movement of your parcel from the logistics provider&apos;s real-time portal.</li>
            <li>If you need help locating a package, submit an enquiry through our <Link to="/contact" className="text-[#563568] underline underline-offset-2">Contact page</Link> and include your SARINE order number.</li>
          </ul>
        </section>
      </div>
    </PolicyLayout>
  );
};
