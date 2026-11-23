import { useEffect, useMemo, useState } from 'react';
import {
  MapPin,
  Search,
  Shield,
  HardHat,
  ShieldAlert,
  Activity,
  User,
  Building2,
  Truck,
  CheckCircle2,
  AlertTriangle,
  Star,
  Filter,
} from 'lucide-react';
import { api } from '@/api';
import { useRole } from '@/context/RoleContext';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { PageHeader, Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/States';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { formatDate } from '@/utils/format';
import { getEmployeeApprovalLabel } from '@/utils/labels';
import type { Employee, EmployeeApprovalStatus, ManagerAreaBanner, StateView } from '@/types';

interface RoleOption {
  key: string;
  label: string;
  badgeLabel: string;
  icon: typeof Shield;
  color: string;
  bg: string;
  borderColor: string;
  blurb: string;
}

const ASSIGNABLE_ROLES: RoleOption[] = [
  {
    key: 'ADMIN',
    label: 'Platform Admin',
    badgeLabel: 'Admin',
    icon: ShieldAlert,
    color: '#c084fc',
    bg: 'rgba(192, 132, 252, 0.15)',
    borderColor: '#a855f7',
    blurb: 'Full administrative access: governance, staff role assignment, system audit history.',
  },
  {
    key: 'MANAGER',
    label: 'Operations Manager',
    badgeLabel: 'Manager',
    icon: Shield,
    color: '#60a5fa',
    bg: 'rgba(96, 165, 250, 0.15)',
    borderColor: '#3b82f6',
    blurb: 'Task review queue, AI verification inspection, worker approval, and reward release.',
  },
  {
    key: 'OPERATIONS',
    label: 'Operations Staff',
    badgeLabel: 'Operations',
    icon: Activity,
    color: '#38bdf8',
    bg: 'rgba(56, 189, 248, 0.15)',
    borderColor: '#0284c7',
    blurb: 'Field dispatch, live task monitoring, and operational coordination.',
  },
  {
    key: 'FIELD_WORKER',
    label: 'On-Field Worker',
    badgeLabel: 'Worker',
    icon: HardHat,
    color: '#4ade80',
    bg: 'rgba(74, 222, 128, 0.15)',
    borderColor: '#22c55e',
    blurb: 'Nearby range task discovery, checklists, GPS photo evidence, and wallet earnings.',
  },
  {
    key: 'EMPLOYEE',
    label: 'Staff Employee',
    badgeLabel: 'Employee',
    icon: User,
    color: 'var(--muted)',
    bg: 'rgba(148, 163, 184, 0.15)',
    borderColor: '#64748b',
    blurb: 'General company staff and internal operational support member.',
  },
  {
    key: 'CUSTOMER',
    label: 'Customer Representative',
    badgeLabel: 'Customer',
    icon: Building2,
    color: '#fbbf24',
    bg: 'rgba(251, 191, 36, 0.15)',
    borderColor: '#f59e0b',
    blurb: 'Enterprise client account: create field tasks, track execution, inspect deliverables.',
  },
  {
    key: 'PARTNER',
    label: 'Logistics Partner',
    badgeLabel: 'Partner',
    icon: Truck,
    color: '#fb923c',
    bg: 'rgba(251, 146, 60, 0.15)',
    borderColor: '#f97316',
    blurb: 'Third-party transport carrier, fleet partner, and commercial logistics coordinator.',
  },
];

function getRoleMeta(roleKey?: string): RoleOption {
  const upper = (roleKey || '').toUpperCase();
  const match = ASSIGNABLE_ROLES.find((r) => r.key === upper);
  if (match) return match;
  if (upper === 'OPERATIONS_MANAGER') return ASSIGNABLE_ROLES[1];
  return ASSIGNABLE_ROLES[3]; // default FIELD_WORKER
}

const FILTERS: { value: EmployeeApprovalStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All Staff' },
  { value: 'pending', label: 'Pending Approval' },
  { value: 'approved', label: 'Active & Approved' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'rejected', label: 'Rejected' },
];

/** Status changes that require an audited reason, with their wording. */
type ReasonAction = 'rejected' | 'suspended' | 'blocked';
const REASON_ACTIONS: Record<ReasonAction, { noun: string; verbing: string; confirm: string; help: string }> = {
  rejected: { noun: 'Rejection', verbing: 'rejecting', confirm: 'Confirm rejection',
    help: 'The applicant sees this reason on their status page.' },
  suspended: { noun: 'Suspension', verbing: 'suspending', confirm: 'Confirm suspension',
    help: 'Suspension is temporary: the worker loses access until you reinstate them. They see this reason.' },
  blocked: { noun: 'Block', verbing: 'blocking', confirm: 'Confirm block',
    help: 'Blocking bars the account from signing in to work until it is explicitly reinstated. They see this reason.' },
};

export function EmployeesPage() {
  const { role } = useRole();
  const { user, profile } = useAuth();
  const { notify } = useToast();

  const isAdmin = role === 'admin' || (profile?.roles?.includes('ADMIN') ?? false);
  const isManager = !isAdmin && (role === 'operations_manager' || role === 'manager' || (profile?.roles?.includes('MANAGER') ?? false));

  const [loading, setLoading] = useState(true);
  const [list, setList] = useState<Employee[]>([]);
  const [states, setStates] = useState<StateView[]>([]);
  const [managerArea, setManagerArea] = useState<ManagerAreaBanner | null>(null);

  // Filters
  const [filter, setFilter] = useState<EmployeeApprovalStatus | 'all'>('all');
  const [selectedStateFilter, setSelectedStateFilter] = useState<string>('ALL');
  const [query, setQuery] = useState('');

  // Selected Employee & Drawer/Modal state
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [assignedRole, setAssignedRole] = useState<string>('FIELD_WORKER');
  const [busy, setBusy] = useState(false);

  // Mandatory Reason Modal for Reject / Suspend
  const [reasonAction, setReasonAction] = useState<ReasonAction | null>(null);
  const [actionReason, setActionReason] = useState('');

  const loadEmployees = async () => {
    try {
      setLoading(true);
      const scope = isAdmin && selectedStateFilter !== 'ALL' ? { state: selectedStateFilter } : undefined;
      const data = await api.listEmployees(scope);
      setList(data);
    } catch (err) {
      console.warn('Failed to load employees', err);
      notify('Failed to load workforce directory', 'info');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEmployees();
  }, [selectedStateFilter]);

  // Load area & states reference
  useEffect(() => {
    if (isAdmin) {
      api.getStates().then(setStates).catch(() => {});
    }
    if (isManager) {
      api.getMyArea().then(setManagerArea).catch(() => {});
    }
  }, [isAdmin, isManager]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: list.length, pending: 0, approved: 0, suspended: 0, rejected: 0 };
    list.forEach((e) => {
      const normalizedStatus = e.approvalStatus === ('active' as any) ? 'approved' : e.approvalStatus;
      if (c[normalizedStatus] !== undefined) c[normalizedStatus] += 1;
    });
    return c;
  }, [list]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return list.filter((e) => {
      const normalizedStatus = e.approvalStatus === ('active' as any) ? 'approved' : e.approvalStatus;
      const matchesFilter = filter === 'all' || normalizedStatus === filter;
      const matchesQuery =
        !q ||
        e.name.toLowerCase().includes(q) ||
        e.region.toLowerCase().includes(q) ||
        (e.stateName && e.stateName.toLowerCase().includes(q)) ||
        (e.stateCode && e.stateCode.toLowerCase().includes(q)) ||
        e.email.toLowerCase().includes(q) ||
        (e.phone && e.phone.includes(q)) ||
        (e.primaryRole && e.primaryRole.toLowerCase().includes(q));
      return matchesFilter && matchesQuery;
    });
  }, [list, filter, query]);

  const selected: Employee | undefined = list.find((e) => e.id === selectedId);

  const handleSelectEmployee = (emp: Employee) => {
    setSelectedId(emp.id);
    const initialRole = emp.primaryRole || emp.roles?.[0] || (emp.subRole === 'manager' ? 'MANAGER' : 'FIELD_WORKER');
    setAssignedRole(initialRole.toUpperCase());
    setReasonAction(null);
    setActionReason('');
  };

  // Direct approval (approved or reinstated)
  async function handleApproveDirect(verb: string) {
    if (!selected) return;
    setBusy(true);
    try {
      const targetRole = isAdmin ? assignedRole : undefined;
      await api.setEmployeeApproval(selected.id, 'approved', targetRole);
      notify(`${selected.name} ${verb} successfully.`);
      await loadEmployees();
      setSelectedId(null);
    } catch (e: any) {
      notify(e.message || 'Approval update failed', 'info');
    } finally {
      setBusy(false);
    }
  }

  // Trigger reason modal for reject or suspend
  function handleTriggerReason(status: ReasonAction) {
    setReasonAction(status);
    setActionReason('');
  }

  // Submit reject or suspend with mandatory reason
  async function handleSubmitWithReason() {
    if (!selected || !reasonAction) return;
    if (!actionReason.trim()) {
      notify(`A reason is required when ${REASON_ACTIONS[reasonAction].verbing} an account.`, 'info');
      return;
    }
    setBusy(true);
    try {
      const targetRole = isAdmin ? assignedRole : undefined;
      await api.setEmployeeApproval(selected.id, reasonAction, targetRole, actionReason.trim());
      notify(`${selected.name} account ${reasonAction} with reason logged.`);
      setReasonAction(null);
      setSelectedId(null);
      await loadEmployees();
    } catch (e: any) {
      notify(e.message || 'Operation failed', 'info');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title={
          isManager
            ? `Field Workers — ${managerArea?.stateName || 'Jurisdiction'}`
            : 'Field Workers & Operational Staff'
        }
        description={
          isManager
            ? `Operational field workforce in ${managerArea?.stateName || 'your assigned jurisdiction'}. Review registrations, verify workers, and manage account activation.`
            : 'Review workforce registrations, filter by operational state, assign authorized system roles, and govern staff activation.'
        }
      />

      <Card>
        {/* Toolbar & Filters */}
        <div className="toolbar" style={{ flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
          {/* Status Segmented Buttons */}
          <div className="segmented" role="group" aria-label="Filter by approval status">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                className={`segmented__btn ${filter === f.value ? 'segmented__btn--on' : ''}`}
                aria-pressed={filter === f.value}
                onClick={() => setFilter(f.value)}
              >
                {f.label} <span className="segmented__count">{counts[f.value]}</span>
              </button>
            ))}
          </div>

          {/* Admin State Filter Dropdown */}
          {isAdmin && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Filter size={15} color="#94a3b8" />
              <label htmlFor="state-filter" className="sr-only">Filter by State</label>
              <select
                id="state-filter"
                className="input"
                style={{ fontSize: '0.8125rem', padding: '6px 12px', minWidth: '160px' }}
                value={selectedStateFilter}
                onChange={(e) => setSelectedStateFilter(e.target.value)}
              >
                <option value="ALL">All States (Pan-India)</option>
                {states.map((st) => (
                  <option key={st.code} value={st.code}>
                    {st.name} ({st.code})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Search Box */}
          <div className="search" style={{ flex: '1', maxWidth: '360px' }}>
            <Search size={16} aria-hidden />
            <label htmlFor="emp-search" className="sr-only">Search employees</label>
            <input
              id="emp-search"
              type="search"
              className="input input--search"
              placeholder={isManager ? 'Search worker name, region, phone...' : 'Search name, state, role, email...'}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Content Body */}
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--muted)' }}>
            Loading workforce records from database...
          </div>
        ) : visible.length === 0 ? (
          <EmptyState
            title={
              isManager
                ? `No field workers registered in ${managerArea?.stateName || 'your state'}`
                : 'No employees match the current filters'
            }
            description={
              isManager
                ? `Field workers who register with their state set to ${managerArea?.stateName || 'your jurisdiction'} will appear here for verification and dispatch.`
                : 'Try adjusting your search criteria, approval status filter, or state selection.'
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="table" aria-label="Employees table">
              <thead>
                <tr>
                  <th scope="col">Staff Member</th>
                  {isAdmin && <th scope="col">Assigned Role</th>}
                  <th scope="col">State / Region</th>
                  <th scope="col">Contact</th>
                  <th scope="col">Rating / Tasks</th>
                  <th scope="col">Status</th>
                  <th scope="col">Joined</th>
                  <th scope="col" className="table__action-col">Action</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((e) => {
                  const meta = getRoleMeta(e.primaryRole || e.roles?.[0] || (e.subRole === 'manager' ? 'MANAGER' : 'FIELD_WORKER'));
                  const Icon = meta.icon;

                  return (
                    <tr key={e.id}>
                      {/* Name & Avatar */}
                      <td>
                        <div className="person">
                          <Avatar name={e.name} size={36} />
                          <div>
                            <span className="cell-title">{e.name}</span>
                            <span className="cell-sub">{e.email}</span>
                          </div>
                        </div>
                      </td>

                      {/* Admin-only Role Column */}
                      {isAdmin && (
                        <td>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              fontSize: '0.8125rem',
                              fontWeight: 600,
                              color: meta.color,
                              background: meta.bg,
                              border: `1px solid ${meta.borderColor}40`,
                              padding: '3px 9px',
                              borderRadius: '6px',
                            }}
                          >
                            <Icon size={13} />
                            {meta.label}
                          </span>
                        </td>
                      )}

                      {/* State & Region */}
                      <td>
                        <span className="cell-sub" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <MapPin size={13} /> {e.stateName ? `${e.stateName} (${e.region})` : e.region}
                        </span>
                      </td>

                      {/* Phone */}
                      <td>
                        <span className="cell-sub">{e.phone || '—'}</span>
                      </td>

                      {/* Rating / Completed */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8125rem' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: '#fbbf24', fontWeight: 600 }}>
                            <Star size={13} fill="#fbbf24" /> {e.rating ? e.rating.toFixed(1) : '5.0'}
                          </span>
                          <span style={{ color: '#64748b' }}>•</span>
                          <span style={{ color: '#94a3b8' }}>{e.tasksCompleted || 0} tasks</span>
                        </div>
                      </td>

                      {/* Status */}
                      <td>
                        <Badge tone={getEmployeeApprovalLabel(e.approvalStatus).tone}>
                          {getEmployeeApprovalLabel(e.approvalStatus).label}
                        </Badge>
                      </td>

                      {/* Joined Date */}
                      <td>
                        <span className="cell-sub">{formatDate(e.joinedAt)}</span>
                      </td>

                      {/* Action Button */}
                      <td className="table__action-col">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleSelectEmployee(e)}
                        >
                          {isManager ? 'View / Manage' : 'Review / Role'}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Worker Detail & Management Drawer / Modal */}
      <Dialog
        open={Boolean(selected)}
        onClose={() => {
          setSelectedId(null);
          setReasonAction(null);
        }}
        title={
          selected
            ? isManager
              ? `${selected.name} — Field Worker Profile & Verification`
              : `${selected.name} — Review & Role Governance`
            : 'Employee'
        }
        footer={
          selected ? (
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', width: '100%', flexWrap: 'wrap' }}>
              {/* Close Button */}
              <Button
                variant="ghost"
                onClick={() => {
                  setSelectedId(null);
                  setReasonAction(null);
                }}
                disabled={busy}
              >
                Close
              </Button>

              {/* Action Buttons for non-self accounts */}
              {selected.id !== user?.id && (
                <>
                  {/* Approve (pending / rejected) or Reinstate (suspended / blocked) */}
                  {selected.approvalStatus !== 'approved' && (() => {
                    const reinstate = selected.approvalStatus === 'suspended' || selected.approvalStatus === 'blocked';
                    const awaitingOtp = selected.approvalStatus === 'pending' && selected.emailVerified === false;
                    return (
                      <Button
                        variant="success"
                        disabled={busy || awaitingOtp}
                        title={awaitingOtp ? 'The worker must verify their e-mail (OTP) before they can be approved' : undefined}
                        onClick={() => handleApproveDirect(reinstate ? 'reinstated' : 'approved')}
                      >
                        {reinstate ? '↺ Reinstate Account' : awaitingOtp ? 'Awaiting e-mail verification' : '✓ Approve Field Worker Account'}
                      </Button>
                    );
                  })()}

                  {/* Save Role for Admin when already approved */}
                  {isAdmin && selected.approvalStatus === 'approved' && (
                    <Button
                      variant="primary"
                      disabled={busy}
                      onClick={() => handleApproveDirect('role updated')}
                    >
                      Save Role Assignment ({getRoleMeta(assignedRole).label})
                    </Button>
                  )}

                  {/* Suspend Account */}
                  {selected.approvalStatus === 'approved' && (
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={() => handleTriggerReason('suspended')}
                    >
                      Suspend Account
                    </Button>
                  )}

                  {/* Block Account (active or suspended) */}
                  {(selected.approvalStatus === 'approved' || selected.approvalStatus === 'suspended') && (
                    <Button
                      variant="danger"
                      disabled={busy}
                      onClick={() => handleTriggerReason('blocked')}
                    >
                      Block Account
                    </Button>
                  )}

                  {/* Reject Account (applications only; active accounts are suspended or blocked) */}
                  {selected.approvalStatus === 'pending' && (
                    <Button
                      variant="danger"
                      disabled={busy}
                      onClick={() => handleTriggerReason('rejected')}
                    >
                      Reject Account
                    </Button>
                  )}
                </>
              )}
            </div>
          ) : undefined
        }
      >
        {selected && (
          <div className="stack" style={{ gap: '1.25rem' }}>
            {/* Worker Header Card */}
            <div className="person person--lg" style={{ gap: '16px' }}>
              <Avatar name={selected.name} size={54} />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-text, #f8fafc)' }}>
                    {selected.name}
                  </h3>
                  <Badge tone={getEmployeeApprovalLabel(selected.approvalStatus).tone}>
                    {getEmployeeApprovalLabel(selected.approvalStatus).label}
                  </Badge>
                  {selected.stateCode && (
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        background: 'rgba(56, 189, 248, 0.1)',
                        border: '1px solid rgba(56, 189, 248, 0.25)',
                        color: '#38bdf8',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                      }}
                    >
                      {selected.stateName || selected.stateCode}
                    </span>
                  )}
                </div>
                <p className="cell-sub" style={{ marginTop: '4px' }}>
                  {selected.email} {selected.phone ? `• ${selected.phone}` : ''}
                </p>
              </div>
            </div>

            {/* Performance & Field Stats */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '0.75rem',
                background: 'var(--color-surface-sunken, #0f172a)',
                padding: '1rem',
                borderRadius: '10px',
                border: '1px solid var(--color-border, #334155)',
              }}
            >
              <div style={{ textAlign: 'center' }}>
                <span style={{ fontSize: '0.725rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Worker Rating
                </span>
                <p style={{ margin: '4px 0 0 0', fontSize: '1.25rem', fontWeight: 800, color: '#fbbf24' }}>
                  ★ {selected.rating ? selected.rating.toFixed(1) : '5.0'}
                </p>
              </div>
              <div style={{ textAlign: 'center', borderLeft: '1px solid var(--line)', borderRight: '1px solid var(--line)' }}>
                <span style={{ fontSize: '0.725rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Completed Tasks
                </span>
                <p style={{ margin: '4px 0 0 0', fontSize: '1.25rem', fontWeight: 800, color: '#4ade80' }}>
                  {selected.tasksCompleted || 0}
                </p>
              </div>
              <div style={{ textAlign: 'center' }}>
                <span style={{ fontSize: '0.725rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Field Jurisdiction
                </span>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', fontWeight: 700, color: '#38bdf8' }}>
                  {selected.stateCode || 'AP'}
                </p>
              </div>
            </div>

            {/* Self-account warning */}
            {selected.id === user?.id && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'rgba(234, 179, 8, 0.1)',
                  border: '1px solid rgba(234, 179, 8, 0.3)',
                  color: '#eab308',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  fontSize: '0.8125rem',
                }}
              >
                <AlertTriangle size={16} />
                <span>This is your current account. Self-modification is restricted by server governance.</span>
              </div>
            )}

            {/* Mandatory Reason Sub-Dialog / Inline Sheet */}
            {reasonAction && (
              <div
                style={{
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  borderRadius: '10px',
                  padding: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f87171', fontWeight: 700, fontSize: '0.875rem' }}>
                  <AlertTriangle size={16} />
                  <span>Reason for {REASON_ACTIONS[reasonAction].noun}</span>
                </div>
                <p style={{ margin: 0, fontSize: '0.775rem', color: 'var(--ch-muted, #5E5B53)' }}>
                  {REASON_ACTIONS[reasonAction].help} The decision is recorded in the audit log.
                </p>
                <textarea
                  className="input"
                  rows={3}
                  maxLength={1000}
                  placeholder={`Reason for ${REASON_ACTIONS[reasonAction].verbing} this account…`}
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  style={{ width: '100%', fontSize: '0.825rem', marginTop: '4px' }}
                />
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '6px' }}>
                  <Button variant="ghost" size="sm" onClick={() => setReasonAction(null)} disabled={busy}>
                    Cancel
                  </Button>
                  <Button variant="danger" size="sm" disabled={busy || !actionReason.trim()} onClick={handleSubmitWithReason}>
                    {busy ? 'Saving...' : REASON_ACTIONS[reasonAction].confirm}
                  </Button>
                </div>
              </div>
            )}

            {/* ADMIN-ONLY Role Assignment Grid: REMOVED COMPLETELY FOR MANAGERS */}
            {isAdmin && !reasonAction && (
              <div
                style={{
                  background: 'var(--color-surface-sunken, #0f172a)',
                  padding: '1.25rem',
                  borderRadius: '10px',
                  border: '1px solid var(--color-border, #334155)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '0.75rem',
                    flexWrap: 'wrap',
                    gap: '4px',
                  }}
                >
                  <label className="field__label" style={{ margin: 0, fontWeight: 700, fontSize: '0.875rem' }}>
                    Assign Authorized Role (Platform Admin Only)
                  </label>
                  <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                    Target: <strong style={{ color: getRoleMeta(assignedRole).color }}>{getRoleMeta(assignedRole).label}</strong>
                  </span>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
                    gap: '0.625rem',
                  }}
                >
                  {ASSIGNABLE_ROLES.map((r) => {
                    const isSelected = assignedRole === r.key;
                    const Icon = r.icon;
                    return (
                      <button
                        key={r.key}
                        type="button"
                        onClick={() => setAssignedRole(r.key)}
                        disabled={selected.id === user?.id}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'flex-start',
                          gap: '6px',
                          padding: '10px 12px',
                          borderRadius: '8px',
                          background: isSelected ? r.bg : 'rgba(255, 255, 255, 0.02)',
                          border: isSelected ? `2px solid ${r.borderColor}` : '1px solid var(--color-border, #334155)',
                          color: isSelected ? r.color : 'var(--color-text, #e2e8f0)',
                          cursor: selected.id === user?.id ? 'not-allowed' : 'pointer',
                          textAlign: 'left',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
                          <Icon size={16} color={isSelected ? r.color : '#94a3b8'} />
                          <span style={{ fontWeight: 600, fontSize: '0.8125rem' }}>{r.label}</span>
                          {isSelected && <CheckCircle2 size={15} style={{ marginLeft: 'auto' }} />}
                        </div>
                        <span style={{ fontSize: '0.6875rem', color: 'var(--muted)', lineHeight: 1.35 }}>
                          {r.blurb}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Worker Metadata Details */}
            <dl className="defs">
              <div>
                <dt>Operational State</dt>
                <dd><MapPin size={14} /> {selected.stateName || selected.stateCode || '—'}</dd>
              </div>
              <div>
                <dt>Primary operational zone</dt>
                <dd>{selected.zoneLabel || selected.region || '—'}</dd>
              </div>
              <div>
                <dt>E-mail verified</dt>
                <dd>{selected.emailVerified === false ? 'Not yet (OTP pending)' : 'Yes'}</dd>
              </div>
              <div>
                <dt>Contact Mobile</dt>
                <dd>{selected.phone || '—'}</dd>
              </div>
              <div>
                <dt>Registered Date</dt>
                <dd>{formatDate(selected.joinedAt)}</dd>
              </div>
            </dl>
          </div>
        )}
      </Dialog>
    </>
  );
}
