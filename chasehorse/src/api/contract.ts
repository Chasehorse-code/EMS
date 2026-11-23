import type {
  ApprovalRequest,
  ApprovalStage,
  ChecklistTemplate,
  Customer,
  DashboardStats,
  Employee,
  EmployeeApprovalStatus,
  EmployeeSubRole,
  Evidence,
  ManagerDecisionStatus,
  NewTaskInput,
  Task,
  WalletAccount,
  WalletTransaction,
} from '@/types';

/**
 * The single seam between the UI and the Spring Boot backend (`/api/v1/*`).
 */
export interface Actor {
  name: string;
}

export interface ChaseHorseApi {
  getDashboardStats(scope?: { customerId?: string }): Promise<DashboardStats>;

  listCustomers(): Promise<Customer[]>;

  listTasks(scope?: { customerId?: string; state?: string }): Promise<Task[]>;
  listNearbyTasks(lat: number, lng: number, radiusKm?: number): Promise<Task[]>;
  createTask(input: NewTaskInput): Promise<Task>;
  assignTask(taskId: string, employeeId: string): Promise<Task>;
  acceptTask(taskId: string): Promise<Task>;
  rejectTask(taskId: string, reason?: string): Promise<Task>;

  listEmployees(scope?: { state?: string }): Promise<Employee[]>;
  setEmployeeApproval(
    employeeId: string,
    status: EmployeeApprovalStatus,
    role?: string | EmployeeSubRole,
    reason?: string,
  ): Promise<Employee>;

  listChecklists(): Promise<ChecklistTemplate[]>;
  createChecklist(template: {
    name: string;
    category: string;
    items: Array<{ label: string; required: boolean; requiresPhoto: boolean; sortOrder: number }>;
  }): Promise<ChecklistTemplate>;
  saveChecklist(template: ChecklistTemplate): Promise<ChecklistTemplate>;

  updateProfile(data: {
    displayName?: string;
    phone?: string;
    region?: string;
    avatarUrl?: string;
  }): Promise<any>;

  listEvidence(scope?: { customerId?: string }): Promise<Evidence[]>;
  submitEvidence(
    taskId: string,
    payload: {
      photos: Array<{
        caption: string;
        url: string;
        checklistItemId?: string;
        geotag?: any;
      }>;
      checklist: Array<{ itemId: string; label: string; done: boolean }>;
      aiResult?: any;
    },
  ): Promise<Evidence>;
  decideEvidence(
    evidenceId: string,
    status: Exclude<ManagerDecisionStatus, 'pending'>,
    note: string,
    actor: Actor,
  ): Promise<Evidence>;

  listApprovals(): Promise<ApprovalRequest[]>;
  decideApproval(
    approvalId: string,
    stage: Exclude<ApprovalStage, 'awaiting_ops'>,
    note: string,
    actor: Actor,
    reworkInstructions?: string,
  ): Promise<ApprovalRequest>;

  listWalletAccounts(): Promise<WalletAccount[]>;
  listTransactions(employeeId: string): Promise<WalletTransaction[]>;

  listTickets(filter?: { status?: string; urgency?: string; search?: string }): Promise<import('@/types').SupportTicket[]>;
  getTicket(id: string): Promise<import('@/types').SupportTicket>;
  createTicket(input: {
    subject: string;
    category?: string;
    urgency?: string;
    message: string;
    relatedTaskId?: string;
    region?: string;
    attachments?: string;
  }): Promise<import('@/types').SupportTicket>;
  addTicketComment(
    ticketId: string,
    message: string,
    isInternal?: boolean,
    attachments?: string,
  ): Promise<import('@/types').TicketComment>;
  updateTicketStatus(ticketId: string, status: string, notes?: string): Promise<import('@/types').SupportTicket>;
  assignTicket(ticketId: string, staffId: string): Promise<import('@/types').SupportTicket>;

  // Worker Profile, Portfolio, & GPS
  getWorkerStats(): Promise<import('@/types').WorkerDashboardStats>;
  getWorkerProfile(): Promise<import('@/types').WorkerProfileView>;
  updateWorkerProfile(data: {
    displayName?: string;
    phone?: string;
    region?: string;
    skills?: string[];
    locationConsent?: boolean;
  }): Promise<import('@/types').WorkerProfileView>;
  updateWorkerLocation(coords: { lat: number; lng: number; accuracy?: number }): Promise<any>;
  clearWorkerLocation(): Promise<any>;
  getWorkerPortfolio(employeeId: string): Promise<import('@/types').WorkerPortfolioView>;
  rejectTaskOffer(taskId: string, reason?: string): Promise<any>;
  dropTask(taskId: string, reason: string): Promise<void>;
  getEligibleWorkers(taskId: string): Promise<import('@/types').EligibleWorker[]>;

  // Task Feedback & Ratings
  submitTaskFeedback(taskId: string, payload: {
    overallRating: number;
    qualityRating?: number;
    punctualityRating?: number;
    communicationRating?: number;
    evidenceClarityRating?: number;
    comment?: string;
  }): Promise<import('@/types').TaskFeedbackView>;
  getTaskFeedback(taskId: string): Promise<import('@/types').TaskFeedbackView>;
  getEmployeeFeedback(employeeId: string): Promise<import('@/types').TaskFeedbackView[]>;

  // Notifications
  getNotifications(): Promise<import('@/types').AppNotification[]>;
  getUnreadNotificationCount(): Promise<number>;
  markNotificationRead(id: string): Promise<void>;
  markAllNotificationsRead(): Promise<void>;

  // Area & State Scoping (Manager Area Access)
  getStates(): Promise<import('@/types').StateView[]>;
  getMyArea(): Promise<import('@/types').ManagerAreaBanner>;
  getAreaCoverage(state?: string): Promise<import('@/types').AreaCoverageView[]>;
  getAdminManagers(): Promise<import('@/types').ManagerOption[]>;
  /** Replace a manager's zones; an empty list unassigns them. */
  assignManagerZones(managerId: string, stateCodes: string[]): Promise<import('@/types').ManagerOption>;
}

