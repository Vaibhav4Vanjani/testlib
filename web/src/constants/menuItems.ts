export interface IMenuItem {
  label: string;
  route: string;
  icon: string;
  category: string;
}

export const LOCAL_ADMIN_MENU: IMenuItem[] = [
  { label: 'Dashboard', route: '/admin/dashboard', icon: 'LayoutDashboard', category: 'Overview' },
  { label: 'Search Students', route: '/admin/students', icon: 'Users', category: 'Student Management' },
  { label: 'Enroll Student', route: '/admin/enrollment', icon: 'UserPlus', category: 'Student Management' },
  { label: 'Entry/Exit Logs', route: '/admin/active-logs', icon: 'ClipboardList', category: 'Student Management' },
  { label: 'Pending Payments', route: '/admin/pending-payments', icon: 'Clock', category: 'Financial Management' },
  { label: 'Payment Approval', route: '/admin/payment-approvals', icon: 'CheckCircle2', category: 'Financial Management' },
  { label: 'Revenue Analytics', route: '/admin/earnings', icon: 'TrendingUp', category: 'Financial Management' },
  { label: 'Update Fees', route: '/admin/payment-master', icon: 'Settings', category: 'Financial Management' },
  { label: 'App Service Payment', route: '/admin/pay-saas', icon: 'CreditCard', category: 'Financial Management' },
  { label: 'Seat Master', route: '/admin/seat-master', icon: 'Armchair', category: 'Amenities & Layout' },
  { label: 'Locker Master', route: '/admin/locker-master', icon: 'Lock', category: 'Amenities & Layout' },
  { label: 'Attendance QR Code', route: '/admin/qr-display', icon: 'QrCode', category: 'Operations & Alerts' },
  { label: 'Attendance Approvals', route: '/admin/attendance-approvals', icon: 'CheckSquare', category: 'Operations & Alerts' },
  { label: 'Notification', route: '/admin/send-notification', icon: 'Bell', category: 'Operations & Alerts' },
];

export const SUPER_ADMIN_MENU: IMenuItem[] = [
  { label: 'Search Libraries', route: '/super-admin/libraries', icon: 'Building2', category: 'Library Operations' },
  { label: 'Onboard New Library', route: '/super-admin/onboard-library', icon: 'PlusCircle', category: 'Library Operations' },
  { label: 'Library Payments', route: '/super-admin/saas-payments', icon: 'CreditCard', category: 'Library Operations' },
  { label: 'Platform Revenue', route: '/super-admin/analytics', icon: 'LineChart', category: 'SaaS Platform Analytics' },
  { label: 'Feature Control', route: '/super-admin/feature-flags', icon: 'Sliders', category: 'SaaS Platform Analytics' },
  { label: 'Notifications', route: '/super-admin/notifications', icon: 'BellRing', category: 'SaaS Platform Analytics' },
];

export const STUDENT_MENU: IMenuItem[] = [
  { label: 'Home', route: '/student/dashboard', icon: 'Home', category: 'Dashboard' },
  { label: 'Check-In / Out QR', route: '/student/qr-scanner', icon: 'QrCode', category: 'Attendance' },
  { label: 'Study Hours Report', route: '/student/study-report', icon: 'BarChart3', category: 'Attendance' },
  { label: 'Seat Reservation', route: '/student/seats', icon: 'Armchair', category: 'Amenities' },
  { label: 'Locker Reservation', route: '/student/lockers', icon: 'Lock', category: 'Amenities' },
  { label: 'Plans & Payments', route: '/student/payments', icon: 'CreditCard', category: 'Finances' },
  { label: 'Refer & Earn', route: '/student/referral', icon: 'Gift', category: 'Rewards' },
];
