const API_BASE = (
  import.meta.env.VITE_HOSTINGER_API_BASE_URL ||
  (import.meta.env.DEV ? '/api' : 'https://lavender-goldfish-844589.hostingersite.com/api')
).replace(/\/+$/, '');

export interface ContactInquiryInput {
  name: string; email: string; phone?: string; subject?: string; message: string; website?: string;
}
export type ContactInquiryStatus = 'new' | 'reviewed' | 'closed';
export interface AdminContactInquiry {
  id: number; name: string; email: string; phone: string; subject: string; message: string;
  status: ContactInquiryStatus; adminNote: string; createdAt: string | null; updatedAt: string | null;
}
async function readResponse<T>(response: Response, fallback: string): Promise<T> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : fallback);
  return data as T;
}
export const hostingerContactInquiryService = {
  async submit(input: ContactInquiryInput): Promise<{ success: boolean; inquiryId?: number }> {
    const response = await fetch(API_BASE + '/contact/inquiries', {
      method: 'POST', credentials: 'omit', cache: 'no-store',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(input)
    });
    return readResponse(response, 'Your message could not be submitted. Please try again.');
  },
  async getAdminInquiries(status = 'all', search = ''): Promise<{ inquiries: AdminContactInquiry[]; counts: Record<string, number> }> {
    const params = new URLSearchParams({ limit: '100', status });
    if (search.trim()) params.set('search', search.trim());
    const response = await fetch(API_BASE + '/admin/contact-inquiries?' + params.toString(), {
      credentials: 'include', cache: 'no-store', headers: { Accept: 'application/json' }
    });
    return readResponse(response, 'Customer enquiries could not be loaded.');
  },
  async updateAdminInquiry(id: number, status: ContactInquiryStatus, adminNote: string) {
    const response = await fetch(API_BASE + '/admin/contact-inquiries/' + encodeURIComponent(id), {
      method: 'PATCH', credentials: 'include', cache: 'no-store',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, adminNote })
    });
    return readResponse<{ success: boolean }>(response, 'Enquiry could not be updated.');
  }
};
