import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Building2, Mail, Phone, User } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { AuthSplitLayout } from '@/components/auth/AuthSplitLayout';
import { EmailOtpStep } from '@/components/auth/EmailOtpStep';
import {
  ErrorBanner, Field, PasswordPair, StepTabs,
  isValidEmail, normaliseIndianMobile, passwordProblem,
} from '@/components/auth/RegistrationFields';

const STEPS = ['Company', 'Password', 'Verify e-mail'];

/** Free / consumer mailboxes: allowed, but we nudge businesses to use their work address. */
const PERSONAL_DOMAINS = /@(gmail|yahoo|outlook|hotmail|live|icloud|rediffmail|proton(mail)?)\./i;

/**
 * Customer (business) registration:
 *   1. company name, contact name, work e-mail, phone
 *   2. password + confirmation
 *   3. e-mail OTP from noreply@chasehorse.com — the account is active as soon as it's verified.
 */
export function RegisterCustomerPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [companyName, setCompanyName] = useState('');
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailOk = isValidEmail(email);
  const phoneOk = normaliseIndianMobile(phone) !== null;

  const toStep2 = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setError(null);
    if (companyName.trim().length < 2) return setError('Please enter your company or business name.');
    if (contactName.trim().length < 2) return setError('Please enter your name.');
    if (!emailOk) return setError('Enter a valid work e-mail address.');
    if (!phoneOk) return setError('Enter a valid 10-digit Indian mobile number.');
    setSubmitted(false);
    setStep(1);
  };

  const register = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const pwProblem = passwordProblem(password, confirm);
    if (pwProblem) return setError(pwProblem);

    setLoading(true);
    try {
      const { needsConfirmation } = await signUp(email, password, {
        displayName: contactName.trim(),
        companyName: companyName.trim(),
        phone: normaliseIndianMobile(phone) ?? undefined,
        accountType: 'CUSTOMER',
      });
      if (needsConfirmation) setStep(2);
      else navigate('/customer/dashboard', { replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Registration failed.';
      setError(/already registered|already exists/i.test(msg)
        ? 'An account with this e-mail already exists. Sign in instead, or use a different e-mail.'
        : /rate limit/i.test(msg)
          ? 'Too many sign-up attempts right now. Please wait a few minutes and try again.'
          : msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthSplitLayout
      subTag="FOR ENTERPRISES"
      tagline="Deploy tasks to verified field workers near any site and get GPS-stamped photo proof."
      previewCardDecision="Verified by operations"
      previewCardStatus="review"
    >
      <div className="ch-reg-tag" style={{ ['--ch-reg-accent' as string]: '#059669' }}>
        <Building2 size={13} /> Business customer
      </div>
      <h1 className="ch-reg-title">Register your business</h1>
      <p className="ch-reg-lede">
        Post field tasks, follow verified photo evidence, and approve completed work. Your account is
        ready as soon as you verify your work e-mail.
      </p>

      <StepTabs steps={STEPS} current={step} />
      {step < 2 && <ErrorBanner message={error} />}

      {step === 0 && (
        <form className="ch-reg-form" onSubmit={toStep2} noValidate>
          <Field id="reg-company" label="Company name" icon={<Building2 size={16} />} required
            autoComplete="organization" placeholder="Apex Retail Pvt Ltd" value={companyName}
            onChange={(e) => setCompanyName(e.target.value)} invalid={submitted && companyName.trim().length < 2} />
          <Field id="reg-contact" label="Your name" icon={<User size={16} />} required autoComplete="name"
            placeholder="Full name" value={contactName} onChange={(e) => setContactName(e.target.value)}
            invalid={submitted && contactName.trim().length < 2} />
          <Field id="reg-email" label="Work e-mail" icon={<Mail size={16} />} type="email" required
            autoComplete="email" placeholder="you@company.com" value={email}
            onChange={(e) => setEmail(e.target.value)} invalid={submitted && !emailOk}
            hint={emailOk && PERSONAL_DOMAINS.test(email)
              ? 'Tip: a company address helps our team verify your business faster.'
              : "We'll send a verification code to this address."} />
          <Field id="reg-phone" label="Phone number" icon={<Phone size={16} />} type="tel" required
            autoComplete="tel" inputMode="tel" placeholder="98450 12345" value={phone}
            onChange={(e) => setPhone(e.target.value)} invalid={submitted && !phoneOk}
            hint={submitted && !phoneOk ? '10 digits, starting 6–9. +91 is optional.' : undefined} />
          <button type="submit" className="ch-reg-btn">Continue <ArrowRight size={16} /></button>
        </form>
      )}

      {step === 1 && (
        <form className="ch-reg-form" onSubmit={register} noValidate>
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
          onVerified={() => navigate('/customer/dashboard', { replace: true })}
          onChangeEmail={() => { setError(null); setStep(0); }}
        />
      )}

      <p className="ch-reg-footer">
        Already registered? <Link to="/login">Sign in</Link>
        {' · '}Looking for work? <Link to="/register/worker">Join as a field worker</Link>
      </p>
    </AuthSplitLayout>
  );
}
