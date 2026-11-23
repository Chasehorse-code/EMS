import { tokens } from '@chasehorse/design-tokens/native';

/**
 * ChaseHorse Mobile Design Theme (Tokens matching Web Single Source of Truth)
 * Warm Cream (#F3F1EB), Desaturated Status Accents, Ink (#151515)
 */

export const colors = {
  // Brand Palette & Surfaces
  canvas: tokens.color.canvas,
  bgLight: '#F3F1EB',
  surfaceLight: '#FBFAF7',
  surfaceSunken: '#EFECE4',
  cardLight: '#FFFFFF',
  borderLight: '#DDD8CC',
  borderMuted: '#EFECE4',

  // Dark Palette
  bgDark: '#141412',
  surfaceDark: '#1D1C19',
  cardDark: '#24231F',
  borderDark: '#33312B',

  // Brand Accent: ONE Muted Burnt Orange
  orangeActive: tokens.color.accent,
  primaryOrange: tokens.color.accent,
  primaryOrangeHover: '#A94F20',
  primaryBlack: tokens.color.ink,
  surface: '#FBFAF7',
  navySidebar: '#151515',

  // Text Colors
  textDark: '#151515',
  ink: tokens.color.ink,
  textDarkSecondary: '#5E5B53',
  textDarkMuted: '#5E5B53',
  textLight: '#F3F1EB',
  textLightMuted: '#A8A49A',

  // Desaturated Status Colors (WCAG AA Compliant)
  success: '#2F7D5B',
  successLight: 'rgba(47, 125, 91, 0.15)',
  warning: '#B7791F',
  warningLight: 'rgba(183, 121, 31, 0.15)',
  danger: '#B04A3A',
  dangerLight: 'rgba(176, 74, 58, 0.15)',
  info: '#3A5BA0',
  infoLight: 'rgba(58, 91, 160, 0.15)',
  ai: '#7C3AED',
  aiLight: 'rgba(124, 58, 237, 0.15)',

  // Backward compatibility aliases
  navyDeep: '#141412',
  navyDark: '#181715',
  navyMedium: '#1D1C19',
  bluePrimary: '#3A5BA0',
  blueAccent: '#3A5BA0',
  blueLight: '#EDF2FB',
  gray400: '#A8A49A',
  gray500: '#5E5B53',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  huge: 32,
};

export const radius = {
  sm: 6,
  md: 10,
  card: 16,
  lg: 16,
  xl: 20,
  full: 9999,
  pill: 9999,
};

export const typography = {
  hero: { fontSize: 32, fontWeight: '700' as const, letterSpacing: -0.8 },
  titleLarge: { fontSize: 24, fontWeight: '700' as const, letterSpacing: -0.5 },
  titleMedium: { fontSize: 18, fontWeight: '700' as const, letterSpacing: -0.3 },
  titleSmall: { fontSize: 16, fontWeight: '600' as const },
  bodyLarge: { fontSize: 15, fontWeight: '400' as const },
  bodyMedium: { fontSize: 14, fontWeight: '400' as const },
  bodySmall: { fontSize: 12, fontWeight: '400' as const },
  caption: { fontSize: 11, fontWeight: '600' as const, letterSpacing: 0.3 },
  mono: { fontFamily: 'monospace', fontSize: 12, fontWeight: '600' as const, letterSpacing: 0.8 },
};
