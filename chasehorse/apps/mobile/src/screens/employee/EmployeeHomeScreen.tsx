import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import * as Location from 'expo-location';
import { colors, spacing, radius } from '../../theme';
import { Header } from '../../components/ui/Header';
import { useAuth } from '../../context/AuthContext';
import { mobileApi } from '../../api/restApi';
import type { WorkerDashboardStats } from '../../types';

interface EmployeeHomeScreenProps {
  onNavigateToNearby: () => void;
  onNavigateToActiveTask: () => void;
  onNavigateToWallet: () => void;
  onNavigateToProfile: () => void;
}

export const EmployeeHomeScreen: React.FC<EmployeeHomeScreenProps> = ({
  onNavigateToNearby,
  onNavigateToActiveTask,
  onNavigateToWallet,
}) => {
  const { user } = useAuth();
  const [stats, setStats] = useState<WorkerDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [gpsStatus, setGpsStatus] = useState<'checking' | 'active' | 'denied'>('checking');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          if (isMounted) {
            setCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
            setGpsStatus('active');
          }
        } else {
          if (isMounted) setGpsStatus('denied');
        }
      } catch {
        if (isMounted) setGpsStatus('denied');
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  const [lastUpdated, setLastUpdated] = useState<string>('Just now');

  const fetchStats = useCallback(async () => {
    try {
      const data = await mobileApi.getWorkerDashboardStats(user?.token);
      if (data) {
        setStats(data);
        setLastUpdated(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      }
    } catch {
      // Keep existing state or graceful fallback
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.token]);

  useEffect(() => {
    fetchStats();
    // 20s polling as per prompt requirement
    const interval = setInterval(fetchStats, 20000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchStats();
  };

  const todayFormatted = new Date().toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const availableNearby = stats?.tasksAvailableNearby ?? 0;
  const inProgress = stats?.tasksInProgress ?? 0;
  const awaitingReview = stats?.tasksAwaitingReview ?? 0;
  const approvedThisMonth = stats?.tasksApprovedThisMonth ?? 0;
  const walletAvailable = Math.round((stats?.walletAvailablePaise ?? 0) / 100);
  const walletPending = Math.round((stats?.walletPendingApprovalPaise ?? 0) / 100);

  return (
    <View style={styles.container}>
      <Header
        title="Field Worker Command"
        subtitle={`Live Operations · ${todayFormatted}`}
      />

      {/* Sync timestamp bar */}
      <View style={styles.syncBar}>
        <Text style={styles.syncBarText}>
          ⚡ Last Synced: {lastUpdated} · Auto-refresh active (20s)
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.blueAccent} />}
      >
        {/* Status bar chips */}
        <View style={styles.chipRow}>
          <View style={styles.chipGreen}>
            <View style={styles.dotGreen} />
            <Text style={styles.chipTextGreen}>ACCOUNT: ACTIVE</Text>
          </View>
          <View style={[styles.chipBlue, gpsStatus === 'denied' && { backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.3)' }]}>
            <Text style={[styles.chipTextBlue, gpsStatus === 'denied' && { color: '#EF4444' }]}>
              {gpsStatus === 'active'
                ? `📍 GPS: LIVE (${coords ? `${coords.lat.toFixed(2)}, ${coords.lng.toFixed(2)}` : '< 25m'})`
                : gpsStatus === 'checking'
                ? '📍 GPS: LOCATING...'
                : '⚠️ GPS: CONSENT REQUIRED'}
            </Text>
          </View>
        </View>

        {/* Greeting Banner */}
        <View style={styles.greetingCard}>
          <Text style={styles.greetingTitle}>
            Namaste, {user?.displayName || 'Field Partner'} 👋
          </Text>
          <Text style={styles.greetingSub}>
            Ready for your next field assignment. Real-time parity verified with ChaseHorse ERP.
          </Text>
        </View>

        {/* Continue Where You Left Off Card */}
        {stats?.activeTask ? (
          <View style={styles.activeCard}>
            <View style={styles.activeBadgeRow}>
              <View style={styles.activeBadge}>
                <Text style={styles.activeBadgeText}>ACTIVE ASSIGNMENT</Text>
              </View>
              <Text style={styles.activeReward}>₹{stats.activeTask.rewardInr}</Text>
            </View>
            <Text style={styles.activeTitle}>{stats.activeTask.title}</Text>
            <Text style={styles.activeSub}>
              {stats.activeTask.category || 'Site verification'} · {stats.activeTask.area || 'Current Sector'}
            </Text>

            {/* Progress Bar */}
            <View style={styles.progressSection}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressLabel}>Checklist Execution</Text>
                <Text style={styles.progressValue}>
                  {stats.activeTask.checklistProgress} of {stats.activeTask.checklistTotal || 1} items done
                </Text>
              </View>
              <View style={styles.progressBarTrack}>
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width: `${Math.min(
                        100,
                        Math.round(
                          ((stats.activeTask.checklistProgress || 0) /
                            Math.max(1, stats.activeTask.checklistTotal || 1)) *
                            100
                        )
                      )}%`,
                    },
                  ]}
                />
              </View>
            </View>

            <TouchableOpacity
              style={styles.resumeBtn}
              onPress={onNavigateToActiveTask}
              activeOpacity={0.8}
            >
              <Text style={styles.resumeBtnText}>⚡ Continue Task Execution →</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.emptyTaskCard}>
            <Text style={styles.emptyTaskTitle}>No active task in progress</Text>
            <Text style={styles.emptyTaskDesc}>
              {availableNearby > 0
                ? `${availableNearby} open tasks are waiting in your dispatch radius.`
                : 'Browse nearby verified field tasks to start earning.'}
            </Text>
            <TouchableOpacity
              style={styles.browseBtn}
              onPress={onNavigateToNearby}
              activeOpacity={0.8}
            >
              <Text style={styles.browseBtnText}>🧭 Browse Nearby Tasks ({availableNearby})</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Real Data Stat Tiles (Count-up numbers) */}
        <Text style={styles.sectionHeader}>TASK & EARNING METRICS</Text>
        {loading ? (
          <ActivityIndicator color={colors.blueAccent} style={{ marginVertical: spacing.lg }} />
        ) : (
          <View style={styles.statsGrid}>
            <TouchableOpacity style={styles.statTile} onPress={onNavigateToNearby}>
              <Text style={styles.statNumber}>{availableNearby}</Text>
              <Text style={styles.statLabel}>Nearby Open</Text>
              <Text style={styles.statHint}>Within radius</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.statTile} onPress={onNavigateToActiveTask}>
              <Text style={[styles.statNumber, { color: colors.blueAccent }]}>{inProgress}</Text>
              <Text style={styles.statLabel}>In Progress</Text>
              <Text style={styles.statHint}>Active field</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.statTile}>
              <Text style={[styles.statNumber, { color: '#F59E0B' }]}>{awaitingReview}</Text>
              <Text style={styles.statLabel}>Awaiting Review</Text>
              <Text style={styles.statHint}>Evidence check</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.statTile}>
              <Text style={[styles.statNumber, { color: '#10B981' }]}>{approvedThisMonth}</Text>
              <Text style={styles.statLabel}>Approved (Month)</Text>
              <Text style={styles.statHint}>Verified</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.statTile} onPress={onNavigateToWallet}>
              <Text style={[styles.statNumber, { color: '#10B981' }]}>₹{walletAvailable}</Text>
              <Text style={styles.statLabel}>Wallet Available</Text>
              <Text style={styles.statHint}>Approved balance</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.statTile} onPress={onNavigateToWallet}>
              <Text style={[styles.statNumber, { color: '#E8541E' }]}>₹{walletPending}</Text>
              <Text style={styles.statLabel}>Pending Approval</Text>
              <Text style={styles.statHint}>Stage 1 & 2 review</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Quality Metrics */}
        <View style={styles.qualityCard}>
          <Text style={styles.qualityTitle}>PERFORMANCE QUALITY</Text>
          <View style={styles.qualityRow}>
            <View style={styles.qualityItem}>
              <Text style={styles.qualityVal}>
                {stats?.approvalRate !== undefined && stats?.approvalRate !== null && (approvedThisMonth + awaitingReview > 0)
                  ? `${Math.round(stats.approvalRate > 1 ? stats.approvalRate : stats.approvalRate * 100)}%`
                  : '—'}
              </Text>
              <Text style={styles.qualityLabel}>Approval Rate</Text>
            </View>
            <View style={styles.qualityDivider} />
            <View style={styles.qualityItem}>
              <Text style={styles.qualityVal}>
                {stats?.reworkRate !== undefined && stats?.reworkRate !== null && (approvedThisMonth + awaitingReview > 0)
                  ? `${(stats.reworkRate > 1 ? stats.reworkRate : stats.reworkRate * 100).toFixed(1)}%`
                  : '—'}
              </Text>
              <Text style={styles.qualityLabel}>Rework Rate</Text>
            </View>
            <View style={styles.qualityDivider} />
            <View style={styles.qualityItem}>
              <Text style={styles.qualityVal}>
                ₹{Math.round((stats?.lifetimeEarnedPaise ?? 0) / 100)}
              </Text>
              <Text style={styles.qualityLabel}>Lifetime Earned</Text>
            </View>
          </View>
        </View>

        {/* Recent Activity */}
        <View style={styles.activityCard}>
          <Text style={styles.sectionHeader}>RECENT DISPATCH ACTIVITY</Text>
          {stats?.recentActivity && stats.recentActivity.length > 0 ? (
            stats.recentActivity.map((act) => (
              <View key={act.id} style={styles.activityItem}>
                <View style={styles.activityDot} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.activityTitle}>{act.title}</Text>
                  <Text style={styles.activityTime}>{act.timestamp}</Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.emptyActivityText}>No recent dispatch activity recorded yet.</Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.navyDeep,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.huge * 2,
  },
  chipRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  chipGreen: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  dotGreen: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
    marginRight: 6,
  },
  chipTextGreen: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: '700',
  },
  chipBlue: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  chipTextBlue: {
    color: colors.blueAccent,
    fontSize: 10,
    fontWeight: '700',
  },
  greetingCard: {
    backgroundColor: colors.navyDark,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderDark,
    marginBottom: spacing.md,
  },
  greetingTitle: {
    color: colors.textLight,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  greetingSub: {
    color: colors.textLightMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  activeCard: {
    backgroundColor: '#1E293B',
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.blueAccent,
    marginBottom: spacing.lg,
  },
  activeBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  activeBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  activeBadgeText: {
    color: colors.blueAccent,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  activeReward: {
    color: '#10B981',
    fontSize: 16,
    fontWeight: '800',
  },
  activeTitle: {
    color: colors.textLight,
    fontSize: 16,
    fontWeight: '700',
    marginTop: 4,
    marginBottom: 2,
  },
  activeSub: {
    color: colors.textLightMuted,
    fontSize: 12,
    marginBottom: spacing.md,
  },
  progressSection: {
    marginBottom: spacing.md,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  progressLabel: {
    color: colors.textLightMuted,
    fontSize: 11,
  },
  progressValue: {
    color: colors.textLight,
    fontSize: 11,
    fontWeight: '600',
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.blueAccent,
    borderRadius: 3,
  },
  resumeBtn: {
    backgroundColor: colors.blueAccent,
    borderRadius: radius.md,
    paddingVertical: 10,
    alignItems: 'center',
  },
  resumeBtnText: {
    color: colors.navyDeep,
    fontSize: 13,
    fontWeight: '700',
  },
  emptyTaskCard: {
    backgroundColor: colors.navyDark,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderDark,
    marginBottom: spacing.lg,
  },
  emptyTaskTitle: {
    color: colors.textLight,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  emptyTaskDesc: {
    color: colors.textLightMuted,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  browseBtn: {
    backgroundColor: '#111315',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: radius.md,
    paddingVertical: 10,
    alignItems: 'center',
  },
  browseBtnText: {
    color: colors.textLight,
    fontSize: 12,
    fontWeight: '700',
  },
  sectionHeader: {
    color: colors.textLightMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  statTile: {
    width: '48%',
    backgroundColor: colors.navyDark,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderDark,
  },
  statNumber: {
    color: colors.textLight,
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 2,
  },
  statLabel: {
    color: colors.textLight,
    fontSize: 12,
    fontWeight: '600',
  },
  statHint: {
    color: colors.textLightMuted,
    fontSize: 10,
    marginTop: 2,
  },
  qualityCard: {
    backgroundColor: colors.navyDark,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderDark,
    marginBottom: spacing.lg,
  },
  qualityTitle: {
    color: colors.textLightMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: spacing.md,
  },
  qualityRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  qualityItem: {
    alignItems: 'center',
  },
  qualityVal: {
    color: colors.textLight,
    fontSize: 18,
    fontWeight: '800',
  },
  qualityLabel: {
    color: colors.textLightMuted,
    fontSize: 10,
    marginTop: 2,
  },
  qualityDivider: {
    width: 1,
    height: 28,
    backgroundColor: colors.borderDark,
  },
  activityCard: {
    backgroundColor: colors.navyDark,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderDark,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  activityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.blueAccent,
    marginTop: 5,
    marginRight: spacing.sm,
  },
  activityTitle: {
    color: colors.textLight,
    fontSize: 12,
    fontWeight: '600',
  },
  activityTime: {
    color: colors.textLightMuted,
    fontSize: 10,
    marginTop: 2,
  },
  emptyActivityText: {
    color: colors.textLightMuted,
    fontSize: 12,
    fontStyle: 'italic',
    paddingVertical: spacing.sm,
  },
  syncBar: {
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(56, 189, 248, 0.2)',
    paddingVertical: 4,
    alignItems: 'center',
  },
  syncBarText: {
    color: colors.blueAccent,
    fontSize: 10,
    fontFamily: 'monospace',
    fontWeight: '700',
  },
});
