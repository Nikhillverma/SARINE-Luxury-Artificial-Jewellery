/**
 * FAQs Section for SARINE Customer Account.
 * Categorized, searchable accordions covering:
 * - Orders & Tracking
 * - Payments & Razorpay
 * - Shipping & Delivery
 * - Cancellations
 * - Returns & Exchanges
 * - Refunds
 * - Jewellery Care & Hallmarking
 * - Account & Security
 */

import React, { useState, useMemo } from 'react';
import { Search, ChevronDown, ChevronUp, HelpCircle, Package, CreditCard, Truck, RotateCcw, ShieldCheck, Sparkles, AlertCircle } from 'lucide-react';

interface FaqItem {
  q: string;
  a: string;
}

interface FaqCategory {
  id: string;
  name: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  items: FaqItem[];
}

const FAQ_DATA: FaqCategory[] = [
  {
    id: 'orders',
    name: 'Orders & Tracking',
    icon: Package,
    items: [
      {
        q: 'How do I track my SARINE order?',
        a: 'You can track your order in real-time under the "My Orders" tab by clicking "Track" on any order card. You can also use our public Track Order page by entering your order number (e.g., SAR-000108) and 10-digit mobile number.'
      },
      {
        q: 'How long does order processing take before dispatch?',
        a: 'Orders are meticulously verified, quality-inspected, and packed in tamper-evident velvet boxes within 24 to 48 business hours from our atelier studio.'
      },
      {
        q: 'Can I change my delivery address after placing an order?',
        a: 'If your order has not yet been marked "Shipped", please reach out to our concierge team immediately at +91 98765 43210 or care@sarinejewelry.com to update your delivery address.'
      }
    ]
  },
  {
    id: 'payments',
    name: 'Payments & Razorpay',
    icon: CreditCard,
    items: [
      {
        q: 'What payment options are available?',
        a: 'We accept all major Indian payment methods through our secure Razorpay gateway: UPI (Google Pay, PhonePe, Paytm, BHIM), Credit/Debit Cards (Visa, Mastercard, RuPay), NetBanking (over 50 Indian banks), and Cash on Delivery (COD) for eligible pin codes.'
      },
      {
        q: 'Is my online payment information secure?',
        a: 'Yes, 100%. All card and UPI transactions are handled directly through Razorpay with RBI-mandated 256-bit encryption. SARINE never sees or stores your debit/credit card numbers or CVVs.'
      },
      {
        q: 'How does Cash on Delivery (COD) work?',
        a: 'For COD orders, you pay the exact invoice amount in cash or via delivery-agent UPI upon receiving the parcel at your doorstep. Please ensure someone is available at the address with the exact payment.'
      }
    ]
  },
  {
    id: 'shipping',
    name: 'Shipping & Delivery',
    icon: Truck,
    items: [
      {
        q: 'What are the delivery charges?',
        a: 'We offer complimentary express shipping across all serviceable Indian pin codes on orders of ₹999 and above. For orders below ₹999, a nominal flat shipping fee of ₹99 is applied.'
      },
      {
        q: 'Which courier partners handle SARINE deliveries?',
        a: 'All shipments are dispatched exclusively via premium logistics partners including Blue Dart, Delhivery, and Xpressbees with tamper-evident serial-sealed packaging and transit insurance.'
      },
      {
        q: 'How many days will delivery take to reach me?',
        a: 'Metro cities typically receive parcels within 2 to 4 business days post-dispatch. Other regional locations and tier-2/tier-3 cities typically arrive in 4 to 6 business days.'
      }
    ]
  },
  {
    id: 'cancellations',
    name: 'Cancellations',
    icon: AlertCircle,
    items: [
      {
        q: 'Can I cancel my order after placement?',
        a: 'Yes. You can cancel your order directly from the "My Orders" section of your customer account as long as its status is "Placed", "Pending", or "Confirmed" (prior to courier dispatch).'
      },
      {
        q: 'What happens to my payment when I cancel a prepaid order?',
        a: 'For prepaid online orders, cancelling immediately initiates an automated refund to your original payment method. The refund is processed within 5 to 7 banking days.'
      }
    ]
  },
  {
    id: 'returns',
    name: 'Returns & Exchanges',
    icon: RotateCcw,
    items: [
      {
        q: 'What is the SARINE 7-Day Guarantee?',
        a: 'Every delivered jewellery piece comes with a 7-day hassle-free return and exchange window from the date of confirmed delivery. If you are not delighted with your piece, you can request an exchange or full refund.'
      },
      {
        q: 'How do I initiate a return or exchange?',
        a: 'Go to "My Orders", find your delivered order, click "View Details", and choose "Request Return / Exchange". Select your reason and preferred action. Our concierge will schedule a complimentary doorstep pickup.'
      },
      {
        q: 'What condition must the returned jewellery be in?',
        a: 'Jewellery pieces must be unworn, undamaged, with the security tag intact and presented in the original velvet SARINE jewelry box.'
      }
    ]
  },
  {
    id: 'refunds',
    name: 'Refunds & Timelines',
    icon: ShieldCheck,
    items: [
      {
        q: 'How are refunds credited for prepaid orders?',
        a: 'Refunds are automatically issued to the original source bank account, credit card, or UPI VPA used during checkout via Razorpay within 5 to 7 working days of return pickup and inspection.'
      },
      {
        q: 'How are refunds processed for Cash on Delivery (COD) orders?',
        a: 'For COD returns, our customer concierge contacts you to gather your preferred NEFT/IMPS bank details or UPI ID for direct transfer, or you can opt for instant store credit.'
      }
    ]
  },
  {
    id: 'care',
    name: 'Jewellery Care & Hallmarking',
    icon: Sparkles,
    items: [
      {
        q: 'Are SARINE silver pieces authentic and hallmarked?',
        a: 'Yes, every SARINE piece is crafted in genuine 925 sterling silver, stamped with the official 925 hallmark stamp, and certified for purity and lead/nickel-free hypoallergenic wear.'
      },
      {
        q: 'How do I care for my demi-fine jewellery to avoid tarnishing?',
        a: 'All pieces feature an anti-tarnish protective e-coating. To ensure longevity, avoid direct contact with perfumes, hairsprays, and harsh chemicals. Store each piece in the provided airtight pouch when not worn.'
      }
    ]
  },
  {
    id: 'security',
    name: 'Account & Security',
    icon: ShieldCheck,
    items: [
      {
        q: 'How is my account data secured?',
        a: 'Your account is authenticated via Google Firebase with token encryption. All customer order queries are isolated and authorized server-side so no visitor or other customer can ever see your details.'
      },
      {
        q: 'How do I change my password or update my name?',
        a: 'You can update your profile name anytime under the "My Profile" section. For password changes or account assistance, our concierge is available 6 days a week.'
      }
    ]
  }
];

