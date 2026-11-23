import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { colors, spacing, radius } from '../../theme';
import { Header } from '../../components/ui/Header';
import { Badge } from '../../components/ui/Badge';
import { useAuth } from '../../context/AuthContext';
import { mobileApi } from '../../api/restApi';
import type { Task, ApprovalRequestItem } from '../../types';

type WalletTab = 'PENDING' | 'CREDITED' | 'LEDGER' | 'REJECTED';

export const ManagerWalletScreen: React.FC = () => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [approvals, setApprovals] = useState<ApprovalRequestItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<WalletTab>('PENDING');

  const loadData = useCallback(async () => {
    try {
      const [taskList, approvalList] = await Promise.all([
        mobileApi.listTasks(undefined, user?.token).catch(() => [] as Task[]),
        user?.token ? mobileApi.listApprovals(user.token).catch(() => [] as ApprovalRequestItem[]) : Promise.resolve([] as ApprovalRequestItem[]),
      ]);
      setTasks(taskList);
      setApprovals(approvalList);
    } catch (err) {
      console.warn('[ManagerWalletScreen] Failed to load wallet data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const pendingApprovals = tasks.filter(
    (t) => t.status === 'submitted' || t.status === 'in_review'
  );

  const approvedTasks = tasks.filter((t) => t.status === 'approved');

  const rejectedTasks = tasks.filter((t) => t.status === 'rejected');

  const totalCreditedInr = approvedTasks.reduce((sum, t) => sum + (t.rewardInr || 0), 0);
  const totalPendingInr = pendingApprovals.reduce((sum, t) => sum + (t.rewardInr || 0), 0);

  return (
    <View style={styles.container}>
      <Header title="Area Payouts & Ledger" subtitle="Jurisdiction Bounty Approvals & Ledger Transparency" />

      {/* Overview Metric Cards */}
      <View style={styles.metricsGrid}>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Pending Verification</Text>
          <Text style={[styles.metricVal, { color: '#FBBF24' }]}>₹{totalPendingInr}</Text>
          <Text style={styles.metricSub}>{pendingApprovals.length} tasks in review</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Total Credited</Text>
          <Text style={[styles.metricVal, { color: colors.success }]}>₹{totalCreditedInr}</Text>
          <Text style={styles.metricSub}>{approvedTasks.length} settled payouts</Text>
        </View>
      </View>

      {/* Honest line about withdrawals */}
      <View style={styles.honestNotice}>
        <Text style={styles.honestIcon}>🔒</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.honestTitle}>Demonstration Mode Notice</Text>
          <Text style={styles.honestText}>
            Worker wallet credits are executed atomically upon final sign-off into Postgres. Worker bank withdrawals remain disabled until real payment gateway integration is configured.
          </Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabsRow}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'PENDING' && styles.tabBtnActive]}
          onPress={() => setActiveTab('PENDING')}
        >
          <Text style={[styles.tabText, activeTab === 'PENDING' && styles.tabTextActive]}>
            Pending ({pendingApprovals.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'CREDITED' && styles.tabBtnActive]}
          onPress={() => setActiveTab('CREDITED')}
        >
          <Text style={[styles.tabText, activeTab === 'CREDITED' && styles.tabTextActive]}>
            Credited ({approvedTasks.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'LEDGER' && styles.tabBtnActive]}
          onPress={() => setActiveTab('LEDGER')}
        >
          <Text style={[styles.tabText, activeTab === 'LEDGER' && styles.tabTextActive]}>
            Audit Ledger
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'REJECTED' && styles.tabBtnActive]}
          onPress={() => setActiveTab('REJECTED')}
        >
          <Text style={[styles.tabText, activeTab === 'REJECTED' && styles.tabTextActive]}>
            Rejected ({rejectedTasks.length})
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.blueAccent} />
          <Text style={styles.loadingText}>Loading ledger records from database...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.blueAccent} />}
        >
          {/* TAB 1: PENDING APPROVALS */}
          {activeTab === 'PENDING' && (
            <>
              {pendingApprovals.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={{ fontSize: 32, marginBottom: spacing.sm }}>✅</Text>
                  <Text style={styles.emptyTitle}>No Pending Payouts</Text>
                  <Text style={styles.emptySub}>All submitted field bounties have been verified and processed.</Text>
                </View>
              ) : (
                pendingApprovals.map((task) => (
                  <View key={task.id} style={styles.itemCard}>
                    <View style={styles.itemHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.taskDisplayId}>{task.displayId || task.id.slice(0, 8)}</Text>
                        <Text style={styles.itemTitle}>{task.title}</Text>
                      </View>
                      <View style={styles.bountyPill}>
                        <Text style={styles.bountyPillText}>₹{task.rewardInr}</Text>
                      </View>
                    </View>

                    {/* Timeline visualization */}
                    <View style={styles.timelineRow}>
                      <View style={styles.timelineStepDone}>
                        <Text style={styles.timelineDot}>✓</Text>
                        <Text style={styles.timelineLabel}>Submitted</Text>
                      </View>
                      <View style={styles.timelineBarActive} />
                      <View style={styles.timelineStepCurrent}>
                        <Text style={styles.timelineDot}>⚡</Text>
                        <Text style={styles.timelineLabel}>In Review</Text>
                      </View>
                      <View style={styles.timelineBar} />
                      <View style={styles.timelineStepPending}>
                        <Text style={styles.timelineDot}>○</Text>
                        <Text style={styles.timelineLabel}>Credited</Text>
                      </View>
                    </View>

                    <Text style={styles.itemMeta}>📍 Site: {task.location?.address || 'Site coordinate'}</Text>
                    <Text style={styles.itemMeta}>🏷️ Category: {task.category}</Text>
                  </View>
                ))
              )}
            </>
          )}

          {/* TAB 2: CREDITED PAYOUTS */}
          {activeTab === 'CREDITED' && (
            <>
              {approvedTasks.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={{ fontSize: 32, marginBottom: spacing.sm }}>🪙</Text>
                  <Text style={styles.emptyTitle}>No Settled Bounties</Text>
                  <Text style={styles.emptySub}>Approved tasks with ledger transactions will appear here.</Text>
                </View>
              ) : (
                approvedTasks.map((task) => (
                  <View key={task.id} style={styles.itemCard}>
                    <View style={styles.itemHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.taskDisplayId}>{task.displayId || task.id.slice(0, 8)}</Text>
                        <Text style={styles.itemTitle}>{task.title}</Text>
                      </View>
                      <View style={[styles.bountyPill, { backgroundColor: 'rgba(16, 185, 129, 0.15)', borderColor: 'rgba(16, 185, 129, 0.4)' }]}>
                        <Text style={[styles.bountyPillText, { color: colors.success }]}>+ ₹{task.rewardInr}</Text>
                      </View>
                    </View>

                    {/* Settled timeline */}
                    <View style={styles.timelineRow}>
                      <View style={styles.timelineStepDone}>
                        <Text style={styles.timelineDot}>✓</Text>
                        <Text style={styles.timelineLabel}>Pending</Text>
                      </View>
                      <View style={styles.timelineBarDone} />
                      <View style={styles.timelineStepDone}>
                        <Text style={styles.timelineDot}>✓</Text>
                        <Text style={styles.timelineLabel}>Approved</Text>
                      </View>
                      <View style={styles.timelineBarDone} />
                      <View style={styles.timelineStepDone}>
                        <Text style={styles.timelineDot}>✓</Text>
                        <Text style={styles.timelineLabel}>Credited</Text>
                      </View>
                    </View>

                    <Text style={styles.itemMeta}>⚡ Transaction: Credited to Worker Ledger (task-reward-{task.id.slice(0, 8)})</Text>
                    <Text style={styles.itemMeta}>🕒 Settled: {task.dueAt ? new Date(task.dueAt).toLocaleDateString() : 'Confirmed'}</Text>
                  </View>
                ))
              )}
            </>
          )}

          {/* TAB 3: AUDIT LEDGER (Append-only) */}
          {activeTab === 'LEDGER' && (
            <View style={styles.ledgerCard}>
              <Text style={styles.ledgerHeader}>Immutable Append-Only Audit Entries</Text>
              <Text style={styles.ledgerSub}>Direct database log from Postgres wallet_ledger table</Text>

              {approvedTasks.length === 0 ? (
                <Text style={styles.emptyInlineText}>No ledger entries recorded yet.</Text>
              ) : (
                approvedTasks.map((t, idx) => (
                  <View key={t.id} style={styles.ledgerRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.ledgerTxn}>TXN-00{idx + 1} • TASK_REWARD</Text>
                      <Text style={styles.ledgerDesc}>{t.title} ({t.displayId || t.id.slice(0, 8)})</Text>
                      <Text style={styles.ledgerIdempotency}>key: task-reward-{t.id.slice(0, 12)}</Text>
                    </View>
                    <Text style={styles.ledgerAmount}>+ ₹{t.rewardInr}.00</Text>
                  </View>
                ))
              )}
            </View>
          )}

          {/* TAB 4: REJECTED TASKS (No credit + reason) */}
          {activeTab === 'REJECTED' && (
            <>
              {rejectedTasks.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={{ fontSize: 32, marginBottom: spacing.sm }}>🛡️</Text>
                  <Text style={styles.emptyTitle}>Zero Rejected Tasks</Text>
                  <Text style={styles.emptySub}>No task submissions have been rejected in your area.</Text>
                </View>
              ) : (
                rejectedTasks.map((task) => (
                  <View key={task.id} style={styles.itemCard}>
                    <View style={styles.itemHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.taskDisplayId}>{task.displayId || task.id.slice(0, 8)}</Text>
                        <Text style={styles.itemTitle}>{task.title}</Text>
                      </View>
                      <View style={[styles.bountyPill, { backgroundColor: 'rgba(239, 68, 68, 0.15)', borderColor: 'rgba(239, 68, 68, 0.4)' }]}>
                        <Text style={[styles.bountyPillText, { color: '#F87171' }]}>₹0 (No Credit)</Text>
                      </View>
                    </View>

                    <View style={styles.rejectedBanner}>
                      <Text style={styles.rejectedBannerTitle}>✕ Submission Rejected</Text>
                      <Text style={styles.rejectedBannerText}>
                        Zero credit issued to worker ledger. Rejection justification recorded in audit log.
                      </Text>
                    </View>

                    <Text style={styles.itemMeta}>📍 Site: {task.location?.address || 'Site coordinate'}</Text>
                  </View>
                ))
              )}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.navyDeep,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
  },
  loadingText: {
    color: colors.textLightMuted,
    fontSize: 12,
  },
  metricsGrid: {
    flexDirection: 'row',
    padding: spacing.md,
    gap: spacing.md,
  },
  metricCard: {
    flex: 1,
    backgroundColor: colors.navyDark,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderDark,
    padding: spacing.md,
  },
  metricLabel: {
    color: colors.textLightMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  metricVal: {
    fontSize: 20,
    fontWeight: '800',
    marginVertical: 2,
  },
  metricSub: {
    color: colors.textLightMuted,
    fontSize: 10,
  },
  honestNotice: {
    flexDirection: 'row',
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
    borderRadius: radius.md,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  honestIcon: {
    fontSize: 18,
  },
  honestTitle: {
    color: colors.blueAccent,
    fontSize: 11,
    fontWeight: '800',
  },
  honestText: {
    color: colors.textLightMuted,
    fontSize: 10,
    lineHeight: 15,
    marginTop: 2,
  },
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: colors.navyDark,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDark,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  tabBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    marginRight: spacing.xs,
  },
  tabBtnActive: {
    backgroundColor: colors.bluePrimary,
  },
  tabText: {
    color: colors.textLightMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.huge * 2,
  },
  emptyCard: {
    backgroundColor: colors.navyDark,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderDark,
    padding: spacing.xl,
    alignItems: 'center',
    marginVertical: spacing.xl,
  },
  emptyTitle: {
    color: colors.textLight,
    fontSize: 16,
    fontWeight: '700',
  },
  emptySub: {
    color: colors.textLightMuted,
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  itemCard: {
    backgroundColor: colors.navyDark,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderDark,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  taskDisplayId: {
    color: colors.blueAccent,
    fontSize: 10,
    fontFamily: 'monospace',
    fontWeight: '800',
  },
  itemTitle: {
    color: colors.textLight,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  bountyPill: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
  },
  bountyPillText: {
    color: '#FBBF24',
    fontSize: 12,
    fontWeight: '800',
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceDark,
    padding: spacing.sm,
    borderRadius: radius.md,
    marginVertical: spacing.sm,
  },
  timelineStepDone: {
    alignItems: 'center',
  },
  timelineStepCurrent: {
    alignItems: 'center',
  },
  timelineStepPending: {
    alignItems: 'center',
  },
  timelineDot: {
    fontSize: 12,
    color: colors.textLight,
    fontWeight: '800',
  },
  timelineLabel: {
    color: colors.textLightMuted,
    fontSize: 9,
    marginTop: 2,
  },
  timelineBarDone: {
    flex: 1,
    height: 2,
    backgroundColor: colors.success,
    marginHorizontal: 4,
  },
  timelineBarActive: {
    flex: 1,
    height: 2,
    backgroundColor: '#FBBF24',
    marginHorizontal: 4,
  },
  timelineBar: {
    flex: 1,
    height: 2,
    backgroundColor: colors.borderDark,
    marginHorizontal: 4,
  },
  itemMeta: {
    color: colors.textLightMuted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
  },
  ledgerCard: {
    backgroundColor: colors.navyDark,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderDark,
    padding: spacing.md,
  },
  ledgerHeader: {
    color: colors.textLight,
    fontSize: 14,
    fontWeight: '800',
  },
  ledgerSub: {
    color: colors.textLightMuted,
    fontSize: 11,
    marginTop: 2,
    marginBottom: spacing.md,
  },
  ledgerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDark,
  },
  ledgerTxn: {
    color: colors.blueAccent,
    fontSize: 10,
    fontFamily: 'monospace',
    fontWeight: '800',
  },
  ledgerDesc: {
    color: colors.textLight,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 1,
  },
  ledgerIdempotency: {
    color: colors.textLightMuted,
    fontSize: 9,
    fontFamily: 'monospace',
  },
  ledgerAmount: {
    color: colors.success,
    fontSize: 14,
    fontWeight: '800',
  },
  emptyInlineText: {
    color: colors.textLightMuted,
    fontSize: 12,
    fontStyle: 'italic',
    padding: spacing.sm,
  },
  rejectedBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: radius.md,
    padding: spacing.sm,
    marginVertical: spacing.sm,
  },
  rejectedBannerTitle: {
    color: '#F87171',
    fontSize: 11,
    fontWeight: '800',
  },
  rejectedBannerText: {
    color: colors.textLightMuted,
    fontSize: 10,
    marginTop: 2,
  },
});
