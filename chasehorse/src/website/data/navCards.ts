/**
 * Navbar dropdowns, laid out like Tesla's menu: a row (or grid) of text tiles on the left —
 * name, ~2-line description, "Learn more".
 *
 * Secondary and folded-in links are prominently hosted on their dedicated pages
 * (e.g. /live-market, /careers, /hse-shop, /partners) for maximum visibility.
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

export interface NavDropdownAction {
  title: string;
  path: string;
  variant?: 'primary' | 'secondary' | 'whatsapp';
}

export interface NavDropdown {
  cards: NavCard[];
  /** Optional plain text-link column on the right. */
  side?: NavSideGroup[];
  /** Optional quick actions shown below the card grid. */
  footerActions?: NavDropdownAction[];
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
  },

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
      {
        title: 'Partner Application Form',
        description: 'Complete our fast-track onboarding form to register your fleet or capabilities.',
        path: '/partners/apply',
      },
    ],
    footerActions: [
      {
        title: 'Join Partner WhatsApp Desk',
        path: 'https://wa.me/917337369111?text=Hi%20Chasehorse%2C%20I%20want%20to%20join%20the%20Partner%20Network',
        variant: 'whatsapp',
      },
      {
        title: 'Contact Us',
        path: '/contact',
        variant: 'secondary',
      },
    ],
  },
};
