import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CustomerAuthPanel } from "../components/CustomerAuthPanel";
import { customerAuthService } from "../services/customerAuthService";
import type { CustomerIdentity } from "../types/customer";

export const AccountPage: React.FC = () => {
  const [customer, setCustomer] = useState<CustomerIdentity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    customerAuthService.getSession().then(session => { if (active) setCustomer(session); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const handleAuthenticated = useCallback((identity: CustomerIdentity) => {
    setCustomer(identity);
    setError("");
  }, []);

  const handleLogout = async () => {
    setError("");
    try { await customerAuthService.logout(); setCustomer(null); }
    catch (err) { setError(err instanceof Error ? err.message : "Unable to sign out. Please try again."); }
  };

  if (loading) return <main className="min-h-[60vh] flex items-center justify-center bg-[#F7F0FA] text-[#563568]">Loading your SARINE account…</main>;

  return (
    <main className="min-h-screen bg-[#F7F0FA] text-[#302438] font-sans py-12 sm:py-16">
      <div className="site-container max-w-5xl">
        <div className="max-w-2xl mx-auto text-center mb-10">
          <span className="block text-[10px] uppercase tracking-[0.25em] text-[#6F6475] font-medium mb-2">YOUR SARINE SPACE</span>
          <h1 className="font-serif text-3xl sm:text-4xl font-normal">My Account</h1>
          <p className="mt-3 text-sm text-[#6F6475]">Your orders, details and moments with SARINE — all in one place.</p>
        </div>
        <section className="max-w-xl mx-auto bg-white border border-[#E7DCEB] shadow-sm p-6 sm:p-10">
          {customer ? (
            <div className="text-center">
              <div className="mx-auto mb-4 w-14 h-14 rounded-full bg-[#F0E6F4] flex items-center justify-center text-[#563568] text-xl font-serif">{customer.name.trim().charAt(0).toUpperCase()}</div>
              <h2 className="font-serif text-2xl text-[#563568]">Welcome, {customer.name}</h2>
              <p className="mt-2 text-sm text-[#6F6475]">{customer.email || customer.phone}</p>
              {customer.email && customer.phone && <p className="mt-1 text-xs text-[#8A7B90]">{customer.phone}</p>}
              {error && <p role="alert" className="mt-4 p-3 bg-red-50 border border-red-200 text-sm text-red-700">{error}</p>}
              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                <Link to="/track-order" className="min-h-12 flex items-center justify-center bg-[#563568] text-white text-sm hover:bg-[#6E4682] transition-colors">Track an Order</Link>
                <button type="button" onClick={handleLogout} className="min-h-12 border border-[#D9B8A0] text-[#563568] text-sm hover:bg-[#FAF5FC]">Sign Out</button>
              </div>
            </div>
          ) : (
            <CustomerAuthPanel onAuthenticated={handleAuthenticated} />
          )}
        </section>
        <p className="mt-6 text-center text-xs text-[#6F6475]">Need help? <Link to="/contact" className="text-[#563568] underline">Contact SARINE</Link></p>
      </div>
    </main>
  );
};
