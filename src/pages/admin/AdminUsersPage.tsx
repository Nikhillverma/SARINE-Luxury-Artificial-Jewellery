import React, { useCallback, useEffect, useState } from "react";
import { AdminLayout } from "../../components/admin/AdminLayout";
import { ShieldCheck, UserPlus, RefreshCw, UserX, CheckCircle2, AlertCircle } from "lucide-react";

const API_BASE = (
  import.meta.env.VITE_HOSTINGER_API_BASE_URL ||
  (import.meta.env.DEV ? "/api" : "https://lavender-goldfish-844589.hostingersite.com/api")
).replace(/\/+$/, "");

type AdminRow = {
  id: string; email: string; name: string; role: string; status: string;
  last_login_at?: string | null; created_at?: string | null;
};
const ROLES = [
  { value: "operations_manager", label: "Operations Manager" },
  { value: "catalogue_manager", label: "Catalogue Manager" },
  { value: "marketing_manager", label: "Marketing Manager" },
  { value: "support_staff", label: "Support Staff" }
];

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}/admin/auth/${path}`, {
    ...options, credentials: "include",
    headers: { "Content-Type": "application/json", ...options.headers }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Administrator request failed.");
  return data as T;
}

export const AdminUsersPage: React.FC = () => {
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState(ROLES[0].value);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const result = await request<{ admins: AdminRow[] }>("admins");
      setAdmins(result.admins);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load administrators."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const createAdmin = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true); setError(""); setSuccess("");
    try {
      await request("admins", { method: "POST", body: JSON.stringify({ name, email, password, role }) });
      setName(""); setEmail(""); setPassword("");
      setSuccess("Administrator account created. Share the initial password securely.");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not create administrator."); }
    finally { setSaving(false); }
  };

  const updateAdmin = async (admin: AdminRow, changes: Partial<Pick<AdminRow, "role" | "status">>) => {
    setError(""); setSuccess("");
    try {
      await request(`admins/${encodeURIComponent(admin.id)}`, {
        method: "PATCH", body: JSON.stringify(changes)
      });
      setSuccess("Administrator permissions updated.");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not update administrator."); }
  };

  return (
    <AdminLayout>
      <div className="max-w-5xl space-y-6">
        <header className="border-b border-[#E7DCEB] pb-5">
          <p className="text-[10px] uppercase tracking-[0.25em] text-[#6F6475]">ACCESS CONTROL</p>
          <h1 className="font-serif text-2xl sm:text-3xl text-[#302438] mt-1">Administrator & Role Management</h1>
          <p className="text-xs text-[#6F6475] mt-2">Create staff accounts, assign least-privilege roles and disable access when no longer required.</p>
        </header>
        {error && <div role="alert" className="p-3 bg-red-50 border border-red-200 text-xs text-red-800 flex gap-2"><AlertCircle size={16}/>{error}</div>}
        {success && <div role="status" className="p-3 bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex gap-2"><CheckCircle2 size={16}/>{success}</div>}
        <section className="bg-white border border-[#E7DCEB] p-5 sm:p-6 space-y-4">
          <div className="flex items-center gap-2"><UserPlus size={17} className="text-[#563568]"/><h2 className="font-serif text-lg">Create administrator</h2></div>
          <form onSubmit={createAdmin} className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <label className="space-y-1">Full name<input required maxLength={120} value={name} onChange={e=>setName(e.target.value)} className="w-full p-3 border border-[#E7DCEB] bg-[#FAF7FC]" /></label>
            <label className="space-y-1">Email address<input required type="email" maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} className="w-full p-3 border border-[#E7DCEB] bg-[#FAF7FC]" /></label>
            <label className="space-y-1">Initial password (minimum 12 characters)<input required type="password" minLength={12} maxLength={256} value={password} onChange={e=>setPassword(e.target.value)} className="w-full p-3 border border-[#E7DCEB] bg-[#FAF7FC]" /></label>
            <label className="space-y-1">Role<select value={role} onChange={e=>setRole(e.target.value)} className="w-full p-3 border border-[#E7DCEB] bg-[#FAF7FC]">{ROLES.map(r=><option key={r.value} value={r.value}>{r.label}</option>)}</select></label>
            <div className="sm:col-span-2 flex justify-end"><button disabled={saving} className="px-5 py-3 bg-[#563568] text-white disabled:opacity-50">{saving ? "Creating..." : "Create staff account"}</button></div>
          </form>
        </section>
        <section className="bg-white border border-[#E7DCEB] p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2"><ShieldCheck size={17} className="text-[#563568]"/><h2 className="font-serif text-lg">Team access</h2></div>
            <button onClick={()=>void load()} className="text-xs text-[#563568] flex items-center gap-1"><RefreshCw size={13}/>Refresh</button>
          </div>
          {loading ? <p className="text-xs text-[#6F6475]">Loading administrator accounts...</p> : (
            <div className="divide-y divide-[#EEE6F1]">
              {admins.map(admin => {
                const owner = admin.role === "admin" || admin.role === "owner";
                return <div key={admin.id} className="py-4 grid grid-cols-1 md:grid-cols-[1fr_190px_130px] gap-3 items-center">
                  <div><p className="text-sm font-medium text-[#302438]">{admin.name || admin.email}</p><p className="text-xs text-[#6F6475]">{admin.email}</p><p className="text-[10px] text-[#8A7B91] mt-1">{owner ? "Primary Owner — protected account" : "Staff account"}</p></div>
                  {owner ? <span className="text-xs text-[#563568] font-semibold">Owner · Full access</span> : <select aria-label={`Role for ${admin.email}`} value={admin.role} onChange={e=>void updateAdmin(admin,{role:e.target.value})} className="p-2 border border-[#E7DCEB] bg-[#FAF7FC] text-xs">{ROLES.map(r=><option key={r.value} value={r.value}>{r.label}</option>)}</select>}
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] px-2 py-1 rounded-full ${admin.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>{admin.status}</span>
                    {!owner && <button onClick={()=>void updateAdmin(admin,{status:admin.status==="active"?"disabled":"active"})} className="p-2 border border-[#E7DCEB] text-[#563568]" title={admin.status==="active"?"Disable account":"Enable account"}><UserX size={14}/></button>}
                  </div>
                </div>;
              })}
              {!admins.length && <p className="py-5 text-xs text-[#6F6475]">No administrator accounts found.</p>}
            </div>
          )}
        </section>
        <p className="text-[11px] text-[#786A80]">The primary Owner account cannot be edited or disabled from this screen. Disabling a staff account also revokes its active admin sessions.</p>
      </div>
    </AdminLayout>
  );
};
