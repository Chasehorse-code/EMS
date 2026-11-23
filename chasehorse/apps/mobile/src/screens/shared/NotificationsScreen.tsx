import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { colors, radius, spacing, typography } from '../../theme';
import { Header } from '../../components/ui/Header';
import { Card, Button, EmptyState } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { mobileApi } from '../../api/restApi';
import type { AppNotification } from '../../types';

interface NotificationsScreenProps {
  onSelectEntity?: (type: string, id?: string) => void;
}

export const NotificationsScreen: React.FC<NotificationsScreenProps> = ({
  onSelectEntity,
}) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  const fetchNotifications = async () => {
    try {
      const res = await mobileApi.listNotifications(user?.token);
      setNotifications(res || []);
    } catch {
      setNotifications([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [user?.token]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchNotifications();
  };

  const handleMarkAllRead = async () => {
    setMarkingAll(true);
    try {
      await mobileApi.markAllNotificationsRead(user?.token);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not mark notifications as read.');
    } finally {
      setMarkingAll(false);
    }
  };

  const handleNotificationPress = async (item: AppNotification) => {
    if (!item.read) {
      try {
        await mobileApi.markNotificationRead(item.id, user?.token);
        setNotifications((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, read: true } : n))
        );
      } catch {}
    }

    if (item.entityType && onSelectEntity) {
      onSelectEntity(item.entityType, item.entityId);
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <View style={styles.container}>
      <Header
        title="Notification Centre"
        subtitle={unreadCount > 0 ? `${unreadCount} unread field updates` : 'All updates reviewed'}
      />

      {unreadCount > 0 && (
        <View style={styles.topBar}>
          <Text style={styles.unreadCountText}>{unreadCount} new updates</Text>
          <TouchableOpacity
            style={styles.markAllBtn}
            onPress={handleMarkAllRead}
            disabled={markingAll}
            activeOpacity={0.8}
          >
            <Text style={styles.markAllText}>
              {markingAll ? 'Updating...' : 'Mark all as read'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primaryOrange} />
        }
      >
        {loading ? (
          <ActivityIndicator style={{ marginTop: spacing.xl }} size="large" color={colors.primaryOrange} />
        ) : notifications.length === 0 ? (
          <EmptyState
            icon="🔔"
            title="No Notifications"
            description="You are caught up! When assignments, manager decisions, or bounty approvals arrive, they will appear here."
          />
        ) : (
          notifications.map((item) => {
            const icon =
              item.type === 'TASK_ASSIGNED'
                ? '📋'
                : item.type === 'TASK_APPROVED' || item.type === 'REWARD_CREDITED'
                ? '💰'
                : item.type === 'REWORK_REQUESTED'
                ? '⚠️'
                : item.type === 'TICKET_REPLY'
                ? '💬'
                : '🔔';

            return (
              <Card
                key={item.id}
                style={[
                  styles.notificationCard,
                  !item.read ? styles.notificationCardUnread : undefined,
                ]}
                onPress={() => handleNotificationPress(item)}
              >
                <View style={styles.row}>
                  <Text style={styles.icon}>{icon}</Text>
                  <View style={styles.contentCol}>
                    <View style={styles.titleRow}>
                      <Text
                        style={[
                          styles.title,
                          !item.read && styles.titleUnread,
                        ]}
                      >
                        {item.title}
                      </Text>
                      {!item.read && <View style={styles.unreadDot} />}
                    </View>
                    <Text style={styles.body}>{item.body}</Text>
                    <Text style={styles.date}>
                      {new Date(item.createdAt).toLocaleString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true,
                        timeZone: 'Asia/Kolkata',
                      })}
                    </Text>
                  </View>
                </View>
              </Card>
            );
          })
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.cardLight,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  unreadCountText: {
    ...typography.caption,
    color: colors.primaryOrange,
    fontWeight: '700',
  },
  markAllBtn: {
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
  },
  markAllText: {
    ...typography.caption,
    color: colors.textDarkMuted,
    fontWeight: '600',
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.huge * 2,
  },
  notificationCard: {
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  notificationCardUnread: {
    borderColor: 'rgba(217, 83, 30, 0.3)',
    backgroundColor: '#FFFFFF',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  icon: {
    fontSize: 20,
    marginRight: spacing.md,
    marginTop: 2,
  },
  contentCol: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  title: {
    ...typography.titleSmall,
    color: colors.ink,
    fontSize: 14,
  },
  titleUnread: {
    fontWeight: '700',
    color: colors.ink,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primaryOrange,
    marginLeft: spacing.xs,
  },
  body: {
    ...typography.bodySmall,
    color: colors.textDarkMuted,
    lineHeight: 18,
    marginBottom: spacing.xs,
  },
  date: {
    ...typography.caption,
    color: colors.textDarkMuted,
    fontSize: 10,
  },
});
