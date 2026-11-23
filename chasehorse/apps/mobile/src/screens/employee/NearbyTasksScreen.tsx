import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import * as Location from 'expo-location';
import { colors, spacing, radius } from '../../theme';
import { Header } from '../../components/ui/Header';
import { useAuth } from '../../context/AuthContext';
import { Badge } from '../../components/ui/Badge';
import { mobileApi } from '../../api/restApi';
import type { Task } from '../../types';

interface NearbyTasksScreenProps {
  onAcceptTask: (task: Task) => void;
  onSelectTask: (task: Task) => void;
}

export const NearbyTasksScreen: React.FC<NearbyTasksScreenProps> = ({
  onAcceptTask,
  onSelectTask,
}) => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [radiusKm, setRadiusKm] = useState<number>(10);
  const [gpsFix, setGpsFix] = useState<{ lat: number; lng: number; accuracy?: number } | null>(null);
  const [gpsStatus, setGpsStatus] = useState('Location has not been synced.');
  const [syncingGps, setSyncingGps] = useState(false);

  const loadTasks = async () => {
    try {
      const res = await mobileApi.listTasks(undefined, user?.token);
      setTasks(res || []);
    } catch {
      setTasks([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    loadTasks();
  }, [user?.token]);

  const onRefresh = () => {
    setRefreshing(true);
    loadTasks();
  };

  const handleReject = async (task: Task) => {
    try {
      await mobileApi.rejectTask(task.id, user?.token);
      setTasks((current) => current.filter((item) => item.id !== task.id));
      Alert.alert('Task declined', 'The operations team has been notified.');
    } catch (error) {
      Alert.alert('Unable to decline task', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  const handleSyncGps = async () => {
    setSyncingGps(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        setGpsStatus('Location permission is required to find nearby assignments.');
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const updated = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy ?? undefined,
      };
      await mobileApi.updateWorkerLocation(updated, user?.token);
      setGpsFix(updated);
      setGpsStatus('Location synced with dispatch.');
    } catch (error) {
      setGpsStatus(error instanceof Error ? error.message : 'Unable to retrieve your device location.');
    } finally {
      setSyncingGps(false);
    }
  };

  const distanceForTask = (task: Task): number | null => {
    if (typeof task.distanceKm === 'number' && Number.isFinite(task.distanceKm)) return task.distanceKm;
    if (!gpsFix || !Number.isFinite(task.location.lat) || !Number.isFinite(task.location.lng)) return null;
    const radians = (degrees: number) => (degrees * Math.PI) / 180;
    const deltaLat = radians(task.location.lat - gpsFix.lat);
    const deltaLng = radians(task.location.lng - gpsFix.lng);
    const a = Math.sin(deltaLat / 2) ** 2 + Math.cos(radians(gpsFix.lat)) * Math.cos(radians(task.location.lat)) * Math.sin(deltaLng / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const openNearbyTasks = tasks.filter((task) => {
    const distanceKm = distanceForTask(task);
    return (task.status === 'open' || task.status === 'assigned') && distanceKm !== null && distanceKm <= radiusKm;
  });

  return (
    <View style={styles.container}>
      <Header />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.blueAccent} />
        }
      >
        {/* GPS Fix Bar */}
        <View style={styles.gpsBar}>
          <View style={{ flex: 1 }}>
            <View style={styles.gpsStatusRow}>
              <View style={[styles.liveGreenDot, !gpsFix && styles.gpsUnavailableDot]} />
              <Text style={styles.gpsTitle}>{gpsFix ? 'DEVICE GPS SYNCED' : 'DEVICE GPS UNAVAILABLE'}</Text>
            </View>
            <Text style={styles.gpsCoords}>
              {gpsFix
                ? `Location synced (${gpsFix.lat.toFixed(4)}, ${gpsFix.lng.toFixed(4)}${gpsFix.accuracy ? `, ±${Math.round(gpsFix.accuracy)}m` : ''})`
                : gpsStatus}
            </Text>
            <Text style={styles.gpsCluster}>Only measured device coordinates are sent to dispatch.</Text>
          </View>
          <TouchableOpacity style={styles.syncBtn} onPress={handleSyncGps} disabled={syncingGps}>
            <Text style={styles.syncBtnText}>{syncingGps ? 'Syncing…' : 'Sync GPS'}</Text>
          </TouchableOpacity>
        </View>

        {/* Radius Filter Buttons (up to DB limit of 100 km) */}
        <View style={styles.radiusRow}>
          <Text style={styles.radiusLabel}>RADIUS:</Text>
          {[5, 10, 25, 50, 100].map((r) => (
            <TouchableOpacity
              key={r}
              style={[styles.radiusBtn, radiusKm === r && styles.radiusBtnActive]}
              onPress={() => setRadiusKm(r)}
            >
              <Text style={[styles.radiusBtnText, radiusKm === r && styles.radiusBtnTextActive]}>
                {r}km
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Available Tasks List */}
        <Text style={styles.sectionHeading}>
          AVAILABLE FIELD ASSIGNMENTS ({openNearbyTasks.length})
        </Text>

        {loading ? (
          <View style={{ padding: spacing.xl, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={colors.blueAccent} />
            <Text style={{ color: colors.textLightMuted, marginTop: spacing.md, fontSize: 13 }}>
              Scanning operational cluster for field assignments...
            </Text>
          </View>
        ) : openNearbyTasks.length === 0 ? (
          <View style={{ backgroundColor: colors.navyDark, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.borderDark, padding: spacing.xl, alignItems: 'center', marginTop: spacing.sm }}>
            <Text style={{ fontSize: 36, marginBottom: spacing.sm }}>🔍</Text>
            <Text style={{ color: colors.textLight, fontSize: 16, fontWeight: '700', marginBottom: spacing.xs }}>
              No Field Tasks Nearby
            </Text>
            <Text style={{ color: colors.textLightMuted, fontSize: 12, textAlign: 'center', lineHeight: 18 }}>
              {gpsFix
                ? `No open tasks with a known location are within ${radiusKm} km of your synced location.`
                : 'Sync your device location to calculate which assignments are nearby.'}
            </Text>
          </View>
        ) : (
          openNearbyTasks.map((task) => (
            <View key={task.id} style={styles.card}>
              <View style={styles.cardTopRow}>
                <View style={styles.distanceBadge}>
                  <Text style={styles.distanceText}>📍 {distanceForTask(task)?.toFixed(1)} km away</Text>
                </View>
                <Badge priority={task.priority} label={task.priority.toUpperCase()} />
              </View>

              <TouchableOpacity onPress={() => onSelectTask(task)}>
                <Text style={styles.taskTitle}>{task.title}</Text>
                <Text style={styles.taskDesc} numberOfLines={2}>
                  {task.description}
                </Text>
              </TouchableOpacity>

              <View style={styles.cardFooter}>
                <View>
                  <Text style={styles.rewardLabel}>Reward Bounty</Text>
                  <Text style={styles.rewardAmount}>₹{task.rewardInr}</Text>
                </View>

                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <TouchableOpacity style={styles.acceptBtn} onPress={() => onAcceptTask(task)}>
                    <Text style={styles.acceptBtnText}>Accept Task →</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.declineBtn} onPress={() => handleReject(task)}>
                    <Text style={styles.declineBtnText}>Decline</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))
        )}
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
    padding: spacing.lg,
    paddingBottom: spacing.huge * 2,
  },
  gpsBar: {
    backgroundColor: colors.navyDark,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  gpsStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  liveGreenDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  gpsUnavailableDot: {
    backgroundColor: colors.warning,
  },
  gpsTitle: {
    color: colors.blueAccent,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  gpsCoords: {
    color: colors.textLight,
    fontSize: 12,
    fontFamily: 'monospace',
    marginTop: 2,
  },
  gpsCluster: {
    color: colors.textLightMuted,
    fontSize: 10,
    marginTop: 2,
  },
  syncBtn: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderWidth: 1,
    borderColor: colors.blueAccent,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  syncBtnText: {
    color: colors.blueAccent,
    fontSize: 11,
    fontWeight: '700',
  },
  radiusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  radiusLabel: {
    color: colors.textLightMuted,
    fontSize: 10,
    fontWeight: '700',
  },
  radiusBtn: {
    backgroundColor: colors.surfaceDark,
    borderWidth: 1,
    borderColor: colors.borderDark,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  radiusBtnActive: {
    backgroundColor: colors.bluePrimary,
    borderColor: colors.blueAccent,
  },
  radiusBtnText: {
    color: colors.textLightMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  radiusBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  sectionHeading: {
    color: colors.textLightMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  card: {
    backgroundColor: colors.navyDark,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderDark,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  distanceBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  distanceText: {
    color: colors.blueAccent,
    fontSize: 11,
    fontWeight: '600',
  },
  taskTitle: {
    color: colors.textLight,
    fontSize: 15,
    fontWeight: '700',
    marginTop: 4,
  },
  taskDesc: {
    color: colors.textLightMuted,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 4,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderDark,
  },
  rewardLabel: {
    color: colors.textLightMuted,
    fontSize: 10,
  },
  rewardAmount: {
    color: colors.success,
    fontSize: 18,
    fontWeight: '800',
  },
  acceptBtn: {
    backgroundColor: colors.bluePrimary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  acceptBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  declineBtn: {
    borderWidth: 1,
    borderColor: colors.borderDark,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  declineBtnText: {
    color: colors.textLightMuted,
    fontSize: 13,
    fontWeight: '700',
  },
});
