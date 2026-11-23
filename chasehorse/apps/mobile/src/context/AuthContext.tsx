import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import type { UserProfile, Role, EmployeeSubRole } from '../types';
import { supabase, isSupabaseConfigured, secureSessionStorage } from '../config/supabase';
import { setMobileApiUnauthorizedHandler } from '../api/restApi';
import { queryClient } from './QueryContext';

export interface RegisterEmployeeInput {
  email: string;
  name: string;
  phone: string;
  region: string;
  subRole: EmployeeSubRole;
  coords: { lat: number; lng: number };
  password: string;
}

export interface RegisterCustomerInput {
  email: string;
  companyName: string;
  contactPerson: string;
  phone: string;
  gstin: string;
  region: string;
  password: string;
}

interface AuthContextType {
  user: UserProfile | null;
  role: Role | null;
  isAuthenticated: boolean;
  isPendingApproval: boolean;
  loading: boolean;
  login: (email: string, pass: string, targetRole?: Role) => Promise<{ requiresOtp?: boolean }>;
  verifyOtp: (email: string, otp: string, type?: 'signup' | 'email') => Promise<{ success: boolean; error?: string }>;
  resendOtp: (email: string, type?: 'signup' | 'email') => Promise<{ success: boolean; error?: string }>;
  signInWithOtp: (email: string) => Promise<{ success: boolean; error?: string }>;
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
  updatePassword: (newPassword: string) => Promise<void>;
  checkApprovalStatus: () => Promise<{ status: string; approved: boolean }>;
  registerEmployee: (data: RegisterEmployeeInput) => Promise<{ needsEmailVerification: boolean; email: string }>;
  registerCustomer: (data: RegisterCustomerInput) => Promise<{ needsEmailVerification: boolean; email: string }>;
  signOut: () => Promise<void>;
  pendingAccounts: UserProfile[];
  refreshPendingAccounts: () => Promise<void>;
  approveAccount: (id: string) => Promise<void>;
  rejectAccount: (id: string, reason?: string) => Promise<void>;
  suspendAccount: (id: string, reason: string) => Promise<void>;
  reinstateAccount: (id: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  (Platform.OS === 'android' ? 'http://10.0.2.2:8080/api/v1' : 'http://localhost:8080/api/v1');

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Never default to a logged-in demo user; begin unauthenticated
  const [user, setUser] = useState<UserProfile | null>(null);
  const [pendingAccounts, setPendingAccounts] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchServerProfile = async (accessToken: string): Promise<UserProfile> => {
    const res = await fetch(`${BASE_URL}/me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      throw new Error(`Profile loading failed: Server returned HTTP ${res.status}`);
    }

    const data = await res.json();
    const rawRoles: string[] = Array.isArray(data.roles) ? [...data.roles] : [];
    if (typeof data.role === 'string' && data.role) rawRoles.push(data.role);
    if (typeof data.accountType === 'string' && data.accountType) rawRoles.push(data.accountType);

    // Normalize roles to uppercase with underscores
    const normalized = rawRoles.map((r) => String(r).trim().toUpperCase().replace(/[\s-]+/g, '_'));

    let mappedRole: Role | null = null;
    if (
      normalized.some(
        (r) =>
          r === 'ADMIN' ||
          r === 'PLATFORM_ADMIN' ||
          r === 'SUPER_ADMIN' ||
          r === 'ADMINISTRATOR' ||
          r.includes('ADMIN'),
      )
    ) {
      mappedRole = 'admin';
    } else if (
      normalized.some(
        (r) =>
          r === 'VERIFIER' ||
          r === 'CLEAR_AND_VERIFY' ||
          r === 'CLEAR_VERIFY' ||
          r === 'VERIFICATION_OFFICER' ||
          r === 'VERIFICATION' ||
          r === 'AUDITOR' ||
          r.includes('VERIF') ||
          r.includes('CLEAR'),
      )
    ) {
      mappedRole = 'verifier';
    } else if (
      normalized.some(
        (r) =>
          r === 'OPERATIONS' ||
          r === 'OPERATIONS_MANAGER' ||
          r === 'OPERATIONAL_MANAGER' ||
          r === 'OPS_MANAGER' ||
          r === 'AREA_MANAGER' ||
          r === 'DISPATCHER' ||
          r.includes('OPERATION'),
      )
    ) {
      mappedRole = 'operations';
    } else if (normalized.some((r) => r === 'MANAGER' || r.includes('MANAGER'))) {
      mappedRole = 'manager';
    } else if (
      normalized.some((r) => r === 'PARTNER' || r === 'VENDOR' || r === 'TRANSPORTER' || r === 'CARRIER')
    ) {
      mappedRole = 'partner';
    } else if (normalized.some((r) => r === 'CUSTOMER' || r === 'CLIENT')) {
      mappedRole = 'customer';
    } else if (
      normalized.some(
        (r) =>
          r === 'EMPLOYEE' ||
          r === 'FIELD_WORKER' ||
          r === 'WORKER' ||
          r === 'OPERATOR' ||
          r === 'DRIVER',
      )
    ) {
      mappedRole = 'employee';
    }

    // Smart fallback based on account email if still unmapped
    if (!mappedRole) {
      const emailLower = (data.email || '').toLowerCase();
      if (emailLower.includes('admin')) {
        mappedRole = 'admin';
      } else if (emailLower.includes('verify') || emailLower.includes('verifier') || emailLower.includes('clear')) {
        mappedRole = 'verifier';
      } else if (emailLower.includes('ops') || emailLower.includes('manager')) {
        mappedRole = 'operations';
      } else if (emailLower.includes('customer')) {
        mappedRole = 'customer';
      } else if (emailLower.includes('worker') || emailLower.includes('employee')) {
        mappedRole = 'employee';
      }
    }

    if (!mappedRole) {
      throw new Error('This account has no recognized ChaseHorse role assignment. Contact an administrator.');
    }

    const rawStatus = (data.accountStatus || 'pending').toLowerCase();
    const accountStatus: UserProfile['accountStatus'] =
      rawStatus === 'active' || rawStatus === 'approved'
        ? 'active'
        : rawStatus === 'rejected'
        ? 'rejected'
        : rawStatus === 'suspended'
        ? 'suspended'
        : 'pending';

    return {
      id: data.id,
      email: data.email || '',
      displayName: data.displayName || 'Authorized User',
      phone: data.phone,
      region: data.region,
      role: mappedRole,
      accountStatus,
      createdAt: data.createdAt || '',
      token: accessToken,
    };
  };

  // Restore authenticated session from storage on mount
  useEffect(() => {
    let isMounted = true;

    const restoreSession = async () => {
      if (!isSupabaseConfigured) return;
      try {
        // Enforce 24-hour maximum mobile session lifetime
        const loginTimestampStr = await secureSessionStorage.getItem('chasehorse.mobile_login_time');
        if (loginTimestampStr) {
          const loginTime = parseInt(loginTimestampStr, 10);
          const ONE_DAY_MS = 24 * 60 * 60 * 1000;
          if (Date.now() - loginTime > ONE_DAY_MS) {
            console.log('[Auth] 24-hour mobile session expired, signing out.');
            await supabase.auth.signOut().catch(() => {});
            await secureSessionStorage.removeItem('chasehorse.mobile_login_time');
            if (isMounted) setUser(null);
            return;
          }
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token && isMounted) {
          const profile = await fetchServerProfile(session.access_token);
          if (isMounted) setUser(profile);
        }
      } catch (err) {
        if (isMounted) setUser(null);
      }
    };

    restoreSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;
      if (event === 'SIGNED_OUT' || !session) {
        setUser(null);
      } else if (session.access_token) {
        try {
          const profile = await fetchServerProfile(session.access_token);
          if (isMounted) setUser(profile);
        } catch {
          if (isMounted) setUser(null);
        }
      }
    });

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    setMobileApiUnauthorizedHandler(() => {
      void supabase.auth.signOut();
      queryClient.clear();
      setUser(null);
      setPendingAccounts([]);
    });
    return () => setMobileApiUnauthorizedHandler();
  }, []);

  const login = async (email: string, pass: string, _targetRole?: Role): Promise<{ requiresOtp?: boolean }> => {
    setLoading(true);
    try {
      const trimmedEmail = email.trim().toLowerCase();
      if (!trimmedEmail) {
        throw new Error('Please enter your corporate email address.');
      }
      if (!pass) {
        throw new Error('Please enter your account password.');
      }

      if (!isSupabaseConfigured) {
        throw new Error(
          'Mobile authentication configuration missing: EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY must be set.',
        );
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password: pass,
      });

      if (error) {
        // Preserve and surface specific authentication errors
        const errMsg = error.message || 'Invalid email or password.';
        if (errMsg.toLowerCase().includes('email not confirmed')) {
          const customErr = new Error('Your email address has not been confirmed yet. Please verify the security OTP sent to your inbox.');
          (customErr as any).code = 'EMAIL_NOT_CONFIRMED';
          throw customErr;
        }
        if (errMsg.toLowerCase().includes('invalid login credentials')) {
          throw new Error('Incorrect email or password. Please verify your credentials and try again.');
        }
        throw new Error(errMsg);
      }

      if (data.session?.access_token) {
        const verifiedProfile = await fetchServerProfile(data.session.access_token);
        if (verifiedProfile.accountStatus === 'suspended') {
          await supabase.auth.signOut().catch(() => {});
          setUser(null);
          throw new Error('Your ChaseHorse account has been suspended by an Operations Administrator. Contact support.');
        }
        if (verifiedProfile.accountStatus === 'rejected') {
          await supabase.auth.signOut().catch(() => {});
          setUser(null);
          throw new Error('Your registration application was rejected. Please contact your Operations Manager.');
        }
        setUser(verifiedProfile);
        await secureSessionStorage.setItem('chasehorse.mobile_login_time', Date.now().toString()).catch(() => {});
        return { requiresOtp: false };
      }

      return { requiresOtp: true };
    } catch (err) {
      queryClient.clear();
      setUser(null);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signInWithOtp = async (email: string): Promise<{ success: boolean; error?: string }> => {
    setLoading(true);
    try {
      const trimmedEmail = email.trim().toLowerCase();
      if (!trimmedEmail) {
        return { success: false, error: 'Please enter a valid email address.' };
      }
      if (!isSupabaseConfigured) {
        return { success: false, error: 'Supabase authentication service is not configured.' };
      }
      const { error } = await supabase.auth.signInWithOtp({
        email: trimmedEmail,
      });
      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to dispatch security code.' };
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (email: string): Promise<{ success: boolean; error?: string }> => {
    setLoading(true);
    try {
      const trimmedEmail = email.trim().toLowerCase();
      if (!trimmedEmail) {
        return { success: false, error: 'Please enter your registered email address.' };
      }
      if (!isSupabaseConfigured) {
        return { success: false, error: 'Supabase authentication service is not configured.' };
      }
      const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail);
      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to send password reset link.' };
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async (
    email: string,
    otp: string,
    type: 'signup' | 'email' = 'signup'
  ): Promise<{ success: boolean; error?: string }> => {
    setLoading(true);
    try {
      if (!isSupabaseConfigured) {
        return { success: false, error: 'Supabase configuration missing (EXPO_PUBLIC_SUPABASE_ANON_KEY).' };
      }
      const trimmedEmail = email.trim().toLowerCase();
      const trimmedOtp = otp.trim();
      if (!trimmedOtp || trimmedOtp.length < 6) {
        return { success: false, error: 'Please enter a valid 6-digit verification code.' };
      }

      // First attempt with requested type ('signup' or 'email')
      let res = await supabase.auth.verifyOtp({
        email: trimmedEmail,
        token: trimmedOtp,
        type: type,
      });

      // If signup failed, attempt fallback to email OTP verification
      if (res.error && type === 'signup') {
        const fallback = await supabase.auth.verifyOtp({
          email: trimmedEmail,
          token: trimmedOtp,
          type: 'email',
        });
        if (!fallback.error) {
          res = fallback;
        }
      }

      if (res.error || !res.data.session?.access_token) {
        return { success: false, error: res.error?.message || 'Invalid or expired security code.' };
      }

      const verifiedProfile = await fetchServerProfile(res.data.session.access_token);
      setUser(verifiedProfile);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Verification failed. Please try again.' };
    } finally {
      setLoading(false);
    }
  };

  const resendOtp = async (
    email: string,
    type: 'signup' | 'email' = 'signup'
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      if (!isSupabaseConfigured) {
        return { success: false, error: 'Authentication service not configured.' };
      }
      const trimmedEmail = email.trim().toLowerCase();
      const { error } = await supabase.auth.resend({
        type: type === 'signup' ? 'signup' : 'signup',
        email: trimmedEmail,
      });
      if (error) {
        // Fallback: try signInWithOtp
        const fallback = await supabase.auth.signInWithOtp({ email: trimmedEmail });
        if (fallback.error) {
          return { success: false, error: error.message };
        }
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to resend code.' };
    }
  };

  const checkApprovalStatus = async (): Promise<{ status: string; approved: boolean }> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        return { status: 'unauthenticated', approved: false };
      }
      const verifiedProfile = await fetchServerProfile(session.access_token);
      setUser(verifiedProfile);
      return {
        status: verifiedProfile.accountStatus,
        approved: verifiedProfile.accountStatus === 'active',
      };
    } catch (err: any) {
      return { status: 'error', approved: false };
    }
  };

  const registerEmployee = async (
    data: RegisterEmployeeInput
  ): Promise<{ needsEmailVerification: boolean; email: string }> => {
    setLoading(true);
    try {
      if (!isSupabaseConfigured) {
        throw new Error('Supabase authentication credentials missing. Cannot register on-field worker.');
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(data.email.trim())) {
        throw new Error('Please provide a valid email address.');
      }

      if (!data.name.trim()) {
        throw new Error('Full legal name is required.');
      }

      if (!data.phone.trim() || data.phone.trim().length < 8) {
        throw new Error('A valid mobile contact number is required.');
      }

      if (!data.password || data.password.length < 8) {
        throw new Error('Password must be at least 8 characters long.');
      }

      if (!data.region.trim()) {
        throw new Error('An assigned district or cluster is required.');
      }

      if (!Number.isFinite(data.coords?.lat) || !Number.isFinite(data.coords?.lng)) {
        throw new Error('A measured device location is required for field registration.');
      }

      const trimmedEmail = data.email.trim().toLowerCase();

      const { data: signUpData, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password: data.password,
        options: {
          data: {
            full_name: data.name.trim(),
            phone: data.phone.trim(),
            region: data.region,
            account_type: 'EMPLOYEE',
            sub_role: data.subRole,
          },
        },
      });

      if (error) {
        throw new Error(error.message || 'Registration failed.');
      }

      // If session immediately returned (email confirmation disabled in Supabase)
      if (signUpData.session?.access_token) {
        const verifiedProfile = await fetchServerProfile(signUpData.session.access_token);
        if (verifiedProfile.accountStatus === 'active') {
          setUser(verifiedProfile);
        } else {
          setUser(verifiedProfile);
        }
        return { needsEmailVerification: false, email: trimmedEmail };
      }

      // Email verification required
      setUser(null);
      return { needsEmailVerification: true, email: trimmedEmail };
    } finally {
      setLoading(false);
    }
  };

  const registerCustomer = async (
    data: RegisterCustomerInput
  ): Promise<{ needsEmailVerification: boolean; email: string }> => {
    setLoading(true);
    try {
      if (!isSupabaseConfigured) {
        throw new Error('Supabase authentication credentials missing. Cannot register corporate customer.');
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(data.email.trim())) {
        throw new Error('Please provide a valid corporate email address.');
      }

      if (!data.companyName.trim()) {
        throw new Error('Corporate entity name is required.');
      }

      if (!data.contactPerson.trim()) {
        throw new Error('Authorized contact person is required.');
      }

      if (!data.phone.trim() || data.phone.trim().length < 8) {
        throw new Error('A valid phone number is required.');
      }

      if (!data.gstin.trim() || data.gstin.trim().length < 10) {
        throw new Error('A valid corporate GSTIN / Tax ID is required.');
      }

      if (!data.password || data.password.length < 8) {
        throw new Error('Password must be at least 8 characters long.');
      }

      if (!data.region.trim()) {
        throw new Error('An operating region is required.');
      }

      const trimmedEmail = data.email.trim().toLowerCase();

      const { data: signUpData, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password: data.password,
        options: {
          data: {
            full_name: data.contactPerson.trim(),
            company_name: data.companyName.trim(),
            phone: data.phone.trim(),
            gstin: data.gstin.trim(),
            region: data.region,
            account_type: 'CUSTOMER',
          },
        },
      });

      if (error) {
        throw new Error(error.message || 'Registration failed.');
      }

      if (signUpData.session?.access_token) {
        const verifiedProfile = await fetchServerProfile(signUpData.session.access_token);
        if (verifiedProfile.accountStatus === 'active') {
          setUser(verifiedProfile);
        } else {
          setUser(verifiedProfile);
        }
        return { needsEmailVerification: false, email: trimmedEmail };
      }

      setUser(null);
      return { needsEmailVerification: true, email: trimmedEmail };
    } finally {
      setLoading(false);
    }
  };

  const refreshPendingAccounts = useCallback(async () => {
    if (!user?.token) return;
    try {
      const res = await fetch(`${BASE_URL}/employees`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const pendingList: UserProfile[] = (data || [])
          .filter((e: any) => (e.accountStatus || '').toUpperCase() === 'PENDING')
          .map((e: any) => ({
            id: e.id,
            email: e.email,
            displayName: e.displayName || 'Worker Applicant',
            phone: e.phone,
            region: e.region,
            role: 'employee' as Role,
            subRole: 'on_field' as EmployeeSubRole,
            accountStatus: 'pending' as const,
            createdAt: e.createdAt || '',
          }));
        setPendingAccounts(pendingList);
      }
    } catch {
      // Fail closed
    }
  }, [user]);

  const approveAccount = async (id: string) => {
    if (!user?.token) throw new Error('Not authenticated');
    const res = await fetch(`${BASE_URL}/employees/${id}/approval`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${user.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'ACTIVE' }),
    });
    if (!res.ok) {
      throw new Error(`Failed to approve employee: HTTP ${res.status}`);
    }
    await refreshPendingAccounts();
  };

  const rejectAccount = async (id: string, reason: string = 'Application rejected by operations manager') => {
    if (!user?.token) throw new Error('Not authenticated');
    const res = await fetch(`${BASE_URL}/employees/${id}/approval`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${user.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'REJECTED', reason }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Failed to reject employee: HTTP ${res.status}`);
    }
    await refreshPendingAccounts();
  };

