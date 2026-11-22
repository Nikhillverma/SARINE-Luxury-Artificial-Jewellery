import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CalendarDays, CheckCircle2, Clock3, Package, RefreshCw, ShieldCheck, Truck } from "lucide-react";
import { CustomerAuthPanel } from "../components/CustomerAuthPanel";
import { CustomerIdentityLink } from "../components/account/CustomerIdentityLink";
import { CustomerAddressBook } from "../components/account/CustomerAddressBook";
import { customerAuthService, type CustomerAccountOrder } from "../services/customerAuthService";
import type { CustomerIdentity } from "../types/customer";
import { formatInr } from "../utils/currency";

type ReturnType = "return" | "exchange";

const statusLabel = (status: string) => status.replace(/_/g, " ").replace(/\b\w/g, letter => letter.toUpperCase());
const formatDate = (value?: string) => {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

export const AccountPage: React.FC = () => {
  const [customer, setCustomer] = useState<CustomerIdentity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [orders, setOrders] = useState<CustomerAccountOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState("");
  const [busyOrder, setBusyOrder] = useState("");
  const [returnOrder, setReturnOrder] = useState("");
  const [returnType, setReturnType] = useState<ReturnType>("return");
  const [returnReason, setReturnReason] = useState("Item arrived damaged or scratched");
  const [returnNotes, setReturnNotes] = useState("");
  const [actionMessage, setActionMessage] = useState("");

  useEffect(() => {
    let active = true;
    customerAuthService.getSession().then(session => { if (active) setCustomer(session); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const loadOrders = useCallback(async () => {
    setOrdersLoading(true);
    setOrdersError("");
    try {
      const result = await customerAuthService.getOrders();
      setOrders(result);
    } catch (err) {
      setOrdersError(err instanceof Error ? err.message : "Unable to load your orders.");
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  useEffect(() => {
    if (customer?.id) void loadOrders();
    else setOrders([]);
  }, [customer?.id, loadOrders]);

  const handleAuthenticated = useCallback((identity: CustomerIdentity) => {
    setCustomer(identity);
    setError("");
  }, []);

  const handleLogout = async () => {
    setError("");
    try {
      await customerAuthService.logout();
      setCustomer(null);
      setOrders([]);
      setActionMessage("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign out. Please try again.");
    }
  };

  const handleCancel = async (order: CustomerAccountOrder) => {
    if (!window.confirm(`Cancel order ${order.orderNumber}? This action cannot be undone.`)) return;
    setBusyOrder(order.orderNumber);
    setActionMessage("");
    setOrdersError("");
    try {
      const result = await customerAuthService.cancelOrder(order.orderNumber, "Cancelled by customer from My Account");
      setActionMessage(result.message || `Order ${order.orderNumber} was cancelled.`);
      await loadOrders();
    } catch (err) {
      setOrdersError(err instanceof Error ? err.message : "Unable to cancel this order.");
    } finally {
      setBusyOrder("");
    }
  };

  const handleReturnSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!returnOrder) return;
    setBusyOrder(returnOrder);
    setActionMessage("");
    setOrdersError("");
    try {
      const result = await customerAuthService.requestReturn(returnOrder, returnType, returnReason, returnNotes);
      setActionMessage(result.message || `Your ${returnType} request has been submitted.`);
      setReturnOrder("");
      setReturnNotes("");
      await loadOrders();
    } catch (err) {
      setOrdersError(err instanceof Error ? err.message : "Unable to submit your request.");
    } finally {
      setBusyOrder("");
    }
  };

  if (loading) return <main className="min-h-[60vh] flex items-center justify-center bg-[var(--tint)] text-[#563568]">Loading your SARINE account…</main>;

  return (
    <main className="min-h-screen bg-[var(--tint)] text-[#302438] font-sans py-10 sm:py-14">
      <div className="site-container max-w-6xl">
        <div className="max-w-2xl mx-auto text-center mb-9">
          <span className="block text-[10px] uppercase tracking-[0.25em] text-[color:var(--body)] font-medium mb-2">YOUR SARINE SPACE</span>
          <h1 className="font-serif text-3xl sm:text-4xl font-normal">My Account</h1>
          <p className="mt-3 text-sm text-[color:var(--body)]">Your orders, personal details and moments with SARINE — all in one place.</p>
        </div>

        {customer ? (
          <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)] items-start">
            <aside className="bg-white border border-[var(--border)] p-6 sm:p-7">
              <div className="w-14 h-14 rounded-full bg-[var(--tint)] flex items-center justify-center text-[#563568] text-xl font-serif mb-4">{customer.name.trim().charAt(0).toUpperCase()}</div>
              <h2 className="font-serif text-2xl text-[#563568]">Hello, {customer.name}</h2>
              <p className="mt-1 text-sm text-[color:var(--body)] break-all">{customer.email || customer.phone}</p>
              {customer.email && customer.phone && <p className="mt-1 text-xs text-[color:var(--muted)]">{customer.phone}</p>}
              <div className="mt-5 pt-5 border-t border-[var(--border)]">
                <p className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--muted)]">Account overview</p>
                <div className="mt-3 flex items-center justify-between text-sm"><span className="text-[color:var(--body)]">Orders</span><strong className="text-[#563568]">{orders.length}</strong></div>
              </div>
              <CustomerIdentityLink customer={customer} onUpdated={setCustomer} />
              <button type="button" onClick={handleLogout} className="mt-6 w-full min-h-11 border border-[#D9B8A0] text-[#563568] text-sm hover:bg-[#FAF5FC]">Sign Out</button>
              {error && <p role="alert" className="mt-3 text-xs text-red-700">{error}</p>}
            </aside>

            <section className="min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)]">Your purchases</p>
                  <h2 className="font-serif text-2xl text-[#563568]">Order History</h2>
                </div>
                <button type="button" onClick={() => void loadOrders()} disabled={ordersLoading} className="inline-flex items-center gap-2 min-h-10 px-3 border border-[#D9B8A0] text-xs text-[#563568] disabled:opacity-50"><RefreshCw size={13} className={ordersLoading ? "animate-spin" : ""}/> Refresh orders</button>
              </div>

              {actionMessage && <div role="status" className="mb-4 p-3 border border-emerald-200 bg-emerald-50 text-sm text-emerald-800">{actionMessage}</div>}
              {ordersError && <div role="alert" className="mb-4 p-3 border border-red-200 bg-red-50 text-sm text-red-700">{ordersError}</div>}

              {ordersLoading && !orders.length ? (
                <div className="bg-white border border-[var(--border)] p-10 text-center text-sm text-[color:var(--body)]">Loading your orders…</div>
              ) : orders.length === 0 ? (
                <div className="bg-white border border-[var(--border)] p-8 sm:p-12 text-center">
                  <Package size={30} className="mx-auto text-[#B69ACF]"/>
                  <h3 className="mt-4 font-serif text-xl text-[#563568]">Your story with SARINE starts here</h3>
                  <p className="mt-2 text-sm text-[color:var(--body)]">Orders placed while signed in will appear here.</p>
                  <Link to="/shop" className="inline-flex items-center gap-2 mt-5 px-6 min-h-11 bg-[#563568] text-white text-xs uppercase tracking-wider">Explore jewellery <ArrowRight size={14}/></Link>
                  <p className="mt-4 text-[11px] text-[color:var(--muted)]">If you checked out as a guest, use Track Your Order with your order number and mobile number.</p>
                  <Link to="/track-order" className="text-xs text-[#563568] underline underline-offset-4">Track a guest order</Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {orders.map(order => {
                    const canCancel = ["placed", "confirmed", "processing", "packed", "awaiting_payment"].includes(order.orderStatus);
                    const canRequestReturn = order.orderStatus === "delivered" && order.returnStatus !== "pending" && order.returnStatus !== "approved";
                    return (
                      <article key={order.orderNumber} className="bg-white border border-[var(--border)] p-5 sm:p-6">
                        <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-[var(--border)]">
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.16em] text-[color:var(--muted)]">Order reference</p>
                            <h3 className="font-serif text-xl text-[#563568]">{order.orderNumber}</h3>
                            <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-[color:var(--body)]"><CalendarDays size={12}/>{formatDate(order.createdAt)}</p>
                          </div>
                          <div className="text-right">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[var(--tint)] text-[#563568] text-[11px]">{order.orderStatus === "delivered" ? <CheckCircle2 size={12}/> : order.orderStatus === "shipped" ? <Truck size={12}/> : <Clock3 size={12}/>} {statusLabel(order.orderStatus)}</span>
                            <p className="mt-2 font-medium text-sm text-[#302438]">{formatInr(order.total)}</p>
                            <p className="text-[10px] text-[color:var(--muted)]">{order.paymentStatus === "paid" ? "Paid" : statusLabel(order.paymentStatus)} · {order.paymentMethod.toUpperCase()}</p>
                          </div>
                        </div>

                        <div className="py-4 space-y-3">
                          {order.lines.map((line, index) => (
                            <div key={`${order.orderNumber}-${line.productId}-${index}`} className="flex items-center gap-3">
                              {line.image ? <img src={line.image} alt={line.name} className="w-14 h-16 object-cover bg-[var(--tint)]"/> : <div className="w-14 h-16 bg-[var(--tint)] flex items-center justify-center"><Package size={17} className="text-[#B69ACF]"/></div>}
                              <div className="min-w-0 flex-1"><p className="text-sm text-[#302438]">{line.name}</p>{line.variantLabel && <p className="text-[11px] text-[color:var(--muted)]">{line.variantLabel}</p>}<p className="text-xs text-[color:var(--body)] mt-1">Qty {line.quantity} · {formatInr(line.unitPrice)}</p></div>
                            </div>
                          ))}
                        </div>

                        <div className="pt-4 border-t border-[var(--border)] flex flex-wrap items-center justify-between gap-3">
                          <div className="text-xs text-[color:var(--body)]">
                            {order.trackingNumber ? <span>Tracking: {order.trackingNumber}</span> : order.refundNeeded ? <span>Refund review pending: {formatInr(order.refundAmount)}</span> : <span>{order.lines.length} item line(s)</span>}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {order.trackingUrl && <a href={order.trackingUrl} target="_blank" rel="noreferrer" className="min-h-9 px-3 border border-[#D9B8A0] inline-flex items-center text-xs text-[#563568]">Courier tracking</a>}
                            {canCancel && <button type="button" disabled={busyOrder === order.orderNumber} onClick={() => void handleCancel(order)} className="min-h-9 px-3 border border-[var(--border)] text-xs text-[color:var(--body)] disabled:opacity-50">{busyOrder === order.orderNumber ? "Please wait…" : "Cancel order"}</button>}
                            {canRequestReturn && <button type="button" onClick={() => { setReturnOrder(order.orderNumber); setReturnType("return"); setReturnReason("Item arrived damaged or scratched"); setReturnNotes(""); }} className="min-h-9 px-3 bg-[#563568] text-white text-xs inline-flex items-center gap-1"><RefreshCw size={12}/> Return / Exchange</button>}
                          </div>
                        </div>
                        {order.cancellationReason && <p className="mt-3 text-xs text-[color:var(--body)]">Cancellation reason: {order.cancellationReason}</p>}
                        {order.returnStatus && order.returnStatus !== "none" && <p className="mt-2 text-xs text-[color:var(--body)]">Return status: {statusLabel(order.returnStatus)}</p>}
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
            <div className="lg:col-start-2"><CustomerAddressBook /></div>
          </div>
        ) : (
          <section className="max-w-xl mx-auto bg-white border border-[var(--border)] shadow-sm p-6 sm:p-10">
            <CustomerAuthPanel onAuthenticated={handleAuthenticated}/>
          </section>
        )}

        {returnOrder && customer && (
          <div className="fixed inset-0 z-[80] bg-black/40 p-4 flex items-center justify-center" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setReturnOrder(""); }}>
            <form onSubmit={handleReturnSubmit} className="w-full max-w-md bg-white p-6 sm:p-8 shadow-xl" role="dialog" aria-modal="true" aria-labelledby="return-dialog-title">
              <h2 id="return-dialog-title" className="font-serif text-2xl text-[#563568]">Return or exchange</h2>
              <p className="mt-1 text-xs text-[color:var(--body)]">Order {returnOrder}. Requests are accepted within 7 days of delivery.</p>
              <label className="block mt-5 text-xs text-[color:var(--body)]">Request type
                <select value={returnType} onChange={event => setReturnType(event.target.value as ReturnType)} className="mt-1 w-full min-h-11 border border-[var(--border)] px-3 bg-white text-sm text-[#302438]"><option value="return">Return</option><option value="exchange">Exchange</option></select>
              </label>
              <label className="block mt-3 text-xs text-[color:var(--body)]">Reason
                <select value={returnReason} onChange={event => setReturnReason(event.target.value)} className="mt-1 w-full min-h-11 border border-[var(--border)] px-3 bg-white text-sm text-[#302438]"><option>Item arrived damaged or scratched</option><option>Wrong item received</option><option>Item differs from description</option><option>Quality concern</option><option>Other</option></select>
              </label>
              <label className="block mt-3 text-xs text-[color:var(--body)]">Additional details (optional)
                <textarea value={returnNotes} onChange={event => setReturnNotes(event.target.value)} maxLength={2000} rows={3} className="mt-1 w-full border border-[var(--border)] p-3 text-sm text-[#302438] resize-y"/>
              </label>
              <div className="mt-5 flex gap-2">
                <button type="button" onClick={() => setReturnOrder("")} className="flex-1 min-h-11 border border-[#D9B8A0] text-xs text-[#563568]">Go back</button>
                <button type="submit" disabled={Boolean(busyOrder)} className="flex-1 min-h-11 bg-[#563568] text-white text-xs disabled:opacity-50">{busyOrder ? "Submitting…" : "Submit request"}</button>
              </div>
            </form>
          </div>
        )}
        <p className="mt-7 text-center text-xs text-[color:var(--body)]">Need help? <Link to="/contact" className="text-[#563568] underline">Contact SARINE</Link></p>
      </div>
    </main>
  );
};
