import React, { Suspense, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { CartProvider } from './hooks/useCart';
import { LogoIntro } from './components/layout/LogoIntro';
import { SiteHeader } from './components/layout/SiteHeader';
import { SiteFooter } from './components/layout/SiteFooter';
import { CartDrawer } from './components/shop/CartDrawer';
import { SearchModal } from './components/layout/SearchModal';
import { ScrollToTop } from './app/router';
import './styles/index.css';

/**
 * Shell for the public website (header, footer, cart, search).
 * The `.ch-site` wrapper is the scope for all of the website's Tailwind styles.
 */
export const WebsiteLayout: React.FC = () => {
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <div className="ch-site">
      <CartProvider>
        <ScrollToTop />

        {/* Animated Brand Logo Intro (One-time per session) */}
        <LogoIntro />

        {/* Global Search Dialog (Ctrl+K) */}
        <SearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />

        {/* Slide-out Cart Drawer */}
        <CartDrawer />

        <div className="min-h-screen flex flex-col bg-[#F4F1EA] text-[#171717] antialiased selection:bg-[#FF4D16] selection:text-white">
          {/* Sticky Navigation Bar with Mega Menus */}
          <SiteHeader onOpenSearch={() => setSearchOpen(true)} />

          <div className="flex-1">
            <Suspense fallback={<div className="min-h-[60vh]" />}>
              <Outlet />
            </Suspense>
          </div>

          {/* Enterprise Global Footer */}
          <SiteFooter />
        </div>
      </CartProvider>
    </div>
  );
};

export default WebsiteLayout;
