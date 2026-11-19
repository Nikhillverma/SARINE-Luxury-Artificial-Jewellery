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
    customerAuthService.getSession().then(customer => {
      if (!active || customer) return;
      let dismissed = false;
      try { dismissed = window.sessionStorage.getItem(DISMISSED_KEY) === "1"; } catch { /* session storage may be unavailable */ }
      if (!dismissed && location.pathname !== "/account" && !location.pathname.startsWith("/admin")) {
        timer = window.setTimeout(() => { if (active) setVisible(true); }, 1400);
      }
    }).finally(() => { if (active) setChecking(false); });
    return () => { active = false; if (timer !== undefined) window.clearTimeout(timer); };
  }, []);

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
    <aside aria-label="SARINE account sign-in" className="fixed bottom-4 right-3 sm:bottom-6 sm:right-6 z-[100] w-[calc(100%-1.5rem)] max-w-[390px]">
      {!expanded ? (
        <div className="relative flex items-center gap-3 border border-[#D9B8A0]/70 bg-[#FFFCFF] px-4 py-3 shadow-xl">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-[#F7F0FA] text-[#563568]"><Sparkles size={18}/></div>
          <div className="min-w-0 flex-1">
            <p className="font-serif text-base text-[#563568]">A little more personal?</p>
            <p className="mt-0.5 text-[11px] leading-snug text-[#6F6475]">Sign in to keep your SARINE moments and orders together.</p>
            <button type="button" onClick={() => setExpanded(true)} className="mt-2 text-xs font-semibold text-[#563568] underline underline-offset-4">Sign in or create an account</button>
          </div>
          <button type="button" onClick={dismiss} aria-label="Dismiss sign-in prompt" className="absolute right-1 top-1 flex h-9 w-9 items-center justify-center text-[#8A7B90] hover:text-[#563568]"><X size={16}/></button>
        </div>
      ) : (
        <section aria-label="Sign in to SARINE" className="relative max-h-[82vh] overflow-y-auto border border-[#D9B8A0]/70 bg-[#FFFCFF] p-4 shadow-2xl sm:p-6">
          <button type="button" onClick={() => setExpanded(false)} aria-label="Minimise sign-in panel" className="absolute right-2 top-2 z-10 flex h-9 w-9 items-center justify-center text-[#8A7B90] hover:text-[#563568]"><X size={17}/></button>
          <CustomerAuthPanel onAuthenticated={handleAuthenticated} onSkip={dismiss} compact />
        </section>
      )}
    </aside>
  );
};
