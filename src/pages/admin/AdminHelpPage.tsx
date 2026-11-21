import React from 'react';
import { Link } from 'react-router-dom';
import { AdminLayout } from '../../components/admin/AdminLayout';
import {
  BarChart3,
  Boxes,
  FileText,
  HelpCircle,
  MessageSquare,
  Package,
  Settings,
  ShoppingBag,
  Users
} from 'lucide-react';

const helpSections = [
  {
    title: 'Orders & fulfilment',
    description: 'Review new orders, check payment and fulfilment status, and update order progress.',
    to: '/admin/orders',
    action: 'Open orders',
    icon: ShoppingBag
  },
  {
    title: 'Products & catalogue',
    description: 'Manage product information, pricing, images, categories and publication status.',
    to: '/admin/products',
    action: 'Manage products',
    icon: Package
  },
  {
    title: 'Inventory',
    description: 'Review stock quantities and low-stock alerts for active products.',
    to: '/admin/inventory',
    action: 'Open inventory',
    icon: Boxes
  },
  {
    title: 'Customers',
    description: 'Find customer records and review the customer information available to administrators.',
    to: '/admin/customers',
    action: 'View customers',
    icon: Users
  },
  {
    title: 'Customer enquiries',
    description: 'Read contact-form messages, record internal notes and update enquiry status. Replies are not sent automatically.',
    to: '/admin/contact-inquiries',
    action: 'Open enquiries',
    icon: MessageSquare
  },
  {
    title: 'Storefront & content',
    description: 'Manage homepage sections, curated collections and storefront presentation.',
    to: '/admin/storefront',
    action: 'Open storefront studio',
    icon: FileText
  },
  {
    title: 'Analytics',
    description: 'Review store performance and the available reporting summaries.',
    to: '/admin/analytics',
    action: 'View analytics',
    icon: BarChart3
  },
  {
    title: 'Store settings',
    description: 'Review the store configuration and checkout-related settings.',
    to: '/admin/settings',
    action: 'Open settings',
    icon: Settings
  }
];

export const AdminHelpPage: React.FC = () => (
  <AdminLayout>
    <main className="min-h-screen bg-[#F8F3FA] p-4 sm:p-7 lg:p-9 space-y-6">
      <header>
        <p className="text-[10px] uppercase tracking-[0.22em] text-[#8E769E]">SARINE Atelier</p>
        <div className="mt-1 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#F0E6F5] text-[#563568]">
            <HelpCircle size={22} />
          </span>
          <div>
            <h1 className="font-serif text-3xl text-[#302438]">Admin Help Centre</h1>
            <p className="mt-1 text-xs text-[#705E7B]">Guidance and shortcuts for managing your SARINE store.</p>
          </div>
        </div>
      </header>

      <section className="rounded-xl border border-[#E7DCEB] bg-white p-5 sm:p-6">
        <h2 className="font-serif text-lg text-[#302438]">Getting started</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-xs leading-relaxed text-[#62556A]">
          <li>Use the dashboard to review current store activity and important alerts.</li>
          <li>Check orders regularly and update fulfilment status only after the corresponding action is completed.</li>
          <li>Keep product details, prices, images and inventory accurate before publishing changes.</li>
          <li>Review customer enquiries and record follow-up notes. The enquiry panel does not send replies automatically.</li>
        </ol>
      </section>

      <section>
        <div className="mb-3">
          <h2 className="font-serif text-xl text-[#302438]">Help by area</h2>
          <p className="mt-1 text-xs text-[#8E769E]">Open the relevant admin section for step-by-step controls and current records.</p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {helpSections.map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.title} className="rounded-xl border border-[#E7DCEB] bg-white p-4">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#F7F0FA] text-[#704A83]">
                  <Icon size={17} />
                </span>
                <h3 className="mt-3 text-sm font-semibold text-[#302438]">{item.title}</h3>
                <p className="mt-1 min-h-[3.25rem] text-xs leading-relaxed text-[#766A7D]">{item.description}</p>
                <Link to={item.to} className="mt-3 inline-flex min-h-10 items-center text-xs font-semibold text-[#563568] underline-offset-4 hover:underline">
                  {item.action} →
                </Link>
              </article>
            );
          })}
        </div>
      </section>

      <section className="rounded-xl border border-[#E7DCEB] bg-[#FAF5FC] p-5">
        <h2 className="text-sm font-semibold text-[#563568]">Need assistance?</h2>
        <p className="mt-2 text-xs leading-relaxed text-[#705E7B]">
          No verified administrator support email or phone number is currently configured in the store. To avoid directing you to an unverified contact, this page does not display a made-up support address. For customer messages submitted through the storefront, use the Customer Enquiries inbox.
        </p>
        <Link to="/admin/contact-inquiries" className="mt-3 inline-flex min-h-11 items-center rounded-lg bg-[#563568] px-4 text-xs font-medium text-white hover:bg-[#704A83]">
          Open Customer Enquiries
        </Link>
      </section>
    </main>
  </AdminLayout>
);
