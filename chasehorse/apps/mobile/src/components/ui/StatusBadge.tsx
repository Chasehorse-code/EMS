import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, radius, spacing, typography } from '../../theme';

export interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
  style?: ViewStyle;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status = 'open',
  size = 'md',
  style,
}) => {
  const norm = status.toLowerCase();

  let bg = colors.borderMuted;
  let text = colors.textDarkMuted;
  let dot = colors.textDarkMuted;

  if (['approved', 'active', 'completed', 'resolved', 'success'].includes(norm)) {
    bg = 'rgba(47, 125, 91, 0.12)';
    text = colors.success;
    dot = colors.success;
  } else if (['in_progress', 'assigned', 'in_transit'].includes(norm)) {
    bg = 'rgba(58, 91, 160, 0.12)';
    text = colors.info;
    dot = colors.info;
  } else if (['submitted', 'in_review', 'pending', 'hold'].includes(norm)) {
    bg = 'rgba(183, 121, 31, 0.14)';
    text = colors.warning;
    dot = colors.warning;
  } else if (['rejected', 'suspended', 'cancelled', 'failed', 'danger'].includes(norm)) {
    bg = 'rgba(176, 74, 58, 0.12)';
    text = colors.danger;
    dot = colors.danger;
  } else if (norm === 'open') {
    bg = 'rgba(217, 83, 30, 0.12)';
    text = colors.primaryOrange;
    dot = colors.primaryOrange;
  }

  const label = norm.replace(/_/g, ' ').toUpperCase();

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: bg },
        size === 'sm' && styles.sm,
        style,
      ]}
    >
      <View style={[styles.dot, { backgroundColor: dot }]} />
      <Text style={[styles.label, { color: text }, size === 'sm' && styles.labelSm]}>
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm + 2,
    borderRadius: radius.full,
    alignSelf: 'flex-start',
  },
  sm: {
    paddingVertical: 2,
    paddingHorizontal: spacing.xs + 2,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: spacing.xs,
  },
  label: {
    ...typography.caption,
    fontWeight: '700',
    fontSize: 10,
    letterSpacing: 0.5,
  },
  labelSm: {
    fontSize: 9,
  },
});
