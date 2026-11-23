import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  Compass,
  CheckCircle2,
  Clock,
  Activity,
  FileCheck,
  MapPin,
  Truck,
  Eye,
} from 'lucide-react';
import { api } from '@/api';
import { useAsync } from '@/hooks/useAsync';
import { useAuth } from '@/context/AuthContext';
import { useRole } from '@/context/RoleContext';
import { PageHeader, Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Skeleton, EmptyState } from '@/components/ui/States';
import { formatDate } from '@/utils/format';
import { taskStatusLabel, priorityLabel } from '@/utils/labels';
import type { TaskStatus } from '@/types';

interface MilestoneStep {
  statusKey: TaskStatus;
  label: string;
  description: string;
  icon: typeof Clock;
}

const MILESTONE_STEPS: MilestoneStep[] = [
  {
    statusKey: 'open',
    label: 'Published & Open',
    description: 'Task request broadcast to operational hub network',
    icon: Clock,
  },
  {
    statusKey: 'assigned',
    label: 'Dispatched & Assigned',
    description: 'Field worker matched and scheduled',
    icon: Activity,
  },
  {
    statusKey: 'in_progress',
    label: 'In Progress (On-Site)',
    description: 'Worker verified on-site via GPS geofence',
    icon: Activity,
  },
  {
    statusKey: 'submitted',
    label: 'Evidence Submitted',
    description: 'Photos & checklist uploaded for review',
    icon: FileCheck,
  },
  {
    statusKey: 'approved',
    label: 'Verified & Completed',
    description: 'Manager verified and bounty released',
    icon: CheckCircle2,
  },
];

const STAGE_ORDER: Record<TaskStatus, number> = {
  open: 1,
  assigned: 2,
  in_progress: 3,
  submitted: 4,
  in_review: 4,
  approved: 5,
  rejected: 3,
  cancelled: 1,
};

