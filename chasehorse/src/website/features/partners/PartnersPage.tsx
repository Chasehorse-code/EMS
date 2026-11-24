import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Users, 
  Truck, 
  Warehouse, 
  MessageSquare, 
  ArrowRight,
  ShieldCheck,
  FileText,
  PhoneCall,
  Coins
} from 'lucide-react';
import { EnquiryModal } from '../../components/ui/EnquiryModal';

export const PartnersPage: React.FC = () => {
  const [enquiryOpen, setEnquiryOpen] = useState(false);
  const [enquiryTitle, setEnquiryTitle] = useState('Partner Network Application');

  const openModal = (title: string) => {
    setEnquiryTitle(title);
    setEnquiryOpen(true);
  };

  return (
    <div className="w-full bg-[#F4F1EA] py-10 lg:py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        
        {/* Hero */}
        <div className="bg-[#171717] rounded-3xl text-white p-8 sm:p-12 relative overflow-hidden shadow-2xl border border-white/10">
          <div className="relative z-10 max-w-3xl space-y-4">
            <span className="text-xs font-mono uppercase tracking-widest text-[#FF4D16] font-bold">
              ● GROW WITH INDIA&apos;S PREMIER NETWORK
            </span>
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight">
              Partners & Workforce Network
            </h1>
            <p className="text-sm sm:text-base text-[#E2DED5]/90 leading-relaxed font-light">
              Join hands with Chasehorse. We provide steady freight loads, verified enterprise shippers, guaranteed prompt payment cycles, and on-ground field execution support.
            </p>

            <div className="pt-4 flex flex-wrap gap-3">
              <Link
                to="/partners/apply"
                className="px-6 py-3.5 bg-[#FF4D16] text-white font-bold rounded-xl hover:bg-[#E53E0B] transition-colors text-sm flex items-center space-x-2 shadow-lg"
              >
                <span>Complete Partner Onboarding Form</span>
                <ArrowRight className="w-4 h-4" />
              </Link>

              <a
                href="https://wa.me/917337369111?text=Hi%20Chasehorse%2C%20I%20want%20to%20join%20the%20Partner%20Network"
                target="_blank"
                rel="noopener noreferrer"
                className="px-5 py-3.5 bg-[#25D366] text-white font-bold rounded-xl hover:bg-[#1EBE5D] transition-colors text-sm flex items-center space-x-2 shadow-sm"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Join Partner WhatsApp Desk</span>
              </a>

              <Link
                to="/contact"
                className="px-5 py-3.5 bg-white/10 hover:bg-white text-white hover:text-[#171717] border border-white/20 font-bold rounded-xl transition-all text-sm flex items-center space-x-2"
              >
                <span>Contact Us</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>

        <OnFieldPartnerSection onEnquire={openModal} />

        <TransportPartnerSection onEnquire={openModal} />

        <TerminalPartnerSection onEnquire={openModal} />

        {/* 24/7 Partner Support & Enquiries */}
        <div className="bg-[#171717] rounded-3xl text-white p-8 sm:p-12 relative overflow-hidden border border-white/10 shadow-xl">
          <div className="max-w-3xl space-y-4">
            <span className="text-xs font-mono uppercase tracking-widest text-[#FF4D16] font-bold">
              ● 24/7 PARTNER SUPPORT & ENQUIRIES
            </span>
            <h3 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
              Have questions or want to partner with us?
            </h3>
            <p className="text-sm sm:text-base text-[#E2DED5]/90 leading-relaxed font-light">
              Reach out directly to our partner network operations leads via WhatsApp, submit an onboarding application, or get in touch through our contact form.
            </p>
            <div className="pt-3 flex flex-wrap gap-3">
              <a
                href="https://wa.me/917337369111?text=Hi%20Chasehorse%2C%20I%20want%20to%20join%20the%20Partner%20Network"
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-3.5 bg-[#25D366] text-white font-bold rounded-xl hover:bg-[#1EBE5D] transition-colors text-sm flex items-center space-x-2 shadow-lg"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Join Partner WhatsApp Desk</span>
              </a>

              <Link
                to="/contact"
                className="px-6 py-3.5 bg-white text-[#171717] hover:bg-[#FAF8F5] font-bold rounded-xl transition-all text-sm flex items-center space-x-2 shadow-sm"
              >
                <PhoneCall className="w-4 h-4 text-[#FF4D16]" />
                <span>Contact Us</span>
              </Link>

              <Link
                to="/partners/apply"
                className="px-6 py-3.5 bg-white/10 hover:bg-white text-white hover:text-[#171717] border border-white/20 font-bold rounded-xl transition-all text-sm flex items-center space-x-2"
              >
                <FileText className="w-4 h-4" />
                <span>Complete Onboarding Form</span>
              </Link>
            </div>
          </div>
        </div>

      </div>

      {/* Enquiry Modal */}
      <EnquiryModal
        isOpen={enquiryOpen}
        onClose={() => setEnquiryOpen(false)}
        title={enquiryTitle}
      />
    </div>
  );
};

/** Partners › On-field Logistics Professionals */
export const OnFieldPartnerSection: React.FC<{ onEnquire: (title: string) => void }> = () => (
    <div id="on-field" className="bg-white rounded-3xl border border-[#E2DED5] p-8 sm:p-12 shadow-sm space-y-6 scroll-mt-24">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
        <div className="space-y-3 max-w-2xl">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-[#FFF0EB] text-[#FF4D16] text-xs font-bold">
            <Users className="w-3.5 h-3.5" />
            <span>CATEGORY 1: ON-GROUND WORKFORCE</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#171717]">
            On-Field Logistics Professionals
          </h2>
          <p className="text-sm text-[#625E58] leading-relaxed">
            We invite skilled warehouse supervisors, dock inspection leads, packaging auditors, and GST liaison specialists to join our certified field roster across our 6 metro zones.
          </p>
        </div>

        {/* On-site registration card */}
        <div className="p-6 bg-[#FAF8F5] rounded-2xl border border-[#E2DED5] text-center space-y-3 shrink-0 md:w-80">
          <span className="text-[11px] font-mono text-[#FF4D16] font-bold block uppercase">
            Field Partner Registration
          </span>
          <p className="text-xs text-[#625E58]">Submit your personal details and work experience directly to our HR team.</p>
          <Link
            to="/partners/apply?type=on-field"
            className="w-full py-3 bg-[#FF4D16] hover:bg-[#E53E0B] text-white font-bold rounded-xl text-xs flex items-center justify-center space-x-2 shadow-sm transition-colors"
          >
            <span>Apply Now</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-[#E2DED5]/60 text-xs">
        <div className="space-y-1">
          <strong className="text-[#171717] block">Statutory Insurance</strong>
          <p className="text-[#625E58]">All deployed leads receive PF, ESIC, and comprehensive accidental coverage.</p>
        </div>
        <div className="space-y-1">
          <strong className="text-[#171717] block">Bi-Weekly Pay Schedule</strong>
          <p className="text-[#625E58]">Guaranteed on-time direct bank transfers for all verified shift hours.</p>
        </div>
        <div className="space-y-1">
          <strong className="text-[#171717] block">Certification Upgrades</strong>
          <p className="text-[#625E58]">Free access to Chasehorse CFLS and 8D quality training certifications.</p>
        </div>
      </div>
    </div>
);

/** Partners › Transportation Professionals */
export const TransportPartnerSection: React.FC<{ onEnquire: (title: string) => void }> = ({ onEnquire }) => (
    <div id="transportation" className="bg-white rounded-3xl border border-[#E2DED5] p-8 sm:p-12 shadow-sm space-y-8 scroll-mt-24">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-3 max-w-2xl">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-[#FAF8F5] text-[#171717] text-xs font-bold border border-[#E2DED5]">
            <Truck className="w-3.5 h-3.5 text-[#FF4D16]" />
            <span>CATEGORY 2: CARRIER ECOSYSTEM</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#171717]">
            Transportation Professionals
          </h2>
          <p className="text-sm text-[#625E58] leading-relaxed">
            We partner across the complete freight value chain. Whether you operate single-truck runs, manage large fleets, or offer freight financing, Chasehorse gives you transparent loads and fast cashflow.
          </p>
        </div>

        <Link
          to="/partners/apply?type=transportation"
          className="px-5 py-3 bg-[#FF4D16] hover:bg-[#E53E0B] text-white rounded-xl text-xs sm:text-sm font-bold flex items-center space-x-2 self-start shadow-sm transition-colors whitespace-nowrap"
        >
          <span>Partner Application Form</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="p-5 rounded-2xl bg-[#FAF8F5] border border-[#E2DED5] space-y-2">
          <div className="flex items-center gap-2">
            <Truck className="w-4 h-4 text-[#FF4D16]" />
            <h4 className="font-bold text-base text-[#171717]">Transporters</h4>
          </div>
          <p className="text-xs text-[#625E58]">Access daily FTL spot and annual contract loads across all major industrial lanes with zero broker deduction.</p>
        </div>

        <div className="p-5 rounded-2xl bg-[#FAF8F5] border border-[#E2DED5] space-y-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#FF4D16]" />
            <h4 className="font-bold text-base text-[#171717]">Fleet Owners</h4>
          </div>
          <p className="text-xs text-[#625E58]">Scale your asset utilization with guaranteed return-load commitments, verified shippers, and fast settlements.</p>
        </div>

        <div className="p-5 rounded-2xl bg-[#FAF8F5] border border-[#E2DED5] space-y-2">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[#FF4D16]" />
            <h4 className="font-bold text-base text-[#171717]">Drivers</h4>
          </div>
          <p className="text-xs text-[#625E58]">Dignified working conditions, terminal rest lounges, free medical checks, and performance safety bonuses.</p>
        </div>

        <div className="p-5 rounded-2xl bg-[#FAF8F5] border border-[#E2DED5] space-y-2">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#FF4D16]" />
            <h4 className="font-bold text-base text-[#171717]">Freight Traders</h4>
          </div>
          <p className="text-xs text-[#625E58]">Collaborate on verified load placements, regional routing, and transparent real-time benchmark pricing.</p>
        </div>

        <div className="p-5 rounded-2xl bg-[#FAF8F5] border border-[#E2DED5] space-y-2">
          <div className="flex items-center gap-2">
            <Coins className="w-4 h-4 text-[#FF4D16]" />
            <h4 className="font-bold text-base text-[#171717]">Freight Financials</h4>
          </div>
          <p className="text-xs text-[#625E58]">Participate in verified trip invoice discounting programs with institutional risk underwriting and fast liquidity.</p>
        </div>

        <div className="p-5 rounded-2xl bg-[#FAF8F5] border border-[#E2DED5] flex flex-col justify-between space-y-3">
          <div className="space-y-1">
            <h4 className="font-bold text-base text-[#171717]">Ready to Partner?</h4>
            <p className="text-xs text-[#625E58]">Submit your vehicle details, trade credentials, or register your fleet directly.</p>
          </div>
          <button
            onClick={() => onEnquire('Register as Transportation Professional')}
            className="w-full py-2.5 bg-[#171717] text-white rounded-xl text-xs font-bold hover:bg-[#FF4D16] transition-colors"
          >
            Register Fleet with Chasehorse →
          </button>
        </div>
      </div>
    </div>
);

/** Partners › Truck Terminal Space Owners */
export const TerminalPartnerSection: React.FC<{ onEnquire: (title: string) => void }> = ({ onEnquire }) => (
    <div id="terminal-space" className="bg-white rounded-3xl border border-[#E2DED5] p-8 sm:p-12 shadow-sm space-y-6 scroll-mt-24">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-3 max-w-2xl">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-[#FAF8F5] text-[#171717] text-xs font-bold border border-[#E2DED5]">
            <Warehouse className="w-3.5 h-3.5 text-[#FF4D16]" />
            <span>CATEGORY 3: LOGISTICS INFRASTRUCTURE</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#171717]">
            Truck Terminal Space Providers
          </h2>
          <p className="text-sm text-[#625E58] leading-relaxed">
            Own an industrial land parcel, truck yard, or transit warehouse along state/national highways? List your available parking bays on our Live Market platform and earn guaranteed recurring lease income.
          </p>
        </div>

        <button
          onClick={() => onEnquire('List Truck Terminal Space')}
          className="px-6 py-3.5 bg-[#FF4D16] text-white font-bold rounded-xl hover:bg-[#E53E0B] transition-colors text-xs sm:text-sm whitespace-nowrap shadow-sm"
        >
          List Your Terminal Space →
        </button>
      </div>
    </div>
);
