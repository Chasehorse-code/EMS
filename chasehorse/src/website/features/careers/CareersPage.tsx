import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Briefcase, GraduationCap, HeartHandshake, Sprout } from 'lucide-react';
import { JobsBoard } from './JobsBoard';

/** Everything under Careers at a glance; each card opens its detail page. */
const CAREER_TRACKS = [
  { title: 'Jobs on Platform', text: 'Engineering, product, sales and operations roles across our hubs.', path: '/careers/jobs', icon: Briefcase },
  { title: 'Internships', text: 'Hands-on traineeships in ground operations and digital supply chain.', path: '/discover/internships', icon: Sprout },
  { title: 'Culture & Benefits', text: 'Health cover, fast-track growth and ownership in what we build.', path: '/careers/culture', icon: HeartHandshake },
  { title: 'Graduate Trainee Program', text: 'A 12-month rotation through India operations hubs.', path: '/careers/graduates', icon: GraduationCap },
];

export const CareersPage: React.FC = () => {

  return (
    <div className="w-full bg-[#F4F1EA] py-10 lg:py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        
        {/* Hero */}
        <div className="bg-[#171717] rounded-3xl text-white p-8 sm:p-12 relative overflow-hidden shadow-2xl border border-white/10">
          <div className="relative z-10 max-w-3xl space-y-4">
            <span className="text-xs font-mono uppercase tracking-widest text-[#FF4D16] font-bold">
              ● CAREERS AT CHASEHORSE
            </span>
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight">
              Build the Physical & Digital Backbone of Indian Logistics
            </h1>
            <p className="text-sm sm:text-base text-[#E2DED5]/90 leading-relaxed font-light">
              Join a team solving critical infrastructure challenges with software engineering, ground operational rigor, and human dignity.
            </p>
          </div>
        </div>

        {/* All career paths at a glance — click through for details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {CAREER_TRACKS.map(({ title, text, path, icon: Icon }) => (
            <Link key={path} to={path}
              className="group bg-white rounded-2xl border border-[#E2DED5] p-5 flex flex-col gap-3 hover:border-[#171717]/30 hover:shadow-md transition-all">
              <span className="w-10 h-10 rounded-xl bg-[#FFF0EB] text-[#FF4D16] flex items-center justify-center">
                <Icon className="w-5 h-5" />
              </span>
              <span className="font-bold text-[#171717] group-hover:text-[#FF4D16] transition-colors">{title}</span>
              <span className="text-xs text-[#625E58] leading-relaxed">{text}</span>
              <span className="mt-auto inline-flex items-center gap-1 text-xs font-bold text-[#FF4D16]">
                Read more <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </span>
            </Link>
          ))}
        </div>

        {/* Culture & Perks */}
        <CultureCards />

        <JobsBoard />

      </div>


    </div>
  );
};

/** Culture & benefits cards — shared by the Careers page and the Culture & Benefits page. */
export const CultureCards: React.FC = () => (
    <div id="culture" className="grid grid-cols-1 md:grid-cols-3 gap-6 scroll-mt-24">
      <div className="bg-white rounded-3xl border border-[#E2DED5] p-6 space-y-3 shadow-sm">
        <h3 className="font-bold text-base text-[#171717]">Comprehensive Healthcare</h3>
        <p className="text-xs text-[#625E58] leading-relaxed">
          Family health insurance, annual wellness checkups, and accidental coverage for every team member from dock lead to engineer.
        </p>
      </div>

      <div className="bg-white rounded-3xl border border-[#E2DED5] p-6 space-y-3 shadow-sm">
        <h3 className="font-bold text-base text-[#171717]">Stock Ownership (ESOPs)</h3>
        <p className="text-xs text-[#625E58] leading-relaxed">
          Meaningful equity grants across engineering, product, and regional operations leadership roles.
        </p>
      </div>

      <div className="bg-white rounded-3xl border border-[#E2DED5] p-6 space-y-3 shadow-sm">
        <h3 className="font-bold text-base text-[#171717]">Rapid Meritocracy</h3>
        <p className="text-xs text-[#625E58] leading-relaxed">
          Clear milestone-driven promotions. Over 40% of our zonal leadership began as on-ground dock leads.
        </p>
      </div>
    </div>
);
