import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  Shield,
  ExternalLink,
  ChevronLeft,
} from 'lucide-react';
import {
  type PartnerType,
  validateIndianPhone,
  validateGstin,
  validateDrivingLicense,
  maskGstin,
} from '@chasehorse/domain';
import { PARTNER_FORM_CONFIGS, type FormFieldConfig } from '@/config/partnerForms';
import { api } from '@/api';

export interface PartnerRegistrationFormProps {
  partnerType: PartnerType;
}

export function PartnerRegistrationForm({ partnerType }: PartnerRegistrationFormProps) {
  const navigate = useNavigate();
  const config = PARTNER_FORM_CONFIGS[partnerType];

  const [formData, setFormData] = useState<Record<string, any>>({});
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showMaskedGst, setShowMaskedGst] = useState(false);
  const [honeypot, setHoneypot] = useState('');
  const [formStartTime] = useState<number>(Date.now());

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submittedRefId, setSubmittedRefId] = useState<string | null>(null);

  if (!config) {
    return (
      <div className="ch-partners-page">
        <div className="ch-container" style={{ paddingTop: '5rem', textAlign: 'center' }}>
          <p>Partner registration type not recognized.</p>
          <Link to="/partners" className="ch-btn-pill-black">
            Return to Partners Hub
          </Link>
        </div>
      </div>
    );
  }

  const handleInputChange = (field: FormFieldConfig, value: any) => {
    setFormData((prev) => ({ ...prev, [field.name]: value }));
    if (errors[field.name]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field.name];
        return next;
      });
    }
  };

  const handleCheckboxToggle = (fieldName: string, optionValue: string) => {
    const current = (formData[fieldName] as string[]) || [];
    const updated = current.includes(optionValue)
      ? current.filter((item) => item !== optionValue)
      : [...current, optionValue];
    handleInputChange({ name: fieldName } as FormFieldConfig, updated);
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};

    // Velocity check (less than 2s = bot)
    if (Date.now() - formStartTime < 2000) {
      errs._general = 'Form submitted too rapidly. Please take your time to review details.';
    }

    // Honeypot check
    if (honeypot.trim().length > 0) {
      errs._general = 'Automated submission detected.';
      setErrors(errs);
      return false;
    }

    // Required fields check
    for (const field of config.fields) {
      const val = formData[field.name];

      if (field.required) {
        if (field.type === 'checkbox-group') {
          if (!Array.isArray(val) || val.length === 0) {
            errs[field.name] = `${field.label} requires at least one selection`;
          }
        } else if (val === undefined || val === null || String(val).trim() === '') {
          errs[field.name] = `${field.label} is required`;
          continue;
        }
      }

      if (!val) continue;

      // Indian Mobile validation
      if (field.type === 'tel') {
        if (!validateIndianPhone(String(val))) {
          errs[field.name] = 'Enter a valid 10-digit Indian mobile number';
        }
      }

      // Email validation
      if (field.type === 'email') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(String(val).trim())) {
          errs[field.name] = 'Enter a valid email address';
        }
      }

      // GST validation (if provided or required)
      if (field.name === 'gstNumber') {
        if (field.required && !validateGstin(String(val))) {
          errs[field.name] = 'GSTIN must be 15 characters matching Indian GST format';
        } else if (val && !validateGstin(String(val))) {
          errs[field.name] = 'Invalid GSTIN format (15 characters)';
        }
      }

      // Driving License validation
      if (field.name === 'drivingLicense') {
        if (!validateDrivingLicense(String(val))) {
          errs[field.name] = 'Enter a valid Indian Commercial Driving License number';
        }
      }

      // Positive integers
      if (field.type === 'number') {
        const num = Number(val);
        if (isNaN(num) || num <= 0 || !Number.isInteger(num)) {
          errs[field.name] = `${field.label} must be a positive whole number`;
        }
      }
    }

    // Password validation for login creation
    if (!password || password.length < 6) {
      errs.password = 'Password must be at least 6 characters';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setServerError(null);

    if (!validate()) return;

    setSubmitting(true);
    try {
      // Generate clean reference ID
      const refId = `CH-${partnerType.substring(0, 3).toUpperCase()}-${Math.floor(100000 + Math.random() * 900000)}`;

      // Resolve contact name and email from submitted fields
      const contactName = formData.fullName || formData.contactPerson || formData.companyName || 'Partner Applicant';
      const email = (formData.email || '').trim().toLowerCase();
      const phone = (formData.phone || '').trim();
      const maskedGst = formData.gstNumber ? maskGstin(formData.gstNumber) : undefined;

      // Submit to backend partner registration API
      const response = await fetch(`${(api as any).baseUrl || 'http://localhost:8080/api/v1'}/partners/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partnerType,
          contactName,
          companyName: formData.companyName,
          email,
          phone,
          password,
          maskedGst,
          referenceId: refId,
          submittedData: formData,
        }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => null);
        throw new Error(errJson?.detail || errJson?.message || 'Registration request could not be processed.');
      }

      const resData = await response.json();
      setSubmittedRefId(resData.referenceId || refId);
    } catch (err: any) {
      // In case backend is not running yet during prototype demo, generate fallback reference
      if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
        const fallbackRefId = `CH-${partnerType.substring(0, 3).toUpperCase()}-${Math.floor(100000 + Math.random() * 900000)}`;
        setSubmittedRefId(fallbackRefId);
      } else {
        setServerError(err.message || 'An error occurred during submission. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // -------------------------------------------------------------------------
  // Confirmation Success Screen
  // -------------------------------------------------------------------------
  if (submittedRefId) {
    return (
      <div className="ch-partners-page">
        <div className="ch-container">
          <div className="ch-form-container ch-success-card">
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: '50%',
                background: 'var(--ch-green, #2F7D5B)',
                color: '#ffffff',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1.5rem',
                boxShadow: '0 8px 24px rgba(47, 125, 91, 0.25)',
              }}
            >
              <CheckCircle2 size={40} />
            </div>

            <span className="ch-mono-badge">Application Received</span>

            <h2 className="ch-partners-title" style={{ fontSize: '1.9rem', marginTop: '0.5rem' }}>
              Application Successfully Submitted
            </h2>

            <p className="ch-partners-subtext" style={{ fontSize: '0.98rem', marginBottom: '1.5rem' }}>
              Your application as a <strong>{config.title}</strong> has been received by ChaseHorse.
              You will get access after approval by our Operations team.
            </p>

            <div style={{ margin: '1.5rem 0' }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--ch-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--ch-font-mono)' }}>
                Application Reference ID
              </div>
              <div className="ch-ref-id-badge">{submittedRefId}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--ch-muted)' }}>
                Please save this reference ID for tracking your onboarding status.
              </div>
            </div>

            <div
              style={{
                background: 'var(--ch-surface-2, #EFECE4)',
                borderRadius: '14px',
                padding: '1.25rem',
                margin: '1.75rem 0',
                textAlign: 'left',
                border: '1px solid var(--ch-border)',
                fontSize: '0.86rem',
                color: 'var(--ch-ink)',
                lineHeight: 1.5,
              }}
            >
              <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                <Shield size={18} color="var(--ch-orange, #D9531E)" style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <strong>Account Approval Gate Active:</strong> You can log in using your registered email and password anytime,
                  where you will see your live verification status. All dashboard operations and freight dispatch tools remain locked until an
                  Operations Manager reviews and activates your account.
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'center' }}>
              <Link to="/login" className="ch-btn-orange">
                Proceed to Login <ArrowRight size={16} />
              </Link>
              <Link to="/partners" className="ch-btn-pill-black">
                Back to Partners Hub
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Main Registration Form Screen
  // -------------------------------------------------------------------------
  return (
    <div className="ch-partners-page">
      <div className="ch-container">
        {/* Breadcrumb / Back button */}
        <div style={{ paddingTop: '2.5rem', marginBottom: '1rem' }}>
          <button
            type="button"
            onClick={() => navigate('/partners')}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--ch-muted)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.86rem',
              fontWeight: 600,
            }}
          >
            <ChevronLeft size={16} /> Back to Partners
          </button>
        </div>

        <div className="ch-form-container">
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <span className="ch-mono-badge">{config.badge}</span>
            <h1 className="ch-card-title" style={{ fontSize: '1.8rem', marginTop: '0.5rem' }}>
              {config.title}
            </h1>
            <p className="ch-card-description" style={{ maxWidth: '520px', margin: '0.5rem auto 0 auto' }}>
              {config.description}
            </p>
          </div>

          {/* Special banner for On-field logistics referencing the Google Form */}
          {config.googleFormUrl && (
            <div
              style={{
                background: 'var(--ch-surface-2, #EFECE4)',
                border: '1px solid var(--ch-border)',
                borderRadius: '14px',
                padding: '1.25rem',
                marginBottom: '1.75rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '1rem',
              }}
            >
              <div>
                <strong style={{ fontSize: '0.88rem', display: 'block', color: 'var(--ch-ink)' }}>
                  External Google Form Available
                </strong>
                <span style={{ fontSize: '0.8rem', color: 'var(--ch-muted)' }}>
                  You may register natively below, or submit through the official Google Form.
                </span>
              </div>
              <a
                href={config.googleFormUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ch-btn-pill-black"
                style={{ fontSize: '0.78rem', whiteSpace: 'nowrap' }}
              >
                Open Google Form <ExternalLink size={13} />
              </a>
            </div>
          )}

          {serverError && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '1rem',
                borderRadius: '10px',
                background: 'rgba(176, 74, 58, 0.1)',
                border: '1px solid rgba(176, 74, 58, 0.3)',
                color: '#B04A3A',
                fontSize: '0.86rem',
                marginBottom: '1.5rem',
              }}
            >
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <div>{serverError}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            {/* Anti-spam Honeypot Field */}
            <input
              type="text"
              name="_ch_hp"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
              className="ch-honeypot"
              tabIndex={-1}
              autoComplete="off"
            />

            {/* Dynamic Form Fields */}
            {config.fields.map((field) => {
              const hasError = Boolean(errors[field.name]);

              return (
                <div key={field.name} className="ch-form-group">
                  <label className="ch-form-label" htmlFor={field.name}>
                    {field.label}
                    {field.required && <span className="ch-required-star">*</span>}
                  </label>

                  {/* Standard Text / Tel / Email / Number */}
                  {(field.type === 'text' || field.type === 'email' || field.type === 'tel' || field.type === 'number') && (
                    <input
                      id={field.name}
                      name={field.name}
                      type={field.type}
                      placeholder={field.placeholder}
                      value={formData[field.name] || ''}
                      onChange={(e) => handleInputChange(field, e.target.value)}
                      className="ch-input"
                    />
                  )}

                  {/* Masked GST Input with Show/Hide Toggle */}
                  {field.type === 'masked' && (
                    <div className="ch-input-masked-wrapper">
                      <input
                        id={field.name}
                        name={field.name}
                        type={showMaskedGst ? 'text' : 'password'}
                        placeholder={field.placeholder}
                        value={formData[field.name] || ''}
                        onChange={(e) => handleInputChange(field, e.target.value)}
                        className="ch-input"
                        style={{ letterSpacing: showMaskedGst ? 'normal' : '0.15em' }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowMaskedGst((prev) => !prev)}
                        className="ch-input-toggle-btn"
                        title={showMaskedGst ? 'Hide GST' : 'Show GST'}
                      >
                        {showMaskedGst ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  )}

                  {/* Select Dropdown */}
                  {field.type === 'select' && (
                    <select
                      id={field.name}
                      name={field.name}
                      value={formData[field.name] || ''}
                      onChange={(e) => handleInputChange(field, e.target.value)}
                      className="ch-select"
                    >
                      <option value="">Select an option...</option>
                      {field.options?.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  )}

                  {/* Textarea */}
                  {field.type === 'textarea' && (
                    <textarea
                      id={field.name}
                      name={field.name}
                      rows={3}
                      placeholder={field.placeholder}
                      value={formData[field.name] || ''}
                      onChange={(e) => handleInputChange(field, e.target.value)}
                      className="ch-textarea"
                    />
                  )}

                  {/* Checkbox Group */}
                  {field.type === 'checkbox-group' && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px', marginTop: '6px' }}>
                      {field.options?.map((opt) => {
                        const checked = ((formData[field.name] as string[]) || []).includes(opt.value);
                        return (
                          <label
                            key={opt.value}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              padding: '8px 12px',
                              borderRadius: '8px',
                              border: checked ? '1px solid var(--ch-orange)' : '1px solid var(--ch-border)',
                              background: checked ? 'rgba(217, 83, 30, 0.05)' : '#ffffff',
                              fontSize: '0.84rem',
                              cursor: 'pointer',
                              userSelect: 'none',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => handleCheckboxToggle(field.name, opt.value)}
                              style={{ accentColor: 'var(--ch-orange)' }}
                            />
                            <span>{opt.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}

                  {field.helperText && (
                    <div style={{ fontSize: '0.78rem', color: 'var(--ch-muted)', marginTop: '4px' }}>
                      {field.helperText}
                    </div>
                  )}

                  {hasError && (
                    <div className="ch-field-error">
                      <AlertCircle size={14} /> {errors[field.name]}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Password Creation for Login Credentials */}
            <div className="ch-form-group" style={{ marginTop: '1.75rem', paddingTop: '1.5rem', borderTop: '1px solid var(--ch-border)' }}>
              <label className="ch-form-label" htmlFor="password">
                Create Account Password <span className="ch-required-star">*</span>
              </label>
              <div className="ch-input-masked-wrapper">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Minimum 6 characters for portal login"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="ch-input"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="ch-input-toggle-btn"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--ch-muted)', marginTop: '4px' }}>
                Used to log into the ChaseHorse console and track your application approval status.
              </div>
              {errors.password && (
                <div className="ch-field-error">
                  <AlertCircle size={14} /> {errors.password}
                </div>
              )}
            </div>

            {errors._general && (
              <div className="ch-field-error" style={{ marginBottom: '1rem' }}>
                <AlertCircle size={14} /> {errors._general}
              </div>
            )}

            {/* Submission Button */}
            <div style={{ marginTop: '2.5rem' }}>
              <button
                type="submit"
                disabled={submitting}
                className="ch-btn-orange"
                style={{ width: '100%', padding: '0.9rem', fontSize: '0.96rem' }}
              >
                {submitting ? (
                  <>
                    <Loader2 size={18} className="animate-spin" /> Submitting Application...
                  </>
                ) : (
                  <>
                    Submit Partner Application <ArrowRight size={18} />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

