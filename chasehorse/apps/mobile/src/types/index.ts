export type Role = 'admin' | 'manager' | 'operations' | 'employee' | 'customer' | 'partner' | 'verifier';

export type TaskStatus =
  | 'open'
  | 'assigned'
  | 'in_progress'
  | 'submitted'
  | 'in_review'
  | 'approved'
  | 'rejected'
  | 'cancelled'
  | 'completed';

export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';

export type TaskCategory =
  | 'Unspecified'
  | 'Shelf audit'
  | 'Site survey'
  | 'Signage check'
  | 'Equipment inspection'
  | 'Delivery proof';

export type EmployeeSubRole = 'on_field' | 'manager';

export interface GeoPoint {
  lat: number;
  lng: number;
  area?: string;
  address?: string;
}

export interface TaskChecklistItem {
  id: string;
  label: string;
  done: boolean;
  requiresPhoto: boolean;
}

export interface Task {
  id: string;
  displayId?: string;
  title: string;
  description: string;
  category: TaskCategory;
  status: TaskStatus;
  priority: TaskPriority;
  customerId: string;
  createdByName?: string;
  createdByRole?: string;
  geofenceRadiusMeters?: number;
  location: GeoPoint & { address: string };
  dueAt: string;
  createdAt: string;
  rewardInr: number;
  assigneeId?: string;
  checklistTemplateId: string;
  checklist?: TaskChecklistItem[];
  distanceKm?: number;
  photoProofRequired?: boolean;
  geotagRequired?: boolean;
}

export interface NewTaskInput {
  title: string;
  description: string;
  category: TaskCategory;
  priority: TaskPriority;
  customerId?: string;
  areaKey: string;
  address: string;
  dueAt: string;
  rewardInr: number;
  assigneeId?: string;
  checklistTemplateId: string;
  locationLat?: number;
  locationLng?: number;
  checklistItems?: string[];
}

export interface WalletTransaction {
  id: string;
  type: 'CREDIT' | 'DEBIT' | 'HOLD';
  amount: number;
  description: string;
  createdAt: string;
  taskId?: string;
  status: 'COMPLETED' | 'PENDING';
}

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  phone?: string;
  role: Role;
  subRole?: EmployeeSubRole;
  accountStatus: 'pending' | 'approved' | 'active' | 'rejected' | 'suspended';
  companyName?: string;
  gstin?: string;
  region?: string;
  createdAt: string;
  token?: string;
}

export interface GeotagMetadata {
  lat: number;
  lng: number;
  accuracy: number;
  address: string;
  timestamp: string;
  taskId?: string;
  workerName?: string;
}

export interface TruckPlan {
  id: string;
  name: string;
  capacity: string;
  dimensions: string;
  baseRateInr: number;
  perKmRateInr: number;
  recommendedFor: string;
  availableVehicles: number;
}

export interface ShipmentMilestone {
  title: string;
  location: string;
  time: string;
  completed: boolean;
  current?: boolean;
}

export interface DashboardStats {
  totalTasks: number;
  openTasks: number;
  inProgress: number;
  awaitingReview: number;
  approvedTotal: number;
  activeEmployees: number;
  pendingEmployeeApprovals: number;
  awaitingOps: number;
  byStatus: Record<string, number>;
}

export interface ChecklistTemplateItem {
  id: string;
  label: string;
  required: boolean;
  requiresPhoto: boolean;
  sortOrder: number;
}

export interface ChecklistTemplate {
  id: string;
  name: string;
  title?: string;
  itemCount?: number;
  category: string;
  items: ChecklistTemplateItem[];
}

export interface EvidenceRecord {
  id: string;
  taskId: string;
  submittedBy: string;
  createdAt: string;
  photos: {
    id: string;
    storagePath: string;
    fileName: string;
    caption?: string;
    locationLat?: number;
    locationLng?: number;
    capturedAt?: string;
  }[];
  ai: {
    status: string;
    confidence?: number;
    summary?: string;
  };
  manager: {
    status: string;
    decidedBy?: string;
    decidedAt?: string;
    notes?: string;
  };
}

export interface ApprovalRequestItem {
  id: string;
  taskId: string;
  evidenceId?: string;
  employeeId?: string;
  rewardInr: number;
  stage: string;
  submittedAt: string;
  note?: string;
}

export interface EmployeeDirectoryItem {
  id: string;
  displayId?: string;
  displayName: string;
  email: string;
  phone?: string;
  region?: string;
  stateCode?: string;
  accountStatus: string;
  rejectionReason?: string;
  rejectedBy?: string;
  roles: string[];
  createdAt: string;
}

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  type: string;
  entityType?: string;
  entityId?: string;
  read: boolean;
  createdAt: string;
}

export interface WalletAccount {
  employeeId: string;
  balanceInr: number;
  pendingInr: number;
}

export interface WorkerDashboardStats {
  tasksAvailableNearby: number;
  tasksInProgress: number;
  tasksAwaitingReview: number;
  tasksApprovedThisMonth: number;
  walletAvailablePaise: number;
  walletPendingApprovalPaise: number;
  lifetimeEarnedPaise: number;
  approvalRate: number;
  reworkRate: number;
  recentActivity: Array<{
    id: string;
    title: string;
    timestamp: string;
    type: string;
  }>;
  completionHistory: Array<{
    date: string;
    completedCount: number;
  }>;
  activeTask?: {
    id: string;
    title: string;
    category?: string;
    area?: string;
    rewardInr: number;
    checklistProgress: number;
    checklistTotal: number;
  };
}
