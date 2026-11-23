import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, radius, spacing, typography } from '../../theme';

export interface MilestoneItem {
  id?: string;
  title: string;
  subtitle?: string;
  time?: string;
  completed: boolean;
  current?: boolean;
}

export const Timeline: React.FC<{
  milestones: MilestoneItem[];
  style?: ViewStyle;
}> = ({ milestones, style }) => {
  return (
    <View style={[styles.container, style]}>
      {milestones.map((item, idx) => {
        const isLast = idx === milestones.length - 1;
        return (
          <View key={item.id || String(idx)} style={styles.row}>
            {/* Dot & connecting line */}
            <View style={styles.indicatorCol}>
              <View
                style={[
                  styles.dot,
                  item.completed && styles.dotCompleted,
                  item.current && styles.dotCurrent,
                ]}
              >
                {item.completed && <Text style={styles.checkMark}>✓</Text>}
              </View>
              {!isLast && (
                <View
                  style={[
                    styles.line,
                    item.completed && styles.lineCompleted,
                  ]}
                />
              )}
            </View>

            {/* Content */}
            <View style={[styles.contentCol, !isLast && { paddingBottom: spacing.lg }]}>
              <View style={styles.titleRow}>
                <Text
                  style={[
                    styles.title,
                    item.current && styles.titleCurrent,
                    item.completed && styles.titleCompleted,
                  ]}
                >
                  {item.title}
                </Text>
                {item.time && <Text style={styles.time}>{item.time}</Text>}
              </View>
              {item.subtitle && <Text style={styles.subtitle}>{item.subtitle}</Text>}
            </View>
          </View>
        );
      })}
    </View>
  );
};

export const Stepper: React.FC<{
  steps: string[];
  currentStepIndex: number;
  style?: ViewStyle;
}> = ({ steps, currentStepIndex, style }) => {
  return (
    <View style={[styles.stepperContainer, style]}>
      {steps.map((step, idx) => {
        const isCompleted = idx < currentStepIndex;
        const isCurrent = idx === currentStepIndex;
        const isLast = idx === steps.length - 1;

        return (
          <React.Fragment key={step}>
            <View style={styles.stepItem}>
              <View
                style={[
                  styles.stepBadge,
                  isCompleted && styles.stepCompleted,
                  isCurrent && styles.stepCurrent,
                ]}
              >
                <Text
                  style={[
                    styles.stepBadgeText,
                    (isCompleted || isCurrent) && styles.stepBadgeTextActive,
                  ]}
                >
                  {isCompleted ? '✓' : idx + 1}
                </Text>
              </View>
              <Text
                style={[
                  styles.stepLabel,
                  isCurrent && styles.stepLabelCurrent,
                ]}
                numberOfLines={1}
              >
                {step}
              </Text>
            </View>
            {!isLast && (
              <View
                style={[
                  styles.stepConnector,
                  isCompleted && styles.stepConnectorActive,
                ]}
              />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.sm,
  },
  row: {
    flexDirection: 'row',
  },
  indicatorCol: {
    alignItems: 'center',
    width: 24,
    marginRight: spacing.md,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.borderLight,
    backgroundColor: colors.cardLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotCompleted: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  dotCurrent: {
    borderColor: colors.primaryOrange,
    borderWidth: 4,
    backgroundColor: colors.cardLight,
  },
  checkMark: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  line: {
    width: 2,
    flex: 1,
    backgroundColor: colors.borderLight,
    marginVertical: 2,
  },
  lineCompleted: {
    backgroundColor: colors.success,
  },
  contentCol: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    ...typography.bodyMedium,
    color: colors.textDarkMuted,
    fontWeight: '600',
  },
  titleCurrent: {
    color: colors.primaryOrange,
    fontWeight: '700',
  },
  titleCompleted: {
    color: colors.ink,
  },
  time: {
    ...typography.caption,
    color: colors.textDarkMuted,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textDarkMuted,
    marginTop: 2,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  stepItem: {
    alignItems: 'center',
  },
  stepBadge: {
    width: 24,
    height: 24,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cardLight,
  },
  stepCompleted: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  stepCurrent: {
    borderColor: colors.primaryOrange,
    backgroundColor: colors.primaryOrange,
  },
  stepBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textDarkMuted,
  },
  stepBadgeTextActive: {
    color: '#FFFFFF',
  },
  stepLabel: {
    ...typography.caption,
    fontSize: 10,
    color: colors.textDarkMuted,
    marginTop: 4,
  },
  stepLabelCurrent: {
    color: colors.primaryOrange,
    fontWeight: '700',
  },
  stepConnector: {
    flex: 1,
    height: 2,
    backgroundColor: colors.borderLight,
    marginHorizontal: spacing.xs,
    marginBottom: 16,
  },
  stepConnectorActive: {
    backgroundColor: colors.success,
  },
});
