import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Alert,
} from 'react-native';
import { colors, radius, spacing, typography } from '../../theme';
import { Header } from '../../components/ui/Header';
import { Card, Button, StatusBadge, EmptyState } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { mobileApi } from '../../api/restApi';

interface ManagerAssignment {
  managerId: string;
  managerName: string;
  managerEmail: string;
  stateCode: string;
  stateName: string;
}

interface AreaCoverage {
  stateCode: string;
  stateName: string;
  managerName?: string;
  activeWorkersCount: number;
  openTasksCount: number;
  coverageStatus: string;
}

export const AdminAreasScreen: React.FC = () => {
  const { user } = useAuth();
  const [managers, setManagers] = useState<ManagerAssignment[]>([]);
  const [coverage, setCoverage] = useState<AreaCoverage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Assignment modal
  const [selectedManager, setSelectedManager] = useState<ManagerAssignment | null>(null);
  const [selectedStateCode, setSelectedStateCode] = useState('AP');
  const [assigning, setAssigning] = useState(false);

  const fetchData = async () => {
    try {
      const [mgrRes, covRes] = await Promise.all([
        mobileApi.listAdminManagers(user?.token),
        mobileApi.getAreaCoverage(user?.token),
      ]);
      setManagers(mgrRes || []);
      setCoverage(covRes || []);
    } catch {
      setManagers([]);
      setCoverage([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user?.token]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleAssignArea = async () => {
    if (!selectedManager) return;

    setAssigning(true);
    try {
      await mobileApi.assignManagerArea(selectedManager.managerId, selectedStateCode, user?.token);
      Alert.alert(
        'Area Jurisdiction Assigned',
        `Assigned ${selectedStateCode} to manager ${selectedManager.managerName}.`,
      );
      setSelectedManager(null);
      fetchData();
    } catch (err: any) {
      Alert.alert('Assignment Error', err.message || 'Could not assign area.');
    } finally {
      setAssigning(false);
    }
  };

  const indianStates = [
    { code: 'AP', name: 'Andhra Pradesh' },
    { code: 'TS', name: 'Telangana' },
    { code: 'KA', name: 'Karnataka' },
    { code: 'TN', name: 'Tamil Nadu' },
    { code: 'MH', name: 'Maharashtra' },
    { code: 'DL', name: 'Delhi NCR' },
    { code: 'GJ', name: 'Gujarat' },
    { code: 'UP', name: 'Uttar Pradesh' },
  ];

  return (
    <View style={styles.container}>
      <Header
        title="State Area Jurisdictions"
        subtitle="National Coverage & Manager Area Delegations"
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primaryOrange} />
        }
      >
        {/* Coverage Summary Card */}
        <Card style={styles.summaryCard}>
          <Text style={styles.sectionTitle}>STATE COVERAGE & WORKFORCE DENSITY</Text>
          <View style={styles.statsRow}>
            <View style={styles.statCol}>
              <Text style={styles.statVal}>{coverage.length}</Text>
              <Text style={styles.statLabel}>States Active</Text>
            </View>
            <View style={styles.statCol}>
              <Text style={styles.statVal}>
                {coverage.filter((c) => c.coverageStatus === 'COVERED').length}
              </Text>
              <Text style={styles.statLabel}>Managers Assigned</Text>
            </View>
            <View style={styles.statCol}>
              <Text style={[styles.statVal, { color: colors.warning }]}>
                {coverage.filter((c) => c.coverageStatus === 'COVERAGE_GAP').length}
              </Text>
              <Text style={styles.statLabel}>Coverage Gaps</Text>
            </View>
          </View>
        </Card>

        {/* Manager Assignments Section */}
        <Text style={styles.sectionHeader}>OPERATIONS MANAGERS</Text>

        {loading ? (
          <ActivityIndicator style={{ marginVertical: spacing.lg }} size="large" color={colors.primaryOrange} />
        ) : managers.length === 0 ? (
          <EmptyState
            icon="🗺️"
            title="No Manager Area Records"
            description="No operations managers are currently configured in the database."
          />
        ) : (
          managers.map((mgr) => (
            <Card key={mgr.managerId} style={styles.mgrCard}>
              <View style={styles.mgrHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.mgrName}>{mgr.managerName}</Text>
                  <Text style={styles.mgrEmail}>{mgr.managerEmail}</Text>
                </View>
                <View style={styles.areaBadge}>
                  <Text style={styles.areaBadgeText}>
                    {mgr.stateCode ? `${mgr.stateCode} · ${mgr.stateName}` : 'UNASSIGNED'}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.reassignBtn}
                onPress={() => {
                  setSelectedManager(mgr);
                  setSelectedStateCode(mgr.stateCode || 'AP');
                }}
              >
                <Text style={styles.reassignBtnText}>Modify Jurisdiction →</Text>
              </TouchableOpacity>
            </Card>
          ))
        )}

        {/* State Breakdown */}
        <Text style={styles.sectionHeader}>STATE OPERATIONS AUDIT</Text>
        {coverage.map((cov) => (
          <View key={cov.stateCode} style={styles.coverageRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.stateName}>{cov.stateName} ({cov.stateCode})</Text>
              <Text style={styles.stateSub}>
                Manager: {cov.managerName || 'None (Unassigned)'} · {cov.activeWorkersCount} Workers · {cov.openTasksCount} Tasks
              </Text>
            </View>
            <StatusBadge status={cov.coverageStatus} size="sm" />
          </View>
        ))}
      </ScrollView>

      {/* Assignment Modal */}
      <Modal
        visible={Boolean(selectedManager)}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedManager(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Assign Operational State</Text>
              <TouchableOpacity onPress={() => setSelectedManager(null)}>
                <Text style={styles.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.modalDesc}>
                Select the Indian State/UT jurisdiction for manager{' '}
                <Text style={{ fontWeight: '700' }}>{selectedManager?.managerName}</Text>:
              </Text>

              <View style={styles.statesGrid}>
                {indianStates.map((st) => (
                  <TouchableOpacity
                    key={st.code}
                    style={[
                      styles.stateChip,
                      selectedStateCode === st.code && styles.stateChipActive,
                    ]}
                    onPress={() => setSelectedStateCode(st.code)}
                  >
                    <Text
                      style={[
                        styles.stateChipCode,
                        selectedStateCode === st.code && styles.stateChipCodeActive,
                      ]}
                    >
                      {st.code}
                    </Text>
                    <Text
                      style={[
                        styles.stateChipName,
                        selectedStateCode === st.code && styles.stateChipNameActive,
                      ]}
                    >
                      {st.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Button
                title={assigning ? 'Assigning...' : `Confirm Delegation (${selectedStateCode})`}
                onPress={handleAssignArea}
                loading={assigning}
                style={{ marginTop: spacing.lg }}
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
  summaryCard: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.caption,
    color: colors.textDarkMuted,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statCol: {
    alignItems: 'center',
  },
  statVal: {
    ...typography.titleLarge,
    color: colors.ink,
    fontWeight: '800',
  },
  statLabel: {
    ...typography.caption,
    color: colors.textDarkMuted,
    marginTop: 2,
  },
  sectionHeader: {
    ...typography.titleSmall,
    color: colors.ink,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  mgrCard: {
    marginBottom: spacing.sm,
  },
  mgrHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  mgrName: {
    ...typography.titleSmall,
    color: colors.ink,
  },
  mgrEmail: {
    ...typography.caption,
    color: colors.textDarkMuted,
  },
  areaBadge: {
    backgroundColor: 'rgba(217, 83, 30, 0.1)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  areaBadgeText: {
    ...typography.caption,
    color: colors.primaryOrange,
    fontWeight: '700',
    fontSize: 10,
  },
  reassignBtn: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
  },
  reassignBtnText: {
    ...typography.caption,
    color: colors.primaryOrange,
    fontWeight: '600',
  },
  coverageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.cardLight,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.xs,
  },
  stateName: {
    ...typography.bodyMedium,
    fontWeight: '600',
    color: colors.ink,
  },
  stateSub: {
    ...typography.caption,
    color: colors.textDarkMuted,
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(21, 21, 21, 0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    padding: spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  modalTitle: {
    ...typography.titleMedium,
    color: colors.ink,
  },
  closeBtn: {
    fontSize: 20,
    color: colors.textDarkMuted,
  },
  modalBody: {
    paddingVertical: spacing.xs,
  },
  modalDesc: {
    ...typography.bodyMedium,
    color: colors.textDarkMuted,
    marginBottom: spacing.md,
  },
  statesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  stateChip: {
    width: '48%',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.cardLight,
    alignItems: 'center',
  },
  stateChipActive: {
    backgroundColor: colors.primaryBlack,
    borderColor: colors.primaryBlack,
  },
  stateChipCode: {
    ...typography.titleSmall,
    color: colors.primaryOrange,
    fontWeight: '800',
  },
  stateChipCodeActive: {
    color: colors.primaryOrange,
  },
  stateChipName: {
    ...typography.caption,
    color: colors.textDarkMuted,
    marginTop: 2,
    textAlign: 'center',
  },
  stateChipNameActive: {
    color: '#F3F1EB',
  },
});
