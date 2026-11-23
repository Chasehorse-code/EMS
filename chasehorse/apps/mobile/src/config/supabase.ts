import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://invalid.local';
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'unconfigured-key';

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  !supabaseUrl.includes('invalid') &&
  supabaseAnonKey !== 'unconfigured-key'
);

/**
 * Supabase persists both access and refresh tokens through this adapter.
 * On native mobile devices, expo-secure-store (hardware keystore/keychain) is strictly used.
 * On web preview, sessionStorage provides ephemeral in-memory browser persistence.
 */
const getWebSessionStorage = () => {
  if (typeof globalThis !== 'undefined' && 'localStorage' in globalThis) {
    return (globalThis as any).localStorage;
  }
  if (typeof globalThis !== 'undefined' && 'sessionStorage' in globalThis) {
    return (globalThis as any).sessionStorage;
  }
  return null;
};

export const secureSessionStorage = {
  getItem: async (key: string) => {
    if (Platform.OS === 'web') {
      try {
        const store = getWebSessionStorage();
        return store ? store.getItem(key) : null;
      } catch {
        return null;
      }
    }
    return SecureStore.getItemAsync(key);
  },
  setItem: async (key: string, value: string) => {
    if (Platform.OS === 'web') {
      try {
        const store = getWebSessionStorage();
        if (store) store.setItem(key, value);
      } catch {}
      return;
    }
    return SecureStore.setItemAsync(key, value);
  },
  removeItem: async (key: string) => {
    if (Platform.OS === 'web') {
      try {
        const store = getWebSessionStorage();
        if (store) store.removeItem(key);
      } catch {}
      return;
    }
    return SecureStore.deleteItemAsync(key);
  },
};

if (!isSupabaseConfigured) {
  console.warn(
    '[ChaseHorse Mobile] EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY is not configured. Mobile authentication will fail closed.',
  );
}

export const supabase: SupabaseClient = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      storage: secureSessionStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);
