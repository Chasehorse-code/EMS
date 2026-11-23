import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Users, Truck, Warehouse, Send, MessageSquare, ShieldCheck } from 'lucide-react';
import { SubPageShell } from '../../components/layout/SubPageShell';
import { APP_CONFIG } from '../../lib/config';
import { OnFieldOnboardingForm } from './OnFieldOnboardingForm';
import { VerifiedEmailField } from '../../components/enquiries/VerifiedEmailField';
import { useEnquiry } from '../../components/enquiries/useEnquiry';
import { EnquiryError, EnquiryReceiptCard } from '../../components/enquiries/EnquiryReceiptCard';
import type { EnquiryReceipt } from '../../lib/enquiries';

export type PartnerType = 'on-field' | 'transportation' | 'terminal-space';

const TYPES: { id: PartnerType; label: string; hint: string; icon: React.ElementType }[] = [
  { id: 'on-field', label: 'On-field CX Lead', hint: 'Supervisors, auditors, dock leads', icon: Users },
  { id: 'transportation', label: 'Transportation', hint: 'Fleet owners, drivers, freight traders', icon: Truck },
  { id: 'terminal-space', label: 'Terminal Space Owner', hint: 'Yards, bays, transit warehouses', icon: Warehouse },
];

const TRANSPORT_ROLES = ['Transporter / Fleet Owner', 'Professional Driver', 'Freight Trader / Financier', 'Other'];

interface FormState {
  name: string;
  phone: string;
  email: string;
  city: string;
  // Transportation
  transportRole: string;
  fleetSize: string;
  vehicleTypes: string;
  lanes: string;
  // Terminal space
  businessName: string;
  location: string;
  capacity: string;
  facilities: string;
  notes: string;
}

const EMPTY: FormState = {
  name: '',
  phone: '',
  email: '',
  city: '',
  transportRole: TRANSPORT_ROLES[0],
  fleetSize: '',
  vehicleTypes: '',
  lanes: '',
  businessName: '',
  location: '',
  capacity: '',
  facilities: '',
  notes: '',
};

const isPartnerType = (v: string | null): v is PartnerType => TYPES.some((t) => t.id === v);

/** Builds the WhatsApp message for transportation and terminal-space applications. */
const buildMessage = (type: PartnerType, f: FormState) => {
  const typeLabel = TYPES.find((t) => t.id === type)!.label;
  const lines = [
    'Hi Chasehorse team! I would like to join your Partner Network.',
    '',
    `*Partner type:* ${typeLabel}`,
    '',
    '*Contact details*',
    `Name: ${f.name}`,
    `Phone: ${f.phone}`,
  ];
  if (f.email) lines.push(`Email: ${f.email}`);
  lines.push(`City: ${f.city}`, '');

  if (type === 'transportation') {
    lines.push('*Profile*', `I am a: ${f.transportRole}`);
    if (f.fleetSize) lines.push(`Fleet size: ${f.fleetSize}`);
    if (f.vehicleTypes) lines.push(`Vehicle types: ${f.vehicleTypes}`);
    if (f.lanes) lines.push(`Preferred lanes: ${f.lanes}`);
  } else {
    lines.push('*Space details*');
    if (f.businessName) lines.push(`Business: ${f.businessName}`);
    lines.push(`Location: ${f.location}`, `Capacity: ${f.capacity}`);
    if (f.facilities) lines.push(`Facilities: ${f.facilities}`);
  }

  if (f.notes) lines.push('', '*Notes*', f.notes);
  return lines.join('\n');
};

