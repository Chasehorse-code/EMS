import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, spacing, typography } from '../../theme';
import { Button } from './Button';

export interface EmptyStateProps {
  icon?: string;
  title: string;
  description: string;
  actionTitle?: string;
  onAction?: () => void;
  style?: ViewStyle;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = '📋',
  title,
  description,
  actionTitle,
  onAction,
  style,
}) => {
  return (
    <View style={[styles.container, style]}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      {actionTitle && onAction && (
        <Button
          title={actionTitle}
          onPress={onAction}
          variant="secondary"
          size="sm"
          style={styles.actionBtn}
        />
      )}
    </View>
  );
};

export const ErrorState: React.FC<{
  title?: string;
  error?: string;
  onRetry?: () => void;
  style?: ViewStyle;
}> = ({
  title = 'Failed to load data',
  error = 'Could not communicate with the ChaseHorse server. Please check your connection.',
  onRetry,
  style,
}) => {
  return (
    <View style={[styles.container, styles.errorContainer, style]}>
      <Text style={styles.icon}>⚠️</Text>
      <Text style={[styles.title, { color: colors.danger }]}>{title}</Text>
      <Text style={styles.description}>{error}</Text>
      {onRetry && (
        <Button
          title="Retry"
          onPress={onRetry}
          variant="primary"
          size="sm"
          style={styles.actionBtn}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    backgroundColor: 'rgba(176, 74, 58, 0.05)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(176, 74, 58, 0.2)',
  },
  icon: {
    fontSize: 40,
    marginBottom: spacing.sm,
  },
  title: {
    ...typography.titleSmall,
    color: colors.ink,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  description: {
    ...typography.bodySmall,
    color: colors.textDarkMuted,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 18,
  },
  actionBtn: {
    marginTop: spacing.md,
  },
});
