import React, { useState } from "react";
import { customerAuthService } from "../services/customerAuthService";
import type { CustomerIdentity } from "../types/customer";

interface Props { customer: CustomerIdentity; onUpdated: (customer: CustomerIdentity) => void; }

export const CustomerIdentityLink: React.FC<Props> = ({ customer, onUpdated }) => {
  const availableMethods = (["email", "phone"] as const).filter(method => !customer[method]);
  const [method, setMethod] = useState<"email" | "phone">(availableMethods[0] || "email");
  const [identifier, setIdentifier] = useState("");
  const [otp, setOtp] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  if (!availableMethods.length) return null;

  const send = async () => {
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await customerAuthService.requestIdentityLink(method, identifier.trim());
      if (result.alreadyLinked) {
        setNotice("This contact is already verified on your account.");
        return;
      }
      setChallengeId(result.challengeId || "");
      setOtp("");
      setSent(true);
      setNotice("A verification code has been sent. Enter it below to link this contact to your account.");
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to send a verification code."); }
    finally { setBusy(false); }
  };

  const verify = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true); setError(""); setNotice("");
    try {
      const updated = await customerAuthService.verifyIdentityLink(challengeId, otp);
      onUpdated(updated);
      setSent(false); setChallengeId(""); setIdentifier(""); setOtp("");
      setNotice("Your contact has been verified and linked securely.");
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to verify this contact."); }
    finally { setBusy(false); }
  };

  return (
    <section className="mt-7 border-t border-[#E7DCEB] pt-6 text-left">
      <h3 className="font-serif text-lg text-[#563568]">Account contact details</h3>
      <p className="text-xs text-[#6F6475] mt-1">Add a second sign-in option by verifying that you own the contact. Existing accounts are never merged or reassigned automatically.</p>
      <div className="grid grid-cols-2 gap-2 mt-4">
        {availableMethods.map(item => <button key={item} type="button" onClick={() => { setMethod(item); setSent(false); setIdentifier(""); setOtp(""); setError(""); setNotice(""); }} className={`min-h-10 border text-xs ${method === item ? "border-[#563568] bg-[#F7F0FA] text-[#563568]" : "border-[#E7DCEB] text-[#6F6475]"}`}>Add {item === "email" ? "email" : "mobile"}</button>)}
      </div>
      {!sent ? (
        <div className="mt-3 space-y-3">
          <label className="block text-xs text-[#6F6475]">{method === "email" ? "Email address" : "Mobile number"}
            <input required type={method === "email" ? "email" : "tel"} value={identifier} onChange={event => setIdentifier(event.target.value)} placeholder={method === "email" ? "you@example.com" : "10-digit mobile number"} className="mt-1 w-full min-h-11 px-3 border border-[#E7DCEB] bg-white text-sm text-[#302438] outline-none focus:border-[#563568]"/>
          </label>
          <button type="button" disabled={busy || !identifier.trim()} onClick={send} className="w-full min-h-11 bg-[#563568] text-white text-xs disabled:opacity-50">{busy ? "Sending…" : "Verify & add contact"}</button>
        </div>
      ) : (
        <form onSubmit={verify} className="mt-3 space-y-3">
          <label className="block text-xs text-[#6F6475]">6-digit verification code
            <input required inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={otp} onChange={event => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))} className="mt-1 w-full min-h-11 px-3 border border-[#E7DCEB] bg-white text-center tracking-[0.5em] text-lg text-[#302438]"/>
          </label>
          <button type="submit" disabled={busy || otp.length !== 6} className="w-full min-h-11 bg-[#563568] text-white text-xs disabled:opacity-50">{busy ? "Verifying…" : "Confirm contact"}</button>
          <button type="button" disabled={busy} onClick={() => { setSent(false); setOtp(""); setError(""); }} className="w-full min-h-9 text-xs text-[#563568] underline">Change contact</button>
        </form>
      )}
      {error && <p role="alert" className="mt-3 text-xs text-red-700">{error}</p>}
      {notice && <p role="status" className="mt-3 text-xs text-[#563568]">{notice}</p>}
      <div className="mt-4 text-[11px] text-[#8A7B90] space-y-1">
        <p>Email: {customer.email || "Not linked"}</p>
        <p>Mobile: {customer.phone || "Not linked"}</p>
      </div>
    </section>
  );
};
