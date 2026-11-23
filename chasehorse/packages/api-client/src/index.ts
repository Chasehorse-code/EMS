/**
 * ChaseHorse Platform-Agnostic Typed REST Client
 * Compatible with Web (Vite) and Mobile (React Native / Expo).
 * Features: Request-ID tracking, RFC 7807 ProblemDetails mapping, 401 callback hook, typed endpoints.
 */

export interface ProblemDetails {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  instance?: string;
  errors?: Record<string, string[] | string>;
  message?: string;
  error?: string;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly problem?: ProblemDetails,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface ApiClientConfig {
  baseUrl: string;
  getAccessToken?: () => Promise<string | null> | string | null;
  onUnauthorized?: () => void;
}

function generateRequestId(): string {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
  } catch {}
  return 'req-' + Math.random().toString(36).substring(2, 12) + Date.now().toString(36);
}

export class ChaseHorseApiClient {
  private baseUrl: string;
  private getAccessToken?: () => Promise<string | null> | string | null;
  private onUnauthorized?: () => void;

  constructor(config: ApiClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.getAccessToken = config.getAccessToken;
    this.onUnauthorized = config.onUnauthorized;
  }

  public setBaseUrl(url: string) {
    this.baseUrl = url.replace(/\/$/, '');
  }

  public async request<T>(
    path: string,
    options: RequestInit & { query?: Record<string, string | number | boolean | undefined> } = {},
  ): Promise<T> {
    const { query, headers, ...rest } = options;

    const queryString = query
      ? '?' +
        new URLSearchParams(
          Object.entries(query)
            .filter(([, v]) => v !== undefined && v !== null)
            .map(([k, v]) => [k, String(v)]),
        ).toString()
      : '';

    const requestId = generateRequestId();
    const resolvedHeaders: Record<string, string> = {
      'Accept': 'application/json',
      'X-Request-Id': requestId,
      ...(headers as Record<string, string>),
    };

    if (rest.body && !resolvedHeaders['Content-Type']) {
      resolvedHeaders['Content-Type'] = 'application/json';
    }

    if (this.getAccessToken) {
      const token = await this.getAccessToken();
      if (token) {
        resolvedHeaders['Authorization'] = `Bearer ${token}`;
      }
    }

    const url = `${this.baseUrl}${path.startsWith('/') ? path : '/' + path}${queryString}`;

    const res = await fetch(url, {
      ...rest,
      headers: resolvedHeaders,
    });

    if (res.status === 401) {
      if (this.onUnauthorized) {
        this.onUnauthorized();
      }
      throw new ApiError(401, 'Unauthorized: session expired or token missing.');
    }

    if (!res.ok) {
      let problem: ProblemDetails | undefined;
      let rawText = '';
      try {
        problem = await res.json();
      } catch {
        try {
          rawText = await res.text();
        } catch {}
      }

      const message =
        problem?.detail ||
        problem?.message ||
        problem?.title ||
        problem?.error ||
        rawText ||
        `HTTP Error ${res.status}`;

      throw new ApiError(res.status, message, problem);
    }

    if (res.status === 204) {
      return undefined as unknown as T;
    }

    return (await res.json()) as T;
  }

  /* ------------------- Identity & Health ------------------- */

  async getHealth() {
    return this.request<{ status: string; service: string }>('/health');
  }

  async getMe() {
    return this.request<{
      id: string;
      email: string;
      accountStatus: string;
      roles: string[];
    }>('/me');
  }

  /* ------------------- Tasks ------------------- */

  async listTasks(query?: { customerId?: string; state?: string; status?: string }) {
    return this.request<any[]>('/tasks', { query });
  }

  async getTask(id: string) {
    return this.request<any>(`/tasks/${id}`);
  }

