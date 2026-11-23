import React, { useEffect, useState } from 'react';
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Platform,
  Modal,
  Alert,
} from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { QueryProvider } from './src/context/QueryContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { ThemeToggle } from './src/components/ui/ThemeToggle';
import { colors, spacing, radius } from './src/theme';
import { mobileApi } from './src/api/restApi';
import type { Task } from './src/types';

// UI Kit & Error Boundary
import { ErrorBoundary, IntroAnimation } from './src/components/ui';

// Auth Screens
import { LandingScreen } from './src/screens/auth/LandingScreen';
import { LoginScreen } from './src/screens/auth/LoginScreen';
import { RegisterEmployeeScreen } from './src/screens/auth/RegisterEmployeeScreen';
import { RegisterCustomerScreen } from './src/screens/auth/RegisterCustomerScreen';
import { PendingApprovalScreen } from './src/screens/auth/PendingApprovalScreen';
import { VerifierDashboardScreen } from './src/screens/verifier/VerifierDashboardScreen';

// Customer Screens
import { CustomerDashboardScreen } from './src/screens/customer/CustomerDashboardScreen';
import { CreateTaskScreen } from './src/screens/customer/CreateTaskScreen';
import { CustomerTrackingScreen } from './src/screens/customer/CustomerTrackingScreen';
import { CustomerTransportScreen } from './src/screens/customer/CustomerTransportScreen';
import { CustomerProfileScreen } from './src/screens/customer/CustomerProfileScreen';

// Employee Screens
import { EmployeeHomeScreen } from './src/screens/employee/EmployeeHomeScreen';
import { NearbyTasksScreen } from './src/screens/employee/NearbyTasksScreen';
import { ActiveTaskScreen } from './src/screens/employee/ActiveTaskScreen';
import { WalletScreen } from './src/screens/employee/WalletScreen';
import { EmployeeProfileScreen } from './src/screens/employee/EmployeeProfileScreen';

// Manager Screens
import { ManagerReviewScreen } from './src/screens/manager/ManagerReviewScreen';
import { EmployeeApprovalsScreen } from './src/screens/manager/EmployeeApprovalsScreen';
import { ManagerTasksScreen } from './src/screens/manager/ManagerTasksScreen';
import { ManagerWalletScreen } from './src/screens/manager/ManagerWalletScreen';

// Admin Screens
import { AdminDashboardScreen } from './src/screens/admin/AdminDashboardScreen';
import { EmployeeDirectoryScreen } from './src/screens/admin/EmployeeDirectoryScreen';
import { AdminAreasScreen } from './src/screens/admin/AdminAreasScreen';

// Cross-cutting Shared Screens & Modals
import { SupportTicketsScreen } from './src/screens/shared/SupportTicketsScreen';
import { NotificationsScreen } from './src/screens/shared/NotificationsScreen';
import { TaskDetailsModal } from './src/components/TaskDetailsModal';
import { TaskFeedbackModal } from './src/components/customer/TaskFeedbackModal';

