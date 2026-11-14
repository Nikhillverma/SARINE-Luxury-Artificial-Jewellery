/**
 * Contact page for SARINE.
 * Only publishes support channels after their details have been verified.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { PolicyLayout } from '../components/PolicyLayout';
import { Headphones, PackageSearch } from 'lucide-react';

export const ContactPage: React.FC = () => (
  <PolicyLayout
    title="Contact SARINE"
    subtitle="We want to make it easy to get help with your order and product questions."
    categoryName="Help & Support"
  >
    <div className="max-w-2xl mx-auto space-y-6 text-center">
      <div className="w-14 h-14 mx-auto rounded-full bg-[#F0E6F4] text-[#563568] flex items-center justify-center">
        <Headphones size={24} />
      </div>
      <h2 className="font-serif text-2xl text-[#302438]">Customer support details are being finalised</h2>
      <p className="text-sm text-[#6F6475] leading-relaxed">
        We are updating our official customer support channels. To avoid sending you to an unverified phone number,
        email address, or studio address, those details are not displayed here yet.
      </p>
      <div className="p-5 bg-[#FAF5FC] border border-[#E7DCEB] rounded-xs space-y-3">
        <PackageSearch size={22} className="mx-auto text-[#563568]" />
        <h3 className="font-serif text-lg text-[#302438]">Looking for an order update?</h3>
        <p className="text-xs text-[#6F6475]">Use your SARINE order number to check the latest order status.</p>
        <Link
          to="/track-order"
          className="min-h-11 inline-flex items-center justify-center px-6 py-3 bg-[#563568] text-white text-xs uppercase tracking-wider font-medium hover:bg-[#A184BD] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#563568] rounded-xs transition-colors"
        >
          Track an Order
        </Link>
      </div>
      <p className="text-xs text-[#6F6475]">
        Please do not send payment card details, passwords, or one-time passwords through any contact channel.
      </p>
    </div>
  </PolicyLayout>
);
