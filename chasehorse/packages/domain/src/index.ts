/**
 * ChaseHorse Shared Domain Package
 * Role enums, Domain Entities, Formatters (INR, IST), Validators, and Permission Helpers.
 */

/* ==========================================================================
   1. Role & Status Enums / Types
   ========================================================================== */

export type PartnerRole =
  | 'ONFIELD_PROFESSIONAL'
  | 'TRANSPORTER'
  | 'FLEET_OWNER'
  | 'DRIVER'
  | 'FREIGHT_TRADER'
  | 'FREIGHT_FINANCIAL'
  | 'TERMINAL_OWNER';

export type AppRole =
  | 'ADMIN'
  | 'OPERATIONAL_MANAGER'
  | 'MANAGER'
  | 'OPERATIONS'
  | 'EMPLOYEE'
  | 'CUSTOMER'
  | 'FIELD_WORKER'
  | 'PARTNER'
  | PartnerRole;

export type TaskStatus =
  | 'OPEN'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'SUBMITTED'
  | 'IN_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED';

export type TaskPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export type TaskCategory =
  | 'Shelf audit'
  | 'Site survey'
  | 'Signage check'
  | 'Equipment inspection'
  | 'Delivery proof'
  | 'General';

export type AccountStatus = 'ACTIVE' | 'PENDING' | 'SUSPENDED' | 'REJECTED';

/* ==========================================================================
   2. Domain Entities
   ========================================================================== */

export interface GeoLocation {
  lat: number;
  lng: number;
  address?: string;
  accuracyMeters?: number;
}

export interface TaskChecklistItem {
  id: string;
  label: string;
  done: boolean;
  requiresPhoto: boolean;
  notes?: string;
}

export interface TaskItem {
  id: string;
  title: string;
  description: string;
  category: TaskCategory;
  status: TaskStatus;
  priority: TaskPriority;
  customerId: string;
  assignedTo?: string;
  areaKey: string;
  address: string;
  locationLat?: number;
  locationLng?: number;
  rewardAmount: number;
  dueAt: string;
  createdAt: string;
  checklist?: TaskChecklistItem[];
  distanceKm?: number;
}

export interface EvidenceRecord {
  id: string;
  taskId: string;
  submittedBy: string;
  createdAt: string;
  photos: Array<{
    id: string;
    storagePath: string;
    fileName: string;
    caption?: string;
    locationLat?: number;
    locationLng?: number;
    capturedAt?: string;
  }>;
  ai: {
    status: string;
    confidence?: number;
    summary?: string;
  };
  managerDecision: {
    status: string;
    decidedBy?: string;
    decidedAt?: string;
    note?: string;
  };
}

export interface WalletTransactionItem {
  id: string;
  amount: number;
  entryType: 'TASK_REWARD' | 'ADJUSTMENT' | 'PAYOUT_HOLD' | 'SYSTEM_CREDIT';
  description: string;
  createdAt: string;
  taskId?: string;
}

export interface WalletSummary {
  employeeId: string;
  balanceInr: number;
  pendingInr: number;
}

export interface SupportTicketItem {
  id: string;
  customerId: string;
  subject: string;
  category: string;
  urgency: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  createdAt: string;
  commentsCount?: number;
}

export interface AppNotificationItem {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: string;
  entityType?: string;
  entityId?: string;
  read: boolean;
  createdAt: string;
}

/* ==========================================================================
   3. Formatters (Currency in INR, Dates in IST)
   ========================================================================== */

const IST_TIMEZONE = 'Asia/Kolkata';

/** Format rupee amount as standard currency string */
export function formatInr(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(amount);
}

/** Convert paise to formatted INR string */
export function formatInrFromPaise(paise: number): string {
  return formatInr(paise / 100);
}

/** Signed INR string (e.g. +₹150 or -₹50) */
export function formatSignedInr(amount: number): string {
  const prefix = amount > 0 ? '+' : amount < 0 ? '−' : '';
  return prefix + formatInr(Math.abs(amount));
}

