export const LOCAL_ADMIN_MENU = [
  { label: 'Dashboard', route: '/(admin)/dashboard', icon: '📊', category: 'Overview' },
  { label: 'Search Students', route: '/(admin)/students', icon: '👥', category: 'Student Management' },
  { label: 'Enroll Student', route: '/(admin)/enrollment', icon: '📝', category: 'Student Management' },
  { label: 'Entry/Exit Logs', route: '/(admin)/active-logs', icon: '📋', category: 'Student Management' },
  { label: 'Pending Payments', route: '/(admin)/pending-payments', icon: '⏳', category: 'Financial Management' },
  { label: 'Payment Approval', route: '/(admin)/payment-approvals', icon: '✅', category: 'Financial Management' },
  { label: 'Revenue Analytics', route: '/(admin)/earnings', icon: '💰', category: 'Financial Management' },
  { label: 'Update Fees', route: '/(admin)/payment-master', icon: '⚙️', category: 'Financial Management' },
  { label: 'App Service Payment', route: '/(admin)/pay-saas', icon: '💳', category: 'Financial Management' },
  // { label: 'Seat Occupancy Grid', route: '/(admin)/seats-grid', icon: '🪑', category: 'Amenities & Layout' },
  { label: 'Seat Master', route: '/(admin)/seat-master', icon: '🛠️', category: 'Amenities & Layout' },
  // { label: 'Locker Occupancy Grid', route: '/(admin)/lockers-grid', icon: '🔒', category: 'Amenities & Layout' },
  { label: 'Locker Master', route: '/(admin)/locker-master', icon: '🔑', category: 'Amenities & Layout' },
  { label: 'Attendance QR Code', route: '/(admin)/qr-display', icon: '📺', category: 'Operations & Alerts' },
  { label: 'Attendance Approvals', route: '/(admin)/attendance-approvals', icon: '✋', category: 'Operations & Alerts' },
  { label: 'Notification', route: '/(admin)/send-notification', icon: '🔔', category: 'Operations & Alerts' },
];

export const SUPER_ADMIN_MENU = [
  { label: 'Search Libraries', route: '/(super-admin)/libraries', icon: '🏛️', category: 'Library Operations' },
  { label: 'Onboard New Library', route: '/(super-admin)/onboard-library', icon: '➕', category: 'Library Operations' },
  { label: 'Library Payments', route: '/(super-admin)/saas-payments', icon: '💳', category: 'Library Operations' },
  { label: 'Platform Revenue', route: '/(super-admin)/analytics', icon: '📈', category: 'SaaS Platform Analytics' },
  { label: 'Feature Control', route: '/(super-admin)/feature-flags', icon: '⚡', category: 'SaaS Platform Analytics' },
];

export const STUDENT_MENU = [
  { label: 'Home', route: '/(student)', icon: '🏠', category: 'Dashboard' },
  { label: 'Check-In / Out QR', route: '/(student)/qr-scanner', icon: '📷', category: 'Attendance' },
  { label: 'Study Hours Report', route: '/(student)/study-report', icon: '📊', category: 'Attendance' },
  { label: 'Seat Reservation', route: '/(student)/seats', icon: '🪑', category: 'Amenities' },
  { label: 'Locker Reservation', route: '/(student)/lockers', icon: '🔒', category: 'Amenities' },
  { label: 'Plans & Payments', route: '/(student)/payments', icon: '💳', category: 'Finances' },
  { label: 'Refer & Earn', route: '/(student)/referral', icon: '🎁', category: 'Rewards' },
];
