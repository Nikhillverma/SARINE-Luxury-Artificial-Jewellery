/**
 * Main application entry point for SARINE.
 * Configures React Router, CartProvider & WishlistProvider context wrappers,
 * global CartDrawer & WishlistDrawer, customer storefront routes, and extended atelier admin suite.
 */

import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { CartProvider } from './context/CartContext';
import { WishlistProvider } from './context/WishlistContext';
import { Navbar } from './components/Navbar';
import { ScrollToTop } from './components/ScrollToTop';
import { CartDrawer } from './components/CartDrawer';
import { WishlistDrawer } from './components/WishlistDrawer';
import { Footer } from './components/Footer';
import { HomePage } from './pages/HomePage';
import { CollectionPage } from './pages/CollectionPage';
import { ProductDetailPage } from './pages/ProductDetailPage';
import { BagPage } from './pages/BagPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { OrderConfirmationPage } from './pages/OrderConfirmationPage';
import { ContactPage } from './pages/ContactPage';
import { PrivacyPolicyPage } from './pages/PrivacyPolicyPage';
import { TermsPage } from './pages/TermsPage';
import { ShippingPolicyPage } from './pages/ShippingPolicyPage';
import { RefundPolicyPage } from './pages/RefundPolicyPage';
import { AboutPage } from './pages/AboutPage';
import { TrackOrderPage } from './pages/TrackOrderPage';
import { AccountPage } from './pages/AccountPage';
import { AdminLoginPage } from './pages/admin/AdminLoginPage';
import { AdminOrdersPage } from './pages/admin/AdminOrdersPage';
import { AdminAnalyticsPage } from './pages/admin/AdminAnalyticsPage';
import { AdminInventoryPage } from './pages/admin/AdminInventoryPage';
import { AdminSettingsPage } from './pages/admin/AdminSettingsPage';
import {
  SustainabilityPage,
  BlogPage,
  CareersPage,
  CancellationPolicyPage
} from './pages/PolicyPlaceholders';

function MainAppShell() {
  const [includeAll, setIncludeAll] = useState<boolean>(false);
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith('/admin');

  const handleToggleIncludeAll = () => {
    setIncludeAll((prev) => !prev);
  };

  return (
    <div className="min-h-screen w-full flex flex-col bg-[#F7F0FA] text-[#302438] selection:bg-[#B69ACF]/30 selection:text-[#302438]">
      {/* Public Storefront Navigation & Slide-in Drawers */}
      {!isAdminRoute && (
        <>
          <Navbar
            includeAll={includeAll}
            onToggleIncludeAll={handleToggleIncludeAll}
          />
          <CartDrawer />
          <WishlistDrawer />
        </>
      )}

      {/* Main Route View */}
      <div className="flex-1 w-full">
        <Routes>
          <Route
            path="/"
            element={<HomePage includeAll={includeAll} />}
          />
          <Route
            path="/shop"
            element={<CollectionPage includeAll={includeAll} />}
          />
          <Route
            path="/product/:slug"
            element={<ProductDetailPage includeAll={includeAll} />}
          />
          <Route path="/bag" element={<BagPage />} />
          <Route path="/cart" element={<Navigate to="/bag" replace />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/order/:orderNumber" element={<OrderConfirmationPage />} />
          <Route path="/track-order" element={<TrackOrderPage />} />
          <Route path="/account" element={<AccountPage />} />

          {/* Private Admin Management Routes */}
          <Route path="/admin" element={<Navigate to="/admin/orders" replace />} />
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route path="/admin/orders" element={<AdminOrdersPage />} />
          <Route path="/admin/analytics" element={<AdminAnalyticsPage />} />
          <Route path="/admin/inventory" element={<AdminInventoryPage />} />
          <Route path="/admin/settings" element={<AdminSettingsPage />} />

          {/* Help & Policies */}
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/shipping-policy" element={<ShippingPolicyPage />} />
          <Route path="/refund-policy" element={<RefundPolicyPage />} />
          <Route path="/cancellation-policy" element={<CancellationPolicyPage />} />

          {/* About & Brand Info */}
          <Route path="/about" element={<AboutPage />} />
          <Route path="/sustainability" element={<SustainabilityPage />} />
          <Route path="/blog" element={<BlogPage />} />
          <Route path="/careers" element={<CareersPage />} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>

      {/* Public Storefront Footer */}
      {!isAdminRoute && <Footer />}
    </div>
  );
}

export default function App() {
  return (
    <WishlistProvider>
      <CartProvider>
        <BrowserRouter>
          <ScrollToTop />
          <MainAppShell />
        </BrowserRouter>
      </CartProvider>
    </WishlistProvider>
  );
}
