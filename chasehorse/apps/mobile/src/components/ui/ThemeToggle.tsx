import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { radius, spacing } from '../../theme';

export const ThemeToggle: React.FC = () => {
  const { resolvedTheme, toggleTheme } = useTheme();

  return (
    <TouchableOpacity
      style={[
        styles.btn,
        {
          backgroundColor: resolvedTheme === 'dark' ? '#24231F' : '#FFFFFF',
          borderColor: resolvedTheme === 'dark' ? '#33312B' : '#DDD8CC',
        },
      ]}
      onPress={toggleTheme}
      activeOpacity={0.8}
      accessibilityLabel={`Toggle theme, currently ${resolvedTheme} mode`}
    >
      <Text style={styles.icon}>{resolvedTheme === 'dark' ? '☀️' : '🌙'}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  btn: {
    padding: spacing.xs,
    borderRadius: radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    width: 34,
    height: 34,
  },
  icon: {
    fontSize: 14,
  },
});
