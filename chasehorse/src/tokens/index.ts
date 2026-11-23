/**
 * ChaseHorse Signature Design Tokens (Web + Mobile Single Source of Truth)
 * Calm, premium, paper-like warm cream palette matching https://chasehorse-redesign.vercel.app
 */

export const tokens = {
  colors: {
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
  },

  radii: {
    xs: 4,
    sm: 8,
    md: 12,
    card: 16,
    lg: 16,
    xl: 20,
    pill: 9999,
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
    huge: 48,
  },

  typography: {
    fontSans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    fontHeading: "'Plus Jakarta Sans', 'Inter', -apple-system, sans-serif",
    fontMono: "'JetBrains Mono', 'SF Mono', Consolas, monospace",
  },

  shadows: {
    card: '0 1px 2px rgba(21, 21, 21, 0.03), 0 4px 12px rgba(21, 21, 21, 0.03)',
    cardHover: '0 8px 24px rgba(21, 21, 21, 0.06), 0 2px 6px rgba(21, 21, 21, 0.03)',
    modal: '0 20px 48px rgba(21, 21, 21, 0.16), 0 4px 16px rgba(21, 21, 21, 0.08)',
    activePill: '0 2px 8px rgba(217, 83, 30, 0.35)',
  },

  motion: {
    durations: {
      micro: 160,
      normal: 260,
      large: 500,
      intro: 1400,
    },
    easings: {
      standard: [0.22, 1, 0.36, 1],
      spring: { damping: 22, stiffness: 280 },
    },
  },
} as const;

export type ThemeTokens = typeof tokens;
