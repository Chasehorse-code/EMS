import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  Send,
  RotateCcw,
  Plus,
  Trash2,
  ListPlus,
  Layers,
  MapPin,
  ShieldCheck,
} from 'lucide-react';
import { api } from '@/api';
import { useAsync } from '@/hooks/useAsync';
import { useAuth } from '@/context/AuthContext';
import { useRole } from '@/context/RoleContext';
import { PageHeader, Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Notice, Skeleton } from '@/components/ui/States';
import { SelectField, TextAreaField, TextField } from '@/components/ui/Fields';
import { OPERATIONAL_HUBS } from '@/config/locations';
import type { Task, TaskCategory, TaskPriority } from '@/types';

const CATEGORIES: TaskCategory[] = [
  'Shelf audit',
  'Site survey',
  'Signage check',
  'Equipment inspection',
  'Delivery proof',
];

const PRIORITIES: TaskPriority[] = ['low', 'normal', 'high', 'urgent'];

interface CustomItem {
  id: string;
  label: string;
  required: boolean;
  requiresPhoto: boolean;
}

interface FormErrors {
  title?: string;
  category?: string;
  priority?: string;
  description?: string;
  areaKey?: string;
  address?: string;
  dueAt?: string;
  rewardInr?: string;
  templateId?: string;
  customChecklist?: string;
}

