/**
 * Main application entry point for SARINE.
 * Configures React Router, CartProvider context wrapper, global CartDrawer,
 * and storefront route mappings (/shop, /product/:slug, /bag, /checkout, /order/:orderNumber).
 */

import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { CartProvider } from './context/CartContext';
import { Navbar } from './components/Navbar';
import { CartDrawer } from './components/CartDrawer';
import { Footer } from './components/Footer';
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

export default function App() {
  const [includeAll, setIncludeAll] = useState<boolean>(false);

  const handleToggleIncludeAll = () => {
    setIncludeAll((prev) => !prev);
  };

  return (
    <CartProvider>
      <BrowserRouter>
        <div className="min-h-screen flex flex-col bg-[#FAF8F5] text-[#1C1917] selection:bg-[#B89758]/20 selection:text-[#1C1917]">
          {/* Header Navigation */}
          <Navbar
            includeAll={includeAll}
            onToggleIncludeAll={handleToggleIncludeAll}
          />

          {/* Global Slide-in Cart Drawer */}
          <CartDrawer />

          {/* Storefront Routes */}
          <div className="flex-1">
            <Routes>
              <Route
                path="/"
                element={<CollectionPage includeAll={includeAll} />}
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
              {/* Help & Policies */}
              <Route path="/contact" element={<ContactPage />} />
              <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
              <Route path="/terms" element={<TermsPage />} />
              <Route path="/shipping-policy" element={<ShippingPolicyPage />} />
              <Route path="/refund-policy" element={<RefundPolicyPage />} />
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
