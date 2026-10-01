import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { apiRequest } from '../../src/services/api.client';
import { HamburgerMenu } from '../../src/components/HamburgerMenu';
import { LOCAL_ADMIN_MENU } from '../../src/constants/menuItems';

export default function PendingPaymentsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [sendingId, setSendingId] = useState<string | null>(null);

  const { data: dueStudents = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin-due-payments'],
    queryFn: async () => {
      const res = await apiRequest('/payments/due-payments');
      if (!res.success) throw new Error(res.error?.message || 'Failed to fetch due student payments');
      return res.data || [];
    },
    retry: 1,
  });

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

  // Strict Rule: Student appears in Pending Payment ONLY if Due Date < Today's Date (strictly past due)
  const dueList = (Array.isArray(dueStudents) ? dueStudents : []).filter((s: any) => {
    if (!s.dueDate) return false;
    const dueTime = new Date(s.dueDate).getTime();
    return dueTime < startOfToday.getTime();
  });

  const handleSendReminder = async (student: any) => {
    try {
      setSendingId(student._id);
      const res = await apiRequest(`/payments/send-reminder/${student._id}`, 'POST');
      if (res.success) {
        Alert.alert(
          'Notification Sent! 🔔',
          `Payment reminder notification has been sent to ${student.studentName} (${student.studentPhone}).`
        );
        queryClient.invalidateQueries({ queryKey: ['admin-due-payments'] });
      } else {
        Alert.alert('Notification Error', res.error?.message || 'Failed to send notification');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to send reminder notification');
    } finally {
      setSendingId(null);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.container}>
        <HamburgerMenu title="Pending Payments" role="LIBRARY_ADMIN" items={LOCAL_ADMIN_MENU} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>⚠️ Unable to Load Due Payments</Text>
          <Text style={styles.errorText}>{(error as Error)?.message || 'Request failed or timed out.'}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()}>
            <Text style={styles.retryText}>🔄 Retry Loading</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <HamburgerMenu title="Pending Payments" role="LIBRARY_ADMIN" items={LOCAL_ADMIN_MENU} />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>Pending Student Payments</Text>
            <Text style={styles.subTitle}>Students whose plan due date has passed without approved payment</Text>
          </View>
        </View>

        {/* Switch to Payment Approval Screen Banner */}
        <TouchableOpacity
          style={styles.switchBanner}
          onPress={() => router.push('/(admin)/payment-approvals')}
          activeOpacity={0.8}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.switchBannerTitle}>💳 Review Payment Submissions</Text>
            <Text style={styles.switchBannerSub}>Approve or reject student manual QR payment proofs</Text>
          </View>
          <Text style={styles.switchBannerArrow}>➔</Text>
        </TouchableOpacity>

        {dueList.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>🎉</Text>
            <Text style={styles.emptyTitle}>No Overdue Payments</Text>
            <Text style={styles.emptySub}>No students currently have a Due Date earlier than today.</Text>
          </View>
        ) : (
          dueList.map((student: any) => {
            const dueDateFormatted = student.dueDate
              ? new Date(student.dueDate).toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })
              : 'Immediate';

            return (
              <View key={student._id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.studentName}>{student.studentName}</Text>
                    <Text style={styles.studentMeta}>Card: {student.studentIdCardNo} • 📞 {student.studentPhone}</Text>
                  </View>
                  <View style={[styles.statusBadge, styles.badgeOverdue]}>
                    <Text style={[styles.statusText, styles.textOverdue]}>
                      OVERDUE
                    </Text>
                  </View>
                </View>

                <View style={styles.divider} />

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Plan Type:</Text>
                  <Text style={styles.detailValue}>{student.planType}</Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Due Date:</Text>
                  <Text style={[styles.detailValue, { color: '#DC2626' }]}>{dueDateFormatted}</Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Amount Due:</Text>
                  <Text style={styles.amountText}>₹{student.amount}</Text>
                </View>

                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={[styles.notifyBtn, sendingId === student._id && styles.btnDisabled]}
                    disabled={sendingId === student._id}
                    onPress={() => handleSendReminder(student)}
                    activeOpacity={0.8}
                  >
                    {sendingId === student._id ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <Text style={styles.notifyBtnText}>🔔 Send Notification Reminder</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
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
    paddingBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
  },
  subTitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
    marginBottom: 14,
  },
  switchBanner: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switchBannerTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1D4ED8',
  },
  switchBannerSub: {
    fontSize: 12,
    color: '#3B82F6',
    marginTop: 2,
  },
  switchBannerArrow: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1D4ED8',
    marginLeft: 8,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
  },
  tabBtnActive: {
    backgroundColor: '#1E293B',
    borderColor: '#1E293B',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  tabTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  emptySub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  studentName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  studentMeta: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeOverdue: {
    backgroundColor: '#FEE2E2',
  },
  badgeDueSoon: {
    backgroundColor: '#FEF3C7',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
  },
  textOverdue: {
    color: '#991B1B',
  },
  textDueSoon: {
    color: '#92400E',
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  detailLabel: {
    fontSize: 13,
    color: '#64748B',
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  amountText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#16A34A',
  },
  actionRow: {
    marginTop: 12,
  },
  notifyBtn: {
    backgroundColor: '#2563EB',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifyBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  errorContainer: {
    padding: 24,
    alignItems: 'center',
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#DC2626',
    marginBottom: 6,
  },
  errorText: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryBtn: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
});
