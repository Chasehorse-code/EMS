/**
 * Navbar dropdowns, laid out like Tesla's menu: a row (or grid) of text tiles on the left —
 * name, ~2-line description, "Learn more" — and a plain column of secondary text links
 * on the right for the pages folded inside a section.
 *
 * Only the menu is trimmed here — every page still exists, and sub-page sidebars keep listing the
 * full set of pages from `MAIN_NAVIGATION[].megaMenu.sections` (data/navigation.ts).
 */

export interface NavCardLink {
  title: string;
  path: string;
  external?: boolean;
}

export interface NavCard {
  title: string;
  description: string;
  path: string;
}

export interface NavSideGroup {
  /** Small heading above the links; omit for a plain list. */
  title?: string;
  links: NavCardLink[];
}

export interface NavDropdown {
  cards: NavCard[];
  /** The plain text-link column on the right (Tesla-style). */
  side?: NavSideGroup[];
}


export const NAV_DROPDOWNS: Record<string, NavDropdown> = {
  platform: {
    cards: [
      {
        title: 'What is GELP',
        description: 'Growth Enabling Logiworkx Platform: vetted talent, tech and finance as one system.',
        path: '/platform/what-is-gelp',
      },
      {
        title: 'Design Your Solution',
        description: 'Pick Tier 1–3 services, build your blueprint and get a tailored plan.',
        path: '/design-your-solution',
      },
    ],
  },

  solutions: {
    cards: [
      {
        title: 'Sectors',
        description: 'Shippers, 3PLs, retailers and freight operators — built around how each runs.',
        path: '/solutions/sectors',
      },
      {
        title: 'Industries',
        description: 'Automotive, FMCG, pharma and heavy machinery playbooks, executed on ground.',
        path: '/solutions/industries',
      },
      {
        title: 'Partner Ecosystem',
        description: 'Integrations, carriers and service partners that plug into your operations.',
        path: '/solutions/ecosystem',
      },
    ],
  },

  'live-market': {
    cards: [
      {
        title: 'Book Truck Now',
        description: 'Instant FTL and part-load trucks, plus secure terminal space for your fleet.',
        path: '/live-market/book-truck',
      },
      {
        title: 'Deploy On-Field Lead',
        description: 'Vetted operational leads and supervisors dispatched to your dock or site.',
        path: '/live-market/on-field-lead',
      },
      {
        title: 'Today Freight Index',
        description: 'Live ₹/km lane rates across India, and working capital for your trips.',
        path: '/live-market/freight-index',
      },
    ],
    side: [
      {
        links: [
          { title: 'Infrapartner — truck terminal space', path: '/live-market/terminal-space' },
          { title: 'Secure Trip Finance', path: '/live-market/trip-finance' },
          { title: 'All Live Market services', path: '/live-market' },
        ],
      },
    ],
  },

  discover: {
    cards: [
      {
        title: 'India Logistics Network',
        description: 'Hubs, locations and routes across India.',
        path: '/discover/network',
      },
      {
        title: 'Customer Stories',
        description: 'Case studies and impact delivered on ground.',
        path: '/discover/stories',
      },
      {
        title: 'Find Us',
        description: 'Our hubs and offices on the India map.',
        path: '/locations',
      },
      {
        title: 'About Us',
        description: 'Our story, mission and the people behind it.',
        path: '/discover/about',
      },
      {
        title: 'Contact Us',
        description: 'Talk to our team — we reply within a day.',
        path: '/contact',
      },
      {
        title: 'Careers',
        description: 'Build the backbone of Indian logistics with us.',
        path: '/careers',
      },
    ],
    side: [
      {
        title: 'Careers',
        links: [
          { title: 'Jobs on Platform', path: '/careers/jobs' },
          { title: 'Internships', path: '/discover/internships' },
          { title: 'Culture & Benefits', path: '/careers/culture' },
          { title: 'Graduate Trainee Program', path: '/careers/graduates' },
        ],
      },
    ],
  },

  'hse-shop': {
    cards: [
      {
        title: 'Online Store',
        description: 'Certified PPE, lashing gear and safety apparel, delivered to your sites.',
        path: '/hse-shop',
      },
      {
        title: 'Find Offline Store',
        description: 'HSE depots near your hubs — or a managed store run inside your own facility.',
        path: '/hse-shop/offline-stores',
      },
    ],
    side: [
      {
        links: [
          { title: 'Request on-site store', path: '/hse-shop/request-onsite-store' },
          { title: 'Request a callback', path: '/hse-shop/request-callback' },
        ],
      },
    ],
  },

  // Reference layout: "Join us" tiles, with the roles each partner type covers in the side column.
  partners: {
    cards: [
      {
        title: 'On-field professionals',
        description: 'Join us — supervisors, auditors and dock leads in our vetted on-ground network.',
        path: '/partners/on-field',
      },
      {
        title: 'Transportation professionals',
        description: 'Join us — steady freight, verified clients and quick payments for your fleet.',
        path: '/partners/transportation',
      },
      {
        title: 'Truck terminal space',
        description: 'Join us — list your yard, warehouse bay or secure truck parking.',
        path: '/partners/terminal-space',
      },
    ],
    side: [
      {
        title: 'Transportation',
        links: [
          { title: 'Transporters', path: '/partners/transportation' },
          { title: 'Fleet owners', path: '/partners/transportation' },
          { title: 'Drivers', path: '/partners/transportation' },
          { title: 'Freight traders', path: '/partners/transportation' },
          { title: 'Freight financials', path: '/partners/transportation' },
        ],
      },
      { links: [{ title: 'Partner application form', path: '/partners/apply' }] },
    ],
  },
};
