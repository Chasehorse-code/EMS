import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  MapPin,
  Calendar,
  IndianRupee,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Activity,
  FileCheck,
  Camera,
  ZoomIn,
  ZoomOut,
  Maximize2,
  X,
  ChevronLeft,
  ChevronRight,
  Check,
  Star,
} from 'lucide-react';
import { api } from '@/api';
import { useAsync } from '@/hooks/useAsync';
import { useAuth } from '@/context/AuthContext';
import { useRole } from '@/context/RoleContext';
import { PageHeader, Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Skeleton, Notice, ErrorState } from '@/components/ui/States';
import { formatDate, formatDateTime, formatInr } from '@/utils/format';
import { priorityLabel, taskStatusLabel } from '@/utils/labels';
import type { TaskStatus, EvidencePhoto } from '@/types';

// Milestone pipeline definition for tracking
interface MilestoneStep {
  statusKey: TaskStatus;
  label: string;
  description: string;
  icon: typeof Clock;
}

const MILESTONES: MilestoneStep[] = [
  {
    statusKey: 'open',
    label: 'Published',
    description: 'Task request broadcast to operational hub network',
    icon: Clock,
  },
  {
    statusKey: 'assigned',
    label: 'Assigned',
    description: 'Field worker matched and scheduled',
    icon: Activity,
  },
  {
    statusKey: 'in_progress',
    label: 'In Progress',
    description: 'Worker on-site executing verification checklist',
    icon: Activity,
  },
  {
    statusKey: 'submitted',
    label: 'Evidence Submitted',
    description: 'Geotagged photos & checklist uploaded for review',
    icon: FileCheck,
  },
  {
    statusKey: 'approved',
    label: 'Approved & Completed',
    description: 'Verification confirmed and bounty released',
    icon: CheckCircle2,
  },
];

const STATUS_STAGE_MAP: Record<TaskStatus, number> = {
  open: 1,
  assigned: 2,
  in_progress: 3,
  submitted: 4,
  in_review: 4,
  approved: 5,
  rejected: 3,
  cancelled: 1,
};

