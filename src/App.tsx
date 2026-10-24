/**
 * Main application entry point for SARINE.
 * Configures React Router, CartProvider context wrapper, global CartDrawer,
 * and storefront route mappings.
 */

import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { CartProvider } from './context/CartContext';
import { Navbar } from './components/Navbar';
import { CartDrawer } from './components/CartDrawer';
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
import {
  SustainabilityPage,
  BlogPage,
  CareersPage,
  CancellationPolicyPage
} from './pages/PolicyPlaceholders';

export default function App() {
  const [includeAll, setIncludeAll] = useState<boolean>(false);

  const handleToggleIncludeAll = () => {
    setIncludeAll((prev) => !prev);
  };

  return (
    <CartProvider>
      <BrowserRouter>
        <div className="min-h-screen w-full flex flex-col bg-[#F7F0FA] text-[#302438] selection:bg-[#B69ACF]/30 selection:text-[#302438]">
          {/* Header Navigation */}
          <Navbar
            includeAll={includeAll}
            onToggleIncludeAll={handleToggleIncludeAll}
          />

          {/* Global Slide-in Cart Drawer */}
          <CartDrawer />

          {/* Storefront Routes */}
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

          {/* Global Footer */}
          <Footer />
        </div>
      </BrowserRouter>
    </CartProvider>
  );
}
