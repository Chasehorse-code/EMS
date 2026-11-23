import React, { useEffect, useState, useCallback } from 'react';
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
import { useAuth } from '../../context/AuthContext';
import { mobileApi } from '../../api/restApi';

type WorkerTab = 'ALL' | 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'REJECTED';

interface WorkerItem {
  id: string;
  displayId?: string;
  displayName: string;
  email: string;
  phone?: string;
  region?: string;
  stateCode?: string;
  stateName?: string;
  accountStatus: string;
  rejectionReason?: string;
  rejectedBy?: string;
  roles?: string[];
  createdAt?: string;
}

export const EmployeeApprovalsScreen: React.FC = () => {
  const { user, approveAccount, rejectAccount, suspendAccount, reinstateAccount } = useAuth();
  const [workers, setWorkers] = useState<WorkerItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<WorkerTab>('PENDING');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Worker Detail Modal
  const [selectedWorker, setSelectedWorker] = useState<WorkerItem | null>(null);
  const [workerWallet, setWorkerWallet] = useState<{ balanceInr: number; pendingInr: number } | null>(null);
  const [loadingWallet, setLoadingWallet] = useState<boolean>(false);

  // Mandatory Reason Action Modal (for Reject or Suspend)
  const [reasonModalVisible, setReasonModalVisible] = useState<boolean>(false);
  const [reasonActionType, setReasonActionType] = useState<'REJECT' | 'SUSPEND'>('REJECT');
  const [targetWorker, setTargetWorker] = useState<WorkerItem | null>(null);
  const [reasonText, setReasonText] = useState<string>('');

  const loadWorkers = useCallback(async () => {
    try {
      const data = await mobileApi.listEmployees(user?.token);
      setWorkers(data as unknown as WorkerItem[]);
    } catch (err: any) {
      console.warn('[EmployeeApprovals] Failed to load workers:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.token]);

  useEffect(() => {
    loadWorkers();
  }, [loadWorkers]);

  const onRefresh = () => {
    setRefreshing(true);
    loadWorkers();
  };

  const handleOpenDetail = async (worker: WorkerItem) => {
    setSelectedWorker(worker);
    setWorkerWallet(null);
    setLoadingWallet(true);
    try {
      const wallet = await mobileApi.getWalletAccount(worker.id, user?.token);
      if (wallet) {
        setWorkerWallet({ balanceInr: wallet.balanceInr, pendingInr: wallet.pendingInr });
      }
    } catch {
      // Wallet may be empty
    } finally {
      setLoadingWallet(false);
    }
  };

  const handleApprove = async (worker: WorkerItem) => {
    setProcessingId(worker.id);
    try {
      await approveAccount(worker.id);
      Alert.alert(
        'Worker Approved',
        `Worker ${worker.displayName} (${worker.displayId || worker.id.slice(0, 8)}) is now ACTIVE.`
      );
      await loadWorkers();
      if (selectedWorker?.id === worker.id) {
        setSelectedWorker((prev) => (prev ? { ...prev, accountStatus: 'ACTIVE' } : null));
      }
    } catch (err: any) {
      Alert.alert('Approval Failed', err?.message || 'Unable to approve account on server.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleOpenReasonModal = (worker: WorkerItem, action: 'REJECT' | 'SUSPEND') => {
    setTargetWorker(worker);
    setReasonActionType(action);
    setReasonText('');
    setReasonModalVisible(true);
  };

  const handleConfirmReasonAction = async () => {
    if (!targetWorker) return;
    if (!reasonText.trim()) {
      Alert.alert(
        'Justification Required',
        `A justification reason is strictly required when ${
          reasonActionType === 'REJECT' ? 'rejecting' : 'suspending'
        } a worker account.`
      );
      return;
    }

    setProcessingId(targetWorker.id);
    setReasonModalVisible(false);

    try {
      if (reasonActionType === 'REJECT') {
        await rejectAccount(targetWorker.id, reasonText.trim());
        Alert.alert(
          'Worker Rejected',
          `Worker ${targetWorker.displayName} has been marked as REJECTED with recorded reason.`
        );
      } else {
        await suspendAccount(targetWorker.id, reasonText.trim());
        Alert.alert(
          'Worker Suspended',
          `Worker ${targetWorker.displayName} has been SUSPENDED. Tasks in progress have been paused.`
        );
      }
      await loadWorkers();
      if (selectedWorker?.id === targetWorker.id) {
        setSelectedWorker((prev) =>
          prev
            ? {
                ...prev,
                accountStatus: reasonActionType === 'REJECT' ? 'REJECTED' : 'SUSPENDED',
                rejectionReason: reasonText.trim(),
                rejectedBy: user?.displayName || 'Operations Staff',
              }
            : null
        );
      }
    } catch (err: any) {
      Alert.alert('Action Failed', err?.message || 'Server rejected status update.');
    } finally {
      setProcessingId(null);
      setTargetWorker(null);
    }
  };

  const handleReinstate = async (worker: WorkerItem) => {
    setProcessingId(worker.id);
    try {
      await reinstateAccount(worker.id);
      Alert.alert(
        'Worker Reinstated',
        `Worker ${worker.displayName} has been reinstated to ACTIVE status.`
      );
      await loadWorkers();
      if (selectedWorker?.id === worker.id) {
        setSelectedWorker((prev) =>
          prev ? { ...prev, accountStatus: 'ACTIVE', rejectionReason: undefined, rejectedBy: undefined } : null
        );
      }
    } catch (err: any) {
      Alert.alert('Reinstatement Failed', err?.message || 'Server rejected reinstatement.');
    } finally {
      setProcessingId(null);
    }
  };

  // Filtered workers list
  const filteredWorkers = workers.filter((w) => {
    const status = (w.accountStatus || '').toUpperCase();
    if (activeTab === 'PENDING' && status !== 'PENDING') return false;
    if (activeTab === 'ACTIVE' && status !== 'ACTIVE') return false;
    if (activeTab === 'SUSPENDED' && status !== 'SUSPENDED') return false;
    if (activeTab === 'REJECTED' && status !== 'REJECTED') return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchName = (w.displayName || '').toLowerCase().includes(q);
      const matchEmail = (w.email || '').toLowerCase().includes(q);
      const matchId = (w.displayId || '').toLowerCase().includes(q) || (w.id || '').toLowerCase().includes(q);
      const matchPhone = (w.phone || '').toLowerCase().includes(q);
      return matchName || matchEmail || matchId || matchPhone;
    }
    return true;
  });

  const counts = {
    ALL: workers.length,
    PENDING: workers.filter((w) => (w.accountStatus || '').toUpperCase() === 'PENDING').length,
    ACTIVE: workers.filter((w) => (w.accountStatus || '').toUpperCase() === 'ACTIVE').length,
    SUSPENDED: workers.filter((w) => (w.accountStatus || '').toUpperCase() === 'SUSPENDED').length,
    REJECTED: workers.filter((w) => (w.accountStatus || '').toUpperCase() === 'REJECTED').length,
  };

  return (
    <View style={styles.container}>
      <Header title="Field Workforce Management" subtitle="Area-Scoped Worker Directory & Governance" />

      {/* Tabs */}
      <View style={styles.tabsRow}>
        {(['PENDING', 'ACTIVE', 'ALL', 'SUSPENDED', 'REJECTED'] as WorkerTab[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === 'ALL' ? 'All' : tab.charAt(0) + tab.slice(1).toLowerCase()} ({counts[tab]})
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Search Bar */}
      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by worker name, EMP ID, email..."
          placeholderTextColor={colors.textLightMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Text style={styles.searchClear}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.blueAccent} />
          <Text style={styles.loadingText}>Loading workforce directory from database...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.blueAccent} />}
        >
          {filteredWorkers.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={{ fontSize: 36, marginBottom: spacing.sm }}>📋</Text>
              <Text style={styles.emptyTitle}>No Workers Found</Text>
              <Text style={styles.emptySub}>
                {searchQuery ? 'No workers match your search query.' : `No workers in "${activeTab}" status for your state.`}
              </Text>
            </View>
          ) : (
            filteredWorkers.map((worker) => {
              const status = (worker.accountStatus || 'PENDING').toUpperCase();
              const isActing = processingId === worker.id;

              return (
                <TouchableOpacity
                  key={worker.id}
                  style={styles.card}
                  activeOpacity={0.88}
                  onPress={() => handleOpenDetail(worker)}
                >
                  <View style={styles.cardHeader}>
                    <View style={styles.avatarMini}>
                      <Text style={styles.avatarMiniText}>
                        {(worker.displayName || 'W').slice(0, 2).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: spacing.sm }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.nameText}>{worker.displayName}</Text>
                        <View style={styles.empBadge}>
                          <Text style={styles.empBadgeText}>{worker.displayId || 'EMP'}</Text>
                        </View>
                      </View>
                      <Text style={styles.emailText}>{worker.email}</Text>
                    </View>
                    <Badge
                      status={status === 'ACTIVE' ? 'completed' : status === 'PENDING' ? 'open' : 'cancelled'}
                      label={status}
                    />
                  </View>

                  <View style={styles.detailsBox}>
                    <Text style={styles.detailLine}>📱 Mobile: {worker.phone || 'N/A'}</Text>
                    <Text style={styles.detailLine}>
                      📍 Jurisdiction: {worker.stateCode || worker.region || 'Assigned State'}
                    </Text>
                    <Text style={styles.detailLine}>🏷️ Role: On-Field Worker (Area Scoped)</Text>
                  </View>

                  {/* Rejection / Suspension Banner */}
                  {status === 'REJECTED' && (
                    <View style={styles.rejectionNotice}>
                      <Text style={styles.rejectionNoticeTitle}>⚠️ Application Rejected</Text>
                      {worker.rejectionReason && (
                        <Text style={styles.rejectionNoticeText}>Reason: {worker.rejectionReason}</Text>
                      )}
                      {worker.rejectedBy && (
                        <Text style={styles.rejectionNoticeSub}>Recorded by: {worker.rejectedBy}</Text>
                      )}
                    </View>
                  )}

                  {status === 'SUSPENDED' && (
                    <View style={[styles.rejectionNotice, { backgroundColor: 'rgba(245, 158, 11, 0.1)', borderColor: 'rgba(245, 158, 11, 0.3)' }]}>
                      <Text style={[styles.rejectionNoticeTitle, { color: '#FBBF24' }]}>⏸️ Account Suspended</Text>
                      {worker.rejectionReason && (
                        <Text style={styles.rejectionNoticeText}>Reason: {worker.rejectionReason}</Text>
                      )}
                      {worker.rejectedBy && (
                        <Text style={styles.rejectionNoticeSub}>Suspended by: {worker.rejectedBy}</Text>
                      )}
                    </View>
                  )}

                  {/* Actions Row */}
                  <View style={styles.actionsRow}>
                    {isActing ? (
                      <ActivityIndicator size="small" color={colors.blueAccent} style={{ flex: 1, paddingVertical: spacing.sm }} />
                    ) : (
                      <>
                        {status === 'PENDING' && (
                          <>
                            <TouchableOpacity
                              style={styles.rejectBtn}
                              onPress={() => handleOpenReasonModal(worker, 'REJECT')}
                            >
                              <Text style={styles.rejectText}>Reject ✕</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.approveBtn}
                              onPress={() => handleApprove(worker)}
                            >
                              <Text style={styles.approveText}>Approve Access ✓</Text>
                            </TouchableOpacity>
                          </>
                        )}

                        {status === 'ACTIVE' && (
                          <TouchableOpacity
                            style={styles.suspendBtn}
                            onPress={() => handleOpenReasonModal(worker, 'SUSPEND')}
                          >
                            <Text style={styles.suspendText}>Suspend Account ⏸️</Text>
                          </TouchableOpacity>
                        )}

                        {(status === 'SUSPENDED' || status === 'REJECTED') && (
                          <TouchableOpacity
                            style={styles.reinstateBtn}
                            onPress={() => handleReinstate(worker)}
                          >
                            <Text style={styles.reinstateText}>Reinstate to Active ✓</Text>
                          </TouchableOpacity>
                        )}
                      </>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}

      {/* Worker Detail Modal */}
      <Modal
        visible={selectedWorker !== null}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setSelectedWorker(null)}
      >
        {selectedWorker && (
          <View style={styles.modalFullContainer}>
            <View style={styles.modalHeaderBar}>
              <TouchableOpacity onPress={() => setSelectedWorker(null)} style={styles.modalBackBtn}>
                <Text style={styles.modalBackBtnText}>← Back to Workers</Text>
              </TouchableOpacity>
              <Text style={styles.modalHeaderTitle}>Worker Dossier</Text>
            </View>

            <ScrollView contentContainerStyle={styles.modalScroll}>
              <View style={styles.dossierCard}>
                <View style={styles.dossierAvatar}>
                  <Text style={styles.dossierAvatarText}>
                    {selectedWorker.displayName.slice(0, 2).toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.dossierName}>{selectedWorker.displayName}</Text>
                <View style={styles.empBadgeLarge}>
                  <Text style={styles.empBadgeLargeText}>{selectedWorker.displayId || 'EMP'}</Text>
                </View>
                <Text style={styles.dossierEmail}>{selectedWorker.email}</Text>
                <Badge
                  status={selectedWorker.accountStatus.toUpperCase() === 'ACTIVE' ? 'completed' : 'open'}
                  label={selectedWorker.accountStatus.toUpperCase()}
                />
              </View>

              {/* Wallet Summary */}
              <View style={styles.sectionBox}>
                <Text style={styles.sectionHeader}>💰 WALLET & REWARDS LEDGER</Text>
                {loadingWallet ? (
                  <ActivityIndicator size="small" color={colors.blueAccent} style={{ marginVertical: spacing.md }} />
                ) : workerWallet ? (
                  <View style={styles.walletGrid}>
                    <View style={styles.walletTile}>
                      <Text style={styles.walletTileLabel}>Available Balance</Text>
                      <Text style={styles.walletTileVal}>₹{workerWallet.balanceInr}</Text>
                    </View>
                    <View style={styles.walletTile}>
                      <Text style={styles.walletTileLabel}>Pending Approvals</Text>
                      <Text style={[styles.walletTileVal, { color: '#FBBF24' }]}>₹{workerWallet.pendingInr}</Text>
                    </View>
                  </View>
                ) : (
                  <Text style={styles.emptyInlineText}>No active wallet ledger entries yet.</Text>
                )}
              </View>

              {/* Profile Details */}
              <View style={styles.sectionBox}>
                <Text style={styles.sectionHeader}>👤 PROFILE ATTRIBUTES</Text>
                <View style={styles.infoRow}>
                  <Text style={styles.infoKey}>Mobile Contact</Text>
                  <Text style={styles.infoVal}>{selectedWorker.phone || 'Not provided'}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoKey}>Assigned Jurisdiction</Text>
                  <Text style={styles.infoVal}>{selectedWorker.stateName || selectedWorker.stateCode || selectedWorker.region || 'Unassigned'}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoKey}>Application Date</Text>
                  <Text style={styles.infoVal}>{selectedWorker.createdAt ? new Date(selectedWorker.createdAt).toLocaleDateString() : 'N/A'}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoKey}>Sub-Role</Text>
                  <Text style={styles.infoVal}>On-Field Verification & Delivery Worker</Text>
                </View>
              </View>

              {/* Rejection / Suspension Notice */}
              {selectedWorker.accountStatus.toUpperCase() === 'REJECTED' && (
                <View style={styles.rejectionNotice}>
                  <Text style={styles.rejectionNoticeTitle}>⚠️ Rejection Record</Text>
                  <Text style={styles.rejectionNoticeText}>Reason: {selectedWorker.rejectionReason || 'No reason recorded'}</Text>
                  <Text style={styles.rejectionNoticeSub}>Decided by: {selectedWorker.rejectedBy || 'Operations Staff'}</Text>
                </View>
              )}

              {/* Actions inside dossier */}
              <View style={styles.dossierActions}>
                {selectedWorker.accountStatus.toUpperCase() === 'PENDING' && (
                  <>
                    <TouchableOpacity
                      style={styles.approveBtnLarge}
                      onPress={() => handleApprove(selectedWorker)}
                    >
                      <Text style={styles.approveText}>Approve Worker Access ✓</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.rejectBtnLarge}
                      onPress={() => handleOpenReasonModal(selectedWorker, 'REJECT')}
                    >
                      <Text style={styles.rejectText}>Reject Worker Application ✕</Text>
                    </TouchableOpacity>
                  </>
                )}

                {selectedWorker.accountStatus.toUpperCase() === 'ACTIVE' && (
                  <TouchableOpacity
                    style={styles.suspendBtnLarge}
                    onPress={() => handleOpenReasonModal(selectedWorker, 'SUSPEND')}
                  >
                    <Text style={styles.suspendText}>Suspend Worker Account ⏸️</Text>
                  </TouchableOpacity>
                )}

                {(selectedWorker.accountStatus.toUpperCase() === 'SUSPENDED' ||
                  selectedWorker.accountStatus.toUpperCase() === 'REJECTED') && (
                  <TouchableOpacity
                    style={styles.reinstateBtnLarge}
                    onPress={() => handleReinstate(selectedWorker)}
                  >
                    <Text style={styles.reinstateText}>Reinstate to Active ✓</Text>
                  </TouchableOpacity>
                )}
              </View>
            </ScrollView>
          </View>
        )}
      </Modal>

      {/* Mandatory Reason Modal */}
      <Modal
        visible={reasonModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setReasonModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.reasonBox}>
            <Text style={styles.reasonTitle}>
              {reasonActionType === 'REJECT' ? 'Reject Worker Registration' : 'Suspend Worker Account'}
            </Text>
            <Text style={styles.reasonSub}>
              Worker: {targetWorker?.displayName} ({targetWorker?.displayId || 'EMP'})
            </Text>
            <Text style={styles.reasonInstruction}>
              A mandatory justification reason is required for compliance audit logs. This explanation will be visible to the worker and senior leadership.
            </Text>

            <TextInput
              style={styles.reasonInput}
              placeholder={
                reasonActionType === 'REJECT'
                  ? 'Enter specific reason for rejection (e.g., Incomplete ID verification, unserviceable location)...'
                  : 'Enter specific reason for suspension (e.g., Quality violation, policy non-compliance)...'
              }
              placeholderTextColor={colors.textLightMuted}
              multiline
              numberOfLines={4}
              value={reasonText}
              onChangeText={setReasonText}
            />

            <View style={styles.reasonActions}>
              <TouchableOpacity
                style={styles.reasonCancelBtn}
                onPress={() => setReasonModalVisible(false)}
              >
                <Text style={styles.reasonCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.reasonConfirmBtn,
                  reasonActionType === 'REJECT' ? styles.reasonRejectBtn : styles.reasonSuspendBtn,
                ]}
                onPress={handleConfirmReasonAction}
              >
                <Text style={styles.reasonConfirmText}>
                  {reasonActionType === 'REJECT' ? 'Confirm Rejection ✕' : 'Confirm Suspension ⏸️'}
                </Text>
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
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    marginRight: spacing.xs,
  },
  tabBtnActive: {
    backgroundColor: colors.bluePrimary,
  },
  tabText: {
    color: colors.textLightMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceDark,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderDark,
    margin: spacing.md,
    paddingHorizontal: spacing.md,
  },
  searchIcon: {
    fontSize: 14,
    marginRight: spacing.xs,
  },
  searchInput: {
    flex: 1,
    height: 38,
    color: colors.textLight,
    fontSize: 13,
  },
  searchClear: {
    color: colors.textLightMuted,
    fontSize: 14,
    fontWeight: '700',
    padding: spacing.xs,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
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
  card: {
    backgroundColor: colors.navyDark,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderDark,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  avatarMini: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.bluePrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarMiniText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  nameText: {
    color: colors.textLight,
    fontSize: 14,
    fontWeight: '700',
  },
  emailText: {
    color: colors.textLightMuted,
    fontSize: 11,
    marginTop: 1,
  },
  empBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  empBadgeText: {
    color: colors.blueAccent,
    fontSize: 9,
    fontFamily: 'monospace',
    fontWeight: '800',
  },
  detailsBox: {
    backgroundColor: colors.surfaceDark,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginVertical: spacing.sm,
  },
  detailLine: {
    color: colors.textLight,
    fontSize: 11,
    lineHeight: 18,
    fontFamily: 'monospace',
  },
  rejectionNotice: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  rejectionNoticeTitle: {
    color: '#F87171',
    fontSize: 11,
    fontWeight: '800',
  },
  rejectionNoticeText: {
    color: colors.textLight,
    fontSize: 11,
    marginTop: 2,
    fontStyle: 'italic',
  },
  rejectionNoticeSub: {
    color: colors.textLightMuted,
    fontSize: 10,
    marginTop: 2,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.borderDark,
  },
  rejectBtn: {
    flex: 1,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  rejectText: {
    color: '#F87171',
    fontWeight: '700',
    fontSize: 12,
  },
  approveBtn: {
    flex: 2,
    backgroundColor: colors.success,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  approveText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  suspendBtn: {
    flex: 1,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  suspendText: {
    color: '#FBBF24',
    fontWeight: '700',
    fontSize: 12,
  },
  reinstateBtn: {
    flex: 1,
    backgroundColor: colors.bluePrimary,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  reinstateText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  // Modal Dossier Styles
  modalFullContainer: {
    flex: 1,
    backgroundColor: colors.navyDeep,
  },
  modalHeaderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
    backgroundColor: colors.navyDark,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDark,
  },
  modalBackBtn: {
    paddingVertical: spacing.xs,
  },
  modalBackBtnText: {
    color: colors.blueAccent,
    fontSize: 13,
    fontWeight: '700',
  },
  modalHeaderTitle: {
    color: colors.textLight,
    fontSize: 15,
    fontWeight: '800',
  },
  modalScroll: {
    padding: spacing.lg,
    paddingBottom: spacing.huge * 2,
  },
  dossierCard: {
    backgroundColor: colors.navyDark,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderDark,
    alignItems: 'center',
    padding: spacing.xl,
    marginBottom: spacing.lg,
  },
  dossierAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.bluePrimary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  dossierAvatarText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
  },
  dossierName: {
    color: colors.textLight,
    fontSize: 18,
    fontWeight: '800',
  },
  empBadgeLarge: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    marginVertical: 4,
  },
  empBadgeLargeText: {
    color: colors.blueAccent,
    fontSize: 11,
    fontFamily: 'monospace',
    fontWeight: '800',
  },
  dossierEmail: {
    color: colors.textLightMuted,
    fontSize: 12,
    marginBottom: spacing.sm,
  },
  sectionBox: {
    backgroundColor: colors.navyDark,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderDark,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  sectionHeader: {
    color: colors.blueAccent,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  walletGrid: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  walletTile: {
    flex: 1,
    backgroundColor: colors.surfaceDark,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  walletTileLabel: {
    color: colors.textLightMuted,
    fontSize: 10,
    fontWeight: '600',
  },
  walletTileVal: {
    color: colors.success,
    fontSize: 18,
    fontWeight: '800',
    marginTop: 2,
  },
  emptyInlineText: {
    color: colors.textLightMuted,
    fontSize: 12,
    fontStyle: 'italic',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDark,
  },
  infoKey: {
    color: colors.textLightMuted,
    fontSize: 11,
  },
  infoVal: {
    color: colors.textLight,
    fontSize: 11,
    fontWeight: '600',
  },
  dossierActions: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  approveBtnLarge: {
    backgroundColor: colors.success,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  rejectBtnLarge: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  suspendBtnLarge: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  reinstateBtnLarge: {
    backgroundColor: colors.bluePrimary,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  // Modal Reason Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  reasonBox: {
    width: '100%',
    backgroundColor: colors.navyDark,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderDark,
    padding: spacing.xl,
  },
  reasonTitle: {
    color: colors.textLight,
    fontSize: 17,
    fontWeight: '800',
  },
  reasonSub: {
    color: colors.blueAccent,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  reasonInstruction: {
    color: colors.textLightMuted,
    fontSize: 11,
    lineHeight: 16,
    marginVertical: spacing.sm,
  },
  reasonInput: {
    backgroundColor: colors.surfaceDark,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderDark,
    padding: spacing.md,
    color: colors.textLight,
    fontSize: 12,
    textAlignVertical: 'top',
    minHeight: 80,
  },
  reasonActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  reasonCancelBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceDark,
  },
  reasonCancelText: {
    color: colors.textLightMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  reasonConfirmBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
  reasonRejectBtn: {
    backgroundColor: '#DC2626',
  },
  reasonSuspendBtn: {
    backgroundColor: '#D97706',
  },
  reasonConfirmText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
});
