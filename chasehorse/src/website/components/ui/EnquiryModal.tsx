import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShieldCheck, ArrowRight } from 'lucide-react';
import confetti from 'canvas-confetti';
import { VerifiedEmailField } from '../enquiries/VerifiedEmailField';
import { useEnquiry } from '../enquiries/useEnquiry';
import { EnquiryError, EnquiryReceiptCard } from '../enquiries/EnquiryReceiptCard';
import type { EnquiryFormType } from '../../lib/enquiries';

interface EnquiryModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultService?: string;
  title?: string;
  /** How the enquiry is classified in the Enquiry Management System. */
  formType?: EnquiryFormType;
  /** Extra context recorded with the enquiry (e.g. the planned corridor on the network map). */
  extraDetails?: Record<string, string>;
}

export const EnquiryModal: React.FC<EnquiryModalProps> = ({
  isOpen,
  onClose,
  defaultService,
  title = 'Schedule an Operations Consultation',
  formType = 'ENQUIRY_POPUP',
  extraDetails,
}) => {
  const [formData, setFormData] = useState({
    name: '',
    company: '',
    phone: '',
    city: 'Bengaluru',
    serviceNeeded: defaultService || 'General GELP Consultation',
    message: '',
  });
  const enquiry = useEnquiry();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const receipt = await enquiry.submit({
      formType,
      name: formData.name,
      company: formData.company,
      phone: formData.phone,
      city: formData.city,
      message: formData.message,
      details: {
        'Preferred operating hub': formData.city,
        'Primary service area': formData.serviceNeeded,
        'Requested via': title,
        ...extraDetails,
      },
    });
    if (!receipt) return;
    try {
      confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 } });
    } catch {
      // fallback
    }
  };

  const handleReset = () => {
    enquiry.reset();
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-y-auto p-4 sm:p-6 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-[#E2DED5] overflow-hidden z-10"
        >
          {/* Header */}
          <div className="p-6 border-b border-[#E2DED5] flex items-center justify-between bg-[#FAF8F5]">
            <div>
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#FF4D16] block">
                ● ENTERPRISE INQUIRY
              </span>
              <h3 className="font-bold text-lg text-[#171717]">{title}</h3>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#625E58] hover:text-[#171717] hover:bg-[#E2DED5]/50"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {enquiry.receipt ? (
            <div className="p-6">
              <EnquiryReceiptCard
                receipt={enquiry.receipt}
                email={enquiry.email}
                whatsappUrl={`https://wa.me/917337369111?text=${encodeURIComponent(`Hi Chasehorse, following up on my consultation request ${enquiry.receipt.reference}`)}`}
                onDone={handleReset}
                doneLabel="Done"
              />
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#171717]">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Anand Verma"
                    className="w-full px-3 py-2 text-xs bg-white border border-[#E2DED5] rounded-xl focus:outline-none focus:border-[#FF4D16]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#171717]">Company Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    placeholder="e.g. Tata Autocomp"
                    className="w-full px-3 py-2 text-xs bg-white border border-[#E2DED5] rounded-xl focus:outline-none focus:border-[#FF4D16]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="text-xs">
                  <VerifiedEmailField {...enquiry.emailField} id="enquiry-modal-email" />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#171717]">Mobile Number *</label>
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+91 98765 43210"
                    className="w-full px-3 py-2 text-xs bg-white border border-[#E2DED5] rounded-xl focus:outline-none focus:border-[#FF4D16]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#171717]">Preferred Operating Hub</label>
                  <select
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-white border border-[#E2DED5] rounded-xl focus:outline-none focus:border-[#FF4D16]"
                  >
                    <option value="Bengaluru">Bengaluru (HQ & South)</option>
                    <option value="New Delhi">New Delhi / NCR</option>
                    <option value="Mumbai">Mumbai / Nhava Sheva</option>
                    <option value="Chennai">Chennai Industrial Corridor</option>
                    <option value="Kolkata">Kolkata / Eastern Gateway</option>
                    <option value="Hyderabad">Hyderabad / Central Corridor</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#171717]">Primary Service Area</label>
                  <input
                    type="text"
                    value={formData.serviceNeeded}
                    onChange={(e) => setFormData({ ...formData, serviceNeeded: e.target.value })}
                    placeholder="e.g. CH Deploy, TMS, 8D Root Cause"
                    className="w-full px-3 py-2 text-xs bg-white border border-[#E2DED5] rounded-xl focus:outline-none focus:border-[#FF4D16]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-[#171717]">Operational Requirements (Optional)</label>
                <textarea
                  rows={2}
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  placeholder="Tell us about your facility locations, shipment volumes, or specific pain points..."
                  className="w-full px-3 py-2 text-xs bg-white border border-[#E2DED5] rounded-xl focus:outline-none focus:border-[#FF4D16]"
                />
              </div>

              <EnquiryError message={enquiry.error} />
              <button
                type="submit"
                disabled={!enquiry.token || enquiry.submitting}
                className="w-full py-3.5 bg-[#FF4D16] text-white font-bold rounded-xl hover:bg-[#E53E0B] transition-colors text-sm shadow-md flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>{enquiry.submitting ? 'Submitting…' : enquiry.token ? 'Request Operations Consultation' : 'Verify your e-mail to submit'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="flex items-center justify-center space-x-1.5 text-[11px] text-[#8C877D] pt-1">
                <ShieldCheck className="w-3.5 h-3.5 text-green-600" />
                <span>Zero spam • Official NDA protection available upon request</span>
              </div>
            </form>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

