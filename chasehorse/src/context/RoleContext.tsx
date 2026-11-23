import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { Role } from '@/types';
import { ROLES, roleCapabilities, type Capability } from '@/config/access';
import { useAuth } from './AuthContext';

interface RoleContextValue {
  role: Role;
  setRole: (role: Role) => void;
  can: (capability: Capability) => boolean;
  customerId: string | undefined;
  actorName: string;
}

const RoleContext = createContext<RoleContextValue | null>(null);
const STORAGE_KEY = 'chasehorse.activeRole';

/**
 * Resolve a stable UI role from server-authoritative assignments.  The API may
 * return multiple roles, so never depend on database row order.
 */
export function resolveAuthenticatedRole(roles: string[] | undefined): Role | null {
  const assigned = new Set((roles ?? []).map((role) => role.toUpperCase()));
  if (assigned.has('ADMIN')) return 'admin';
  if (assigned.has('MANAGER') || assigned.has('OPERATIONS') || assigned.has('OPERATIONS_MANAGER')) {
    return 'operations_manager';
  }
  if (assigned.has('ENQUIRY_MANAGER')) return 'enquiry_manager';
  if (assigned.has('CUSTOMER')) return 'customer';
  if (assigned.has('FIELD_WORKER')) return 'field_worker';
  if (assigned.has('EMPLOYEE')) return 'employee';
  return null;
}

function readStoredRole(): Role {
  try {
    const stored = window.sessionStorage.getItem(STORAGE_KEY);
    if (stored && (ROLES as string[]).includes(stored)) return stored as Role;
  } catch {
    /* storage unavailable */
  }
  return 'admin';
}

const actorNames: Record<Role, string> = {
  admin: 'Platform Admin',
  operations_manager: 'Operations Manager',
  employee: 'On-Field Worker',
  customer: 'Customer Representative',
  manager: 'Operations Manager',
  operations: 'Operations Manager',
  field_worker: 'On-Field Worker',
  enquiry_manager: 'Enquiry Desk',
};

export function RoleProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const [devRole, setDevRoleState] = useState<Role>(readStoredRole);

  // Derive authenticated role strictly from backend session
  const authenticatedRole = useMemo<Role | null>(() => {
    if (!auth.user) return null;
    return resolveAuthenticatedRole(auth.profile?.roles);
  }, [auth.user, auth.profile]);

  // When authenticated, effective role is locked to the backend identity
  const effectiveRole = authenticatedRole || devRole;

  const setRole = useCallback((next: Role) => {
    if (authenticatedRole) {
      console.warn('[Security] Cannot switch roles while authenticated with a verified session.');
      return;
    }
    setDevRoleState(next);
    try {
      window.sessionStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, [authenticatedRole]);

  const currentActorName = useMemo(() => {
    if (auth.profile?.displayName) return auth.profile.displayName;
    if (auth.user?.email) return auth.user.email.split('@')[0];
    return actorNames[effectiveRole] || 'ChaseHorse User';
  }, [auth.profile, auth.user, effectiveRole]);

  const value = useMemo<RoleContextValue>(
    () => ({
      role: effectiveRole,
      setRole,
      can: (capability) => roleCapabilities[effectiveRole]?.includes(capability) ?? false,
      customerId: effectiveRole === 'customer' ? (auth.profile?.id || 'cust-apex') : undefined,
      actorName: currentActorName,
    }),
    [effectiveRole, setRole, auth.profile?.id, currentActorName],
  );

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole(): RoleContextValue {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error('useRole must be used inside <RoleProvider>');
  return ctx;
}
