/**
 * Domain types for ChaseHorse Field Task & Employee Operations Platform.
 * Shaped to map 1:1 onto Spring Boot DTOs and Supabase PostgreSQL tables.
 */

export type Role =
  | 'admin'
  | 'operations_manager'
  | 'employee'
  | 'customer'
  // Backward-compatibility aliases:
  | 'manager'
  | 'operations'
  | 'field_worker'
  // Enquiry Management System desk (contact@ account): website enquiries only.
  | 'enquiry_manager';

export type EmployeeSubRole = 'manager' | 'field_worker';

export interface GeoPoint {
  lat: number;
  lng: number;
  area: string;
}

/* ---------- Employees (On-field workers & Operations Managers) ---------- */

export type EmployeeApprovalStatus = 'pending' | 'approved' | 'rejected' | 'suspended' | 'blocked';
export type Availability = 'available' | 'on_task' | 'offline';

export interface Employee {
  id: string;
  name: string;
  email: string;
  phone: string;
  region: string;
  stateCode?: string;
  stateName?: string;
  skills?: string[];
  approvalStatus: EmployeeApprovalStatus;
  subRole?: EmployeeSubRole;
  roles?: string[];
  primaryRole?: string;
  availability: Availability;
  location: GeoPoint;
  joinedAt: string; // ISO
  tasksCompleted: number;
  rating: number; // 0-5
  documentsVerified: boolean;
  /** Registered operational zone, e.g. "Tenali, Guntur dist". */
  zoneLabel?: string;
  /** Has confirmed their e-mail with the sign-up OTP. */
  emailVerified?: boolean;
}

/* ---------- Customers ---------- */

export interface Customer {
  id: string;
  name: string;
  contact: string;
}

/* ---------- Checklists ---------- */

export interface ChecklistItem {
  id: string;
  label: string;
  required: boolean;
  requiresPhoto: boolean;
}

export interface ChecklistTemplate {
  id: string;
  name: string;
  category: TaskCategory;
  items: ChecklistItem[];
  updatedAt: string;
}

/* ---------- Tasks ---------- */

export type TaskCategory =
  | 'Shelf audit'
  | 'Site survey'
  | 'Signage check'
  | 'Equipment inspection'
  | 'Delivery proof';

export type TaskStatus =
  | 'open'
  | 'assigned'
  | 'in_progress'
  | 'submitted'
  | 'in_review'
  | 'approved'
  | 'rejected'
  | 'cancelled';

export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface Task {
  id: string;
  title: string;
  description: string;
  category: TaskCategory;
  status: TaskStatus;
  priority: TaskPriority;
  customerId: string;
  location: GeoPoint & { address: string };
  dueAt: string;
  createdAt: string;
  rewardInr: number;
  assigneeId?: string;
  checklistTemplateId: string;
  distanceKm?: number;
  stateCode?: string;
  stateName?: string;
}

export interface NewTaskInput {
  title: string;
  description: string;
  category: TaskCategory;
  priority: TaskPriority;
  customerId: string;
  areaKey: string;
  address: string;
  dueAt: string;
  rewardInr: number;
  assigneeId?: string;
  checklistTemplateId: string;
  locationLat?: number;
  locationLng?: number;
}

/* ---------- Geotag & Evidence Metadata ---------- */

export interface GeotagMetadata {
  lat: number;
  lng: number;
  accuracy?: number;
  address?: string;
  timestamp: string;
  taskId?: string;
  employeeName?: string;
  source: 'in_app_camera' | 'manual_upload';
}

export interface EvidencePhoto {
  id: string;
  caption: string;
  capturedAt: string;
  url?: string;
  hue?: number;
  checklistItemId?: string;
  geotag?: GeotagMetadata;
}

export interface ChecklistResult {
  itemId: string;
  label: string;
  done: boolean;
  required: boolean;
  requiresPhoto: boolean;
  photoAttached: boolean;
}

export type AiVerificationStatus = 'not_run' | 'passed' | 'flagged' | 'failed';

export interface AiCheck {
  id: string;
  label: string;
  outcome: 'pass' | 'warn' | 'fail';
  detail: string;
}

export interface AiVerification {
  status: AiVerificationStatus;
  confidence: number | null; // 0-1
  summary: string;
  checks: AiCheck[];
  runAt: string | null;
  model?: string;
  locationMatch?: boolean;
  timestampValid?: boolean;
  contentValid?: boolean;
}

export type ManagerDecisionStatus = 'pending' | 'approved' | 'rework' | 'rejected';

export interface ManagerDecision {
  status: ManagerDecisionStatus;
  decidedBy?: string;
  decidedAt?: string;
  note?: string;
}

export interface Evidence {
  id: string;
  taskId: string;
  employeeId: string;
  submittedAt: string;
  photos: EvidencePhoto[];
  checklist: ChecklistResult[];
  ai: AiVerification;
  managerDecision: ManagerDecision;
}

export type ApprovalStage = 'awaiting_ops' | 'approved' | 'rejected' | 'escalated' | 'rework';

export interface ApprovalAuditEntry {
  stage: ApprovalStage;
  decidedAt: string;
  decidedBy?: string;
  note?: string;
}

export interface ApprovalRequest {
  id: string;
  taskId: string;
  evidenceId: string;
  employeeId: string;
  rewardInr: number;
  stage: ApprovalStage;
  submittedAt: string;
  decidedAt?: string;
  decidedBy?: string;
  note?: string;
  reworkInstructions?: string;
  history?: ApprovalAuditEntry[];
}

/* ---------- Wallet ---------- */

