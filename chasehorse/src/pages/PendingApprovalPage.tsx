import { useEffect, useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import {
  Clock,
  ShieldAlert,
  CheckCircle2,
  RefreshCw,
  LogOut,
  XCircle,
  Shield,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { ChaseHorseLogo } from '@/components/ui/ChaseHorseLogo';

type BlockedStatus = 'PENDING' | 'REJECTED' | 'SUSPENDED' | 'BLOCKED';

const STATUS_COPY: Record<BlockedStatus, { title: string; summary: string; badge: string; check: string }> = {
  PENDING: {
    title: 'Account Pending Approval',
    summary: "Your e-mail is verified. Your zone's operations manager is reviewing your application.",
    badge: 'PENDING APPROVAL',
    check: 'Your application is still under review.',
  },
  REJECTED: {
    title: 'Application Not Approved',
    summary: 'Your application was reviewed and could not be approved at this time.',
    badge: 'REJECTED',
    check: 'Your application was not approved. The reason is shown below.',
  },
  SUSPENDED: {
    title: 'Account Suspended',
    summary: 'Your account has been temporarily suspended by operations. You cannot accept or work on tasks until it is reinstated.',
    badge: 'SUSPENDED',
    check: 'Your account is still suspended.',
  },
  BLOCKED: {
    title: 'Account Blocked',
    summary: 'Your account has been blocked by operations. Contact ChaseHorse support if you believe this is a mistake.',
    badge: 'BLOCKED',
    check: 'Your account is still blocked.',
  },
};

/** The signed-in home for an active account, by role. */
function activeHome(roles: string[] | undefined): string {
  const upper = (roles ?? []).map((r) => r.toUpperCase());
  if (upper.some((r) => ['ADMIN', 'MANAGER', 'OPERATIONS', 'PARTNER'].includes(r))) return '/overview';
  if (upper.includes('ENQUIRY_MANAGER')) return '/enquiries';
  if (upper.includes('CUSTOMER')) return '/customer/dashboard';
  return '/employee/dashboard';
}

export function PendingApprovalPage() {
  const { user, profile, refreshProfile, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [checking, setChecking] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const locState = (location.state as { email?: string; fullName?: string; region?: string }) || {};
  const email = profile?.email || user?.email || locState.email || 'Your account';
  const displayName = profile?.displayName || locState.fullName || 'Applicant';

  const rawStatus = profile?.accountStatus?.toUpperCase();
  const isApproved = rawStatus === 'ACTIVE' || rawStatus === 'APPROVED';
  const status: BlockedStatus = rawStatus && rawStatus in STATUS_COPY ? (rawStatus as BlockedStatus) : 'PENDING';
  const copy = STATUS_COPY[status];
  const isRejected = status !== 'PENDING';
  const reason = profile?.statusReason?.trim();

  // If already approved, go to the right home for this role
  useEffect(() => {
    if (isApproved) {
      navigate(activeHome(profile?.roles), { replace: true });
    }
  }, [isApproved, navigate, profile?.roles]);

  const handleCheckStatus = async () => {
    setChecking(true);
    setStatusMessage(null);
    try {
      const updated = await refreshProfile();
      const next = updated?.accountStatus?.toUpperCase();
      if (next === 'ACTIVE' || next === 'APPROVED') {
        setStatusMessage('Your account has been approved! Taking you to your dashboard…');
        setTimeout(() => navigate(activeHome(updated?.roles), { replace: true }), 1500);
      } else {
        setStatusMessage(STATUS_COPY[(next && next in STATUS_COPY ? next : 'PENDING') as BlockedStatus].check);
      }
    } catch {
      setStatusMessage('Unable to connect to verification server. Please retry in a moment.');
    } finally {
      setChecking(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem 1rem',
        background: 'var(--ch-bg, #F3F1EB)',
        fontFamily: "var(--ch-font-sans, 'Inter', sans-serif)",
      }}
    >
      <div style={{ width: '100%', maxWidth: '540px' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div style={{ display: 'inline-block', marginBottom: '1.25rem' }}>
            <ChaseHorseLogo theme="light" size="md" />
          </div>

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '64px',
              height: '64px',
              borderRadius: '20px',
              background: isRejected ? 'rgba(176, 74, 58, 0.15)' : 'var(--ch-surface-2, #EFECE4)',
              color: isRejected ? '#B04A3A' : 'var(--ch-orange, #D9531E)',
              border: isRejected ? '1px solid rgba(176, 74, 58, 0.3)' : '1px solid var(--ch-border)',
              margin: '0 auto 1rem auto',
            }}
          >
            {isRejected ? <XCircle size={36} /> : <Clock size={36} />}
          </div>

          <h1
            style={{
              fontSize: '1.85rem',
              fontWeight: 800,
              margin: '0 0 0.5rem 0',
              color: 'var(--ch-ink, #151515)',
              fontFamily: "var(--ch-font-heading, 'Plus Jakarta Sans', sans-serif)",
            }}
          >
            {copy.title}
          </h1>
          <p style={{ color: 'var(--ch-muted, #5E5B53)', fontSize: '0.925rem', margin: 0, lineHeight: 1.5 }}>
            {copy.summary}
          </p>
        </div>

        <div
          style={{
            background: 'var(--ch-surface, #FFFFFF)',
            borderRadius: '20px',
            border: '1px solid var(--ch-border, #DDD8CC)',
            padding: '2rem',
            boxShadow: '0 8px 24px rgba(21, 21, 21, 0.05)',
          }}
        >
          {statusMessage && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.875rem 1rem',
                borderRadius: '10px',
                background: statusMessage.includes('approved') ? 'rgba(47, 125, 91, 0.12)' : 'var(--ch-surface-2)',
                border: statusMessage.includes('approved') ? '1px solid var(--ch-green)' : '1px solid var(--ch-border)',
                color: statusMessage.includes('approved') ? 'var(--ch-green)' : 'var(--ch-ink)',
                fontSize: '0.86rem',
                marginBottom: '1.25rem',
              }}
            >
              {statusMessage.includes('approved') ? <CheckCircle2 size={18} /> : <RefreshCw size={18} />}
              <div>{statusMessage}</div>
            </div>
          )}

          {/* Account Details Summary */}
          <div
            style={{
              background: 'var(--ch-surface-2, #EFECE4)',
              borderRadius: '12px',
              padding: '1rem',
              marginBottom: '1.5rem',
              fontSize: '0.86rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--ch-muted)' }}>Applicant:</span>
              <strong style={{ color: 'var(--ch-ink)' }}>{displayName}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--ch-muted)' }}>Email:</span>
              <span style={{ color: 'var(--ch-ink)' }}>{email}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--ch-muted)' }}>Status:</span>
              <span
                style={{
                  fontFamily: 'var(--ch-font-mono)',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  padding: '2px 8px',
                  borderRadius: '9999px',
                  background: isRejected ? '#F9EBE9' : '#FBF4E8',
                  color: isRejected ? '#B04A3A' : '#B7791F',
                  border: isRejected ? '1px solid #B04A3A' : '1px solid #B7791F',
                }}
              >
                {copy.badge}
              </span>
            </div>
          </div>

          {/* Information / Status Box */}
          {isRejected ? (
            <div
              style={{
                background: 'rgba(176, 74, 58, 0.08)',
                borderRadius: '12px',
                border: '1px solid rgba(176, 74, 58, 0.25)',
                padding: '1.25rem',
                marginBottom: '1.5rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#B04A3A', fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                <ShieldAlert size={18} />
                <span>Reason from operations</span>
              </div>
              <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--ch-ink)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                {reason || 'No reason was recorded.'}
              </p>
              <p style={{ margin: '0.6rem 0 0', fontSize: '0.8rem', color: 'var(--ch-muted)', lineHeight: 1.5 }}>
                To appeal, e-mail <a href="mailto:tech.support@chasehorse.com">tech.support@chasehorse.com</a> from this account's address.
              </p>
            </div>
          ) : (
            <div
              style={{
                background: 'var(--ch-surface-2, #EFECE4)',
                borderRadius: '12px',
                border: '1px solid var(--ch-border)',
                padding: '1.25rem',
                marginBottom: '1.5rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--ch-ink)', fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.6rem' }}>
                <Shield size={18} color="var(--ch-orange)" />
                <span>What Happens Next?</span>
              </div>
              <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.82rem', color: 'var(--ch-muted)', lineHeight: 1.6 }}>
                <li>The operations manager for your zone (or an admin) reviews your details.</li>
                <li>Once approved you can sign in and see open tasks within 100 km of your location or zone.</li>
                <li>Use the button below to check your status at any time.</li>
              </ul>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button
              type="button"
              onClick={handleCheckStatus}
              disabled={checking}
              className="ch-btn-orange"
              style={{ width: '100%', padding: '0.85rem' }}
            >
              {checking ? (
                <>
                  <RefreshCw size={16} className="animate-spin" /> Checking Approval Server...
                </>
              ) : (
                <>
                  <RefreshCw size={16} /> Check Live Verification Status
                </>
              )}
            </button>

            <div style={{ display: 'flex', gap: '10px' }}>
              <Link
                to="/partners"
                className="ch-btn-pill-black"
                style={{ flex: 1, padding: '0.75rem', textAlign: 'center', fontSize: '0.82rem' }}
              >
                Partners Hub
              </Link>

              <button
                type="button"
                onClick={handleSignOut}
                className="ch-btn-pill-black"
                style={{ flex: 1, padding: '0.75rem', background: '#ffffff', color: '#151515', border: '1px solid var(--ch-border)', fontSize: '0.82rem' }}
              >
                <LogOut size={14} /> Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
