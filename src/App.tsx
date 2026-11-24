/**
 * Main application entry point for SARINE.
 * Configures React Router, CartProvider & WishlistProvider context wrappers,
 * global CartDrawer & WishlistDrawer, customer storefront routes, and extended atelier admin suite.
 */

import React, { lazy, Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { CartProvider } from './context/CartContext';
import { WishlistProvider } from './context/WishlistContext';
import { Navbar } from './components/Navbar';
import { ScrollToTop } from './components/ScrollToTop';
import { CartDrawer } from './components/CartDrawer';
import { WishlistDrawer } from './components/WishlistDrawer';
import { CustomerLoginPrompt } from './components/CustomerLoginPrompt';
import { Footer } from './components/Footer';
import { setPageMetadata } from './utils/seo';
import { hostingerStorefrontService, type GlobalDesignSettings } from './services/hostinger/hostingerStorefrontService';

/** Approved font catalogue. The v1 API currently supports only six of these names. */
export const ALLOWED_FONTS = [
  'Cormorant Garamond',
  'Plus Jakarta Sans',
  'Playfair Display',
  'DM Sans',
  'Lato',
  'Montserrat',
  'Poppins',
  'Inter',
  'Roboto',
  'Georgia',
  'Arial'
] as const;

type AllowedFont = (typeof ALLOWED_FONTS)[number];
type ValidatedPublishedDesign = {
  version: 1;
  colors: Partial<GlobalDesignSettings['colors']>;
  typography: Partial<GlobalDesignSettings['typography']>;
  layout: Partial<GlobalDesignSettings['layout']>;
  components: Partial<GlobalDesignSettings['components']>;
};

const PUBLISHED_DESIGN_CACHE_KEY = 'sarine:published-global-design:v1';

const RUNTIME_DESIGN_PROPERTIES = [
  '--plum',
  '--gold',
  '--heading',
  '--button-primary-background',
  '--button-primary-hover',
  '--card-background',
  '--page-background',
  '--header-background',
  '--footer-background',
  '--footer-text',
  '--font-heading-family',
  '--font-heading-scale',
  '--font-body-family',
  '--font-body-scale',
  '--container-max-width',
  '--design-corner-radius',
  '--sarine-global-primary',
  '--sarine-global-accent',
  '--sarine-global-surface',
  '--sarine-global-page',
  '--sarine-global-text',
  '--sarine-global-header',
  '--sarine-global-footer',
  '--sarine-global-footer-text',
  '--sarine-global-heading-font',
  '--sarine-global-body-font',
  '--sarine-global-heading-scale',
  '--sarine-global-body-scale',
  '--sarine-global-content-width',
  '--sarine-global-radius'
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);
}

function isAllowedFont(value: unknown): value is AllowedFont {
  return typeof value === 'string' && (ALLOWED_FONTS as readonly string[]).includes(value);
}

function isV1HeadingFont(value: unknown): value is GlobalDesignSettings['typography']['headingFont'] {
  return isAllowedFont(value)
    && (value === 'Cormorant Garamond' || value === 'Georgia' || value === 'Playfair Display');
}

function isV1BodyFont(value: unknown): value is GlobalDesignSettings['typography']['bodyFont'] {
  return isAllowedFont(value)
    && (value === 'Plus Jakarta Sans' || value === 'Arial' || value === 'DM Sans');
}

function isValidScale(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 70 && value <= 150;
}

