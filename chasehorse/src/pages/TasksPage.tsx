import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  LayoutGrid,
  List,
  Plus,
  RotateCcw,
  Search,
  UserPlus,
  ArrowRight,
} from 'lucide-react';
import { api } from '@/api';
import { useAsync } from '@/hooks/useAsync';
import { useDirectory } from '@/hooks/useDirectory';
import { useRole } from '@/context/RoleContext';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { PageHeader, Card } from '@/components/ui/Card';
import { Async, EmptyState } from '@/components/ui/States';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { formatDate, formatInr } from '@/utils/format';
import { priorityLabel, taskStatusLabel, taskStatusOrder } from '@/utils/labels';
import { TaskBoard } from '@/components/operations/TaskBoard';
import { WorkerTaskExecutionModal } from '@/components/tasks/WorkerTaskExecutionModal';
import { AssignTaskDialog } from '@/components/tasks/AssignTaskDialog';
import type { Task, TaskStatus } from '@/types';

const ASSIGNABLE: TaskStatus[] = ['open', 'assigned', 'in_progress', 'rejected'];

export function TasksPage() {
  const { role, customerId, can } = useRole();
  const { user, profile } = useAuth();
  const { notify } = useToast();
  const isCustomer = role === 'customer';
  const isWorker = role === 'employee' || role === 'field_worker';
  const workerId = profile?.id || user?.id || '';

  const state = useAsync(() => api.listTasks({ customerId }), [customerId]);
  const dir = useDirectory();

  const [viewMode, setViewMode] = useState<'board' | 'list'>('board');
  const [status, setStatus] = useState<TaskStatus | 'all'>('all');
  const [workerStatusTab, setWorkerStatusTab] = useState<'all' | 'in_progress' | 'assigned' | 'submitted' | 'approved'>('all');
  const [query, setQuery] = useState('');
  const [assigning, setAssigning] = useState<Task | null>(null);
  const isAdmin = role === 'admin' || (profile?.roles?.includes('ADMIN') ?? false);

  // Active execution task in modal
  const [executingTask, setExecutingTask] = useState<Task | null>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (state.data ?? [])
      .filter((t) => (status === 'all' || t.status === status) && (!q || t.title.toLowerCase().includes(q) || t.id.toLowerCase().includes(q) || t.location?.area?.toLowerCase().includes(q)))
      .sort((a, b) => b.id.localeCompare(a.id));
  }, [state.data, status, query]);

  // Worker scoped tasks
  const workerTasks = useMemo(() => {
    const all = state.data ?? [];
    return all.filter((t) => {
      // Must be assigned to worker or taken by worker
      const isAssignedToMe = t.assigneeId === workerId;
      if (!isAssignedToMe && t.status !== 'open') return false;

      if (workerStatusTab === 'in_progress') return t.status === 'in_progress';
      if (workerStatusTab === 'assigned') return t.status === 'assigned';
      if (workerStatusTab === 'submitted') return t.status === 'submitted' || t.status === 'in_review';
      if (workerStatusTab === 'approved') return t.status === 'approved';

      return true;
    });
  }, [state.data, workerId, workerStatusTab]);

  // 1. Worker Dedicated View
  if (isWorker) {
    const inProgressCount = (state.data ?? []).filter((t) => t.status === 'in_progress').length;
    const assignedCount = (state.data ?? []).filter((t) => t.status === 'assigned').length;
    const submittedCount = (state.data ?? []).filter((t) => t.status === 'submitted' || t.status === 'in_review').length;
    const approvedCount = (state.data ?? []).filter((t) => t.status === 'approved').length;

    return (
      <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <PageHeader
          title="My Field Tasks"
          description="Your active task assignments, live checklist execution, and geo-tagged proof submissions."
          actions={
            <Button
              size="sm"
              variant="ghost"
              icon={<RotateCcw size={14} />}
              onClick={state.reload}
              title="Refresh task records"
              aria-label="Refresh tasks"
            >
              Refresh
            </Button>
          }
        />

        {/* Status Filter Tabs */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', borderBottom: '1px solid var(--color-border, #e2e8f0)', paddingBottom: '0.75rem' }}>
          <button
            type="button"
            onClick={() => setWorkerStatusTab('all')}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              border: 'none',
              background: workerStatusTab === 'all' ? 'var(--accent-orange)' : 'transparent',
              color: workerStatusTab === 'all' ? '#ffffff' : 'var(--muted)',
              fontWeight: 700,
              fontSize: '0.825rem',
              cursor: 'pointer',
            }}
          >
            All Assigned ({workerTasks.length})
          </button>
          <button
            type="button"
            onClick={() => setWorkerStatusTab('in_progress')}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              border: 'none',
              background: workerStatusTab === 'in_progress' ? 'var(--accent-orange)' : 'transparent',
              color: workerStatusTab === 'in_progress' ? '#ffffff' : 'var(--muted)',
              fontWeight: 700,
              fontSize: '0.825rem',
              cursor: 'pointer',
            }}
          >
            In Progress ({inProgressCount})
          </button>
          <button
            type="button"
            onClick={() => setWorkerStatusTab('assigned')}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              border: 'none',
              background: workerStatusTab === 'assigned' ? 'var(--accent-orange)' : 'transparent',
              color: workerStatusTab === 'assigned' ? '#ffffff' : 'var(--muted)',
              fontWeight: 700,
              fontSize: '0.825rem',
              cursor: 'pointer',
            }}
          >
            Assigned ({assignedCount})
          </button>
          <button
            type="button"
            onClick={() => setWorkerStatusTab('submitted')}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              border: 'none',
              background: workerStatusTab === 'submitted' ? 'var(--accent-orange)' : 'transparent',
              color: workerStatusTab === 'submitted' ? '#ffffff' : 'var(--muted)',
              fontWeight: 700,
              fontSize: '0.825rem',
              cursor: 'pointer',
            }}
          >
            Under Review ({submittedCount})
          </button>
          <button
            type="button"
            onClick={() => setWorkerStatusTab('approved')}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              border: 'none',
              background: workerStatusTab === 'approved' ? 'var(--accent-orange)' : 'transparent',
              color: workerStatusTab === 'approved' ? '#ffffff' : 'var(--muted)',
              fontWeight: 700,
              fontSize: '0.825rem',
              cursor: 'pointer',
            }}
          >
            Approved ({approvedCount})
          </button>
        </div>

        {/* Worker Task Cards Grid */}
        <Async state={state} skeletonLines={5}>
          {() =>
            workerTasks.length === 0 ? (
              <EmptyState
                title="No tasks in this category"
                description="Head over to Nearby Tasks to discover and accept new field assignments."
              />
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1.25rem' }}>
                {workerTasks.map((t) => (
                  <div
                    key={t.id}
                    onClick={() => setExecutingTask(t)}
                    style={{
                      background: 'var(--color-surface, #ffffff)',
                      borderRadius: '16px',
                      border: '1px solid var(--color-border, #e2e8f0)',
                      padding: '1.25rem',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: '12px',
                      cursor: 'pointer',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                      transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontSize: '0.725rem', fontWeight: 800, color: 'var(--accent-orange)', fontFamily: 'monospace' }}>
                          CH-{t.id.slice(-6).toUpperCase()}
                        </span>
                        <span
                          style={{
                            fontSize: '0.725rem',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '4px',
                            background:
                              t.status === 'approved'
                                ? 'rgba(16, 185, 129, 0.1)'
                                : t.status === 'in_progress'
                                ? 'rgba(59, 130, 246, 0.1)'
                                : t.status === 'submitted'
                                ? 'rgba(234, 179, 8, 0.1)'
                                : 'rgba(15, 23, 42, 0.08)',
                            color:
                              t.status === 'approved'
                                ? '#10b981'
                                : t.status === 'in_progress'
                                ? '#3b82f6'
                                : t.status === 'submitted'
                                ? '#eab308'
                                : '#0f172a',
                            textTransform: 'uppercase',
                          }}
                        >
                          {t.status.replace('_', ' ')}
                        </span>
                      </div>

                      <h3 style={{ margin: '0 0 6px 0', fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-text, #0f172a)' }}>
                        {t.title}
                      </h3>
                      <p style={{ margin: '0 0 8px 0', fontSize: '0.825rem', color: 'var(--muted)' }}>
                        📍 {t.location?.address || t.location?.area || 'Local site'}
                      </p>

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--muted)' }}>
                        <span>Due: {formatDate(t.dueAt)}</span>
                        <span>Bounty: <strong style={{ color: '#10b981' }}>₹{t.rewardInr ?? 0}</strong></span>
                      </div>
                    </div>

                    <div style={{ borderTop: '1px solid var(--color-border, #e2e8f0)', paddingTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Tap to view & execute</span>
                      <button
                        type="button"
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--accent-orange)',
                          fontWeight: 700,
                          fontSize: '0.8rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          cursor: 'pointer',
                        }}
                      >
                        Open <ArrowRight size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          }
        </Async>

        {/* Worker Inside-Task Execution Modal */}
        {executingTask && (
          <WorkerTaskExecutionModal
            task={executingTask}
            onClose={() => setExecutingTask(null)}
            onTaskUpdated={() => {
              state.reload();
              setExecutingTask(null);
            }}
          />
        )}
      </div>
    );
  }

  // 2. Staff / Admin Operations Kanban View
  return (
    <>
      <PageHeader
        title={isCustomer ? 'My requests' : 'Field Operations Task Board'}
        description={isCustomer ? 'Tasks requested by your organisation and their progress.' : 'Visual lifecycle management, employee assignment, and status dispatch.'}
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="view-toggle" role="group" aria-label="Task layout view">
              <button
                type="button"
                className={`view-toggle__btn ${viewMode === 'board' ? 'view-toggle__btn--active' : ''}`}
                onClick={() => setViewMode('board')}
                title="Kanban Board view"
                aria-pressed={viewMode === 'board'}
              >
                <LayoutGrid size={15} aria-hidden />
                <span>Board</span>
              </button>
              <button
                type="button"
                className={`view-toggle__btn ${viewMode === 'list' ? 'view-toggle__btn--active' : ''}`}
                onClick={() => setViewMode('list')}
                title="Table List view"
                aria-pressed={viewMode === 'list'}
              >
                <List size={15} aria-hidden />
                <span>List</span>
              </button>
            </div>
            <Button
              size="sm"
              variant="ghost"
              icon={<RotateCcw size={14} />}
              onClick={state.reload}
              title="Refresh task records"
              aria-label="Refresh tasks"
            >
              Refresh
            </Button>
            {can('createTasks') && (
              <Link to="/tasks/new" className="btn btn--primary btn--md">
                <span className="btn__icon" aria-hidden><Plus size={16} /></span>
                Create task
              </Link>
            )}
          </div>
        }
      />

      <Card>
        <div className="toolbar">
          <div className="field-inline">
            <label htmlFor="task-status" className="field__label">Status</label>
            <select id="task-status" className="input input--compact" value={status} onChange={(e) => setStatus(e.target.value as TaskStatus | 'all')}>
              <option value="all">All statuses</option>
              {taskStatusOrder.map((s) => <option key={s} value={s}>{taskStatusLabel[s].label}</option>)}
            </select>
          </div>
          <div className="search">
            <Search size={16} aria-hidden />
            <label htmlFor="task-search" className="sr-only">Search tasks</label>
            <input id="task-search" type="search" className="input input--search" placeholder="Search title, ID or area" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
        </div>

        <Async state={state} skeletonLines={6}>
          {() =>
            visible.length === 0 ? (
              <EmptyState title="No tasks found" description="Adjust your filters or search keywords to view tasks." />
            ) : viewMode === 'board' ? (
              <TaskBoard
                tasks={visible}
                canAssign={can('assignTasks')}
                onAssignTask={(t) => setAssigning(t)}
                employeeName={dir.employeeName}
                customerName={dir.customerName}
              />
            ) : (
              <div className="table-wrap" role="region" aria-label="Tasks list" tabIndex={0}>
                <table className="table table--stack">
                  <thead>
                    <tr>
                      <th scope="col">Task</th>
                      <th scope="col">Category</th>
                      <th scope="col">Status</th>
                      <th scope="col">Priority</th>
                      <th scope="col">Location</th>
                      <th scope="col">Due</th>
                      <th scope="col" className="num">Reward</th>
                      <th scope="col">Assignee</th>
                      {can('assignTasks') && <th scope="col" className="table__action">Action</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((t) => (
                      <tr key={t.id}>
                        <td data-label="Task">
                          <Link to={`/tasks/${t.id}`} className="cell-title cell-title--link">{t.title}</Link>
                          <span className="cell-sub">{t.id}</span>
                        </td>
                        <td data-label="Category">{t.category}</td>
                        <td data-label="Status">
                          <Badge tone={taskStatusLabel[t.status].tone}>{taskStatusLabel[t.status].label}</Badge>
                        </td>
                        <td data-label="Priority">
                          <Badge tone={priorityLabel[t.priority].tone}>{priorityLabel[t.priority].label}</Badge>
                        </td>
                        <td data-label="Location">{t.location?.area || '—'}</td>
                        <td data-label="Due">{formatDate(t.dueAt)}</td>
                        <td data-label="Reward" className="num">{formatInr(t.rewardInr)}</td>
                        <td data-label="Assignee">{dir.employeeName(t.assigneeId)}</td>
                        {can('assignTasks') && (
                          <td data-label="Action" className="table__action">
                            {ASSIGNABLE.includes(t.status) ? (
                              <Button
                                size="sm"
                                variant="secondary"
                                icon={<UserPlus size={14} />}
                                onClick={() => setAssigning(t)}
                              >
                                {t.assigneeId ? 'Reassign' : 'Assign'}
                              </Button>
                            ) : (
                              <span className="cell-sub">—</span>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          }
        </Async>
      </Card>

      <AssignTaskDialog
        task={assigning}
        isAdmin={isAdmin}
        onClose={() => setAssigning(null)}
        onAssigned={(name) => {
          notify(`${assigning?.title ?? 'Task'} sent to ${name}. They have been notified by pop-up and e-mail.`, 'success');
          setAssigning(null);
          state.reload();
        }}
      />
    </>
  );
}
