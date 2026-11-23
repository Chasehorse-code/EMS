import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import { secureSessionStorage } from '../config/supabase';
import { colors as baseColors } from '../theme';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export interface ThemeColors {
  canvas: string;
  surface: string;
  card: string;
  border: string;
  borderMuted: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  accentHover: string;
  success: string;
  warning: string;
  danger: string;
  info: string;
  navBg: string;
  navBorder: string;
}

export const lightPalette: ThemeColors = {
  canvas: '#F3F1EB',
  surface: '#FBFAF7',
  card: '#FFFFFF',
  border: '#DDD8CC',
  borderMuted: '#EFECE4',
  text: '#151515',
  textSecondary: '#5E5B53',
  textMuted: '#8C887B',
  accent: '#D9531E',
  accentHover: '#A94F20',
  success: '#2F7D5B',
  warning: '#B7791F',
  danger: '#B04A3A',
  info: '#3A5BA0',
  navBg: '#FFFFFF',
  navBorder: '#DDD8CC',
};

export const darkPalette: ThemeColors = {
  canvas: '#141412',
  surface: '#1D1C19',
  card: '#24231F',
  border: '#33312B',
  borderMuted: '#2A2925',
  text: '#F3F1EB',
  textSecondary: '#A8A49A',
  textMuted: '#736F66',
  accent: '#D9531E',
  accentHover: '#FF8A50',
  success: '#2F7D5B',
  warning: '#B7791F',
  danger: '#B04A3A',
  info: '#3A5BA0',
  navBg: '#1D1C19',
  navBorder: '#33312B',
};

interface ThemeContextType {
  theme: ThemeMode;
  resolvedTheme: ResolvedTheme;
  colors: ThemeColors;
  setTheme: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = 'chasehorse.mobile_theme';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemScheme = useColorScheme();
  const [theme, setThemeState] = useState<ThemeMode>('system');
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(systemScheme === 'dark' ? 'dark' : 'light');

  // Load saved preference on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const stored = await secureSessionStorage.getItem(THEME_STORAGE_KEY);
        if (stored === 'light' || stored === 'dark' || stored === 'system') {
          if (mounted) setThemeState(stored);
        }
      } catch {}
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Compute resolved theme whenever theme or systemScheme changes
  useEffect(() => {
    if (theme === 'system') {
      setResolvedTheme(systemScheme === 'dark' ? 'dark' : 'light');
    } else {
      setResolvedTheme(theme);
    }
  }, [theme, systemScheme]);

  const setTheme = (mode: ThemeMode) => {
    setThemeState(mode);
    secureSessionStorage.setItem(THEME_STORAGE_KEY, mode).catch(() => {});
  };

  const toggleTheme = () => {
    const next: ResolvedTheme = resolvedTheme === 'dark' ? 'light' : 'dark';
    setTheme(next);
  };

  const currentColors = resolvedTheme === 'dark' ? darkPalette : lightPalette;

  return (
    <ThemeContext.Provider
      value={{
        theme,
        resolvedTheme,
        colors: currentColors,
        setTheme,
        toggleTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    // Graceful fallback to default light palette if context is missing
    return {
      theme: 'system',
      resolvedTheme: 'light',
      colors: lightPalette,
      setTheme: () => {},
      toggleTheme: () => {},
    };
  }
  return context;
};