function validatePublishedDesign(value: unknown): ValidatedPublishedDesign | null {
  if (!isRecord(value) || value.version !== 1) return null;

  const sourceColors = isRecord(value.colors) ? value.colors : {};
  const sourceTypography = isRecord(value.typography) ? value.typography : {};
  const sourceLayout = isRecord(value.layout) ? value.layout : {};
  const sourceComponents = isRecord(value.components) ? value.components : {};

  const validated: ValidatedPublishedDesign = {
    version: 1,
    colors: {},
    typography: {},
    layout: {},
    components: {}
  };

  if (isHexColor(sourceColors.primary)) validated.colors.primary = sourceColors.primary;
  if (isHexColor(sourceColors.accent)) validated.colors.accent = sourceColors.accent;
  if (isHexColor(sourceColors.surface)) validated.colors.surface = sourceColors.surface;
  if (isHexColor(sourceColors.pageBackground)) validated.colors.pageBackground = sourceColors.pageBackground;
  if (isHexColor(sourceColors.text)) validated.colors.text = sourceColors.text;
  if (isHexColor(sourceColors.headerBackground)) validated.colors.headerBackground = sourceColors.headerBackground;
  if (isHexColor(sourceColors.footerBackground)) validated.colors.footerBackground = sourceColors.footerBackground;
  if (isHexColor(sourceColors.footerText)) validated.colors.footerText = sourceColors.footerText;

  if (isV1HeadingFont(sourceTypography.headingFont)) validated.typography.headingFont = sourceTypography.headingFont;
  if (isV1BodyFont(sourceTypography.bodyFont)) validated.typography.bodyFont = sourceTypography.bodyFont;
  if (isValidScale(sourceTypography.headingScale)) validated.typography.headingScale = sourceTypography.headingScale;
  if (isValidScale(sourceTypography.bodyScale)) validated.typography.bodyScale = sourceTypography.bodyScale;

  if ([1120, 1200, 1280, 1360].includes(sourceLayout.contentWidth as number)) {
    validated.layout.contentWidth = sourceLayout.contentWidth as GlobalDesignSettings['layout']['contentWidth'];
  }
  if ([0, 4, 8, 16].includes(sourceLayout.cornerRadius as number)) {
    validated.layout.cornerRadius = sourceLayout.cornerRadius as GlobalDesignSettings['layout']['cornerRadius'];
  }
  if (sourceComponents.buttonStyle === 'solid' || sourceComponents.buttonStyle === 'outline') {
    validated.components.buttonStyle = sourceComponents.buttonStyle;
  }

  const hasValidField = Object.values(validated).some(
    section => typeof section === 'object' && Object.keys(section).length > 0
  );
  return hasValidField ? validated : null;
}

function clearPublishedDesignOverrides(removeCache = false): void {
  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    RUNTIME_DESIGN_PROPERTIES.forEach(property => root.style.removeProperty(property));
    document.body.classList.remove('sarine-global-theme');
    delete document.body.dataset.sarineButtonStyle;
  }
  if (removeCache && typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(PUBLISHED_DESIGN_CACHE_KEY);
    } catch {
      // Storage can be unavailable in restricted browser contexts.
    }
  }
}

