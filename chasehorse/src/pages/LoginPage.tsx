import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, ArrowRight, AlertCircle, Building2, User, ArrowLeft } from 'lucide-react';
import { useAuth, type UserProfile } from '@/context/AuthContext';
import { ChaseHorseLogo } from '@/components/ui/ChaseHorseLogo';
import { EmailOtpStep } from '@/components/auth/EmailOtpStep';

/** Where a signed-in user lands. Accounts that aren't ACTIVE go to the status page. */
function homeFor(profile: UserProfile | null): string {
  const status = profile?.accountStatus?.toUpperCase();
  if (status && status !== 'ACTIVE') return '/pending-approval';
  const roles = (profile?.roles || []).map((r) => r.toUpperCase());
  if (roles.some((r) => ['ADMIN', 'OPERATIONS', 'OPERATIONS_MANAGER', 'MANAGER', 'PARTNER'].includes(r))) return '/overview';
  if (roles.includes('ENQUIRY_MANAGER')) return '/enquiries';
  if (roles.includes('CUSTOMER')) return '/customer/dashboard';
  return '/employee/dashboard';
}

export function LoginPage() {
  const { signIn, refreshProfile, resendSignupOtp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [formFocused, setFormFocused] = useState(false);
  const [loginSuccess, setLoginSuccess] = useState(false);
  /** Set when the account exists but its e-mail was never verified: show the OTP step. */
  const [verifyEmail, setVerifyEmail] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setShake(false);

    if (!email.trim() || !password) {
      setError('Please provide both email and password.');
      setShake(true);
      setTimeout(() => setShake(false), 400);
      return;
    }

    setLoading(true);
    try {
      await signIn(email, password);
      // Fetch verified profile from Supabase & backend
      const verifiedProfile = await refreshProfile();

      setLoginSuccess(true);

      // Spring choreography delay before navigating to staggered dashboard
      setTimeout(() => {
        const active = verifiedProfile?.accountStatus?.toUpperCase() === 'ACTIVE';
        const from = (location.state as { from?: { pathname: string } })?.from?.pathname;
        if (active && from && from !== '/login') {
          navigate(from, { replace: true });
          return;
        }
        navigate(homeFor(verifiedProfile), { replace: true });
      }, 400);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid credentials. Please verify your email and password.';
      if (/email not confirmed/i.test(msg)) {
        // Registered but never entered the OTP: send a fresh code and verify here.
        try { await resendSignupOtp(email); } catch { /* the step's own "send a new code" covers this */ }
        setVerifyEmail(true);
        setError(null);
        return;
      }
      setError(/invalid login credentials/i.test(msg) ? 'Incorrect e-mail or password.' : msg);
      setShake(true);
      setTimeout(() => setShake(false), 400);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#F3F1EB',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem 1.5rem',
        boxSizing: 'border-box',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: 'var(--font-sans)',
      }}
    >
      {/* Top Navigation Anchor: Back to site */}
      <div
        style={{
          position: 'absolute',
          top: '24px',
          left: '24px',
          zIndex: 10,
        }}
      >
        <Link
          to="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.8125rem',
            fontWeight: 600,
            color: '#5E5B53',
            textDecoration: 'none',
            padding: '6px 10px',
            borderRadius: '6px',
            background: 'rgba(21, 21, 21, 0.04)',
            border: '1px solid #DDD8CC',
            transition: 'color 150ms ease, background 150ms ease',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.color = '#151515';
            (e.currentTarget as HTMLElement).style.background = '#FBFAF7';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.color = '#5E5B53';
            (e.currentTarget as HTMLElement).style.background = 'rgba(21, 21, 21, 0.04)';
          }}
        >
          <ArrowLeft size={14} />
          <span>Back to site</span>
        </Link>
      </div>

      {/* Main Animated Container */}
      <div
        style={{
          maxWidth: '440px',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          position: 'relative',
          zIndex: 5,
        }}
        onFocus={() => setFormFocused(true)}
        onClick={() => setFormFocused(true)}
      >
        {/* Animated Brand Logo */}
        <div
          style={{
            marginBottom: formFocused ? '1.5rem' : '2.5rem',
            transformOrigin: 'center center',
            transition: 'transform 480ms cubic-bezier(0.22, 1, 0.36, 1), opacity 380ms ease, margin 480ms ease',
            transform: loginSuccess
              ? 'translate(-38vw, -42vh) scale(0.48)'
              : formFocused
                ? 'translateY(0) scale(0.92)'
                : 'translateY(16px) scale(1.05)',
            opacity: loginSuccess ? 0 : 1,
            pointerEvents: 'none',
          }}
        >
          <ChaseHorseLogo
            size="md"
            theme="light"
            withSubtitle={true}
            pulseInnerSquare={!formFocused}
          />
        </div>

        {/* Form Paper Card with Gentle Shake and Spring Entrance */}
        <div
          className={`card card-paper-tilt ${shake ? 'auth-card--shake' : ''}`}
          style={{
            width: '100%',
            background: '#ffffff',
            border: '1px solid #DDD8CC',
            borderRadius: '16px',
            padding: '2rem 1.75rem',
            boxShadow: '0 20px 40px -15px rgba(21, 21, 21, 0.08), 0 2px 6px rgba(21, 21, 21, 0.04)',
            boxSizing: 'border-box',
            transition: 'transform 420ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 260ms ease',
            transform: formFocused ? 'translateY(0)' : 'translateY(8px)',
          }}
        >
          <div style={{ marginBottom: '1.25rem' }}>
            <h1
              style={{
                margin: '0 0 0.35rem 0',
                fontSize: '1.5rem',
                fontWeight: 700,
                color: '#151515',
                letterSpacing: '-0.02em',
              }}
            >
              Sign in
            </h1>
            <p
              style={{
                margin: 0,
                fontSize: '0.8125rem',
                color: '#5E5B53',
                lineHeight: 1.45,
              }}
            >
              Enter your verified credentials to access your operations dashboard.
            </p>
          </div>

          {/* Truthful Inline Error Message */}
          {error && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '0.75rem 0.875rem',
                borderRadius: '8px',
                background: '#FDF2F0',
                border: '1px solid #B04A3A',
                color: '#B04A3A',
                fontSize: '0.8125rem',
                marginBottom: '1rem',
              }}
              role="alert"
            >
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          {verifyEmail && (
            <EmailOtpStep
              email={email.trim().toLowerCase()}
              onVerified={(p) => navigate(homeFor(p), { replace: true })}
              onChangeEmail={() => setVerifyEmail(false)}
            />
          )}

          {/* Sign In Form */}
          <form onSubmit={handleSubmit} hidden={verifyEmail} style={{ display: verifyEmail ? 'none' : 'flex', flexDirection: 'column', gap: '1.1rem' }}>
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: '#151515',
                  marginBottom: '0.375rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace",
                }}
              >
                Email address
              </label>
              <div style={{ position: 'relative' }}>
                <Mail
                  size={16}
                  style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#8E8B82',
                  }}
                />
                <input
                  id="email-input"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setFormFocused(true)}
                  placeholder="name@company.com"
                  autoComplete="email"
                  style={{
                    width: '100%',
                    padding: '10px 12px 10px 38px',
                    borderRadius: '8px',
                    border: '1px solid #DDD8CC',
                    background: '#FBFAF7',
                    color: '#151515',
                    fontSize: '0.875rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border-color 150ms ease, background 150ms ease',
                  }}
                />
              </div>
            </div>

            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '0.375rem',
                }}
              >
                <label
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: '#151515',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace",
                  }}
                >
                  Password
                </label>
                <Link
                  to="/forgot-password"
                  style={{
                    fontSize: '0.75rem',
                    color: '#3A5BA0',
                    textDecoration: 'none',
                    fontWeight: 600,
                  }}
                >
                  Forgot password?
                </Link>
              </div>
              <div style={{ position: 'relative' }}>
                <Lock
                  size={16}
                  style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#8E8B82',
                  }}
                />
                <input
                  id="password-input"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setFormFocused(true)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  style={{
                    width: '100%',
                    padding: '10px 38px 10px 38px',
                    borderRadius: '8px',
                    border: '1px solid #DDD8CC',
                    background: '#FBFAF7',
                    color: '#151515',
                    fontSize: '0.875rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border-color 150ms ease, background 150ms ease',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    padding: '4px',
                    cursor: 'pointer',
                    color: '#8E8B82',
                  }}
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Remember Me */}
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '0.8125rem',
                color: '#5E5B53',
                cursor: 'pointer',
                userSelect: 'none',
              }}
            >
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                style={{
                  width: '15px',
                  height: '15px',
                  borderRadius: '3px',
                  accentColor: '#D9531E',
                  cursor: 'pointer',
                }}
              />
              <span>Remember this device</span>
            </label>

            {/* Submit Button */}
            <button
              id="submit-button"
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '11px 16px',
                borderRadius: '8px',
                border: 'none',
                background: '#D9531E',
                color: '#ffffff',
                fontSize: '0.875rem',
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 12px rgba(217, 83, 30, 0.25)',
                transition: 'background 150ms ease, transform 120ms ease',
                marginTop: '0.25rem',
              }}
              onMouseEnter={(e) => {
                if (!loading) (e.currentTarget as HTMLElement).style.background = '#C44615';
              }}
              onMouseLeave={(e) => {
                if (!loading) (e.currentTarget as HTMLElement).style.background = '#D9531E';
              }}
            >
              <span>{loading ? 'Authenticating...' : 'Sign in to platform'}</span>
              <ArrowRight size={16} />
            </button>
          </form>

          {/* New to ChaseHorse Section */}
          <div
            style={{
              marginTop: '1.5rem',
              borderTop: '1px solid #EAE6DC',
              paddingTop: '1.25rem',
            }}
          >
            <p
              style={{
                margin: '0 0 0.75rem 0',
                fontSize: '0.6875rem',
                fontWeight: 700,
                color: '#8E8B82',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace",
              }}
            >
              Don't have an account?
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <Link
                to="/register/customer"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid #DDD8CC',
                  background: '#FBFAF7',
                  textDecoration: 'none',
                  transition: 'border-color 150ms ease, transform 150ms ease',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = '#151515';
                  (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = '#DDD8CC';
                  (e.currentTarget as HTMLElement).style.transform = 'none';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#151515', fontWeight: 600, fontSize: '0.8125rem' }}>
                  <Building2 size={14} />
                  <span>Business</span>
                </div>
                <span style={{ fontSize: '0.6875rem', color: '#5E5B53', marginTop: '2px' }}>
                  Post tasks
                </span>
              </Link>

              <Link
                to="/register/worker"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid #DDD8CC',
                  background: '#FBFAF7',
                  textDecoration: 'none',
                  transition: 'border-color 150ms ease, transform 150ms ease',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = '#151515';
                  (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = '#DDD8CC';
                  (e.currentTarget as HTMLElement).style.transform = 'none';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#151515', fontWeight: 600, fontSize: '0.8125rem' }}>
                  <User size={14} />
                  <span>Worker</span>
                </div>
                <span style={{ fontSize: '0.6875rem', color: '#5E5B53', marginTop: '2px' }}>
                  Join ground ops
                </span>
              </Link>
            </div>
          </div>
        </div>

        {/* Security Footer Note */}
        <div
          style={{
            marginTop: '1.5rem',
            textAlign: 'center',
            fontSize: '0.6875rem',
            color: '#8E8B82',
            fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace",
          }}
        >
          Protected by Supabase Authentication · PostgreSQL RLS
        </div>
      </div>
    </div>
  );
}
