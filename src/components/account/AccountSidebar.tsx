/**
 * Premium Customer Account Navigation Sidebar for SARINE.
 * Inspired by modern Indian fine jewellery brands.
 * Features:
 * - Customer profile summary at the top
 * - MAIN MENU: Order History, Plan of Purchase, Wishlist, SARINE Wallet, Delivery Addresses
 * - OTHERS: SARINE Support Center, How to Earn, How to Redeem, FAQs, Privacy Policy
 * - Logout action with confirmation trigger at the bottom
 * - Accessible contrast, clear active states, and >= 44px touch targets
 */

import React from 'react';
import { User } from 'firebase/auth';
import {
  Package,
  Sparkles,
  Heart,
  Wallet,
  MapPin,
  HelpCircle,
  Gift,
  Coins,
  FileQuestion,
  ShieldCheck,
  LogOut,
  User as UserIcon,
  ChevronRight,
  Edit3
} from 'lucide-react';

export type AccountSection =
  | 'orders'
  | 'plan-of-purchase'
  | 'wishlist'
  | 'wallet'
  | 'addresses'
  | 'support'
  | 'how-to-earn'
  | 'how-to-redeem'
  | 'faqs'
  | 'privacy'
  | 'profile';

interface AccountSidebarProps {
  currentUser: User;
  activeSection: AccountSection;
  onSelectSection: (section: AccountSection) => void;
  onTriggerLogout: () => void;
  ordersCount: number;
  wishlistCount: number;
  addressesCount: number;
}