function MainAppNavigator() {
  const { isAuthenticated, isPendingApproval, role, user, signOut } = useAuth();
  const { colors: themeColors } = useTheme();

  // Intro animation state (once per app session)
  const [showIntro, setShowIntro] = useState(true);

  // Auth navigation state
  const [authScreen, setAuthScreen] = useState<'landing' | 'login' | 'register_employee' | 'register_customer'>('landing');

  // Customer tab state
  const [customerTab, setCustomerTab] = useState<'dashboard' | 'create_task' | 'tracking' | 'transport' | 'profile'>('dashboard');

  // Employee tab state
  const [employeeTab, setEmployeeTab] = useState<'home' | 'nearby' | 'active' | 'wallet' | 'profile'>('home');
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  // Manager tab state
  const [managerTab, setManagerTab] = useState<'review' | 'tasks' | 'approvals' | 'wallets' | 'profile'>('review');
  const [managerArea, setManagerArea] = useState<{ stateCode: string; stateName: string; isAssigned: boolean } | null>(null);

  // Verifier tab state
  const [verifierTab, setVerifierTab] = useState<'queue' | 'workers' | 'profile'>('queue');

  useEffect(() => {
    if (role === 'manager' || role === 'operations') {
      mobileApi
        .getMyArea(user?.token)
        .then((res) => setManagerArea(res))
        .catch(() => {});
    }
  }, [role, user?.token]);

  // Admin tab state
  const [adminTab, setAdminTab] = useState<'dashboard' | 'areas' | 'directory' | 'review' | 'approvals' | 'profile'>('dashboard');

  // Modals
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [feedbackTaskId, setFeedbackTaskId] = useState<string | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSupport, setShowSupport] = useState(false);

  // 0. Intro Animation
  if (showIntro) {
    return <IntroAnimation onComplete={() => setShowIntro(false)} />;
  }

  // 1. Unauthenticated State
  if (!isAuthenticated) {
    if (authScreen === 'landing') {
      return (
        <SafeAreaView style={[styles.safe, { backgroundColor: themeColors.canvas }]}>
          <LandingScreen
            onGetStarted={() => setAuthScreen('login')}
            onNavigateToRegisterEmployee={() => setAuthScreen('register_employee')}
            onNavigateToRegisterCustomer={() => setAuthScreen('register_customer')}
          />
        </SafeAreaView>
      );
    }
    if (authScreen === 'register_employee') {
      return (
        <SafeAreaView style={[styles.safe, { backgroundColor: themeColors.canvas }]}>
          <RegisterEmployeeScreen onBackToLogin={() => setAuthScreen('login')} />
        </SafeAreaView>
      );
    }
    if (authScreen === 'register_customer') {
      return (
        <SafeAreaView style={[styles.safe, { backgroundColor: themeColors.canvas }]}>
          <RegisterCustomerScreen onBackToLogin={() => setAuthScreen('login')} />
        </SafeAreaView>
      );
    }
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: themeColors.canvas }]}>
        <LoginScreen
          onBackToLanding={() => setAuthScreen('landing')}
          onNavigateToRegisterEmployee={() => setAuthScreen('register_employee')}
          onNavigateToRegisterCustomer={() => setAuthScreen('register_customer')}
        />
      </SafeAreaView>
    );
  }

  // 2. Pending Approval Quarantine
  if (isPendingApproval) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: themeColors.canvas }]}>
        <PendingApprovalScreen />
      </SafeAreaView>
    );
  }

  // Common Header Bar for theme toggle, notifications & support shortcuts
  const renderQuickActions = () => (
    <View style={[styles.quickActionsBar, { backgroundColor: themeColors.canvas }]}>
      <ThemeToggle />
      <TouchableOpacity
        style={[
          styles.quickActionBtn,
          {
            backgroundColor: themeColors.card,
            borderColor: themeColors.border,
          },
        ]}
        onPress={() => setShowNotifications(true)}
        activeOpacity={0.8}
      >
        <Text style={styles.quickActionIcon}>🔔</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.quickActionBtn,
          {
            backgroundColor: themeColors.card,
            borderColor: themeColors.border,
          },
        ]}
        onPress={() => setShowSupport(true)}
        activeOpacity={0.8}
      >
        <Text style={styles.quickActionIcon}>🎫</Text>
      </TouchableOpacity>
    </View>
  );

  // 3. Customer Portal Flow
  if (role === 'customer') {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: themeColors.canvas }]}>
        {renderQuickActions()}
        <View style={styles.contentArea}>
          {customerTab === 'dashboard' && (
            <CustomerDashboardScreen
              onNavigateToCreateTask={() => setCustomerTab('create_task')}
              onNavigateToTracking={() => setCustomerTab('tracking')}
              onNavigateToTransport={() => setCustomerTab('transport')}
              onSelectTask={(task) => setSelectedTask(task)}
            />
          )}
          {customerTab === 'create_task' && (
            <CreateTaskScreen
              onBack={() => setCustomerTab('dashboard')}
              onTaskCreated={() => setCustomerTab('dashboard')}
            />
          )}
          {customerTab === 'tracking' && <CustomerTrackingScreen />}
          {customerTab === 'transport' && <CustomerTransportScreen />}
          {customerTab === 'profile' && (
            <CustomerProfileScreen onNavigateToSupport={() => setShowSupport(true)} />
          )}
        </View>

        {/* Customer Bottom Navigation Bar */}
        <View style={[styles.bottomNav, { backgroundColor: themeColors.navBg, borderTopColor: themeColors.navBorder }]}>
          <TouchableOpacity
            style={[styles.navItem, customerTab === 'dashboard' && styles.navItemActive]}
            onPress={() => setCustomerTab('dashboard')}
          >
            <Text style={styles.navIcon}>📊</Text>
            <Text style={[styles.navLabel, customerTab === 'dashboard' && styles.navLabelActive]}>
              Overview
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navItem, customerTab === 'create_task' && styles.navItemActive]}
            onPress={() => setCustomerTab('create_task')}
          >
            <Text style={styles.navIcon}>➕</Text>
            <Text style={[styles.navLabel, customerTab === 'create_task' && styles.navLabelActive]}>
              Create Task
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navItem, customerTab === 'tracking' && styles.navItemActive]}
            onPress={() => setCustomerTab('tracking')}
          >
            <Text style={styles.navIcon}>📍</Text>
            <Text style={[styles.navLabel, customerTab === 'tracking' && styles.navLabelActive]}>
              Tracking
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navItem, customerTab === 'transport' && styles.navItemActive]}
            onPress={() => setCustomerTab('transport')}
          >
            <Text style={styles.navIcon}>🚚</Text>
            <Text style={[styles.navLabel, customerTab === 'transport' && styles.navLabelActive]}>
              Transport
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navItem, customerTab === 'profile' && styles.navItemActive]}
            onPress={() => setCustomerTab('profile')}
          >
            <Text style={styles.navIcon}>🏢</Text>
            <Text style={[styles.navLabel, customerTab === 'profile' && styles.navLabelActive]}>
              Profile
            </Text>
          </TouchableOpacity>
        </View>

        <TaskDetailsModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onRateTask={(taskId) => {
            setSelectedTask(null);
            setFeedbackTaskId(taskId);
          }}
        />

        <TaskFeedbackModal
          taskId={feedbackTaskId}
          taskTitle={selectedTask?.title}
          onClose={() => setFeedbackTaskId(null)}
        />

        <Modal visible={showNotifications} animationType="slide" onRequestClose={() => setShowNotifications(false)}>
          <SafeAreaView style={styles.safe}>
            <TouchableOpacity style={styles.modalCloseTop} onPress={() => setShowNotifications(false)}>
              <Text style={styles.modalCloseTopText}>← Back to Overview</Text>
            </TouchableOpacity>
            <NotificationsScreen />
          </SafeAreaView>
        </Modal>

        <Modal visible={showSupport} animationType="slide" onRequestClose={() => setShowSupport(false)}>
          <SafeAreaView style={[styles.safe, { backgroundColor: themeColors.canvas }]}>
            <TouchableOpacity style={styles.modalCloseTop} onPress={() => setShowSupport(false)}>
              <Text style={styles.modalCloseTopText}>← Back to Overview</Text>
            </TouchableOpacity>
            <SupportTicketsScreen />
          </SafeAreaView>
        </Modal>
      </SafeAreaView>
    );
  }

  // 4. Field Employee Portal Flow (Primary Mobile Role)
  if (role === 'employee') {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: themeColors.canvas }]}>
        {renderQuickActions()}
        <View style={styles.contentArea}>
          {employeeTab === 'home' && (
            <EmployeeHomeScreen
              onNavigateToNearby={() => setEmployeeTab('nearby')}
              onNavigateToActiveTask={() => setEmployeeTab('active')}
              onNavigateToWallet={() => setEmployeeTab('wallet')}
              onNavigateToProfile={() => setEmployeeTab('profile')}
            />
          )}
          {employeeTab === 'nearby' && (
            <NearbyTasksScreen
              onAcceptTask={async (task) => {
                try {
                  const updatedTask = await mobileApi.acceptTask(task.id, user?.token);
                  setActiveTask(updatedTask);
                  setEmployeeTab('active');
                } catch (err: any) {
                  Alert.alert(
                    'Task Unavailable',
                    err.message || 'This task has already been claimed by another field worker or is no longer open.',
                  );
                }
              }}
              onSelectTask={(task) => setSelectedTask(task)}
            />
          )}
          {employeeTab === 'active' && (
            <ActiveTaskScreen
              task={activeTask}
              onTaskCompleted={() => {
                setActiveTask(null);
                setEmployeeTab('wallet');
              }}
              onNavigateToNearby={() => setEmployeeTab('nearby')}
            />
          )}
          {employeeTab === 'wallet' && <WalletScreen />}
          {employeeTab === 'profile' && (
            <EmployeeProfileScreen onNavigateToSupport={() => setShowSupport(true)} />
          )}
        </View>

        {/* Employee Bottom Navigation Bar: Home, Nearby, Tasks, Wallet, Profile */}
        <View style={[styles.bottomNav, { backgroundColor: themeColors.navBg, borderTopColor: themeColors.navBorder }]}>
          <TouchableOpacity
            style={[styles.navItem, employeeTab === 'home' && styles.navItemActive]}
            onPress={() => setEmployeeTab('home')}
          >
            <Text style={styles.navIcon}>🏠</Text>
            <Text style={[styles.navLabel, employeeTab === 'home' && styles.navLabelActive]}>
              Home
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navItem, employeeTab === 'nearby' && styles.navItemActive]}
            onPress={() => setEmployeeTab('nearby')}
          >
            <Text style={styles.navIcon}>📍</Text>
            <Text style={[styles.navLabel, employeeTab === 'nearby' && styles.navLabelActive]}>
              Nearby
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navItem, employeeTab === 'active' && styles.navItemActive]}
            onPress={() => setEmployeeTab('active')}
          >
            <Text style={styles.navIcon}>📦</Text>
            <Text style={[styles.navLabel, employeeTab === 'active' && styles.navLabelActive]}>
              Tasks
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navItem, employeeTab === 'wallet' && styles.navItemActive]}
            onPress={() => setEmployeeTab('wallet')}
          >
            <Text style={styles.navIcon}>💰</Text>
            <Text style={[styles.navLabel, employeeTab === 'wallet' && styles.navLabelActive]}>
              Wallet
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navItem, employeeTab === 'profile' && styles.navItemActive]}
            onPress={() => setEmployeeTab('profile')}
          >
            <Text style={styles.navIcon}>👤</Text>
            <Text style={[styles.navLabel, employeeTab === 'profile' && styles.navLabelActive]}>
              Profile
            </Text>
          </TouchableOpacity>
        </View>

        <TaskDetailsModal task={selectedTask} onClose={() => setSelectedTask(null)} />

        <Modal visible={showNotifications} animationType="slide" onRequestClose={() => setShowNotifications(false)}>
          <SafeAreaView style={[styles.safe, { backgroundColor: themeColors.canvas }]}>
            <TouchableOpacity style={styles.modalCloseTop} onPress={() => setShowNotifications(false)}>
              <Text style={styles.modalCloseTopText}>← Back to Field Command</Text>
            </TouchableOpacity>
            <NotificationsScreen />
          </SafeAreaView>
        </Modal>

        <Modal visible={showSupport} animationType="slide" onRequestClose={() => setShowSupport(false)}>
          <SafeAreaView style={[styles.safe, { backgroundColor: themeColors.canvas }]}>
            <TouchableOpacity style={styles.modalCloseTop} onPress={() => setShowSupport(false)}>
              <Text style={styles.modalCloseTopText}>← Back to Field Command</Text>
            </TouchableOpacity>
            <SupportTicketsScreen />
          </SafeAreaView>
        </Modal>
      </SafeAreaView>
    );
  }

  // 5. Manager / Operations Portal Flow
  if (role === 'manager' || role === 'operations') {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: themeColors.canvas }]}>
        {renderQuickActions()}

        {/* Manager Area Banner */}
        <View style={styles.managerAreaBanner}>
          <Text style={styles.managerAreaIcon}>🛡️</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.managerAreaTitle}>
              {managerArea && managerArea.isAssigned
                ? `JURISDICTION: ${managerArea.stateCode} (${managerArea.stateName})`
                : 'STATE JURISDICTION: UNASSIGNED'}
            </Text>
            <Text style={styles.managerAreaSub}>
              {managerArea && managerArea.isAssigned
                ? 'Tasks and workers outside this state return 404/403'
                : 'Awaiting admin state assignment'}
            </Text>
          </View>
        </View>

        <View style={styles.contentArea}>
          {managerTab === 'review' && (
            <ManagerReviewScreen onSelectTask={(task: Task) => setSelectedTask(task)} />
          )}
          {managerTab === 'tasks' && <ManagerTasksScreen />}
          {managerTab === 'approvals' && <EmployeeApprovalsScreen />}
          {managerTab === 'wallets' && <ManagerWalletScreen />}
          {managerTab === 'profile' && (
            <EmployeeProfileScreen onNavigateToSupport={() => setShowSupport(true)} />
          )}
        </View>

        <View style={[styles.bottomNav, { backgroundColor: themeColors.navBg, borderTopColor: themeColors.navBorder }]}>
          <TouchableOpacity
            style={[styles.navItem, managerTab === 'review' && styles.navItemActive]}
            onPress={() => setManagerTab('review')}
          >
            <Text style={styles.navIcon}>📋</Text>
            <Text style={[styles.navLabel, managerTab === 'review' && styles.navLabelActive]}>
              Review
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navItem, managerTab === 'tasks' && styles.navItemActive]}
            onPress={() => setManagerTab('tasks')}
          >
            <Text style={styles.navIcon}>📦</Text>
            <Text style={[styles.navLabel, managerTab === 'tasks' && styles.navLabelActive]}>
              Tasks
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navItem, managerTab === 'approvals' && styles.navItemActive]}
            onPress={() => setManagerTab('approvals')}
          >
            <Text style={styles.navIcon}>👥</Text>
            <Text style={[styles.navLabel, managerTab === 'approvals' && styles.navLabelActive]}>
              Workers
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navItem, managerTab === 'wallets' && styles.navItemActive]}
            onPress={() => setManagerTab('wallets')}
          >
            <Text style={styles.navIcon}>💰</Text>
            <Text style={[styles.navLabel, managerTab === 'wallets' && styles.navLabelActive]}>
              Wallets
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navItem, managerTab === 'profile' && styles.navItemActive]}
            onPress={() => setManagerTab('profile')}
          >
            <Text style={styles.navIcon}>👤</Text>
            <Text style={[styles.navLabel, managerTab === 'profile' && styles.navLabelActive]}>
              Profile
            </Text>
          </TouchableOpacity>
        </View>

        <TaskDetailsModal task={selectedTask} onClose={() => setSelectedTask(null)} />

        <Modal visible={showNotifications} animationType="slide" onRequestClose={() => setShowNotifications(false)}>
          <SafeAreaView style={[styles.safe, { backgroundColor: themeColors.canvas }]}>
            <TouchableOpacity style={styles.modalCloseTop} onPress={() => setShowNotifications(false)}>
              <Text style={styles.modalCloseTopText}>← Back to Manager Deck</Text>
            </TouchableOpacity>
            <NotificationsScreen />
          </SafeAreaView>
        </Modal>

        <Modal visible={showSupport} animationType="slide" onRequestClose={() => setShowSupport(false)}>
          <SafeAreaView style={[styles.safe, { backgroundColor: themeColors.canvas }]}>
            <TouchableOpacity style={styles.modalCloseTop} onPress={() => setShowSupport(false)}>
              <Text style={styles.modalCloseTopText}>← Back to Manager Deck</Text>
            </TouchableOpacity>
            <SupportTicketsScreen />
          </SafeAreaView>
        </Modal>
      </SafeAreaView>
    );
  }

  // 5b. Verifier / Clear & Verify Portal Flow
  if (role === 'verifier') {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: themeColors.canvas }]}>
        {renderQuickActions()}
        <View style={styles.contentArea}>
          {verifierTab === 'queue' && (
            <VerifierDashboardScreen
              onSelectTask={(task: Task) => setSelectedTask(task)}
              onNavigateToSupport={() => setShowSupport(true)}
            />
          )}
          {verifierTab === 'workers' && <EmployeeApprovalsScreen />}
          {verifierTab === 'profile' && (
            <EmployeeProfileScreen onNavigateToSupport={() => setShowSupport(true)} />
          )}
        </View>

        <View style={[styles.bottomNav, { backgroundColor: themeColors.navBg, borderTopColor: themeColors.navBorder }]}>
          <TouchableOpacity
            style={[styles.navItem, verifierTab === 'queue' && styles.navItemActive]}
            onPress={() => setVerifierTab('queue')}
          >
            <Text style={styles.navIcon}>🛡️</Text>
            <Text style={[styles.navLabel, verifierTab === 'queue' && styles.navLabelActive]}>
              Clear & Verify
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navItem, verifierTab === 'workers' && styles.navItemActive]}
            onPress={() => setVerifierTab('workers')}
          >
            <Text style={styles.navIcon}>👥</Text>
            <Text style={[styles.navLabel, verifierTab === 'workers' && styles.navLabelActive]}>
              Workers
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navItem, verifierTab === 'profile' && styles.navItemActive]}
            onPress={() => setVerifierTab('profile')}
          >
            <Text style={styles.navIcon}>👤</Text>
            <Text style={[styles.navLabel, verifierTab === 'profile' && styles.navLabelActive]}>
              Profile
            </Text>
          </TouchableOpacity>
        </View>

        <TaskDetailsModal task={selectedTask} onClose={() => setSelectedTask(null)} />

        <Modal visible={showNotifications} animationType="slide" onRequestClose={() => setShowNotifications(false)}>
          <SafeAreaView style={[styles.safe, { backgroundColor: themeColors.canvas }]}>
            <TouchableOpacity style={styles.modalCloseTop} onPress={() => setShowNotifications(false)}>
              <Text style={styles.modalCloseTopText}>← Back to Verification Deck</Text>
            </TouchableOpacity>
            <NotificationsScreen />
          </SafeAreaView>
        </Modal>

        <Modal visible={showSupport} animationType="slide" onRequestClose={() => setShowSupport(false)}>
          <SafeAreaView style={[styles.safe, { backgroundColor: themeColors.canvas }]}>
            <TouchableOpacity style={styles.modalCloseTop} onPress={() => setShowSupport(false)}>
              <Text style={styles.modalCloseTopText}>← Back to Verification Deck</Text>
            </TouchableOpacity>
            <SupportTicketsScreen />
          </SafeAreaView>
        </Modal>
      </SafeAreaView>
    );
  }

  // 6. Partner does not inherit an administrative workspace. The current
  // backend exposes TMS endpoints, but a mobile partner experience has not
  // been implemented yet, so fail closed rather than rendering admin screens.
  if (role === 'partner') {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: themeColors.canvas }]}>
        <View style={[styles.contentArea, { alignItems: 'center', justifyContent: 'center', padding: spacing.xl }]}>
          <Text style={{ color: colors.textLight, fontSize: 20, fontWeight: '700', textAlign: 'center' }}>Partner workspace unavailable</Text>
          <Text style={{ color: colors.textLightMuted, fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: spacing.sm }}>
            This account is recognised as a partner, but the mobile partner workspace is not available in this build. No administrative data has been shown.
          </Text>
          <TouchableOpacity style={[styles.quickActionBtn, { marginTop: spacing.xl, paddingHorizontal: spacing.lg }]} onPress={signOut}>
            <Text style={styles.quickActionIcon}>Sign out</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // 7. Admin Portal Flow
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: themeColors.canvas }]}>
      {renderQuickActions()}
      <View style={styles.contentArea}>
        {adminTab === 'dashboard' && <AdminDashboardScreen />}
        {adminTab === 'areas' && <AdminAreasScreen />}
        {adminTab === 'directory' && <EmployeeDirectoryScreen />}
        {adminTab === 'review' && (
          <ManagerReviewScreen onSelectTask={(task: Task) => setSelectedTask(task)} />
        )}
        {adminTab === 'approvals' && <EmployeeApprovalsScreen />}
        {adminTab === 'profile' && (
          <EmployeeProfileScreen onNavigateToSupport={() => setShowSupport(true)} />
        )}
      </View>

      <View style={[styles.bottomNav, { backgroundColor: themeColors.navBg, borderTopColor: themeColors.navBorder }]}>
        <TouchableOpacity
          style={[styles.navItem, adminTab === 'dashboard' && styles.navItemActive]}
          onPress={() => setAdminTab('dashboard')}
        >
          <Text style={styles.navIcon}>📊</Text>
          <Text style={[styles.navLabel, adminTab === 'dashboard' && styles.navLabelActive]}>
            Command
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navItem, adminTab === 'areas' && styles.navItemActive]}
          onPress={() => setAdminTab('areas')}
        >
          <Text style={styles.navIcon}>🗺️</Text>
          <Text style={[styles.navLabel, adminTab === 'areas' && styles.navLabelActive]}>
            Areas
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navItem, adminTab === 'directory' && styles.navItemActive]}
          onPress={() => setAdminTab('directory')}
        >
          <Text style={styles.navIcon}>👥</Text>
          <Text style={[styles.navLabel, adminTab === 'directory' && styles.navLabelActive]}>
            Directory
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navItem, adminTab === 'review' && styles.navItemActive]}
          onPress={() => setAdminTab('review')}
        >
          <Text style={styles.navIcon}>🛡️</Text>
          <Text style={[styles.navLabel, adminTab === 'review' && styles.navLabelActive]}>
            Queue
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navItem, adminTab === 'profile' && styles.navItemActive]}
          onPress={() => setAdminTab('profile')}
        >
          <Text style={styles.navIcon}>⚙️</Text>
          <Text style={[styles.navLabel, adminTab === 'profile' && styles.navLabelActive]}>
            Admin
          </Text>
        </TouchableOpacity>
      </View>

      <TaskDetailsModal task={selectedTask} onClose={() => setSelectedTask(null)} />

      <Modal visible={showNotifications} animationType="slide" onRequestClose={() => setShowNotifications(false)}>
        <SafeAreaView style={styles.safe}>
          <TouchableOpacity style={styles.modalCloseTop} onPress={() => setShowNotifications(false)}>
            <Text style={styles.modalCloseTopText}>← Back to Admin Console</Text>
          </TouchableOpacity>
          <NotificationsScreen />
        </SafeAreaView>
      </Modal>

      <Modal visible={showSupport} animationType="slide" onRequestClose={() => setShowSupport(false)}>
        <SafeAreaView style={styles.safe}>
          <TouchableOpacity style={styles.modalCloseTop} onPress={() => setShowSupport(false)}>
            <Text style={styles.modalCloseTopText}>← Back to Admin Console</Text>
          </TouchableOpacity>
          <SupportTicketsScreen />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function AppShellWithTheme() {
  const { resolvedTheme } = useTheme();
  return (
    <>
      <StatusBar
        barStyle={resolvedTheme === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={resolvedTheme === 'dark' ? '#141412' : '#F3F1EB'}
      />
      <ExpoStatusBar style={resolvedTheme === 'dark' ? 'light' : 'dark'} />
      <MainAppNavigator />
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <QueryProvider>
          <AuthProvider>
            <AppShellWithTheme />
          </AuthProvider>
        </QueryProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.canvas,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  contentArea: {
    flex: 1,
  },
  quickActionsBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.canvas,
    gap: spacing.xs,
  },
  quickActionBtn: {
    padding: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: colors.cardLight,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  quickActionIcon: {
    fontSize: 16,
  },
  modalCloseTop: {
    padding: spacing.md,
    backgroundColor: colors.cardLight,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  modalCloseTopText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primaryOrange,
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: colors.cardLight,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingBottom: Platform.OS === 'ios' ? spacing.md : spacing.xs,
    paddingTop: spacing.xs,
    height: Platform.OS === 'ios' ? 82 : 62,
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingVertical: spacing.xs,
  },
  navItemActive: {
    borderTopWidth: 2,
    borderTopColor: colors.primaryOrange,
  },
  navIcon: {
    fontSize: 18,
    marginBottom: 2,
  },
  navLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textDarkMuted,
  },
  navLabelActive: {
    color: colors.primaryOrange,
    fontWeight: '700',
  },
  floatingBottomNav: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 24 : 16,
    left: spacing.lg,
    right: spacing.lg,
    backgroundColor: colors.primaryBlack,
    borderRadius: radius.card,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    shadowColor: '#151515',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
    height: 64,
  },
  floatingNavItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  floatingNavItemActive: {
    opacity: 1,
  },
  centerActionButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primaryOrange,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 3,
    borderColor: colors.canvas,
    shadowColor: colors.primaryOrange,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  centerActionButtonActive: {
    backgroundColor: colors.primaryOrangeHover,
    transform: [{ scale: 1.05 }],
  },
  centerActionIcon: {
    fontSize: 22,
    color: '#F3F1EB',
  },
  managerAreaBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(217, 83, 30, 0.1)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(217, 83, 30, 0.2)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  managerAreaIcon: {
    fontSize: 16,
    marginRight: spacing.sm,
  },
  managerAreaTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primaryOrange,
    letterSpacing: 0.5,
  },
  managerAreaSub: {
    fontSize: 10,
    color: colors.textDarkMuted,
    marginTop: 1,
  },
});
