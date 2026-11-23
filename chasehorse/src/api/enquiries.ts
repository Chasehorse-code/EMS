import { http } from './httpClient';
import { supabase } from '@/config/supabase';

/** Enquiry Management System dashboard API (enquiry managers and admins). */

export type EnquiryStatus = 'NEW' | 'IN_PROGRESS' | 'CONTACTED' | 'CLOSED' | 'SPAM';

export interface EnquiryRow {
  id: string;
  reference: string;
  formType: string;
  formLabel: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  city: string | null;
  status: EnquiryStatus;
  assignedTo: string | null;
  assigneeName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EnquiryEvent {
  eventType: 'CREATED' | 'STATUS_CHANGED' | 'ASSIGNED' | 'NOTE';
  actorName: string | null;
  oldValue: string | null;
  newValue: string | null;
  note: string | null;
  createdAt: string;
}

export interface EnquiryDetail {
  enquiry: EnquiryRow;
  sourcePage: string | null;
  message: string | null;
  details: Record<string, string>;
  emailVerifiedAt: string;
  firstResponseAt: string | null;
  events: EnquiryEvent[];
}

export interface EnquiryPage {
  items: EnquiryRow[];
  total: number;
  page: number;
  size: number;
}

export interface EnquirySummary {
  total: number;
  newCount: number;
  inProgress: number;
  contacted: number;
  closed: number;
  spam: number;
  today: number;
  avgFirstResponseMinutes: number | null;
  latestCreatedAt: string | null;
}

export interface EnquiryFilters {
  status?: EnquiryStatus | '';
  formType?: string;
  q?: string;
  from?: string;
  to?: string;
}

const query = (filters: EnquiryFilters, extra: Record<string, string | number> = {}) => {
  const params = new URLSearchParams();
  Object.entries({ ...filters, ...extra }).forEach(([k, v]) => {
    if (v !== undefined && v !== null && String(v).trim() !== '') params.set(k, String(v));
  });
  const s = params.toString();
  return s ? `?${s}` : '';
};

export const enquiryApi = {
  list: (filters: EnquiryFilters, page: number, size = 25) =>
    http<EnquiryPage>(`/enquiries${query(filters, { page, size })}`),
  summary: () => http<EnquirySummary>('/enquiries/summary'),
  updates: (since: string) => http<EnquiryRow[]>(`/enquiries/updates?since=${encodeURIComponent(since)}`),
  get: (id: string) => http<EnquiryDetail>(`/enquiries/${encodeURIComponent(id)}`),
  staff: () => http<{ id: string; name: string; email: string }[]>('/enquiries/staff'),
  formTypes: () => http<{ value: string; label: string }[]>('/enquiries/form-types'),
  setStatus: (id: string, status: EnquiryStatus, note?: string) =>
    http<EnquiryDetail>(`/enquiries/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, note: note || undefined }),
    }),
  assign: (id: string, assigneeId: string | null) =>
    http<EnquiryDetail>(`/enquiries/${encodeURIComponent(id)}/assignee`, {
      method: 'PATCH',
      body: JSON.stringify({ assigneeId }),
    }),
  addNote: (id: string, note: string) =>
    http<EnquiryDetail>(`/enquiries/${encodeURIComponent(id)}/notes`, {
      method: 'POST',
      body: JSON.stringify({ note }),
    }),

  /** Downloads the filtered list as CSV (authenticated fetch, then a local file save). */
  async exportCsv(filters: EnquiryFilters) {
    const base = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';
    const { data } = await supabase.auth.getSession();
    const res = await fetch(`${base}/enquiries/export${query(filters)}`, {
      headers: data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {},
    });
    if (!res.ok) throw new Error(`Export failed (HTTP ${res.status})`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chasehorse-enquiries-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};
