/**
 * AdminLayout component for SARINE private admin area.
 * Provides private header with navigation, sign-out control,
 * and enforces noindex metadata for search engines.
 */

import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { getFirebaseAuth, isFirebaseConfigured } from '../../lib/firebase';
import { ShieldCheck, LogOut, Package, ExternalLink, AlertCircle, TrendingUp, Boxes, Settings } from 'lucide-react';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  // Enforce noindex for private admin views
  useEffect(() => {
    let metaTag = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
    let created = false;
    if (!metaTag) {
      metaTag = document.createElement('meta');
      metaTag.name = 'robots';
      document.head.appendChild(metaTag);
      created = true;
    }
    const previousContent = metaTag.content;
    metaTag.content = 'noindex, nofollow';

    return () => {
      if (created && metaTag) {
        metaTag.remove();
      } else if (metaTag) {
        metaTag.content = previousContent || '';
      }
    };
  }, []);

  // Listen to Firebase auth state
  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setLoading(false);
      return;
    }

    try {
      const auth = getFirebaseAuth();
      const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
        setUser(currentUser);
        setLoading(false);
        if (!currentUser && location.pathname !== '/admin/login') {
          navigate('/admin/login', { replace: true });
        }
      });
      return () => unsubscribe();
    } catch (e) {
      console.error('[AdminLayout] Auth initialization error:', e);
      setLoading(false);
    }
  }, [navigate, location.pathname]);

  const handleSignOut = async () => {
    try {
      const auth = getFirebaseAuth();
      await signOut(auth);
      navigate('/admin/login', { replace: true });
    } catch (err) {
      console.error('[AdminLayout] Sign out error:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F0FA] flex items-center justify-center p-6 text-xs text-[#6F6475]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-[#563568] border-t-transparent rounded-full animate-spin"></div>
          <span>Verifying admin authentication...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F0FA] text-[#302438] font-sans flex flex-col">
      {/* Admin Top Header */}
      <header className="bg-white border-b border-[#E7DCEB] sticky top-0 z-30 shadow-2xs">
        <div className="site-container">
          <div className="flex items-center justify-between h-16">
            {/* Brand / Admin identifier */}
            <div className="flex items-center gap-4 sm:gap-6">
              <Link to="/admin/orders" className="flex items-center gap-2">
                <span className="font-serif text-xl sm:text-2xl font-normal text-[#563568] tracking-wider">
                  SARINE
                </span>
                <span className="text-[10px] uppercase tracking-widest font-mono px-2 py-0.5 rounded-xs bg-[#FAF5FC] text-[#563568] border border-[#E7DCEB] font-medium">
                  Atelier Admin
                </span>
              </Link>

              {/* Navigation Tabs */}
              <nav className="flex items-center gap-1.5 sm:gap-2">
                <Link
                  to="/admin/orders"
                  className={`flex items-center gap-1.5 text-xs font-medium px-2.5 sm:px-3 py-1.5 rounded-xs transition-colors ${
                    location.pathname === '/admin/orders'
                      ? 'bg-[#563568] text-white'
                      : 'text-[#6F6475] hover:bg-[#FAF5FC] hover:text-[#563568]'
                  }`}
                >
                  <Package size={14} />
                  <span>Orders</span>
                </Link>
                <Link
                  to="/admin/analytics"
                  className={`flex items-center gap-1.5 text-xs font-medium px-2.5 sm:px-3 py-1.5 rounded-xs transition-colors ${
                    location.pathname === '/admin/analytics'
                      ? 'bg-[#563568] text-white'
                      : 'text-[#6F6475] hover:bg-[#FAF5FC] hover:text-[#563568]'
                  }`}
                >
                  <TrendingUp size={14} />
                  <span className="hidden sm:inline">Analytics</span>
                </Link>
                <Link
                  to="/admin/inventory"
                  className={`flex items-center gap-1.5 text-xs font-medium px-2.5 sm:px-3 py-1.5 rounded-xs transition-colors ${
                    location.pathname === '/admin/inventory'
                      ? 'bg-[#563568] text-white'
                      : 'text-[#6F6475] hover:bg-[#FAF5FC] hover:text-[#563568]'
                  }`}
                >
                  <Boxes size={14} />
                  <span className="hidden sm:inline">Inventory</span>
                </Link>
                <Link
                  to="/admin/settings"
                  className={`flex items-center gap-1.5 text-xs font-medium px-2.5 sm:px-3 py-1.5 rounded-xs transition-colors ${
                    location.pathname === '/admin/settings'
                      ? 'bg-[#563568] text-white'
                      : 'text-[#6F6475] hover:bg-[#FAF5FC] hover:text-[#563568]'
                  }`}
                >
                  <Settings size={14} />
                  <span className="hidden sm:inline">Settings</span>
                </Link>
              </nav>
            </div>

            {/* Right Side: Admin User & Sign Out */}
            <div className="flex items-center gap-3 sm:gap-4 text-xs">
              {user ? (
                <>
                  <div className="hidden sm:flex flex-col text-right">
                    <span className="text-[11px] font-medium text-[#302438] truncate max-w-[180px]">
                      {user.email}
                    </span>
                    <span className="text-[9px] uppercase tracking-wider text-[#6F6475]">
                      Authenticated Admin
                    </span>
                  </div>
                  <button
                    onClick={handleSignOut}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#E7DCEB] text-xs text-[#563568] hover:bg-[#FAF5FC] hover:border-[#563568] rounded-xs transition-colors cursor-pointer"
                    title="Sign Out"
                  >
                    <LogOut size={13} />
                    <span className="hidden sm:inline">Sign Out</span>
                  </button>
                </>
              ) : (
                <Link
                  to="/admin/login"
                  className="text-xs text-[#563568] font-medium hover:text-[#A184BD] transition-colors"
                >
                  Sign In
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Page Area */}
      <main className="flex-1 w-full py-8 sm:py-10">
        <div className="site-container">{children}</div>
      </main>
    </div>
  );
};
