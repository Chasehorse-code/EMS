import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Loader2, Mail, ShieldCheck } from 'lucide-react';
import { isValidEmail, requestEmailCode, verifyEmailCode } from '../../lib/enquiries';

export interface VerifiedEmailFieldProps {
  value: string;
  onChange: (email: string) => void;
  /** Called with the verification token once the code is accepted, or null when the e-mail changes. */
  onVerified: (token: string | null) => void;
  token: string | null;
  label?: string;
  placeholder?: string;
  /** "light" for cream/white forms, "dark" for forms on a charcoal background. */
  tone?: 'light' | 'dark';
  id?: string;
}

/**
 * E-mail input with inline one-time-code verification (code sent from noreply@chasehorse.com).
 * The parent form stays disabled for submission until {@link onVerified} receives a token.
 */
export const VerifiedEmailField: React.FC<VerifiedEmailFieldProps> = ({
  value, onChange, onVerified, token, label = 'Work Email *', placeholder = 'name@company.com', tone = 'light', id,
}) => {
  const [stage, setStage] = useState<'idle' | 'sending' | 'sent' | 'verifying'>('idle');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);
  const fieldId = id ?? 'enquiry-email';

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(t);
  }, [cooldown]);

  const dark = tone === 'dark';
  const inputCls = dark
    ? 'w-full px-3 py-2.5 bg-[#222] border border-[#333] text-white rounded-xl focus:outline-none focus:border-[#FF4D16] placeholder:text-[#777]'
    : 'w-full px-3 py-2.5 bg-[#FAF8F5] border border-[#E2DED5] text-[#171717] rounded-xl focus:outline-none focus:border-[#FF4D16]';
  const labelCls = dark ? 'font-bold text-white' : 'font-bold text-[#171717]';
  const hintCls = dark ? 'text-[11px] text-[#AAA]' : 'text-[11px] text-[#625E58]';
  const btnCls = 'shrink-0 px-3 py-2.5 rounded-xl text-xs font-bold bg-[#171717] text-white hover:bg-[#FF4D16] disabled:opacity-50 disabled:cursor-not-allowed transition-colors';

  const sendCode = async () => {
    setError(null);
    if (!isValidEmail(value)) {
      setError('Enter a valid e-mail address first.');
      return;
    }
    setStage('sending');
    try {
      const res = await requestEmailCode(value.trim());
      setStage('sent');
      setCode('');
      setCooldown(res.resendAfterSeconds);
      window.setTimeout(() => codeRef.current?.focus(), 50);
    } catch (e) {
      setStage('idle');
      setError(e instanceof Error ? e.message : 'Could not send the code.');
    }
  };

  const verify = async (candidate: string) => {
    if (!/^\d{6}$/.test(candidate)) return;
    setError(null);
    setStage('verifying');
    try {
      const res = await verifyEmailCode(value.trim(), candidate);
      onVerified(res.token);
      setStage('idle');
    } catch (e) {
      setStage('sent');
      setCode('');
      setError(e instanceof Error ? e.message : 'Could not verify the code.');
      codeRef.current?.focus();
    }
  };

  const changeEmail = (next: string) => {
    onChange(next);
    if (token) onVerified(null);
    if (stage !== 'idle') setStage('idle');
    setError(null);
  };

  if (token) {
    return (
      <div className="space-y-1">
        <label className={labelCls} htmlFor={fieldId}>{label}</label>
        <div className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-900">
          <span className="flex items-center gap-2 min-w-0">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span id={fieldId} className="truncate font-semibold">{value}</span>
          </span>
          <button type="button" onClick={() => changeEmail(value)} className="text-[11px] font-bold text-emerald-800 hover:underline shrink-0">
            Change
          </button>
        </div>
        <p className={hintCls}>E-mail verified. We'll send a copy of your submission here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <label className={labelCls} htmlFor={fieldId}>{label}</label>
      <div className="flex gap-2">
        <input
          id={fieldId}
          type="email"
          required
          autoComplete="email"
          value={value}
          onChange={(e) => changeEmail(e.target.value)}
          placeholder={placeholder}
          className={inputCls}
          disabled={stage === 'sending' || stage === 'verifying'}
        />
        {stage !== 'sent' && stage !== 'verifying' && (
          <button type="button" onClick={sendCode} disabled={stage === 'sending' || !value.trim()} className={btnCls}>
            {stage === 'sending' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send code'}
          </button>
        )}
      </div>

      {(stage === 'sent' || stage === 'verifying') && (
        <div className={`mt-2 p-3 rounded-xl border ${dark ? 'border-[#333] bg-[#1a1a1a]' : 'border-[#E2DED5] bg-white'} space-y-2`}>
          <p className={`${hintCls} flex items-start gap-1.5`}>
            <Mail className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[#FF4D16]" />
            <span>We sent a 6-digit code from <strong>noreply@chasehorse.com</strong> to {value.trim()}. Check spam if you can't see it.</span>
          </p>
          <div className="flex gap-2">
            <input
              ref={codeRef}
              inputMode="numeric"
              autoComplete="one-time-code"
              aria-label="6-digit verification code"
              maxLength={6}
              value={code}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, '').slice(0, 6);
                setCode(digits);
                if (digits.length === 6) void verify(digits);
              }}
              placeholder="••••••"
              className={`${inputCls} tracking-[0.5em] font-mono text-center`}
              disabled={stage === 'verifying'}
            />
            <button type="button" onClick={() => verify(code)} disabled={code.length !== 6 || stage === 'verifying'} className={btnCls}>
              {stage === 'verifying' ? <Loader2 className="w-4 h-4 animate-spin" /> : <span className="flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5" />Verify</span>}
            </button>
          </div>
          <button type="button" onClick={sendCode} disabled={cooldown > 0} className="text-[11px] font-bold text-[#FF4D16] disabled:text-[#8C877D] hover:underline">
            {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
          </button>
        </div>
      )}

      {error ? (
        <p role="alert" className="text-[11px] font-semibold text-red-600">{error}</p>
      ) : stage === 'idle' && (
        <p className={hintCls}>We'll e-mail you a code to confirm this address before you submit.</p>
      )}
    </div>
  );
};
