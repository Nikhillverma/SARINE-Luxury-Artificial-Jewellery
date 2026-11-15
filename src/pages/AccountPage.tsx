import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { customerAuthService } from "../services/customerAuthService";
import type { CustomerIdentity } from "../types/customer";

type AuthMode = "signin" | "signup";

export const AccountPage: React.FC = () => {
  const navigate = useNavigate();
  const [customer, setCustomer] = useState<CustomerIdentity | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<AuthMode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    customerAuthService.getSession().then((session) => {
      if (active) setCustomer(session);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const result = mode === "signin"
        ? await customerAuthService.login(email.trim(), password)
        : await customerAuthService.register(name.trim(), email.trim(), password);
      setCustomer(result);
      setPassword("");
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to access your account. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    setError("");
    try {
      await customerAuthService.logout();
      setCustomer(null);
      setMode("signin");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign out. Please try again.");
    }
  };

  if (loading) {
    return <main className="min-h-[60vh] flex items-center justify-center bg-[#F7F0FA] text-[#563568]">Loading your SARINE account…</main>;
  }

  return (
    <main className="min-h-screen bg-[#F7F0FA] text-[#302438] font-sans py-12 sm:py-16">
      <div className="site-container max-w-4xl">
        <div className="max-w-2xl mx-auto text-center mb-10">
          <span className="block text-[10px] uppercase tracking-[0.25em] text-[#6F6475] font-medium mb-2">YOUR SARINE SPACE</span>
          <h1 className="font-serif text-3xl sm:text-4xl font-normal">My Account</h1>
          <p className="mt-3 text-sm text-[#6F6475]">Sign in or create an account to access your SARINE customer space.</p>
        </div>

        <section className="max-w-md mx-auto bg-white border border-[#E7DCEB] shadow-xs p-6 sm:p-9">
          {customer ? (
            <div className="text-center">
              <div className="mx-auto mb-4 w-14 h-14 rounded-full bg-[#F0E6F4] flex items-center justify-center text-[#563568] text-xl font-serif">
                {customer.name.trim().charAt(0).toUpperCase()}
              </div>
              <h2 className="font-serif text-2xl">Welcome, {customer.name}</h2>
              <p className="mt-2 text-sm text-[#6F6475]">{customer.email}</p>
              <div className="mt-7 grid gap-3">
                <Link to="/track-order" className="min-h-12 flex items-center justify-center bg-[#563568] text-white text-sm hover:bg-[#6E4682] transition-colors">Track an Order</Link>
                <button type="button" onClick={handleLogout} className="min-h-12 border border-[#D9B8A0] text-[#563568] text-sm hover:bg-[#FAF5FC]">Sign Out</button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex border-b border-[#E7DCEB] mb-6">
                <button type="button" onClick={() => { setMode("signin"); setError(""); }} className={`flex-1 min-h-11 text-sm border-b-2 ${mode === "signin" ? "border-[#563568] text-[#563568] font-semibold" : "border-transparent text-[#6F6475]"}`}>Sign In</button>
                <button type="button" onClick={() => { setMode("signup"); setError(""); }} className={`flex-1 min-h-11 text-sm border-b-2 ${mode === "signup" ? "border-[#563568] text-[#563568] font-semibold" : "border-transparent text-[#6F6475]"}`}>Create Account</button>
              </div>
              {error && <p role="alert" className="mb-4 p-3 bg-red-50 border border-red-200 text-sm text-red-700">{error}</p>}
              <form onSubmit={handleSubmit} className="space-y-4">
                {mode === "signup" && (
                  <label className="block text-xs text-[#6F6475]">Full Name
                    <input required autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} className="mt-1 w-full min-h-11 px-3 border border-[#E7DCEB] bg-[#F7F0FA] text-sm text-[#302438] focus:outline-none focus:border-[#563568]" />
                  </label>
                )}
                <label className="block text-xs text-[#6F6475]">Email Address
                  <input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1 w-full min-h-11 px-3 border border-[#E7DCEB] bg-[#F7F0FA] text-sm text-[#302438] focus:outline-none focus:border-[#563568]" />
                </label>
                <label className="block text-xs text-[#6F6475]">Password
                  <input required type="password" minLength={8} autoComplete={mode === "signin" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1 w-full min-h-11 px-3 border border-[#E7DCEB] bg-[#F7F0FA] text-sm text-[#302438] focus:outline-none focus:border-[#563568]" />
                  {mode === "signup" && <span className="block mt-1 text-[11px] text-[#8A7B90]">Use at least 8 characters.</span>}
                </label>
                <button type="submit" disabled={submitting} className="w-full min-h-12 bg-[#563568] text-white text-sm font-medium hover:bg-[#6E4682] disabled:opacity-60">
                  {submitting ? "Please wait…" : mode === "signin" ? "Sign In" : "Create Account"}
                </button>
              </form>
              <p className="mt-5 text-center text-[11px] text-[#8A7B90]">Your customer account is securely managed by SARINE.</p>
            </>
          )}
        </section>
        <p className="mt-6 text-center text-xs text-[#6F6475]">Need help? <Link to="/contact" className="text-[#563568] underline">Contact SARINE</Link></p>
      </div>
    </main>
  );
};