  const suspendAccount = async (id: string, reason: string) => {
    if (!user?.token) throw new Error('Not authenticated');
    if (!reason || !reason.trim()) {
      throw new Error('A justification reason is required when suspending an employee account');
    }
    const res = await fetch(`${BASE_URL}/employees/${id}/approval`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${user.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'SUSPENDED', reason }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Failed to suspend employee: HTTP ${res.status}`);
    }
    await refreshPendingAccounts();
  };

  const reinstateAccount = async (id: string) => {
    if (!user?.token) throw new Error('Not authenticated');
    const res = await fetch(`${BASE_URL}/employees/${id}/approval`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${user.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'ACTIVE' }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Failed to reinstate employee: HTTP ${res.status}`);
    }
    await refreshPendingAccounts();
  };

  const updatePassword = async (newPassword: string): Promise<void> => {
    if (!isSupabaseConfigured) throw new Error('Supabase authentication service is not configured.');
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      // Ignore
    } finally {
      await secureSessionStorage.removeItem('chasehorse.mobile_login_time').catch(() => {});
      queryClient.clear();
      setUser(null);
      setPendingAccounts([]);
    }
  };

  const isAuthenticated = Boolean(user && user.token);
  const isPendingApproval = user?.accountStatus === 'pending';
  const role = user?.role ?? null;

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        isAuthenticated,
        isPendingApproval,
        loading,
        login,
        verifyOtp,
        resendOtp,
        signInWithOtp,
        resetPassword,
        updatePassword,
        checkApprovalStatus,
        registerEmployee,
        registerCustomer,
        signOut,
        pendingAccounts,
        refreshPendingAccounts,
        approveAccount,
        rejectAccount,
        suspendAccount,
        reinstateAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};
