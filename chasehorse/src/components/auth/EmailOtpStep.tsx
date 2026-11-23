import { useEffect, useRef, useState, type ClipboardEvent, type FormEvent, type KeyboardEvent } from 'react';
import { MailCheck, ShieldCheck } from 'lucide-react';
import { useAuth, type UserProfile } from '@/context/AuthContext';
import { ErrorBanner } from './RegistrationFields';

const OTP_LENGTH = 6;
const RESEND_COOLDOWN_S = 60;

interface EmailOtpStepProps {
  email: string;
  /** Called after the code is accepted; the user is now signed in. */
  onVerified: (profile: UserProfile | null) => void;
  /** Lets the user go back and correct a mistyped address. */
  onChangeEmail?: () => void;
}

/**
 * Enter the 6-digit code that was e-mailed at sign-up (sent by Supabase from
 * noreply@chasehorse.com via Zoho). Verifying confirms the address and signs the user in.
 */
export function EmailOtpStep({ email, onVerified, onChangeEmail }: EmailOtpStepProps) {
  const { verifyEmailOtp, resendSignupOtp } = useAuth();
  const [digits, setDigits] = useState<string[]>(() => Array(OTP_LENGTH).fill(''));
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_S);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(t);
  }, [cooldown]);

  const code = digits.join('');

  const setAt = (index: number, value: string) => {
    const clean = value.replace(/\D/g, '');
    if (clean.length > 1) {
      fillFrom(index, clean);
      return;
    }
    setDigits((d) => d.map((v, i) => (i === index ? clean : v)));
    if (clean && index < OTP_LENGTH - 1) inputs.current[index + 1]?.focus();
  };

  const fillFrom = (start: number, value: string) => {
    const chars = value.replace(/\D/g, '').slice(0, OTP_LENGTH - start).split('');
    setDigits((d) => d.map((v, i) => (i >= start && i - start < chars.length ? chars[i - start] : v)));
    inputs.current[Math.min(start + chars.length, OTP_LENGTH - 1)]?.focus();
  };

  const onKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) inputs.current[index - 1]?.focus();
    if (e.key === 'ArrowLeft' && index > 0) inputs.current[index - 1]?.focus();
    if (e.key === 'ArrowRight' && index < OTP_LENGTH - 1) inputs.current[index + 1]?.focus();
  };

  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    fillFrom(0, e.clipboardData.getData('text'));
  };

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (code.length !== OTP_LENGTH || verifying) return;
    setError(null);
    setInfo(null);
    setVerifying(true);
    try {
      const profile = await verifyEmailOtp(email, code);
      onVerified(profile);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      setError(/expired|invalid/i.test(msg)
        ? 'That code is incorrect or has expired. Check the latest e-mail, or send a new code.'
        : msg || 'Could not verify the code. Please try again.');
      setDigits(Array(OTP_LENGTH).fill(''));
      inputs.current[0]?.focus();
    } finally {
      setVerifying(false);
    }
  };

  // Auto-submit once all six digits are present.
  useEffect(() => {
    if (code.length === OTP_LENGTH) void submit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const resend = async () => {
    setError(null);
    setInfo(null);
    try {
      await resendSignupOtp(email);
      setInfo('A new code is on its way. Codes expire after a short time, so use the latest one.');
      setCooldown(RESEND_COOLDOWN_S);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send a new code right now.');
    }
  };

  return (
    <form className="ch-reg-form" onSubmit={submit} noValidate>
      <div className="ch-reg-note">
        <MailCheck size={16} />
        <span>
          We sent a {OTP_LENGTH}-digit code from <strong>noreply@chasehorse.com</strong> to{' '}
          <span className="ch-otp-email">{email}</span>. Check your spam folder if it hasn't arrived.
        </span>
      </div>

      <ErrorBanner message={error} />
      {info && <p className="ch-reg-hint" data-tone="ok" role="status">{info}</p>}

      <div className="ch-reg-field">
        <label htmlFor="otp-0">Verification code</label>
        <div className="ch-otp-inputs" role="group" aria-label="Verification code">
          {digits.map((d, i) => (
            <input key={i} id={`otp-${i}`} ref={(el) => { inputs.current[i] = el; }}
              inputMode="numeric" autoComplete={i === 0 ? 'one-time-code' : 'off'} maxLength={OTP_LENGTH}
              aria-label={`Digit ${i + 1}`} value={d} disabled={verifying}
              onChange={(e) => setAt(i, e.target.value)} onKeyDown={(e) => onKeyDown(i, e)} onPaste={onPaste} />
          ))}
        </div>
      </div>

      <button type="submit" className="ch-reg-btn" disabled={code.length !== OTP_LENGTH || verifying}>
        <ShieldCheck size={16} /> {verifying ? 'Verifying…' : 'Verify e-mail'}
      </button>

      <p className="ch-reg-hint" style={{ textAlign: 'center' }}>
        Didn't get it?{' '}
        <button type="button" className="ch-reg-linkbtn" onClick={resend} disabled={cooldown > 0}>
          {cooldown > 0 ? `Resend in ${cooldown}s` : 'Send a new code'}
        </button>
        {onChangeEmail && (
          <>
            {' · '}
            <button type="button" className="ch-reg-linkbtn" onClick={onChangeEmail}>Change e-mail</button>
          </>
        )}
      </p>
    </form>
  );
}
