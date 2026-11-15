import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Headphones, Package, ShieldCheck, ShoppingBag } from 'lucide-react';

export const AccountPage: React.FC = () => (
  <main className="min-h-screen bg-[#F7F0FA] text-[#302438] font-sans py-12 sm:py-16">
    <div className="site-container max-w-4xl">
      <div className="max-w-2xl mx-auto text-center mb-10">
        <span className="block text-[10px] uppercase tracking-[0.25em] text-[#6F6475] font-medium mb-2">YOUR SARINE SPACE</span>
        <h1 className="font-serif text-3xl sm:text-4xl text-[#302438] font-normal">My Account & Orders</h1>
        <p className="mt-3 text-sm text-[#6F6475] leading-relaxed">Find your order details and delivery updates in one place.</p>
      </div>
      <section className="max-w-2xl mx-auto bg-white border border-[#E7DCEB] shadow-xs p-6 sm:p-9">
        <div className="flex items-start gap-3 mb-5">
          <div className="p-2.5 bg-[#F0E6F4] text-[#563568] shrink-0"><ShieldCheck size={21} /></div>
          <div>
            <h2 className="font-medium text-base text-[#302438]">Guest checkout is available</h2>
            <p className="mt-1 text-xs sm:text-sm text-[#6F6475] leading-relaxed">
              You do not need to create an account to shop with SARINE. To securely view an order, use the order number and mobile number entered at checkout.
            </p>
          </div>
        </div>
        <Link to="/track-order" className="w-full min-h-12 flex items-center justify-between gap-4 px-5 py-3 bg-[#563568] text-white hover:bg-[#6E4682] transition-colors">
          <span className="flex items-center gap-3">
            <Package size={18} />
            <span>
              <span className="block text-sm font-medium">Track My Order</span>
              <span className="block text-[11px] text-white/75 mt-0.5">Check shipment status and delivery progress</span>
            </span>
          </span>
          <ArrowRight size={17} />
        </Link>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
          <Link to="/shop" className="min-h-11 flex items-center justify-center gap-2 border border-[#D9B8A0] text-[#563568] hover:bg-[#FAF5FC] transition-colors text-xs font-medium">
            <ShoppingBag size={15} /> Continue Shopping
          </Link>
          <Link to="/contact" className="min-h-11 flex items-center justify-center gap-2 border border-[#E7DCEB] text-[#563568] hover:bg-[#FAF5FC] transition-colors text-xs font-medium">
            <Headphones size={15} /> Help & Support
          </Link>
        </div>
        <p className="mt-6 pt-4 border-t border-[#E7DCEB] text-[11px] text-[#8A7B90] leading-relaxed text-center">
          Order lookup is protected by your order reference and checkout mobile number. Customer sign-in is not enabled yet.
        </p>
      </section>
    </div>
  </main>
);
