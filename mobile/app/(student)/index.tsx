import * as React from 'react';
import { useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter, useFocusEffect } from 'expo-router';
import { apiRequest } from '../../src/services/api.client';
import { useAuthStore } from '../../src/store/authStore';

import { HamburgerMenu } from '../../src/components/HamburgerMenu';
import { STUDENT_MENU } from '../../src/constants/menuItems';

function formatNotifExpiry(dateStr?: string | Date): string {
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'N/A';
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const dayStr = String(d.getDate()).padStart(2, '0');
  const monthStr = monthNames[d.getMonth()];
  const year = d.getFullYear();
  const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return `${dayStr}-${monthStr}-${year} ${timeStr}`;
}

export default function StudentDashboard() {
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['student-dashboard'],
    queryFn: async () => {
      const res = await apiRequest('/students/dashboard');
      if (!res.success) throw new Error(res.error?.message || 'Failed to fetch dashboard');
      return res.data;
    },
  });

  // Automatically refetch dashboard data whenever the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  // Performance-optimized event-driven timer: schedules a single refetch at 12:00:05 AM midnight
  React.useEffect(() => {
    const now = new Date();
    const nextMidnight = new Date(now);
    nextMidnight.setHours(24, 0, 5, 0); // 12:00:05 AM next day

    const msUntilMidnight = Math.max(1000, nextMidnight.getTime() - now.getTime());

    const timer = setTimeout(() => {
      refetch();
    }, msUntilMidnight);

    return () => clearTimeout(timer);
  }, [refetch]);

  const library = data?.library;
  const student = data?.student;
  const stats = data?.stats;

  const currentAttendanceState = stats?.currentAttendanceState;
  const pendingRequest = stats?.pendingRequest || currentAttendanceState?.pendingRequest;
  const rejectedRequest = stats?.rejectedRequest || currentAttendanceState?.rejectedRequest;
  const activeSession = stats?.activeSession || currentAttendanceState?.activeSession;
  const lastSession = stats?.lastSession;

  const attendanceState = currentAttendanceState?.state || (activeSession ? 'APPROVED' : pendingRequest ? 'PENDING' : 'NO_ACTIVE_REQUEST');

  const todayHours = Math.floor((stats?.todayMinutes || 0) / 60);
  const todayMins = (stats?.todayMinutes || 0) % 60;

  const monthlyHours = Math.floor((stats?.monthlyTotalMinutes || 0) / 60);
  const monthlyMins = (stats?.monthlyTotalMinutes || 0) % 60;

  const activeNotifications: any[] = (data?.activeNotifications || []).filter((notif: any) => {
    if (notif.status && notif.status !== 'ACTIVE') return false;
    if (notif.expiresAt && new Date(notif.expiresAt) <= new Date()) return false;
    return true;
  });

  return (
    <View style={styles.container}>
      <HamburgerMenu title={library?.name || 'Student Portal'} role="STUDENT" items={STUDENT_MENU} />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#6366F1" />}
      >
        {/* Banner / Library Status */}
        <View style={styles.bannerCard}>
          <View style={styles.bannerHeader}>
            <Text style={styles.libraryName}>{library?.name || 'Study Centre'}</Text>
            <View style={[styles.statusBadge, library?.status === 'OPEN' ? styles.bgOpen : styles.bgClosed]}>
              <Text style={styles.statusText}>{library?.status || 'OPEN'}</Text>
            </View>
          </View>
        </View>

        {/* Active Light-Theme Notification Banners */}
        {activeNotifications.length > 0 && (
          <View style={styles.notifBannerSection}>
            {activeNotifications.map((notif: any) => (
              <View key={notif._id} style={styles.lightNotifBanner}>
                <View style={styles.notifBannerHeader}>
                  <Text style={styles.notifIcon}>📢</Text>
                  <Text style={styles.notifTitle} numberOfLines={2}>
                    {notif.title}
                  </Text>
                </View>
                {notif.body ? <Text style={styles.notifBody}>{notif.body}</Text> : null}
              </View>
            ))}
          </View>
        )}

        {/* Active Session Status */}
        <View
          style={[
            styles.sessionCard,
            attendanceState === 'APPROVED'
              ? styles.borderActive
              : attendanceState === 'PENDING'
              ? styles.borderPending
              : attendanceState === 'REJECTED'
              ? styles.borderRejected
              : styles.borderInactive,
          ]}
        >
          <Text style={styles.cardLabel}>CURRENT ATTENDANCE STATE</Text>
          {attendanceState === 'PENDING' ? (
            <View style={styles.activeRow}>
              <Text style={styles.pendingText}>⏳ PENDING APPROVAL</Text>
              <Text style={styles.activeDetail}>
                Scan timestamp: {pendingRequest?.scanTimestamp ? new Date(pendingRequest.scanTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}. Awaiting Local Admin approval.
              </Text>
            </View>
          ) : attendanceState === 'APPROVED' ? (
            <View style={styles.activeRow}>
              <Text style={styles.activePulse}>🟢 CHECKED IN</Text>
              <Text style={styles.activeDetail}>
                Since {activeSession?.checkInAt ? new Date(activeSession.checkInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
              </Text>
            </View>
          ) : attendanceState === 'REJECTED' ? (
            <View style={styles.activeRow}>
              <Text style={styles.rejectedText}>❌ CHECK-IN REJECTED</Text>
              <Text style={styles.rejectedDetail}>
                Reason: "{rejectedRequest?.rejectionReason || currentAttendanceState?.rejectionReason || 'Rejected by Admin'}". You can scan QR code again.
              </Text>
            </View>
          ) : (
            <View style={styles.activeRow}>
              <Text style={styles.inactiveText}>🔴 CHECKED OUT</Text>
              <Text style={styles.activeDetail}>
                {lastSession?.isAutoCheckedOut
                  ? '⚡ Automatically checked out at 12:00 AM midnight. Scan QR code to check in again.'
                  : 'Scan QR code at entry desk to check in'}
              </Text>
            </View>
          )}

          <View style={styles.actionBtnRow}>
            <TouchableOpacity style={styles.refreshBtn} onPress={() => refetch()}>
              <Text style={styles.refreshBtnText}>🔄 REFRESH STATUS</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.scanBtn, attendanceState === 'PENDING' && styles.scanBtnDisabled]}
              disabled={attendanceState === 'PENDING'}
              onPress={() => router.push('/(student)/qr-scanner')}
            >
              <Text style={styles.scanBtnText}>
                {attendanceState === 'PENDING'
                  ? '⏳ SCAN DISABLED'
                  : attendanceState === 'APPROVED'
                  ? '📷 SCAN FOR CHECK-OUT'
                  : attendanceState === 'REJECTED'
                  ? '📷 SCAN QR AGAIN'
                  : '📷 SCAN ATTENDANCE QR'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Study Stats Grid */}
        <Text style={styles.sectionTitle}>Study Hours Tracking</Text>
        <View style={styles.gridRow}>
          <View style={styles.gridCard}>
            <Text style={styles.gridLabel}>Today's Time</Text>
            <Text style={styles.gridValue}>{todayHours}h {todayMins}m</Text>
          </View>
          <View style={styles.gridCard}>
            <Text style={styles.gridLabel}>This Month</Text>
            <Text style={styles.gridValue}>{monthlyHours}h {monthlyMins}m</Text>
          </View>
        </View>

        {/* Reserved Seat / Locker Details */}
        {(library?.featureFlags?.enableReservedSeats !== false || library?.featureFlags?.enableLockers !== false) && (
          <>
            <Text style={styles.sectionTitle}>Reserved Amenities</Text>
            <View style={styles.infoCard}>
              {library?.featureFlags?.enableReservedSeats !== false && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Your Seat:</Text>
                  <Text style={styles.infoValue}>
                    {student?.currentSeat ? `${student.currentSeat.seatNumber} (Floor ${student.currentSeat.floor})` : 'None Assigned'}
                  </Text>
                </View>
              )}
              {library?.featureFlags?.enableLockers !== false && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Your Locker:</Text>
                  <Text style={styles.infoValue}>
                    {student?.currentLocker ? student.currentLocker.lockerNumber : 'None Assigned'}
                  </Text>
                </View>
              )}
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Membership Expire:</Text>
                <Text style={styles.infoValue}>
                  {student?.membershipExpiresAt ? new Date(student.membershipExpiresAt).toLocaleDateString() : 'N/A'}
                </Text>
              </View>
            </View>
          </>
        )}

        {/* Sign Out Action */}
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={async () => {
            await logout();
            router.replace('/(auth)/login');
          }}
        >
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    padding: 16,
  },
  bannerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  bannerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  libraryName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  bgOpen: {
    backgroundColor: '#DCFCE7',
  },
  bgClosed: {
    backgroundColor: '#FEE2E2',
  },
  statusText: {
    color: '#15803D',
    fontWeight: '700',
    fontSize: 12,
  },
  timeText: {
    color: '#64748B',
    marginTop: 6,
    fontSize: 14,
  },
  noticeBox: {
    marginTop: 12,
    padding: 10,
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  noticeText: {
    color: '#B45309',
    fontSize: 13,
    fontWeight: '600',
  },
  sessionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 2,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  borderActive: {
    borderColor: '#16A34A',
  },
  borderPending: {
    borderColor: '#D97706',
  },
  borderRejected: {
    borderColor: '#DC2626',
  },
  borderInactive: {
    borderColor: '#CBD5E1',
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 1,
  },
  activeRow: {
    marginTop: 8,
  },
  activePulse: {
    fontSize: 18,
    fontWeight: '800',
    color: '#16A34A',
  },
  pendingText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#D97706',
  },
  rejectedText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#DC2626',
  },
  rejectedDetail: {
    color: '#991B1B',
    marginTop: 4,
    fontSize: 13,
  },
  inactiveText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#DC2626',
  },
  activeDetail: {
    color: '#64748B',
    marginTop: 4,
    fontSize: 13,
  },
  actionBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  refreshBtn: {
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  refreshBtnText: {
    color: '#334155',
    fontWeight: '700',
    fontSize: 12,
  },
  scanBtn: {
    flex: 1,
    backgroundColor: '#2563EB',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanBtnDisabled: {
    backgroundColor: '#94A3B8',
    opacity: 0.6,
  },
  scanBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 12,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  gridCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  gridLabel: {
    color: '#64748B',
    fontSize: 13,
  },
  gridValue: {
    color: '#2563EB',
    fontSize: 22,
    fontWeight: '800',
    marginTop: 6,
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  infoLabel: {
    color: '#64748B',
    fontSize: 14,
  },
  infoValue: {
    color: '#0F172A',
    fontWeight: '700',
    fontSize: 14,
  },
  logoutBtn: {
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    marginBottom: 24,
  },
  logoutText: {
    color: '#DC2626',
    fontWeight: '700',
    fontSize: 15,
  },
  /* LIGHT THEME NOTIFICATION BANNER STYLES */
  notifBannerSection: {
    marginBottom: 16,
    gap: 10,
  },
  lightNotifBanner: {
    backgroundColor: '#EFF6FF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  notifBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  notifIcon: {
    fontSize: 18,
  },
  notifTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    color: '#1E3A8A',
  },
  notifBody: {
    fontSize: 13,
    color: '#334155',
    marginTop: 2,
    marginBottom: 8,
    lineHeight: 18,
  },
  notifFooter: {
    alignSelf: 'flex-start',
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 4,
  },
  notifExpiry: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E40AF',
  },
});
