import * as React from 'react';
import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  TextInput,
  Modal,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { apiRequest } from '../../src/services/api.client';
import { getFullImageUrl } from '../../src/constants/config';
import { useAuthStore } from '../../src/store/authStore';
import { HamburgerMenu } from '../../src/components/HamburgerMenu';
import { LOCAL_ADMIN_MENU } from '../../src/constants/menuItems';

export default function AdminDashboard() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const queryClient = useQueryClient();

  // Selected Payment to Review in Modal
  const [selectedPayment, setSelectedPayment] = useState<any | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  // Local Admin Metrics Query
  const { data: metrics, refetch: refetchLocal, isRefetching: isRefetchingLocal } = useQuery({
    queryKey: ['admin-metrics'],
    queryFn: async () => {
      const res = await apiRequest('/admin/dashboard-metrics');
      if (!res.success) throw new Error(res.error?.message || 'Failed to fetch metrics');
      return res.data;
    },
  });

  // Local Admin Pending Payments Query (Submitted QR proofs awaiting approval)
  const { data: pendingPayments } = useQuery({
    queryKey: ['admin-pending-payments'],
    queryFn: async () => {
      const res = await apiRequest('/payments/pending');
      return res.data || [];
    },
  });

  // Local Admin Due Payments Query (Unpaid / Overdue students)
  const { data: duePayments } = useQuery({
    queryKey: ['admin-due-payments'],
    queryFn: async () => {
      const res = await apiRequest('/payments/due-payments');
      return res.data || [];
    },
  });

  // Local Admin Payment Master Query
  const { data: currentPlan, refetch: refetchPaymentMaster } = useQuery({
    queryKey: ['payment-master'],
    queryFn: async () => {
      const res = await apiRequest('/admin/payment-master');
      return res.data || null;
    },
    staleTime: 0,
  });

  // Local Admin Revenue Analytics Query
  const { data: earningsData, refetch: refetchEarnings } = useQuery({
    queryKey: ['admin-earnings-overview'],
    queryFn: async () => {
      const res = await apiRequest('/admin/earnings');
      return res.data || null;
    },
  });

  // Modal States
  const [priceModalVisible, setPriceModalVisible] = useState(false);

  // Local Admin Payment Master Form
  const [monthlyFee, setMonthlyFee] = useState('1500');
  const [yearlyFee, setYearlyFee] = useState('15000');
  const [seatPrice, setSeatPrice] = useState('500');
  const [lockerPrice, setLockerPrice] = useState('200');

  const updatePriceMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('/admin/payment-master', 'PUT', {
        monthlyFee: parseFloat(monthlyFee),
        annualFee: parseFloat(yearlyFee),
        lockerMonthlyFee: parseFloat(lockerPrice),
      });
      if (!res.success) throw new Error(res.error?.message || 'Update failed');
      return res.data;
    },
    onSuccess: () => {
      Alert.alert('Payment Master Updated', 'Your library pricing plan has been updated successfully!');
      setPriceModalVisible(false);
      queryClient.invalidateQueries({ queryKey: ['payment-master'] });
    },
    onError: (err: any) => {
      Alert.alert('Update Failed', err.message);
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (paymentId: string) => {
      const res = await apiRequest(`/payments/${paymentId}/approve`, 'POST', {
        adminNotes: 'Verified via Local Admin Dashboard',
      });
      if (!res.success) throw new Error(res.error?.message || 'Approval failed');
      return res.data;
    },
    onSuccess: () => {
      Alert.alert('Approved! ✅', 'Payment approved and membership / seat / locker allocated.');
      setSelectedPayment(null);
      queryClient.invalidateQueries({ queryKey: ['admin-pending-payments'] });
      queryClient.invalidateQueries({ queryKey: ['admin-metrics'] });
    },
    onError: (err: any) => {
      Alert.alert('Approval Error', err.message);
    },
  });

  const handleRejectPayment = async (pay: any) => {
    const studentRejectionCount = pay.studentId?.rejectionCount || 0;
    const isStrike3 = studentRejectionCount >= 2;

    const message = isStrike3
      ? '⚠️ Warning: Rejecting this payment will be the 3rd strike. Student account will be automatically set to INACTIVE and all reservations released. Proceed?'
      : 'Are you sure you want to reject this payment request?';

    Alert.alert('Reject Payment', message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm Reject',
        style: 'destructive',
        onPress: async () => {
          try {
            const res = await apiRequest(`/payments/${pay._id}/reject`, 'POST', {
              adminNotes: 'Payment proof or UTR unverified',
            });
            if (res.success) {
              const newCount = res.data?.rejectionCount || studentRejectionCount + 1;
              if (res.data?.isStudentInactive || newCount >= 3) {
                Alert.alert('Payment Rejected ⚠️', 'Payment rejected. Student reached 3 rejections and has been set to INACTIVE.');
              } else {
                Alert.alert('Rejected', `Payment request rejected. Student has ${newCount} rejection(s).`);
              }
              setSelectedPayment(null);
              queryClient.invalidateQueries({ queryKey: ['admin-pending-payments'] });
              queryClient.invalidateQueries({ queryKey: ['admin-metrics'] });
            } else {
              Alert.alert('Rejection Error', res.error?.message || 'Failed to reject payment');
            }
          } catch (err: any) {
            Alert.alert('Error', err.message);
          }
        },
      },
    ]);
  };

  const totalRev = earningsData?.totalRevenue || (metrics?.monthlyEarnings || 0);
  const mRev = earningsData?.membershipRevenue || 0;
  const sRev = earningsData?.seatRevenue || 0;
  const lRev = earningsData?.lockerRevenue || 0;
  const mPct = totalRev > 0 ? Math.round((mRev / totalRev) * 100) : 0;
  const sPct = totalRev > 0 ? Math.round((sRev / totalRev) * 100) : 0;
  const lPct = totalRev > 0 ? Math.max(0, 100 - mPct - sPct) : 0;

  const seatTotal = metrics?.seatOccupancy?.total || 0;
  const seatOccupied = metrics?.seatOccupancy?.occupied || 0;
  const seatAvail = metrics?.seatOccupancy?.available || 0;
  const seatRate = metrics?.seatOccupancy?.occupancyRate || 0;

  const lockerTotal = metrics?.lockerOccupancy?.total || 0;
  const lockerOccupied = metrics?.lockerOccupancy?.occupied || 0;
  const lockerAvail = metrics?.lockerOccupancy?.available || 0;
  const lockerRate = metrics?.lockerOccupancy?.occupancyRate || 0;

  return (
    <View style={styles.container}>
      <HamburgerMenu title="Admin Portal" role="LIBRARY_ADMIN" items={LOCAL_ADMIN_MENU} />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isRefetchingLocal}
            onRefresh={() => {
              refetchLocal();
              refetchPaymentMaster();
              refetchEarnings();
            }}
            tintColor="#38BDF8"
          />
        }
      >
        {/* Library Banner */}
        <View style={styles.localBanner}>
          <Text style={styles.localLibraryName}>{metrics?.libraryName ? `📍 ${metrics.libraryName}` : 'Managing Your Reading Room'}</Text>
          <Text style={{ fontSize: 11, color: '#047857', marginTop: 2 }}>🟢 Live Centre Operational Status</Text>
        </View>

        {/* Super Admin Announcement Banner */}
        {metrics?.announcements && metrics.announcements.length > 0 && (
          <View style={{ backgroundColor: '#EFF6FF', borderWidth: 1.5, borderColor: '#BFDBFE', borderRadius: 12, padding: 14, marginBottom: 16 }}>
            <Text style={{ fontSize: 10, fontWeight: '900', color: '#1E40AF', letterSpacing: 0.5, marginBottom: 4 }}>
              ANNOUNCEMENT
            </Text>
            <Text style={{ fontSize: 15, fontWeight: '800', color: '#0F172A' }}>
              {metrics.announcements[0].title}
            </Text>
            {metrics.announcements[0].body ? (
              <Text style={{ fontSize: 12, color: '#334155', marginTop: 4, lineHeight: 16 }}>
                {metrics.announcements[0].body}
              </Text>
            ) : null}
          </View>
        )}

        {/* Financial Overview KPIs */}
        <View style={styles.headerBetween}>
          <Text style={styles.sectionTitle}>Financial Revenue</Text>
          <TouchableOpacity onPress={() => router.push('/(admin)/earnings')}>
            <Text style={{ color: '#2563EB', fontWeight: '800', fontSize: 12 }}>View Analytics ➔</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.gridRow}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Today's Revenue</Text>
            <Text style={[styles.metricValue, { color: '#0284C7' }]}>₹{metrics?.todayEarnings || 0}</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Monthly Collected</Text>
            <Text style={[styles.metricValue, { color: '#16A34A' }]}>₹{metrics?.monthlyEarnings || 0}</Text>
          </View>
        </View>

        {/* Category Revenue Breakdown Bar */}
        {totalRev > 0 && (
          <View style={[styles.priceCard, { marginTop: -6 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748B' }}>Category Earnings Breakdown</Text>
              <Text style={{ fontSize: 11, fontWeight: '800', color: '#0F172A' }}>Total: ₹{totalRev}</Text>
            </View>
            <View style={{ height: 8, borderRadius: 4, backgroundColor: '#F1F5F9', flexDirection: 'row', overflow: 'hidden' }}>
              <View style={{ width: `${mPct}%`, backgroundColor: '#4F46E5' }} />
              <View style={{ width: `${sPct}%`, backgroundColor: '#059669' }} />
              <View style={{ width: `${lPct}%`, backgroundColor: '#D97706' }} />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
              <Text style={{ fontSize: 10, color: '#4F46E5', fontWeight: '700' }}>Membership: ₹{mRev}</Text>
              <Text style={{ fontSize: 10, color: '#059669', fontWeight: '700' }}>Seat: ₹{sRev}</Text>
              <Text style={{ fontSize: 10, color: '#D97706', fontWeight: '700' }}>Locker: ₹{lRev}</Text>
            </View>
          </View>
        )}

        {/* Live Centre Occupancy */}
        <Text style={styles.sectionTitle}>Live Capacity & Occupancy</Text>
        <View style={styles.gridRow}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Active Students</Text>
            <Text style={[styles.metricValue, { color: '#4F46E5' }]}>
              {metrics?.activeStudents || 0} / {metrics?.totalStudents || 0}
            </Text>
            <Text style={{ fontSize: 10, color: '#64748B', marginTop: 4 }}>Registered: {metrics?.totalStudents || 0}</Text>
          </View>
          {metrics?.featureFlags?.enableReservedSeats !== false && (
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Seats ({seatRate}%)</Text>
              <Text style={[styles.metricValue, { color: '#059669' }]}>
                {seatAvail} avail
              </Text>
              <Text style={{ fontSize: 10, color: '#64748B', marginTop: 4 }}>Used: {seatOccupied} / {seatTotal}</Text>
            </View>
          )}
          {metrics?.featureFlags?.enableLockers !== false && (
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Lockers ({lockerRate}%)</Text>
              <Text style={[styles.metricValue, { color: '#D97706' }]}>
                {lockerAvail} avail
              </Text>
              <Text style={{ fontSize: 10, color: '#64748B', marginTop: 4 }}>Used: {lockerOccupied} / {lockerTotal}</Text>
            </View>
          )}
        </View>

        {/* Payment Master Pricing Section */}
        <View style={styles.headerBetween}>
          <Text style={styles.sectionTitle}>Payment Master Pricing</Text>
          <TouchableOpacity style={styles.editPriceBtn} onPress={() => router.push('/(admin)/payment-master')}>
            <Text style={styles.editPriceText}>Update Prices</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.priceCard}>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Full-Day Monthly Fee (≥12 hrs):</Text>
            <Text style={styles.priceVal}>₹{currentPlan?.monthlyFee || 1200}</Text>
          </View>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Part-Time Rate per Daily Hr (&lt;12 hrs):</Text>
            <Text style={styles.priceVal}>₹{currentPlan?.hourlyMonthlyRate || 100}/hr-mo</Text>
          </View>
          {currentPlan?.featureFlags?.enableReservedSeats !== false && currentPlan?.seatMonthlyFee !== undefined && (
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Monthly Seat Fee (Full / Part):</Text>
              <Text style={styles.priceVal}>₹{currentPlan?.seatMonthlyFee || 500} / ₹{currentPlan?.seatHourlyMonthlyRate || 50}</Text>
            </View>
          )}
          {currentPlan?.featureFlags?.enableLockers !== false && currentPlan?.lockerMonthlyFee !== undefined && (
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Monthly Locker Fee (Full / Part):</Text>
              <Text style={styles.priceVal}>₹{currentPlan?.lockerMonthlyFee || 200} / ₹{currentPlan?.lockerHourlyMonthlyRate || 20}</Text>
            </View>
          )}
          {currentPlan?.featureFlags?.enableReferrals !== false && (
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Referral Reward per Student:</Text>
              <Text style={styles.priceVal}>₹{currentPlan?.referralRewardAmount || 100}</Text>
            </View>
          )}
        </View>

        {/* Payment Management Tiles: Pending Payments & Payment Approval */}
        <Text style={styles.sectionTitle}>Payment & Subscription Actions</Text>
        <View style={styles.gridRow}>
          {/* Pending Payments Tile (Due / Overdue Students) */}
          <TouchableOpacity
            style={[styles.metricCard, { borderLeftWidth: 4, borderLeftColor: '#F59E0B', marginBottom: 16 }]}
            onPress={() => router.push('/(admin)/pending-payments')}
            activeOpacity={0.8}
          >
            <Text style={styles.metricLabel}>⏳ Pending Payments</Text>
            <Text style={[styles.metricValue, { color: '#D97706' }]}>
              {duePayments?.length || 0}
            </Text>
            <Text style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>Due / Overdue Students ➔</Text>
          </TouchableOpacity>

          {/* Payment Approval Tile (Submitted Manual Payment Proofs) */}
          <TouchableOpacity
            style={[styles.metricCard, { borderLeftWidth: 4, borderLeftColor: '#10B981', marginBottom: 16 }]}
            onPress={() => router.push('/(admin)/payment-approvals')}
            activeOpacity={0.8}
          >
            <Text style={styles.metricLabel}>✅ Payment Approval</Text>
            <Text style={[styles.metricValue, { color: '#059669' }]}>
              {pendingPayments?.length || 0}
            </Text>
            <Text style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>Submissions to Review ➔</Text>
          </TouchableOpacity>
        </View>

        {/* Quick Action Tools */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
          <TouchableOpacity
            style={{ flex: 1, backgroundColor: '#4F46E5', borderRadius: 10, paddingVertical: 12, alignItems: 'center' }}
            onPress={() => router.push('/(admin)/enrollment')}
          >
            <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 13 }}>+ Enroll Student</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{ flex: 1, backgroundColor: '#0284C7', borderRadius: 10, paddingVertical: 12, alignItems: 'center' }}
            onPress={() => router.push('/(admin)/students')}
          >
            <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 13 }}>🔍 Search Students</Text>
          </TouchableOpacity>
        </View>

        {/* Sign Out */}
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={async () => {
            await logout();
            router.replace('/(auth)/login');
          }}
        >
          <Text style={styles.logoutText}>Log Out Local Admin</Text>
        </TouchableOpacity>

        {/* --- PAYMENT PROOF & DETAILS REVIEW MODAL --- */}
        <Modal
          visible={!!selectedPayment}
          animationType="slide"
          transparent
          onRequestClose={() => setSelectedPayment(null)}
        >
          {selectedPayment && (
            <View style={styles.reviewModalOverlay}>
              <SafeAreaView style={styles.reviewModalSafeArea}>
                <View style={styles.reviewModalCard}>
                  <View style={styles.reviewModalHeader}>
                    <Text style={styles.reviewModalTitle}>Review Payment Proof & Allocate</Text>
                    <TouchableOpacity onPress={() => setSelectedPayment(null)} style={styles.closeBtn}>
                      <Text style={styles.closeBtnText}>✕</Text>
                    </TouchableOpacity>
                  </View>

                  <ScrollView contentContainerStyle={styles.reviewModalBody}>
                    {/* Student Info Box */}
                    <View style={styles.infoBox}>
                      <Text style={styles.infoName}>
                        {selectedPayment.studentId?.userId?.fullName || 'Student'}
                      </Text>
                      <Text style={styles.infoMeta}>
                        Card No: {selectedPayment.studentId?.studentIdCardNo} • 📞 {selectedPayment.studentId?.userId?.phone || 'N/A'}
                      </Text>
                    </View>

                    {/* Rejection Warning if applicable */}
                    {(selectedPayment.studentId?.rejectionCount || 0) > 0 && (
                      <View style={styles.strikeWarnBox}>
                        <Text style={styles.strikeWarnText}>
                          ⚠️ Student has {selectedPayment.studentId?.rejectionCount} rejection strike(s). Next rejection will set account to INACTIVE.
                        </Text>
                      </View>
                    )}

                    {/* Requested Seat/Locker Info */}
                    {selectedPayment.targetSeatId ? (
                      <View style={styles.amenityBox}>
                        <Text style={styles.amenityLabel}>🪑 REQUESTED SEAT RESERVATION</Text>
                        <Text style={styles.amenityTitle}>
                          Seat {selectedPayment.targetSeatId.seatNumber} • Floor {selectedPayment.targetSeatId.floor || 1}
                        </Text>
                        <Text style={styles.amenitySub}>
                          Shift: {selectedPayment.shiftName || 'Full Day'} • Price: ₹{selectedPayment.targetSeatId.priceMonthly || selectedPayment.amount}/mo
                        </Text>
                      </View>
                    ) : null}

                    {selectedPayment.targetLockerId ? (
                      <View style={styles.amenityBox}>
                        <Text style={styles.amenityLabel}>🔒 REQUESTED LOCKER RESERVATION</Text>
                        <Text style={styles.amenityTitle}>
                          Locker {selectedPayment.targetLockerId.lockerNumber} • Floor {selectedPayment.targetLockerId.floor || 1}
                        </Text>
                        <Text style={styles.amenitySub}>
                          Shift: {selectedPayment.shiftName || 'Full Day'} • Price: ₹{selectedPayment.targetLockerId.priceMonthly || selectedPayment.amount}/mo
                        </Text>
                      </View>
                    ) : null}

                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Amount Paid:</Text>
                      <Text style={styles.amountValue}>₹{selectedPayment.amount} ({selectedPayment.paymentType})</Text>
                    </View>

                    {selectedPayment.utrNumber ? (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>UTR Ref Number:</Text>
                        <Text style={styles.utrValue}>{selectedPayment.utrNumber}</Text>
                      </View>
                    ) : null}

                    {/* UPLOADED PAYMENT SCREENSHOT */}
                    <Text style={styles.proofHeaderLabel}>📸 UPLOADED PAYMENT SCREENSHOT PROOF</Text>
                    {(() => {
                      const rawProof = selectedPayment.proofUrl || (selectedPayment.proofObjectKey ? `/uploads/${selectedPayment.proofObjectKey.replace(/^\/+/, '')}` : null);
                      const fullProofUrl = getFullImageUrl(rawProof);

                      return fullProofUrl ? (
                        <TouchableOpacity
                          style={styles.proofContainer}
                          onPress={() => setPreviewImageUrl(fullProofUrl)}
                          activeOpacity={0.8}
                        >
                          <Image source={{ uri: fullProofUrl }} style={styles.proofImg} resizeMode="contain" />
                          <View style={styles.zoomHint}>
                            <Text style={styles.zoomHintText}>🔍 Tap to View Full Screen Screenshot</Text>
                          </View>
                        </TouchableOpacity>
                      ) : (
                        <View style={styles.noProofBox}>
                          <Text style={styles.noProofText}>No payment proof image attached</Text>
                        </View>
                      );
                    })()}

                    {/* ACTION BUTTONS */}
                    <View style={styles.reviewModalActions}>
                      <TouchableOpacity
                        style={[styles.modalActionBtn, styles.btnRejectModal]}
                        onPress={() => handleRejectPayment(selectedPayment)}
                      >
                        <Text style={styles.btnTextModal}>REJECT REQUEST</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.modalActionBtn, styles.btnApproveModal, approveMutation.isPending && styles.btnDisabled]}
                        disabled={approveMutation.isPending}
                        onPress={() => approveMutation.mutate(selectedPayment._id)}
                      >
                        {approveMutation.isPending ? (
                          <ActivityIndicator color="#FFFFFF" />
                        ) : (
                          <Text style={styles.btnTextModal}>APPROVE & ALLOCATE</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </ScrollView>
                </View>
              </SafeAreaView>
            </View>
          )}
        </Modal>

        {/* Full Image Zoom Modal */}
        <Modal visible={!!previewImageUrl} animationType="fade" transparent onRequestClose={() => setPreviewImageUrl(null)}>
          {previewImageUrl && (
            <View style={styles.fullImageOverlay}>
              <SafeAreaView style={{ flex: 1 }}>
                <View style={styles.fullImageHeader}>
                  <Text style={styles.fullImageTitle}>Payment Proof Screenshot</Text>
                  <TouchableOpacity onPress={() => setPreviewImageUrl(null)} style={styles.fullImageCloseBtn}>
                    <Text style={{ color: '#FFFFFF', fontWeight: '800' }}>✕ Close</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.fullImageWrapper}>
                  <Image source={{ uri: previewImageUrl }} style={styles.fullImage} resizeMode="contain" />
                </View>
              </SafeAreaView>
            </View>
          )}
        </Modal>


      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 16 },
  localBanner: { backgroundColor: '#ECFDF5', borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#A7F3D0' },
  localTitle: { color: '#065F46', fontWeight: '800', fontSize: 13 },
  localSub: { color: '#047857', fontSize: 12, marginTop: 2 },
  localLibraryName: { color: '#047857', fontSize: 15, fontWeight: '800', marginTop: 4 },
  localLibraryCode: { color: '#065F46', fontSize: 11, fontWeight: '600', marginTop: 2 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A', marginBottom: 12, marginTop: 8 },
  headerBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, marginBottom: 12 },
  editPriceBtn: { backgroundColor: '#EFF6FF', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#2563EB' },
  editPriceText: { color: '#2563EB', fontWeight: '700', fontSize: 12 },
  priceCard: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#64748B', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  priceLabel: { color: '#64748B', fontSize: 13 },
  priceVal: { color: '#0F172A', fontWeight: '700', fontSize: 14 },
  gridRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  metricCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#64748B', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  metricLabel: { color: '#64748B', fontSize: 12, fontWeight: '600' },
  metricValue: { color: '#2563EB', fontSize: 22, fontWeight: '800', marginTop: 6 },
  pendingCard: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#FEF3C7', shadowColor: '#64748B', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  studentName: { color: '#0F172A', fontWeight: '700', fontSize: 15 },
  amountText: { color: '#2563EB', fontSize: 14, fontWeight: '600', marginTop: 2 },
  dateText: { color: '#64748B', fontSize: 11, marginTop: 4 },
  tapReviewHint: { color: '#2563EB', fontSize: 11, fontWeight: '700', marginTop: 6 },
  approveBtn: { backgroundColor: '#16A34A', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8 },
  approveText: { color: '#FFFFFF', fontWeight: '800', fontSize: 12 },
  logoutBtn: { paddingVertical: 14, alignItems: 'center', borderRadius: 10, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FCA5A5', marginTop: 20, marginBottom: 24 },
  logoutText: { color: '#DC2626', fontWeight: '700', fontSize: 15 },
  /* REVIEW MODAL STYLES */
  reviewModalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.75)', justifyContent: 'center' },
  reviewModalSafeArea: { flex: 1, padding: 16 },
  reviewModalCard: { backgroundColor: '#FFFFFF', borderRadius: 20, flex: 1, overflow: 'hidden' },
  reviewModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  reviewModalTitle: { fontSize: 17, fontWeight: '800', color: '#0F172A' },
  closeBtn: { padding: 4 },
  closeBtnText: { fontSize: 18, color: '#64748B', fontWeight: '800' },
  reviewModalBody: { padding: 16 },
  infoBox: { backgroundColor: '#F8FAFC', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 12 },
  infoName: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  infoMeta: { fontSize: 12, color: '#64748B', marginTop: 2 },
  strikeWarnBox: { backgroundColor: '#FEF2F2', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#FCA5A5', marginBottom: 12 },
  strikeWarnText: { fontSize: 11, color: '#991B1B', fontWeight: '700' },
  amenityBox: { backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE', borderRadius: 10, padding: 12, marginBottom: 12 },
  amenityLabel: { fontSize: 10, fontWeight: '800', color: '#2563EB' },
  amenityTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A', marginTop: 2 },
  amenitySub: { fontSize: 12, color: '#475569', marginTop: 2 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 4 },
  detailLabel: { color: '#64748B', fontSize: 13 },
  amountValue: { color: '#16A34A', fontSize: 15, fontWeight: '800' },
  utrValue: { color: '#2563EB', fontSize: 13, fontWeight: '800' },
  proofHeaderLabel: { fontSize: 10, fontWeight: '800', color: '#64748B', textTransform: 'uppercase', marginTop: 12, marginBottom: 4 },
  proofContainer: { backgroundColor: '#0F172A', borderRadius: 10, overflow: 'hidden', marginVertical: 8, borderWidth: 1, borderColor: '#334155' },
  proofImg: { width: '100%', height: 220, backgroundColor: '#0F172A' },
  zoomHint: { backgroundColor: 'rgba(15, 23, 42, 0.8)', paddingVertical: 6, alignItems: 'center' },
  zoomHintText: { color: '#38BDF8', fontSize: 11, fontWeight: '700' },
  noProofBox: { backgroundColor: '#F1F5F9', padding: 12, borderRadius: 8, marginVertical: 8, alignItems: 'center' },
  noProofText: { fontSize: 12, color: '#64748B' },
  reviewModalActions: { flexDirection: 'row', gap: 12, marginTop: 16, marginBottom: 10 },
  modalActionBtn: { flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  btnRejectModal: { backgroundColor: '#DC2626' },
  btnApproveModal: { backgroundColor: '#16A34A' },
  btnTextModal: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  btnDisabled: { opacity: 0.6 },
  /* FULL IMAGE OVERLAY */
  fullImageOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.95)' },
  fullImageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#334155' },
  fullImageTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  fullImageCloseBtn: { backgroundColor: '#334155', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  fullImageWrapper: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 10 },
  fullImage: { width: '100%', height: '100%' },
  /* OTHER MODAL STYLES */
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.5)', justifyContent: 'center', padding: 20 },
  modalBox: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#E2E8F0' },
  modalTitle: { color: '#0F172A', fontSize: 18, fontWeight: '800', marginBottom: 16 },
  inputLabel: { color: '#334155', fontSize: 12, fontWeight: '600', marginBottom: 4, marginTop: 8 },
  modalInput: { backgroundColor: '#F8FAFC', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, color: '#0F172A', fontSize: 14, borderWidth: 1, borderColor: '#CBD5E1' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  cancelBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 8, backgroundColor: '#E2E8F0' },
  cancelText: { color: '#475569', fontWeight: '700' },
  confirmBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 8, backgroundColor: '#2563EB' },
  confirmText: { color: '#FFFFFF', fontWeight: '700' },
});
