import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, radius, spacing, typography } from '../../theme';

export interface StatTileProps {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  trend?: string;
  trendDirection?: 'up' | 'down' | 'neutral';
  icon?: string;
  style?: ViewStyle;
}

export const StatTile: React.FC<StatTileProps> = ({
  label,
  value,
  prefix = '',
  suffix = '',
  trend,
  trendDirection = 'neutral',
  icon,
  style,
}) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let start = 0;
    const end = value;
    if (end === 0) {
      setDisplayValue(0);
      return;
    }
    const duration = 600;
    const stepTime = 30;
    const steps = duration / stepTime;
    const increment = end / steps;

    const timer = setInterval(() => {
      start += increment;
      if (start >= end) {
        setDisplayValue(end);
        clearInterval(timer);
      } else {
        setDisplayValue(Math.floor(start));
      }
    }, stepTime);

    return () => clearInterval(timer);
  }, [value]);

  return (
    <View style={[styles.tile, style]}>
      <View style={styles.headerRow}>
        <Text style={styles.label}>{label.toUpperCase()}</Text>
        {icon && <Text style={styles.icon}>{icon}</Text>}
      </View>

      <Text style={styles.value}>
        {prefix}
        {displayValue.toLocaleString('en-IN')}
        {suffix}
      </Text>

      {trend && (
        <View style={styles.trendRow}>
          <Text
            style={[
              styles.trendText,
              trendDirection === 'up' && styles.trendUp,
              trendDirection === 'down' && styles.trendDown,
            ]}
          >
            {trendDirection === 'up' ? '↗ ' : trendDirection === 'down' ? '↘ ' : '• '}
            {trend}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  tile: {
    backgroundColor: colors.cardLight,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.md,
    flex: 1,
    minWidth: 140,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  label: {
    ...typography.caption,
    color: colors.textDarkMuted,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  icon: {
    fontSize: 16,
  },
  value: {
    ...typography.titleLarge,
    color: colors.ink,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  trendRow: {
    marginTop: spacing.xs,
  },
  trendText: {
    ...typography.caption,
    color: colors.textDarkMuted,
    fontWeight: '600',
  },
  trendUp: {
    color: colors.success,
  },
  trendDown: {
    color: colors.danger,
  },
});
