import React from 'react';
import { CheckCircle2, MessageCircle } from 'lucide-react';
import type { EnquiryReceipt } from '../../lib/enquiries';

interface Props {
  receipt: EnquiryReceipt;
  email: string;
  /** Optional WhatsApp follow-up link (kept as a secondary channel). */
  whatsappUrl?: string;
  onDone?: () => void;
  doneLabel?: string;
  tone?: 'light' | 'dark';
}

/** Confirmation shown after a website form is stored in the Enquiry Management System. */
export const EnquiryReceiptCard: React.FC<Props> = ({ receipt, email, whatsappUrl, onDone, doneLabel = 'Submit another', tone = 'light' }) => {
  const dark = tone === 'dark';
  return (
    <div role="status" className={`p-6 rounded-2xl border text-center space-y-3 ${dark ? 'bg-[#1a1a1a] border-[#333] text-white' : 'bg-white border-[#E2DED5] text-[#171717]'}`}>
      <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
      <h3 className="text-lg font-extrabold">Thank you — we've received your request</h3>
      <p className={`text-xs ${dark ? 'text-[#BBB]' : 'text-[#625E58]'}`}>
        Our team will reach you shortly. A copy of your details has been sent to <strong>{email}</strong>.
      </p>
      <div className={`inline-block px-4 py-2 rounded-xl font-mono text-sm font-bold ${dark ? 'bg-[#222]' : 'bg-[#FAF8F5] border border-[#E2DED5]'}`}>
        Reference: {receipt.reference}
      </div>
      <div className="flex flex-wrap justify-center gap-2 pt-1">
        {whatsappUrl && (
          <a href={whatsappUrl} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-[#25D366] text-white hover:opacity-90">
            <MessageCircle className="w-4 h-4" /> Also chat on WhatsApp
          </a>
        )}
        {onDone && (
          <button type="button" onClick={onDone}
            className={`px-4 py-2 rounded-xl text-xs font-bold border ${dark ? 'border-[#444] hover:bg-[#222]' : 'border-[#E2DED5] hover:bg-[#FAF8F5]'}`}>
            {doneLabel}
          </button>
        )}
      </div>
    </div>
  );
};

/** Inline error under a submit button. */
export const EnquiryError: React.FC<{ message: string | null }> = ({ message }) =>
  message ? <p role="alert" className="text-xs font-semibold text-red-600">{message}</p> : null;
