const API_BASE = (
  import.meta.env.VITE_HOSTINGER_API_BASE_URL ||
  (import.meta.env.DEV ? '/api' : 'https://lavender-goldfish-844589.hostingersite.com/api')
).replace(/\/+$/, '');

export type ReturnStatus = 'pending' | 'under_review' | 'approved' | 'rejected' | 'item_received' | 'inspection_passed' | 'inspection_failed' | 'resolved' | 'closed';
export interface AdminReturnRequest {
  id: number; orderNumber: string; requestType: 'return' | 'exchange' | 'cancellation';
  reason: string; notes: string; status: ReturnStatus | string; resolutionNotes: string;
  createdAt: string | null; updatedAt: string | null;
  customer: { name: string; email: string; phone: string };
  order: { total: number; paymentMethod: string; paymentStatus: string; orderStatus: string };
}
export interface AdminRefundHistoryItem {
  id: number; paymentId: string; gatewayRefundId: string | null; amountPaise: number;
  status: string; reason: string; requestedBy: string; createdAt: string | null;
  processedAt: string | null; errorMessage: string | null;
}
export interface AdminCapturedPayment {
  paymentId: string; amountPaise: number; eventStatus: string;
}
export interface AdminRefundRequest {
  id: string; orderNumber: string; customer: { name: string; email: string; phone: string };
  capturedPayments: AdminCapturedPayment[]; refundHistory: AdminRefundHistoryItem[];
  amountRequested: number; paymentMethod: string; paymentStatus: string; orderStatus: string;
  razorpayPaymentId: string | null; cancellationReason: string; createdAt: string | null;
  cancelledAt: string | null; paymentEventCount: number; latestPaymentEvent: string | null;
  latestPaymentEventStatus: string | null; latestPaymentEventAt: string | null;
}
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(API_BASE + '/admin/returns' + path, {
    ...init, credentials: 'include', cache: 'no-store',
    headers: { Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Returns & refunds data could not be loaded.');
  return data as T;
}
async function refundRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(API_BASE + '/admin/refunds' + path, {
    ...init, credentials: 'include', cache: 'no-store',
    headers: { Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok && response.status !== 202) throw new Error(typeof data.error === 'string' ? data.error : typeof data.message === 'string' ? data.message : 'Refund request could not be completed.');
  return data as T;
}
export const hostingerAdminReturnsService = {
  getQueue(search = '') {
    const params = new URLSearchParams({ limit: '100' });
    if (search.trim()) params.set('search', search.trim());
    return request<{ returns: AdminReturnRequest[]; refundRequests: AdminRefundRequest[] }>('?' + params.toString());
  },
  getWebhookEvents() {
    return request<{ events: AdminWebhookEvent[] }>('/webhook-events?limit=100');
  },
  createRefund(input: { orderNumber: string; paymentId: string; amountPaise: number; reason: string }) {
    return refundRequest<{ success: boolean; refundId: number; gatewayRefundId: string | null; status: string; message: string }>('/', {
      method: 'POST', body: JSON.stringify(input)
    });
  },
  retryRefund(id: number) {
    return refundRequest<{ success: boolean; refundId: number; gatewayRefundId: string | null; status: string; message: string }>('/' + id + '/retry', {
      method: 'POST', body: JSON.stringify({})
    });
  },
  updateReturn(id: number, status: ReturnStatus, resolutionNotes: string) {
    return request<{ success: boolean; id: number; status: ReturnStatus; resolutionNotes: string }>('/' + id, {
      method: 'PUT', body: JSON.stringify({ status, resolutionNotes })
    });
  }
};

export interface AdminWebhookEvent {
  id: number; eventId: string; eventType: string; gatewayOrderId: string | null;
  gatewayPaymentId: string | null; gatewayRefundId: string | null; gatewayReceipt: string | null;
  refundRecordStatus: string | null;
  amountPaise: number | null; currency: string | null; gatewayStatus: string | null;
  eventStatus: string; receivedAt: string | null; orderNumber: string | null;
  orderPaymentStatus: string | null; orderStatus: string | null;
  reconciliationStatus: string;
}