function applyValidatedPublishedDesign(design: ValidatedPublishedDesign): void {
  const root = document.documentElement;
  const { colors, typography, layout, components } = design;

  // Published colour controls update only their matching semantic tokens.
  if (colors.primary) {
    root.style.setProperty('--plum', colors.primary);
    root.style.setProperty('--button-primary-background', colors.primary);
  }
  if (colors.accent) {
    root.style.setProperty('--gold', colors.accent);
    root.style.setProperty('--button-primary-hover', colors.accent);
  }
  if (colors.surface) root.style.setProperty('--card-background', colors.surface);
  if (colors.pageBackground) root.style.setProperty('--page-background', colors.pageBackground);
  if (colors.headerBackground) root.style.setProperty('--header-background', colors.headerBackground);
  if (colors.footerBackground) root.style.setProperty('--footer-background', colors.footerBackground);
  if (colors.footerText) root.style.setProperty('--footer-text', colors.footerText);
  if (colors.text) root.style.setProperty('--heading', colors.text);

  // v1 font names only; system fallbacks remain available and no fonts are loaded here.
  if (typography.headingFont) {
    root.style.setProperty('--font-heading-family', '"' + typography.headingFont + '", Georgia, serif');
  }
  if (typography.bodyFont) {
    root.style.setProperty('--font-body-family', '"' + typography.bodyFont + '", system-ui, sans-serif');
  }
  if (typography.headingScale !== undefined) {
    root.style.setProperty('--font-heading-scale', String(typography.headingScale / 100));
  }
  if (typography.bodyScale !== undefined) {
    root.style.setProperty('--font-body-scale', String(typography.bodyScale / 100));
  }

  if (layout.contentWidth !== undefined) {
    root.style.setProperty('--container-max-width', layout.contentWidth + 'px');
  }
  if (layout.cornerRadius !== undefined) {
    root.style.setProperty('--design-corner-radius', layout.cornerRadius + 'px');
  }

  // Keep the complete legacy variable surface as aliases to the semantic tokens.
  root.style.setProperty('--sarine-global-primary', 'var(--plum)');
  root.style.setProperty('--sarine-global-accent', 'var(--gold)');
  root.style.setProperty('--sarine-global-surface', 'var(--card-background)');
  root.style.setProperty('--sarine-global-page', 'var(--page-background)');
  root.style.setProperty('--sarine-global-text', 'var(--heading)');
  root.style.setProperty('--sarine-global-header', 'var(--header-background)');
  root.style.setProperty('--sarine-global-footer', 'var(--footer-background)');
  root.style.setProperty('--sarine-global-footer-text', 'var(--footer-text)');
  root.style.setProperty('--sarine-global-heading-font', 'var(--font-heading-family)');
  root.style.setProperty('--sarine-global-body-font', 'var(--font-body-family)');
  root.style.setProperty('--sarine-global-heading-scale', 'var(--font-heading-scale)');
  root.style.setProperty('--sarine-global-body-scale', 'var(--font-body-scale)');
  root.style.setProperty('--sarine-global-content-width', 'var(--container-max-width)');
  root.style.setProperty('--sarine-global-radius', 'var(--design-corner-radius, 8px)');

  delete document.body.dataset.sarineButtonStyle;
  if (components.buttonStyle) document.body.dataset.sarineButtonStyle = components.buttonStyle;
  document.body.classList.add('sarine-global-theme');
}

function applyCachedPublishedDesignBeforeRender(): void {
  if (typeof window === 'undefined') return;
  if (window.location.pathname.startsWith('/admin')) {
    clearPublishedDesignOverrides();
    return;
  }
  try {
    const cached = window.localStorage.getItem(PUBLISHED_DESIGN_CACHE_KEY);
    if (!cached) return;
    const validated = validatePublishedDesign(JSON.parse(cached) as unknown);
    if (!validated) {
      window.localStorage.removeItem(PUBLISHED_DESIGN_CACHE_KEY);
      return;
    }
    applyValidatedPublishedDesign(validated);
  } catch {
    clearPublishedDesignOverrides(true);
  }
}

// Apply only a previously validated published object before React's first render.
applyCachedPublishedDesignBeforeRender();

const CmsPublicPage = lazy(() => import('./pages/CmsPublicPage').then((module) => ({ default: module.CmsPublicPage })));
const HomePage = lazy(() => import('./pages/HomePage').then((module) => ({ default: module.HomePage })));
const CollectionPage = lazy(() => import('./pages/CollectionPage').then((module) => ({ default: module.CollectionPage })));
const MensCollectionPage = lazy(() => import('./pages/MensCollectionPage').then((module) => ({ default: module.MensCollectionPage })));
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
    const isKnownRoute = Object.prototype.hasOwnProperty.call(ROUTE_METADATA, path)
      || path.startsWith('/product/')
      || path.startsWith('/pages/')
      || path.startsWith('/order/');
    const isPrivateRoute = path.startsWith('/admin')
      || ['/bag', '/checkout', '/account', '/track-order'].includes(path)
      || path.startsWith('/order/')
      || !isKnownRoute;
    const metadata = ROUTE_METADATA[path]
      || (path.startsWith('/product/')
        ? { title: 'Jewellery Details | SARINE', description: 'Explore product details, styling information and availability from SARINE.' }
        : path.startsWith('/pages/')
          ? { title: 'SARINE | Editorial Page', description: 'Explore published stories and information from SARINE.' }
          : { title: 'Page Not Found | SARINE', description: 'The page you requested could not be found on SARINE.' });

    setPageMetadata({ ...metadata, robots: isPrivateRoute ? 'noindex, nofollow' : 'index, follow' });
  }, [location.pathname]);

  return null;
}

