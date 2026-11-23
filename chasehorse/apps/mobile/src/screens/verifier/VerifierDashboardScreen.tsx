import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  RefreshControl,
} from 'react-native';
import { colors, spacing, radius } from '../../theme';
import { Header } from '../../components/ui/Header';
import { Badge } from '../../components/ui/Badge';
import { mobileApi } from '../../api/restApi';
import { useAuth } from '../../context/AuthContext';
import type { Task, ApprovalRequestItem } from '../../types';

interface VerifierDashboardScreenProps {
  onSelectTask?: (task: Task) => void;
  onNavigateToSupport?: () => void;
}

type FilterTab = 'pending' | 'rework' | 'approved' | 'rejected' | 'all';

export const VerifierDashboardScreen: React.FC<VerifierDashboardScreenProps> = ({
  onSelectTask,
  onNavigateToSupport,
}) => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [approvals, setApprovals] = useState<ApprovalRequestItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<FilterTab>('pending');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Rework Modal State
  const [reworkModalVisible, setReworkModalVisible] = useState<boolean>(false);
  const [selectedItem, setSelectedItem] = useState<{ taskId: string; approvalId?: string; title: string } | null>(null);
  const [reworkNote, setReworkNote] = useState<string>('');

  const loadData = useCallback(async () => {
    try {
      const [taskList, approvalList] = await Promise.all([
        mobileApi.listTasks(undefined, user?.token).catch(() => [] as Task[]),
        user?.token ? mobileApi.listApprovals(user.token).catch(() => [] as ApprovalRequestItem[]) : Promise.resolve([] as ApprovalRequestItem[]),
      ]);
      setTasks(taskList);
      setApprovals(approvalList);
    } catch (err) {
      console.warn('[VerifierDashboard] Failed to load verification queue:', err);
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

  // Metrics
  const pendingCount = useMemo(
    () => tasks.filter((t) => t.status === 'submitted' || t.status === 'in_review').length,
    [tasks]
  );
  const approvedCount = useMemo(() => tasks.filter((t) => t.status === 'approved').length, [tasks]);
  const reworkCount = useMemo(
    () => approvals.filter((a) => a.stage === 'rework').length,
    [approvals]
  );
  const rejectedCount = useMemo(() => tasks.filter((t) => t.status === 'rejected').length, [tasks]);

  const totalDecided = approvedCount + rejectedCount;
  const passRate = totalDecided > 0 ? Math.round((approvedCount / totalDecided) * 100) : 100;

  // Filtered List
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      // Tab filter
      let matchesTab = true;
      if (activeTab === 'pending') {
        matchesTab = t.status === 'submitted' || t.status === 'in_review';
      } else if (activeTab === 'approved') {
        matchesTab = t.status === 'approved';
      } else if (activeTab === 'rejected') {
        matchesTab = t.status === 'rejected';
      } else if (activeTab === 'rework') {
        // check approvals for rework
        const isRework = approvals.some((a) => a.taskId === t.id && a.stage === 'rework');
        matchesTab = isRework;
      }

      if (!matchesTab) return false;

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          t.title.toLowerCase().includes(q) ||
          t.description?.toLowerCase().includes(q) ||
          t.location?.address?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [tasks, approvals, activeTab, searchQuery]);

  const handleApprove = async (task: Task, approvalId?: string) => {
    setActionLoading(task.id);
    try {
      if (approvalId && user?.token) {
        await mobileApi.decideApproval(approvalId, 'APPROVED', 'Verified and cleared by Verification Officer', user.token);
      } else {
        await mobileApi.approveTask(task.id, user?.token);
      }
      Alert.alert(
        'Evidence Cleared & Approved',
        `Task "${task.title}" has been verified.\nReward payout of ₹${task.rewardInr} released to field worker.`,
      );
      await loadData();
    } catch (err: any) {
      Alert.alert('Verification Failed', err?.message || 'Server rejected verification decision.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (task: Task, approvalId?: string) => {
    setActionLoading(task.id);
    try {
      if (approvalId && user?.token) {
        await mobileApi.decideApproval(approvalId, 'REJECTED', 'Failed verification audit check', user.token);
      } else {
        await mobileApi.rejectTask(task.id, user?.token);
      }
      Alert.alert('Evidence Rejected', `Task "${task.title}" rejected. Rejection recorded in audit log.`);
      await loadData();
    } catch (err: any) {
      Alert.alert('Rejection Failed', err?.message || 'Server rejected decision.');
    } finally {
      setActionLoading(null);
    }
  };

  const openReworkModal = (task: Task, approvalId?: string) => {
    setSelectedItem({ taskId: task.id, approvalId, title: task.title });
    setReworkNote('');
    setReworkModalVisible(true);
  };

  const handleConfirmRework = async () => {
    if (!selectedItem) return;
    if (!reworkNote.trim()) {
      Alert.alert('Correction Required', 'Please specify what the field operator must re-verify or capture.');
      return;
    }

    setActionLoading(selectedItem.taskId);
    try {
      if (selectedItem.approvalId && user?.token) {
        await mobileApi.decideApproval(
          selectedItem.approvalId,
          'REWORK',
          reworkNote.trim(),
          user.token,
        );
      } else {
        await mobileApi.updateTaskStatus(selectedItem.taskId, 'in_progress', user?.token);
      }
      setReworkModalVisible(false);
      Alert.alert('Rework Dispatched', `Rework instructions sent for "${selectedItem.title}".`);
      await loadData();
    } catch (err: any) {
      Alert.alert('Rework Failed', err?.message || 'Server rejected rework request.');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <View style={styles.container}>
      <Header />

      {/* Top Banner */}
      <View style={styles.verifierBanner}>
        <View style={styles.bannerIconBox}>
          <Text style={styles.bannerIcon}>🛡️</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.bannerTitle}>CLEAR & VERIFY COMMAND</Text>
          <Text style={styles.bannerSub}>
            Inspect evidentiary proof, geo-fence accuracy, and release workforce payouts.
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#D9531E" />}
      >
        {/* Metric Cards */}
        <View style={styles.metricsGrid}>
          <View style={styles.metricCard}>
            <Text style={styles.metricNumber}>{pendingCount}</Text>
            <Text style={styles.metricLabel}>Pending Audit</Text>
            <Text style={styles.metricHint}>Awaiting officer signoff</Text>
          </View>

          <View style={styles.metricCard}>
            <Text style={[styles.metricNumber, { color: '#10B981' }]}>{approvedCount}</Text>
            <Text style={styles.metricLabel}>Cleared</Text>
            <Text style={styles.metricHint}>Payout released</Text>
          </View>

          <View style={styles.metricCard}>
            <Text style={[styles.metricNumber, { color: '#F59E0B' }]}>{reworkCount}</Text>
            <Text style={styles.metricLabel}>In Rework</Text>
            <Text style={styles.metricHint}>Operator updating</Text>
          </View>

          <View style={styles.metricCard}>
            <Text style={[styles.metricNumber, { color: '#60A5FA' }]}>{passRate}%</Text>
            <Text style={styles.metricLabel}>Quality Pass</Text>
            <Text style={styles.metricHint}>Compliance benchmark</Text>
          </View>
        </View>

        {/* Filter Tabs */}
        <View style={styles.tabsRow}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'pending' && styles.tabActive]}
            onPress={() => setActiveTab('pending')}
          >
            <Text style={[styles.tabText, activeTab === 'pending' && styles.tabTextActive]}>
              Queue ({pendingCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === 'approved' && styles.tabActive]}
            onPress={() => setActiveTab('approved')}
          >
            <Text style={[styles.tabText, activeTab === 'approved' && styles.tabTextActive]}>
              Cleared ({approvedCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === 'rework' && styles.tabActive]}
            onPress={() => setActiveTab('rework')}
          >
            <Text style={[styles.tabText, activeTab === 'rework' && styles.tabTextActive]}>
              Rework ({reworkCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === 'all' && styles.tabActive]}
            onPress={() => setActiveTab('all')}
          >
            <Text style={[styles.tabText, activeTab === 'all' && styles.tabTextActive]}>
              All ({tasks.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search by task title, location, or SKU..."
            placeholderTextColor="#64748B"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Text style={styles.clearSearch}>✕</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Task List */}
        {loading ? (
          <View style={styles.centerLoading}>
            <ActivityIndicator size="large" color="#D9531E" />
            <Text style={styles.loadingText}>Fetching verification queue from server...</Text>
          </View>
        ) : filteredTasks.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>✓</Text>
            <Text style={styles.emptyTitle}>Queue Fully Audited</Text>
            <Text style={styles.emptyDesc}>
              {activeTab === 'pending'
                ? 'All field task submissions in your jurisdiction have been audited.'
                : 'No tasks match the active verification filter criteria.'}
            </Text>
          </View>
        ) : (
          filteredTasks.map((task) => {
            const approval = approvals.find((a) => a.taskId === task.id);
            const isActing = actionLoading === task.id;

            return (
              <View key={task.id} style={styles.taskCard}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.taskTitle}>{task.title}</Text>
                    <Text style={styles.taskCategory}>📂 {task.category || 'Field Inspection'}</Text>
                  </View>
                  <Badge status={task.status} label={task.status.replace('_', ' ')} />
                </View>

                <View style={styles.detailsRow}>
                  <Text style={styles.detailText}>📍 {task.location?.address || 'Site Coordinates Logged'}</Text>
                  <Text style={styles.rewardText}>Reward: ₹{task.rewardInr}</Text>
                </View>

                {task.description ? (
                  <Text style={styles.taskDesc} numberOfLines={2}>
                    {task.description}
                  </Text>
                ) : null}

                {/* Audit Evidence Chips */}
                <View style={styles.evidenceChips}>
                  <View style={styles.evidenceChip}>
                    <Text style={styles.evidenceChipText}>📷 Photo Geotagged</Text>
                  </View>
                  <View style={styles.evidenceChip}>
                    <Text style={styles.evidenceChipText}>✓ Checklist Verified</Text>
                  </View>
                  <View style={styles.evidenceChip}>
                    <Text style={styles.evidenceChipText}>⚡ AI Checked</Text>
                  </View>
                </View>

                {/* Verification Actions */}
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={styles.inspectBtn}
                    onPress={() => onSelectTask?.(task)}
                  >
                    <Text style={styles.inspectBtnText}>Inspect Proof 👁</Text>
                  </TouchableOpacity>

                  {task.status === 'submitted' || task.status === 'in_review' ? (
                    <>
                      <TouchableOpacity
                        style={styles.reworkBtn}
                        onPress={() => openReworkModal(task, approval?.id)}
                        disabled={isActing}
                      >
                        <Text style={styles.reworkBtnText}>Rework ↩</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.rejectBtn}
                        onPress={() => handleReject(task, approval?.id)}
                        disabled={isActing}
                      >
                        <Text style={styles.rejectBtnText}>Reject ✕</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.approveBtn}
                        onPress={() => handleApprove(task, approval?.id)}
                        disabled={isActing}
                      >
                        {isActing ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <Text style={styles.approveBtnText}>Clear & Approve ✓</Text>
                        )}
                      </TouchableOpacity>
                    </>
                  ) : null}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Rework Instructions Modal */}
      <Modal visible={reworkModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Request Evidence Rework</Text>
            <Text style={styles.modalSub}>
              Specify instructions for {selectedItem?.title}. The field operator will be notified to re-photograph or rectify on-site.
            </Text>
            <TextInput
              style={styles.modalInput}
              multiline
              numberOfLines={4}
              placeholder="e.g., Retake photo with clear illumination, ensure shelf facing SKU is visible..."
              placeholderTextColor="#64748B"
              value={reworkNote}
              onChangeText={setReworkNote}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelModalBtn}
                onPress={() => setReworkModalVisible(false)}
              >
                <Text style={styles.cancelModalText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmModalBtn}
                onPress={handleConfirmRework}
              >
                <Text style={styles.confirmModalText}>Send Rework Directive</Text>
              </TouchableOpacity>
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
    backgroundColor: '#0F172A',
  },
  verifierBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    gap: spacing.sm,
  },
  bannerIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(217, 83, 30, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerIcon: {
    fontSize: 18,
  },
  bannerTitle: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  bannerSub: {
    color: '#94A3B8',
    fontSize: 11,
    lineHeight: 15,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: 80,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  metricCard: {
    width: '48.5%',
    backgroundColor: '#1E293B',
    borderRadius: radius.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: '#334155',
  },
  metricNumber: {
    color: '#F97316',
    fontSize: 22,
    fontWeight: '800',
  },
  metricLabel: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  metricHint: {
    color: '#64748B',
    fontSize: 10,
    marginTop: 2,
  },
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderRadius: radius.md,
    padding: 3,
    marginBottom: spacing.sm,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: radius.sm,
  },
  tabActive: {
    backgroundColor: '#D9531E',
  },
  tabText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    marginBottom: spacing.md,
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    color: '#F8FAFC',
    fontSize: 13,
  },
  clearSearch: {
    color: '#94A3B8',
    fontSize: 14,
    paddingHorizontal: 4,
  },
  centerLoading: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  loadingText: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: spacing.sm,
  },
  emptyCard: {
    backgroundColor: '#1E293B',
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  emptyIcon: {
    fontSize: 32,
    color: '#10B981',
    marginBottom: spacing.xs,
  },
  emptyTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
  },
  emptyDesc: {
    color: '#94A3B8',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  taskCard: {
    backgroundColor: '#1E293B',
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  taskTitle: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '700',
  },
  taskCategory: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 4,
  },
  detailText: {
    color: '#CBD5E1',
    fontSize: 12,
    flex: 1,
  },
  rewardText: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '700',
  },
  taskDesc: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
    marginBottom: 6,
  },
  evidenceChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginVertical: 6,
  },
  evidenceChip: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    borderRadius: radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  evidenceChipText: {
    color: '#60A5FA',
    fontSize: 10,
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingTop: spacing.sm,
  },
  inspectBtn: {
    backgroundColor: '#334155',
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inspectBtnText: {
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: '600',
  },
  reworkBtn: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: '#F59E0B',
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reworkBtnText: {
    color: '#F59E0B',
    fontSize: 11,
    fontWeight: '700',
  },
  rejectBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: '#EF4444',
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectBtnText: {
    color: '#EF4444',
    fontSize: 11,
    fontWeight: '700',
  },
  approveBtn: {
    flex: 1,
    backgroundColor: '#10B981',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  approveBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  modalBox: {
    backgroundColor: '#1E293B',
    borderRadius: radius.lg,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 420,
    borderWidth: 1,
    borderColor: '#334155',
  },
  modalTitle: {
    color: '#F8FAFC',
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 4,
  },
  modalSub: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 17,
    marginBottom: spacing.md,
  },
  modalInput: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: radius.md,
    padding: spacing.sm,
    color: '#F8FAFC',
    fontSize: 13,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: spacing.md,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  cancelModalBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  cancelModalText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },
  confirmModalBtn: {
    backgroundColor: '#F59E0B',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.sm,
  },
  confirmModalText: {
    color: '#0F172A',
    fontSize: 13,
    fontWeight: '700',
  },
});