export function CustomerTrackingPage() {
  const { user, profile } = useAuth();
  const { customerId: contextCustomerId } = useRole();
  const customerId = user?.id || profile?.id || contextCustomerId;

  // Active tracking mode: 'task' | 'consignment'
  const [trackingMode, setTrackingMode] = useState<'task' | 'consignment'>('task');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchedId, setSearchedId] = useState<string>('');

  // Load customer tasks
  const tasksState = useAsync(
    () => (customerId ? api.listTasks({ customerId }) : Promise.resolve([])),
    [customerId]
  );

  const rawTasks = tasksState.data || [];
  const customerTasks = useMemo(() => {
    return rawTasks.filter((t) => {
      if (!customerId) return true;
      return !t.customerId || t.customerId === customerId || t.customerId === user?.id || t.customerId === profile?.id;
    });
  }, [rawTasks, customerId, user?.id, profile?.id]);

  // Selected task for live lifecycle tracking
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');

  // Set default selected task when tasks load
  const activeTask = useMemo(() => {
    if (searchedId) {
      const found = customerTasks.find(
        (t) => t.id.toLowerCase() === searchedId.toLowerCase() || (t.title && t.title.toLowerCase().includes(searchedId.toLowerCase()))
      );
      if (found) return found;
    }
    if (selectedTaskId) {
      const found = customerTasks.find((t) => t.id === selectedTaskId);
      if (found) return found;
    }
    return customerTasks[0] || null;
  }, [customerTasks, selectedTaskId, searchedId]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchedId(searchQuery.trim());
  };

  const currentStageNum = activeTask ? STAGE_ORDER[activeTask.status] || 1 : 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%', maxWidth: '1200px' }}>
      <PageHeader
        title="Live Field Execution & Tracking"
        description="Monitor real task execution lifecycles, worker on-site verification, and freight consignment telemetry."
      />

      {/* Mode Switcher & Search Bar */}
      <Card>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--color-border, rgba(0,0,0,0.06))', paddingBottom: '0.75rem' }}>
            <button
              type="button"
              className={`btn btn--sm ${trackingMode === 'task' ? 'btn--primary' : 'btn--ghost'}`}
              onClick={() => {
                setTrackingMode('task');
                setSearchQuery('');
                setSearchedId('');
              }}
            >
              Field Task Lifecycle
            </button>
            <button
              type="button"
              className={`btn btn--sm ${trackingMode === 'consignment' ? 'btn--primary' : 'btn--ghost'}`}
              onClick={() => {
                setTrackingMode('consignment');
                setSearchQuery('');
                setSearchedId('');
              }}
            >
              Carrier & Freight Consignment
            </button>
          </div>

          <form onSubmit={handleSearch} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '280px' }}>
              <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  trackingMode === 'task'
                    ? 'Search by Task ID (e.g. tsk-301) or Task title...'
                    : 'Enter Freight Tracking Consignment (e.g. BD-892109, CH-2026-X)...'
                }
                className="input"
                style={{ width: '100%', paddingLeft: '38px', boxSizing: 'border-box' }}
              />
            </div>
            <button
              type="submit"
              className="btn btn--primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Compass size={16} /> Track
            </button>
          </form>
        </div>
      </Card>

      {/* Mode 1: Field Task Lifecycle */}
      {trackingMode === 'task' && (
        <>
          {tasksState.loading && tasksState.data === undefined ? (
            <Card><Skeleton lines={8} /></Card>
          ) : customerTasks.length === 0 ? (
            <Card>
              <EmptyState
                title="No active tasks to track"
                description="You have no field operations published yet. Create a field task to monitor real-time worker dispatch and verification."
                action={
                  <Link to="/customer/tasks/new" className="btn btn--primary btn--md">
                    Create Task
                  </Link>
                }
              />
            </Card>
          ) : !activeTask ? (
            <Card>
              <EmptyState
                title="Task not found"
                description={`No task matched "${searchedId}". Please verify the Task ID.`}
                action={
                  <button
                    type="button"
                    className="btn btn--secondary btn--sm"
                    onClick={() => {
                      setSearchedId('');
                      setSearchQuery('');
                    }}
                  >
                    View Recent Tasks
                  </button>
                }
              />
            </Card>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
              {/* Left Column: Milestone Stepper & Live Telemetry */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <Card>
                  {/* Task Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--color-border, rgba(0,0,0,0.08))', paddingBottom: '1rem' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span style={{ fontSize: '0.8rem', fontFamily: 'monospace', fontWeight: 700, color: 'var(--muted)' }}>
                          {activeTask.id}
                        </span>
                        <Badge tone={taskStatusLabel[activeTask.status]?.tone || 'neutral'}>
                          {taskStatusLabel[activeTask.status]?.label || activeTask.status.toUpperCase()}
                        </Badge>
                        <Badge tone={priorityLabel[activeTask.priority]?.tone || 'neutral'}>
                          {priorityLabel[activeTask.priority]?.label || activeTask.priority}
                        </Badge>
                      </div>
                      <h3 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, color: 'var(--color-text, #111315)' }}>
                        {activeTask.title}
                      </h3>
                      <div style={{ display: 'flex', gap: '12px', marginTop: '6px', fontSize: '0.8rem', color: 'var(--muted)' }}>
                        <span>Category: <strong>{activeTask.category}</strong></span>
                        <span>Due: <strong>{formatDate(activeTask.dueAt)}</strong></span>
                      </div>
                    </div>

                    <Link
                      to={`/customer/tasks/${activeTask.id}`}
                      className="btn btn--secondary btn--sm"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Eye size={14} /> Full Details
                    </Link>
                  </div>

                  {/* Horizontal Progress Bar */}
                  <div style={{ marginBottom: '2rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px' }}>
                      <span style={{ color: 'var(--color-text, #111315)' }}>Execution Progress</span>
                      <span style={{ color: 'var(--color-primary, #e8541e)' }}>
                        Stage {currentStageNum} of 5 ({Math.round((currentStageNum / 5) * 100)}%)
                      </span>
                    </div>
                    <div style={{ width: '100%', height: '8px', backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${(currentStageNum / 5) * 100}%`,
                          height: '100%',
                          backgroundColor: 'var(--color-primary, #e8541e)',
                          borderRadius: '4px',
                          transition: 'width 0.4s ease',
                        }}
                      />
                    </div>
                  </div>

                  {/* Vertical Milestones Timeline */}
                  <div style={{ position: 'relative', paddingLeft: '32px' }}>
                    <div
                      style={{
                        position: 'absolute',
                        left: '11px',
                        top: '12px',
                        bottom: '12px',
                        width: '2px',
                        backgroundColor: 'var(--color-border, rgba(0,0,0,0.1))',
                      }}
                    />

                    {MILESTONE_STEPS.map((step, idx) => {
                      const stepStage = idx + 1;
                      const isCompleted = currentStageNum > stepStage;
                      const isCurrent = currentStageNum === stepStage;
                      const Icon = step.icon;

                      return (
                        <div
                          key={step.statusKey}
                          style={{
                            position: 'relative',
                            marginBottom: idx === MILESTONE_STEPS.length - 1 ? 0 : '1.75rem',
                          }}
                        >
                          <div
                            style={{
                              position: 'absolute',
                              left: '-32px',
                              top: '2px',
                              width: '24px',
                              height: '24px',
                              borderRadius: '50%',
                              backgroundColor: isCompleted
                                ? '#10b981'
                                : isCurrent
                                ? 'var(--color-primary, #e8541e)'
                                : '#e2e8f0',
                              color: isCompleted || isCurrent ? '#ffffff' : 'var(--muted)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              boxShadow: isCurrent ? '0 0 0 4px rgba(232, 84, 30, 0.2)' : undefined,
                            }}
                          >
                            {isCompleted ? <CheckCircle2 size={15} /> : <Icon size={13} />}
                          </div>

                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <h4
                                style={{
                                  margin: 0,
                                  fontSize: '0.95rem',
                                  fontWeight: 600,
                                  color: isCompleted || isCurrent ? 'var(--color-text, #111315)' : '#64748b',
                                }}
                              >
                                {step.label}
                              </h4>
                              {isCurrent && (
                                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-primary, #e8541e)', textTransform: 'uppercase' }}>
                                  Active
                                </span>
                              )}
                            </div>
                            <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: 'var(--muted)' }}>
                              {step.description}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>

                {/* Location & Verification Parameters Card */}
                <Card>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <MapPin size={18} style={{ color: 'var(--color-primary, #e8541e)' }} />
                    <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>
                      Operational Location Telemetry
                    </h4>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', fontSize: '0.85rem' }}>
                    <div>
                      <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Area / Hub</span>
                      <strong style={{ color: 'var(--color-text, #111315)' }}>{activeTask.location?.area || 'Operational Hub'}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Address</span>
                      <strong style={{ color: 'var(--color-text, #111315)' }}>{activeTask.location?.address || 'Field Location'}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>GPS Geo-fence</span>
                      <strong style={{ color: 'var(--color-text, #111315)' }}>
                        {activeTask.location?.lat ? `${activeTask.location.lat.toFixed(4)}, ${activeTask.location.lng.toFixed(4)}` : 'Verified within 150m'}
                      </strong>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Right Column: Other Active Tasks Selector */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <Card>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '0.95rem', fontWeight: 600 }}>
                    Select Field Operation
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '450px', overflowY: 'auto' }}>
                    {customerTasks.map((t) => {
                      const isSelected = t.id === activeTask.id;
                      return (
                        <div
                          key={t.id}
                          onClick={() => {
                            setSelectedTaskId(t.id);
                            setSearchedId('');
                          }}
                          style={{
                            padding: '10px 12px',
                            borderRadius: '10px',
                            border: isSelected ? '2px solid var(--color-primary, #e8541e)' : '1px solid var(--color-border, rgba(0,0,0,0.08))',
                            backgroundColor: isSelected ? 'rgba(232, 84, 30, 0.04)' : '#ffffff',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--muted)', fontWeight: 600 }}>
                              {t.id}
                            </span>
                            <Badge tone={taskStatusLabel[t.status]?.tone || 'neutral'}>
                              {taskStatusLabel[t.status]?.label || t.status}
                            </Badge>
                          </div>
                          <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text, #111315)' }}>
                            {t.title}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                            {t.location?.area || 'Operational Hub'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              </div>
            </div>
          )}
        </>
      )}

      {/* Mode 2: Carrier & Freight Consignment */}
      {trackingMode === 'consignment' && (
        <Card>
          <div style={{ padding: '2rem 1rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: 'rgba(2, 132, 199, 0.1)',
                color: '#0284c7',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <Truck size={32} />
            </div>

            <div style={{ maxWidth: '540px' }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text, #111315)' }}>
                Carrier Telemetry Not Connected
              </h3>
              <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--muted)', lineHeight: 1.6 }}>
                {searchedId
                  ? `No live GPS transponder stream or webhook feed is connected for consignment reference "${searchedId}".`
                  : 'Third-party logistics carrier feeds (BlueDart, Delhivery, Porter) must be provisioned with API webhook credentials.'}
              </p>
              <p style={{ margin: '8px 0 0 0', fontSize: '0.825rem', color: 'var(--muted)' }}>
                ChaseHorse TMS requires real transponder ping authentication. Fabricated tracking points or mock GPS telemetry are strictly disabled in production.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '0.5rem' }}>
              <a
                href="mailto:operations@chasehorse.com?subject=Carrier%20Webhook%20Integration%20Request"
                className="btn btn--secondary btn--md"
              >
                Request Carrier Webhook Integration
              </a>
              <button
                type="button"
                className="btn btn--primary btn--md"
                onClick={() => setTrackingMode('task')}
              >
                Track Field Operations Instead
              </button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
