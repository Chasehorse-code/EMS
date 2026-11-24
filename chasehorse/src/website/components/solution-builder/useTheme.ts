import { useState } from 'react';
import { ThemeId, ThemeOption } from './types';

const STORAGE_KEY = 'chasehorse_sb_theme';

export const THEME_OPTIONS: ThemeOption[] = [
  { id: 'classic', label: 'Classic', dotColor: '#ff4d12' },
];

function getInitialTheme(): ThemeId {
  // Always lock to signature warm Classic theme (#f8f6f0 bg, white cards)
  try {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.setItem(STORAGE_KEY, 'classic');
    }
  } catch {
    // ignore
  }
  return 'classic';
}

export function useTheme() {
  const [theme, setTheme] = useState<ThemeId>(getInitialTheme);

  return {
    theme,
    setTheme,
    themesList: THEME_OPTIONS,
  };
}

