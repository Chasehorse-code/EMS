import type { LucideIcon } from 'lucide-react';
import {
  ClipboardList,
  LayoutDashboard,
  ListChecks,
  MapPin,
  ShieldCheck,
  Users,
  Wallet,
  Home,
  PlusSquare,
  Clock,
  Compass,
  BarChart3,
  Settings,
  HelpCircle,
  User,
  Truck,
  Inbox,
} from 'lucide-react';
import type { Role } from '@/types';

export const roleMeta: Record<Role, { label: string; blurb: string }> = {
  admin: {
    label: 'Platform Admin',
    blurb: 'Full platform administration, user & manager assignments, system audit history',
  },
  operations_manager: {
    label: 'Operations Manager',
    blurb: 'Task review queue, AI verification check, on-field worker approval, reward release',
  },
  employee: {
    label: 'On-Field Worker',
    blurb: 'Location-aware task discovery, checklists, geo-tagged photo evidence, wallet earnings',
  },
  customer: {
    label: 'Customer',
    blurb: 'Create field tasks, monitor live execution progress, review completed evidence',
  },
  // Backward compatibility aliases
  manager: {
    label: 'Operations Manager',
    blurb: 'Task review queue, AI verification check, on-field worker approval, reward release',
  },
  operations: {
    label: 'Operations',
    blurb: 'Task review queue, AI verification check, on-field worker approval, reward release',
  },
  field_worker: {
    label: 'On-Field Worker',
    blurb: 'Location-aware task discovery, checklists, geo-tagged photo evidence, wallet earnings',
  },
  enquiry_manager: {
    label: 'Enquiry Desk',
    blurb: 'Website enquiries: verified contact requests, partner applications, bookings and follow-up',
  },
};

export const ROLES: Role[] = [
  'admin',
  'operations_manager',
  'employee',
  'customer',
];

export type Capability =
  | 'createTasks'
  | 'assignTasks'
  | 'manageEmployees'
  | 'editChecklists'
  | 'decideEvidence'
  | 'decideApprovals'
  | 'viewAiResults'
  | 'manageWallets';

export const roleCapabilities: Record<Role, Capability[]> = {
  admin: [
    'createTasks',
    'assignTasks',
    'manageEmployees',
    'editChecklists',
    'decideEvidence',
    'decideApprovals',
    'viewAiResults',
    'manageWallets',
  ],
  operations_manager: [
    'createTasks',
    'assignTasks',
    'manageEmployees',
    'editChecklists',
    'decideEvidence',
    'decideApprovals',
    'viewAiResults',
    'manageWallets',
  ],
  manager: [
    'createTasks',
    'assignTasks',
    'manageEmployees',
    'editChecklists',
    'decideEvidence',
    'decideApprovals',
    'viewAiResults',
    'manageWallets',
  ],
  operations: [
    'createTasks',
    'assignTasks',
    'manageEmployees',
    'decideApprovals',
    'decideEvidence',
    'viewAiResults',
    'manageWallets',
  ],
  employee: [
    'viewAiResults',
  ],
  field_worker: [
    'viewAiResults',
  ],
  customer: [
    'createTasks',
  ],
  enquiry_manager: [],
};

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  roles: Role[];
  end?: boolean;
}

