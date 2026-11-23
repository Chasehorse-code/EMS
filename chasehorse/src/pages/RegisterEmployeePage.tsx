import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Info, Mail, Phone, User } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { AuthSplitLayout } from '@/components/auth/AuthSplitLayout';
import { EmailOtpStep } from '@/components/auth/EmailOtpStep';
import { ZonePicker } from '@/components/auth/ZonePicker';
import {
  ErrorBanner, Field, PasswordPair, StepTabs,
  isValidEmail, normaliseIndianMobile, passwordProblem,
} from '@/components/auth/RegistrationFields';
import type { IndiaPlace } from '@/utils/indiaPlaces';

const STEPS = ['About you', 'Work zone & password', 'Verify e-mail'];

/**
 * Field-worker registration:
 *   1. full name, mobile, e-mail
 *   2. primary operational zone (search or GPS), password + confirmation
 *   3. e-mail OTP from noreply@chasehorse.com
 * Then the account waits for approval by the zone's operations manager or an admin.
 */
export function RegisterEmployeePage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [zone, setZone] = useState<IndiaPlace | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAbout, setShowAbout] = useState(false);

  const mobileOk = normaliseIndianMobile(mobile) !== null;
  const emailOk = isValidEmail(email);

  const toStep2 = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setError(null);
    if (fullName.trim().length < 2) return setError('Please enter your full name as on your ID.');
    if (!mobileOk) return setError('Enter a valid 10-digit Indian mobile number.');
    if (!emailOk) return setError('Enter a valid e-mail address.');
    setSubmitted(false);
    setStep(1);
  };

  const register = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setError(null);
    if (!zone) return setError('Choose your primary work operational zone.');
    const pwProblem = passwordProblem(password, confirm);
    if (pwProblem) return setError(pwProblem);

    setLoading(true);
    try {
      const { needsConfirmation } = await signUp(email, password, {
        displayName: fullName.trim(),
        phone: normaliseIndianMobile(mobile) ?? undefined,
        accountType: 'EMPLOYEE',
        subRole: 'field_worker',
        stateCode: zone.stateCode,
        region: zone.stateName,
        zonePlace: zone.name,
        zoneDistrict: zone.district,
        zoneLat: zone.lat,
        zoneLng: zone.lng,
      });
      if (needsConfirmation) setStep(2);
      else navigate('/pending-approval', { replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Registration failed.';
      setError(/already registered|already exists/i.test(msg)
        ? 'An account with this e-mail already exists. Sign in instead, or use a different e-mail.'
        : msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthSplitLayout
      subTag="FOR FIELD WORKERS"
      tagline="Pick up paid tasks near you. Your reward is credited when the work is approved."
      previewCardDecision="₹450 credited"
      previewCardStatus="approved"
    >
      <div className="ch-reg-tag"><User size={13} /> Field worker</div>
      <h1 className="ch-reg-title">Join as a field worker</h1>
      <p className="ch-reg-lede">
        Takes about two minutes. After you verify your e-mail, your zone's operations manager reviews
        your application before you can accept tasks.
      </p>

      <StepTabs steps={STEPS} current={step} />
      {step < 2 && <ErrorBanner message={error} />}

      {step === 0 && (
        <form className="ch-reg-form" onSubmit={toStep2} noValidate>
          <Field id="reg-name" label="Full name" icon={<User size={16} />} required autoComplete="name"
            placeholder="As on your ID" value={fullName} onChange={(e) => setFullName(e.target.value)}
            invalid={submitted && fullName.trim().length < 2} />
          <Field id="reg-mobile" label="Mobile number" icon={<Phone size={16} />} type="tel" required
            autoComplete="tel" inputMode="tel" placeholder="98450 12345" value={mobile}
            onChange={(e) => setMobile(e.target.value)} invalid={submitted && !mobileOk}
            hint={submitted && !mobileOk ? '10 digits, starting 6–9. +91 is optional.' : undefined} />
          <Field id="reg-email" label="E-mail" icon={<Mail size={16} />} type="email" required
            autoComplete="email" placeholder="you@example.com" value={email}
            onChange={(e) => setEmail(e.target.value)} invalid={submitted && !emailOk}
            hint="We'll send a verification code to this address." />
          <button type="submit" className="ch-reg-btn">Continue <ArrowRight size={16} /></button>
        </form>
      )}

      {step === 1 && (
        <form className="ch-reg-form" onSubmit={register} noValidate>
          <ZonePicker value={zone} onChange={setZone} invalid={submitted && !zone} />
          <PasswordPair password={password} confirm={confirm} onPassword={setPassword} onConfirm={setConfirm} />
          <div className="ch-reg-actions">
            <button type="button" className="ch-reg-btn ch-reg-btn--ghost" onClick={() => { setError(null); setStep(0); }}>
              <ArrowLeft size={16} /> Back
            </button>
            <button type="submit" className="ch-reg-btn" disabled={loading}>
              {loading ? 'Creating account…' : 'Create account & send code'}
            </button>
          </div>
        </form>
      )}

      {step === 2 && (
        <EmailOtpStep
          email={email.trim().toLowerCase()}
          onVerified={() => navigate('/pending-approval', { replace: true })}
          onChangeEmail={() => { setError(null); setStep(0); }}
        />
      )}

      <p className="ch-reg-footer">
        Already have an account? <Link to="/login">Sign in</Link>
        {' · '}Hiring field workers? <Link to="/register/customer">Register your business</Link>
      </p>

      <div style={{ marginTop: '1rem' }}>
        <button type="button" className="ch-reg-linkbtn" style={{ color: '#6b7280', fontWeight: 500, fontSize: '0.75rem' }}
          onClick={() => setShowAbout((s) => !s)} aria-expanded={showAbout}>
          <Info size={14} style={{ verticalAlign: '-3px' }} /> About these fields
        </button>
        {showAbout && (
          <p className="ch-reg-hint" style={{ padding: '0.75rem', borderRadius: 6, background: 'rgba(0,0,0,0.03)' }}>
            Your name and mobile verify field submissions and credit your wallet. Your zone decides which
            operations manager reviews you and which tasks you see. Details are shared only with the
            managers and admins who review your work.
          </p>
        )}
      </div>
    </AuthSplitLayout>
  );
}