export function CustomerTaskDetailsPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const { user, profile, loading: authLoading } = useAuth();
  const { customerId: contextCustomerId } = useRole();
  const location = useLocation();

  // Active customer identifier
  const customerId = user?.id || profile?.id || contextCustomerId;

  // Load customer tasks
  const tasksState = useAsync(
    () => (customerId ? api.listTasks({ customerId }) : Promise.resolve([])),
    [customerId],
  );

  // Load checklists for template inspection
  const checklistsState = useAsync(() => api.listChecklists(), []);

  // Load evidence for photo gallery
  const evidenceState = useAsync(
    () => api.listEvidence({ customerId }),
    [customerId]
  );

  // Lightbox Modal state
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  // Customer Feedback & Rating state
  const [feedback, setFeedback] = useState<import('@/types').TaskFeedbackView | null>(null);
  const [overallRating, setOverallRating] = useState<number>(5);
  const [qualityRating, setQualityRating] = useState<number>(5);
  const [punctualityRating, setPunctualityRating] = useState<number>(5);
  const [communicationRating, setCommunicationRating] = useState<number>(5);
  const [evidenceClarityRating, setEvidenceClarityRating] = useState<number>(5);
  const [comment, setComment] = useState<string>('');
  const [submittingFeedback, setSubmittingFeedback] = useState<boolean>(false);

  useEffect(() => {
    if (taskId) {
      api.getTaskFeedback(taskId).then(setFeedback).catch(() => setFeedback(null));
    }
  }, [taskId]);

  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskId) return;
    setSubmittingFeedback(true);
    try {
      const res = await api.submitTaskFeedback(taskId, {
        overallRating,
        qualityRating,
        punctualityRating,
        communicationRating,
        evidenceClarityRating,
        comment,
      });
      setFeedback(res);
    } catch (err: unknown) {
      console.error('[Feedback] Submission error:', err);
    } finally {
      setSubmittingFeedback(false);
    }
  };

  // 1. Unauthenticated gate
  if (!authLoading && !user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // 2. Auth loading state
  if (authLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
        <PageHeader title="Task Details" description="Resolving session..." />
        <Card>
          <Skeleton lines={6} />
        </Card>
      </div>
    );
  }

  // 3. Network error state
  if (tasksState.error && tasksState.data === undefined) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
        <PageHeader
          title="Task Details"
          description="View task execution telemetry, status milestones, and verified evidence."
          actions={
            <Link to="/customer/history" className="btn btn--ghost btn--md">
              <span className="btn__icon" aria-hidden><ArrowLeft size={16} /></span>
              Back to My Tasks
            </Link>
          }
        />
        <Card>
          <ErrorState message={tasksState.error} onRetry={tasksState.reload} />
        </Card>
      </div>
    );
  }

  // 4. Data loading state
  if (tasksState.loading && tasksState.data === undefined) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
        <PageHeader
          title="Loading Task Details..."
          description="Fetching task telemetry and evidence from the server..."
        />
        <Card>
          <Skeleton lines={8} />
        </Card>
      </div>
    );
  }

  const allTasks = tasksState.data || [];
  const task = allTasks.find((t) => t.id === taskId);

  // 5. Not Found check
  if (!task) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
        <PageHeader
          title="Task Not Found"
          description="The requested field task could not be located or belongs to another organization."
          actions={
            <Link to="/customer/history" className="btn btn--ghost btn--md">
              <span className="btn__icon" aria-hidden><ArrowLeft size={16} /></span>
              Back to My Tasks
            </Link>
          }
        />
        <Card>
          <Notice tone="warning" title="Missing Record">
            <p style={{ margin: 0 }}>
              Task reference <strong>{taskId}</strong> was not found in your operational records.
            </p>
          </Notice>
        </Card>
      </div>
    );
  }

  const statusInfo = taskStatusLabel[task.status] || { label: task.status, tone: 'neutral' };
  const priorityInfo = priorityLabel[task.priority] || { label: task.priority, tone: 'neutral' };
  const currentStage = STATUS_STAGE_MAP[task.status] || 1;

  // Resolve checklist
  const allTemplates = checklistsState.data || [];
  const checklist = allTemplates.find((tpl) => tpl.id === task.checklistTemplateId) ||
    allTemplates.find((tpl) => tpl.category === task.category);

  // Filter evidence photos for this specific task
  const allEvidence = evidenceState.data || [];
  const taskEvidence = allEvidence.find((e) => e.taskId === task.id);
  const photos: EvidencePhoto[] = taskEvidence?.photos || [];

  const activePhoto = lightboxIndex !== null ? photos[lightboxIndex] : null;

  const handlePrevPhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (lightboxIndex !== null && photos.length > 0) {
      setLightboxIndex((lightboxIndex - 1 + photos.length) % photos.length);
      setZoomLevel(1);
    }
  };

  const handleNextPhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (lightboxIndex !== null && photos.length > 0) {
      setLightboxIndex((lightboxIndex + 1) % photos.length);
      setZoomLevel(1);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%', maxWidth: '1200px' }}>
      <PageHeader
        title={task.title}
        description={`Reference ID: ${task.id} • Registered under ${task.category}`}
        actions={
          <div style={{ display: 'flex', gap: '8px' }}>
            <Link to="/customer/history" className="btn btn--ghost btn--md">
              <span className="btn__icon" aria-hidden><ArrowLeft size={16} /></span>
              Back to Tasks
            </Link>
            <Link to="/customer/support" className="btn btn--secondary btn--md">
              Support Inquiry
            </Link>
          </div>
        }
      />

      {/* Lifecycle Progress Stepper Bar */}
      <Card>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: 'var(--color-text, #111315)' }}>
              Execution Lifecycle & Status Stepper
            </h3>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Badge tone={priorityInfo.tone}>{priorityInfo.label}</Badge>
              <Badge tone={statusInfo.tone}>{statusInfo.label}</Badge>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${MILESTONES.length}, 1fr)`,
              gap: '12px',
              position: 'relative',
            }}
          >
            {MILESTONES.map((step, idx) => {
              const stepStage = idx + 1;
              const isCompleted = currentStage > stepStage;
              const isCurrent = currentStage === stepStage;
              const Icon = step.icon;

              return (
                <div
                  key={step.statusKey}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    backgroundColor: isCurrent ? 'rgba(232, 84, 30, 0.05)' : isCompleted ? 'rgba(16, 185, 129, 0.05)' : 'rgba(0,0,0,0.02)',
                    border: isCurrent ? '1.5px solid var(--color-primary, #e8541e)' : '1px solid var(--color-border, rgba(0,0,0,0.06))',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div
                      style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        backgroundColor: isCompleted ? '#10b981' : isCurrent ? 'var(--color-primary, #e8541e)' : '#cbd5e1',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '11px',
                        fontWeight: 700,
                      }}
                    >
                      {isCompleted ? <Check size={12} /> : <Icon size={11} />}
                    </div>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: isCurrent || isCompleted ? 'var(--color-text, #111315)' : '#64748b' }}>
                      {step.label}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--muted)', lineHeight: 1.4 }}>
                    {step.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      {/* Main Grid: Details on Left, Checklist on Right */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
        {/* Left Column: Specifications & Location */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <Card aria-labelledby="details-heading">
            <CardHeader
              id="details-heading"
              title="Task Information"
              subtitle="Full campaign scope and execution parameters"
            />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--muted)', display: 'block' }}>Task ID</span>
                <strong style={{ fontFamily: 'monospace', fontSize: '0.9rem', color: 'var(--color-text, #111315)' }}>{task.id}</strong>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--muted)', display: 'block' }}>Category</span>
                <strong style={{ fontSize: '0.9rem', color: 'var(--color-text, #111315)' }}>{task.category}</strong>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--muted)', display: 'block' }}>Due Date</span>
                <strong style={{ fontSize: '0.9rem', color: 'var(--color-text, #111315)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <Calendar size={14} /> {formatDate(task.dueAt)}
                </strong>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--muted)', display: 'block' }}>Execution Bounty</span>
                <strong style={{ fontSize: '0.95rem', color: 'var(--color-text, #111315)', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                  <IndianRupee size={14} /> {formatInr(task.rewardInr)}
                </strong>
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--color-border, rgba(0,0,0,0.08))', paddingTop: '1rem' }}>
              <strong style={{ fontSize: '0.85rem', display: 'block', marginBottom: '6px', color: 'var(--color-text, #111315)' }}>
                Instructions / Scope of Work
              </strong>
              <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.6, color: 'var(--color-text, #111315)', whiteSpace: 'pre-wrap' }}>
                {task.description || 'No special instructions provided.'}
              </p>
            </div>
          </Card>

          {/* Operational Location & Geotag */}
          <Card aria-labelledby="location-heading">
            <CardHeader
              id="location-heading"
              title="Operational Location & Geotag"
              subtitle="On-site GPS boundaries where field workers must check in"
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <MapPin size={18} style={{ color: 'var(--color-primary, #e8541e)', marginTop: '2px', flexShrink: 0 }} aria-hidden />
                <div>
                  <strong style={{ fontSize: '0.95rem', color: 'var(--color-text, #111315)' }}>{task.location?.area || 'Operational Area'}</strong>
                  <p style={{ margin: '2px 0 0 0', color: 'var(--muted)', fontSize: '0.85rem' }}>
                    {task.location?.address || 'Field Location Landmark'}
                  </p>
                </div>
              </div>

              {task.location?.lat && task.location?.lng && (
                <div style={{ fontSize: '0.8rem', color: 'var(--muted)', fontFamily: 'monospace', backgroundColor: 'rgba(0,0,0,0.03)', padding: '6px 10px', borderRadius: '6px' }}>
                  Coordinates: {task.location.lat.toFixed(5)}, {task.location.lng.toFixed(5)} (150m geo-fence radius)
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Right Column: Required Verification Checklist */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <Card aria-labelledby="checklist-spec-heading">
            <CardHeader
              id="checklist-spec-heading"
              title="Verification Checklist"
              subtitle={checklist ? checklist.name : 'Category Checklist'}
            />

            {checklistsState.loading ? (
              <Skeleton lines={4} />
            ) : checklist && checklist.items.length > 0 ? (
              <ol style={{ listStylePosition: 'inside', paddingLeft: 0, margin: 0 }}>
                {checklist.items.map((item) => (
                  <li
                    key={item.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 0',
                      borderBottom: '1px solid var(--color-border, rgba(0,0,0,0.06))',
                      fontSize: '13.5px',
                    }}
                  >
                    <span style={{ fontWeight: 500, color: 'var(--color-text, #111315)' }}>{item.label}</span>
                    <span style={{ display: 'flex', gap: '4px' }}>
                      {item.required ? (
                        <span className="chip chip--strong">Required</span>
                      ) : (
                        <span className="chip">Optional</span>
                      )}
                      {item.requiresPhoto && (
                        <span className="chip chip--photo" style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          <Camera size={11} aria-hidden /> Photo
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p style={{ color: '#64748b', fontSize: '13px' }}>
                Standard verification checklist will be completed by the assigned field worker.
              </p>
            )}
          </Card>

          <Card>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <ShieldCheck size={20} style={{ color: '#10b981', flexShrink: 0, marginTop: '2px' }} />
              <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
                <strong style={{ color: 'var(--color-text, #111315)', display: 'block', marginBottom: '2px' }}>
                  Enterprise Verification Guarantee
                </strong>
                Evidence uploaded by field workers undergoes GPS geo-fence validation, camera metadata cross-checking, and manager verification before final payout approval.
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Photo Evidence Gallery Section */}
      <Card aria-labelledby="evidence-gallery-heading">
        <CardHeader
          id="evidence-gallery-heading"
          title="Verified Photo Evidence Gallery"
          subtitle={
            photos.length > 0
              ? `${photos.length} geotagged on-site photo(s) submitted for this operation`
              : 'Awaiting field worker submission'
          }
        />

        {photos.length === 0 ? (
          <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--muted)' }}>
            <Camera size={36} style={{ margin: '0 auto 8px auto', color: 'var(--muted)' }} />
            <h4 style={{ margin: '0 0 4px 0', fontSize: '1rem', color: 'var(--color-text, #111315)' }}>
              No Photo Evidence Uploaded Yet
            </h4>
            <p style={{ margin: 0, fontSize: '0.85rem' }}>
              When the assigned field worker checks in and uploads audit photos, they will display here with verified timestamp and geo-coordinates.
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
            {photos.map((photo, index) => {
              const photoUrl = photo.url || `https://picsum.photos/seed/${photo.id || index}/800/600`;
              return (
                <div
                  key={photo.id || index}
                  onClick={() => {
                    setLightboxIndex(index);
                    setZoomLevel(1);
                  }}
                  style={{
                    borderRadius: '12px',
                    overflow: 'hidden',
                    border: '1px solid var(--color-border, rgba(0,0,0,0.08))',
                    backgroundColor: '#ffffff',
                    cursor: 'pointer',
                    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                  }}
                  className="hover-lift"
                >
                  <div style={{ position: 'relative', height: '160px', backgroundColor: 'var(--surface-2)' }}>
                    <img
                      src={photoUrl}
                      alt={photo.caption || 'Evidence photo'}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      loading="lazy"
                    />
                    <div
                      style={{
                        position: 'absolute',
                        bottom: '8px',
                        right: '8px',
                        backgroundColor: 'rgba(0,0,0,0.65)',
                        color: '#ffffff',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <Maximize2 size={12} /> Click to expand
                    </div>
                  </div>

                  <div style={{ padding: '10px' }}>
                    <h5 style={{ margin: '0 0 4px 0', fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text, #111315)' }}>
                      {photo.caption || `Photo Evidence #${index + 1}`}
                    </h5>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--muted)' }}>
                      <span>{photo.capturedAt ? formatDate(photo.capturedAt) : 'On-Site Verified'}</span>
                      <span style={{ color: '#10b981', fontWeight: 600 }}>GPS Valid</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* 5. Customer Feedback & Worker Rating (when task is approved) */}
      {task.status === 'approved' && (
        <Card>
          <CardHeader
            title="Customer Rating & Feedback"
            subtitle="Verified customer review recorded for field worker performance records."
          />
          <div style={{ padding: '0 1.5rem 1.5rem 1.5rem' }}>
            {feedback ? (
              <div
                style={{
                  background: 'rgba(16, 185, 129, 0.04)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  borderRadius: '12px',
                  padding: '1.25rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ display: 'flex', color: 'var(--accent-orange)' }}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          size={18}
                          fill={star <= feedback.overallRating ? 'var(--accent-orange)' : 'none'}
                          stroke={star <= feedback.overallRating ? 'var(--accent-orange)' : '#cbd5e1'}
                        />
                      ))}
                    </div>
                    <strong style={{ fontSize: '1rem', color: 'var(--color-text, #0f172a)' }}>
                      {feedback.overallRating}.0 / 5.0
                    </strong>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                    Submitted on {formatDateTime(feedback.createdAt)}
                  </span>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '10px' }}>
                  <span>Quality: <strong>{feedback.qualityRating}/5</strong></span>
                  <span>Punctuality: <strong>{feedback.punctualityRating}/5</strong></span>
                  <span>Communication: <strong>{feedback.communicationRating}/5</strong></span>
                  <span>Evidence Clarity: <strong>{feedback.evidenceClarityRating}/5</strong></span>
                </div>

                {feedback.comment && (
                  <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--color-text, #1e293b)', fontStyle: 'italic', background: '#ffffff', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.06)' }}>
                    "{feedback.comment}"
                  </p>
                )}
              </div>
            ) : (
              <form onSubmit={handleSubmitFeedback} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '6px', color: 'var(--color-text, #0f172a)' }}>
                    Overall Worker Rating
                  </label>
                  <div style={{ display: 'flex', gap: '8px', cursor: 'pointer' }}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setOverallRating(star)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                        aria-label={`${star} star`}
                      >
                        <Star
                          size={28}
                          fill={star <= overallRating ? 'var(--accent-orange)' : 'none'}
                          stroke={star <= overallRating ? 'var(--accent-orange)' : '#94a3b8'}
                          style={{ transition: 'transform 0.15s ease' }}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 600, color: 'var(--muted)', marginBottom: '4px' }}>
                      Execution Quality ({qualityRating}/5)
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="5"
                      value={qualityRating}
                      onChange={(e) => setQualityRating(Number(e.target.value))}
                      style={{ width: '100%', accentColor: 'var(--accent-orange)' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 600, color: 'var(--muted)', marginBottom: '4px' }}>
                      Punctuality ({punctualityRating}/5)
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="5"
                      value={punctualityRating}
                      onChange={(e) => setPunctualityRating(Number(e.target.value))}
                      style={{ width: '100%', accentColor: 'var(--accent-orange)' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 600, color: 'var(--muted)', marginBottom: '4px' }}>
                      Communication ({communicationRating}/5)
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="5"
                      value={communicationRating}
                      onChange={(e) => setCommunicationRating(Number(e.target.value))}
                      style={{ width: '100%', accentColor: 'var(--accent-orange)' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 600, color: 'var(--muted)', marginBottom: '4px' }}>
                      Evidence Clarity ({evidenceClarityRating}/5)
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="5"
                      value={evidenceClarityRating}
                      onChange={(e) => setEvidenceClarityRating(Number(e.target.value))}
                      style={{ width: '100%', accentColor: 'var(--accent-orange)' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px', color: 'var(--muted)' }}>
                    Written Feedback / Review Comments
                  </label>
                  <textarea
                    rows={3}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Share feedback on on-site demeanor, evidence clarity, and punctuality..."
                    className="input"
                    style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical' }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="submit"
                    disabled={submittingFeedback}
                    className="btn btn--primary"
                    style={{
                      backgroundColor: '#111315',
                      color: '#ffffff',
                      border: 'none',
                      padding: '10px 20px',
                      borderRadius: '8px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {submittingFeedback ? 'Submitting...' : 'Submit Feedback & Rating'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </Card>
      )}

      {/* Lightbox Modal */}
      {lightboxIndex !== null && activePhoto && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.88)',
            zIndex: 1100,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '1.25rem',
          }}
          onClick={() => setLightboxIndex(null)}
        >
          {/* Top Bar */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              color: '#ffffff',
              zIndex: 2,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>
                {activePhoto.caption || `Evidence Photo ${lightboxIndex + 1} of ${photos.length}`}
              </h4>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: 'var(--muted)' }}>
                Captured: {activePhoto.capturedAt ? formatDateTime(activePhoto.capturedAt) : 'Verified on-site'}
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                className="btn btn--secondary btn--sm"
                onClick={() => setZoomLevel((z) => Math.max(z - 0.25, 0.75))}
                title="Zoom Out"
              >
                <ZoomOut size={16} />
              </button>
              <span style={{ fontSize: '0.8rem', minWidth: '45px', textAlign: 'center' }}>
                {Math.round(zoomLevel * 100)}%
              </span>
              <button
                type="button"
                className="btn btn--secondary btn--sm"
                onClick={() => setZoomLevel((z) => Math.min(z + 0.25, 2.5))}
                title="Zoom In"
              >
                <ZoomIn size={16} />
              </button>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => setLightboxIndex(null)}
                style={{ color: '#ffffff', marginLeft: '12px' }}
                title="Close Lightbox"
              >
                <X size={22} />
              </button>
            </div>
          </div>

          {/* Central Image View with Navigation Buttons */}
          <div
            style={{
              position: 'relative',
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {photos.length > 1 && (
              <button
                type="button"
                onClick={handlePrevPhoto}
                style={{
                  position: 'absolute',
                  left: '10px',
                  backgroundColor: 'rgba(0,0,0,0.5)',
                  border: 'none',
                  color: '#ffffff',
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  zIndex: 3,
                }}
                title="Previous photo"
              >
                <ChevronLeft size={24} />
              </button>
            )}

            <img
              src={activePhoto.url || `https://picsum.photos/seed/${activePhoto.id || lightboxIndex}/1200/900`}
              alt={activePhoto.caption || 'Evidence photo full preview'}
              style={{
                maxWidth: '90%',
                maxHeight: '80vh',
                objectFit: 'contain',
                transform: `scale(${zoomLevel})`,
                transition: 'transform 0.2s ease',
                borderRadius: '8px',
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
              }}
            />

            {photos.length > 1 && (
              <button
                type="button"
                onClick={handleNextPhoto}
                style={{
                  position: 'absolute',
                  right: '10px',
                  backgroundColor: 'rgba(0,0,0,0.5)',
                  border: 'none',
                  color: '#ffffff',
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  zIndex: 3,
                }}
                title="Next photo"
              >
                <ChevronRight size={24} />
              </button>
            )}
          </div>

          {/* Bottom Info Bar */}
          <div
            style={{
              backgroundColor: 'rgba(15, 23, 42, 0.85)',
              padding: '10px 16px',
              borderRadius: '10px',
              color: '#ffffff',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '0.825rem',
              zIndex: 2,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck size={16} color="#10b981" />
              <span>
                Verified In-App Camera Metadata • GPS Match: {task.location?.lat?.toFixed(4)}, {task.location?.lng?.toFixed(4)}
              </span>
            </div>
            <span style={{ color: '#94a3b8' }}>
              Photo {lightboxIndex + 1} of {photos.length}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
