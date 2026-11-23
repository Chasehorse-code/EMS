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
import type { Task, ChecklistTemplate, EmployeeDirectoryItem } from '../../types';

type StatusFilter = 'ALL' | 'OPEN' | 'ASSIGNED' | 'IN_PROGRESS' | 'SUBMITTED' | 'IN_REVIEW' | 'APPROVED' | 'CANCELLED';

export const ManagerTasksScreen: React.FC = () => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [workers, setWorkers] = useState<EmployeeDirectoryItem[]>([]);
  const [checklistTemplates, setChecklistTemplates] = useState<ChecklistTemplate[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // Create Task Modal State
  const [createModalVisible, setCreateModalVisible] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState<string>('');
  const [newDescription, setNewDescription] = useState<string>('');
  const [newReward, setNewReward] = useState<string>('500');
  const [newAddress, setNewAddress] = useState<string>('');
  const [newCategory, setNewCategory] = useState<string>('Site survey');
  const [newTemplateId, setNewTemplateId] = useState<string>('');
  const [creating, setCreating] = useState<boolean>(false);

  // Assign Worker Modal State
  const [assignModalVisible, setAssignModalVisible] = useState<boolean>(false);
  const [taskToAssign, setTaskToAssign] = useState<Task | null>(null);
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>('');
  const [assigning, setAssigning] = useState<boolean>(false);

  const loadData = useCallback(async () => {
    try {
      const [taskList, workerList, templates] = await Promise.all([
        mobileApi.listTasks(undefined, user?.token).catch(() => [] as Task[]),
        mobileApi.listEmployees(user?.token).catch(() => [] as EmployeeDirectoryItem[]),
        mobileApi.listChecklistTemplates(user?.token).catch(() => [] as ChecklistTemplate[]),
      ]);
      setTasks(taskList);
      setWorkers(workerList);
      setChecklistTemplates(templates);
      if (templates.length > 0 && !newTemplateId) {
        setNewTemplateId(templates[0].id);
      }
    } catch (err) {
      console.warn('[ManagerTasksScreen] Error loading tasks:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.token, newTemplateId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleCreateTask = async () => {
    if (!newTitle.trim()) {
      Alert.alert('Required Field', 'Please provide a clear title for the task.');
      return;
    }
    const rewardVal = Number(newReward);
    if (!Number.isFinite(rewardVal) || rewardVal <= 0) {
      Alert.alert('Invalid Reward', 'Please enter a valid INR reward amount.');
      return;
    }
    // Check manager reward cap (₹5,000 as configured in DECISIONS.md)
    if (rewardVal > 5000) {
      Alert.alert('Cap Exceeded', 'Operations Managers can configure rewards up to ₹5,000 per task. Higher amounts require Platform Administrator authorization.');
      return;
    }

    setCreating(true);
    try {
      await mobileApi.createTask(
        {
          title: newTitle.trim(),
          description: newDescription.trim(),
          rewardInr: rewardVal,
          checklistTemplateId: newTemplateId || checklistTemplates[0]?.id || '',
          areaKey: user?.region || 'HYD-01',
          address: newAddress.trim() || 'Assigned jurisdiction site',
          category: newCategory as any,
          priority: 'normal',
          dueAt: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
        },
        user?.token
      );
      Alert.alert('Task Created', 'Field task has been created with custom display ID and dispatched to area queue.');
      setCreateModalVisible(false);
      setNewTitle('');
      setNewDescription('');
      setNewAddress('');
      await loadData();
    } catch (err: any) {
      Alert.alert('Creation Failed', err?.message || 'Server rejected task creation.');
    } finally {
      setCreating(false);
    }
  };

  const openAssignModal = (task: Task) => {
    setTaskToAssign(task);
    setSelectedWorkerId(task.assigneeId || (workers[0]?.id || ''));
    setAssignModalVisible(true);
  };

  const handleConfirmAssignment = async () => {
    if (!taskToAssign || !selectedWorkerId) return;
    setAssigning(true);
    try {
      await mobileApi.assignTask(taskToAssign.id, selectedWorkerId, user?.token);
      Alert.alert('Task Assigned', 'Task has been assigned to the field worker. Notification dispatched.');
      setAssignModalVisible(false);
      setTaskToAssign(null);
      await loadData();
      if (selectedTask?.id === taskToAssign.id) {
        setSelectedTask(null);
      }
    } catch (err: any) {
      Alert.alert('Assignment Failed', err?.message || 'Cross-state or invalid assignment rejected by server.');
    } finally {
      setAssigning(false);
    }
  };

  const handleCancelTask = (task: Task) => {
    Alert.alert(
      'Cancel Task',
      `Are you sure you want to cancel "${task.title}" (${task.displayId || task.id.slice(0, 8)})?`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Cancel Task',
          style: 'destructive',
          onPress: async () => {
            try {
              await mobileApi.updateTaskStatus(task.id, 'CANCELLED', user?.token);
              Alert.alert('Task Cancelled', 'Task status updated to CANCELLED in database.');
              await loadData();
              if (selectedTask?.id === task.id) {
                setSelectedTask(null);
              }
            } catch (err: any) {
              Alert.alert('Cancellation Failed', err?.message || 'Server rejected cancellation.');
            }
          },
        },
      ]
    );
  };

  const filteredTasks = tasks.filter((t) => {
    const status = (t.status || '').toUpperCase();
    if (statusFilter !== 'ALL' && status !== statusFilter) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchTitle = (t.title || '').toLowerCase().includes(q);
      const matchDisplayId = (t.displayId || '').toLowerCase().includes(q);
      const matchId = (t.id || '').toLowerCase().includes(q);
      const matchAddress = (t.location?.address || '').toLowerCase().includes(q);
      return matchTitle || matchDisplayId || matchId || matchAddress;
    }
    return true;
  });

  return (
    <View style={styles.container}>
      <Header title="Field Task Operations" subtitle="Area-Scoped Dispatch, Assignment & Lifecycle" />

      {/* Top Action Bar */}
      <View style={styles.topBar}>
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search by ID (OOFW001) or title..."
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

        <TouchableOpacity
          style={styles.createBtn}
          onPress={() => setCreateModalVisible(true)}
          activeOpacity={0.85}
        >
          <Text style={styles.createBtnText}>+ Create Task</Text>
        </TouchableOpacity>
      </View>

      {/* Filter Chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersScroll}>
        {(['ALL', 'OPEN', 'ASSIGNED', 'IN_PROGRESS', 'SUBMITTED', 'IN_REVIEW', 'APPROVED', 'CANCELLED'] as StatusFilter[]).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, statusFilter === f && styles.filterChipActive]}
            onPress={() => setStatusFilter(f)}
          >
            <Text style={[styles.filterChipText, statusFilter === f && styles.filterChipTextActive]}>
              {f === 'ALL' ? 'All' : f.replace('_', ' ')}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.blueAccent} />
          <Text style={styles.loadingText}>Fetching tasks from Postgres database...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.blueAccent} />}
        >
          {filteredTasks.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={{ fontSize: 36, marginBottom: spacing.sm }}>📦</Text>
              <Text style={styles.emptyTitle}>No Tasks Found</Text>
              <Text style={styles.emptySub}>
                {searchQuery ? 'No tasks match your search filter.' : `No tasks in status "${statusFilter}" for your jurisdiction.`}
              </Text>
            </View>
          ) : (
            filteredTasks.map((task) => {
              const assignedWorker = workers.find((w) => w.id === task.assigneeId);
              const status = (task.status || 'OPEN').toUpperCase();

              return (
                <View key={task.id} style={styles.taskCard}>
                  <TouchableOpacity
                    style={styles.taskCardHeader}
                    activeOpacity={0.8}
                    onPress={() => setSelectedTask(task)}
                  >
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <View style={styles.taskIdBadge}>
                          <Text style={styles.taskIdBadgeText}>{task.displayId || task.id.slice(0, 8)}</Text>
                        </View>
                        <Text style={styles.categoryLabel}>{task.category}</Text>
                      </View>
                      <Text style={styles.taskTitle}>{task.title}</Text>
                    </View>
                    <Badge
                      status={
                        status === 'APPROVED' ? 'completed' : status === 'CANCELLED' ? 'cancelled' : 'open'
                      }
                      label={status.replace('_', ' ')}
                    />
                  </TouchableOpacity>

                  <View style={styles.metaBox}>
                    <Text style={styles.metaLine}>📍 Site: {task.location?.address || 'Site Coordinate'}</Text>
                    <Text style={styles.metaLine}>
                      👤 Assigned: {assignedWorker ? `${assignedWorker.displayName} (${assignedWorker.displayId || 'EMP'})` : 'Unassigned (Open for Claim)'}
                    </Text>
                    {task.createdByName && (
                      <Text style={styles.metaLine}>
                        ✍️ Created by: {task.createdByName} ({task.createdByRole || 'ADMIN'})
                      </Text>
                    )}
                  </View>

                  <View style={styles.rewardRow}>
                    <Text style={styles.rewardLabel}>Bounty:</Text>
                    <Text style={styles.rewardVal}>₹{task.rewardInr}</Text>
                  </View>

                  {/* Quick Task Actions */}
                  <View style={styles.actionsRow}>
                    <TouchableOpacity
                      style={styles.detailBtn}
                      onPress={() => setSelectedTask(task)}
                    >
                      <Text style={styles.detailBtnText}>View Details ↗</Text>
                    </TouchableOpacity>

                    {status !== 'APPROVED' && status !== 'CANCELLED' && (
                      <>
                        <TouchableOpacity
                          style={styles.assignBtn}
                          onPress={() => openAssignModal(task)}
                        >
                          <Text style={styles.assignBtnText}>
                            {task.assigneeId ? 'Reassign 👥' : 'Assign Worker 👥'}
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.cancelBtn}
                          onPress={() => handleCancelTask(task)}
                        >
                          <Text style={styles.cancelBtnText}>Cancel ✕</Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      {/* Create Task Modal */}
      <Modal
        visible={createModalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setCreateModalVisible(false)}
      >
        <View style={styles.modalFullContainer}>
          <View style={styles.modalHeaderBar}>
            <TouchableOpacity onPress={() => setCreateModalVisible(false)}>
              <Text style={styles.modalBackBtnText}>← Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalHeaderTitle}>Create Field Task</Text>
            <TouchableOpacity onPress={handleCreateTask} disabled={creating}>
              {creating ? (
                <ActivityIndicator size="small" color={colors.blueAccent} />
              ) : (
                <Text style={styles.modalSaveBtnText}>Create</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.modalScroll}>
            <Text style={styles.inputLabel}>Task Title *</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. Retail Signage Audit & Soundbox Verification"
              placeholderTextColor={colors.textLightMuted}
              value={newTitle}
              onChangeText={setNewTitle}
            />

            <Text style={styles.inputLabel}>Detailed Scope / Instructions</Text>
            <TextInput
              style={[styles.textInput, { minHeight: 70, textAlignVertical: 'top' }]}
              placeholder="Provide checklist requirements, item locations, or safety instructions..."
              placeholderTextColor={colors.textLightMuted}
              multiline
              numberOfLines={3}
              value={newDescription}
              onChangeText={setNewDescription}
            />

            <Text style={styles.inputLabel}>Reward Bounty (INR) — Max ₹5,000 Cap *</Text>
            <TextInput
              style={styles.textInput}
              placeholder="500"
              placeholderTextColor={colors.textLightMuted}
              keyboardType="numeric"
              value={newReward}
              onChangeText={setNewReward}
            />

            <Text style={styles.inputLabel}>Site Address / Landmark</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. Metro Pillar 114, Jubilee Hills, Hyderabad"
              placeholderTextColor={colors.textLightMuted}
              value={newAddress}
              onChangeText={setNewAddress}
            />

            <Text style={styles.inputLabel}>Category</Text>
            <View style={styles.categoryRow}>
              {['Site survey', 'Shelf audit', 'Signage check', 'Equipment inspection'].map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.catBtn, newCategory === cat && styles.catBtnActive]}
                  onPress={() => setNewCategory(cat)}
                >
                  <Text style={[styles.catBtnText, newCategory === cat && styles.catBtnTextActive]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>Verification Checklist Template</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.lg }}>
              {checklistTemplates.map((tmpl) => (
                <TouchableOpacity
                  key={tmpl.id}
                  style={[styles.templateChip, newTemplateId === tmpl.id && styles.templateChipActive]}
                  onPress={() => setNewTemplateId(tmpl.id)}
                >
                  <Text style={[styles.templateChipText, newTemplateId === tmpl.id && styles.templateChipTextActive]}>
                    {tmpl.title} ({tmpl.itemCount} items)
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={styles.submitCreateBtn}
              onPress={handleCreateTask}
              disabled={creating}
            >
              <Text style={styles.submitCreateBtnText}>
                {creating ? 'Creating Task...' : 'Dispatch Task to Area Queue'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* Assign Worker Modal */}
      <Modal
        visible={assignModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAssignModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.assignBox}>
            <Text style={styles.assignTitle}>Assign Field Worker</Text>
            <Text style={styles.assignSub}>
              Task: {taskToAssign?.displayId || taskToAssign?.id.slice(0, 8)} — {taskToAssign?.title}
            </Text>
            <Text style={styles.assignInstruction}>
              Select an active on-field worker in your jurisdiction. Cross-state assignments are prevented by server policy.
            </Text>

            <ScrollView style={{ maxHeight: 240, marginVertical: spacing.sm }}>
              {workers.length === 0 ? (
                <Text style={styles.emptyInlineText}>No workers available in your state.</Text>
              ) : (
                workers.map((w) => (
                  <TouchableOpacity
                    key={w.id}
                    style={[styles.workerOption, selectedWorkerId === w.id && styles.workerOptionActive]}
                    onPress={() => setSelectedWorkerId(w.id)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.workerOptionName}>{w.displayName}</Text>
                      <Text style={styles.workerOptionSub}>
                        {w.displayId || 'EMP'} • {w.stateCode || w.region || 'Assigned State'}
                      </Text>
                    </View>
                    {selectedWorkerId === w.id && (
                      <Text style={styles.workerOptionCheck}>✓</Text>
                    )}
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>

            <View style={styles.assignActions}>
              <TouchableOpacity
                style={styles.assignCancelBtn}
                onPress={() => setAssignModalVisible(false)}
              >
                <Text style={styles.assignCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.assignConfirmBtn}
                onPress={handleConfirmAssignment}
                disabled={assigning || !selectedWorkerId}
              >
                {assigning ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.assignConfirmText}>Confirm Assignment ✓</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Task Details Modal */}
      <Modal
        visible={selectedTask !== null}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setSelectedTask(null)}
      >
        {selectedTask && (
          <View style={styles.modalFullContainer}>
            <View style={styles.modalHeaderBar}>
              <TouchableOpacity onPress={() => setSelectedTask(null)}>
                <Text style={styles.modalBackBtnText}>← Back to Task List</Text>
              </TouchableOpacity>
              <Text style={styles.modalHeaderTitle}>Task Details</Text>
            </View>

            <ScrollView contentContainerStyle={styles.modalScroll}>
              <View style={styles.taskDetailHeader}>
                <View style={styles.taskIdBadge}>
                  <Text style={styles.taskIdBadgeText}>{selectedTask.displayId || selectedTask.id}</Text>
                </View>
                <Text style={styles.taskDetailTitle}>{selectedTask.title}</Text>
                <Badge
                  status={selectedTask.status === 'approved' ? 'completed' : 'open'}
                  label={selectedTask.status.replace('_', ' ').toUpperCase()}
                />
              </View>

              <View style={styles.sectionBox}>
                <Text style={styles.sectionHeader}>📋 TASK ATTRIBUTES</Text>
                <View style={styles.infoRow}>
                  <Text style={styles.infoKey}>Category</Text>
                  <Text style={styles.infoVal}>{selectedTask.category}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoKey}>Reward Bounty</Text>
                  <Text style={[styles.infoVal, { color: colors.success }]}>₹{selectedTask.rewardInr}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoKey}>Site Address</Text>
                  <Text style={styles.infoVal}>{selectedTask.location?.address || 'Site Coordinate'}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoKey}>Geofence Radius</Text>
                  <Text style={styles.infoVal}>{selectedTask.geofenceRadiusMeters || 200} meters</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoKey}>Created By</Text>
                  <Text style={styles.infoVal}>
                    {selectedTask.createdByName || 'Staff'} ({selectedTask.createdByRole || 'ADMIN'})
                  </Text>
                </View>
              </View>

              {/* Lifecycle Actions */}
              <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
                {selectedTask.status !== 'approved' && selectedTask.status !== 'cancelled' && (
                  <>
                    <TouchableOpacity
                      style={styles.submitCreateBtn}
                      onPress={() => {
                        const t = selectedTask;
                        setSelectedTask(null);
                        openAssignModal(t);
                      }}
                    >
                      <Text style={styles.submitCreateBtnText}>
                        {selectedTask.assigneeId ? 'Reassign to Another Worker' : 'Assign to Worker'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.submitCreateBtn, { backgroundColor: '#DC2626' }]}
                      onPress={() => handleCancelTask(selectedTask)}
                    >
                      <Text style={styles.submitCreateBtnText}>Cancel Task</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </ScrollView>
          </View>
        )}
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
  topBar: {
    flexDirection: 'row',
    padding: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.navyDark,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDark,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceDark,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderDark,
    paddingHorizontal: spacing.sm,
  },
  searchIcon: {
    fontSize: 13,
    marginRight: spacing.xs,
  },
  searchInput: {
    flex: 1,
    height: 36,
    color: colors.textLight,
    fontSize: 12,
  },
  searchClear: {
    color: colors.textLightMuted,
    fontSize: 13,
    fontWeight: '700',
    padding: spacing.xs,
  },
  createBtn: {
    backgroundColor: colors.bluePrimary,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    justifyContent: 'center',
  },
  createBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  filtersScroll: {
    backgroundColor: colors.navyDark,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDark,
    maxHeight: 44,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceDark,
    marginRight: spacing.xs,
  },
  filterChipActive: {
    backgroundColor: colors.bluePrimary,
  },
  filterChipText: {
    color: colors.textLightMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  filterChipTextActive: {
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
  taskCard: {
    backgroundColor: colors.navyDark,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderDark,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  taskCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
  },
  taskIdBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  taskIdBadgeText: {
    color: colors.blueAccent,
    fontSize: 10,
    fontFamily: 'monospace',
    fontWeight: '800',
  },
  categoryLabel: {
    color: colors.textLightMuted,
    fontSize: 11,
  },
  taskTitle: {
    color: colors.textLight,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 3,
  },
  metaBox: {
    backgroundColor: colors.surfaceDark,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginVertical: spacing.xs,
  },
  metaLine: {
    color: colors.textLight,
    fontSize: 11,
    lineHeight: 18,
  },
  rewardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  rewardLabel: {
    color: colors.textLightMuted,
    fontSize: 12,
  },
  rewardVal: {
    color: colors.success,
    fontSize: 16,
    fontWeight: '800',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.borderDark,
  },
  detailBtn: {
    flex: 1,
    backgroundColor: colors.surfaceDark,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  detailBtnText: {
    color: colors.textLight,
    fontSize: 11,
    fontWeight: '700',
  },
  assignBtn: {
    flex: 1.2,
    backgroundColor: colors.bluePrimary,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  assignBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  cancelBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#F87171',
    fontSize: 11,
    fontWeight: '700',
  },
  // Modal Full Container
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
  modalSaveBtnText: {
    color: colors.success,
    fontSize: 14,
    fontWeight: '800',
  },
  modalScroll: {
    padding: spacing.lg,
    paddingBottom: spacing.huge * 2,
  },
  inputLabel: {
    color: colors.textLight,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
    marginTop: spacing.md,
  },
  textInput: {
    backgroundColor: colors.surfaceDark,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderDark,
    padding: spacing.md,
    color: colors.textLight,
    fontSize: 13,
  },
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  catBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceDark,
  },
  catBtnActive: {
    backgroundColor: colors.bluePrimary,
  },
  catBtnText: {
    color: colors.textLightMuted,
    fontSize: 11,
  },
  catBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  templateChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceDark,
    marginRight: spacing.xs,
  },
  templateChipActive: {
    backgroundColor: colors.bluePrimary,
  },
  templateChipText: {
    color: colors.textLightMuted,
    fontSize: 11,
  },
  templateChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  submitCreateBtn: {
    backgroundColor: colors.bluePrimary,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  submitCreateBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  // Assign Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  assignBox: {
    width: '100%',
    backgroundColor: colors.navyDark,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderDark,
    padding: spacing.xl,
  },
  assignTitle: {
    color: colors.textLight,
    fontSize: 17,
    fontWeight: '800',
  },
  assignSub: {
    color: colors.blueAccent,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  assignInstruction: {
    color: colors.textLightMuted,
    fontSize: 11,
    lineHeight: 16,
    marginVertical: spacing.sm,
  },
  workerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceDark,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.xs,
  },
  workerOptionActive: {
    borderWidth: 1,
    borderColor: colors.blueAccent,
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
  },
  workerOptionName: {
    color: colors.textLight,
    fontSize: 13,
    fontWeight: '700',
  },
  workerOptionSub: {
    color: colors.textLightMuted,
    fontSize: 11,
    marginTop: 1,
  },
  workerOptionCheck: {
    color: colors.blueAccent,
    fontWeight: '800',
    fontSize: 14,
  },
  assignActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  assignCancelBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceDark,
  },
  assignCancelText: {
    color: colors.textLightMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  assignConfirmBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.bluePrimary,
  },
  assignConfirmText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  emptyInlineText: {
    color: colors.textLightMuted,
    fontSize: 12,
    fontStyle: 'italic',
    padding: spacing.md,
  },
  // Task detail modal items
  taskDetailHeader: {
    alignItems: 'flex-start',
    backgroundColor: colors.navyDark,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderDark,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  taskDetailTitle: {
    color: colors.textLight,
    fontSize: 17,
    fontWeight: '800',
    marginVertical: spacing.xs,
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
});
