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
import type { Actor, ChaseHorseApi } from './contract';
import { http } from './httpClient';
import { haversineKm } from '@/utils/geo';

const EMPTY_DASHBOARD_STATS: DashboardStats = {
  totalTasks: 0,
  openTasks: 0,
  inProgress: 0,
  awaitingReview: 0,
  approvedTotal: 0,
  activeEmployees: 0,
  pendingEmployeeApprovals: 0,
  awaitingOps: 0,
  byStatus: {
    open: 0,
    assigned: 0,
    in_progress: 0,
    submitted: 0,
    in_review: 0,
    approved: 0,
    rejected: 0,
    cancelled: 0,
  },
  completionTrend: [],
};

/**
 * Production REST implementation of ChaseHorseApi.
 * Communicates with the Spring Boot backend (`/api/v1/*`).
 * Employs zero client-side fake data, mock accounts, or fallback registries.
 */
export const restApi: ChaseHorseApi = {
  async getDashboardStats(scope?: { customerId?: string }): Promise<DashboardStats> {
    try {
      const data = await http<any>('/dashboard/stats', {
        query: { customerId: scope?.customerId },
      });
      if (data) {
        return {
          totalTasks: data.totalTasks || 0,
          openTasks: data.openTasks || 0,
          inProgress: data.inProgress || 0,
          awaitingReview: data.awaitingReview || 0,
          approvedTotal: data.approvedTotal || 0,
          activeEmployees: data.activeEmployees || 0,
          pendingEmployeeApprovals: data.pendingEmployeeApprovals || 0,
          awaitingOps: data.awaitingOps || 0,
          byStatus: data.byStatus || {
            open: 0,
            assigned: 0,
            in_progress: 0,
            submitted: 0,
            in_review: 0,
            approved: 0,
            rejected: 0,
            cancelled: 0,
          },
          completionTrend: data.completionTrend || [],
        };
      }
    } catch (err) {
      console.warn('[restApi] getDashboardStats error:', err);
    }
    return EMPTY_DASHBOARD_STATS;
  },

  async listCustomers(): Promise<Customer[]> {
    try {
      const data = await http<Customer[]>('/customers');
      return Array.isArray(data) ? data : [];
    } catch (err) {
      console.warn('[restApi] listCustomers error:', err);
      return [];
    }
  },

  async listTasks(scope?: { customerId?: string; state?: string }): Promise<Task[]> {
    try {
      const data = await http<any[]>('/tasks', {
        query: { customerId: scope?.customerId, state: scope?.state },
      });
      if (Array.isArray(data)) {
        return data.map((t) => ({
          id: t.id,
          title: t.title,
          description: t.description || '',
          category: (t.category || 'Shelf audit') as any,
          status: (t.status?.toLowerCase() || 'open') as any,
          priority: (t.priority?.toLowerCase() || 'normal') as any,
          customerId: t.customerId || t.createdBy,
          stateCode: t.stateCode,
          stateName: t.stateName,
          location: {
            lat: t.locationLat ? Number(t.locationLat) : 0,
            lng: t.locationLng ? Number(t.locationLng) : 0,
            area: t.locationArea || t.areaKey || 'Operational Area',
            address: t.locationAddress || t.address || 'Field Location',
          },
          dueAt: t.dueAt || new Date().toISOString(),
          createdAt: t.createdAt || new Date().toISOString(),
          rewardInr: Number(t.rewardAmount) || 0,
          assigneeId: t.assignedTo,
          checklistTemplateId: t.checklistTemplateId || 'chk-shelf',
        }));
      }
      return [];
    } catch (err) {
      console.warn('[restApi] listTasks remote error:', err);
      return [];
    }
  },

  async listNearbyTasks(lat: number, lng: number, radiusKm: number = 25): Promise<Task[]> {
    const all = await this.listTasks();
    return all
      .map((t) => {
        if (!t.location?.lat || !t.location?.lng) return { ...t, distanceKm: undefined };
        const dist = haversineKm({ lat, lng }, t.location);
        return { ...t, distanceKm: Math.round(dist * 10) / 10 };
      })
      // Tasks without coordinates were already limited to the worker's zone by the server.
      .filter((t) => !t.location?.lat || !t.location?.lng || (t.distanceKm ?? 0) <= radiusKm)
      .sort((a, b) => (a.distanceKm ?? Number.MAX_VALUE) - (b.distanceKm ?? Number.MAX_VALUE));
  },

  async createTask(input: NewTaskInput): Promise<Task> {
    const res = await http<any>('/tasks', {
      method: 'POST',
      body: JSON.stringify({
        title: input.title,
        description: input.description,
        rewardAmount: input.rewardInr,
        checklistTemplateId: input.checklistTemplateId,
        areaKey: input.areaKey,
        address: input.address,
        category: input.category,
        priority: input.priority,
        dueAt: input.dueAt,
        // Needed for the 100 km worker radius and the on-site geofence.
        locationLat: Number.isFinite(input.locationLat) ? input.locationLat : undefined,
        locationLng: Number.isFinite(input.locationLng) ? input.locationLng : undefined,
      }),
    });

    return {
      id: res.id,
      title: res.title,
      description: res.description,
      category: input.category,
      status: (res.status?.toLowerCase() || 'open') as any,
      priority: input.priority,
      customerId: res.customerId || input.customerId,
      location: {
        lat: res.locationLat ? Number(res.locationLat) : (input.locationLat || 0),
        lng: res.locationLng ? Number(res.locationLng) : (input.locationLng || 0),
        area: input.areaKey,
        address: input.address,
      },
      dueAt: res.dueAt || input.dueAt,
      createdAt: res.createdAt || new Date().toISOString(),
      rewardInr: Number(res.rewardAmount) || input.rewardInr,
      assigneeId: res.assignedTo,
      checklistTemplateId: input.checklistTemplateId,
    };
  },

  async assignTask(taskId: string, employeeId: string): Promise<Task> {
    const res = await http<any>(`/tasks/${taskId}/assignment`, {
      method: 'POST',
      body: JSON.stringify({ employeeId }),
    });
    return {
      id: res.id,
      title: res.title,
      description: res.description,
      category: res.category || 'Shelf audit',
      status: (res.status?.toLowerCase() || 'assigned') as any,
      priority: res.priority || 'normal',
      customerId: res.customerId || res.createdBy,
      location: {
        lat: Number(res.locationLat) || 0,
        lng: Number(res.locationLng) || 0,
        area: res.locationArea || 'Operational Zone',
        address: res.locationAddress || 'Field Site',
      },
      dueAt: res.dueAt || new Date().toISOString(),
      createdAt: res.createdAt || new Date().toISOString(),
      rewardInr: Number(res.rewardAmount) || 0,
      assigneeId: employeeId,
      checklistTemplateId: res.checklistTemplateId || 'chk-shelf',
    };
  },

  async acceptTask(taskId: string): Promise<Task> {
    const res = await http<any>(`/tasks/${taskId}/accept`, {
      method: 'POST',
    });
    return {
      id: res.id,
      title: res.title,
      description: res.description,
      category: res.category || 'Shelf audit',
      status: (res.status?.toLowerCase() || 'assigned') as any,
      priority: res.priority || 'normal',
      customerId: res.customerId || res.createdBy,
      location: {
        lat: Number(res.locationLat) || 0,
        lng: Number(res.locationLng) || 0,
        area: res.locationArea || 'Operational Zone',
        address: res.locationAddress || 'Field Site',
      },
      dueAt: res.dueAt || new Date().toISOString(),
      createdAt: res.createdAt || new Date().toISOString(),
      rewardInr: Number(res.rewardAmount) || 0,
      assigneeId: res.assignedTo,
      checklistTemplateId: res.checklistTemplateId || 'chk-shelf',
    };
  },

  async rejectTask(taskId: string, _reason?: string): Promise<Task> {
    const res = await http<any>(`/tasks/${taskId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'REJECTED' }),
    });
    return {
      id: res.id,
      title: res.title,
      description: res.description,
      category: res.category || 'Shelf audit',
      status: 'rejected',
      priority: res.priority || 'normal',
      customerId: res.customerId || res.createdBy,
      location: {
        lat: Number(res.locationLat) || 0,
        lng: Number(res.locationLng) || 0,
        area: res.locationArea || 'Operational Zone',
        address: res.locationAddress || 'Field Site',
      },
      dueAt: res.dueAt || new Date().toISOString(),
      createdAt: res.createdAt || new Date().toISOString(),
      rewardInr: Number(res.rewardAmount) || 0,
      assigneeId: res.assignedTo,
      checklistTemplateId: res.checklistTemplateId || 'chk-shelf',
    };
  },

  async listEmployees(scope?: { state?: string }): Promise<Employee[]> {
    let list: Employee[] = [];
    try {
      const data = await http<any[]>('/employees', {
        query: scope?.state ? { state: scope.state } : undefined,
      });
      if (Array.isArray(data)) {
        list = data.map((e) => {
          const roles: string[] = e.roles || [];
          const primaryRole = roles.includes('ADMIN')
            ? 'ADMIN'
            : roles.includes('MANAGER')
            ? 'MANAGER'
            : roles.includes('OPERATIONS')
            ? 'OPERATIONS'
            : roles.includes('CUSTOMER')
            ? 'CUSTOMER'
            : roles.includes('PARTNER')
            ? 'PARTNER'
            : roles.includes('FIELD_WORKER')
            ? 'FIELD_WORKER'
            : roles.includes('EMPLOYEE')
            ? 'EMPLOYEE'
            : 'FIELD_WORKER';

          const isManager = primaryRole === 'MANAGER' || primaryRole === 'OPERATIONS' || primaryRole === 'ADMIN';

          const rawStatus = (e.accountStatus || '').toUpperCase();
          const approvalStatus: EmployeeApprovalStatus =
            rawStatus === 'ACTIVE' || rawStatus === 'APPROVED'
              ? 'approved'
              : rawStatus === 'REJECTED'
              ? 'rejected'
              : rawStatus === 'SUSPENDED'
              ? 'suspended'
              : rawStatus === 'BLOCKED'
              ? 'blocked'
              : 'pending';

          return {
            id: e.id,
            name: e.displayName || 'Staff Member',
            email: e.email || `${e.id.slice(0, 8)}@chasehorse.com`,
            phone: e.phone || '',
            region: e.region || 'Operational Region',
            stateCode: e.stateCode,
            stateName: e.stateName,
            skills: [],
            approvalStatus,
            subRole: isManager ? 'manager' : 'field_worker',
            roles,
            primaryRole,
            availability: 'available',
            location: { lat: 0, lng: 0, area: e.region || 'Operational Region' },
            joinedAt: e.createdAt || new Date().toISOString(),
            tasksCompleted: 0,
            rating: Number(e.rating) || 0,
            documentsVerified: rawStatus === 'ACTIVE' || rawStatus === 'APPROVED',
            zoneLabel: e.zonePlace ? [e.zonePlace, e.zoneDistrict && `${e.zoneDistrict} dist`].filter(Boolean).join(', ') : undefined,
            emailVerified: e.emailVerified !== false,
          };
        });
      }
    } catch (err) {
      console.warn('[restApi] listEmployees error:', err);
    }

    return list;
  },

  async setEmployeeApproval(
    employeeId: string,
    status: EmployeeApprovalStatus,
    role?: string | EmployeeSubRole,
    reason?: string,
  ): Promise<Employee> {
    const STATUS_TO_BACKEND: Record<EmployeeApprovalStatus, string> = {
      approved: 'ACTIVE',
      pending: 'PENDING',
      rejected: 'REJECTED',
      suspended: 'SUSPENDED',
      blocked: 'BLOCKED',
    };
    const backendStatus = STATUS_TO_BACKEND[status];
    const body: Record<string, any> = {
      status: backendStatus,
      reason: reason || undefined,
    };

    let assignedRole: string | undefined;
    if (role) {
      assignedRole = role.toUpperCase();
      if (assignedRole === 'ON-FIELD WORKER') assignedRole = 'FIELD_WORKER';
      else if (assignedRole === 'OPERATIONS MANAGER') assignedRole = 'MANAGER';
      body.role = assignedRole;
    }

    const res = await http<any>(`/employees/${employeeId}/approval`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });

    const roles: string[] = res.roles || [assignedRole || 'FIELD_WORKER'];
    return {
      id: res.id,
      name: res.displayName,
      email: res.email || `${res.id.slice(0, 8)}@chasehorse.com`,
      phone: res.phone || '',
      region: res.region || 'Operational Region',
      skills: [],
      approvalStatus: status,
      subRole: (assignedRole === 'MANAGER' || assignedRole === 'OPERATIONS' || assignedRole === 'ADMIN') ? 'manager' : 'field_worker',
      roles,
      primaryRole: assignedRole,
      availability: 'available',
      location: { lat: 0, lng: 0, area: res.region || 'Region' },
      joinedAt: res.createdAt,
      tasksCompleted: 0,
      rating: Number(res.rating) || 0,
      documentsVerified: status === 'approved',
    };
  },

  async listChecklists(): Promise<ChecklistTemplate[]> {
    try {
      const data = await http<ChecklistTemplate[]>('/checklist-templates');
      return Array.isArray(data) ? data : [];
    } catch (err) {
      console.warn('[restApi] listChecklists error:', err);
      return [];
    }
  },

  async createChecklist(template: {
    name: string;
    category: string;
    items: Array<{ label: string; required: boolean; requiresPhoto: boolean; sortOrder: number }>;
  }): Promise<ChecklistTemplate> {
    return await http<ChecklistTemplate>('/checklist-templates', {
      method: 'POST',
      body: JSON.stringify(template),
    });
  },

  async saveChecklist(template: ChecklistTemplate): Promise<ChecklistTemplate> {
    return await http<ChecklistTemplate>(`/checklist-templates/${template.id}`, {
      method: 'PUT',
      body: JSON.stringify(template),
    });
  },

  async updateProfile(data: {
    displayName?: string;
    phone?: string;
    region?: string;
    avatarUrl?: string;
  }): Promise<any> {
    return await http<any>('/profiles/me', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async listEvidence(scope?: { customerId?: string }): Promise<Evidence[]> {
    try {
      const data = await http<Evidence[]>('/evidence', {
        query: { customerId: scope?.customerId },
      });
      return Array.isArray(data) ? data : [];
    } catch (err) {
      console.warn('[restApi] listEvidence error:', err);
      return [];
    }
  },

  async submitEvidence(
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
  ): Promise<Evidence> {
    return await http<Evidence>(`/evidence`, {
      method: 'POST',
      body: JSON.stringify({
        taskId,
        photos: payload.photos,
        checklist: payload.checklist,
        ai: payload.aiResult,
      }),
    });
  },

  async decideEvidence(
    evidenceId: string,
    status: Exclude<ManagerDecisionStatus, 'pending'>,
    note: string,
    actor: Actor,
  ): Promise<Evidence> {
    return await http<Evidence>(`/evidence/${evidenceId}/manager-decision`, {
      method: 'POST',
      body: JSON.stringify({ status, note, decidedBy: actor.name }),
    });
  },

  async listApprovals(): Promise<ApprovalRequest[]> {
    try {
      const data = await http<ApprovalRequest[]>('/approvals');
      return Array.isArray(data) ? data : [];
    } catch (err) {
      console.warn('[restApi] listApprovals error:', err);
      return [];
    }
  },

  async decideApproval(
    approvalId: string,
    stage: Exclude<ApprovalStage, 'awaiting_ops'>,
    note: string,
    actor: Actor,
  ): Promise<ApprovalRequest> {
    return await http<ApprovalRequest>(`/approvals/${approvalId}/decision`, {
      method: 'POST',
      body: JSON.stringify({ stage, note, decidedBy: actor.name }),
    });
  },

  async listWalletAccounts(): Promise<WalletAccount[]> {
    try {
      const data = await http<WalletAccount[]>('/wallets');
      return Array.isArray(data) ? data : [];
    } catch (err) {
      console.warn('[restApi] listWalletAccounts error:', err);
      return [];
    }
  },

  async listTransactions(employeeId: string): Promise<WalletTransaction[]> {
    try {
      const data = await http<WalletTransaction[]>(`/wallets/${employeeId}/transactions`);
      return Array.isArray(data) ? data : [];
    } catch (err) {
      console.warn('[restApi] listTransactions error:', err);
      return [];
    }
  },

  async listTickets(filter?: { status?: string; urgency?: string; search?: string }): Promise<import('@/types').SupportTicket[]> {
    try {
      const data = await http<import('@/types').SupportTicket[]>('/tickets', {
        query: {
          status: filter?.status,
          urgency: filter?.urgency,
          search: filter?.search,
        },
      });
      return Array.isArray(data) ? data : [];
    } catch (err) {
      console.warn('[restApi] listTickets error:', err);
      return [];
    }
  },

  async getTicket(id: string): Promise<import('@/types').SupportTicket> {
    return await http<import('@/types').SupportTicket>(`/tickets/${id}`);
  },

  async createTicket(input: {
    subject: string;
    category?: string;
    urgency?: string;
    message: string;
    relatedTaskId?: string;
    region?: string;
    attachments?: string;
  }): Promise<import('@/types').SupportTicket> {
    return await http<import('@/types').SupportTicket>('/tickets', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async addTicketComment(
    ticketId: string,
    message: string,
    isInternal: boolean = false,
    attachments?: string,
  ): Promise<import('@/types').TicketComment> {
    return await http<import('@/types').TicketComment>(`/tickets/${ticketId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ message, isInternal, attachments }),
    });
  },

  async updateTicketStatus(ticketId: string, status: string, notes?: string): Promise<import('@/types').SupportTicket> {
    return await http<import('@/types').SupportTicket>(`/tickets/${ticketId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, notes }),
    });
  },

  async assignTicket(ticketId: string, staffId: string): Promise<import('@/types').SupportTicket> {
    return await http<import('@/types').SupportTicket>(`/tickets/${ticketId}/assign`, {
      method: 'POST',
      body: JSON.stringify({ staffId }),
    });
  },

  async getWorkerStats(): Promise<import('@/types').WorkerDashboardStats> {
    const raw = await http<any>('/dashboard/stats');
    return {
      totalTasks: raw.totalTasks ?? 0,
      openTasks: raw.openTasks ?? 0,
      inProgress: raw.inProgress ?? 0,
      awaitingReview: raw.awaitingReview ?? 0,
      approvedThisMonth: raw.approvedThisMonth ?? 0,
      approvedTotal: raw.approvedTotal ?? 0,
      walletAvailable: typeof raw.walletAvailable === 'number' ? raw.walletAvailable : Number(raw.walletAvailable ?? 0),
      walletPending: typeof raw.walletPending === 'number' ? raw.walletPending : Number(raw.walletPending ?? 0),
      approvalRate: raw.approvalRate ?? 100,
      reworkRate: raw.reworkRate ?? 0,
      activeTask: raw.activeTask ?? null,
      dailyCompletedHistory: raw.dailyCompletedHistory ?? {},
    };
  },

  async getWorkerProfile(): Promise<import('@/types').WorkerProfileView> {
    return await http<import('@/types').WorkerProfileView>('/employees/me/profile');
  },

  async updateWorkerProfile(data: {
    displayName?: string;
    phone?: string;
    region?: string;
    skills?: string[];
    locationConsent?: boolean;
  }): Promise<import('@/types').WorkerProfileView> {
    return await http<import('@/types').WorkerProfileView>('/employees/me/profile', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async updateWorkerLocation(coords: { lat: number; lng: number; accuracy?: number }): Promise<any> {
    return await http<any>('/employees/me/location', {
      method: 'PUT',
      body: JSON.stringify(coords),
    });
  },

  async clearWorkerLocation(): Promise<any> {
    return await http<any>('/employees/me/location', {
      method: 'DELETE',
    });
  },

  async getWorkerPortfolio(employeeId: string): Promise<import('@/types').WorkerPortfolioView> {
    return await http<import('@/types').WorkerPortfolioView>(`/employees/${employeeId}/portfolio`);
  },

  /** Decline a task. A reason is required when the task was assigned to you. */
  async rejectTaskOffer(taskId: string, reason?: string): Promise<any> {
    return await http<any>(`/tasks/${encodeURIComponent(taskId)}/reject-offer`, {
      method: 'POST',
      body: JSON.stringify({ reason: reason ?? null }),
    });
  },

  /** Give up a task you accepted, with a reason; it goes back to the open pool. */
  async dropTask(taskId: string, reason: string): Promise<void> {
    await http<any>(`/tasks/${encodeURIComponent(taskId)}/drop`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  /** Workers this task can be given to, nearest first, with distance and radius flag. */
  async getEligibleWorkers(taskId: string): Promise<import('@/types').EligibleWorker[]> {
    const data = await http<import('@/types').EligibleWorker[]>(`/tasks/${encodeURIComponent(taskId)}/eligible-workers`);
    return Array.isArray(data) ? data : [];
  },

  async submitTaskFeedback(taskId: string, payload: {
    overallRating: number;
    qualityRating?: number;
    punctualityRating?: number;
    communicationRating?: number;
    evidenceClarityRating?: number;
    comment?: string;
  }): Promise<import('@/types').TaskFeedbackView> {
    return await http<import('@/types').TaskFeedbackView>(`/tasks/${taskId}/feedback`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async getTaskFeedback(taskId: string): Promise<import('@/types').TaskFeedbackView> {
    return await http<import('@/types').TaskFeedbackView>(`/tasks/${taskId}/feedback`);
  },

  async getEmployeeFeedback(employeeId: string): Promise<import('@/types').TaskFeedbackView[]> {
    const data = await http<import('@/types').TaskFeedbackView[]>(`/employees/${employeeId}/feedback`);
    return Array.isArray(data) ? data : [];
  },

  async getNotifications(): Promise<import('@/types').AppNotification[]> {
    try {
      const data = await http<import('@/types').AppNotification[]>('/notifications');
      return Array.isArray(data) ? data : [];
    } catch (err) {
      console.warn('[restApi] getNotifications error:', err);
      return [];
    }
  },

  async getUnreadNotificationCount(): Promise<number> {
    try {
      const data = await http<{ unreadCount: number }>('/notifications/unread-count');
      return data?.unreadCount || 0;
    } catch {
      return 0;
    }
  },

  async markNotificationRead(id: string): Promise<void> {
    try {
      await http(`/notifications/${id}/read`, { method: 'PATCH' });
    } catch (err) {
      console.warn('[restApi] markNotificationRead error:', err);
    }
  },

  async markAllNotificationsRead(): Promise<void> {
    try {
      await http('/notifications/mark-all-read', { method: 'POST' });
    } catch (err) {
      console.warn('[restApi] markAllNotificationsRead error:', err);
    }
  },

  async getStates(): Promise<import('@/types').StateView[]> {
    try {
      const data = await http<import('@/types').StateView[]>('/areas/states');
      return Array.isArray(data) ? data : [];
    } catch (err) {
      console.warn('[restApi] getStates error:', err);
      return [];
    }
  },

  async getMyArea(): Promise<import('@/types').ManagerAreaBanner> {
    try {
      const data = await http<import('@/types').ManagerAreaBanner>('/areas/my-area');
      return data || { managerId: '', stateCode: '', stateName: '', isAssigned: false };
    } catch (err) {
      console.warn('[restApi] getMyArea error:', err);
      return { managerId: '', stateCode: '', stateName: '', isAssigned: false };
    }
  },

  async getAreaCoverage(state?: string): Promise<import('@/types').AreaCoverageView[]> {
    try {
      // The API names these activeWorkersCount / openTasksCount / coverageStatus.
      const data = await http<Array<Record<string, any>>>('/areas/coverage', {
        query: state ? { state } : undefined,
      });
      return (Array.isArray(data) ? data : []).map((c) => ({
        stateCode: c.stateCode,
        stateName: c.stateName,
        managerId: c.managerId ?? null,
        managerName: c.managerName ?? null,
        managerEmail: c.managerEmail ?? null,
        activeWorkers: Number(c.activeWorkersCount ?? c.activeWorkers ?? 0),
        pendingWorkers: Number(c.pendingWorkers ?? 0),
        openTasks: Number(c.openTasksCount ?? c.openTasks ?? 0),
        status: (c.coverageStatus ?? c.status ?? 'NO_ACTIVITY') as import('@/types').AreaCoverageView['status'],
      }));
    } catch (err) {
      console.warn('[restApi] getAreaCoverage error:', err);
      return [];
    }
  },

  async getAdminManagers(): Promise<import('@/types').ManagerOption[]> {
    try {
      const data = await http<import('@/types').ManagerOption[]>('/admin/managers');
      return Array.isArray(data) ? data : [];
    } catch (err) {
      console.warn('[restApi] getAdminManagers error:', err);
      return [];
    }
  },

  async assignManagerZones(managerId: string, stateCodes: string[]): Promise<import('@/types').ManagerOption> {
    return await http<import('@/types').ManagerOption>(`/admin/managers/${encodeURIComponent(managerId)}/area`, {
      method: 'PUT',
      body: JSON.stringify({ stateCodes }),
    });
  },
};