/** Partners › Apply — on-site partner onboarding forms (replace the external Google Form). */
export const PartnerApplyPage: React.FC = () => {
  const [params] = useSearchParams();
  const initialType = params.get('type');
  const [type, setType] = useState<PartnerType>(isPartnerType(initialType) ? initialType : 'on-field');
  const [form, setForm] = useState<FormState>(EMPTY);
  const [phoneError, setPhoneError] = useState('');
  const [sent, setSent] = useState<{ receipt: EnquiryReceipt; email: string; whatsappText: string } | null>(null);
  const enquiry = useEnquiry();

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const onSent = (receipt: EnquiryReceipt, email: string, whatsappText: string) => {
    setSent({ receipt, email, whatsappText });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.phone.replace(/\D/g, '').length < 10) {
      setPhoneError('Please enter a valid mobile number (at least 10 digits).');
      return;
    }
    setPhoneError('');
    const details: Record<string, string> = type === 'transportation'
      ? { 'I am a': form.transportRole, 'Fleet size': form.fleetSize, 'Vehicle types': form.vehicleTypes, 'Preferred lanes': form.lanes }
      : { Business: form.businessName, Location: form.location, Capacity: form.capacity, Facilities: form.facilities };
    const receipt = await enquiry.submit({
      formType: type === 'transportation' ? 'PARTNER_TRANSPORT' : 'PARTNER_TERMINAL',
      name: form.name,
      phone: form.phone,
      city: form.city,
      company: type === 'terminal-space' ? form.businessName || undefined : undefined,
      message: form.notes || undefined,
      details,
    });
    if (receipt) onSent(receipt, enquiry.email, `${buildMessage(type, { ...form, email: enquiry.email })}\n\nReference: ${receipt.reference}`);
  };

  const reset = () => {
    setForm(EMPTY);
    setSent(null);
    enquiry.reset();
  };

  const inputCls =
    'w-full px-3.5 py-2.5 rounded-xl border border-[#E2DED5] bg-white text-sm text-[#171717] placeholder:text-[#A8A29A] outline-none focus:border-[#FF4D16] focus:ring-2 focus:ring-[#FF4D16]/15 transition';
  const labelCls = 'space-y-1.5 text-xs font-bold text-[#171717] block';
  const sectionCls = 'text-xs font-mono uppercase tracking-widest text-[#FF4D16] font-bold mb-3';

  return (
    <SubPageShell
      navId="partners"
      eyebrow="Partner Onboarding"
      title="Apply to the Partner Network"
      intro="Tell us about yourself and how you'd like to work with Chasehorse. Our partner desk reviews every application and gets back to you within 2 business days."
    >
      <div className="bg-white rounded-3xl border border-[#E2DED5] p-6 sm:p-10 shadow-sm">
        {sent !== null ? (
          <EnquiryReceiptCard
            receipt={sent.receipt}
            email={sent.email}
            whatsappUrl={`https://wa.me/${APP_CONFIG.ENQUIRY_WHATSAPP_NUMBER}?text=${encodeURIComponent(sent.whatsappText)}`}
            onDone={reset}
            doneLabel="Submit another application"
          />
        ) : (
          <div className="space-y-10">
            {/* Partner type */}
            <div className="space-y-3">
              <span className={`${sectionCls} block`}>I want to partner as</span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {TYPES.map(({ id, label, hint, icon: Icon }) => {
                  const active = type === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setType(id)}
                      aria-pressed={active}
                      className={`text-left p-4 rounded-2xl border transition-colors ${
                        active ? 'border-[#FF4D16] bg-[#FFF0EB]' : 'border-[#E2DED5] bg-[#FAF8F5] hover:border-[#FF4D16]/50'
                      }`}
                    >
                      <Icon className={`w-5 h-5 mb-2 ${active ? 'text-[#FF4D16]' : 'text-[#625E58]'}`} />
                      <span className="block text-sm font-bold text-[#171717]">{label}</span>
                      <span className="block text-xs text-[#625E58]">{hint}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {type === 'on-field' ? (
              <OnFieldOnboardingForm onSent={onSent} />
            ) : (
              <form onSubmit={handleSubmit} className="space-y-8">
                {/* Contact details */}
                <fieldset className="space-y-4">
                  <legend className={sectionCls}>Contact details</legend>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <label className={labelCls}>
                      <span>Full Name *</span>
                      <input required value={form.name} onChange={set('name')} placeholder="e.g. Anand Verma" className={inputCls} autoComplete="name" />
                    </label>
                    <label className={labelCls}>
                      <span>Mobile Number *</span>
                      <input
                        required
                        type="tel"
                        value={form.phone}
                        onChange={set('phone')}
                        placeholder="+91 98765 43210"
                        className={`${inputCls} ${phoneError ? 'border-red-500' : ''}`}
                        autoComplete="tel"
                      />
                      {phoneError && <span className="text-xs font-semibold text-red-600 block">{phoneError}</span>}
                    </label>
                    <div className="text-xs">
                      <VerifiedEmailField {...enquiry.emailField} id="partner-email" label="Email *" placeholder="name@example.com" />
                    </div>
                    <label className={labelCls}>
                      <span>City *</span>
                      <input required value={form.city} onChange={set('city')} placeholder="e.g. Bengaluru" className={inputCls} autoComplete="address-level2" />
                    </label>
                  </div>
                </fieldset>

                {/* Type-specific details */}
                <fieldset className="space-y-4">
                  <legend className={sectionCls}>{type === 'terminal-space' ? 'About your space' : 'About your work'}</legend>

                  {type === 'transportation' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <label className={labelCls}>
                        <span>I am a *</span>
                        <select value={form.transportRole} onChange={set('transportRole')} className={inputCls}>
                          {TRANSPORT_ROLES.map((r) => (
                            <option key={r}>{r}</option>
                          ))}
                        </select>
                      </label>
                      <label className={labelCls}>
                        <span>Fleet Size</span>
                        <input type="number" min={0} value={form.fleetSize} onChange={set('fleetSize')} placeholder="Number of trucks" className={inputCls} />
                      </label>
                      <label className={labelCls}>
                        <span>Vehicle Types</span>
                        <input value={form.vehicleTypes} onChange={set('vehicleTypes')} placeholder="e.g. 32ft MXL, 20ft container" className={inputCls} />
                      </label>
                      <label className={labelCls}>
                        <span>Preferred Lanes / Routes</span>
                        <input value={form.lanes} onChange={set('lanes')} placeholder="e.g. Bengaluru – Chennai" className={inputCls} />
                      </label>
                    </div>
                  )}

                  {type === 'terminal-space' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <label className={labelCls}>
                        <span>Business / Property Name</span>
                        <input value={form.businessName} onChange={set('businessName')} placeholder="e.g. Hosur Road Truck Yard" className={inputCls} autoComplete="organization" />
                      </label>
                      <label className={labelCls}>
                        <span>Location / Highway *</span>
                        <input required value={form.location} onChange={set('location')} placeholder="e.g. NH 44, Krishnagiri" className={inputCls} />
                      </label>
                      <label className={labelCls}>
                        <span>Capacity *</span>
                        <input required value={form.capacity} onChange={set('capacity')} placeholder="e.g. 40 truck bays / 20,000 sq ft" className={inputCls} />
                      </label>
                      <label className={labelCls}>
                        <span>Facilities</span>
                        <input value={form.facilities} onChange={set('facilities')} placeholder="e.g. CCTV, rest rooms, weighbridge" className={inputCls} />
                      </label>
                    </div>
                  )}

                  <label className={labelCls}>
                    <span>Anything else we should know? (optional)</span>
                    <textarea rows={3} value={form.notes} onChange={set('notes')} placeholder="Documents you can share, availability…" className={`${inputCls} resize-none`} />
                  </label>
                </fieldset>

                <div className="space-y-3">
                  <button
                    type="submit"
                    disabled={!enquiry.token || enquiry.submitting}
                    className="w-full sm:w-auto px-8 py-3.5 bg-[#FF4D16] text-white font-bold rounded-xl hover:bg-[#E53E0B] transition-colors text-sm shadow-md inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send className="w-4 h-4" />
                    {enquiry.submitting ? 'Submitting…' : enquiry.token ? 'Submit Application' : 'Verify your e-mail to submit'}
                  </button>
                  <EnquiryError message={enquiry.error} />
                  <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[#8C877D]">
                    <span className="inline-flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-emerald-500" />
                      Opens WhatsApp with your application ready — just tap Send.
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-green-600" />
                      Your details are only shared with the Chasehorse partner desk.
                    </span>
                  </p>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </SubPageShell>
  );
};