export const navItems: NavItem[] = [
  {
    to: '/enquiries',
    label: 'Enquiries',
    icon: Inbox,
    roles: ['admin', 'enquiry_manager'],
  },
  {
    to: '/admin/portal',
    label: 'Partners & Telemetry',
    icon: Truck,
    roles: ['admin', 'operations_manager', 'manager', 'operations'],
  },
  {
    to: '/overview',
    label: 'Operations Overview',
    icon: LayoutDashboard,
    roles: ['admin', 'operations_manager', 'manager', 'operations'],
  },
  {
    to: '/admin/areas',
    label: 'State Areas',
    icon: MapPin,
    roles: ['admin'],
  },
  {
    to: '/employee/dashboard',
    label: 'Home',
    icon: Home,
    roles: ['employee', 'field_worker'],
  },
  {
    to: '/nearby',
    label: 'Nearby Tasks',
    icon: MapPin,
    roles: ['admin', 'employee', 'field_worker'],
  },
  {
    to: '/tasks',
    label: 'Tasks',
    icon: ClipboardList,
    roles: ['admin', 'operations_manager', 'manager', 'operations', 'customer', 'employee', 'field_worker'],
  },
  {
    to: '/approvals',
    label: 'Review Queue',
    icon: ShieldCheck,
    roles: ['admin', 'operations_manager', 'manager', 'operations'],
  },
  {
    to: '/employees',
    label: 'Workers & Staff',
    icon: Users,
    roles: ['admin', 'operations_manager', 'manager'],
  },
  {
    to: '/checklists',
    label: 'Checklist Templates',
    icon: ListChecks,
    roles: ['admin'],
  },
  {
    to: '/wallet',
    label: 'Wallets',
    icon: Wallet,
    roles: ['admin', 'operations_manager', 'manager', 'operations', 'employee', 'field_worker'],
  },
  {
    to: '/employee/profile',
    label: 'Profile',
    icon: User,
    roles: ['employee', 'field_worker'],
  },
  {
    to: '/support',
    label: 'Support Tickets',
    icon: HelpCircle,
    roles: ['employee', 'field_worker', 'admin', 'operations_manager', 'manager', 'operations'],
  },
];

/**
 * Enterprise SaaS Customer Portal navigation items
 */
export const customerNavItems: NavItem[] = [
  {
    to: '/customer/dashboard',
    label: 'Overview',
    icon: Home,
    roles: ['customer'],
    end: true,
  },
  {
    to: '/customer/tasks',
    label: 'My Tasks',
    icon: ClipboardList,
    roles: ['customer'],
  },
  {
    to: '/customer/tasks/new',
    label: 'Create Task',
    icon: PlusSquare,
    roles: ['customer'],
  },
  {
    to: '/customer/history',
    label: 'Task History',
    icon: Clock,
    roles: ['customer'],
  },
  {
    to: '/customer/tracking',
    label: 'Tracking',
    icon: Compass,
    roles: ['customer'],
  },
  {
    to: '/customer/reports',
    label: 'Reports',
    icon: BarChart3,
    roles: ['customer'],
  },
  {
    to: '/customer/profile',
    label: 'Profile & Settings',
    icon: Settings,
    roles: ['customer'],
  },
  {
    to: '/customer/support',
    label: 'Help & Support',
    icon: HelpCircle,
    roles: ['customer'],
  },
];

export function canAccessPath(role: Role, pathname: string): boolean {
  if (pathname === '/pending-approval') return true;
  // The enquiry desk sees only the Enquiry Management System.
  if (role === 'enquiry_manager') {
    return pathname === '/enquiries' || pathname.startsWith('/enquiries/');
  }
  if (pathname === '/tasks/new') return true;
  if (pathname === '/pending-approval') return true;
  if (pathname === '/admin/dashboard' || pathname === '/employee/dashboard' || pathname === '/employee/profile' || pathname === '/profile' || pathname === '/support') return true;
  if (pathname.startsWith('/customer/')) return true;

  // Strict role boundaries: customers cannot access employee or manager features or deprecated evidence page
  if (role === 'customer') {
    if (
      pathname === '/nearby' ||
      pathname === '/wallet' ||
      pathname === '/employees' ||
      pathname === '/checklists' ||
      pathname === '/approvals' ||
      pathname === '/evidence' ||
      pathname.startsWith('/evidence/')
    ) {
      return false;
    }
  }

  // Managers cannot access admin-only checklists or admin areas screen
  if (role === 'operations_manager' || role === 'manager') {
    if (
      pathname === '/checklists' ||
      pathname.startsWith('/checklists/') ||
      pathname === '/admin/areas' ||
      pathname.startsWith('/admin/areas/')
    ) {
      return false;
    }
  }

  const allItems = [...navItems, ...customerNavItems];
  const match = allItems
    .filter((n) => (n.end ? pathname === n.to : pathname === n.to || pathname.startsWith(n.to + '/')))
    .sort((a, b) => b.to.length - a.to.length)[0];

  return match ? match.roles.includes(role) : true;
}
