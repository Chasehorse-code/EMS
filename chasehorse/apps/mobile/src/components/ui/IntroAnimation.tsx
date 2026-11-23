import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  AccessibilityInfo,
  Platform,
} from 'react-native';
import { ChaseHorseLogo } from '../ChaseHorseLogo';
import { colors, spacing, typography } from '../../theme';

interface IntroAnimationProps {
  onComplete: () => void;
}

export const IntroAnimation: React.FC<IntroAnimationProps> = ({ onComplete }) => {
  const [reduceMotion, setReduceMotion] = useState(false);

  const logoScale = useRef(new Animated.Value(0.85)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      setReduceMotion(enabled);
      if (enabled) {
        // Fast-path: immediately finish without motion
        const timer = setTimeout(onComplete, 300);
        return () => clearTimeout(timer);
      }
    });

    if (reduceMotion) return;

    // Sequence: Assemble -> Tagline fade -> Glide up -> onComplete
    Animated.sequence([
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 450,
          useNativeDriver: true,
        }),
        Animated.spring(logoScale, {
          toValue: 1,
          friction: 6,
          tension: 40,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(taglineOpacity, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
      Animated.delay(600),
      Animated.parallel([
        Animated.timing(slideUp, {
          toValue: -80,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(logoOpacity, {
          toValue: 0.9,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      onComplete();
    });
  }, [reduceMotion]);

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.skipBtn}
        onPress={onComplete}
        activeOpacity={0.7}
      >
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>

      <Animated.View
        style={[
          styles.logoContainer,
          {
            opacity: logoOpacity,
            transform: [{ scale: logoScale }, { translateY: slideUp }],
          },
        ]}
      >
        <ChaseHorseLogo size="hero" withSubtitle={false} theme="light" />

        <Animated.View style={{ opacity: taglineOpacity, marginTop: spacing.md }}>
          <Text style={styles.tagline}>GROWTH ENABLING LOGIWORKX PARTNER</Text>
        </Animated.View>

        <View style={styles.radarRing}>
          <View style={styles.radarPulse} />
          <Text style={styles.radarText}>Enterprise Workforce Orchestration</Text>
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  skipBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 54 : 36,
    right: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 20,
    backgroundColor: 'rgba(21, 21, 21, 0.08)',
  },
  skipText: {
    ...typography.caption,
    color: colors.textDarkMuted,
    fontWeight: '600',
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagline: {
    ...typography.caption,
    letterSpacing: 2,
    color: colors.primaryOrange,
    fontWeight: '800',
    fontSize: 10,
    textAlign: 'center',
  },
  radarRing: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xl,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 20,
    backgroundColor: 'rgba(21, 21, 21, 0.04)',
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  radarPulse: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.success,
    marginRight: spacing.xs,
  },
  radarText: {
    fontSize: 11,
    color: colors.textDarkMuted,
    fontWeight: '500',
  },
});
