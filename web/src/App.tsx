import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';

// Layouts
import { AdminLayout } from './components/Layout/AdminLayout';
import { SuperAdminLayout } from './components/Layout/SuperAdminLayout';
import { StudentLayout } from './components/Layout/StudentLayout';

// Auth Pages
import { Login } from './pages/auth/Login';

// Admin Pages
import { AdminDashboard } from './pages/admin/Dashboard';
import { AdminStudents } from './pages/admin/Students';
import { AdminEnrollment } from './pages/admin/Enrollment';
import { AdminActiveLogs } from './pages/admin/ActiveLogs';
import { AdminPendingPayments } from './pages/admin/PendingPayments';
import { AdminPaymentApprovals } from './pages/admin/PaymentApprovals';
import { AdminRevenueAnalytics } from './pages/admin/RevenueAnalytics';
import { AdminPaymentMaster } from './pages/admin/PaymentMaster';
import { AdminPaySaaS } from './pages/admin/PaySaaS';
import { AdminSeatMaster } from './pages/admin/SeatMaster';
import { AdminLockerMaster } from './pages/admin/LockerMaster';
import { AdminQRDisplay } from './pages/admin/QRDisplay';
import { AdminAttendanceApprovals } from './pages/admin/AttendanceApprovals';
import { AdminSendNotification } from './pages/admin/SendNotification';

// Super Admin Pages
import { SuperAdminLibraries } from './pages/super-admin/Libraries';
import { SuperAdminOnboardLibrary } from './pages/super-admin/OnboardLibrary';
import { SuperAdminSaasPayments } from './pages/super-admin/SaasPayments';
import { SuperAdminAnalytics } from './pages/super-admin/Analytics';
import { SuperAdminFeatureFlags } from './pages/super-admin/FeatureFlags';
import { SuperAdminNotifications } from './pages/super-admin/Notifications';

// Student Pages
import { StudentDashboard } from './pages/student/Dashboard';
import { StudentQRScanner } from './pages/student/QRScanner';
import { StudentStudyReport } from './pages/student/StudyReport';
import { StudentSeats } from './pages/student/Seats';
import { StudentLockers } from './pages/student/Lockers';
import { StudentPayments } from './pages/student/Payments';
import { StudentReferral } from './pages/student/Referral';

function RootRedirect() {
  const { user, isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#0F172A', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#6366F1' }}>
        Loading NextLib Portal...
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role === 'STUDENT') {
    return <Navigate to="/student/dashboard" replace />;
  } else if (user.role === 'SUPER_ADMIN') {
    return <Navigate to="/super-admin/libraries" replace />;
  } else {
    return <Navigate to="/admin/dashboard" replace />;
  }
}

function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles: string[] }) {
  const { user, isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#0F172A', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#6366F1' }}>
        Loading NextLib...
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    return <RootRedirect />;
  }

  return <>{children}</>;
}

export function App() {
  const checkAuth = useAuthStore((state) => state.checkAuth);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return (
    <BrowserRouter>
      <Routes>
        {/* PUBLIC ROUTE */}
        <Route path="/login" element={<Login />} />

        {/* ROOT REDIRECT */}
        <Route path="/" element={<RootRedirect />} />

        {/* LOCAL ADMIN ROUTES */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={['LIBRARY_ADMIN', 'LOCAL_ADMIN']}>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="students" element={<AdminStudents />} />
          <Route path="enrollment" element={<AdminEnrollment />} />
          <Route path="active-logs" element={<AdminActiveLogs />} />
          <Route path="pending-payments" element={<AdminPendingPayments />} />
          <Route path="payment-approvals" element={<AdminPaymentApprovals />} />
          <Route path="earnings" element={<AdminRevenueAnalytics />} />
          <Route path="payment-master" element={<AdminPaymentMaster />} />
          <Route path="update-fees" element={<Navigate to="/admin/payment-master" replace />} />
          <Route path="pay-saas" element={<AdminPaySaaS />} />
          <Route path="seat-master" element={<AdminSeatMaster />} />
          <Route path="seats-grid" element={<Navigate to="/admin/seat-master" replace />} />
          <Route path="locker-master" element={<AdminLockerMaster />} />
          <Route path="lockers-grid" element={<Navigate to="/admin/locker-master" replace />} />
          <Route path="qr-display" element={<AdminQRDisplay />} />
          <Route path="attendance-approvals" element={<AdminAttendanceApprovals />} />
          <Route path="send-notification" element={<AdminSendNotification />} />
          <Route path="complaints" element={<Navigate to="/admin/dashboard" replace />} />
        </Route>

        {/* SUPER ADMIN ROUTES */}
        <Route
          path="/super-admin"
          element={
            <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
              <SuperAdminLayout />
            </ProtectedRoute>
          }
        >
          <Route path="libraries" element={<SuperAdminLibraries />} />
          <Route path="onboard-library" element={<SuperAdminOnboardLibrary />} />
          <Route path="saas-payments" element={<SuperAdminSaasPayments />} />
          <Route path="analytics" element={<SuperAdminAnalytics />} />
          <Route path="feature-flags" element={<SuperAdminFeatureFlags />} />
          <Route path="notifications" element={<SuperAdminNotifications />} />
        </Route>

        {/* STUDENT ROUTES */}
        <Route
          path="/student"
          element={
            <ProtectedRoute allowedRoles={['STUDENT']}>
              <StudentLayout />
            </ProtectedRoute>
          }
        >
          <Route path="dashboard" element={<StudentDashboard />} />
          <Route path="qr-scanner" element={<StudentQRScanner />} />
          <Route path="study-report" element={<StudentStudyReport />} />
          <Route path="seats" element={<StudentSeats />} />
          <Route path="lockers" element={<StudentLockers />} />
          <Route path="payments" element={<StudentPayments />} />
          <Route path="referral" element={<StudentReferral />} />
          <Route path="complaints" element={<Navigate to="/student/dashboard" replace />} />
        </Route>

        {/* CATCH ALL */}
        <Route path="*" element={<RootRedirect />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
