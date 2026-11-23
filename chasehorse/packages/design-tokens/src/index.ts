/**
 * ChaseHorse Signature Design Tokens (Shared Package: Web + React Native)
 * Theme: Warm cream (#F3F1EB), near-black ink (#151515), ONE muted burnt-orange accent (#D9531E),
 * desaturated status colors (WCAG AA), dark mode, no bright/neon colors.
 */

export const colors = {
  light: {
    canvas: '#F3F1EB',
    surface: '#FFFFFF',
    surfaceElevated: '#FBFAF7',
    surface2: '#EFECE4',
    surfaceHover: '#E7E3D8',
    surfaceSunken: '#EBE7DE',
    border: '#DDD8CC',
    borderSoft: 'rgba(21, 21, 21, 0.06)',
    borderStrong: '#C5BFB0',
    ink: '#151515',
    text: '#151515',
    textSecondary: '#5E5B53',
    textMuted: '#5E5B53',
    textFaint: '#8C887E',

    // Brand Accent: ONE muted burnt orange
    primaryOrange: '#D9531E',
    primaryOrangeHover: '#C24513',
    primaryOrangeActive: '#AD3D10',
    primaryBlack: '#151515',
    primaryBlackHover: '#262626',
    navNavy: '#111315',

    // Desaturated status colors (WCAG AA compliant)
    status: {
      success: '#2F7D5B',
      successBg: '#EAF4EF',
      successBorder: '#A3D1BE',
      warning: '#B7791F',
      warningBg: '#FBF4E8',
      warningBorder: '#E5C68A',
      info: '#3A5BA0',
      infoBg: '#EDF2FB',
      infoBorder: '#A7BDE5',
      danger: '#B04A3A',
      dangerBg: '#F9EBE9',
      dangerBorder: '#E3A8A0',
      neutral: '#5E5B53',
      neutralBg: '#EFECE4',
      neutralBorder: '#DDD8CC',
    },
  },
  dark: {
    canvas: '#141412',
    surface: '#1D1C19',
    surfaceElevated: '#24231F',
    surface2: '#2B2A25',
    surfaceHover: '#33312B',
    surfaceSunken: '#181715',
    border: '#33312B',
    borderSoft: 'rgba(243, 241, 235, 0.08)',
    borderStrong: '#4D4A42',
    ink: '#F3F1EB',
    text: '#F3F1EB',
    textSecondary: '#A8A49A',
    textMuted: '#A8A49A',
    textFaint: '#736F66',

    // Brand Accent
    primaryOrange: '#E85E2A',
    primaryOrangeHover: '#F0703C',
    primaryOrangeActive: '#D9531E',
    primaryBlack: '#F3F1EB',
    primaryBlackHover: '#FFFFFF',
    navNavy: '#181715',

    status: {
      success: '#4ADE80',
      successBg: '#132A1F',
      successBorder: '#235A3F',
      warning: '#FBBF24',
      warningBg: '#33230C',
      warningBorder: '#664619',
      info: '#60A5FA',
      infoBg: '#13223D',
      infoBorder: '#264478',
      danger: '#F87171',
      dangerBg: '#351614',
      dangerBorder: '#692C28',
      neutral: '#A8A49A',
      neutralBg: '#2B2A25',
      neutralBorder: '#3D3B34',
    },
  },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  huge: 32,
  massive: 48,
} as const;

export const radii = {
  xs: 4,
  sm: 6,
  md: 10,
  card: 16,
  lg: 16,
  xl: 20,
  pill: 9999,
  full: 9999,
} as const;

export const shadows = {
  sm: {
    shadowColor: '#151515',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  card: {
    shadowColor: '#151515',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  modal: {
    shadowColor: '#151515',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 8,
  },
} as const;

export const typography = {
  fontFamilySans: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  fontFamilyHeading: "'Plus Jakarta Sans', Inter, -apple-system, sans-serif",
  fontFamilyMono: "'JetBrains Mono', Consolas, monospace",
  sizes: {
    hero: 32,
    titleLarge: 24,
    titleMedium: 18,
    titleSmall: 16,
    bodyLarge: 15,
    bodyMedium: 14,
    bodySmall: 12,
    caption: 11,
  },
  weights: {
    regular: '400' as const,
    medium: '500' as const,
    semiBold: '600' as const,
    bold: '700' as const,
    extraBold: '800' as const,
  },
} as const;

export const motion = {
  durations: {
    micro: 160,
    fast: 150,
    normal: 250,
    slow: 450,
    modal: 500,
    intro: 1400,
  },
  easings: {
    standard: [0.22, 1, 0.36, 1] as const,
    spring: { damping: 22, stiffness: 280 },
  },
} as const;

export const tokens = {
  colors,
  spacing,
  radii,
  shadows,
  typography,
  motion,
} as const;

export type DesignTokens = typeof tokens;
