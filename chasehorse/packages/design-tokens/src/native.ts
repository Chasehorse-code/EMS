/**
 * React Native StyleSheet-ready design tokens matching web paper & carbon theme.
 * Warm cream canvas (#F3F1EB), Ink (#151515), Burnt Orange (#D9531E), Desaturated Status.
 */

import { colors, spacing, radii, shadows, typography, motion } from './index';

export const nativeTheme = {
  colors: {
    // Light
    canvas: colors.light.canvas,
    surface: colors.light.surface,
    surfaceElevated: colors.light.surfaceElevated,
    surface2: colors.light.surface2,
    surfaceHover: colors.light.surfaceHover,
    surfaceSunken: colors.light.surfaceSunken,
    border: colors.light.border,
    borderStrong: colors.light.borderStrong,
    ink: colors.light.ink,
    text: colors.light.text,
    textSecondary: colors.light.textSecondary,
    textMuted: colors.light.textMuted,
    textFaint: colors.light.textFaint,

    // Accent
    primaryOrange: colors.light.primaryOrange,
    primaryOrangeHover: colors.light.primaryOrangeHover,
    primaryBlack: colors.light.primaryBlack,
    navNavy: colors.light.navNavy,

    // Status
    success: colors.light.status.success,
    successBg: colors.light.status.successBg,
    warning: colors.light.status.warning,
    warningBg: colors.light.status.warningBg,
    danger: colors.light.status.danger,
    dangerBg: colors.light.status.dangerBg,
    info: colors.light.status.info,
    infoBg: colors.light.status.infoBg,
    neutral: colors.light.status.neutral,
    neutralBg: colors.light.status.neutralBg,

    // Dark
    dark: {
      canvas: colors.dark.canvas,
      surface: colors.dark.surface,
      surfaceElevated: colors.dark.surfaceElevated,
      surface2: colors.dark.surface2,
      border: colors.dark.border,
      ink: colors.dark.ink,
      text: colors.dark.text,
      textSecondary: colors.dark.textSecondary,
      primaryOrange: colors.dark.primaryOrange,
      success: colors.dark.status.success,
      warning: colors.dark.status.warning,
      danger: colors.dark.status.danger,
      info: colors.dark.status.info,
    },
  },
  color: {
    canvas: colors.light.canvas,
    surface: colors.light.surface,
    accent: colors.light.primaryOrange,
    ink: colors.light.ink,
    muted: colors.light.textMuted,
    border: colors.light.border,
  },
  spacing,
  radii,
  radius: radii, // compatibility alias
  shadows,
  typography,
  motion,
} as const;

export const tokens = nativeTheme;
export type NativeTheme = typeof nativeTheme;