/** Format ISO date string into IST Date (e.g. "26 Oct 2026") */
export function formatDateIST(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: IST_TIMEZONE,
    });
  } catch {
    return iso;
  }
}

/** Format ISO date string into IST Date + Time (e.g. "26 Oct, 8:30 am") */
export function formatDateTimeIST(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: IST_TIMEZONE,
    });
  } catch {
    return iso;
  }
}

/** Format distance in kilometers or meters */
export function formatDistanceKm(km?: number): string {
  if (km === undefined || km === null || isNaN(km)) return '—';
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

/** Extract 2-letter uppercase initials from person or company name */
export function formatInitials(name: string): string {
  if (!name) return 'CH';
  return name
    .replace(/\(.*?\)/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

/* ==========================================================================
   4. Permission Helpers (can(role, action))
   ========================================================================== */

export type DomainAction =
  | 'create_task'
  | 'accept_task'
  | 'submit_evidence'
  | 'review_approvals'
  | 'manage_employees'
  | 'manage_areas'
  | 'view_wallet'
  | 'submit_feedback'
  | 'create_ticket'
  | 'manage_checklists';

const ROLE_PERMISSIONS: Record<AppRole, DomainAction[]> = {
  ADMIN: [
    'create_task',
    'accept_task',
    'submit_evidence',
    'review_approvals',
    'manage_employees',
    'manage_areas',
    'view_wallet',
    'submit_feedback',
    'create_ticket',
    'manage_checklists',
  ],
  MANAGER: [
    'create_task',
    'review_approvals',
    'manage_employees',
    'view_wallet',
    'create_ticket',
    'manage_checklists',
  ],
  OPERATIONS: [
    'create_task',
    'review_approvals',
    'manage_employees',
    'view_wallet',
    'create_ticket',
  ],
  EMPLOYEE: [
    'accept_task',
    'submit_evidence',
    'view_wallet',
    'create_ticket',
  ],
  FIELD_WORKER: [
    'accept_task',
    'submit_evidence',
    'view_wallet',
    'create_ticket',
  ],
  CUSTOMER: [
    'create_task',
    'submit_feedback',
    'create_ticket',
  ],
  PARTNER: [
    'create_ticket',
  ],
  OPERATIONAL_MANAGER: [
    'create_task',
    'review_approvals',
    'manage_employees',
    'view_wallet',
    'create_ticket',
    'manage_checklists',
  ],
  ONFIELD_PROFESSIONAL: [
    'accept_task',
    'submit_evidence',
    'view_wallet',
    'create_ticket',
  ],
  TRANSPORTER: [
    'view_wallet',
    'create_ticket',
  ],
  FLEET_OWNER: [
    'view_wallet',
    'create_ticket',
  ],
  DRIVER: [
    'view_wallet',
    'create_ticket',
  ],
  FREIGHT_TRADER: [
    'view_wallet',
    'create_ticket',
  ],
  FREIGHT_FINANCIAL: [
    'view_wallet',
    'create_ticket',
  ],
  TERMINAL_OWNER: [
    'view_wallet',
    'create_ticket',
  ],
};

export function can(role: AppRole | string, action: DomainAction): boolean {
  const normRole = (role || '').toUpperCase() as AppRole;
  const permissions = ROLE_PERMISSIONS[normRole] || [];
  return permissions.includes(action);
}

/* ==========================================================================
   5. Schema Validators (Zod-equivalent functional validators)
   ========================================================================== */

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: Record<string, string>;
}

export function validateCreateTask(input: Partial<TaskItem>): ValidationResult<TaskItem> {
  const errors: Record<string, string> = {};
  if (!input.title || input.title.trim().length < 4) {
    errors.title = 'Title must be at least 4 characters long';
  }
  if (!input.category) {
    errors.category = 'Task category is required';
  }
  if (!input.address || input.address.trim().length < 5) {
    errors.address = 'Valid location address is required';
  }
  if (input.rewardAmount === undefined || input.rewardAmount < 10) {
    errors.rewardAmount = 'Reward amount must be at least ₹10';
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, errors };
  }
  return { success: true, data: input as TaskItem };
}

export function validateTicket(input: { subject?: string; message?: string }): ValidationResult<{ subject: string; message: string }> {
  const errors: Record<string, string> = {};
  if (!input.subject || input.subject.trim().length < 5) {
    errors.subject = 'Subject must be at least 5 characters';
  }
  if (!input.message || input.message.trim().length < 10) {
    errors.message = 'Message must provide at least 10 characters of detail';
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, errors };
  }
  return { success: true, data: { subject: input.subject!, message: input.message! } };
}

