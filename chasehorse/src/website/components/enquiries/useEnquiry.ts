import { useCallback, useState } from 'react';
import { submitEnquiry, type EnquiryPayload, type EnquiryReceipt } from '../../lib/enquiries';

/**
 * Shared state for a website form that submits to the Enquiry Management System:
 * the verified e-mail + token, submission status, error and the receipt.
 */
export function useEnquiry() {
  const [email, setEmail] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<EnquiryReceipt | null>(null);

  const submit = useCallback(async (payload: Omit<EnquiryPayload, 'email' | 'verificationToken'>) => {
    setError(null);
    if (!token) {
      setError('Please verify your e-mail address with the code we send you.');
      return null;
    }
    setSubmitting(true);
    try {
      const res = await submitEnquiry({ ...payload, email: email.trim(), verificationToken: token });
      setReceipt(res);
      return res;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Could not submit. Please try again.';
      // An expired verification needs a fresh code.
      if (/verify your e-mail/i.test(message)) setToken(null);
      setError(message);
      return null;
    } finally {
      setSubmitting(false);
    }
  }, [email, token]);

  const reset = useCallback(() => {
    setReceipt(null);
    setError(null);
  }, []);

  return {
    email, setEmail, token, setToken, submitting, error, setError, receipt, submit, reset,
    /** Props to spread onto <VerifiedEmailField />. */
    emailField: { value: email, onChange: setEmail, token, onVerified: setToken },
  };
}
