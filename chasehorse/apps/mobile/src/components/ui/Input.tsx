import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Animated,
  TouchableOpacity,
  TextInputProps,
  ViewStyle,
} from 'react-native';
import { colors, radius, spacing, typography } from '../../theme';

export interface InputProps extends TextInputProps {
  label: string;
  error?: string;
  isPassword?: boolean;
  containerStyle?: ViewStyle;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  isPassword = false,
  containerStyle,
  value,
  onFocus,
  onBlur,
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(!isPassword);

  const hasValue = Boolean(value && value.length > 0);
  const labelAnim = useRef(new Animated.Value(hasValue ? 1 : 0)).current;

  const handleFocus = (e: any) => {
    setIsFocused(true);
    Animated.timing(labelAnim, {
      toValue: 1,
      duration: 150,
      useNativeDriver: false,
    }).start();
    onFocus?.(e);
  };

  const handleBlur = (e: any) => {
    setIsFocused(false);
    if (!hasValue) {
      Animated.timing(labelAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: false,
      }).start();
    }
    onBlur?.(e);
  };

  const labelTop = labelAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [14, 4],
  });

  const labelFontSize = labelAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [14, 11],
  });

  return (
    <View style={[styles.wrapper, containerStyle]}>
      <View
        style={[
          styles.container,
          isFocused && styles.focused,
          Boolean(error) && styles.errorBorder,
        ]}
      >
        <Animated.Text
          style={[
            styles.label,
            {
              top: labelTop,
              fontSize: labelFontSize,
              color: error
                ? colors.danger
                : isFocused
                ? colors.primaryOrange
                : colors.textDarkMuted,
            },
          ]}
        >
          {label}
        </Animated.Text>

        <TextInput
          style={[styles.input, isPassword && { paddingRight: 40 }]}
          value={value}
          onFocus={handleFocus}
          onBlur={handleBlur}
          secureTextEntry={isPassword && !showPassword}
          placeholderTextColor="transparent"
          {...props}
        />

        {isPassword && (
          <TouchableOpacity
            style={styles.eyeBtn}
            onPress={() => setShowPassword((prev) => !prev)}
            activeOpacity={0.7}
          >
            <Text style={styles.eyeIcon}>{showPassword ? '👁️' : '🙈'}</Text>
          </TouchableOpacity>
        )}
      </View>

      {Boolean(error) && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: spacing.md,
  },
  container: {
    backgroundColor: colors.cardLight,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radius.md,
    height: 52,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    position: 'relative',
  },
  focused: {
    borderColor: colors.primaryOrange,
    backgroundColor: '#FFFFFF',
  },
  errorBorder: {
    borderColor: colors.danger,
  },
  label: {
    position: 'absolute',
    left: spacing.md,
    fontWeight: '500',
  },
  input: {
    ...typography.bodyMedium,
    color: colors.ink,
    marginTop: 12,
    height: 36,
    padding: 0,
  },
  eyeBtn: {
    position: 'absolute',
    right: spacing.md,
    top: 16,
  },
  eyeIcon: {
    fontSize: 16,
  },
  errorText: {
    ...typography.caption,
    color: colors.danger,
    marginTop: spacing.xs,
    marginLeft: spacing.xs,
  },
});
