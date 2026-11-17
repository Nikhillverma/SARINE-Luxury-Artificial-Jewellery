import React, { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { X } from "lucide-react";
import { CustomerAuthPanel } from "./CustomerAuthPanel";
import { customerAuthService } from "../services/customerAuthService";
import type { CustomerIdentity } from "../types/customer";

const DISMISSED_KEY = "sarine_login_prompt_dismissed";

export const CustomerLoginPrompt: React.FC = () => {
  const location = useLocation();
  const [visible, setVisible] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;
    customerAuthService.getSession().then(customer => {
      if (!active || customer) return;
      let dismissed = false;
      try { dismissed = window.sessionStorage.getItem(DISMISSED_KEY) === "1"; } catch { /* session storage may be unavailable */ }
      if (!dismissed && location.pathname !== "/account" && !location.pathname.startsWith("/admin")) {
        window.setTimeout(() => { if (active) setVisible(true); }, 1100);
      }
    }).finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!visible) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") dismiss(); };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [visible]);

  const dismiss = () => {
    try { window.sessionStorage.setItem(DISMISSED_KEY, "1"); } catch { /* best effort */ }
    setVisible(false);
  };
  const handleAuthenticated = useCallback((_customer: CustomerIdentity) => {
    setVisible(false);
  }, []);

  if (checking || !visible || location.pathname === "/account" || location.pathname.startsWith("/admin")) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#21172A]/55 backdrop-blur-[2px] px-3 py-5 sm:px-6" onMouseDown={event => { if (event.target === event.currentTarget) dismiss(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="sarine-login-title" className="relative w-full max-w-md max-h-[92vh] overflow-y-auto bg-[#FFFCFF] border border-[#D9B8A0]/60 shadow-2xl p-5 sm:p-8">
        <button type="button" onClick={dismiss} aria-label="Close sign-in popup" className="absolute right-3 top-3 w-10 h-10 flex items-center justify-center text-[#8A7B90] hover:text-[#563568]"><X size={19} /></button>
        <div id="sarine-login-title" className="sr-only">Welcome to SARINE</div>
        <CustomerAuthPanel onAuthenticated={handleAuthenticated} onSkip={dismiss} compact />
      </section>
    </div>
  );
};