function NotFoundPage() {
  return (
    <main className="min-h-[60vh] flex items-center justify-center px-4 py-20 text-center">
      <div className="max-w-xl">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--body)]">404 · Page not found</p>
        <h1 className="mt-4 font-serif text-3xl sm:text-4xl font-normal text-[var(--heading)]">This page could not be found</h1>
        <p className="mt-4 text-sm leading-relaxed text-[var(--body)]">The link may be outdated or the page may have moved. You can return to the SARINE homepage and continue exploring.</p>
        <Link to="/" className="mt-8 inline-flex min-h-11 items-center justify-center bg-[var(--plum)] px-6 py-3 text-xs font-semibold uppercase tracking-wider text-white transition-opacity hover:opacity-90">
          Return to SARINE
        </Link>
      </div>
    </main>
  );
}

function MainAppShell() {
  const [includeAll, setIncludeAll] = useState<boolean>(false);
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith('/admin');

  // Apply only validated published design settings. Admin screens keep their own theme.
  useEffect(() => {
    let active = true;

    if (isAdminRoute) {
      clearPublishedDesignOverrides();
      return () => { active = false; };
    }

    const controller = new AbortController();
    let timedOut = false;
    const timeoutId = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 8000);
    const clearRequestTimer = () => window.clearTimeout(timeoutId);

    hostingerStorefrontService.getPublicGlobalDesign({ signal: controller.signal })
      .then(({ design }) => {
        clearRequestTimer();
        if (!active || timedOut) return;
        const validated = validatePublishedDesign(design);
        if (!validated) {
          clearPublishedDesignOverrides(true);
          console.warn('[SARINE] Published design response was invalid; using tokens.css defaults.');
          return;
        }

        // Remove stale cached overrides first so invalid/missing fields fall back to tokens.css.
        clearPublishedDesignOverrides();
        applyValidatedPublishedDesign(validated);
        try {
          // Store only the normalized, validated v1 design object.
          window.localStorage.setItem(PUBLISHED_DESIGN_CACHE_KEY, JSON.stringify(validated));
        } catch {
          // A storage failure must not prevent the validated design from being applied.
        }
      })
      .catch(error => {
        clearRequestTimer();
        if (!active) return;
        if (timedOut) {
          console.warn('[SARINE] Published design request timed out after 8000 ms; keeping the current design.');
          return;
        }
        clearPublishedDesignOverrides(true);
        console.warn('[SARINE] Published design settings unavailable; using tokens.css defaults.', error);
      });

    return () => {
      active = false;
      clearPublishedDesignOverrides();
      clearRequestTimer();
      controller.abort();
    };
  }, [isAdminRoute]);

  const handleToggleIncludeAll = () => {
    setIncludeAll((prev) => !prev);
  };

  return (
    <>
    <a href="#main-content" className="skip-link">Skip to main content</a>
    <RouteMetadata />
    <div className="min-h-screen w-full flex flex-col bg-white text-[var(--plum)] selection:bg-[var(--gold-light)] selection:text-[var(--plum)]">
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
        <Suspense fallback={<div className="flex min-h-[50vh] items-center justify-center px-6 text-sm text-[var(--plum)]" role="status" aria-live="polite">Loading SARINE…</div>}>
        <Routes>
          <Route
            path="/"
            element={<HomePage includeAll={includeAll} />}
          />
          <Route
            path="/shop"
            element={<CollectionPage includeAll={includeAll} />}
          />
          <Route path="/men" element={<MensCollectionPage />} />
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

          {/* Unknown URLs receive a real 404 page and noindex metadata. */}
          <Route path="*" element={<NotFoundPage />} />
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
