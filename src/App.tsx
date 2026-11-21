/**
 * Main application entry point for SARINE.
 * Configures React Router, CartProvider & WishlistProvider context wrappers,
 * global CartDrawer & WishlistDrawer, customer storefront routes, and extended atelier admin suite.
 */

import React, { lazy, Suspense, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { CartProvider } from './context/CartContext';
import { WishlistProvider } from './context/WishlistContext';
import { Navbar } from './components/Navbar';
import { ScrollToTop } from './components/ScrollToTop';
import { CartDrawer } from './components/CartDrawer';
import { WishlistDrawer } from './components/WishlistDrawer';
import { CustomerLoginPrompt } from './components/CustomerLoginPrompt';
import { Footer } from './components/Footer';
const HomePage = lazy(() => import('./pages/HomePage').then((module) => ({ default: module.HomePage })));
const CollectionPage = lazy(() => import('./pages/CollectionPage').then((module) => ({ default: module.CollectionPage })));
const ProductDetailPage = lazy(() => import('./pages/ProductDetailPage').then((module) => ({ default: module.ProductDetailPage })));
const BagPage = lazy(() => import('./pages/BagPage').then((module) => ({ default: module.BagPage })));
const CheckoutPage = lazy(() => import('./pages/CheckoutPage').then((module) => ({ default: module.CheckoutPage })));
const OrderConfirmationPage = lazy(() => import('./pages/OrderConfirmationPage').then((module) => ({ default: module.OrderConfirmationPage })));
const ContactPage = lazy(() => import('./pages/ContactPage').then((module) => ({ default: module.ContactPage })));
const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage').then((module) => ({ default: module.PrivacyPolicyPage })));
const TermsPage = lazy(() => import('./pages/TermsPage').then((module) => ({ default: module.TermsPage })));
const ShippingPolicyPage = lazy(() => import('./pages/ShippingPolicyPage').then((module) => ({ default: module.ShippingPolicyPage })));
const RefundPolicyPage = lazy(() => import('./pages/RefundPolicyPage').then((module) => ({ default: module.RefundPolicyPage })));
const AboutPage = lazy(() => import('./pages/AboutPage').then((module) => ({ default: module.AboutPage })));
const TrackOrderPage = lazy(() => import('./pages/TrackOrderPage').then((module) => ({ default: module.TrackOrderPage })));
const AccountPage = lazy(() => import('./pages/AccountPage').then((module) => ({ default: module.AccountPage })));
const AdminDashboardPage = lazy(() => import('./pages/admin/AdminDashboardPage').then((module) => ({ default: module.AdminDashboardPage })));
const AdminHelpPage = lazy(() => import('./pages/admin/AdminHelpPage').then((module) => ({ default: module.AdminHelpPage })));
const AdminAnalyticsPage = lazy(() => import('./pages/admin/AdminAnalyticsPage').then((module) => ({ default: module.AdminAnalyticsPage })));
const AdminLoginPage = lazy(() => import('./pages/admin/AdminLoginPage').then((module) => ({ default: module.AdminLoginPage })));
const AdminProductsPage = lazy(() => import('./pages/admin/AdminProductsPage').then((module) => ({ default: module.AdminProductsPage })));
const AdminProductPreviewPage = lazy(() => import('./pages/admin/AdminProductPreviewPage').then((module) => ({ default: module.AdminProductPreviewPage })));
const AdminCategoriesPage = lazy(() => import('./pages/admin/AdminCategoriesPage').then((module) => ({ default: module.AdminCategoriesPage })));
const AdminOrdersPage = lazy(() => import('./pages/admin/AdminOrdersPage').then((module) => ({ default: module.AdminOrdersPage })));
const AdminCustomersPage = lazy(() => import('./pages/admin/AdminCustomersPage').then((module) => ({ default: module.AdminCustomersPage })));
const AdminReturnsPage = lazy(() => import('./pages/admin/AdminReturnsPage').then((module) => ({ default: module.AdminReturnsPage })));
const AdminContactInquiriesPage = lazy(() => import('./pages/admin/AdminContactInquiriesPage').then((module) => ({ default: module.AdminContactInquiriesPage })));
const AdminReviewsPage = lazy(() => import('./pages/admin/AdminReviewsPage').then((module) => ({ default: module.AdminReviewsPage })));
const AdminInventoryPage = lazy(() => import('./pages/admin/AdminInventoryPage').then((module) => ({ default: module.AdminInventoryPage })));
const AdminStorefrontPage = lazy(() => import('./pages/admin/AdminStorefrontPage').then((module) => ({ default: module.AdminStorefrontPage })));
const AdminCarouselFeaturesPage = lazy(() => import('./pages/admin/AdminCarouselFeaturesPage').then((module) => ({ default: module.AdminCarouselFeaturesPage })));
const AdminSettingsPage = lazy(() => import('./pages/admin/AdminSettingsPage').then((module) => ({ default: module.AdminSettingsPage })));
const AdminMarketingPage = lazy(() => import('./pages/admin/AdminMarketingPage').then((module) => ({ default: module.AdminMarketingPage })));
const AdminCampaignsPage = lazy(() => import('./pages/admin/AdminCampaignsPage').then((module) => ({ default: module.AdminCampaignsPage })));
c

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
          <CustomerLoginPrompt />
        </>
      )}

      {/* Main Route View */}
      <div className="flex-1 w-full">
        <Suspense fallback={<div className="flex min-h-[50vh] items-center justify-center px-6 text-sm text-[#563568]" role="status" aria-live="polite">Loading SARINE…</div>}>
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
          <Route path="/admin" element={<AdminDashboardPage />} />
          <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
          <Route path="/admin/help" element={<AdminHelpPage />} />
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route path="/admin/products" element={<AdminProductsPage />} />
          <Route path="/admin/products/:id/preview" element={<AdminProductPreviewPage />} />
          <Route path="/admin/categories" element={<AdminCategoriesPage />} />
          <Route path="/admin/orders" element={<AdminOrdersPage />} />
          <Route path="/admin/inventory" element={<AdminInventoryPage />} />
          <Route path="/admin/customers" element={<AdminCustomersPage />} />
          <Route path="/admin/returns" element={<AdminReturnsPage />} />
          <Route path="/admin/contact-inquiries" element={<AdminContactInquiriesPage />} />
          <Route path="/admin/reviews" element={<AdminReviewsPage />} />
          <Route path="/admin/marketing" element={<AdminMarketingPage />} />
          <Route path="/admin/campaigns" element={<AdminCampaignsPage />} />
          <Route path="/admin/storefront" element={<AdminStorefrontPage />} />
          <Route path="/admin/carousel-features" element={<AdminCarouselFeaturesPage />} />
          <Route path="/admin/analytics" element={<AdminAnalyticsPage />} />
          <Route path="/admin/copilot" element={<Navigate to="/admin" replace />} />
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
        </Suspense>
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
