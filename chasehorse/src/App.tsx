import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { websiteRoutes } from '@/website/app/router';
import { AuthProvider } from '@/context/AuthContext';
import { RoleProvider } from '@/context/RoleContext';
import { ToastProvider } from '@/context/ToastContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { AppShell } from '@/layout/AppShell';
import { NotFound } from '@/pages/AccessDenied';
import { PartnerRegistrationPage } from '@/pages/PartnerRegistrationPage';
import { OverviewPage } from '@/pages/OverviewPage';
import { EmployeesPage } from '@/pages/EmployeesPage';
import { TasksPage } from '@/pages/TasksPage';
import { CreateTaskPage } from '@/pages/CreateTaskPage';
import { NearbyPage } from '@/pages/NearbyPage';
import { ChecklistsPage } from '@/pages/ChecklistsPage';
import { ApprovalsPage } from '@/pages/ApprovalsPage';
import { WalletPage } from '@/pages/WalletPage';
import { PendingApprovalPage } from '@/pages/PendingApprovalPage';
import { CustomerDashboardPage } from '@/pages/CustomerDashboardPage';
import { CustomerTrackingPage } from '@/pages/CustomerTrackingPage';
import { CustomerReportsPage } from '@/pages/CustomerReportsPage';
import { CustomerProfilePage } from '@/pages/CustomerProfilePage';
import { CustomerSupportPage } from '@/pages/CustomerSupportPage';
import { CustomerTasksPage } from '@/pages/CustomerTasksPage';
import { CustomerTaskDetailsPage } from '@/pages/CustomerTaskDetailsPage';

import { LoginPage } from '@/pages/LoginPage';
import { RegisterEmployeePage } from '@/pages/RegisterEmployeePage';
import { RegisterCustomerPage } from '@/pages/RegisterCustomerPage';

import { EmployeeDashboardPage } from '@/pages/EmployeeDashboardPage';
import { EmployeeProfilePage } from '@/pages/EmployeeProfilePage';
import { AdminAreasPage } from '@/pages/AdminAreasPage';
import { AdminManagerPortalPage } from '@/pages/AdminManagerPortalPage';
import { EnquiriesPage } from '@/pages/EnquiriesPage';

// The public website loads as its own bundle; portal users never download it.
const WebsiteLayout = lazy(() => import('@/website/WebsiteLayout'));

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <RoleProvider>
          <ToastProvider>
            <BrowserRouter>
              <Routes>
                {/* Public website (home, platform, solutions, partners, careers…).
                    Its Login buttons open the existing /login page below. */}
                <Route
                  element={
                    <Suspense fallback={null}>
                      <WebsiteLayout />
                    </Suspense>
                  }
                >
                  {websiteRoutes}
                </Route>

                {/* Auth & real partner registration (Supabase / backend) */}
                <Route path="partners/register" element={<Navigate to="/partners" replace />} />
                <Route path="partners/register/:partnerType" element={<PartnerRegistrationPage />} />
                <Route path="login" element={<LoginPage />} />
                <Route path="register" element={<RegisterEmployeePage />} />
                <Route path="register/worker" element={<RegisterEmployeePage />} />
                <Route path="register/employee" element={<RegisterEmployeePage />} />
                <Route path="register/customer" element={<RegisterCustomerPage />} />
                <Route path="pending-approval" element={<PendingApprovalPage />} />

                {/* Authenticated Application Shell */}
                <Route element={<AppShell />}>
                  {/* Enquiry Management System (enquiry desk + admins) */}
                  <Route path="enquiries" element={<EnquiriesPage />} />

                  {/* Operations & Dashboards */}
                  <Route path="admin/portal" element={<AdminManagerPortalPage />} />
                  <Route path="manager/portal" element={<AdminManagerPortalPage />} />
                  <Route path="admin/tracking" element={<AdminManagerPortalPage />} />
                  <Route path="manager/tracking" element={<AdminManagerPortalPage />} />
                  <Route path="admin/dashboard" element={<OverviewPage />} />
                  <Route path="admin/areas" element={<AdminAreasPage />} />
                  <Route path="overview" element={<OverviewPage />} />
                  <Route path="customer/dashboard" element={<CustomerDashboardPage />} />
                  <Route path="customer/tasks" element={<CustomerTasksPage />} />
                  <Route path="customer/tasks/:taskId" element={<CustomerTaskDetailsPage />} />
                  <Route path="customer/tasks/new" element={<CreateTaskPage />} />
                  <Route path="customer/tracking" element={<CustomerTrackingPage />} />
                  <Route path="customer/reports" element={<CustomerReportsPage />} />
                  <Route path="customer/profile" element={<CustomerProfilePage />} />
                  <Route path="customer/support" element={<CustomerSupportPage />} />
                  <Route path="customer/history" element={<CustomerTasksPage />} />
                  <Route path="customer/evidence" element={<Navigate to="/customer/history" replace />} />
                  <Route path="employee/dashboard" element={<EmployeeDashboardPage />} />
                  <Route path="employee/profile" element={<EmployeeProfilePage />} />
                  <Route path="profile" element={<EmployeeProfilePage />} />
                  <Route path="support" element={<CustomerSupportPage />} />

                  {/* Core Field Task Execution Engine */}
                  <Route path="nearby" element={<NearbyPage />} />
                  <Route path="tasks" element={<TasksPage />} />
                  <Route path="tasks/:taskId" element={<CustomerTaskDetailsPage />} />
                  <Route path="tasks/new" element={<CreateTaskPage />} />
                  <Route path="checklists" element={<ChecklistsPage />} />
                  <Route path="evidence" element={<Navigate to="/tasks" replace />} />
                  <Route path="approvals" element={<ApprovalsPage />} />
                  <Route path="employees" element={<EmployeesPage />} />
                  <Route path="wallet" element={<WalletPage />} />

                  <Route path="*" element={<NotFound />} />
                </Route>
              </Routes>
            </BrowserRouter>
          </ToastProvider>
        </RoleProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
