import React, { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { X, Sparkles } from "lucide-react";
import { CustomerAuthPanel } from "./CustomerAuthPanel";
import { customerAuthService } from "../services/customerAuthService";
import type { CustomerIdentity } from "../types/customer";

const DISMISSED_KEY = "sarine_login_prompt_dismissed";

export const CustomerLoginPrompt: React.FC = () => {
  const location = useLocation();
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;
    let timer: number | undefined;
    setVisible(false);
    setExpanded(false);
    setChecking(true);
    customerAuthService.getSession().then(customer => {
      if (!active || customer) return;
      let dismissed = false;
      try { dismissed = window.sessionStorage.getItem(DISMISSED_KEY) === "1"; } catch { /* session storage may be unavailable */ }
      if (!dismissed && location.pathname !== "/account" && !location.pathname.startsWith("/admin")) {
        timer = window.setTimeout(() => { if (active) setVisible(true); }, 20000);
      }
    }).finally(() => { if (active) setChecking(false); });
    return () => { active = false; if (timer !== undefined) window.clearTimeout(timer); };
  }, [location.pathname]);

  useEffect(() => {
    if (!visible || !expanded) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setExpanded(false); };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [visible, expanded]);

  const dismiss = () => {
    try { window.sessionStorage.setItem(DISMISSED_KEY, "1"); } catch { /* best effort */ }
    setVisible(false);
    setExpanded(false);
  };
  const handleAuthenticated = useCallback((_customer: CustomerIdentity) => {
    setVisible(false);
    setExpanded(false);
  }, []);

  if (checking || !visible || location.pathname === "/account" || location.pathname.startsWith("/admin")) return null;

  return (
    <aside aria-label="SARINE account sign-in" className="fixed bottom-4 right-3 sm:bottom-6 sm:right-6 z-[100] w-[min(20rem,calc(100vw-1.5rem))] max-w-[320px]">
      {!expanded ? (
        <div className="relative flex items-center gap-3 border border-[var(--gold)] bg-[#FBF7F2] px-4 py-3 shadow-xl">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-[#F4ECE4] text-[#4A1D5C]"><Sparkles size={18}/></div>
          <div className="min-w-0 flex-1">
            <p className="font-serif text-base text-[#2B1A33]">A little more personal?</p>
            <p className="mt-0.5 text-[12px] leading-snug text-[#5A4F5E]">Sign in to keep your SARINE moments and orders together.</p>
            <button type="button" onClick={() => setExpanded(true)} className="mt-2 inline-flex min-h-11 items-center rounded-[6px] bg-[#4A1D5C] px-3 text-xs font-semibold text-white transition-colors hover:bg-[#B8893C] hover:text-[#2B1A33]">Sign in or create an account</button>
          </div>
          <button type="button" onClick={dismiss} aria-label="Dismiss sign-in prompt" className="absolute right-1 top-1 flex h-11 w-11 items-center justify-center text-[#5A4F5E] hover:text-[#4A1D5C]"><X size={16}/></button>
        </div>
      ) : (
        <section aria-label="Sign in to SARINE" className="relative max-h-[70vh] overflow-y-auto border border-[var(--gold)] bg-[#FBF7F2] p-4 shadow-2xl sm:p-5">
          <button type="button" onClick={() => setExpanded(false)} aria-label="Minimise sign-in panel" className="absolute right-2 top-2 z-10 flex h-11 w-11 items-center justify-center text-[#5A4F5E] hover:text-[#4A1D5C]"><X size={17}/></button>
          <CustomerAuthPanel onAuthenticated={handleAuthenticated} onSkip={dismiss} compact />
        </section>
      )}
    </aside>
  );
};
