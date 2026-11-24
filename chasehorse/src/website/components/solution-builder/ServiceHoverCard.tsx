import React from 'react';
import { FloatingPortal } from '@floating-ui/react';
import { motion, useReducedMotion } from 'framer-motion';
import { CheckCircle2, PlusCircle } from 'lucide-react';
import { Service } from './types';

interface ServiceHoverCardProps {
  service: Service | null;
  isOpen: boolean;
  isSelected: boolean;
  floatingRef: (node: HTMLElement | null) => void;
  floatingStyles: React.CSSProperties;
  placement?: string;
  middlewareData?: {
    arrow?: {
      x?: number;
      y?: number;
    };
  };
  arrowRef?: React.RefObject<HTMLDivElement>;
  getFloatingProps: (userProps?: React.HTMLProps<HTMLElement>) => Record<string, unknown>;
  onClose: () => void;
  onToggleSelect: (serviceId: string) => void;
  theme?: string;
}

export const ServiceHoverCard: React.FC<ServiceHoverCardProps> = ({
  service,
  isOpen,
  isSelected,
  floatingRef,
  floatingStyles,
  placement = 'right',
  getFloatingProps,
  onToggleSelect,
  theme = 'classic',
}) => {
  const shouldReduceMotion = useReducedMotion();

  if (!isOpen || !service) return null;

  const basePlacement = placement.split('-')[0];
  const transformOriginMap: Record<string, string> = {
    top: 'bottom center',
    bottom: 'top center',
    left: 'right center',
    right: 'left center',
  };
  const transformOrigin = transformOriginMap[basePlacement] || 'center center';

  return (
    <FloatingPortal>
      <div
        ref={floatingRef}
        data-theme={theme}
        className="ch-site sb-scope"
        style={{
          ...floatingStyles,
          zIndex: 9999,
          pointerEvents: 'auto',
          boxSizing: 'border-box',
        }}
        {...getFloatingProps()}
      >
        <motion.div
          id={`service-hover-card-${service.id}`}
          role="tooltip"
          aria-label={`${service.name} details`}
          initial={
            shouldReduceMotion
              ? { opacity: 0 }
              : { opacity: 0, scale: 0.96 }
          }
          animate={
            shouldReduceMotion
              ? { opacity: 1 }
              : { opacity: 1, scale: 1 }
          }
          exit={
            shouldReduceMotion
              ? { opacity: 0 }
              : { opacity: 0, scale: 0.96 }
          }
          transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
          style={{
            transformOrigin,
            backgroundColor: '#ffffff',
            borderColor: '#eae6dd',
            color: '#171717',
            borderRadius: '28px',
            overflow: 'hidden',
            boxShadow: '0 20px 48px -10px rgba(0, 0, 0, 0.14), 0 4px 16px rgba(0, 0, 0, 0.05)',
            boxSizing: 'border-box',
          }}
          className="relative w-[320px] sm:w-[350px] rounded-[28px] border border-[#eae6dd] px-6 py-5 bg-white overflow-hidden"
        >
          {/* Header Tag: TIER · GROUP */}
          <div className="flex items-center gap-2">
            <span
              className="text-[11px] font-mono font-bold tracking-wider uppercase px-2 py-0.5 rounded-[5px]"
              style={{
                backgroundColor: '#fff0eb',
                color: '#ff4d16',
                display: 'inline-block',
                lineHeight: '1.4',
              }}
            >
              {service.tier}
            </span>
            <span className="text-[10px] font-mono text-[#A8A29A]">•</span>
            <span
              className="text-[11px] font-mono font-bold tracking-[0.14em] uppercase truncate text-[#71717a]"
            >
              {service.group}
            </span>
          </div>

          {/* Service Name */}
          <h4
            className="text-[20px] font-bold text-[#171717] tracking-tight leading-tight mt-3 mb-2"
          >
            {service.name}
          </h4>

          {/* Description */}
          <p
            className="text-[13.5px] text-[#52525b] leading-[1.65] mb-5 font-normal"
          >
            {service.description}
          </p>

          {/* Footer Interactive Row */}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggleSelect(service.id);
            }}
            className="w-full pt-3.5 flex items-center justify-between outline-none cursor-pointer group"
            style={{
              borderTop: '1px solid #eae6dd',
              borderLeft: 'none',
              borderRight: 'none',
              borderBottom: 'none',
              backgroundColor: 'transparent',
              paddingLeft: 0,
              paddingRight: 0,
              paddingBottom: 0,
              margin: 0,
              appearance: 'none',
              WebkitAppearance: 'none',
            }}
          >
            <span className="flex items-center gap-2">
              {isSelected ? (
                <>
                  <CheckCircle2 className="w-[18px] h-[18px] text-emerald-600 shrink-0" />
                  <span className="font-bold text-[13.5px] text-emerald-600">✓ Added to solution</span>
                </>
              ) : (
                <>
                  <PlusCircle
                    className="w-[18px] h-[18px] text-[#ff4d16] shrink-0 transition-transform group-hover:scale-110"
                    strokeWidth={2}
                  />
                  <span className="font-bold text-[13.5px] text-[#171717] group-hover:text-[#ff4d16] transition-colors">
                    Click row to add
                  </span>
                </>
              )}
            </span>
            <span
              className="text-[11px] font-mono font-bold tracking-[0.16em] uppercase underline underline-offset-4 decoration-[#a8a29a] text-[#71717a] group-hover:decoration-[#171717] transition-all"
            >
              {isSelected ? 'Remove' : 'Select'}
            </span>
          </button>
        </motion.div>
      </div>
    </FloatingPortal>
  );
};