  async createTask(data: any) {
    return this.request<any>('/tasks', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async acceptTask(id: string) {
    return this.request<any>(`/tasks/${id}/accept`, { method: 'POST' });
  }

  async updateTaskStatus(id: string, status: string) {
    return this.request<any>(`/tasks/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }

  /* ------------------- Evidence ------------------- */

  async listEvidence(query?: { taskId?: string }) {
    return this.request<any[]>('/evidence', { query });
  }

  async submitEvidence(data: {
    taskId: string;
    storagePath: string;
    fileName?: string;
    contentType: string;
    fileSizeBytes?: number;
    caption?: string;
    locationLat?: number;
    locationLng?: number;
  }) {
    return this.request<any>('/evidence', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async decideEvidence(id: string, status: string, note?: string) {
    return this.request<any>(`/evidence/${id}/manager-decision`, {
      method: 'POST',
      body: JSON.stringify({ status, note }),
    });
  }

  /* ------------------- Approvals ------------------- */

  async listApprovals() {
    return this.request<any[]>('/approvals');
  }

  async decideApproval(id: string, decision: 'APPROVED' | 'REJECTED' | 'REWORK_REQUESTED', notes?: string) {
    return this.request<any>(`/approvals/${id}/decision`, {
      method: 'POST',
      body: JSON.stringify({ decision, notes }),
    });
  }

  /* ------------------- Wallets ------------------- */

  async getMyWallet() {
    return this.request<{ employeeId: string; balanceInr: number; pendingInr: number }>('/wallets/me');
  }

  async getWalletTransactions(employeeId: string) {
    return this.request<any[]>(`/wallets/${employeeId}/transactions`);
  }

  /* ------------------- Employees & Directory ------------------- */

  async listEmployees(state?: string) {
    return this.request<any[]>('/employees', { query: { state } });
  }

  async updateEmployeeApproval(id: string, status: string, role?: string, reason?: string) {
    return this.request<any>(`/employees/${id}/approval`, {
      method: 'PATCH',
      body: JSON.stringify({ status, role, reason }),
    });
  }

  /* ------------------- Areas ------------------- */

  async getMyArea() {
    return this.request<{ stateCode: string; stateName: string; isAssigned: boolean }>('/areas/my-area');
  }

  async getAreaCoverage(state?: string) {
    return this.request<any[]>('/areas/coverage', { query: { state } });
  }

  async listAdminManagers() {
    return this.request<any[]>('/admin/managers');
  }

  async assignManagerArea(managerId: string, stateCode: string) {
    return this.request<any>(`/admin/managers/${managerId}/area`, {
      method: 'PUT',
      body: JSON.stringify({ stateCode }),
    });
  }

  /* ------------------- Notifications ------------------- */

  async listNotifications() {
    return this.request<any[]>('/notifications');
  }

  async getUnreadNotificationsCount() {
    return this.request<{ unreadCount: number }>('/notifications/unread-count');
  }

  async markAllNotificationsRead() {
    return this.request<{ updated: number }>('/notifications/mark-all-read', { method: 'POST' });
  }

  async markNotificationRead(id: string) {
    return this.request<{ id: string; read: boolean }>(`/notifications/${id}/read`, { method: 'PATCH' });
  }

  /* ------------------- Support Tickets ------------------- */

  async listTickets(query?: { status?: string; urgency?: string; search?: string }) {
    return this.request<any[]>('/tickets', { query });
  }

  async createTicket(data: {
    subject: string;
    category?: string;
    urgency?: string;
    message: string;
    relatedTaskId?: string;
    region?: string;
    attachments?: string;
  }) {
    return this.request<any>('/tickets', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async addTicketComment(id: string, message: string, isInternal: boolean = false, attachments?: string) {
    return this.request<any>(`/tickets/${id}/comments`, {
      method: 'POST',
      body: JSON.stringify({ message, isInternal, attachments }),
    });
  }

  /* ------------------- Feedback & Ratings ------------------- */

  async getTaskFeedback(taskId: string) {
    return this.request<any>(`/tasks/${taskId}/feedback`);
  }

  async submitTaskFeedback(taskId: string, data: {
    overallRating: number;
    qualityRating?: number;
    punctualityRating?: number;
    communicationRating?: number;
    evidenceClarityRating?: number;
    comment?: string;
  }) {
    return this.request<any>(`/tasks/${taskId}/feedback`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /* ------------------- TMS ------------------- */

  async getTmsPlans() {
    return this.request<any[]>('/tms/plans');
  }

  async getTmsTracking(bookingRef: string) {
    return this.request<any>(`/tms/tracking/${bookingRef}`);
  }

  /* ------------------- Dashboard ------------------- */

  async getDashboardStats(scope?: { customerId?: string }) {
    return this.request<any>('/dashboard/stats', { query: scope });
  }
}