/* ==========================================================================
   5. Partner Registration & Approval Domain Entities
   ========================================================================== */

export type PartnerType =
  | 'onfield_professional'
  | 'transporter'
  | 'fleet_owner'
  | 'driver'
  | 'freight_trader'
  | 'freight_financial'
  | 'terminal_space';

export type PartnerAccountStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED' | 'MORE_INFO_REQUESTED';

export interface PartnerProfileItem {
  id: string;
  referenceId: string;
  userId: string;
  partnerType: PartnerType;
  status: PartnerAccountStatus;
  contactName: string;
  companyName?: string;
  email: string;
  phone: string;
  maskedGst?: string;
  submittedData: Record<string, unknown>;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
}

export interface PartnerApprovalAction {
  partnerId: string;
  action: 'APPROVE' | 'REJECT' | 'REQUEST_INFO';
  reason?: string;
  decidedBy: string;
}

/* ==========================================================================
   6. Partner Form Validation Rules
   ========================================================================== */

export const INDIAN_PHONE_REGEX = /^(\+91)?[6-9]\d{9}$/;
export const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
export const DRIVING_LICENSE_REGEX = /^[A-Z]{2}[0-9]{2}[ -]?[0-9]{11}$/;

export function maskGstin(gstin: string): string {
  if (!gstin) return '';
  const clean = gstin.trim().toUpperCase();
  if (clean.length < 4) return clean;
  return '•'.repeat(Math.max(0, clean.length - 4)) + clean.slice(-4);
}

export function validateIndianPhone(phone: string): boolean {
  if (!phone) return false;
  const clean = phone.replace(/[\s\-]/g, '');
  return INDIAN_PHONE_REGEX.test(clean);
}

export function validateGstin(gst: string): boolean {
  if (!gst) return false;
  return GSTIN_REGEX.test(gst.trim().toUpperCase());
}

export function validateDrivingLicense(dl: string): boolean {
  if (!dl) return false;
  return DRIVING_LICENSE_REGEX.test(dl.trim().toUpperCase());
}

/* ==========================================================================
   7. Traqo Tracking Domain Entities
   ========================================================================== */

export interface TraqoTripLocation {
  tripId: string;
  truckNumber?: string;
  driverPhoneMasked?: string;
  currentLat: number;
  currentLng: number;
  address?: string;
  speedKmH?: number;
  status: 'RUNNING' | 'HALTED' | 'COMPLETED' | 'CONSENT_PENDING' | 'CANCELLED';
  lastUpdated: string;
  etaIso?: string;
  totalHaltMinutes?: number;
  consentStatus: 'RECEIVED' | 'PENDING' | 'DISCONNECTED' | 'NO_RESPONSE';
  consentAttemptsCount?: number;
  routeCoordinates?: Array<[number, number]>;
  haltPoints?: Array<{
    lat: number;
    lng: number;
    haltedAt: string;
    durationMinutes: number;
    locationName?: string;
  }>;
}

export interface TraqoCreateTripRequest {
  tel: string;
  srcLat: number;
  srcLng: number;
  srcName: string;
  destLat: number;
  destLng: number;
  destName: string;
  invoiceNumber?: string;
  truckNumber: string;
  lrNumber?: string;
  etaDays?: number;
  etaHours?: number;
}
