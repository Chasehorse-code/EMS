import type { PartnerType } from '@chasehorse/domain';

export interface FormFieldConfig {
  name: string;
  label: string;
  type: 'text' | 'email' | 'tel' | 'number' | 'masked' | 'select' | 'checkbox-group' | 'textarea';
  required?: boolean;
  placeholder?: string;
  options?: Array<{ label: string; value: string }>;
  helperText?: string;
  defaultValue?: string | number | string[];
}

export interface PartnerFormConfig {
  type: PartnerType;
  title: string;
  category: string;
  badge: string;
  description: string;
  googleFormUrl?: string;
  fields: FormFieldConfig[];
}

export const PARTNER_FORM_CONFIGS: Record<PartnerType, PartnerFormConfig> = {
  onfield_professional: {
    type: 'onfield_professional',
    title: 'On-Field Logistics Professional Registration',
    category: 'Field Operations',
    badge: 'On-Field',
    description: 'Join the ChaseHorse on-field logistics network. Audit retail shelves, inspect transport hubs, and verify shipments with real-time GPS rewards.',
    googleFormUrl: 'https://forms.gle/ArkdU5CZbxvWgZJAA',
    fields: [
      { name: 'fullName', label: 'Full Name', type: 'text', required: true, placeholder: 'e.g. Rahul Sharma' },
      { name: 'phone', label: 'Mobile Number', type: 'tel', required: true, placeholder: '10-digit Indian mobile (e.g. 9876543210)' },
      { name: 'email', label: 'Email Address', type: 'email', required: true, placeholder: 'you@example.com' },
      { name: 'location', label: 'Primary City / District', type: 'text', required: true, placeholder: 'e.g. Hyderabad, Telangana' },
      {
        name: 'experienceYears',
        label: 'Field Experience',
        type: 'select',
        required: true,
        options: [
          { label: 'Less than 1 year', value: '0-1' },
          { label: '1 - 3 years', value: '1-3' },
          { label: '3 - 5 years', value: '3-5' },
          { label: '5+ years', value: '5+' },
        ],
      },
      {
        name: 'expertise',
        label: 'Primary Field Expertise',
        type: 'select',
        required: true,
        options: [
          { label: 'Retail & FMCG Shelf Audits', value: 'retail_audit' },
          { label: 'Warehouse & Cargo Verification', value: 'warehouse_check' },
          { label: 'GPS Photo Inspections', value: 'gps_inspection' },
          { label: 'Last-Mile Delivery Verification', value: 'delivery_proof' },
          { label: 'General Field Logistics', value: 'general' },
        ],
      },
      { name: 'notes', label: 'Additional Qualifications / Tools (Optional)', type: 'textarea', placeholder: 'Any smartphones, transport, or local area expertise you bring' },
    ],
  },

  transporter: {
    type: 'transporter',
    title: 'Transporter Registration',
    category: 'Transportation',
    badge: 'Transporter',
    description: 'Connect your transport business with high-volume enterprise logistics corridors across India.',
    fields: [
      { name: 'companyName', label: 'Company Name', type: 'text', required: true, placeholder: 'e.g. Jai Hind Logistics Pvt Ltd' },
      { name: 'contactPerson', label: 'Contact Person Name', type: 'text', required: true, placeholder: 'e.g. Manoj Varma' },
      { name: 'phone', label: 'Primary Phone', type: 'tel', required: true, placeholder: '10-digit mobile number' },
      { name: 'email', label: 'Business Email', type: 'email', required: true, placeholder: 'operations@transporter.in' },
      {
        name: 'gstNumber',
        label: 'GSTIN Number',
        type: 'masked',
        required: true,
        placeholder: '15-character GSTIN (e.g. 36AAAAA0000A1Z5)',
        helperText: 'Masked for security. Verified only by authorized ChaseHorse operations managers.',
      },
      { name: 'fleetSize', label: 'Active Fleet Size', type: 'number', required: true, placeholder: 'Number of active commercial vehicles (e.g. 15)' },
    ],
  },

  fleet_owner: {
    type: 'fleet_owner',
    title: 'Fleet Owner Registration',
    category: 'Transportation',
    badge: 'Fleet Owner',
    description: 'Maximize vehicle utilization with guaranteed backhauls, fuel discounts, and automated tracking.',
    fields: [
      { name: 'companyName', label: 'Fleet / Company Name', type: 'text', required: true, placeholder: 'e.g. Premier Roadlines' },
      { name: 'contactPerson', label: 'Contact Person Name', type: 'text', required: true, placeholder: 'e.g. Suresh Patel' },
      { name: 'phone', label: 'Phone Number', type: 'tel', required: true, placeholder: '10-digit mobile number' },
      { name: 'email', label: 'Email Address', type: 'email', required: true, placeholder: 'fleet@company.com' },
      {
        name: 'gstNumber',
        label: 'GSTIN Number',
        type: 'masked',
        required: true,
        placeholder: '15-character GSTIN',
        helperText: 'Masked for confidentiality.',
      },
      { name: 'fleetSize', label: 'Total Fleet Size', type: 'number', required: true, placeholder: 'e.g. 25' },
      { name: 'numberOfVehicles', label: 'Number of Heavy Commercial Vehicles (HCV)', type: 'number', required: true, placeholder: 'e.g. 12' },
      { name: 'currentLocation', label: 'Base Location / Hub City', type: 'text', required: true, placeholder: 'e.g. Vijayawada, AP' },
    ],
  },

  driver: {
    type: 'driver',
    title: 'Commercial Driver Registration',
    category: 'Transportation',
    badge: 'Driver',
    description: 'Drive with ChaseHorse TMS. On-time payouts, GPS route assistance, and direct trip assignments.',
    fields: [
      { name: 'fullName', label: 'Full Name', type: 'text', required: true, placeholder: 'As per Driving License (e.g. Vikram Singh)' },
      { name: 'phone', label: 'Mobile Number', type: 'tel', required: true, placeholder: '10-digit number for SMS dispatch' },
      { name: 'email', label: 'Email Address (Optional)', type: 'email', required: false, placeholder: 'driver@example.com' },
      { name: 'drivingLicense', label: 'Commercial Driving License Number', type: 'text', required: true, placeholder: 'e.g. DL1420110012345' },
      {
        name: 'experienceYears',
        label: 'Commercial Driving Experience',
        type: 'select',
        required: true,
        options: [
          { label: '1 - 2 years', value: '1-2' },
          { label: '3 - 5 years', value: '3-5' },
          { label: '5 - 10 years', value: '5-10' },
          { label: '10+ years', value: '10+' },
        ],
      },
    ],
  },

  freight_trader: {
    type: 'freight_trader',
    title: 'Freight Trader Registration',
    category: 'Transportation',
    badge: 'Freight Trader',
    description: 'Broker and trade freight loads with trusted enterprise shippers and guaranteed settlement terms.',
    fields: [
      { name: 'fullName', label: 'Full Name', type: 'text', required: true, placeholder: 'e.g. Amit Kapoor' },
      { name: 'companyName', label: 'Trading Firm Name', type: 'text', required: true, placeholder: 'e.g. North-South Freight Link' },
      { name: 'phone', label: 'Phone Number', type: 'tel', required: true, placeholder: '10-digit mobile number' },
      { name: 'email', label: 'Email Address', type: 'email', required: true, placeholder: 'trader@domain.com' },
      { name: 'whichRoutes', label: 'Primary Trade Corridors / Routes', type: 'text', required: true, placeholder: 'e.g. Mumbai - Delhi, Chennai - Hyderabad' },
      { name: 'currentLocation', label: 'Operating Headquarter City', type: 'text', required: true, placeholder: 'e.g. Nagpur, Maharashtra' },
      {
        name: 'businessType',
        label: 'Business Entity Type',
        type: 'select',
        required: true,
        options: [
          { label: 'Private Limited Company', value: 'pvt_ltd' },
          { label: 'Partnership Firm', value: 'partnership' },
          { label: 'Proprietorship', value: 'proprietorship' },
          { label: 'Freight Commission Broker', value: 'broker' },
          { label: 'Other', value: 'other' },
        ],
      },
    ],
  },

  freight_financial: {
    type: 'freight_financial',
    title: 'Freight Financials Registration',
    category: 'Financial Services',
    badge: 'Financial Partner',
    description: 'Provide invoice discounting, trip advances, vehicle leasing, and insurance to logistics operators.',
    fields: [
      { name: 'fullName', label: 'Representative Name', type: 'text', required: true, placeholder: 'e.g. Priya Venkatesh' },
      { name: 'companyName', label: 'Financial Institution / NBFC Name', type: 'text', required: true, placeholder: 'e.g. Logistics Capital Finance' },
      { name: 'phone', label: 'Contact Phone', type: 'tel', required: true, placeholder: '10-digit mobile number' },
      { name: 'email', label: 'Corporate Email', type: 'email', required: true, placeholder: 'credit@logisticsfinance.in' },
      {
        name: 'servicesOffered',
        label: 'Primary Financial Products Offered',
        type: 'select',
        required: true,
        options: [
          { label: 'Freight Bill & Invoice Discounting', value: 'invoice_discounting' },
          { label: 'Trip Fuel & Fastag Advances', value: 'fuel_advance' },
          { label: 'Commercial Vehicle Finance', value: 'vehicle_finance' },
          { label: 'Working Capital Credit Line', value: 'working_capital' },
          { label: 'Transit & Marine Cargo Insurance', value: 'insurance' },
          { label: 'Other Financial Services', value: 'other' },
        ],
      },
      { name: 'currentLocation', label: 'Headquarter / Branch Location', type: 'text', required: true, placeholder: 'e.g. Mumbai, BKC' },
      { name: 'serviceDetails', label: 'Product Details & Ticket Size (Optional)', type: 'textarea', placeholder: 'e.g. Minimum ticket size ₹5L, 48-hour disbursement turnaround' },
    ],
  },

  terminal_space: {
    type: 'terminal_space',
    title: 'Truck Terminal Space Registration',
    category: 'Terminal Infrastructure',
    badge: 'Terminal Space',
    description: 'List your yard, parking plaza, or logistics hub on ChaseHorse to host commercial fleets.',
    fields: [
      { name: 'companyName', label: 'Company / Facility Owner Name', type: 'text', required: true, placeholder: 'e.g. Deccan Logistics Park' },
      { name: 'contactPerson', label: 'Contact Person Name', type: 'text', required: true, placeholder: 'e.g. K. Srinivas Rao' },
      { name: 'phone', label: 'Phone Number', type: 'tel', required: true, placeholder: '10-digit mobile number' },
      { name: 'email', label: 'Email Address', type: 'email', required: true, placeholder: 'terminal@hub.com' },
      {
        name: 'gstNumber',
        label: 'GSTIN Number (Optional)',
        type: 'masked',
        required: false,
        placeholder: '15-character GSTIN (Optional)',
      },
      { name: 'terminalAddress', label: 'Terminal / Yard Address', type: 'text', required: true, placeholder: 'Plot no., Highway NH-44, Milestone 32' },
      { name: 'pincode', label: 'Postal Pincode', type: 'text', required: true, placeholder: '6-digit Pincode (e.g. 522201)' },
      { name: 'cityState', label: 'City & State', type: 'text', required: true, placeholder: 'e.g. Guntur, Andhra Pradesh' },
      { name: 'capacity', label: 'Truck Parking Capacity (Total Bays)', type: 'number', required: true, placeholder: 'e.g. 150' },
      {
        name: 'facilities',
        label: 'Available Facilities',
        type: 'checkbox-group',
        required: true,
        options: [
          { label: 'Secure 24x7 Gated Parking', value: 'parking' },
          { label: 'Diesel / Fuel Dispenser', value: 'fuel' },
          { label: 'Driver Restrooms & Dormitory', value: 'restroom' },
          { label: 'CCTV & Armed Security', value: 'security' },
          { label: 'Loading / Unloading Docks & Cranes', value: 'loading_docks' },
          { label: 'Weighbridge (Dharakanta)', value: 'weighbridge' },
        ],
      },
      {
        name: 'availableHours',
        label: 'Operating Hours',
        type: 'select',
        required: true,
        options: [
          { label: '24 Hours / 7 Days a week', value: '24x7' },
          { label: 'Daytime Only (06:00 to 22:00)', value: 'day_only' },
          { label: 'Night Layover (18:00 to 08:00)', value: 'night_only' },
        ],
      },
    ],
  },
};

