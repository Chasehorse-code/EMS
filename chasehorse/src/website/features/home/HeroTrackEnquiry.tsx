import React, { useState } from 'react';
import {
  Search,
  PackageSearch,
  Zap,
  Send,
  CheckCircle2,
  AlertCircle,
  Truck,
  Warehouse,
  Undo2,
  Users,
  Cpu,
  Copy,
  Check,
  Mail,
  MessageCircle,
  Loader2,
  ArrowRight,
  ArrowLeft,
  type LucideIcon,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { MOCK_DASHBOARD_DATA } from '../../data/dashboard';
import { APP_CONFIG } from '../../lib/config';
import { VerifiedEmailField } from '../../components/enquiries/VerifiedEmailField';
import { useEnquiry } from '../../components/enquiries/useEnquiry';
import { EnquiryError } from '../../components/enquiries/EnquiryReceiptCard';
import {
  enquiryService,
  REQUEST_STATUSES,
  type ServiceRequestRecord,
} from '../../services';

type Tab = 'live' | 'track';
type LiveStage = 'services' | 'form';

/** The five headline categories shown in the widget. The full 17-service catalogue stays on the main site. */
const LIVE_SERVICES: { id: string; label: string; icon: LucideIcon }[] = [
  { id: 'truck-freight', label: 'Truck Booking & Freight', icon: Truck },
  { id: 'warehouse-field', label: 'Warehouse & Field Operations', icon: Warehouse },
  { id: 'returns', label: 'Returns & Reverse Logistics', icon: Undo2 },
  { id: 'fleet-driver', label: 'Fleet & Driver Management', icon: Users },
  { id: 'digital', label: 'Digital Transformation & Automation', icon: Cpu },
];

const EMPTY_FORM = { name: '', phone: '', email: '', company: '', message: '' };
type FormState = typeof EMPTY_FORM;
type Errors = Partial<Record<keyof FormState | 'service', string>>;

function validate(f: FormState, services: string[]): Errors {
  const e: Errors = {};
  if (!f.name.trim()) e.name = 'Enter your full name.';
  const digits = f.phone.replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 13) e.phone = 'Enter a valid mobile number.';
  // E-mail is checked (and verified by code) in <VerifiedEmailField />.
  if (!f.company.trim()) e.company = 'Enter your company name.';
  if (services.length === 0) e.service = 'Choose at least one service.';
  return e;
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** Existing demo orders remain trackable by ID so earlier tracking links keep working. */
const ORDERS = MOCK_DASHBOARD_DATA.orders;
function demoOrderAsRecord(query: string): ServiceRequestRecord | null {
  const q = query.trim().toLowerCase();
  const o = ORDERS.find((x) => [x.id, x.trackingNumber].some((v) => v.toLowerCase() === q));
  if (!o) return null;
  const status = o.status === 'Delivered' || o.status === 'Active' ? 'Completed' : 'In Progress';
  const at = new Date(o.date).toISOString();
  return {
    referenceId: `${o.id} · ${o.trackingNumber}`,
    name: '',
    phone: '',
    email: '',
    company: '',
    service: o.category,
    message: o.items,
    createdAt: at,
    updatedAt: at,
    status,
    history: [{ status, at, note: o.status }],
  };
}

function buildMessage(r: { referenceId: string; service: string } & FormState) {
  return [
    `New service request: ${r.referenceId}`,
    '',
    `Name: ${r.name}`,
    `Mobile: ${r.phone}`,
    `Email: ${r.email}`,
    `Company: ${r.company}`,
    `Services: ${r.service}`,
    ...(r.message.trim() ? ['', `Requirement: ${r.message.trim()}`] : []),
  ].join('\n');
}

/** Hero right-hand card: select services, raise a live service request, or track an existing one. */
export const HeroTrackEnquiry: React.FC = () => {
  const [tab, setTab] = useState<Tab>('live');
  const [stage, setStage] = useState<LiveStage>('services');
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [serviceError, setServiceError] = useState<string>('');

  // ---- Live Form ----
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<ServiceRequestRecord | null>(null);
  const [copied, setCopied] = useState(false);
  const enquiry = useEnquiry();

  const set = (key: keyof FormState, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const toggleService = (label: string) => {
    setSelectedServices((prev) => {
      const exists = prev.includes(label);
      const next = exists ? prev.filter((s) => s !== label) : [...prev, label];
      return next;
    });
    if (serviceError) setServiceError('');
    if (errors.service) setErrors((e) => ({ ...e, service: undefined }));
  };

  const handleGetItDone = () => {
    if (selectedServices.length === 0) {
      setServiceError('Please select at least one service to continue.');
      return;
    }
    setServiceError('');
    setStage('form');
  };

  const submitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate(form, selectedServices);
    setErrors(errs);
    if (Object.keys(errs).length) {
      const first = Object.keys(errs)[0];
      document.getElementById(`live-${first}`)?.focus();
      return;
    }

    const servicesText = selectedServices.join(', ');

    // Stored in the Enquiry Management System (team alerted, visitor e-mailed a copy).
    setSubmitting(true);
    const receipt = await enquiry.submit({
      formType: 'HERO_ENQUIRY',
      name: form.name.trim(),
      phone: form.phone.trim(),
      company: form.company.trim(),
      message: form.message.trim() || undefined,
      details: {
        Services: servicesText,
        Count: String(selectedServices.length),
      },
    });
    if (!receipt) {
      setSubmitting(false);
      return;
    }

    // Also kept in this browser under the same reference so "Track" keeps working here.
    const res = await enquiryService.createServiceRequest({
      referenceId: receipt.reference,
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: enquiry.email.trim(),
      company: form.company.trim(),
      service: servicesText,
      message: form.message.trim() || undefined,
    });
    setSubmitting(false);
    if (res.data) setSubmitted(res.data);
  };

  const copyRef = async () => {
    if (!submitted) return;
    try {
      await navigator.clipboard.writeText(submitted.referenceId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  // ---- Track ----
  const [trackId, setTrackId] = useState('');
  const [trackPhone, setTrackPhone] = useState('');
  const [tracking, setTracking] = useState(false);
  const [result, setResult] = useState<ServiceRequestRecord | null | undefined>(undefined);

  const submitTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    const demo = demoOrderAsRecord(trackId);
    if (demo) {
      setResult(demo);
      return;
    }
    setTracking(true);
    const res = await enquiryService.trackServiceRequest(trackId, trackPhone);
    setTracking(false);
    setResult(res.data ?? null);
  };

  const inputCls =
    'w-full px-3.5 py-2 rounded-xl border border-[#E2DED5] bg-white text-sm text-[#171717] placeholder:text-[#A8A29A] outline-none focus:border-[#FF4D16] focus:ring-2 focus:ring-[#FF4D16]/15 transition';
  const errCls = '!border-red-500';

  const field = (
    key: keyof FormState,
    placeholder: string,
    props: React.InputHTMLAttributes<HTMLInputElement> = {},
    wrapperClass = '',
  ) => (
    <div className={wrapperClass}>
      <input
        id={`live-${key}`}
        value={form[key]}
        onChange={(e) => set(key, e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder.replace(' *', '')}
        aria-invalid={!!errors[key]}
        aria-describedby={errors[key] ? `live-${key}-err` : undefined}
        className={`${inputCls} ${errors[key] ? errCls : ''}`}
        {...props}
      />
      {errors[key] && (
        <p id={`live-${key}-err`} className="mt-1 text-[11px] font-semibold text-red-600">
          {errors[key]}
        </p>
      )}
    </div>
  );

  return (
    <div className="bg-white rounded-3xl border border-[#E2DED5] shadow-[0_24px_60px_-20px_rgba(23,23,23,0.18)] overflow-hidden">
      {/* Tabs */}
      <div role="tablist" aria-label="Live request or track" className="grid grid-cols-2 p-1 mx-4 mt-3 mb-0 rounded-2xl bg-[#F4F1EA]">
        {([
          { id: 'live', label: 'Live', icon: Zap },
          { id: 'track', label: 'Track', icon: PackageSearch },
        ] as const).map(({ id, label, icon: Icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              role="tab"
              aria-selected={active}
              type="button"
              onClick={() => setTab(id)}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${
                active ? 'bg-white text-[#171717] shadow-sm' : 'text-[#625E58] hover:text-[#171717]'
              }`}
            >
              <Icon className={`w-4 h-4 ${active ? 'text-[#FF4D16]' : ''}`} />
              {label}
              {id === 'live' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" aria-hidden />}
            </button>
          );
        })}
      </div>

      <div className="px-5 pt-4 pb-5 sm:px-6">
        {tab === 'track' ? (
          /* ======================= TRACK ======================= */
          <div className="space-y-5">
            <div className="space-y-1">
              <h3 className="font-hero text-2xl font-extrabold tracking-tight text-[#171717]">Track your request</h3>
              <p className="text-sm text-[#625E58]">Enter your reference ID and the mobile number you registered with.</p>
            </div>

            <form onSubmit={submitTrack} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  value={trackId}
                  onChange={(e) => {
                    setTrackId(e.target.value);
                    setResult(undefined);
                  }}
                  placeholder="Reference ID, e.g. CH-REQ-482913"
                  aria-label="Reference ID"
                  className={inputCls}
                  required
                />
                <input
                  type="tel"
                  value={trackPhone}
                  onChange={(e) => {
                    setTrackPhone(e.target.value);
                    setResult(undefined);
                  }}
                  placeholder="Registered mobile number"
                  aria-label="Registered mobile number"
                  autoComplete="tel"
                  className={inputCls}
                  required={!/^(ord-|ch-trk-)/i.test(trackId.trim())}
                />
              </div>
              <button
                type="submit"
                disabled={tracking}
                className="w-full py-3 rounded-xl bg-[#171717] hover:bg-[#FF4D16] disabled:opacity-70 text-white transition-colors flex items-center justify-center gap-2 text-sm font-bold"
              >
                {tracking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Track Request
              </button>
            </form>

            {result && <TrackResult record={result} />}

            {result === null && (
              <div className="rounded-2xl border border-[#FF4D16]/25 bg-[#FFF0EB] p-4 flex gap-3 text-sm">
                <AlertCircle className="w-5 h-5 text-[#FF4D16] shrink-0" />
                <div className="text-[#625E58]">
                  No request matches <strong className="text-[#171717]">{trackId.trim()}</strong> with that mobile number. Check
                  both, or{' '}
                  <button type="button" onClick={() => setTab('live')} className="font-bold text-[#FF4D16] hover:underline">
                    raise a new request
                  </button>
                  .
                </div>
              </div>
            )}

            {result === undefined && (
              <div className="rounded-2xl border border-dashed border-[#E2DED5] p-5 text-center text-xs text-[#8C877D]">
                Status updates for service requests, truck bookings and HSE orders.
              </div>
            )}
          </div>
        ) : submitted ? (
          /* ======================= SUCCESS ======================= */
          <div className="py-2 text-center space-y-4">
            <div className="w-14 h-14 mx-auto rounded-full bg-[#FFF0EB] flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-[#FF4D16]" />
            </div>
            <div className="space-y-1">
              <h3 className="font-hero text-2xl font-extrabold tracking-tight text-[#171717]">Request submitted</h3>
              <p className="text-sm text-[#625E58] max-w-xs mx-auto">
                Thanks, {submitted.name.split(' ')[0]}. Our team will contact you shortly about{' '}
                <strong className="text-[#171717]">{submitted.service}</strong>.
              </p>
            </div>

            <div className="rounded-2xl border border-[#E2DED5] bg-[#FAF8F5] p-4">
              <div className="text-[11px] font-bold uppercase tracking-widest text-[#8C877D]">Reference ID</div>
              <div className="mt-1 flex items-center justify-center gap-2">
                <span className="font-mono text-xl font-extrabold text-[#171717]">{submitted.referenceId}</span>
                <button
                  type="button"
                  onClick={copyRef}
                  aria-label="Copy reference ID"
                  className="p-1.5 rounded-lg text-[#625E58] hover:text-[#FF4D16] hover:bg-white transition"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <p className="mt-1 text-[11px] text-[#8C877D]">Save this ID to track your request.</p>
            </div>

            <p className="text-xs text-[#625E58]">
              We opened WhatsApp with your request details. Tap <strong>Send</strong> to reach our team.
            </p>

            <div className="grid grid-cols-2 gap-2">
              <a
                href={`https://wa.me/${APP_CONFIG.ENQUIRY_WHATSAPP_NUMBER}?text=${encodeURIComponent(
                  buildMessage({ ...submitted, message: submitted.message ?? '' })
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="py-2.5 rounded-xl border border-[#E2DED5] hover:border-[#171717] text-xs font-bold text-[#171717] flex items-center justify-center gap-1.5 transition"
              >
                <MessageCircle className="w-4 h-4" /> Open WhatsApp again
              </a>
              <a
                href={`mailto:${APP_CONFIG.SUPPORT_EMAIL}?cc=${encodeURIComponent(submitted.email)}&subject=${encodeURIComponent(
                  `Service request ${submitted.referenceId}`
                )}&body=${encodeURIComponent(buildMessage({ ...submitted, message: submitted.message ?? '' }))}`}
                className="py-2.5 rounded-xl border border-[#E2DED5] hover:border-[#171717] text-xs font-bold text-[#171717] flex items-center justify-center gap-1.5 transition"
              >
                <Mail className="w-4 h-4" /> Email a copy
              </a>
            </div>

            <div className="flex items-center justify-center gap-4 text-sm">
              <button
                type="button"
                onClick={() => {
                  setTrackId(submitted.referenceId);
                  setTrackPhone(submitted.phone);
                  setResult(submitted);
                  setTab('track');
                }}
                className="font-bold text-[#171717] hover:text-[#FF4D16]"
              >
                Track this request
              </button>
              <span className="text-[#E2DED5]">|</span>
              <button
                type="button"
                onClick={() => {
                  setSubmitted(null);
                  setForm(EMPTY_FORM);
                  setSelectedServices([]);
                  setStage('services');
                }}
                className="font-bold text-[#FF4D16] hover:underline"
              >
                New request
              </button>
            </div>
          </div>
        ) : stage === 'services' ? (
          /* ======================= STAGE 1: SERVICES SELECTION BLOCK ======================= */
          <AnimatePresence mode="wait">
            <motion.div
              key="services-stage"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
              className="space-y-3.5"
            >
              <div className="space-y-0.5">
                <h3 className="font-hero text-xl xl:text-[22px] font-extrabold tracking-tight text-[#171717]">
                  Get it done, live with ChaseHorse
                </h3>
                <p className="text-[13px] text-[#625E58]">
                  Select the services you need to book logistics or request instant support.
                </p>
              </div>

              {/* 
                Shape Layout:
                Row 1: S1 (Truck Booking & Freight) | S2 (Warehouse & Field Operations)
                Row 2: S3 (Returns & Reverse Logistics) | S4 (Fleet & Driver Management)
                Row 3: S5 (Digital Transformation & Automation) - full width
              */}
              <div className="grid grid-cols-2 gap-2.5 pt-1">
                {LIVE_SERVICES.slice(0, 4).map((service) => {
                  const selected = selectedServices.includes(service.label);
                  const Icon = service.icon;
                  return (
                    <button
                      key={service.id}
                      type="button"
                      role="checkbox"
                      aria-checked={selected}
                      onClick={() => toggleService(service.label)}
                      className={`group relative p-3 sm:p-3.5 rounded-2xl border text-left transition-all duration-200 flex flex-col justify-between min-h-[96px] sm:min-h-[104px] cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4D16] ${
                        selected
                          ? 'border-[#FF4D16] bg-[#FFF0EB]/85 ring-2 ring-[#FF4D16]/20 shadow-sm'
                          : 'border-[#E2DED5] bg-white hover:border-[#FF4D16]/40 hover:bg-[#FAF8F5]'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${
                            selected
                              ? 'bg-[#FF4D16] text-white shadow-sm shadow-[#FF4D16]/30'
                              : 'bg-[#F4F1EA] text-[#625E58] group-hover:text-[#171717]'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <div
                          className={`w-5 h-5 rounded-full flex items-center justify-center border transition-all ${
                            selected
                              ? 'bg-[#FF4D16] border-[#FF4D16] text-white shadow-sm'
                              : 'border-[#D5CEBE] bg-white group-hover:border-[#A8A29A]'
                          }`}
                        >
                          {selected && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                      </div>
                      <span className="text-xs sm:text-[13px] font-bold text-[#171717] leading-snug mt-2 line-clamp-2">
                        {service.label}
                      </span>
                    </button>
                  );
                })}

                {/* S5: Spans both columns */}
                {(() => {
                  const s5 = LIVE_SERVICES[4];
                  const selected5 = selectedServices.includes(s5.label);
                  const Icon = s5.icon;
                  return (
                    <button
                      key={s5.id}
                      type="button"
                      role="checkbox"
                      aria-checked={selected5}
                      onClick={() => toggleService(s5.label)}
                      className={`group relative col-span-2 p-3 sm:p-3.5 rounded-2xl border text-left transition-all duration-200 flex items-center justify-between cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4D16] ${
                        selected5
                          ? 'border-[#FF4D16] bg-[#FFF0EB]/85 ring-2 ring-[#FF4D16]/20 shadow-sm'
                          : 'border-[#E2DED5] bg-white hover:border-[#FF4D16]/40 hover:bg-[#FAF8F5]'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                            selected5
                              ? 'bg-[#FF4D16] text-white shadow-sm shadow-[#FF4D16]/30'
                              : 'bg-[#F4F1EA] text-[#625E58] group-hover:text-[#171717]'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <span className="text-xs sm:text-[13px] font-bold text-[#171717] leading-snug truncate">
                          {s5.label}
                        </span>
                      </div>
                      <div
                        className={`w-5 h-5 rounded-full flex items-center justify-center border shrink-0 transition-all ${
                          selected5
                            ? 'bg-[#FF4D16] border-[#FF4D16] text-white shadow-sm'
                            : 'border-[#D5CEBE] bg-white group-hover:border-[#A8A29A]'
                        }`}
                      >
                        {selected5 && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                    </button>
                  );
                })()}
              </div>

              {/* Status info & validation */}
              {serviceError ? (
                <p className="text-[11px] font-semibold text-red-600 text-center animate-shake">
                  {serviceError}
                </p>
              ) : selectedServices.length > 0 ? (
                <div className="flex items-center justify-center gap-1.5 text-xs text-[#625E58]">
                  <span className="font-bold text-[#FF4D16]">{selectedServices.length}</span>
                  <span>{selectedServices.length === 1 ? 'service' : 'services'} selected &bull; click to modify</span>
                </div>
              ) : (
                <p className="text-xs text-[#8C877D] text-center">
                  Select one or multiple services to proceed.
                </p>
              )}

              {/* Get it done CTA button */}
              <button
                type="button"
                onClick={handleGetItDone}
                className="w-full py-3.5 rounded-xl bg-[#FF4D16] hover:bg-[#E53E0B] text-white font-hero font-bold text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg shadow-[#FF4D16]/25 hover:shadow-[#FF4D16]/35 active:scale-[0.99] transition-all group"
              >
                <span>Get it done</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </button>
            </motion.div>
          </AnimatePresence>
        ) : (
          /* ======================= STAGE 2: LIVE FORM ======================= */
          <AnimatePresence mode="wait">
            <motion.form
              key="form-stage"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
              onSubmit={submitRequest}
              noValidate
              className="space-y-3"
            >
              {/* Back to services navigation */}
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setStage('services')}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#625E58] hover:text-[#FF4D16] transition-colors group"
                >
                  <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
                  <span>Back to services</span>
                </button>
                <span className="text-[11px] font-semibold text-[#8C877D]">
                  Step 2 of 2
                </span>
              </div>

              <div className="space-y-0.5">
                <h3 className="font-hero text-xl xl:text-[22px] font-extrabold tracking-tight text-[#171717]">
                  Get it done, live with ChaseHorse
                </h3>
                <p className="text-[13px] text-[#625E58]">Raise a service request, book logistics, or get immediate support.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {field('name', 'Full name *', { autoComplete: 'name' })}
                {field('phone', 'Mobile number *', { type: 'tel', autoComplete: 'tel', inputMode: 'tel' })}
                {field('company', 'Company name *', { autoComplete: 'organization' }, 'sm:col-span-2')}
                <div className="sm:col-span-2 text-xs">
                  <VerifiedEmailField {...enquiry.emailField} id="live-email" label="Email address *" />
                </div>
              </div>

              {/* Multi-service selection: pre-selected and modifiable */}
              <fieldset>
                <div className="flex items-center justify-between mb-1.5">
                  <legend className="text-xs font-bold text-[#171717]">
                    Selected services <span className="text-[#FF4D16]">*</span>
                  </legend>
                  <span className="text-[11px] font-medium text-[#8C877D]">
                    {selectedServices.length > 0 ? `${selectedServices.length} selected` : 'Select at least one'}
                  </span>
                </div>
                <div
                  id="live-service"
                  tabIndex={-1}
                  aria-invalid={!!errors.service}
                  className="flex flex-wrap gap-1.5 outline-none"
                >
                  {LIVE_SERVICES.map(({ id, label, icon: Icon }) => {
                    const active = selectedServices.includes(label);
                    return (
                      <button
                        key={id}
                        type="button"
                        role="checkbox"
                        aria-checked={active}
                        onClick={() => toggleService(label)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-[12px] font-semibold leading-none transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4D16] ${
                          active
                            ? 'border-[#FF4D16] bg-[#FFF0EB] text-[#171717] ring-1 ring-[#FF4D16]'
                            : `bg-white text-[#3D3A35] hover:border-[#171717]/40 hover:bg-[#FAF8F5] ${errors.service ? 'border-red-300' : 'border-[#E2DED5]'}`
                        }`}
                      >
                        {active ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#FF4D16]" />
                        ) : (
                          <Icon className="w-3.5 h-3.5 text-[#8C877D]" />
                        )}
                        {label}
                      </button>
                    );
                  })}
                </div>
                {errors.service && <p className="mt-1 text-[11px] font-semibold text-red-600">{errors.service}</p>}
              </fieldset>

              <textarea
                value={form.message}
                onChange={(e) => set('message', e.target.value)}
                placeholder="Describe your requirement (optional)"
                aria-label="Requirement description"
                rows={2}
                className={`${inputCls} resize-none`}
              />

              <EnquiryError message={enquiry.error} />
              <button
                type="submit"
                disabled={submitting || !enquiry.token}
                className="w-full py-3.5 rounded-xl bg-[#FF4D16] hover:bg-[#E53E0B] disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-[#FF4D16]/25 transition-colors"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {enquiry.token ? 'Book Now to Submit' : 'Verify your e-mail to submit'}
              </button>
            </motion.form>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
};

/** Tracking result card with status progress and history. */
const TrackResult: React.FC<{ record: ServiceRequestRecord }> = ({ record }) => {
  const stepIndex = REQUEST_STATUSES.indexOf(record.status);
  const done = record.status === 'Completed';
  return (
    <div className="rounded-2xl border border-[#E2DED5] bg-[#FAF8F5] p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-mono font-bold uppercase tracking-widest text-[#8C877D] break-all">
            {record.referenceId}
          </div>
          <div className="mt-1 font-bold text-sm text-[#171717]">{record.service}</div>
          {record.message && <div className="text-xs text-[#625E58] line-clamp-2">{record.message}</div>}
        </div>
        <span
          className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-bold ${
            done ? 'bg-emerald-50 text-emerald-700' : 'bg-[#FFF0EB] text-[#FF4D16]'
          }`}
        >
          {record.status}
        </span>
      </div>

      {/* Progress */}
      <ol className="flex items-center">
        {REQUEST_STATUSES.map((s, i) => {
          const reached = i <= stepIndex;
          return (
            <li key={s} className="flex-1 flex items-center last:flex-none">
              <div className="flex flex-col items-center gap-1">
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center ${
                    reached ? 'bg-[#FF4D16] text-white' : 'bg-white border border-[#E2DED5] text-[#C9C3B6]'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </span>
                <span className={`text-[10px] font-bold whitespace-nowrap ${reached ? 'text-[#171717]' : 'text-[#A8A29A]'}`}>{s}</span>
              </div>
              {i < REQUEST_STATUSES.length - 1 && (
                <span className={`flex-1 h-0.5 mx-1.5 mb-4 rounded-full ${i < stepIndex ? 'bg-[#FF4D16]' : 'bg-[#E2DED5]'}`} />
              )}
            </li>
          );
        })}
      </ol>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        <div>
          <dt className="text-[#8C877D]">Request date</dt>
          <dd className="font-semibold text-[#171717]">{formatDate(record.createdAt)}</dd>
        </div>
        <div>
          <dt className="text-[#8C877D]">Last updated</dt>
          <dd className="font-semibold text-[#171717]">{formatDate(record.updatedAt)}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-[#8C877D]">Assigned team</dt>
          <dd className="font-semibold text-[#171717]">{record.assignedTeam ?? 'Being assigned'}</dd>
        </div>
      </dl>

      {record.history.length > 0 && (
        <div>
          <div className="text-[11px] font-bold uppercase tracking-widest text-[#8C877D] mb-2">Status history</div>
          <ul className="space-y-2 border-l-2 border-[#E2DED5] pl-3">
            {[...record.history].reverse().map((h, i) => (
              <li key={i} className="text-xs">
                <span className="font-bold text-[#171717]">{h.status}</span>
                <span className="text-[#8C877D]"> · {formatDate(h.at)}</span>
                {h.note && <div className="text-[#625E58]">{h.note}</div>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
