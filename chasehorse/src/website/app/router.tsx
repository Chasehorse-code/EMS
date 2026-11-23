import React, { lazy, useEffect } from 'react';
import { Route, useLocation } from 'react-router-dom';

/*
 * Public website routes. They are mounted inside the main app's <Routes>
 * (see src/App.tsx) under the lazily loaded WebsiteLayout.
 * Sign-in is NOT part of the website: its "Login" links go to the app's
 * existing /login page, which signs in with Supabase and opens the portals.
 */

// Lazy-load a named page export so the website ships as its own bundle.
function page<K extends string>(load: () => Promise<Record<K, React.ComponentType<any>>>, name: K) {
  return lazy(() => load().then((m) => ({ default: m[name] })));
}

const HomePage = page(() => import('../features/home/HomePage'), 'HomePage');
const PlatformPage = page(() => import('../features/platform/PlatformPage'), 'PlatformPage');
const PlatformTopicPage = page(() => import('../features/platform/PlatformTopicPage'), 'PlatformTopicPage');
const SolutionsPage = page(() => import('../features/solutions/SolutionsPage'), 'SolutionsPage');
const TierDetailPage = page(() => import('../features/solutions/TierDetailPage'), 'TierDetailPage');
const SolutionsTopicPage = page(() => import('../features/solutions/SolutionsTopicPage'), 'SolutionsTopicPage');
const ServiceDetailPage = page(() => import('../features/services/ServiceDetailPage'), 'ServiceDetailPage');
const DesignSolutionPage = page(() => import('../features/design-solution/DesignSolutionPage'), 'DesignSolutionPage');
const LiveMarketOverviewPage = page(() => import('../features/live-market/LiveMarketOverviewPage'), 'LiveMarketOverviewPage');
const BookTruckPage = page(() => import('../features/live-market/BookTruckPage'), 'BookTruckPage');
const TerminalSpacePage = page(() => import('../features/live-market/TerminalSpacePage'), 'TerminalSpacePage');
const DeployLeadPage = page(() => import('../features/live-market/DeployLeadPage'), 'DeployLeadPage');
const TripFinancePage = page(() => import('../features/live-market/TripFinancePage'), 'TripFinancePage');
const FreightIndexPage = page(() => import('../features/live-market/FreightIndexPage'), 'FreightIndexPage');
const DiscoverPage = page(() => import('../features/discover/DiscoverPage'), 'DiscoverPage');
const LocationsPage = page(() => import('../features/discover/LocationsPage'), 'LocationsPage');
const HseShopPage = page(() => import('../features/hse-shop/HseShopPage'), 'HseShopPage');
const ProductDetailPage = page(() => import('../features/hse-shop/ProductDetailPage'), 'ProductDetailPage');
const OnsiteStorePage = page(() => import('../features/hse-shop/OnsiteStorePage'), 'OnsiteStorePage');
const RequestCallbackPage = page(() => import('../features/hse-shop/RequestCallbackPage'), 'RequestCallbackPage');
const PartnersPage = page(() => import('../features/partners/PartnersPage'), 'PartnersPage');
const PartnersTopicPage = page(() => import('../features/partners/PartnersTopicPage'), 'PartnersTopicPage');
const PartnerApplyPage = page(() => import('../features/partners/PartnerApplyPage'), 'PartnerApplyPage');
const CareersPage = page(() => import('../features/careers/CareersPage'), 'CareersPage');
const CareersTopicPage = page(() => import('../features/careers/CareersTopicPage'), 'CareersTopicPage');
const ContactPage = page(() => import('../features/home/ContactPage'), 'ContactPage');

// Scroll to top on route change
export const ScrollToTop: React.FC = () => {
  const { pathname, search, hash } = useLocation();

  useEffect(() => {
    if (hash) {
      const element = document.getElementById(hash.replace('#', ''));
      if (element) {
        element.scrollIntoView({ behavior: 'instant' as ScrollBehavior });
        return;
      }
    }
    // Jump straight to the top of the new page — no sliding scroll animation
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
  }, [pathname, search, hash]);

  return null;
};

