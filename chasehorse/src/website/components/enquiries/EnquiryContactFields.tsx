import React from 'react';
import { VerifiedEmailField, type VerifiedEmailFieldProps } from './VerifiedEmailField';

export interface EnquiryContact {
  name: string;
  phone: string;
  company: string;
}

export const EMPTY_CONTACT: EnquiryContact = { name: '', phone: '', company: '' };

export const isContactComplete = (c: EnquiryContact) =>
  c.name.trim().length >= 2 && c.phone.replace(/\D/g, '').length >= 10;

interface Props {
  value: EnquiryContact;
  onChange: (next: EnquiryContact) => void;
  emailField: Omit<VerifiedEmailFieldProps, 'id' | 'label'>;
  /** Show the optional company field (business requests). */
  withCompany?: boolean;
  tone?: 'light' | 'dark';
  idPrefix: string;
}

/**
 * "Your details" block for forms that previously collected no contact information
 * (live-market bookings, HSE shop requests…): name, mobile, optional company and a verified e-mail.
 */
export const EnquiryContactFields: React.FC<Props> = ({ value, onChange, emailField, withCompany = true, tone = 'light', idPrefix }) => {
  const dark = tone === 'dark';
  const inputCls = dark
    ? 'w-full px-3 py-2.5 bg-[#222] border border-[#333] text-white rounded-xl focus:outline-none focus:border-[#FF4D16] placeholder:text-[#777]'
    : 'w-full px-3 py-2.5 bg-[#FAF8F5] border border-[#E2DED5] text-[#171717] rounded-xl focus:outline-none focus:border-[#FF4D16]';
  const labelCls = dark ? 'font-bold text-white' : 'font-bold text-[#171717]';
  const set = (key: keyof EnquiryContact) => (e: React.ChangeEvent<HTMLInputElement>) => onChange({ ...value, [key]: e.target.value });

  return (
    <fieldset className="space-y-3 text-xs">
      <legend className={`mb-2 text-[11px] font-mono uppercase tracking-widest font-bold ${dark ? 'text-[#FF4D16]' : 'text-[#FF4D16]'}`}>
        Your details
      </legend>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className={labelCls} htmlFor={`${idPrefix}-name`}>Full name *</label>
          <input id={`${idPrefix}-name`} required autoComplete="name" value={value.name} onChange={set('name')}
            placeholder="e.g. Anand Verma" className={inputCls} />
        </div>
        <div className="space-y-1">
          <label className={labelCls} htmlFor={`${idPrefix}-phone`}>Mobile number *</label>
          <input id={`${idPrefix}-phone`} required type="tel" autoComplete="tel" inputMode="tel" value={value.phone}
            onChange={set('phone')} placeholder="+91 98765 43210" className={inputCls} />
        </div>
        {withCompany && (
          <div className="space-y-1 sm:col-span-2">
            <label className={labelCls} htmlFor={`${idPrefix}-company`}>Company (optional)</label>
            <input id={`${idPrefix}-company`} autoComplete="organization" value={value.company} onChange={set('company')}
              placeholder="e.g. Tata Autocomp" className={inputCls} />
          </div>
        )}
        <div className="sm:col-span-2">
          <VerifiedEmailField {...emailField} id={`${idPrefix}-email`} label="Email *" tone={tone} />
        </div>
      </div>
    </fieldset>
  );
};