export type TransactionType = 'task_reward' | 'bonus' | 'withdrawal' | 'adjustment';
export type TransactionStatus = 'completed' | 'pending' | 'failed';

export interface WalletAccount {
  employeeId: string;
  balanceInr: number;
  pendingInr: number;
}

export interface WalletTransaction {
  id: string;
  employeeId: string;
  type: TransactionType;
  /** Signed: credits positive, debits negative. */
  amountInr: number;
  status: TransactionStatus;
  createdAt: string;
  reference: string;
  taskId?: string;
}

/* ---------- Dashboard ---------- */

export interface DashboardStats {
  totalTasks: number;
  openTasks: number;
  inProgress: number;
  awaitingReview: number;
  approvedTotal: number;
  activeEmployees: number;
  pendingEmployeeApprovals: number;
  awaitingOps: number;
  byStatus: Record<TaskStatus, number>;
  completionTrend: { day: string; completed: number; created: number }[];
}

/* ---------- Support Tickets ---------- */

export type TicketStatus =
  | 'OPEN'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'WAITING_ON_CUSTOMER'
  | 'RESOLVED'
  | 'CLOSED';

export type TicketUrgency = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export interface TicketComment {
  id: string;
  ticketId: string;
  authorId: string;
  authorName: string;
  message: string;
  isInternal: boolean;
  attachments?: string;
  createdAt: string;
}

export interface TicketEvent {
  id: string;
  ticketId: string;
  actorId: string;
  eventType: string;
  oldValue?: string;
  newValue?: string;
  notes?: string;
  createdAt: string;
}

export interface SupportTicket {
  id: string;
  ticketNumber: string;
  customerId: string;
  customerName: string;
  assignedTo?: string;
  assigneeName?: string;
  relatedTaskId?: string;
  subject: string;
  category: string;
  urgency: TicketUrgency;
  status: TicketStatus;
  region: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  comments?: TicketComment[];
  events?: TicketEvent[];
}

/* ---------- Worker Dashboard & Portfolio ---------- */

export interface WorkerDashboardStats {
  totalTasks: number;
  openTasks: number;
  inProgress: number;
  awaitingReview: number;
  approvedThisMonth: number;
  approvedTotal: number;
  walletAvailable: number;
  walletPending: number;
  approvalRate: number;
  reworkRate: number;
  activeTask?: {
    id: string;
    title: string;
    category: string;
    priority: string;
    area: string;
    address: string;
    rewardInr: number;
  } | null;
  dailyCompletedHistory?: Record<string, number>;
}

export interface ManagerSummary {
  id: string;
  displayName: string;
  email: string;
  phone: string;
  region: string;
}

export interface WorkerProfileView {
  id: string;
  displayName: string;
  email: string;
  phone: string;
  region: string;
  employeeCode: string;
  accountStatus: string;
  roles: string[];
  skills: string[];
  locationConsent: boolean;
  currentLat?: number | null;
  currentLng?: number | null;
  locationUpdatedAt?: string | null;
  manager?: ManagerSummary | null;
  createdAt: string;
}

export interface TaskFeedbackView {
  id: string;
  taskId: string;
  taskTitle: string;
  employeeId: string;
  employeeName: string;
  customerId: string;
  customerName: string;
  overallRating: number;
  qualityRating: number;
  punctualityRating: number;
  communicationRating: number;
  evidenceClarityRating: number;
  comment?: string;
  createdAt: string;
}

export interface WorkerPortfolioView {
  employeeId: string;
  displayName: string;
  employeeCode: string;
  tasksCompleted: number;
  approvalRate: number;
  firstTimePassRate: number;
  avgCompletionHours: number;
  onTimeRate: number;
  totalEarnedInr: number;
  averageRating: number;
  totalRatingsCount: number;
  feedbackList: TaskFeedbackView[];
  approvedEvidenceThumbnails: Array<{
    id: string;
    taskId: string;
    taskTitle: string;
    storagePath: string;
    caption: string;
    capturedAt: string;
  }>;
  badges: string[];
}

export interface AppNotification {
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

/* ---------- Area & State Scoping (Manager Area Access) ---------- */

export interface StateView {
  code: string;
  name: string;
}

export interface ManagerAreaBanner {
  managerId: string;
  managerName?: string;
  stateCode: string;
  stateName: string;
  assignedBy?: string;
  assignedAt?: string;
  isAssigned: boolean;
  /** Every zone (state) the admin assigned to this manager. */
  zones?: StateView[];
}

export interface AreaCoverageView {
  stateCode: string;
  stateName: string;
  managerId?: string | null;
  managerName?: string | null;
  managerEmail?: string | null;
  activeWorkers: number;
  pendingWorkers: number;
  openTasks: number;
  status: 'COVERED' | 'COVERAGE_GAP' | 'NO_ACTIVITY';
}

/** A field worker a task can be assigned to (GET /tasks/{id}/eligible-workers). */
export interface EligibleWorker {
  id: string;
  displayId?: string | null;
  name: string;
  zone?: string | null;
  distanceKm?: number | null;
  /** LIVE = shared GPS in the last 12 h, ZONE = registered operational zone, NONE = unknown. */
  locationSource: 'LIVE' | 'ZONE' | 'NONE';
  withinRadius: boolean;
  activeTasks: number;
}

export interface ManagerOption {
  managerId: string;
  managerName: string;
  managerEmail: string;
  stateCode?: string | null;
  stateName?: string | null;
  assignedBy?: string | null;
  assignedAt?: string | null;
  /** All zones held by this manager (one or many). */
  zones?: { stateCode: string; stateName: string }[];
}


