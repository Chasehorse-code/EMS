import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Switch,
  Alert,
  Modal,
} from 'react-native';
import { colors, spacing, radius, typography } from '../../theme';
import { Header } from '../../components/ui/Header';
import { Card, Button, Input, StatusBadge } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { mobileApi } from '../../api/restApi';

export const EmployeeProfileScreen: React.FC<{ onNavigateToSupport?: () => void }> = ({
  onNavigateToSupport,
}) => {
  const { user, signOut, updatePassword } = useAuth();
  const [locationConsent, setLocationConsent] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(true);
  const [feedbackList, setFeedbackList] = useState<any[]>([]);

  // Password reset modal
  const [passwordModal, setPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [updatingPassword, setUpdatingPassword] = useState(false);

  useEffect(() => {
    if (user?.id) {
      mobileApi
        .getWorkerProfile(user.token)
        .then((profile) => setLocationConsent(Boolean(profile.locationConsent)))
        .catch(() => setLocationConsent(false));
      mobileApi
        .getEmployeeFeedback(user.id, user.token)
        .then((fb: any[]) => setFeedbackList(fb || []))
        .catch(() => setFeedbackList([]));
    }
  }, [user?.id, user?.token]);

  const handleToggleLocation = async (val: boolean) => {
    if (!user?.token) {
      Alert.alert('Sign in required', 'Your session has expired. Please sign in again.');
      return;
    }
    try {
      if (val) {
        await mobileApi.updateWorkerProfile({ locationConsent: true }, user.token);
      } else {
        await mobileApi.clearWorkerLocation(user.token);
      }
      setLocationConsent(val);
      if (!val) {
      Alert.alert(
        'Location Tracking Consent Withdrawn',
        'Stored dispatch coordinates have been erased. Nearby task discovery is unavailable until you grant consent and sync a new GPS fix.',
      );
      }
    } catch (error) {
      Alert.alert('Location preference not updated', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  const handleUpdatePassword = async () => {
    if (!newPassword || newPassword.length < 8) {
      Alert.alert('Invalid Password', 'New password must contain at least 8 characters.');
      return;
    }

    setUpdatingPassword(true);
    try {
      await updatePassword(newPassword);
      Alert.alert('Security Update', 'Account password updated successfully.');
      setPasswordModal(false);
      setNewPassword('');
    } catch (err: any) {
      Alert.alert('Update Failed', err.message || 'Could not update password.');
    } finally {
      setUpdatingPassword(false);
    }
  };

  const avgRating =
    feedbackList.length > 0
      ? (
          feedbackList.reduce((acc, f) => acc + (f.overallRating || 5), 0) /
          feedbackList.length
        ).toFixed(1)
      : 'No ratings yet';

  return (
    <View style={styles.container}>
      <Header
        title="Field Partner Portfolio"
        subtitle="Operational Identity & Workforce Credentials"
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Profile Identity Card */}
        <Card style={styles.profileCard}>
          <View style={styles.cardTop}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>
                {(user?.displayName || 'FW').slice(0, 2).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text style={styles.workerName}>{user?.displayName || 'Field Operator'}</Text>
              <Text style={styles.workerRole}>Verified Field Partner</Text>
              <View style={styles.statusRow}>
                <StatusBadge status={user?.accountStatus || 'ACTIVE'} size="sm" />
                <Text style={styles.ratingBadge}>★ {avgRating} ({feedbackList.length} reviews)</Text>
              </View>
            </View>
          </View>

          <View style={styles.detailsBox}>
            <Text style={styles.detailRow}>
              <Text style={styles.detailLabel}>Partner ID: </Text>
              {user?.id ? `EMP-${user.id.slice(0, 8).toUpperCase()}` : 'EMP-PENDING'}
            </Text>
            <Text style={styles.detailRow}>
              <Text style={styles.detailLabel}>Email: </Text>
              {user?.email}
            </Text>
            <Text style={styles.detailRow}>
              <Text style={styles.detailLabel}>Phone: </Text>
              {user?.phone || '+91 • Not Linked'}
            </Text>
            <Text style={styles.detailRow}>
              <Text style={styles.detailLabel}>State Jurisdiction: </Text>
              {user?.region || 'Not assigned'}
            </Text>
          </View>
        </Card>

        {/* Permissions & Compliance */}
        <Card style={styles.card}>
          <Text style={styles.sectionHeader}>PRIVACY & DEVICE DISPATCH</Text>

          <View style={styles.switchRow}>
            <View style={{ flex: 1, paddingRight: spacing.md }}>
              <Text style={styles.switchTitle}>GPS Location Consent</Text>
              <Text style={styles.switchSub}>
                Allow dispatch server to match nearby tasks within 100 km radius.
              </Text>
            </View>
            <Switch
              value={locationConsent}
              onValueChange={handleToggleLocation}
              trackColor={{ false: colors.borderLight, true: colors.primaryOrange }}
            />
          </View>

          <View style={[styles.switchRow, { borderBottomWidth: 0 }]}>
            <View style={{ flex: 1, paddingRight: spacing.md }}>
              <Text style={styles.switchTitle}>Field Task Notifications</Text>
              <Text style={styles.switchSub}>
                Receive alerts for bounty releases, rework requests, and manager decisions.
              </Text>
            </View>
            <Switch
              value={pushEnabled}
              onValueChange={setPushEnabled}
              trackColor={{ false: colors.borderLight, true: colors.primaryOrange }}
            />
          </View>
        </Card>

        {/* Customer Feedback History */}
        <Card style={styles.card}>
          <Text style={styles.sectionHeader}>RECENT CUSTOMER REVIEWS</Text>
          {feedbackList.length === 0 ? (
            <Text style={styles.emptyFeedback}>
              No verified customer reviews yet. Reviews appear automatically upon task approval.
            </Text>
          ) : (
            feedbackList.slice(0, 3).map((fb, idx) => (
              <View key={idx} style={styles.reviewItem}>
                <View style={styles.reviewHeader}>
                  <Text style={styles.reviewTask}>{fb.taskTitle || 'Audit Verification'}</Text>
                  <Text style={styles.reviewRating}>★ {fb.overallRating}/5</Text>
                </View>
                {fb.comment && <Text style={styles.reviewComment}>"{fb.comment}"</Text>}
                <Text style={styles.reviewDate}>Verified Customer Review</Text>
              </View>
            ))
          )}
        </Card>

        {/* Account Actions */}
        <Card style={styles.card}>
          <Text style={styles.sectionHeader}>SECURITY & SUPPORT</Text>

          <TouchableOpacity
            style={styles.actionRow}
            onPress={() => setPasswordModal(true)}
          >
            <Text style={styles.actionIcon}>🔒</Text>
            <Text style={styles.actionText}>Change Account Password</Text>
            <Text style={styles.chevron}>→</Text>
          </TouchableOpacity>

          {onNavigateToSupport && (
            <TouchableOpacity
              style={styles.actionRow}
              onPress={onNavigateToSupport}
            >
              <Text style={styles.actionIcon}>🎫</Text>
              <Text style={styles.actionText}>Field Support Tickets Desk</Text>
              <Text style={styles.chevron}>→</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.actionRow, { borderBottomWidth: 0 }]}
            onPress={signOut}
          >
            <Text style={styles.actionIcon}>🚪</Text>
            <Text style={[styles.actionText, { color: colors.danger }]}>Sign Out of Partner Account</Text>
            <Text style={styles.chevron}>→</Text>
          </TouchableOpacity>
        </Card>
      </ScrollView>

      {/* Change Password Modal */}
      <Modal visible={passwordModal} animationType="slide" transparent onRequestClose={() => setPasswordModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Change Account Password</Text>
              <TouchableOpacity onPress={() => setPasswordModal(false)}>
                <Text style={styles.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={{ padding: spacing.lg }}>
              <Input
                label="New Password"
                placeholder="Minimum 8 characters"
                value={newPassword}
                onChangeText={setNewPassword}
                isPassword
              />

              <Button
                title={updatingPassword ? 'Updating...' : 'Save Password'}
                onPress={handleUpdatePassword}
                loading={updatingPassword}
                style={{ marginTop: spacing.md }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.huge * 2,
  },
  profileCard: {
    marginBottom: spacing.md,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  avatarCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primaryBlack,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    ...typography.titleMedium,
    color: '#F3F1EB',
    fontWeight: '800',
  },
  workerName: {
    ...typography.titleMedium,
    color: colors.ink,
  },
  workerRole: {
    ...typography.caption,
    color: colors.textDarkMuted,
    marginTop: 1,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
    gap: spacing.sm,
  },
  ratingBadge: {
    ...typography.caption,
    color: '#B7791F',
    fontWeight: '700',
  },
  detailsBox: {
    backgroundColor: colors.surfaceSunken || '#EBE7DE',
    borderRadius: radius.md,
    padding: spacing.md,
  },
  detailRow: {
    ...typography.bodySmall,
    color: colors.ink,
    marginBottom: 4,
  },
  detailLabel: {
    fontWeight: '700',
    color: colors.textDarkMuted,
  },
  card: {
    marginBottom: spacing.md,
  },
  sectionHeader: {
    ...typography.caption,
    color: colors.textDarkMuted,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: spacing.md,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  switchTitle: {
    ...typography.bodyMedium,
    fontWeight: '600',
    color: colors.ink,
  },
  switchSub: {
    ...typography.caption,
    color: colors.textDarkMuted,
    marginTop: 2,
    lineHeight: 16,
  },
  emptyFeedback: {
    ...typography.caption,
    color: colors.textDarkMuted,
    fontStyle: 'italic',
  },
  reviewItem: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    paddingVertical: spacing.sm,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  reviewTask: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.ink,
  },
  reviewRating: {
    ...typography.caption,
    color: '#B7791F',
    fontWeight: '700',
  },
  reviewComment: {
    ...typography.bodySmall,
    color: colors.textDarkMuted,
    fontStyle: 'italic',
    marginTop: 2,
  },
  reviewDate: {
    ...typography.caption,
    color: colors.textDarkMuted,
    fontSize: 9,
    marginTop: 2,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  actionIcon: {
    fontSize: 18,
    marginRight: spacing.md,
  },
  actionText: {
    ...typography.bodyMedium,
    fontWeight: '600',
    color: colors.ink,
    flex: 1,
  },
  chevron: {
    fontSize: 16,
    color: colors.textDarkMuted,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(21, 21, 21, 0.65)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  modalTitle: {
    ...typography.titleMedium,
    color: colors.ink,
  },
  closeBtn: {
    fontSize: 20,
    color: colors.textDarkMuted,
  },
});
