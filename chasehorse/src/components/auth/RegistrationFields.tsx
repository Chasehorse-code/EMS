import { useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { AlertCircle, Eye, EyeOff, Lock } from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Validation shared by the customer and field-worker sign-up forms   */
/* ------------------------------------------------------------------ */

export const PASSWORD_MIN = 8;

/** Indian mobile: optional +91 / 0, then 10 digits starting 6-9. Returns "+91XXXXXXXXXX" or null. */
export function normaliseIndianMobile(raw: string): string | null {
  const digits = raw.replace(/[\s()-]/g, '').replace(/^\+?91/, '').replace(/^0/, '');
  return /^[6-9]\d{9}$/.test(digits) ? `+91${digits}` : null;
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

/** 0-4: length >= 8, mixed case, digit, symbol. */
export function passwordScore(pw: string): number {
  if (pw.length < PASSWORD_MIN) return pw.length ? 1 : 0;
  let score = 1;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return score;
}

/** Returns an error message, or null when the pair is acceptable. */
export function passwordProblem(pw: string, confirm: string): string | null {
  if (pw.length < PASSWORD_MIN) return `Password must be at least ${PASSWORD_MIN} characters.`;
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return 'Password must include at least one letter and one number.';
  if (pw !== confirm) return 'Passwords do not match.';
  return null;
}

/* ------------------------------------------------------------------ */
/*  Components                                                         */
/* ------------------------------------------------------------------ */

export function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="ch-reg-error" role="alert">
      <AlertCircle size={16} />
      <span>{message}</span>
    </div>
  );
}

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  icon: ReactNode;
  hint?: ReactNode;
  invalid?: boolean;
}

export function Field({ id, label, icon, hint, invalid, ...input }: FieldProps) {
  return (
    <div className="ch-reg-field">
      <label htmlFor={id}>{label}</label>
      <div className="ch-reg-input-wrap">
        {icon}
        <input id={id} className="ch-reg-input" aria-invalid={invalid || undefined}
          aria-describedby={hint ? `${id}-hint` : undefined} {...input} />
      </div>
      {hint && <p id={`${id}-hint`} className="ch-reg-hint" data-tone={invalid ? 'error' : undefined}>{hint}</p>}
    </div>
  );
}

interface PasswordPairProps {
  password: string;
  confirm: string;
  onPassword: (v: string) => void;
  onConfirm: (v: string) => void;
}

/** "Set password" + "Confirm password" with a strength meter and live match feedback. */
export function PasswordPair({ password, confirm, onPassword, onConfirm }: PasswordPairProps) {
  const [reveal, setReveal] = useState(false);
  const score = passwordScore(password);
  const mismatch = confirm.length > 0 && confirm !== password;
  const type = reveal ? 'text' : 'password';
  const toggle = (
    <button type="button" className="ch-reg-reveal" onClick={() => setReveal((r) => !r)}
      aria-label={reveal ? 'Hide passwords' : 'Show passwords'}>
      {reveal ? <EyeOff size={16} /> : <Eye size={16} />}
    </button>
  );

  return (
    <>
      <div className="ch-reg-field">
        <label htmlFor="reg-password">Set password</label>
        <div className="ch-reg-input-wrap">
          <Lock size={16} />
          <input id="reg-password" className="ch-reg-input" type={type} autoComplete="new-password" required
            minLength={PASSWORD_MIN} value={password} onChange={(e) => onPassword(e.target.value)}
            placeholder={`At least ${PASSWORD_MIN} characters`} aria-describedby="reg-password-hint" />
          {toggle}
        </div>
        <div className="ch-reg-strength" data-score={score} aria-hidden="true"><span /><span /><span /><span /></div>
        <p id="reg-password-hint" className="ch-reg-hint">Use letters and numbers; a symbol makes it stronger.</p>
      </div>
      <div className="ch-reg-field">
        <label htmlFor="reg-confirm">Confirm password</label>
        <div className="ch-reg-input-wrap">
          <Lock size={16} />
          <input id="reg-confirm" className="ch-reg-input" type={type} autoComplete="new-password" required
            value={confirm} onChange={(e) => onConfirm(e.target.value)} placeholder="Re-enter password"
            aria-invalid={mismatch || undefined} aria-describedby="reg-confirm-hint" />
        </div>
        {confirm.length > 0 && (
          <p id="reg-confirm-hint" className="ch-reg-hint" data-tone={mismatch ? 'error' : 'ok'}>
            {mismatch ? 'Passwords do not match' : 'Passwords match'}
          </p>
        )}
      </div>
    </>
  );
}

export function StepTabs({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div className="ch-reg-steps" role="list">
      {steps.map((label, i) => (
        <span key={label} role="listitem" className="ch-reg-step"
          data-state={i === current ? 'current' : i < current ? 'done' : 'todo'}
          aria-current={i === current ? 'step' : undefined}>
          {i + 1}. {label}
        </span>
      ))}
    </div>
  );
}