export const FaqsSection: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategoryId, setActiveCategoryId] = useState('orders');
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({
    'orders-0': true // Open first item by default
  });

  const toggleItem = (key: string) => {
    setOpenItems((prev) => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Filter items across categories when searching
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) {
      return FAQ_DATA;
    }
    const q = searchQuery.toLowerCase().trim();
    return FAQ_DATA.map((cat) => ({
      ...cat,
      items: cat.items.filter(
        (item) => item.q.toLowerCase().includes(q) || item.a.toLowerCase().includes(q)
      )
    })).filter((cat) => cat.items.length > 0);
  }, [searchQuery]);

  return (
    <div className="bg-white p-6 sm:p-8 border border-[#E7DCEB] rounded-xs shadow-xs space-y-6 animate-fadeIn">
      {/* Header */}
      <div>
        <h3 className="font-serif text-xl sm:text-2xl text-[#302438]">Frequently Asked Questions</h3>
        <p className="text-xs sm:text-sm text-[#6F6475] mt-1 leading-relaxed">
          Quick, transparent answers regarding orders, delivery, hallmarking, and atelier policies.
        </p>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6F6475]" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search questions by topic (e.g. returns, 925 hallmark, delivery charges, COD)..."
          className="w-full min-h-[44px] pl-10 pr-4 py-2.5 bg-[#F7F0FA] border border-[#E7DCEB] focus:border-[#563568] rounded-xs text-xs focus:outline-none"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-[#6F6475] hover:text-[#302438] cursor-pointer"
          >
            Clear
          </button>
        )}
      </div>

      {/* Category Tabs (shown when not searching) */}
      {!searchQuery && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none border-b border-[#E7DCEB]">
          {FAQ_DATA.map((cat) => {
            const Icon = cat.icon;
            const isActive = activeCategoryId === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategoryId(cat.id)}
                className={`min-h-[44px] px-3.5 py-2 rounded-xs text-xs font-medium whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-[#563568] text-white shadow-xs'
                    : 'bg-[#F7F0FA] text-[#302438] hover:bg-[#E7DCEB] hover:text-[#563568]'
                }`}
              >
                <Icon size={13} />
                <span>{cat.name}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* FAQ Accordion List */}
      <div className="space-y-4">
        {filteredCategories.length === 0 ? (
          <div className="p-8 border border-[#E7DCEB] rounded-xs text-center space-y-2 bg-[#FAF5FC]/40">
            <HelpCircle size={24} className="mx-auto text-[#B69ACF]" />
            <h4 className="font-serif text-sm text-[#302438]">No matching answers found</h4>
            <p className="text-xs text-[#6F6475]">
              Try searching with another keyword or reach out directly to our concierge team.
            </p>
          </div>
        ) : (
          filteredCategories
            .filter((cat) => searchQuery || cat.id === activeCategoryId)
            .map((cat) => (
              <div key={cat.id} className="space-y-2">
                {searchQuery && (
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-[#563568] pt-2">
                    {cat.name}
                  </h4>
                )}
                {cat.items.map((item, idx) => {
                  const itemKey = `${cat.id}-${idx}`;
                  const isOpen = Boolean(openItems[itemKey]);
                  return (
                    <div
                      key={itemKey}
                      className="border border-[#E7DCEB] rounded-xs overflow-hidden transition-colors bg-white"
                    >
                      <button
                        type="button"
                        onClick={() => toggleItem(itemKey)}
                        className="w-full min-h-[44px] px-4 py-3 text-left flex items-center justify-between gap-3 text-xs font-medium text-[#302438] hover:bg-[#FAF5FC] transition-colors cursor-pointer"
                        aria-expanded={isOpen}
                      >
                        <span className="font-semibold text-[#302438]">{item.q}</span>
                        {isOpen ? (
                          <ChevronUp size={15} className="text-[#563568] shrink-0" />
                        ) : (
                          <ChevronDown size={15} className="text-[#6F6475] shrink-0" />
                        )}
                      </button>
                      {isOpen && (
                        <div className="px-4 pb-3.5 pt-1 text-xs text-[#6F6475] leading-relaxed border-t border-[#E7DCEB]/50 bg-[#FAF5FC]/30">
                          {item.a}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))
        )}
      </div>
    </div>
  );
};
