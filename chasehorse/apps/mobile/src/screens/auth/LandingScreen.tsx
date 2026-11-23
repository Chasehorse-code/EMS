import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
} from 'react-native';
import { colors, spacing, radius } from '../../theme';
import { ChaseHorseLogo } from '../../components/ChaseHorseLogo';

interface LandingScreenProps {
  onGetStarted: () => void;
  onNavigateToRegisterEmployee?: () => void;
  onNavigateToRegisterCustomer?: () => void;
}

export const LandingScreen: React.FC<LandingScreenProps> = ({ onGetStarted }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Fast, crisp animation under 1.4 seconds
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 900,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 900,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();

    // Subtle gentle pulse for CTA button
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.02,
          duration: 1200,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ])
    );
    pulseLoop.start();

    return () => pulseLoop.stop();
  }, [fadeAnim, slideAnim, pulseAnim]);

  return (
    <View style={styles.container}>
      {/* Top Skippable Link */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.skipBtn} onPress={onGetStarted} activeOpacity={0.7}>
          <Text style={styles.skipBtnText}>Skip ↗</Text>
        </TouchableOpacity>
      </View>

      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        {/* Upside Brand Logo */}
        <View style={styles.logoBox}>
          <ChaseHorseLogo size="lg" theme="light" withSubtitle={false} />
        </View>

        {/* Brand Tagline */}
        <View style={styles.taglineBox}>
          <Text style={styles.taglineText}>Growth Enabling Logiworkx Partner</Text>
          <View style={styles.accentBar} />
          <Text style={styles.subtext}>
            Enterprise Field Operations & Logistics Orchestration
          </Text>
        </View>

        {/* Single Primary Sign In Action */}
        <Animated.View style={[styles.ctaWrapper, { transform: [{ scale: pulseAnim }] }]}>
          <TouchableOpacity
            style={styles.signInBtn}
            onPress={onGetStarted}
            activeOpacity={0.88}
          >
            <Text style={styles.signInBtnText}>Sign in</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Footer info */}
        <Text style={styles.footerNote}>
          Verified On-Field Intelligence & Real-Time Sync
        </Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.navyDeep,
    justifyContent: 'space-between',
    padding: spacing.xl,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingTop: spacing.md,
  },
  skipBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceDark,
    borderWidth: 1,
    borderColor: colors.borderDark,
  },
  skipBtnText: {
    color: colors.textLightMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: spacing.huge,
  },
  logoBox: {
    marginBottom: spacing.xl,
    alignItems: 'center',
  },
  taglineBox: {
    alignItems: 'center',
    marginBottom: spacing.huge,
    paddingHorizontal: spacing.md,
  },
  taglineText: {
    color: colors.textLight,
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  accentBar: {
    width: 48,
    height: 3,
    backgroundColor: '#d9531e',
    borderRadius: 2,
    marginVertical: spacing.md,
  },
  subtext: {
    color: colors.textLightMuted,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  ctaWrapper: {
    width: '100%',
    maxWidth: 320,
  },
  signInBtn: {
    backgroundColor: '#d9531e',
    paddingVertical: 16,
    borderRadius: radius.md,
    alignItems: 'center',
    shadowColor: '#d9531e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  signInBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  footerNote: {
    color: colors.textLightMuted,
    fontSize: 11,
    textAlign: 'center',
    marginTop: spacing.xl,
    fontFamily: 'monospace',
  },
});
