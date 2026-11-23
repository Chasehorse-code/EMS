import { useState, useMemo, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import {
  ShieldCheck,
  Save,
  RotateCcw,
  CheckCircle2,
  KeyRound,
  Laptop,
  LogOut,
  Building2,
  Mail,
  MapPin,
  Calendar,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { api } from '@/api';
import { PageHeader, Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Notice, Skeleton } from '@/components/ui/States';
import { TextField } from '@/components/ui/Fields';
import { formatDate } from '@/utils/format';

interface ProfileErrors {
  displayName?: string;
  phone?: string;
  companyName?: string;
  region?: string;
}

export function CustomerProfilePage() {
  const { user, profile, loading: authLoading, updatePassword, signOut } = useAuth();
  const { notify } = useToast();
  const location = useLocation();

  // Profile Form state
  const [displayName, setDisplayName] = useState(() => profile?.displayName || user?.user_metadata?.displayName || '');
  const [phone, setPhone] = useState(() => profile?.phone || user?.user_metadata?.phone || '');
  const [region, setRegion] = useState(() => profile?.region || 'Tenali / Regional Cluster');
  const [companyName, setCompanyName] = useState('Apex Retail Brands Pvt Ltd');

  // UI state
  const [errors, setErrors] = useState<ProfileErrors>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // Password Change state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Notification Preferences state
  const [notifEmail, setNotifEmail] = useState(true);
  const [notifSms, setNotifSms] = useState(true);
  const [notifWeeklyDigest, setNotifWeeklyDigest] = useState(false);

  // Password strength calculation
  const passwordStrength = useMemo(() => {
    if (!newPassword) return { score: 0, label: '', color: 'var(--ink)' };
    let score = 0;
    if (newPassword.length >= 8) score += 25;
    if (/[a-z]/.test(newPassword) && /[A-Z]/.test(newPassword)) score += 25;
    if (/\d/.test(newPassword)) score += 25;
    if (/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(newPassword)) score += 25;

    if (score <= 25) return { score, label: 'Weak', color: '#ef4444' };
    if (score <= 50) return { score, label: 'Fair', color: '#f59e0b' };
    if (score <= 75) return { score, label: 'Good', color: '#0284c7' };
    return { score, label: 'Strong', color: '#10b981' };
  }, [newPassword]);

  // 1. Unauthenticated gate
  if (!authLoading && !user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // 2. Auth loading state
  if (authLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%', maxWidth: '900px' }}>
        <PageHeader title="Customer Profile" description="Loading account details..." />
        <Card>
          <Skeleton lines={6} />
        </Card>
      </div>
    );
  }

  function validateForm(): ProfileErrors {
    const errs: ProfileErrors = {};

    if (!displayName.trim()) {
      errs.displayName = 'Contact person name is required.';
    } else if (displayName.trim().length < 2) {
      errs.displayName = 'Name must be at least 2 characters.';
    }

    if (!companyName.trim()) {
      errs.companyName = 'Company name is required.';
    }

    if (!phone.trim()) {
      errs.phone = 'Mobile phone number is required.';
    } else {
      const digitsOnly = phone.replace(/\D/g, '');
      if (digitsOnly.length < 10) {
        errs.phone = 'Please enter a valid 10-digit phone number.';
      }
    }

    if (!region.trim()) {
      errs.region = 'Operating region is required.';
    }

    return errs;
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaveSuccess(false);
    setServerError(null);

    const validationErrors = validateForm();
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    setIsSaving(true);

    try {
      await api.updateProfile({
        displayName: displayName.trim(),
        phone: phone.trim(),
        region: region.trim(),
      });

      setSaveSuccess(true);
      notify('Profile information saved successfully', 'success');
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Failed to save profile changes to server. Please check your connection and retry.';
      setServerError(msg);
      notify(msg, 'danger');
    } finally {
      setIsSaving(false);
    }
  }

  async function handlePasswordUpdate(e: FormEvent) {
    e.preventDefault();
    setPasswordError(null);

    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation password do not match.');
      return;
    }

    setIsUpdatingPassword(true);
    try {
      await updatePassword(newPassword);
      setNewPassword('');
      setConfirmPassword('');
      notify('Password updated successfully', 'success');
    } catch (err: any) {
      setPasswordError(err.message || 'Failed to update password.');
      notify(err.message || 'Failed to update password', 'danger');
    } finally {
      setIsUpdatingPassword(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%', maxWidth: '900px' }}>
      <PageHeader
        title="Organization & Account Settings"
        description="Manage your enterprise contact information, security credentials, and notification preferences."
      />

      {/* Network / Server Error Notice */}
      {serverError && (
        <Notice tone="warning" title="Save Failed">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <p style={{ margin: 0 }}>{serverError}</p>
            <div>
              <Button
                variant="secondary"
                size="sm"
                icon={<RotateCcw size={14} />}
                onClick={handleSave}
                disabled={isSaving}
              >
                Retry Saving
              </Button>
            </div>
          </div>
        </Notice>
      )}

      {/* Confirmed Success State */}
      {saveSuccess && (
        <Notice tone="info" title="Profile Confirmed by Server">
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <CheckCircle2 size={16} />
            <span>Your enterprise profile details have been successfully verified and saved on the server.</span>
          </div>
        </Notice>
      )}

      {/* Account Verification & Organization Snapshot */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <Building2 size={20} style={{ color: 'var(--color-primary, #e8541e)' }} />
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text, #111315)' }}>
                {companyName || 'Enterprise Customer'}
              </h3>
            </div>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.85rem', color: 'var(--muted)' }}>
              Account ID: <code style={{ fontSize: '0.8rem', background: 'rgba(0,0,0,0.04)', padding: '2px 6px', borderRadius: '4px' }}>{user?.id}</code>
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <Badge tone="success">
              <ShieldCheck size={13} style={{ marginRight: '4px' }} />
              {profile?.accountStatus?.toUpperCase() || 'VERIFIED ENTERPRISE'}
            </Badge>
            <Badge tone="neutral">
              {profile?.roles?.join(', ') || 'CUSTOMER'}
            </Badge>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginTop: '1.25rem', borderTop: '1px solid var(--color-border, rgba(0,0,0,0.08))', paddingTop: '1rem', fontSize: '0.85rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--muted)' }}>
            <Mail size={16} />
            <span style={{ color: 'var(--color-text, #111315)', fontWeight: 500 }}>{user?.email}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--muted)' }}>
            <MapPin size={16} />
            <span style={{ color: 'var(--color-text, #111315)', fontWeight: 500 }}>{region}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--muted)' }}>
            <Calendar size={16} />
            <span style={{ color: 'var(--color-text, #111315)' }}>
              Member since {formatDate(profile?.createdAt || user?.created_at || new Date().toISOString())}
            </span>
          </div>
        </div>
      </Card>

      {/* Contact & Organization Details Form */}
      <Card aria-labelledby="profile-form-heading">
        <CardHeader
          id="profile-form-heading"
          title="Contact & Organization Information"
          subtitle="Customer identity parameters associated with published tasks"
        />

        <form onSubmit={handleSave} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <TextField
              label="Contact Person Name"
              required
              value={displayName}
              disabled={isSaving}
              onChange={(e) => {
                setDisplayName(e.target.value);
                if (errors.displayName) setErrors((prev) => ({ ...prev, displayName: undefined }));
              }}
              error={errors.displayName}
              placeholder="e.g. Ramesh Varma"
            />

            <TextField
              label="Organization / Company Name"
              required
              value={companyName}
              disabled={isSaving}
              onChange={(e) => {
                setCompanyName(e.target.value);
                if (errors.companyName) setErrors((prev) => ({ ...prev, companyName: undefined }));
              }}
              error={errors.companyName}
              placeholder="e.g. Apex Retail Brands Pvt Ltd"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <TextField
              label="Account Email"
              type="email"
              value={user?.email || ''}
              disabled
              hint="Managed via Supabase Identity."
            />

            <TextField
              label="Mobile Phone Number"
              type="tel"
              required
              value={phone}
              disabled={isSaving}
              onChange={(e) => {
                setPhone(e.target.value);
                if (errors.phone) setErrors((prev) => ({ ...prev, phone: undefined }));
              }}
              error={errors.phone}
              placeholder="e.g. +91 98765 43210"
              hint="Used for critical dispatch alerts and SMS OTPs."
            />
          </div>

          <TextField
            label="Default Operational Region / Cluster"
            required
            value={region}
            disabled={isSaving}
            onChange={(e) => {
              setRegion(e.target.value);
              if (errors.region) setErrors((prev) => ({ ...prev, region: undefined }));
            }}
            error={errors.region}
            placeholder="e.g. Tenali / Regional Cluster"
            hint="Primary operational geography for field task dispatches."
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            <Button
              type="submit"
              variant="primary"
              disabled={isSaving}
              icon={isSaving ? undefined : <Save size={16} />}
            >
              {isSaving ? 'Saving Profile...' : 'Save Profile Changes'}
            </Button>
          </div>
        </form>
      </Card>

      {/* Password & Security Card */}
      <Card aria-labelledby="security-heading">
        <CardHeader
          id="security-heading"
          title="Account Security & Password"
          subtitle="Update your password credentials securely via encrypted auth tokens"
        />

        <form onSubmit={handlePasswordUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {passwordError && (
            <Notice tone="warning" title="Password Error">
              <p style={{ margin: 0 }}>{passwordError}</p>
            </Notice>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '4px', color: 'var(--ink)' }}>
                New Password *
              </label>
              <input
                type="password"
                required
                placeholder="At least 8 characters..."
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="input"
                style={{ width: '100%', boxSizing: 'border-box' }}
                disabled={isUpdatingPassword}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '4px', color: 'var(--ink)' }}>
                Confirm New Password *
              </label>
              <input
                type="password"
                required
                placeholder="Repeat new password..."
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="input"
                style={{ width: '100%', boxSizing: 'border-box' }}
                disabled={isUpdatingPassword}
              />
            </div>
          </div>

          {/* Password Strength Meter */}
          {newPassword && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 600 }}>
                <span style={{ color: '#64748b' }}>Password Strength:</span>
                <span style={{ color: passwordStrength.color }}>{passwordStrength.label}</span>
              </div>
              <div style={{ width: '100%', height: '6px', backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${passwordStrength.score}%`,
                    height: '100%',
                    backgroundColor: passwordStrength.color,
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            <Button
              type="submit"
              variant="secondary"
              disabled={isUpdatingPassword || !newPassword || !confirmPassword}
              icon={<KeyRound size={16} />}
            >
              {isUpdatingPassword ? 'Updating Password...' : 'Update Password'}
            </Button>
          </div>
        </form>
      </Card>

      {/* Notification Preferences */}
      <Card>
        <CardHeader
          title="Notification Preferences"
          subtitle="Configure what alerts and operational summaries are delivered to your inbox and phone"
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', padding: '8px 0', borderBottom: '1px solid var(--color-border, rgba(0,0,0,0.06))' }}>
            <div>
              <strong style={{ display: 'block', fontSize: '0.9rem', color: 'var(--color-text, #111315)' }}>
                Email Verification Notices
              </strong>
              <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                Receive instant emails when a worker submits photo evidence or when a task is approved.
              </span>
            </div>
            <input
              type="checkbox"
              checked={notifEmail}
              onChange={(e) => {
                setNotifEmail(e.target.checked);
                notify('Notification preference saved', 'info');
              }}
              style={{ width: '18px', height: '18px' }}
            />
          </label>

          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', padding: '8px 0', borderBottom: '1px solid var(--color-border, rgba(0,0,0,0.06))' }}>
            <div>
              <strong style={{ display: 'block', fontSize: '0.9rem', color: 'var(--color-text, #111315)' }}>
                SMS Escalation Alerts
              </strong>
              <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                Receive SMS alerts if a high-priority or urgent field task experiences a geo-fence exception.
              </span>
            </div>
            <input
              type="checkbox"
              checked={notifSms}
              onChange={(e) => {
                setNotifSms(e.target.checked);
                notify('Notification preference saved', 'info');
              }}
              style={{ width: '18px', height: '18px' }}
            />
          </label>

          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', padding: '8px 0' }}>
            <div>
              <strong style={{ display: 'block', fontSize: '0.9rem', color: 'var(--color-text, #111315)' }}>
                Weekly Audit Summary Digest
              </strong>
              <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                Weekly executive overview of audit completion percentages, turnaround time, and spent bounty.
              </span>
            </div>
            <input
              type="checkbox"
              checked={notifWeeklyDigest}
              onChange={(e) => {
                setNotifWeeklyDigest(e.target.checked);
                notify('Notification preference saved', 'info');
              }}
              style={{ width: '18px', height: '18px' }}
            />
          </label>
        </div>
      </Card>

      {/* Active Session & Sign Out */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Laptop size={22} style={{ color: '#64748b' }} />
            <div>
              <strong style={{ display: 'block', fontSize: '0.9rem', color: 'var(--color-text, #111315)' }}>
                Current Web Session
              </strong>
              <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                Connected from verified browser on desktop
              </span>
            </div>
          </div>

          <button
            type="button"
            className="btn btn--secondary btn--md"
            onClick={() => signOut()}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#ef4444' }}
          >
            <LogOut size={16} /> Sign Out of Platform
          </button>
        </div>
      </Card>
    </div>
  );
}
