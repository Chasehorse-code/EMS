/**
 * Website → Enquiry Management System.
 * Every form verifies the visitor's e-mail with a one-time code (sent from noreply@chasehorse.com)
 * and then submits to the API, which stores it, alerts the team and e-mails the visitor a copy.
 */

const BASE = `${import.meta.env.VITE_API_BASE_URL ?? '/api/v1'}/public/enquiries`;

export type EnquiryFormType =
  | 'CONTACT' | 'ENQUIRY_POPUP' | 'HERO_ENQUIRY' | 'NETWORK_ENQUIRY' | 'BLUEPRINT'
  | 'PARTNER_ONFIELD' | 'PARTNER_TRANSPORT' | 'PARTNER_TERMINAL' | 'CAREERS'
  | 'BOOK_TRUCK' | 'ONFIELD_LEAD' | 'TERMINAL_SPACE' | 'TRIP_FINANCE'
  | 'HSE_CALLBACK' | 'HSE_ONSITE_STORE';

export interface EnquiryPayload {
  formType: EnquiryFormType;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  city?: string;
  message?: string;
  /** Every other field on the form, labelled as the visitor saw it, e.g. { 'Nearest hub': 'Hyderabad' }. */
  details?: Record<string, string | number | boolean | string[] | null | undefined>;
  verificationToken: string;
}

export interface EnquiryReceipt {
  reference: string;
  formLabel: string;
  receivedAt: string;
}

export class EnquiryError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function post<T>(path: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new EnquiryError('Could not reach ChaseHorse. Check your connection and try again.', 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new EnquiryError(typeof data?.message === 'string' ? data.message : 'Something went wrong. Please try again.', res.status);
  }
  return data as T;
}

export function requestEmailCode(email: string) {
  return post<{ email: string; validMinutes: number; resendAfterSeconds: number }>('/email-code', { email });
}

export function verifyEmailCode(email: string, code: string) {
  return post<{ email: string; token: string; expiresAt: string }>('/email-code/verify', { email, code });
}

export function submitEnquiry(payload: EnquiryPayload): Promise<EnquiryReceipt> {
  // Drop empty optional details so the stored record and e-mails stay clean.
  const details = Object.fromEntries(
    Object.entries(payload.details ?? {}).filter(([, v]) =>
      v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0)),
  );
  return post<EnquiryReceipt>('', {
    ...payload,
    details,
    sourcePage: typeof window !== 'undefined' ? window.location.pathname : undefined,
  });
}

export const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
