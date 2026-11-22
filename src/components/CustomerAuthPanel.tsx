import React, { useEffect, useRef, useState } from "react";
import { customerAuthService } from "../services/customerAuthService";
import type { CustomerIdentity } from "../types/customer";

type AuthMethod = "email" | "phone";
type AuthMode = "otp" | "password" | "forgot";
interface Props {
  onAuthenticated: (customer: CustomerIdentity) => void;
  onSkip?: () => void;
  compact?: boolean;
}
interface GoogleCredentialResponse { credential: string }
interface GoogleAccounts {
  id: {
    initialize: (options: { client_id: string; callback: (response: GoogleCredentialResponse) => void }) => void;
    renderButton: (element: HTMLElement, options: Record<string, string>) => void;
  };
}
declare global { interface Window { google?: { accounts: GoogleAccounts } } }

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

export const CustomerAuthPanel: React.FC<Props> = ({ onAuthenticated, onSkip, compact = false }) => {
  const [mode, setMode] = useState<AuthMode>("otp");
  const [method, setMethod] = useState<AuthMethod>("email");
  const [methods, setMethods] = useState<{ email: boolean; phone: boolean }>({ email: false, phone: false });
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [methodReasons, setMethodReasons] = useState<{ email: string; phone: string }>({ email: "Checking email availability…", phone: "Phone verification is not enabled yet." });
  const [identifier, setIdentifier] = useState("");
  const [name, setName] = useState("");
  const [otp, setOtp] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [password, setPassword] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const googleButtonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    customerAuthService.getMethods().then(result => {
      if (!active) return;
      setMethods({ email: Boolean(result.email?.enabled), phone: Boolean(result.phone?.enabled) });
      setGoogleEnabled(Boolean(result.google?.enabled));
      setMethodReasons({ email: result.email?.reason || "Email verification is not available yet.", phone: result.phone?.reason || "Phone verification is not available yet." });
    }).catch(() => {
      if (active) setMethodReasons({ email: "Unable to check email verification availability. Please use password sign-in.", phone: "Phone verification is not available yet." });
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!googleClientId || !googleButtonRef.current) return;
    let cancelled = false;
    const scriptId = "sarine-google-identity";
    const initialize = () => {
      if (cancelled || !window.google?.accounts?.id || !googleButtonRef.current) return;
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: async ({ credential }) => {
          setBusy(true);
          setError("");
          try { onAuthenticated(await customerAuthService.loginWithGoogle(credential)); }
          catch (err) { setError(err instanceof Error ? err.message : "Google sign-in failed. Please try again."); }
          finally { setBusy(false); }
        }
      });
      window.google.accounts.id.renderButton(googleButtonRef.current, { theme: "outline", size: "large", shape: "rectangular", width: "320", text: "continue_with" });
    };
    const existing = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (existing) {
      if (window.google?.accounts?.id) initialize();
      else existing.addEventListener("load", initialize, { once: true });
    } else {
      const script = document.createElement("script");
      script.id = scriptId;
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = initialize;
      document.head.appendChild(script);
    }
    return () => { cancelled = true; };
  }, [onAuthenticated]);

  const clearFeedback = () => { setError(""); setMessage(""); };
  const sendOtp = async () => {
    clearFeedback();
    setBusy(true);
    try {
      const result = mode === "forgot"
        ? await customerAuthService.requestPasswordRecovery(method, identifier.trim())
        : await customerAuthService.requestOtp(method, identifier.trim());
      setChallengeId(result.challengeId);
      setOtpSent(true);
      setOtp("");
      setMessage(mode === "forgot" ? "If an account matches those details, a recovery code has been sent." : `A verification code has been sent to your ${method === "phone" ? "mobile" : "email"}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send the code. Please try again.");
    } finally { setBusy(false); }
  };
  const verifyOtp = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    clearFeedback();
    setBusy(true);
    try {
      if (mode === "forgot") {
        const token = await customerAuthService.verifyPasswordRecovery(challengeId, otp);
        setResetToken(token);
        setMessage("Contact verified. Choose a new password.");
      } else {
        const result = await customerAuthService.verifyOtp(challengeId, otp, name.trim());
        onAuthenticated(result.customer);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "The code could not be verified.");
    } finally { setBusy(false); }
  };
  const passwordLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    clearFeedback();
    setBusy(true);
    try { onAuthenticated(await customerAuthService.login(identifier.trim(), password)); }
    catch (err) { setError(err instanceof Error ? err.message : "Unable to sign in."); }
    finally { setBusy(false); }
  };
  const requestRecovery = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await sendOtp();
  };
  const saveNewPassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    clearFeedback();
    setBusy(true);
    try {
      await customerAuthService.resetPassword(resetToken, newPassword);
      setMode("password");
      setResetToken("");
      setOtpSent(false);
      setPassword("");
      setMessage("Password updated successfully. Sign in with your new password.");
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to update your password."); }
    finally { setBusy(false); }
  };

  const switchMode = (next: AuthMode) => {
    setMode(next);
    setOtpSent(false);
    setChallengeId("");
    setOtp("");
    setResetToken("");
    clearFeedback();
  };
  const fieldClass = "mt-1 w-full min-h-11 px-3 border border-[var(--border)] bg-white text-sm text-[#302438] outline-none focus:border-[var(--plum)]";
  const buttonClass = "w-full min-h-12 bg-[var(--plum)] text-white text-sm font-medium hover:bg-[var(--plum-dark)] disabled:opacity-60 transition-colors";
  const labelClass = "block text-xs text-[color:var(--body)]";

  return (
    <div className="w-full">
      <div className="text-center mb-6">
        <span className="text-[10px] tracking-[0.25em] text-[color:var(--muted)]">WELCOME TO</span>
        <div className="font-serif text-3xl tracking-[0.2em] text-[color:var(--heading)] mt-1">SARINE</div>
        <p className="text-xs text-[color:var(--body)] mt-2">A little elegance, made personal.</p>
      </div>
      {mode !== "forgot" && (
        <div className="grid grid-cols-2 border-b border-[var(--border)] mb-5">
          <button type="button" onClick={() => switchMode("otp")} className={`min-h-11 text-sm border-b-2 ${mode === "otp" ? "border-[var(--plum)] text-[color:var(--plum)] font-semibold" : "border-transparent text-[color:var(--muted)]"}`}>Continue with OTP</button>
          <button type="button" onClick={() => switchMode("password")} className={`min-h-11 text-sm border-b-2 ${mode === "password" ? "border-[var(--plum)] text-[color:var(--plum)] font-semibold" : "border-transparent text-[color:var(--muted)]"}`}>Email & Password</button>
        </div>
      )}
      {error && <p role="alert" className="mb-4 p-3 bg-red-50 border border-red-200 text-xs text-red-700">{error}</p>}
      {message && <p role="status" className="mb-4 p-3 bg-[var(--tint)] border border-[var(--border)] text-xs text-[color:var(--body)]">{message}</p>}

      {mode === "otp" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => { setMethod("phone"); setOtpSent(false); clearFeedback(); }} disabled={!methods.phone} className={`min-h-10 border text-xs disabled:opacity-40 ${method === "phone" ? "border-[var(--plum)] bg-[var(--pill)] text-[color:var(--plum)]" : "border-[var(--border)] text-[color:var(--body)]"}`}>Mobile · unavailable</button>
            <button type="button" onClick={() => { setMethod("email"); setOtpSent(false); clearFeedback(); }} disabled={!methods.email} className={`min-h-10 border text-xs disabled:opacity-40 ${method === "email" ? "border-[var(--plum)] bg-[var(--pill)] text-[color:var(--plum)]" : "border-[var(--border)] text-[color:var(--body)]"}`}>Email address</button>
          </div>
          {!methods[method] && <p role="status" className="rounded-lg border border-[var(--border)] bg-[var(--tint)] p-3 text-xs text-[color:var(--body)]">{methodReasons[method]} You can still use your existing email and password.</p>}
          {!otpSent ? (
            <>
              <label className={labelClass}>{method === "phone" ? "Mobile number" : "Email address"}
                <div className="flex mt-1">
                  {method === "phone" && <span className="flex items-center px-3 border border-r-0 border-[var(--border)] bg-[var(--tint)] text-sm text-[color:var(--body)]">+91</span>}
                  <input required type={method === "email" ? "email" : "tel"} autoComplete={method === "email" ? "email" : "tel"} value={identifier} onChange={event => setIdentifier(event.target.value)} placeholder={method === "phone" ? "10-digit mobile number" : "you@example.com"} className={fieldClass + (method === "phone" ? " mt-0" : "")} />
                </div>
              </label>
              <label className={labelClass}>Full name <span className="text-[color:var(--muted)]">(for new customers)</span>
                <input value={name} onChange={event => setName(event.target.value)} autoComplete="name" placeholder="Your full name" className={fieldClass} />
              </label>
              <button type="button" disabled={busy || !identifier.trim() || !methods[method]} onClick={sendOtp} className={buttonClass}>{busy ? "Sending code…" : "Send verification code"}</button>
            </>
          ) : (
            <form onSubmit={verifyOtp} className="space-y-4">
              <p className="text-xs text-[color:var(--body)]">Enter the 6-digit code sent to <strong>{identifier}</strong>.</p>
              <label className={labelClass}>Full name <span className="text-[color:var(--muted)]">(only needed when creating a new account)</span>
                <input value={name} onChange={event => setName(event.target.value)} autoComplete="name" placeholder="Your full name" className={fieldClass} />
              </label>
              <label className={labelClass}>Verification code
                <input required inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={otp} onChange={event => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="••••••" className={fieldClass + " text-center tracking-[0.5em] text-lg"} />
              </label>
              <button type="submit" disabled={busy || otp.length !== 6} className={buttonClass}>{busy ? "Verifying…" : "Verify & continue"}</button>
              <button type="button" disabled={busy} onClick={() => { setOtpSent(false); setOtp(""); clearFeedback(); }} className="w-full min-h-10 text-xs text-[color:var(--plum)] underline">Change {method === "phone" ? "mobile number" : "email"}</button>
              <button type="button" disabled={busy} onClick={sendOtp} className="w-full min-h-10 text-xs text-[color:var(--body)] underline">Resend code</button>
            </form>
          )}
        </div>
      )}

      {mode === "password" && (
        <form onSubmit={passwordLogin} className="space-y-4">
          <label className={labelClass}>Email address
            <input required type="email" autoComplete="email" value={identifier} onChange={event => setIdentifier(event.target.value)} placeholder="you@example.com" className={fieldClass} />
          </label>
          <label className={labelClass}>Password
            <input required type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} className={fieldClass} />
          </label>
          <button type="submit" disabled={busy || !identifier.trim() || !password} className={buttonClass}>{busy ? "Signing in…" : "Sign in securely"}</button>
          <button type="button" onClick={() => switchMode("forgot")} className="w-full min-h-10 text-xs text-[color:var(--plum)] underline">Forgot password?</button>
        </form>
      )}

      {mode === "forgot" && (
        <div className="space-y-4">
          {!resetToken ? (
            !otpSent ? (
              <form onSubmit={requestRecovery} className="space-y-4">
                <h3 className="font-serif text-xl text-[color:var(--heading)]">Recover your password</h3>
                <p className="text-xs text-[color:var(--body)]">Choose the email or mobile number registered to your account.</p>
                {!methods[method] && <p role="status" className="rounded-lg border border-[var(--border)] bg-[var(--tint)] p-3 text-xs text-[color:var(--body)]">{methodReasons[method]} Password recovery will become available when a verified delivery method is configured.</p>}
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => { setMethod("email"); clearFeedback(); }} disabled={!methods.email} className={`min-h-10 border text-xs disabled:opacity-40 ${method === "email" ? "border-[var(--plum)] bg-[var(--pill)] text-[color:var(--plum)]" : "border-[var(--border)]"}`}>Email</button>
                  <button type="button" onClick={() => { setMethod("phone"); clearFeedback(); }} disabled={!methods.phone} className={`min-h-10 border text-xs disabled:opacity-40 ${method === "phone" ? "border-[var(--plum)] bg-[var(--pill)] text-[color:var(--plum)]" : "border-[var(--border)]"}`}>Mobile · unavailable</button>
                </div>
                <label className={labelClass}>{method === "email" ? "Email address" : "Mobile number"}
                  <input required value={identifier} onChange={event => setIdentifier(event.target.value)} className={fieldClass} />
                </label>
                <button type="submit" disabled={busy || !identifier.trim() || !methods[method]} className={buttonClass}>{busy ? "Sending…" : "Send recovery code"}</button>
              </form>
            ) : (
              <form onSubmit={verifyOtp} className="space-y-4">
                <h3 className="font-serif text-xl text-[color:var(--heading)]">Verify recovery code</h3>
                <label className={labelClass}>6-digit code
                  <input required inputMode="numeric" maxLength={6} value={otp} onChange={event => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))} className={fieldClass + " text-center tracking-[0.5em]"} />
                </label>
                <button type="submit" disabled={busy || otp.length !== 6} className={buttonClass}>{busy ? "Verifying…" : "Verify code"}</button>
              </form>
            )
          ) : (
            <form onSubmit={saveNewPassword} className="space-y-4">
              <h3 className="font-serif text-xl text-[color:var(--heading)]">Choose a new password</h3>
              <label className={labelClass}>New password
                <input required type="password" minLength={8} maxLength={128} autoComplete="new-password" value={newPassword} onChange={event => setNewPassword(event.target.value)} className={fieldClass} />
              </label>
              <button type="submit" disabled={busy || newPassword.length < 8} className={buttonClass}>{busy ? "Updating…" : "Update password"}</button>
            </form>
          )}
          <button type="button" onClick={() => switchMode("password")} className="w-full min-h-10 text-xs text-[color:var(--plum)] underline">Back to sign in</button>
        </div>
      )}

      {googleClientId && googleEnabled && mode !== "forgot" && (
        <div className="mt-5">
          <div className="flex items-center gap-3 mb-4"><span className="h-px bg-[var(--border)] flex-1" /><span className="text-[10px] tracking-widest text-[color:var(--muted)]">OR</span><span className="h-px bg-[var(--border)] flex-1" /></div>
          <div ref={googleButtonRef} className="flex justify-center min-h-10" />
        </div>
      )}
      {onSkip && <button type="button" onClick={onSkip} className="w-full min-h-11 mt-4 text-xs tracking-wide text-[color:var(--body)] hover:text-[color:var(--plum)]">Skip for now — continue browsing</button>}
      {!compact && <p className="mt-4 text-center text-[10px] text-[color:var(--muted)]">By continuing, you agree to SARINE's Terms & Privacy Policy.</p>}
    </div>
  );
};
