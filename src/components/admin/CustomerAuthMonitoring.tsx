import React, { useCallback, useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, RefreshCw, ShieldCheck, Smartphone, Mail, Chrome } from "lucide-react";

type ProviderStatus = { provider: string; configured: boolean };
type DeliveryEvent = { id: number; method: string; purpose: string; provider: string; identifier_masked: string; status: string; failure_code: string | null; createdAt: string | null };
type MonitoringData = {
  status: { emailOtp: ProviderStatus; phoneOtp: ProviderStatus; google: ProviderStatus; otpSecurity: { secretConfigured: boolean } };
  events: DeliveryEvent[];
  last24Hours: { total: number; sent: number; failed: number };
  security: { last24Hours: Array<{ method: string; purpose: string; total: number; incorrectAttempts: number }>; expiredUnconsumedChallenges: number };
};

const API_BASE = (import.meta.env.VITE_HOSTINGER_API_BASE_URL || (import.meta.env.DEV ? "/api" : "https://lavender-goldfish-844589.hostingersite.com/api")).replace(/\\/+$/, "");

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}/admin/customer-auth/${path}`, { credentials: "include", cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof data?.error === "string" ? data.error : "Customer authentication monitoring is unavailable.");
  return data as T;
}

export const CustomerAuthMonitoring: React.FC = () => {
  const [data, setData] = useState<MonitoringData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [status, delivery, security] = await Promise.all([
        getJson<MonitoringData["status"]>("status"),
        getJson<{ events: DeliveryEvent[]; last24Hours: MonitoringData["last24Hours"] }>("delivery-events?limit=30"),
        getJson<MonitoringData["security"]>("security")
      ]);
      setData({ status, ...delivery, security });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load authentication monitoring.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const providers = data ? [
    { label: "Email OTP", value: data.status.emailOtp, icon: Mail },
    { label: "Mobile OTP", value: data.status.phoneOtp, icon: Smartphone },
    { label: "Google sign-in", value: data.status.google, icon: Chrome }
  ] : [];

  return (
    <section className="bg-white rounded-2xl border border-[#EADFF0] p-5 sm:p-6 space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2"><ShieldCheck size={17} className="text-[#563568]"/><h2 className="font-serif text-lg">Customer authentication</h2></div>
          <p className="text-xs text-[#705E7B] mt-1">Provider readiness, OTP delivery history and abuse signals. Secrets and verification codes are never displayed.</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} aria-label="Refresh authentication status" className="w-9 h-9 border border-[#E7DCEB] rounded-lg flex items-center justify-center text-[#563568] disabled:opacity-50"><RefreshCw size={14}/></button>
      </div>
      {error && <div role="alert" className="p-3 bg-red-50 border border-red-200 text-xs text-red-700 flex gap-2"><AlertCircle size={14}/>{error}</div>}
      {loading && !data ? <p className="text-xs text-[#8E769E]">Loading authentication status…</p> : data && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {providers.map(item => {
              const Icon = item.icon;
              return <div key={item.label} className="border border-[#EADFF0] bg-[#FFFCFF] rounded-xl p-3">
                <div className="flex items-center gap-2 text-xs text-[#705E7B]"><Icon size={14}/>{item.label}</div>
                <div className="mt-2 flex items-center gap-2 text-xs font-semibold">
                  {item.value.configured ? <CheckCircle2 size={14} className="text-emerald-600"/> : <AlertCircle size={14} className="text-amber-600"/>}
                  {item.value.configured ? "Configured" : "Needs setup"}
                </div>
                <p className="text-[10px] text-[#8E769E] mt-1">{item.value.provider}</p>
              </div>;
            })}
          </div>
          <div className="flex flex-wrap gap-4 text-xs text-[#705E7B] border-y border-[#F1EAF4] py-3">
            <span>OTP secret: <strong className={data.status.otpSecurity.secretConfigured ? "text-emerald-700" : "text-amber-700"}>{data.status.otpSecurity.secretConfigured ? "Ready" : "Missing"}</strong></span>
            <span>Sent (24h): <strong className="text-[#302438]">{data.last24Hours.sent}</strong></span>
            <span>Failed (24h): <strong className={data.last24Hours.failed ? "text-red-700" : "text-[#302438]"}>{data.last24Hours.failed}</strong></span>
            <span>Incorrect attempts (24h): <strong className="text-[#302438]">{data.security.last24Hours.reduce((sum, row) => sum + row.incorrectAttempts, 0)}</strong></span>
          </div>
          <div>
            <h3 className="text-xs font-semibold text-[#302438] mb-2">Recent delivery activity</h3>
            {data.events.length ? <div className="overflow-x-auto">
              <table className="w-full text-left text-[11px] min-w-[540px]">
                <thead className="text-[#8E769E] border-b border-[#EADFF0]"><tr><th className="py-2 pr-3">Time</th><th className="py-2 pr-3">Destination</th><th className="py-2 pr-3">Purpose</th><th className="py-2 pr-3">Provider</th><th className="py-2">Result</th></tr></thead>
                <tbody>{data.events.map(event => <tr key={event.id} className="border-b border-[#F5EFF7]">
                  <td className="py-2 pr-3 text-[#705E7B]">{event.createdAt ? new Date(event.createdAt).toLocaleString() : "—"}</td>
                  <td className="py-2 pr-3 text-[#302438]">{event.identifier_masked}</td>
                  <td className="py-2 pr-3 text-[#705E7B]">{event.purpose === "password_reset" ? "Password recovery" : event.purpose === "identity_link" ? "Contact verification" : "Sign-in"}</td>
                  <td className="py-2 pr-3 text-[#705E7B]">{event.provider}</td>
                  <td className="py-2"><span className={event.status === "sent" ? "text-emerald-700" : "text-red-700"}>{event.status === "sent" ? "Sent" : event.failure_code || "Failed"}</span></td>
                </tr>)}</tbody>
              </table>
            </div> : <p className="text-xs text-[#8E769E] py-3">No OTP delivery attempts have been recorded yet.</p>}
          </div>
        </>
      )}
    </section>
  );
};
