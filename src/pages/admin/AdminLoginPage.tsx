/**
 * SARINE Admin Login
 * Authenticates administrators through the Hostinger API.
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminLogin, getAdminSession } from '../../lib/adminAuth';
import {
  Lock,
  Mail,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  X,
  KeyRound
} from 'lucide-react';

export const AdminLoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showResetModal, setShowResetModal] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    let active = true;

    const checkSession = async () => {
      const admin = await getAdminSession();

      if (active && admin) {
        navigate('/admin', { replace: true });
      }

      if (active) {
        setCheckingSession(false);
      }
    };

    void checkSession();

    return () => {
      active = false;
    };
  }, [navigate]);

  useEffect(() => {
    let metaTag = document.querySelector(
      'meta[name="robots"]'
    ) as HTMLMetaElement | null;

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
      if (created) {
        metaTag?.remove();
      } else if (metaTag) {
        metaTag.content = previousContent || '';
      }
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!email.trim() || !password) {
      setError('Please enter both email and password.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await adminLogin(email.trim(), password);
      navigate('/admin', { replace: true });
    } catch (err) {
      console.error('[AdminLogin] Authentication failure:', err);
      setError('Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F0FA] flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <span className="font-serif text-3xl sm:text-4xl text-[#563568] tracking-wider block">
            SARINE
          </span>
          <span className="text-[11px] uppercase tracking-[0.25em] text-[#6F6475] font-medium block mt-1">
            Private Atelier Console
          </span>
          <h2 className="mt-4 font-serif text-xl sm:text-2xl text-[#302438] font-normal">
            Store Management Sign In
          </h2>
          <p className="mt-1 text-xs text-[#6F6475]">
            Restricted to verified SARINE administrative personnel.
          </p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white py-8 px-6 sm:px-10 border border-[#E7DCEB] rounded-xs shadow-xs">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="admin-email"
                className="block text-xs uppercase tracking-wider text-[#302438] font-medium mb-1.5"
              >
                Admin Email Address
              </label>
              <div className="relative">
                <input
                  id="admin-email"
                  type="email"
                  required
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@sarinejewelry.com"
                  className="w-full pl-9 pr-3.5 py-2.5 bg-[#F7F0FA] border border-[#E7DCEB] text-xs text-[#302438] placeholder:text-[#9E90A2] rounded-xs focus:outline-none focus:border-[#B69ACF] focus:ring-1 focus:ring-[#80609A] transition-colors"
                />
                <Mail
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6F6475]"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="admin-password"
                className="block text-xs uppercase tracking-wider text-[#302438] font-medium mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="admin-password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-9 pr-3.5 py-2.5 bg-[#F7F0FA] border border-[#E7DCEB] text-xs text-[#302438] placeholder:text-[#9E90A2] rounded-xs focus:outline-none focus:border-[#B69ACF] focus:ring-1 focus:ring-[#80609A] transition-colors"
                />
                <Lock
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6F6475]"
                />
              </div>

              <div className="flex justify-end mt-1.5">
                <button
                  type="button"
                  onClick={() => setShowResetModal(true)}
                  className="text-[11px] text-[#563568] hover:text-[#78469C] hover:underline font-medium transition-colors cursor-pointer"
                >
                  Forgot Password?
                </button>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-[#FAF5FC] border border-[#E7DCEB] rounded-xs flex items-start gap-2 text-xs text-[#DC2626]">
                <AlertCircle size={15} className="shrink-0 mt-0.5" />
                <p>{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || checkingSession}
              className="w-full py-3 bg-[#563568] text-white text-xs font-medium uppercase tracking-[0.2em] hover:bg-[#78469C] transition-colors rounded-xl flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {checkingSession ? (
                <span>Checking session...</span>
              ) : loading ? (
                <span>Signing in...</span>
              ) : (
                <>
                  <span>Sign In to Atelier Workspace</span>
                  <ArrowRight size={13} />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-[#E7DCEB] flex items-center justify-center gap-2 text-[11px] text-[#6F6475]">
            <ShieldCheck size={13} className="text-[#563568]" />
            <span>Encrypted admin authorization session</span>
          </div>
        </div>
      </div>

      {showResetModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-modal-title"
        >
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-[#E7DCEB] relative">
            <div className="flex items-center justify-between pb-3 border-b border-[#E7DCEB]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#FAF5FC] border border-[#E7DCEB] flex items-center justify-center text-[#563568]">
                  <KeyRound size={16} />
                </div>
                <h3
                  id="reset-modal-title"
                  className="font-serif text-lg font-semibold text-[#2C1838]"
                >
                  Admin Password Assistance
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                className="text-[#8E769E] hover:text-[#2C1838] p-1 rounded-md transition-colors cursor-pointer"
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>

            <p className="mt-4 text-xs text-[#6F6475] leading-relaxed">
              Automated password reset is not yet configured for the
              Hostinger admin system. Please contact your system
              administrator to reset your password securely.
            </p>

            <div className="flex justify-end pt-5">
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                className="px-5 py-2 bg-[#563568] hover:bg-[#78469C] text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
