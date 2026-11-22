/**
 * Main application entry point for SARINE.
 * Configures React Router, CartProvider & WishlistProvider context wrappers,
 * global CartDrawer & WishlistDrawer, customer storefront routes, and extended atelier admin suite.
 */

import React, { lazy, Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { CartProvider } from './context/CartContext';
import { WishlistProvider } from './context/WishlistContext';
import { Navbar } from './components/Navbar';
import { ScrollToTop } from './components/ScrollToTop';
import { CartDrawer } from './components/CartDrawer';
import { WishlistDrawer } from './components/WishlistDrawer';
import { CustomerLoginPrompt } from './components/CustomerLoginPrompt';
import { Footer } from './components/Footer';
import { setPageMetadata } from './utils/seo';
import { hostingerStorefrontService } from './services/hostinger/hostingerStorefrontService';
const CmsPublicPage = lazy(() => import('./pages/CmsPublicPage').then((module) => ({ default: module.CmsPublicPage })));
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
const AdminActivityPage = lazy(() => import('./pages/admin/AdminActivityPage').then((module) => ({ default: module.AdminActivityPage })));
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
const SustainabilityPage = lazy(() => import('./pages/PolicyPlaceholders').then((module) => ({ default: module.SustainabilityPage })));
const BlogPage = lazy(() => import('./pages/PolicyPlaceholders').then((module) => ({ default: module.BlogPage })));
const CareersPage = lazy(() => import('./pages/PolicyPlaceholders').then((module) => ({ default: module.CareersPage })));
const CancellationPolicyPage = lazy(() => import('./pages/PolicyPlaceholders').then((module) => ({ default: module.CancellationPolicyPage })));


const ROUTE_METADATA: Record<string, { title: string; description: string }> = {
  '/': { title: 'SARINE | Luxury Artificial Jewellery', description: 'Discover contemporary artificial and fashion jewellery at SARINE, including necklaces, earrings, rings, bracelets and thoughtfully curated sets.' },
  '/shop': { title: 'Shop Jewellery | SARINE', description: 'Explore SARINE jewellery collections. Discover earrings, necklaces, bracelets, rings and more in contemporary styles for everyday wear and celebrations.' },
  '/bag': { title: 'Your Bag | SARINE', description: 'Review the jewellery pieces in your SARINE shopping bag.' },
  '/checkout': { title: 'Checkout | SARINE', description: 'Complete your SARINE order securely.' },
  '/account': { title: 'My Account | SARINE', description: 'Access your SARINE account, orders and saved details.' },
  '/track-order': { title: 'Track Your Order | SARINE', description: 'Check the latest available status of your SARINE order.' },
  '/contact': { title: 'Contact SARINE | Customer Support', description: 'Contact SARINE about an order, jewellery product, return or any other customer enquiry.' },
  '/about': { title: 'Our Story | SARINE', description: 'Learn about SARINE and our approach to contemporary, accessible jewellery for everyday moments and celebrations.' },
  '/privacy-policy': { title: 'Privacy Policy | SARINE', description: 'Read how SARINE handles personal information and customer data.' },
  '/terms': { title: 'Terms & Conditions | SARINE', description: 'Review the terms and conditions for using the SARINE online store.' },
  '/shipping-policy': { title: 'Shipping Policy | SARINE', description: 'Find information about SARINE shipping charges, delivery and order fulfilment.' },
  '/refund-policy': { title: 'Returns & Refunds | SARINE', description: 'Read SARINE guidance for returns, refunds and eligible order issues.' },
  '/cancellation-policy': { title: 'Cancellation Policy | SARINE', description: 'Review the SARINE order cancellation policy and available next steps.' },
  '/sustainability': { title: 'Sustainability | SARINE', description: 'Read about SARINE sustainability information and related updates.' },
  '/blog': { title: 'Journal | SARINE', description: 'Explore jewellery stories, styling ideas and updates from SARINE.' },
  '/careers': { title: 'Careers | SARINE', description: 'Explore career information and opportunities at SARINE.' },
};

function RouteMetadata() {
  const location = useLocation();

  useEffect(() => {
    const path = location.pathname;
    const isPrivateRoute = path.startsWith('/admin')
      || ['/bag', '/checkout', '/account', '/track-order'].includes(path)
      || path.startsWith('/order/');
    const metadata = ROUTE_METADATA[path]
      || (path.startsWith('/product/')
        ? { title: 'Jewellery Details | SARINE', description: 'Explore product details, styling information and availability from SARINE.' }
        : { title: 'SARINE | Luxury Artificial Jewellery', description: 'Discover contemporary artificial and fashion jewellery at SARINE.' });

    setPageMetadata({ ...metadata, robots: isPrivateRoute ? 'noindex, nofollow' : 'index, follow' });
  }, [location.pathname]);

  return null;
}

function MainAppShell() {
  const [includeAll, setIncludeAll] = useState<boolean>(false);
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith('/admin');

  // Apply only the published global design. Admin screens keep their dedicated workspace theme.
  useEffect(() => {
    let active = true;
    if (isAdminRoute) {
      document.body.classList.remove('sarine-global-theme');
      delete document.body.dataset.sarineButtonStyle;
      return () => { active = false; };
    }
    hostingerStorefrontService.getPublicGlobalDesign()
      .then(({ design }) => {
        if (!active || !design) return;
        const root = document.documentElement;
        root.style.setProperty('--sarine-global-primary', '#563568');
        root.style.setProperty('--sarine-global-accent', '#B8893C');
        root.style.setProperty('--sarine-global-surface', '#F7F4F8');
        root.style.setProperty('--sarine-global-page', '#FFFFFF');
        root.style.setProperty('--sarine-global-text', '#5C5660');
        root.style.setProperty('--sarine-global-header', design.colors.headerBackground);
        root.style.setProperty('--sarine-global-footer', design.colors.footerBackground);
        root.style.setProperty('--sarine-global-footer-text', design.colors.footerText);
        root.style.setProperty('--sarine-global-heading-font', '"Cormorant Garamond"');
        root.style.setProperty('--sarine-global-body-font', '"Plus Jakarta Sans"');
        root.style.setProperty('--sarine-global-heading-scale', String(design.typography.headingScale / 100));
        root.style.setProperty('--sarine-global-body-scale', String(design.typography.bodyScale / 100));
        root.style.setProperty('--sarine-global-content-width', design.layout.contentWidth + 'px');
        root.style.setProperty('--sarine-global-radius', design.layout.cornerRadius + 'px');
        document.body.dataset.sarineButtonStyle = design.components.buttonStyle;
        document.body.classList.add('sarine-global-theme');
      })
      .catch(error => console.warn('[SARINE] Published design settings unavailable; using built-in theme.', error));
    return () => {
      active = false;
      document.body.classList.remove('sarine-global-theme');
      delete document.body.dataset.sarineButtonStyle;
    };
  }, [isAdminRoute]);

  const handleToggleIncludeAll = () => {
    setIncludeAll((prev) => !prev);
  };

  return (
    <>
    <a href="#main-content" className="skip-link">Skip to main content</a>
    <RouteMetadata />
    <div className="min-h-screen w-full flex flex-col bg-white text-[#5C5660] selection:bg-[#563568]/15 selection:text-[#1D1B1F]">
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
      <div id="main-content" tabIndex={-1} className="flex-1 w-full">
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
          <Route path="/admin/storefront/*" element={<AdminStorefrontPage />} />
          <Route path="/pages/:slug" element={<CmsPublicPage />} />
          <Route path="/admin/carousel-features" element={<AdminCarouselFeaturesPage />} />
          <Route path="/admin/analytics" element={<AdminAnalyticsPage />} />
          <Route path="/admin/activity" element={<AdminActivityPage />} />
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
    </>
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
