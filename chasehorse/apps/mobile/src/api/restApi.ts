import { Platform } from 'react-native';
import { supabase } from '../config/supabase';
import type {
  Task,
  NewTaskInput,
  TruckPlan,
  ShipmentMilestone,
  WalletTransaction,
  DashboardStats,
  ChecklistTemplate,
  EvidenceRecord,
  ApprovalRequestItem,
  EmployeeDirectoryItem,
  AppNotification,
  WalletAccount,
  WorkerDashboardStats,
} from '../types';

const BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  (Platform.OS === 'android' ? 'http://10.0.2.2:8080/api/v1' : 'http://localhost:8080/api/v1');

let unauthorizedHandler: (() => void) | undefined;

/** Registers the session owner without coupling this platform-neutral client to React. */
export function setMobileApiUnauthorizedHandler(handler?: () => void): void {
  unauthorizedHandler = handler;
}

async function apiRequest<T>(path: string, token?: string, init: RequestInit = {}): Promise<T> {
  const res = await mobileFetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const problem = await res.json().catch(() => ({}));
    throw new Error(problem.message || `Request failed: HTTP ${res.status}`);
  }
  return res.status === 204 ? (undefined as T) : (await res.json()) as T;
}

async function mobileFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, init);
  if (res.status === 401) unauthorizedHandler?.();
  return res;
}

function mapTask(raw: unknown): Task {
  const task = raw as Record<string, unknown>;
  const id = typeof task.id === 'string' ? task.id : '';
  const displayId = typeof task.displayId === 'string' ? task.displayId : undefined;
  const title = typeof task.title === 'string' ? task.title : '';
  const status = typeof task.status === 'string' ? task.status.toLowerCase() : '';
  const priority = typeof task.priority === 'string' ? task.priority.toLowerCase() : '';
  const rewardInr = Number(task.rewardAmount);
  if (!id || !title || !status || !priority || !Number.isFinite(rewardInr)) {
    throw new Error('The server returned an incomplete task record.');
  }
  const lat = Number(task.locationLat);
  const lng = Number(task.locationLng);
  return {
    id,
    displayId,
    title,
    description: typeof task.description === 'string' ? task.description : '',
    category: (typeof task.category === 'string' ? task.category : 'Unspecified') as Task['category'],
    status: status as Task['status'],
    priority: priority as Task['priority'],
    customerId: typeof task.customerId === 'string' ? task.customerId : typeof task.createdBy === 'string' ? task.createdBy : '',
    createdByName: typeof task.createdByName === 'string' ? task.createdByName : undefined,
    createdByRole: typeof task.createdByRole === 'string' ? task.createdByRole : undefined,
    geofenceRadiusMeters: typeof task.geofenceRadiusMeters === 'number' ? task.geofenceRadiusMeters : 200,
    location: {
      lat: Number.isFinite(lat) ? lat : Number.NaN,
      lng: Number.isFinite(lng) ? lng : Number.NaN,
      area: typeof task.areaKey === 'string' ? task.areaKey : typeof task.locationArea === 'string' ? task.locationArea : '',
      address: typeof task.address === 'string' ? task.address : typeof task.locationAddress === 'string' ? task.locationAddress : '',
    },
    dueAt: typeof task.dueAt === 'string' ? task.dueAt : '',
    createdAt: typeof task.createdAt === 'string' ? task.createdAt : '',
    rewardInr,
    checklistTemplateId: typeof task.checklistTemplateId === 'string' ? task.checklistTemplateId : '',
    assigneeId: typeof task.assignedTo === 'string' ? task.assignedTo : undefined,
  };
}

