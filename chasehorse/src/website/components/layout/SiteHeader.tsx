import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { MAIN_NAVIGATION } from '../../data/navigation';
import { NAV_DROPDOWNS, type NavCard, type NavCardLink, type NavSideGroup } from '../../data/navCards';
import { ChaseHorseLogo } from '../ui/ChaseHorseLogo';
import { useCart } from '../../hooks/useCart';
import { Search, ShoppingBag, Menu, X, ChevronDown, ArrowRight, MessageSquare } from 'lucide-react';

// Navbar items shown in the header, in order
const NAV_IDS = ['platform', 'solutions', 'live-market', 'discover', 'hse-shop', 'partners'];
const NAV_ITEMS = MAIN_NAVIGATION.filter((item) => NAV_IDS.includes(item.id));

const isExternal = (link: NavCardLink) => link.external || link.path.startsWith('http');

/** Internal routes use the router; external ones open in a new tab. */
const MenuLink: React.FC<{ link: NavCardLink; onNavigate: () => void; className: string; children?: React.ReactNode }> = ({
  link, onNavigate, className, children,
}) =>
  isExternal(link) ? (
    <a href={link.path} target="_blank" rel="noopener noreferrer" onClick={onNavigate} className={className}>
      {children ?? link.title}
    </a>
  ) : (
    <Link to={link.path} onClick={onNavigate} className={className}>
      {children ?? link.title}
    </Link>
  );

/** Tesla-style tile (text only): name, ~2-line description, "Learn more". The whole tile is one link. */
const MenuTile: React.FC<{ card: NavCard; onNavigate: () => void }> = ({ card, onNavigate }) => (
  <MenuLink link={card} onNavigate={onNavigate} className="group/tile flex flex-col items-center text-center px-3 py-4 rounded-xl hover:bg-[#F4F4F4] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#FF4D16]">
    <span className="text-[15px] font-semibold text-[#171A20] leading-snug">{card.title}</span>
    <span className="mt-1 text-[12.5px] leading-[1.45] text-[#5C5E62]" data-desc>{card.description}</span>
    <span className="mt-1.5 text-[12.5px] font-medium text-[#393C41] underline underline-offset-4 decoration-[#C9C9C9] group-hover/tile:decoration-[#171A20]">
      Learn more
    </span>
  </MenuLink>
);

/** The plain text-link column on the right of a dropdown (secondary / folded-in pages). */
const SideLinks: React.FC<{ groups: NavSideGroup[]; onNavigate: () => void }> = ({ groups, onNavigate }) => (
  <div className="space-y-6">
    {groups.map((group, i) => (
      <div key={group.title ?? i}>
        {group.title && <p className="mb-2.5 text-[12px] font-semibold uppercase tracking-wider text-[#8C8C8C]">{group.title}</p>}
        <ul className="space-y-2.5">
          {group.links.map((link) => (
            <li key={link.path + link.title}>
              <MenuLink link={link} onNavigate={onNavigate}
                className="text-[14px] font-medium text-[#171A20] hover:underline underline-offset-4" />
            </li>
          ))}
        </ul>
      </div>
    ))}
  </div>
);

/** Mobile row: name and description. */
const MobileTile: React.FC<{ card: NavCard; onNavigate: () => void }> = ({ card, onNavigate }) => (
  <MenuLink link={card} onNavigate={onNavigate} className="flex items-center gap-3 p-2 rounded-xl hover:bg-[#F4F4F4]">
    <span className="min-w-0">
      <span className="flex items-center gap-1 text-[14px] font-semibold text-[#171A20]">
        {card.title} <ArrowRight className="w-3.5 h-3.5 text-[#8C8C8C]" />
      </span>
      <span className="block text-[12px] leading-snug text-[#5C5E62] line-clamp-2">{card.description}</span>
    </span>
  </MenuLink>
);

/** Every dropdown is a single horizontal row of tiles. */
const tileColumns = (n: number) => Math.max(n, 1);