// Returned as a fragment of <Route>s so it can sit directly inside the app's <Routes>.
export const websiteRoutes = (
  <>
    {/* Homepage */}
    <Route path="/" element={<HomePage />} />

    {/* Platform (GELP) */}
    <Route path="/platform" element={<PlatformPage />} />
    <Route path="/platform/:topicSlug" element={<PlatformTopicPage />} />

    {/* Solutions & Tiers */}
    <Route path="/solutions" element={<SolutionsPage />} />
    <Route path="/solutions/sectors" element={<SolutionsTopicPage topic="sectors" />} />
    <Route path="/solutions/industries" element={<SolutionsTopicPage topic="industries" />} />
    <Route path="/solutions/ecosystem" element={<SolutionsTopicPage topic="ecosystem" />} />
    <Route path="/solutions/:tierId" element={<TierDetailPage />} />

    {/* Dedicated Individual Service Detail Pages & Sub-services */}
    <Route path="/services/:serviceSlug" element={<ServiceDetailPage />} />
    <Route path="/services/:serviceSlug/:subserviceSlug" element={<ServiceDetailPage />} />

    {/* Design Your Solution (DIY) */}
    <Route path="/design-your-solution" element={<DesignSolutionPage />} />

    {/* Live Market */}
    <Route path="/live-market" element={<LiveMarketOverviewPage />} />
    <Route path="/live-market/book-truck" element={<BookTruckPage />} />
    <Route path="/live-market/terminal-space" element={<TerminalSpacePage />} />
    <Route path="/live-market/on-field-lead" element={<DeployLeadPage />} />
    <Route path="/live-market/trip-finance" element={<TripFinancePage />} />
    <Route path="/live-market/freight-index" element={<FreightIndexPage />} />

    {/* Discover & Sub-pages */}
    <Route path="/discover" element={<DiscoverPage />} />
    <Route path="/discover/:subTab" element={<DiscoverPage />} />
    <Route path="/locations" element={<LocationsPage />} />

    {/* HSE Shop & Sub-pages */}
    <Route path="/hse-shop" element={<HseShopPage />} />
    <Route path="/hse-shop/shop" element={<HseShopPage />} />
    <Route path="/hse-shop/products/:productSlug" element={<ProductDetailPage />} />
    <Route path="/hse-shop/cart" element={<HseShopPage />} />
    <Route path="/hse-shop/checkout" element={<HseShopPage />} />
    <Route path="/hse-shop/order-confirmation" element={<HseShopPage />} />
    <Route path="/hse-shop/track-order" element={<HseShopPage />} />
    <Route path="/hse-shop/request-onsite-store" element={<OnsiteStorePage />} />
    <Route path="/hse-shop/request-callback" element={<RequestCallbackPage />} />
    <Route path="/hse-shop/offline-stores" element={<LocationsPage />} />

    {/* Partners & Careers */}
    <Route path="/partners" element={<PartnersPage />} />
    <Route path="/partners/apply" element={<PartnerApplyPage />} />
    <Route path="/partners/on-field" element={<PartnersTopicPage topic="on-field" />} />
    <Route path="/partners/transportation" element={<PartnersTopicPage topic="transportation" />} />
    <Route path="/partners/terminal-space" element={<PartnersTopicPage topic="terminal-space" />} />
    <Route path="/careers" element={<CareersPage />} />
    <Route path="/careers/jobs" element={<CareersTopicPage topic="jobs" />} />
    <Route path="/careers/on-field" element={<CareersTopicPage topic="on-field" />} />
    <Route path="/careers/transportation" element={<CareersTopicPage topic="transportation" />} />
    <Route path="/careers/culture" element={<CareersTopicPage topic="culture" />} />
    <Route path="/careers/graduates" element={<CareersTopicPage topic="graduates" />} />
    <Route path="/careers/:jobSlug" element={<CareersPage />} />

    {/* Contact Us */}
    <Route path="/contact" element={<ContactPage />} />
  </>
);
