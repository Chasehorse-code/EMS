import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { colors, spacing, radius } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { ChaseHorseLogo } from '../../components/ChaseHorseLogo';

interface LoginScreenProps {
  onBackToLanding?: () => void;
  onNavigateToRegisterEmployee: () => void;
  onNavigateToRegisterCustomer: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onBackToLanding,
  onNavigateToRegisterEmployee,
  onNavigateToRegisterCustomer,
}) => {
  const { login, verifyOtp, resendOtp, signInWithOtp, resetPassword } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otpRequired, setOtpRequired] = useState(false);
  const [otpType, setOtpType] = useState<'signup' | 'email'>('signup');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [cooldown, setCooldown] = useState(0);

  // Resend countdown timer
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const handleSignIn = async () => {
    setErrorMessage('');
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setErrorMessage('Please enter your corporate email address.');
      return;
    }

    if (!emailRegex.test(trimmedEmail)) {
      setErrorMessage('Please enter a valid email address (e.g. name@company.com).');
      return;
    }

    if (!password) {
      setErrorMessage('Please enter your account password.');
      return;
    }

    setLoading(true);
    try {
      const res = await login(trimmedEmail, password);
      if (res.requiresOtp) {
        setOtpRequired(true);
        setOtpType('signup');
        setCooldown(60);
      }
    } catch (err: any) {
      const msg = err?.message || 'Authentication failed. Please verify your credentials.';
      setErrorMessage(msg);
      if (err?.code === 'EMAIL_NOT_CONFIRMED' || msg.toLowerCase().includes('email not confirmed')) {
        setOtpRequired(true);
        setOtpType('signup');
        setCooldown(60);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtpLogin = async () => {
    setErrorMessage('');
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setErrorMessage('Please enter your registered email address.');
      return;
    }

    if (!emailRegex.test(trimmedEmail)) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    const res = await signInWithOtp(trimmedEmail);
    setLoading(false);

    if (res.success) {
      setOtpRequired(true);
      setOtpType('email');
      setCooldown(60);
      Alert.alert(
        'Security Code Sent',
        `A 6-digit verification code has been dispatched to ${trimmedEmail}.`,
      );
    } else {
      setErrorMessage(res.error || 'Failed to dispatch security code.');
    }
  };

  const handleVerifyOtp = async () => {
    setErrorMessage('');
    const trimmedOtp = otp.trim();

    if (trimmedOtp.length < 6) {
      setErrorMessage('Please enter the full 6-digit verification security code.');
      return;
    }

    setLoading(true);
    const res = await verifyOtp(email.trim(), trimmedOtp, otpType);
    setLoading(false);

    if (!res.success) {
      setErrorMessage(res.error || 'Invalid or expired verification code. Please request a new one.');
    }
  };

  const handleResendOtp = async () => {
    if (cooldown > 0) return;
    setErrorMessage('');
    setLoading(true);
    const res = await resendOtp(email.trim(), otpType);
    setLoading(false);

    if (res.success) {
      setCooldown(60);
      Alert.alert('Code Dispatched', `A fresh verification code was sent to ${email.trim()}.`);
    } else {
      setErrorMessage(res.error || 'Failed to resend verification code.');
    }
  };

  const handleForgotPassword = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !emailRegex.test(trimmedEmail)) {
      Alert.alert('Email Required', 'Please enter your corporate email address above first.');
      return;
    }

    setLoading(true);
    const res = await resetPassword(trimmedEmail);
    setLoading(false);

    if (res.success) {
      Alert.alert(
        'Password Reset Sent',
        `If an account exists for ${trimmedEmail}, password recovery instructions have been dispatched.`,
      );
    } else {
      Alert.alert('Request Failed', res.error || 'Unable to send password recovery instructions.');
    }
  };

  const fillQuickDemo = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('Password@123');
    setErrorMessage('');
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        
        {/* Top Back Navigation if coming from Landing */}
        {onBackToLanding && (
          <TouchableOpacity style={styles.backBtn} onPress={onBackToLanding}>
            <Text style={styles.backBtnText}>← Back to Overview</Text>
          </TouchableOpacity>
        )}

        {/* Upside Brand Hero */}
        <View style={styles.brandHero}>
          <ChaseHorseLogo size="lg" theme="dark" withSubtitle={true} />
          <Text style={styles.unifiedTag}>SINGLE ENTERPRISE LOGIN</Text>
        </View>

        {/* Main Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {otpRequired ? 'Security Verification' : 'Sign In to ChaseHorse'}
          </Text>
          <Text style={styles.cardDesc}>
            {otpRequired
              ? `Enter the 6-digit verification code sent to ${email.trim()}`
              : 'Enter your credentials to access your verified role dashboard.'}
          </Text>

          {/* Inline Error Banner */}
          {errorMessage ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorIcon}>⚠️</Text>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}

          {!otpRequired ? (
            <>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Corporate Email Address *</Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={(val) => {
                    setEmail(val);
                    if (errorMessage) setErrorMessage('');
                  }}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  placeholder="name@company.com"
                  placeholderTextColor={colors.textLightMuted}
                  editable={!loading}
                />
              </View>

              <View style={styles.inputGroup}>
                <View style={styles.passwordLabelRow}>
                  <Text style={styles.label}>Password *</Text>
                  <TouchableOpacity onPress={handleForgotPassword} disabled={loading}>
                    <Text style={styles.forgotPasswordText}>Forgot?</Text>
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={(val) => {
                    setPassword(val);
                    if (errorMessage) setErrorMessage('');
                  }}
                  secureTextEntry
                  placeholder="••••••••••••"
                  placeholderTextColor={colors.textLightMuted}
                  editable={!loading}
                />
              </View>

              <TouchableOpacity
                style={[styles.primaryBtn, loading && styles.btnDisabled]}
                onPress={handleSignIn}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.primaryBtnText}>Sign In to Account →</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={{ marginTop: spacing.md, alignItems: 'center' }}
                onPress={handleSendOtpLogin}
                disabled={loading}
              >
                <Text style={{ color: colors.textLightMuted, fontSize: 11, textDecorationLine: 'underline' }}>
                  Send one-time email code instead
                </Text>
              </TouchableOpacity>

              {/* Quick Fill Credentials Chips for Testing */}
              <View style={styles.quickFillSection}>
                <Text style={styles.quickFillLabel}>EVALUATION PERSONAS (PW: Password@123)</Text>
                <View style={styles.chipsRow}>
                  <TouchableOpacity
                    style={styles.chip}
                    onPress={() => fillQuickDemo('admindemo@chasehorse.com')}
                  >
                    <Text style={styles.chipText}>👑 Admin</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.chip}
                    onPress={() => fillQuickDemo('opsdemo@chasehorse.com')}
                  >
                    <Text style={styles.chipText}>💼 Operations</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.chip}
                    onPress={() => fillQuickDemo('workerdemo@chasehorse.com')}
                  >
                    <Text style={styles.chipText}>👷 Worker</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.chip}
                    onPress={() => fillQuickDemo('customerdemo@chasehorse.com')}
                  >
                    <Text style={styles.chipText}>🏢 Customer</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </>
          ) : (
            <>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>6-Digit Security Code *</Text>
                <TextInput
                  style={[styles.input, styles.otpInput]}
                  value={otp}
                  onChangeText={(val) => {
                    setOtp(val.replace(/[^0-9]/g, ''));
                    if (errorMessage) setErrorMessage('');
                  }}
                  keyboardType="number-pad"
                  maxLength={6}
                  placeholder="000000"
                  placeholderTextColor={colors.textLightMuted}
                  editable={!loading}
                />
              </View>

              <TouchableOpacity
                style={[styles.primaryBtn, loading && styles.btnDisabled]}
                onPress={handleVerifyOtp}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.primaryBtnText}>Confirm Code & Sign In ✓</Text>
                )}
              </TouchableOpacity>

              <View style={styles.otpActionRow}>
                <TouchableOpacity
                  style={styles.resendBtn}
                  onPress={handleResendOtp}
                  disabled={loading || cooldown > 0}
                >
                  <Text style={[styles.resendText, cooldown > 0 && styles.resendDisabled]}>
                    {cooldown > 0 ? `Resend Code in ${cooldown}s` : 'Resend Code'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.cancelOtpBtn}
                  onPress={() => {
                    setOtpRequired(false);
                    setErrorMessage('');
                  }}
                  disabled={loading}
                >
                  <Text style={styles.cancelOtpText}>← Back to Password</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>

        {/* Registration Links */}
        <View style={styles.regSection}>
          <Text style={styles.regPrompt}>Don't have an enterprise account?</Text>
          <View style={styles.regLinksRow}>
            <TouchableOpacity style={styles.linkBtn} onPress={onNavigateToRegisterEmployee}>
              <Text style={styles.linkText}>Register Field Worker</Text>
            </TouchableOpacity>
            <Text style={styles.bullet}>•</Text>
            <TouchableOpacity style={styles.linkBtn} onPress={onNavigateToRegisterCustomer}>
              <Text style={styles.linkText}>Register Client Entity</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#0F172A',
    padding: spacing.lg,
    justifyContent: 'center',
    maxWidth: 520,
    alignSelf: 'center',
    width: '100%',
  },
  backBtn: {
    marginBottom: spacing.md,
    alignSelf: 'flex-start',
  },
  backBtnText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },
  brandHero: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  unifiedTag: {
    color: '#F97316',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginTop: spacing.xs,
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: radius.xl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: '#334155',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  cardTitle: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: spacing.xs,
  },
  cardDesc: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: spacing.lg,
  },
  errorBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    borderRadius: radius.md,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  errorIcon: {
    fontSize: 16,
  },
  errorText: {
    color: '#F87171',
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
  inputGroup: {
    marginBottom: spacing.md,
  },
  label: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
  },
  passwordLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  forgotPasswordText: {
    color: '#F97316',
    fontSize: 12,
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    color: '#F8FAFC',
    fontSize: 15,
  },
  otpInput: {
    letterSpacing: 8,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '800',
  },
  primaryBtn: {
    backgroundColor: '#D9531E',
    paddingVertical: 14,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
    shadowColor: '#D9531E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryOptionBtn: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  secondaryOptionText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },
  quickFillSection: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  quickFillLabel: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'center',
  },
  chip: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#475569',
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  chipText: {
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: '600',
  },
  otpActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  resendBtn: {
    paddingVertical: spacing.xs,
  },
  resendText: {
    color: '#F97316',
    fontSize: 13,
    fontWeight: '600',
  },
  resendDisabled: {
    color: '#64748B',
  },
  cancelOtpBtn: {
    paddingVertical: spacing.xs,
  },
  cancelOtpText: {
    color: '#94A3B8',
    fontSize: 13,
  },
  regSection: {
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  regPrompt: {
    color: '#94A3B8',
    fontSize: 13,
    marginBottom: spacing.xs,
  },
  regLinksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  linkBtn: {
    paddingVertical: 4,
  },
  linkText: {
    color: '#F97316',
    fontSize: 13,
    fontWeight: '700',
  },
  bullet: {
    color: '#64748B',
  },
});