export const mobileApi = {
  async getWorkerProfile(token?: string): Promise<{ locationConsent?: boolean }> {
    return await apiRequest('/employees/me/profile', token);
  },

  async updateWorkerProfile(
    input: { displayName?: string; phone?: string; region?: string; skills?: string[]; locationConsent?: boolean },
    token?: string,
  ): Promise<void> {
    await apiRequest('/employees/me/profile', token, { method: 'PATCH', body: JSON.stringify(input) });
  },

  async clearWorkerLocation(token?: string): Promise<void> {
    await apiRequest('/employees/me/location', token, { method: 'DELETE' });
  },

  async updateWorkerLocation(
    coords: { lat: number; lng: number; accuracy?: number },
    token?: string,
  ): Promise<void> {
    await apiRequest('/employees/me/location', token, { method: 'PUT', body: JSON.stringify(coords) });
  },
  async listTickets(token?: string): Promise<Array<{
    id: string;
    ticketNumber?: string;
    subject: string;
    status: string;
    urgency: string;
    category?: string;
    message?: string;
    createdAt?: string;
    updatedAt?: string;
    comments?: any[];
  }>> {
    return await apiRequest('/tickets', token);
  },
  async createTicket(
    input: { subject: string; message: string; category?: string; urgency?: string; region?: string },
    token?: string,
  ): Promise<{ id: string; ticketNumber: string }> {
    return await apiRequest('/tickets', token, { method: 'POST', body: JSON.stringify(input) });
  },
  async listTasks(scope?: { customerId?: string }, token?: string): Promise<Task[]> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await mobileFetch(`${BASE_URL}/tasks${scope?.customerId ? `?customerId=${scope.customerId}` : ''}`, {
        headers,
      });

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          return data.map(mapTask);
        }
      }
      return [];
    } catch {
      return [];
    }
  },

  async createTask(input: NewTaskInput, token?: string): Promise<Task> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await mobileFetch(`${BASE_URL}/tasks`, {
      method: 'POST',
      headers,
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
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Failed to create task: HTTP ${res.status}`);
    }

    const t = await res.json();
    return mapTask(t);
  },

  async acceptTask(taskId: string, token?: string): Promise<Task> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await mobileFetch(`${BASE_URL}/tasks/${taskId}/accept`, {
      method: 'POST',
      headers,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Failed to accept task: HTTP ${res.status}`);
    }

    const t = await res.json();
    return mapTask(t);
  },

  async assignTask(taskId: string, employeeId: string, token?: string): Promise<Task> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await mobileFetch(`${BASE_URL}/tasks/${taskId}/assignment`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ employeeId }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Failed to assign task: HTTP ${res.status}`);
    }

    const t = await res.json();
    return mapTask(t);
  },

  async submitEvidence(
    taskId: string,
    evidence: {
      storagePath: string;
      fileName: string;
      caption?: string;
      deviceLat?: number;
      deviceLng?: number;
      locationAccuracy?: number;
      stampedStoragePath?: string;
      stampMetadata?: Record<string, unknown>;
      checklist?: Array<{ itemId: string; label: string; done: boolean }>;
    },
    token?: string
  ): Promise<{ success: boolean }> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await mobileFetch(`${BASE_URL}/evidence`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        taskId,
        storagePath: evidence.storagePath,
        fileName: evidence.fileName,
        caption: evidence.caption || '',
        contentType: 'image/jpeg',
        fileSizeBytes: 1024,
        deviceLat: evidence.deviceLat,
        deviceLng: evidence.deviceLng,
        locationAccuracy: evidence.locationAccuracy,
        stampedStoragePath: evidence.stampedStoragePath,
        stampMetadata: evidence.stampMetadata,
        checklist: evidence.checklist,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Failed to submit evidence: HTTP ${res.status}`);
    }

    return { success: true };
  },

  async approveTask(taskId: string, token?: string): Promise<void> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await mobileFetch(`${BASE_URL}/tasks/${taskId}/status`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status: 'APPROVED' }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Failed to approve task: HTTP ${res.status}`);
    }
  },

  async rejectTask(taskId: string, token?: string): Promise<void> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await mobileFetch(`${BASE_URL}/tasks/${taskId}/status`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status: 'REJECTED' }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Failed to reject task: HTTP ${res.status}`);
    }
  },

  async updateTaskStatus(taskId: string, status: string, token?: string): Promise<void> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await mobileFetch(`${BASE_URL}/tasks/${taskId}/status`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status: status.toUpperCase() }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Failed to update task status: HTTP ${res.status}`);
    }
  },

  async getWalletTransactions(employeeId: string, token?: string): Promise<WalletTransaction[]> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await mobileFetch(`${BASE_URL}/wallets/${employeeId}/transactions`, { headers });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          return data.map((txn: any) => ({
            id: txn.id,
            type: (txn.type || 'CREDIT').toUpperCase() as any,
            amount: Number(txn.amountInr) || 0,
            description: txn.reference || 'Task Reward',
            createdAt: txn.createdAt || '',
            status: (txn.status || 'COMPLETED').toUpperCase() as any,
          }));
        }
      }
      return [];
    } catch {
      return [];
    }
  },

  async getTrackingInfo(trackingId: string, token?: string): Promise<any | null> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const res = await mobileFetch(`${BASE_URL}/tms/tracking/${trackingId}`, { headers });
      if (res.ok) {
        return await res.json();
      }
      return null;
    } catch {
      return null;
    }
  },

  async getTruckPlans(token?: string): Promise<TruckPlan[]> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const res = await mobileFetch(`${BASE_URL}/tms/plans`, { headers });
      if (res.ok) {
        const plans = await res.json();
        if (Array.isArray(plans)) {
          return plans.map((p: any) => ({
            id: p.id,
            name: p.planName || p.name || 'Commercial Freight',
            capacity: `${p.maxCapacityKg || 1000} kg`,
            dimensions: 'Standard commercial bay',
            baseRateInr: Number(p.baseRateInr || p.basePrice) || 500,
            perKmRateInr: Number(p.ratePerKmInr || p.pricePerKm) || 25,
            availableVehicles: 1,
            recommendedFor: p.description || p.vehicleType || 'Commercial Freight',
          }));
        }
      }
      return [];
    } catch {
      return [];
    }
  },

  async createShipment(
    data: {
      originAddress: string;
      destinationAddress: string;
      cargoDescription?: string;
      cargoWeightKg?: number;
      transportPlanId?: string;
    },
    token?: string
  ): Promise<any> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await mobileFetch(`${BASE_URL}/tms/shipments`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Failed to create shipment: HTTP ${res.status}`);
    }

    return await res.json();
  },

  async getDashboardStats(
    scopeOrToken?: { customerId?: string; token?: string } | string,
    maybeToken?: string
  ): Promise<DashboardStats> {
    let customerId: string | undefined;
    let token: string | undefined;

    if (typeof scopeOrToken === 'object' && scopeOrToken !== null) {
      customerId = scopeOrToken.customerId;
      token = scopeOrToken.token;
    } else if (typeof scopeOrToken === 'string' && maybeToken !== undefined) {
      customerId = scopeOrToken;
      token = maybeToken;
    } else if (typeof scopeOrToken === 'string' && maybeToken === undefined) {
      if (scopeOrToken.startsWith('ey') || scopeOrToken.length > 50) {
        token = scopeOrToken;
      } else {
        customerId = scopeOrToken;
      }
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const url = `${BASE_URL}/dashboard/stats${customerId ? `?customerId=${customerId}` : ''}`;
    const res = await mobileFetch(url, { headers });
    if (!res.ok) {
      throw new Error(`Failed to fetch dashboard stats: HTTP ${res.status}`);
    }
    return await res.json();
  },

  async getWalletAccount(employeeId: string, token?: string): Promise<WalletAccount | null> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await mobileFetch(`${BASE_URL}/wallets/${employeeId}`, { headers });
      if (res.ok) {
        const data = await res.json();
        return {
          employeeId: data.employeeId,
          balanceInr: Number(data.balanceInr) || 0,
          pendingInr: Number(data.pendingInr) || 0,
        };
      }
      return null;
    } catch {
      return null;
    }
  },

  async listChecklistTemplates(token?: string): Promise<ChecklistTemplate[]> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await mobileFetch(`${BASE_URL}/checklist-templates`, { headers });
      if (res.ok) {
        return await res.json();
      }
      return [];
    } catch {
      return [];
    }
  },

  async getChecklistTemplate(templateId: string, token?: string): Promise<ChecklistTemplate | null> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await mobileFetch(`${BASE_URL}/checklist-templates/${templateId}`, { headers });
      if (res.ok) {
        return await res.json();
      }
      return null;
    } catch {
      return null;
    }
  },

  async listEvidence(taskId?: string, token?: string): Promise<EvidenceRecord[]> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const url = `${BASE_URL}/evidence${taskId ? `?taskId=${taskId}` : ''}`;
      const res = await mobileFetch(url, { headers });
      if (res.ok) {
        return await res.json();
      }
      return [];
    } catch {
      return [];
    }
  },

  async decideEvidence(
    evidenceId: string,
    status: 'VERIFIED' | 'FLAGGED' | 'REJECTED',
    note: string,
    token?: string
  ): Promise<boolean> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await mobileFetch(`${BASE_URL}/evidence/${evidenceId}/manager-decision`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ status, note }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Decision failed: HTTP ${res.status}`);
    }
    return true;
  },

  async listApprovals(token?: string): Promise<ApprovalRequestItem[]> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await mobileFetch(`${BASE_URL}/approvals`, { headers });
      if (res.ok) {
        return await res.json();
      }
      return [];
    } catch {
      return [];
    }
  },

  async decideApproval(
    approvalId: string,
    stage: 'APPROVED' | 'REJECTED' | 'REWORK',
    note: string,
    token?: string
  ): Promise<boolean> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await mobileFetch(`${BASE_URL}/approvals/${approvalId}/decision`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ stage, note }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Approval decision failed: HTTP ${res.status}`);
    }
    return true;
  },

  async listEmployees(token?: string): Promise<EmployeeDirectoryItem[]> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await mobileFetch(`${BASE_URL}/employees`, { headers });
      if (res.ok) {
        return await res.json();
      }
      return [];
    } catch {
      return [];
    }
  },

  async setEmployeeApproval(
    employeeId: string,
    status: 'ACTIVE' | 'SUSPENDED' | 'REJECTED' | 'PENDING',
    role?: string,
    token?: string
  ): Promise<boolean> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await mobileFetch(`${BASE_URL}/employees/${employeeId}/approval`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status, role }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Failed to update employee status: HTTP ${res.status}`);
    }
    return true;
  },

  async updateProfile(
    data: { displayName?: string; phone?: string; region?: string; avatarUrl?: string },
    token?: string
  ): Promise<any> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await mobileFetch(`${BASE_URL}/profiles/me`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Failed to update profile: HTTP ${res.status}`);
    }
    return await res.json();
  },

  async listNotifications(token?: string): Promise<AppNotification[]> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await mobileFetch(`${BASE_URL}/notifications`, { headers });
      if (res.ok) {
        return await res.json();
      }
      return [];
    } catch {
      return [];
    }
  },

  async markNotificationRead(id: string, token?: string): Promise<boolean> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await mobileFetch(`${BASE_URL}/notifications/${id}/read`, {
        method: 'PATCH',
        headers,
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  async getWorkerDashboardStats(token?: string): Promise<WorkerDashboardStats | null> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const res = await mobileFetch(`${BASE_URL}/dashboard/stats`, { headers });
      if (res.ok) {
        return await res.json();
      }
      return null;
    } catch {
      return null;
    }
  },

  async getMyArea(token?: string): Promise<{ stateCode: string; stateName: string; isAssigned: boolean } | null> {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await mobileFetch(`${BASE_URL}/areas/my-area`, { headers });
      if (res.ok) return await res.json();
      return null;
    } catch {
      return null;
    }
  },

  async submitTaskFeedback(taskId: string, payload: Record<string, unknown>, token?: string): Promise<void> {
    await apiRequest(`/tasks/${taskId}/feedback`, token, { method: 'POST', body: JSON.stringify(payload) });
  },

  async getEmployeeFeedback(employeeId: string, token?: string): Promise<Array<{ overallRating?: number }>> {
    const data = await apiRequest<unknown>(`/employees/${employeeId}/feedback`, token);
    return Array.isArray(data) ? data : [];
  },

  async markAllNotificationsRead(token?: string): Promise<void> {
    await apiRequest('/notifications/mark-all-read', token, { method: 'POST' });
  },

  async addTicketComment(ticketId: string, message: string, isInternal = false, token?: string): Promise<void> {
    await apiRequest(`/tickets/${ticketId}/comments`, token, {
      method: 'POST', body: JSON.stringify({ message, isInternal }),
    });
  },

  async getAreaCoverage(token?: string): Promise<any[]> {
    const data = await apiRequest<unknown>('/areas/coverage', token);
    return Array.isArray(data) ? data : [];
  },

  async listAdminManagers(token?: string): Promise<any[]> {
    const data = await apiRequest<unknown>('/admin/managers', token);
    return Array.isArray(data) ? data : [];
  },

  async assignManagerArea(managerId: string, stateCode: string, token?: string): Promise<void> {
    await apiRequest(`/admin/managers/${managerId}/area`, token, {
      method: 'PUT', body: JSON.stringify({ stateCode }),
    });
  },

  async updatePassword(password: string): Promise<void> {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw new Error(error.message);
  },

  async getStates(token?: string): Promise<Array<{ code: string; name: string }>> {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await mobileFetch(`${BASE_URL}/areas/states`, { headers });
      if (res.ok) return await res.json();
      return [];
    } catch {
      return [];
    }
  },
};
