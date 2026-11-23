import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, spacing, radius, typography } from '../theme';

interface NotFoundScreenProps {
  onGoHome: () => void;
  message?: string;
}

export const NotFoundScreen: React.FC<NotFoundScreenProps> = ({
  onGoHome,
  message = 'The screen or route you requested does not exist or you lack authorization to view it.',
}) => {
  return (
    <View style={styles.container}>
      <Text style={styles.code}>404</Text>
      <Text style={styles.title}>Page Not Found</Text>
      <Text style={styles.description}>{message}</Text>
      <TouchableOpacity style={styles.button} onPress={onGoHome} activeOpacity={0.85}>
        <Text style={styles.buttonText}>Return to Dashboard</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  code: {
    fontSize: 64,
    fontWeight: '800',
    color: colors.primaryOrange,
    letterSpacing: -1,
    marginBottom: spacing.xs,
  },
  title: {
    ...typography.titleLarge,
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  description: {
    ...typography.bodyMedium,
    color: colors.textDarkMuted,
    textAlign: 'center',
    maxWidth: 320,
    marginBottom: spacing.xl,
  },
  button: {
    backgroundColor: colors.primaryBlack,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
  buttonText: {
    color: '#F3F1EB',
    fontWeight: '600',
    fontSize: 14,
  },
});
