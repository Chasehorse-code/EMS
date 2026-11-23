import React, { useRef } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  Animated,
  ViewStyle,
  TextStyle,
  View,
} from 'react-native';
import { colors, radius, spacing, typography } from '../../theme';

export interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  success?: boolean;
  icon?: string;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  success = false,
  icon,
  style,
  textStyle,
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: true,
      speed: 30,
      bounciness: 0,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 30,
      bounciness: 4,
    }).start();
  };

  const isPrimary = variant === 'primary';
  const isAccent = variant === 'accent';
  const isSecondary = variant === 'secondary';
  const isGhost = variant === 'ghost';
  const isDanger = variant === 'danger';

  const containerStyles = [
    styles.base,
    styles[size],
    isPrimary ? styles.primary : undefined,
    isAccent ? styles.accent : undefined,
    isSecondary ? styles.secondary : undefined,
    isGhost ? styles.ghost : undefined,
    isDanger ? styles.danger : undefined,
    success ? styles.success : undefined,
    disabled || loading ? styles.disabled : undefined,
    style,
  ].filter((entry): entry is ViewStyle => Boolean(entry));

  const textColor = isPrimary || isAccent || isDanger || success
    ? '#F3F1EB'
    : isSecondary
    ? colors.ink
    : colors.primaryOrange;

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        style={containerStyles}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || loading || success}
        activeOpacity={0.85}
      >
        {loading ? (
          <ActivityIndicator color={textColor} size="small" />
        ) : success ? (
          <View style={styles.contentRow}>
            <Text style={[styles.iconText, { color: textColor }]}>✓</Text>
            <Text style={[styles.text, { color: textColor }, textStyle]}>Done</Text>
          </View>
        ) : (
          <View style={styles.contentRow}>
            {icon && <Text style={[styles.iconText, { color: textColor }]}>{icon}</Text>}
            <Text style={[styles.text, { color: textColor }, textStyle]}>{title}</Text>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    minHeight: 44, // Touch target minimum
  },
  sm: {
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    minHeight: 36,
  },
  md: {
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
    minHeight: 44,
  },
  lg: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    minHeight: 52,
  },
  primary: {
    backgroundColor: colors.primaryBlack,
  },
  accent: {
    backgroundColor: colors.primaryOrange,
  },
  secondary: {
    backgroundColor: colors.cardLight,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  danger: {
    backgroundColor: colors.danger,
  },
  success: {
    backgroundColor: colors.success,
  },
  disabled: {
    opacity: 0.5,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    marginRight: spacing.xs + 2,
    fontSize: 14,
  },
  text: {
    ...typography.bodyMedium,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
});