export function CreateTaskPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const { role, customerId: contextCustomerId } = useRole();
  const location = useLocation();

  // Load available checklist templates from shared API client
  const checklistsState = useAsync(() => api.listChecklists(), []);
  const templates = checklistsState.data ?? [];

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<TaskCategory>('Shelf audit');
  const [priority, setPriority] = useState<TaskPriority>('normal');
  const [areaKey, setAreaKey] = useState('central');
  const [address, setAddress] = useState('');
  const [dueAt, setDueAt] = useState(() => {
    // Default to 48 hours from now formatted for datetime-local
    const target = new Date(Date.now() + 48 * 3600 * 1000);
    target.setMinutes(target.getMinutes() - target.getTimezoneOffset());
    return target.toISOString().slice(0, 16);
  });
  const [rewardInr, setRewardInr] = useState('450');
  const [templateOverride, setTemplateOverride] = useState('');

  // Checklist mode: 'template' | 'custom'
  const [checklistMode, setChecklistMode] = useState<'template' | 'custom'>('template');
  const [customItems, setCustomItems] = useState<CustomItem[]>([
    { id: '1', label: 'Capture storefront entrance & signage', required: true, requiresPhoto: true },
    { id: '2', label: 'Verify shelf facing and count available SKU facings', required: true, requiresPhoto: true },
    { id: '3', label: 'Record store manager name & notes', required: false, requiresPhoto: false },
  ]);

  // Coordinates fine-tuning
  const selectedHub = OPERATIONAL_HUBS[areaKey] || OPERATIONAL_HUBS.central;
  const [customLat, setCustomLat] = useState<string>(() => selectedHub.lat.toString());
  const [customLng, setCustomLng] = useState<string>(() => selectedHub.lng.toString());

  // Form UI states
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [createdTask, setCreatedTask] = useState<Task | null>(null);

  // Derive template selection for template mode
  const templateId =
    templateOverride || templates.find((t) => t.category === category)?.id || templates[0]?.id || '';
  const selectedTemplate = templates.find((t) => t.id === templateId);

  // Customer identity
  const customerId = user?.id || profile?.id || contextCustomerId || 'cust-apex';
  const isCustomerRole = role === 'customer';

  // 1. Unauthenticated gate: Block users who are not logged in
  if (!authLoading && !user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // 2. Auth loading state
  if (authLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
        <PageHeader title="Create Field Task" description="Resolving user session..." />
        <Card>
          <Skeleton lines={6} />
        </Card>
      </div>
    );
  }

  // Handle Hub change: also sync default lat/lng
  const handleHubChange = (newHubKey: string) => {
    setAreaKey(newHubKey);
    const hub = OPERATIONAL_HUBS[newHubKey] || OPERATIONAL_HUBS.central;
    setCustomLat(hub.lat.toString());
    setCustomLng(hub.lng.toString());
    if (errors.areaKey) setErrors((prev) => ({ ...prev, areaKey: undefined }));
  };

  // Custom checklist helpers
  const addCustomItem = () => {
    setCustomItems((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        label: '',
        required: true,
        requiresPhoto: true,
      },
    ]);
  };

  const removeCustomItem = (id: string) => {
    if (customItems.length <= 1) return;
    setCustomItems((prev) => prev.filter((i) => i.id !== id));
  };

  const updateCustomItem = (id: string, updates: Partial<CustomItem>) => {
    setCustomItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, ...updates } : i))
    );
  };

  // Validation function
  function validateForm(): FormErrors {
    const errs: FormErrors = {};

    if (!title.trim()) {
      errs.title = 'Task title is required.';
    } else if (title.trim().length < 5) {
      errs.title = 'Title must be at least 5 characters.';
    }

    if (!category) {
      errs.category = 'Task category is required.';
    }

    if (!priority) {
      errs.priority = 'Priority level is required.';
    }

    if (!description.trim()) {
      errs.description = 'Task instructions / scope of work are required.';
    } else if (description.trim().length < 10) {
      errs.description = 'Please provide detailed instructions (at least 10 characters).';
    }

    if (!areaKey) {
      errs.areaKey = 'Operational area / hub is required.';
    }

    if (!address.trim()) {
      errs.address = 'Store address or location landmark is required.';
    }

    if (!dueAt) {
      errs.dueAt = 'Due date and time is required.';
    } else {
      const dueTimestamp = new Date(dueAt).getTime();
      if (Number.isNaN(dueTimestamp)) {
        errs.dueAt = 'Please enter a valid date and time.';
      } else if (dueTimestamp <= Date.now()) {
        errs.dueAt = 'Due date must be in the future.';
      }
    }

    const rewardNum = Number(rewardInr);
    if (!rewardInr || rewardInr.trim() === '') {
      errs.rewardInr = 'Reward amount is required.';
    } else if (Number.isNaN(rewardNum) || rewardNum < 50) {
      errs.rewardInr = 'Reward must be a valid amount of at least ₹50.';
    }

    if (checklistMode === 'template' && !templateId) {
      errs.templateId = 'A checklist template is required.';
    }

    if (checklistMode === 'custom') {
      const emptyItems = customItems.filter((i) => !i.label.trim());
      if (emptyItems.length > 0) {
        errs.customChecklist = 'All custom checklist steps must have a description.';
      }
    }

    return errs;
  }

  // Form submission handler
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setNetworkError(null);

    const validationErrors = validateForm();
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    setIsSubmitting(true);

    try {
      let activeTemplateId = templateId;

      // If user built a custom checklist, create template first via API
      if (checklistMode === 'custom') {
        const createdTpl = await api.createChecklist({
          name: `${title.trim()} Checklist`,
          category,
          items: customItems.map((item, idx) => ({
            label: item.label.trim(),
            required: item.required,
            requiresPhoto: item.requiresPhoto,
            sortOrder: idx + 1,
          })),
        });
        activeTemplateId = createdTpl.id;
      }

      const parsedLat = parseFloat(customLat) || selectedHub.lat;
      const parsedLng = parseFloat(customLng) || selectedHub.lng;

      const task = await api.createTask({
        title: title.trim(),
        description: description.trim(),
        category,
        priority,
        customerId,
        areaKey,
        address: address.trim(),
        dueAt: new Date(dueAt).toISOString(),
        rewardInr: Number(rewardInr),
        checklistTemplateId: activeTemplateId,
        locationLat: parsedLat,
        locationLng: parsedLng,
      });

      setCreatedTask(task);
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : 'Failed to submit task to server. Please check your network connection and try again.';
      setNetworkError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleReset() {
    setTitle('');
    setDescription('');
    setCategory('Shelf audit');
    setPriority('normal');
    setAreaKey('central');
    setAddress('');
    const target = new Date(Date.now() + 48 * 3600 * 1000);
    target.setMinutes(target.getMinutes() - target.getTimezoneOffset());
    setDueAt(target.toISOString().slice(0, 16));
    setRewardInr('450');
    setTemplateOverride('');
    setChecklistMode('template');
    setErrors({});
    setNetworkError(null);
    setCreatedTask(null);
  }

  // Success view
  if (createdTask) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
        <PageHeader
          title="Task Created Successfully"
          description="Your field task has been confirmed by the server and is now active in the system."
        />

        <Card>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '2.5rem 1rem', gap: '1rem' }}>
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                color: '#10b981',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <CheckCircle2 size={36} aria-hidden />
            </div>

            <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-text, #111315)' }}>
              Task Request Published!
            </h2>
            <p style={{ margin: 0, color: 'var(--color-text-muted, #64748b)', maxWidth: '50ch', fontSize: '0.95rem' }}>
              Reference ID: <strong style={{ color: 'var(--color-text, #111315)' }}>{createdTask.id}</strong> — "{createdTask.title}" has been registered and is now open for field execution and evidence gathering.
            </p>

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center', marginTop: '1rem' }}>
              <Link to="/customer/history" className="btn btn--primary btn--md">
                View in Task History
              </Link>
              <Button variant="secondary" onClick={handleReset} icon={<Plus size={16} />}>
                Create Another Task
              </Button>
              <Link to="/customer/dashboard" className="btn btn--ghost btn--md">
                Back to Dashboard
              </Link>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%', maxWidth: '1200px' }}>
      <PageHeader
        title="Create Field Task Request"
        description="Submit a verified field operation request. Field workers in the operational zone will receive instructions and complete required photo checklists."
        actions={
          <Link to="/customer/history" className="btn btn--ghost btn--md">
            <span className="btn__icon" aria-hidden>
              <ArrowLeft size={16} />
            </span>
            Back to tasks
          </Link>
        }
      />

      {/* Network Error Alert */}
      {networkError && (
        <Notice tone="warning" title="Submission Failed">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <p style={{ margin: 0 }}>{networkError}</p>
            <div>
              <Button
                variant="secondary"
                size="sm"
                icon={<RotateCcw size={14} />}
                onClick={handleSubmit}
                disabled={isSubmitting}
              >
                Retry Submission
              </Button>
            </div>
          </div>
        </Notice>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
        {/* Left Column: Form Fields */}
        <Card aria-labelledby="task-form-title">
          <CardHeader
            id="task-form-title"
            title="Task Details"
            subtitle="Specify the campaign requirements, location, and verification criteria"
          />

          <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Task Title */}
            <TextField
              label="Task Title"
              required
              value={title}
              disabled={isSubmitting}
              onChange={(e) => {
                setTitle(e.target.value);
                if (errors.title) setErrors((prev) => ({ ...prev, title: undefined }));
              }}
              error={errors.title}
              placeholder="e.g. Retail Shelf Facing & Planogram Audit"
              hint="Concise title summarizing what needs to be verified."
            />

            {/* Category & Priority */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <SelectField
                label="Category"
                required
                value={category}
                disabled={isSubmitting}
                onChange={(e) => {
                  const newCategory = e.target.value as TaskCategory;
                  setCategory(newCategory);
                  setTemplateOverride('');
                  if (errors.category) setErrors((prev) => ({ ...prev, category: undefined }));
                }}
                error={errors.category}
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </SelectField>

              <SelectField
                label="Priority"
                required
                value={priority}
                disabled={isSubmitting}
                onChange={(e) => {
                  setPriority(e.target.value as TaskPriority);
                  if (errors.priority) setErrors((prev) => ({ ...prev, priority: undefined }));
                }}
                error={errors.priority}
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </option>
                ))}
              </SelectField>
            </div>

            {/* Instructions */}
            <TextAreaField
              label="Task Instructions / Scope of Work"
              required
              rows={4}
              value={description}
              disabled={isSubmitting}
              onChange={(e) => {
                setDescription(e.target.value);
                if (errors.description) setErrors((prev) => ({ ...prev, description: undefined }));
              }}
              error={errors.description}
              placeholder="Describe the exact items to check, angles to photograph, and guidelines for the field worker..."
              hint="Displayed directly on the worker's mobile execution app."
            />

            {/* Location Area & Address */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <SelectField
                label="Operational Area / Hub"
                required
                value={areaKey}
                disabled={isSubmitting}
                onChange={(e) => handleHubChange(e.target.value)}
                error={errors.areaKey}
              >
                {Object.entries(OPERATIONAL_HUBS).map(([key, hub]) => (
                  <option key={key} value={key}>
                    {hub.name}
                  </option>
                ))}
              </SelectField>

              <TextField
                label="Store Address / Landmark"
                required
                value={address}
                disabled={isSubmitting}
                onChange={(e) => {
                  setAddress(e.target.value);
                  if (errors.address) setErrors((prev) => ({ ...prev, address: undefined }));
                }}
                error={errors.address}
                placeholder="e.g. Supermarket #14, Main Station Road"
              />
            </div>

            {/* Geotag Coordinates Verification Bar */}
            <div
              style={{
                padding: '12px 14px',
                borderRadius: '12px',
                backgroundColor: 'rgba(0,0,0,0.03)',
                border: '1px solid var(--color-border, rgba(0,0,0,0.08))',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text, #111315)' }}>
                <MapPin size={16} style={{ color: 'var(--color-primary, #e8541e)' }} />
                <span>Geo-fence Verification Coordinates</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '2px' }}>
                    Latitude
                  </label>
                  <input
                    type="text"
                    value={customLat}
                    onChange={(e) => setCustomLat(e.target.value)}
                    className="input input--sm"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '2px' }}>
                    Longitude
                  </label>
                  <input
                    type="text"
                    value={customLng}
                    onChange={(e) => setCustomLng(e.target.value)}
                    className="input input--sm"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--muted)' }}>
                Field worker app verifies on-device GPS is within 150m of these coordinates before allowing photo evidence capture.
              </p>
            </div>

            {/* Due Date & Reward */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1rem' }}>
              <TextField
                label="Due Date & Time"
                type="datetime-local"
                required
                value={dueAt}
                disabled={isSubmitting}
                onChange={(e) => {
                  setDueAt(e.target.value);
                  if (errors.dueAt) setErrors((prev) => ({ ...prev, dueAt: undefined }));
                }}
                error={errors.dueAt}
              />

              {isCustomerRole ? (
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '4px', color: 'var(--ink)' }}>
                    Execution Bounty
                  </label>
                  <div
                    style={{
                      height: '40px',
                      padding: '0 12px',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(0,0,0,0.04)',
                      border: '1px solid var(--color-border, rgba(0,0,0,0.08))',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '0.9rem',
                      fontWeight: 600,
                      color: 'var(--color-text, #111315)',
                    }}
                  >
                    <span>₹{rewardInr} INR</span>
                    <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--muted)' }}>Standard Hub Rate</span>
                  </div>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: 'var(--muted)' }}>
                    Platform operations sets and escrows bounty.
                  </p>
                </div>
              ) : (
                <TextField
                  label="Worker Bounty (₹ INR)"
                  type="number"
                  inputMode="numeric"
                  min={50}
                  step={10}
                  required
                  value={rewardInr}
                  disabled={isSubmitting}
                  onChange={(e) => {
                    setRewardInr(e.target.value);
                    if (errors.rewardInr) setErrors((prev) => ({ ...prev, rewardInr: undefined }));
                  }}
                  error={errors.rewardInr}
                  hint="Minimum ₹50 bounty per verified completion."
                />
              )}
            </div>

            {/* Checklist Mode Toggle */}
            <div style={{ borderTop: '1px solid var(--color-border, rgba(0,0,0,0.08))', paddingTop: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-text, #111315)' }}>
                    Verification Checklist
                  </label>
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.775rem', color: 'var(--muted)' }}>
                    Choose a preset template or configure custom audit checklist items.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '6px', background: 'rgba(0,0,0,0.05)', padding: '3px', borderRadius: '8px' }}>
                  <button
                    type="button"
                    className={`btn btn--sm ${checklistMode === 'template' ? 'btn--primary' : 'btn--ghost'}`}
                    onClick={() => setChecklistMode('template')}
                    style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                  >
                    <Layers size={13} style={{ marginRight: '4px' }} /> Presets
                  </button>
                  <button
                    type="button"
                    className={`btn btn--sm ${checklistMode === 'custom' ? 'btn--primary' : 'btn--ghost'}`}
                    onClick={() => setChecklistMode('custom')}
                    style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                  >
                    <ListPlus size={13} style={{ marginRight: '4px' }} /> Custom Builder
                  </button>
                </div>
              </div>

              {checklistMode === 'template' ? (
                <SelectField
                  label="Standard Template"
                  required
                  value={templateId}
                  disabled={isSubmitting || checklistsState.loading}
                  onChange={(e) => {
                    setTemplateOverride(e.target.value);
                    if (errors.templateId) setErrors((prev) => ({ ...prev, templateId: undefined }));
                  }}
                  error={errors.templateId}
                  hint="Checklist steps the on-field worker must complete."
                >
                  {templates.map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>
                      {tpl.name} ({tpl.category})
                    </option>
                  ))}
                </SelectField>
              ) : (
                /* Custom Checklist Builder */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {errors.customChecklist && (
                    <p style={{ margin: 0, fontSize: '0.8rem', color: '#ef4444' }}>
                      {errors.customChecklist}
                    </p>
                  )}

                  {customItems.map((item, idx) => (
                    <div
                      key={item.id}
                      style={{
                        padding: '10px 12px',
                        borderRadius: '10px',
                        border: '1px solid var(--color-border, rgba(0,0,0,0.08))',
                        backgroundColor: '#ffffff',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                      }}
                    >
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--muted)', minWidth: '20px' }}>
                          #{idx + 1}
                        </span>
                        <input
                          type="text"
                          placeholder="e.g. Photograph promotional banner front-on"
                          value={item.label}
                          onChange={(e) => updateCustomItem(item.id, { label: e.target.value })}
                          className="input input--sm"
                          style={{ flex: 1 }}
                        />
                        {customItems.length > 1 && (
                          <button
                            type="button"
                            className="btn btn--ghost btn--sm"
                            onClick={() => removeCustomItem(item.id)}
                            style={{ color: '#ef4444', padding: '4px' }}
                            title="Remove step"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: '16px', paddingLeft: '28px', fontSize: '0.775rem' }}>
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={item.required}
                            onChange={(e) => updateCustomItem(item.id, { required: e.target.checked })}
                          />
                          <span>Mandatory Step</span>
                        </label>

                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={item.requiresPhoto}
                            onChange={(e) => updateCustomItem(item.id, { requiresPhoto: e.target.checked })}
                          />
                          <span>Requires Photo Proof</span>
                        </label>
                      </div>
                    </div>
                  ))}

                  <button
                    type="button"
                    className="btn btn--secondary btn--sm"
                    onClick={addCustomItem}
                    style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Plus size={14} /> Add Checklist Item
                  </button>
                </div>
              )}
            </div>

            {/* Form Action Buttons */}
            <div style={{ display: 'flex', gap: '12px', marginTop: '1rem', borderTop: '1px solid var(--color-border, rgba(0,0,0,0.08))', paddingTop: '1rem' }}>
              <Button
                type="submit"
                variant="primary"
                disabled={isSubmitting}
                icon={isSubmitting ? undefined : <Send size={16} />}
              >
                {isSubmitting ? 'Submitting Task Request...' : 'Publish Task Request'}
              </Button>
              <Link to="/customer/history" className="btn btn--secondary btn--md">
                Cancel
              </Link>
            </div>
          </form>
        </Card>

        {/* Right Column: Live Checklist Preview Card */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', position: 'sticky', top: '1rem' }}>
          <Card aria-labelledby="preview-heading">
            <CardHeader
              id="preview-heading"
              title="Evidence Checklist Preview"
              subtitle={
                checklistMode === 'custom'
                  ? `Custom Checklist (${customItems.length} items)`
                  : selectedTemplate
                  ? selectedTemplate.name
                  : 'Preset template'
              }
            />

            {checklistMode === 'custom' ? (
              <ol style={{ listStylePosition: 'inside', paddingLeft: 0, margin: 0 }}>
                {customItems.map((item, idx) => (
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
                    <span style={{ fontWeight: 500, color: 'var(--color-text, #111315)' }}>
                      {item.label.trim() || `Step ${idx + 1}`}
                    </span>
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
            ) : checklistsState.loading ? (
              <Skeleton lines={4} />
            ) : selectedTemplate ? (
              <ol style={{ listStylePosition: 'inside', paddingLeft: 0, margin: 0 }}>
                {selectedTemplate.items.map((item) => (
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
                    <span style={{ fontWeight: 500, color: 'var(--color-text, #111315)' }}>
                      {item.label}
                    </span>
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
              <p style={{ color: 'var(--color-text-muted, #64748b)', fontSize: '13px' }}>
                No checklist template selected.
              </p>
            )}
          </Card>

          <Card>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <ShieldCheck size={20} style={{ color: '#10b981', flexShrink: 0, marginTop: '2px' }} />
              <div style={{ fontSize: '13px', color: 'var(--color-text-muted, #64748b)' }}>
                <strong style={{ color: 'var(--color-text, #111315)', display: 'block', marginBottom: '2px' }}>
                  Enterprise Verification Guarantee
                </strong>
                Evidence uploaded by field workers undergoes GPS geo-fence validation, camera metadata cross-checking, and manager verification before final payout approval.
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