export const SiteHeader: React.FC<{ onOpenSearch?: () => void }> = ({ onOpenSearch }) => {
  const [openId, setOpenId] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileExpanded, setMobileExpanded] = useState<string | null>(null);
  const headerRef = useRef<HTMLElement>(null);
  const location = useLocation();
  const { itemCount, setIsCartOpen } = useCart();

  const closeTimer = useRef<number | null>(null);

  const cancelClose = () => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  // Hover: open immediately, close after a short grace period so the cursor
  // can travel from the nav item down into the dropdown without it flickering shut.
  const hoverOpen = (id: string) => {
    cancelClose();
    setOpenId(id);
  };
  const hoverClose = () => {
    cancelClose();
    closeTimer.current = window.setTimeout(() => setOpenId(null), 150);
  };

  useEffect(() => cancelClose, []);

  const closeAll = () => {
    cancelClose();
    setOpenId(null);
    setMobileOpen(false);
    setMobileExpanded(null);
  };

  // Close on route change
  useEffect(() => {
    closeAll();
  }, [location.pathname, location.search, location.hash]);

  // Close on outside click and on Escape
  useEffect(() => {
    if (!openId && !mobileOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) closeAll();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeAll();
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [openId, mobileOpen]);

  const openItem = NAV_ITEMS.find((item) => item.id === openId);
  const dropdown = openItem ? NAV_DROPDOWNS[openItem.id] : undefined;
  const cards = dropdown?.cards ?? [];

  return (
    <header ref={headerRef} onMouseLeave={hoverClose} className="sticky top-0 z-40 w-full bg-white">
      <div className="relative z-20 bg-white">
        <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-12">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="shrink-0" aria-label="Chasehorse home">
              <ChaseHorseLogo variant="dark" showTagline={false} className="w-36 sm:w-40 h-auto" />
            </Link>

            {/* Desktop navigation — centred, opens on hover (click/keyboard also work) */}
            <nav className="hidden lg:flex absolute left-1/2 -translate-x-1/2 items-center gap-1" aria-label="Main">
              {NAV_ITEMS.map((item) => {
                const isOpen = openId === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls="site-nav-dropdown"
                    onMouseEnter={() => hoverOpen(item.id)}
                    onFocus={() => hoverOpen(item.id)}
                    onClick={() => hoverOpen(item.id)}
                    className={`px-4 py-1.5 rounded text-sm font-semibold text-[#171A20] transition-colors ${
                      isOpen ? 'bg-[#F4F4F4]' : 'hover:bg-[#F4F4F4]'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </nav>

            {/* Right actions */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={onOpenSearch}
                className="p-2 rounded text-[#171A20] hover:bg-[#F4F4F4] transition-colors"
                title="Search (Ctrl+K)"
                aria-label="Search"
              >
                <Search className="w-5 h-5" strokeWidth={1.75} />
              </button>

              <button
                type="button"
                onClick={() => setIsCartOpen(true)}
                className="relative p-2 rounded text-[#171A20] hover:bg-[#F4F4F4] transition-colors"
                title="View Cart"
                aria-label="View Cart"
              >
                <ShoppingBag className="w-5 h-5" strokeWidth={1.75} />
                {itemCount > 0 && (
                  <span className="absolute top-0.5 right-0.5 flex items-center justify-center min-w-4 h-4 px-1 text-[10px] font-bold text-white bg-[#FF4D16] rounded-full">
                    {itemCount}
                  </span>
                )}
              </button>

              {/* Login — opens the app's existing sign-in page (Supabase), same tab */}
              <Link
                to="/login"
                className="hidden sm:inline-flex px-4 py-1.5 rounded text-sm font-semibold text-[#171A20] hover:bg-[#F4F4F4] transition-colors"
                title="Sign in to the ChaseHorse portal"
              >
                Login
              </Link>

              {/* Mobile / tablet menu toggle */}
              <button
                type="button"
                onClick={() => {
                  setMobileOpen(!mobileOpen);
                  setMobileExpanded(null);
                }}
                className="lg:hidden ml-1 px-3 py-1.5 rounded text-sm font-medium text-[#171A20] bg-[#F4F4F4] hover:bg-[#EAEAEA] transition-colors inline-flex items-center gap-1.5"
                aria-expanded={mobileOpen}
                aria-label="Toggle navigation menu"
              >
                {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
                <span>Menu</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ================= DESKTOP DROPDOWN ================= */}
      {openItem && (
        <>
          <div
            id="site-nav-dropdown"
            onMouseEnter={cancelClose}
            className="hidden lg:block absolute z-20 left-0 right-0 top-full bg-white shadow-[0_24px_40px_-24px_rgba(0,0,0,0.25)] border-b border-[#E5E5E5]"
          >
            {/* Tesla-style: text tiles on the left, a plain link column on the right (if present) */}
            <div className="mx-auto max-w-[1400px] px-8 pt-5 pb-7 flex flex-col items-center">
              <div className="flex justify-center items-start gap-10 w-full">
                <div
                  className="grid gap-x-2 gap-y-2"
                  style={{ gridTemplateColumns: `repeat(${tileColumns(cards.length)}, minmax(0, ${cards.length > 4 ? 182 : 300}px))` }}
                >
                  {cards.map((card) => (
                    <MenuTile key={card.path + card.title} card={card} onNavigate={closeAll} />
                  ))}
                </div>
                {dropdown?.side && (
                  <div className="self-stretch border-l border-[#E5E5E5] pl-12 pt-1 min-w-[200px]">
                    <SideLinks groups={dropdown.side} onNavigate={closeAll} />
                  </div>
                )}
              </div>

              {/* Optional footer actions (e.g. Join Partner WhatsApp Desk, Contact Us) */}
              {dropdown?.footerActions && dropdown.footerActions.length > 0 && (
                <div className="mt-5 pt-4 border-t border-[#EAE6DD] flex items-center justify-center gap-3 w-full">
                  {dropdown.footerActions.map((action) => {
                    const isWa = action.variant === 'whatsapp';
                    const isExt = action.path.startsWith('http');
                    const btnClass = isWa
                      ? 'inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#25D366] hover:bg-[#1EBE5D] transition-all shadow-sm'
                      : 'inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-[#171717] bg-[#FAF8F5] hover:bg-white border border-[#E2DED5] hover:border-[#171717] transition-all';
                    return isExt ? (
                      <a
                        key={action.title}
                        href={action.path}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={closeAll}
                        className={btnClass}
                      >
                        {isWa && <MessageSquare className="w-3.5 h-3.5" />}
                        <span>{action.title}</span>
                      </a>
                    ) : (
                      <Link
                        key={action.title}
                        to={action.path}
                        onClick={closeAll}
                        className={btnClass}
                      >
                        <span>{action.title}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Page dimmer — clicking it closes the dropdown */}
          <div
            aria-hidden
            onClick={closeAll}
            onMouseEnter={hoverClose}
            className="hidden lg:block fixed inset-0 top-16 z-10 bg-black/10 backdrop-blur-[2px]"
          />
        </>
      )}

      {/* ================= MOBILE / TABLET MENU ================= */}
      {mobileOpen && (
        <div className="lg:hidden absolute z-20 left-0 right-0 top-full bg-white border-t border-[#EEEEEE] max-h-[calc(100vh-4rem)] overflow-y-auto">
          <ul className="px-4 sm:px-6 py-3">
            {NAV_ITEMS.map((item) => {
              const expanded = mobileExpanded === item.id;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    aria-expanded={expanded}
                    onClick={() => setMobileExpanded(expanded ? null : item.id)}
                    className={`w-full flex items-center justify-between px-3 py-3 rounded text-[15px] font-medium text-[#171A20] ${
                      expanded ? 'bg-[#F4F4F4]' : 'hover:bg-[#F4F4F4]'
                    }`}
                  >
                    <span>{item.label}</span>
                    <ChevronDown className={`w-4 h-4 text-[#5C5E62] ${expanded ? 'rotate-180' : ''}`} />
                  </button>

                  {expanded && (
                    <div className="px-1 pt-2 pb-4 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                        {(NAV_DROPDOWNS[item.id]?.cards ?? []).map((card) => (
                          <MobileTile key={card.path + card.title} card={card} onNavigate={closeAll} />
                        ))}
                      </div>
                      {NAV_DROPDOWNS[item.id]?.side && (
                        <div className="px-2 pt-3 border-t border-[#EEEEEE]">
                          <SideLinks groups={NAV_DROPDOWNS[item.id].side!} onNavigate={closeAll} />
                        </div>
                      )}
                      {NAV_DROPDOWNS[item.id]?.footerActions && (
                        <div className="flex flex-wrap gap-2 pt-3 border-t border-[#EEEEEE]">
                          {NAV_DROPDOWNS[item.id].footerActions!.map((action) => {
                            const isWa = action.variant === 'whatsapp';
                            const isExt = action.path.startsWith('http');
                            const btnClass = isWa
                              ? 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-[#25D366]'
                              : 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-[#171717] bg-[#FAF8F5] border border-[#E2DED5]';
                            return isExt ? (
                              <a
                                key={action.title}
                                href={action.path}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={closeAll}
                                className={btnClass}
                              >
                                {isWa && <MessageSquare className="w-3.5 h-3.5" />}
                                <span>{action.title}</span>
                              </a>
                            ) : (
                              <Link
                                key={action.title}
                                to={action.path}
                                onClick={closeAll}
                                className={btnClass}
                              >
                                <span>{action.title}</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}

            <li className="sm:hidden">
              <Link
                to="/login"
                onClick={closeAll}
                className="block px-3 py-3 rounded text-[15px] font-medium text-[#171A20] hover:bg-[#F4F4F4]"
              >
                Login
              </Link>
            </li>
          </ul>
        </div>
      )}
      {mobileOpen && (
        <div aria-hidden onClick={closeAll} className="lg:hidden fixed inset-0 top-16 z-10 bg-black/10 backdrop-blur-[2px]" />
      )}
    </header>
  );
};