export const AccountSidebar: React.FC<AccountSidebarProps> = ({
  currentUser,
  activeSection,
  onSelectSection,
  onTriggerLogout,
  ordersCount,
  wishlistCount,
  addressesCount
}) => {
  const displayName = currentUser.displayName || currentUser.email?.split('@')[0] || 'Patron';
  const initial = (displayName || 'S')[0].toUpperCase();

  const mainMenuItems = [
    {
      id: 'orders' as AccountSection,
      label: 'Order History',
      description: 'View order details and track purchases',
      icon: Package,
      badge: ordersCount > 0 ? String(ordersCount) : undefined,
      badgeType: 'count' as const
    },
    {
      id: 'plan-of-purchase' as AccountSection,
      label: 'Plan of Purchase',
      description: 'Save monthly for your dream jewellery',
      icon: Sparkles,
      badge: 'Coming Soon',
      badgeType: 'status' as const
    },
    {
      id: 'wishlist' as AccountSection,
      label: 'Wishlist',
      description: 'All your favourite pieces',
      icon: Heart,
      badge: wishlistCount > 0 ? String(wishlistCount) : undefined,
      badgeType: 'count' as const
    },
    {
      id: 'wallet' as AccountSection,
      label: 'SARINE Wallet',
      description: 'Wallet balance, cashback and transactions',
      icon: Wallet,
      badge: 'Coming Soon',
      badgeType: 'status' as const
    },
    {
      id: 'addresses' as AccountSection,
      label: 'Delivery Addresses',
      description: 'Add, edit and delete your addresses',
      icon: MapPin,
      badge: addressesCount > 0 ? String(addressesCount) : undefined,
      badgeType: 'count' as const
    }
  ];

  const othersMenuItems = [
    {
      id: 'support' as AccountSection,
      label: 'SARINE Support Center',
      description: 'Concierge contact, hours & tickets',
      icon: HelpCircle
    },
    {
      id: 'how-to-earn' as AccountSection,
      label: 'How to Earn',
      description: 'Reward points, cashback & referrals',
      icon: Gift
    },
    {
      id: 'how-to-redeem' as AccountSection,
      label: 'How to Redeem',
      description: '1:1 Rupee valuation & checkout rules',
      icon: Coins
    },
    {
      id: 'faqs' as AccountSection,
      label: 'FAQs',
      description: 'Orders, hallmarking & jewellery care',
      icon: FileQuestion
    },
    {
      id: 'privacy' as AccountSection,
      label: 'Privacy Policy',
      description: 'Zero card retention guarantee',
      icon: ShieldCheck
    }
  ];

  return (
    <div className="bg-white border border-[#E7DCEB] rounded-xs shadow-xs overflow-hidden flex flex-col">
      {/* 1. TOP PROFILE SUMMARY CARD */}
      <div className="p-5 border-b border-[#E7DCEB] bg-gradient-to-br from-[#FAF5FC] to-white relative">
        <div className="flex items-center gap-3.5">
          {/* Avatar Initial */}
          <div className="relative shrink-0">
            <div className="w-12 h-12 rounded-full bg-[#563568] text-white flex items-center justify-center font-serif text-lg border-2 border-[#D9B8A0]/60 shadow-xs">
              {initial}
            </div>
            <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[#10B981] border-2 border-white" title="Active Session" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-1">
              <h2 className="font-serif text-sm sm:text-base text-[#302438] font-normal truncate">
                {displayName}
              </h2>
              <button
                type="button"
                onClick={() => onSelectSection('profile')}
                className="text-[11px] text-[#563568] hover:text-[#80609A] flex items-center gap-1 cursor-pointer p-1"
                title="Edit profile & preferences"
              >
                <Edit3 size={12} />
                <span className="hidden sm:inline">Edit</span>
              </button>
            </div>
            <p className="text-[11px] text-[#6F6475] truncate">{currentUser.email}</p>
            <div className="mt-1 flex items-center gap-2">
              <span className="inline-block text-[9px] uppercase tracking-wider px-2 py-0.5 bg-[#D9B8A0]/25 text-[#563568] font-bold rounded-xs border border-[#D9B8A0]/40">
                Atelier Patron
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. NAVIGATION MENUS */}
      <div className="p-2.5 space-y-4 flex-1">
        {/* MAIN MENU SECTION */}
        <div>
          <span className="px-3 text-[10px] uppercase tracking-[0.2em] font-semibold text-[#6F6475] block mb-1.5">
            Main Menu
          </span>
          <nav className="space-y-1">
            {mainMenuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectSection(item.id)}
                  className={`w-full min-h-[44px] flex items-center justify-between px-3 py-2.5 rounded-xs transition-all text-left cursor-pointer group ${
                    isActive
                      ? 'bg-[#563568] text-white shadow-xs'
                      : 'text-[#302438] hover:bg-[#FAF5FC] hover:text-[#563568]'
                  }`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    <Icon
                      size={17}
                      className={`shrink-0 transition-colors ${
                        isActive ? 'text-[#D9B8A0]' : 'text-[#563568] group-hover:text-[#563568]'
                      }`}
                    />
                    <div className="min-w-0">
                      <span className={`block text-xs font-medium truncate ${isActive ? 'text-white' : 'text-[#302438]'}`}>
                        {item.label}
                      </span>
                      <span
                        className={`block text-[10px] truncate ${
                          isActive ? 'text-white/75' : 'text-[#6F6475]'
                        }`}
                      >
                        {item.description}
                      </span>
                    </div>
                  </div>

                  {item.badge && (
                    <div className="shrink-0 pl-1">
                      {item.badgeType === 'status' ? (
                        <span
                          className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-xs ${
                            isActive
                              ? 'bg-white/20 text-white'
                              : 'bg-[#D9B8A0]/30 text-[#563568] border border-[#D9B8A0]/40'
                          }`}
                        >
                          {item.badge}
                        </span>
                      ) : (
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full min-w-[20px] text-center inline-block ${
                            isActive
                              ? 'bg-[#B69ACF] text-[#302438]'
                              : 'bg-[#E7DCEB] text-[#563568]'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* OTHERS SECTION */}
        <div>
          <span className="px-3 text-[10px] uppercase tracking-[0.2em] font-semibold text-[#6F6475] block mb-1.5 pt-2 border-t border-[#E7DCEB]">
            Others
          </span>
          <nav className="space-y-1">
            {othersMenuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectSection(item.id)}
                  className={`w-full min-h-[44px] flex items-center justify-between px-3 py-2.5 rounded-xs transition-all text-left cursor-pointer group ${
                    isActive
                      ? 'bg-[#563568] text-white shadow-xs'
                      : 'text-[#302438] hover:bg-[#FAF5FC] hover:text-[#563568]'
                  }`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    <Icon
                      size={17}
                      className={`shrink-0 transition-colors ${
                        isActive ? 'text-[#D9B8A0]' : 'text-[#6F6475] group-hover:text-[#563568]'
                      }`}
                    />
                    <div className="min-w-0">
                      <span className={`block text-xs font-medium truncate ${isActive ? 'text-white' : 'text-[#302438]'}`}>
                        {item.label}
                      </span>
                      <span
                        className={`block text-[10px] truncate ${
                          isActive ? 'text-white/75' : 'text-[#6F6475]'
                        }`}
                      >
                        {item.description}
                      </span>
                    </div>
                  </div>

                  <ChevronRight
                    size={14}
                    className={`shrink-0 transition-transform ${
                      isActive ? 'text-white' : 'text-[#E7DCEB] group-hover:text-[#563568] group-hover:translate-x-0.5'
                    }`}
                  />
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* 3. BOTTOM LOGOUT ACTION */}
      <div className="p-3 border-t border-[#E7DCEB] bg-[#FAF5FC]/40">
        <button
          type="button"
          onClick={onTriggerLogout}
          className="w-full min-h-[44px] flex items-center gap-3 px-3.5 py-2.5 text-[#DC2626] hover:bg-[#DC2626]/10 rounded-xs transition-colors cursor-pointer text-xs font-medium"
        >
          <LogOut size={16} className="shrink-0" />
          <span>Sign Out of Account</span>
        </button>
      </div>
    </div>
  );
};
