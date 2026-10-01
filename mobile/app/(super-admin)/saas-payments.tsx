import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Alert,
  Image,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../src/services/api.client';
import { getFullImageUrl } from '../../src/constants/config';
import { HamburgerMenu } from '../../src/components/HamburgerMenu';

const SUPER_ADMIN_MENU = [
  { label: 'Search Libraries', route: '/(super-admin)/libraries', icon: '🏛️', category: 'Library Operations' },
  { label: 'Onboard New Library', route: '/(super-admin)/onboard-library', icon: '➕', category: 'Library Operations' },
  { label: 'Local Admin Payments', route: '/(super-admin)/saas-payments', icon: '💳', category: 'Library Operations' },
  { label: 'Platform Revenue', route: '/(super-admin)/analytics', icon: '📈', category: 'SaaS Platform Analytics' },
  { label: 'Feature Entitlements', route: '/(super-admin)/feature-flags', icon: '⚡', category: 'SaaS Platform Analytics' },
];

function formatDateDDMonthYYYY(dateString?: string) {
  if (!dateString) return 'N/A';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return 'N/A';
  const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const day = String(d.getDate()).padStart(2, '0');
  const month = MONTH_NAMES[d.getMonth()];
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

export default function SuperAdminSaaSPaymentsScreen() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'PENDING' | 'DEFAULTERS' | 'HISTORY'>('PENDING');

  // Modal State for Image View & Rejection
  const [viewingPayment, setViewingPayment] = useState<any | null>(null);
  const [imageLoadError, setImageLoadError] = useState(false);
  const [rejectingItem, setRejectingItem] = useState<any | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState(false);

  // Fetch SaaS Payments
  const { data: payments, isLoading: paymentsLoading } = useQuery({
    queryKey: ['super-admin-saas-payments'],
    queryFn: async () => {
      const res = await apiRequest('/super-admin/saas-payments');
      if (!res.success) throw new Error(res.error?.message || 'Failed to fetch SaaS payments');
      return res.data || [];
    },
  });

  // Fetch Libraries for Defaulters View
  const { data: libraries, isLoading: librariesLoading } = useQuery({
    queryKey: ['super-admin-libraries-summary'],
    queryFn: async () => {
      const res = await apiRequest('/super-admin/libraries/summary');
      if (!res.success) throw new Error(res.error?.message || 'Failed to fetch libraries summary');
      return res.data || [];
    },
  });

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const pendingPayments = (payments || []).filter((p: any) => {
    if (p.status === 'PENDING') return true;
    if (p.status === 'REJECTED') {
      const rawDueDate = p.libraryId?.saasNextDueDate || p.dueDate;
      if (!rawDueDate) return false;
      const dueDate = new Date(rawDueDate);
      return !isNaN(dueDate.getTime()) && dueDate < todayStart;
    }
    return false;
  });
  const defaulterLibraries = (libraries || []).filter((lib: any) => lib.saasPaymentStatus === 'OVERDUE_DEFAULTER');

  const handleApprove = async (paymentId: string) => {
    Alert.alert(
      'Approve SaaS Payment',
      'Are you sure you want to approve this payment? The library subscription next due date will be extended.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve Payment',
          onPress: async () => {
            setProcessing(true);
            try {
              const res = await apiRequest(`/super-admin/saas-payments/${paymentId}/approve`, 'PATCH');
              if (res.success) {
                Alert.alert('Payment Approved! 🎉', 'SaaS payment approved and next due date extended.');
                queryClient.invalidateQueries({ queryKey: ['super-admin-saas-payments'] });
                queryClient.invalidateQueries({ queryKey: ['super-admin-libraries-summary'] });
              } else {
                Alert.alert('Error', res.error?.message || 'Failed to approve payment.');
              }
            } catch (err: any) {
              Alert.alert('Error', err.message || 'An error occurred.');
            } finally {
              setProcessing(false);
            }
          },
        },
      ]
    );
  };

  const handleRejectSubmit = async () => {
    if (!rejectingItem) return;
    setProcessing(true);
    try {
      const res = await apiRequest(`/super-admin/saas-payments/${rejectingItem._id}/reject`, 'PATCH', {
        rejectionReason: rejectionReason.trim() || 'Payment verification failed.',
      });

      if (res.success) {
        Alert.alert('Payment Rejected', 'SaaS payment status set to REJECTED.');
        setRejectingItem(null);
        setRejectionReason('');
        queryClient.invalidateQueries({ queryKey: ['super-admin-saas-payments'] });
        queryClient.invalidateQueries({ queryKey: ['super-admin-libraries-summary'] });
      } else {
        Alert.alert('Error', res.error?.message || 'Failed to reject payment.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'An error occurred.');
    } finally {
      setProcessing(false);
    }
  };

  const isLoading = paymentsLoading || librariesLoading;

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#F59E0B" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <HamburgerMenu title="Local Admin Payments" role="SUPER_ADMIN" items={SUPER_ADMIN_MENU} />

      <View style={styles.contentContainer}>
        <Text style={styles.headerTitle}>Local Admin SaaS Payments</Text>
        <Text style={styles.subTitle}>Approve subscription payments and manage payment defaulters</Text>

        {/* TABS HEADER */}
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'PENDING' && styles.tabBtnActive]}
            onPress={() => setActiveTab('PENDING')}
          >
            <Text style={[styles.tabText, activeTab === 'PENDING' && styles.tabTextActive]}>
              ⏳ Pending ({pendingPayments.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'DEFAULTERS' && styles.tabBtnActive]}
            onPress={() => setActiveTab('DEFAULTERS')}
          >
            <Text style={[styles.tabText, activeTab === 'DEFAULTERS' && styles.tabTextActive]}>
              ⚠️ Defaulters ({defaulterLibraries.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'HISTORY' && styles.tabBtnActive]}
            onPress={() => setActiveTab('HISTORY')}
          >
            <Text style={[styles.tabText, activeTab === 'HISTORY' && styles.tabTextActive]}>
              📜 All History
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* TAB 1: PENDING APPROVALS */}
          {activeTab === 'PENDING' && (
            pendingPayments.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>No pending SaaS payments to review.</Text>
              </View>
            ) : (
              pendingPayments.map((item: any) => {
                const fullProofUrl = getFullImageUrl(item.proofImage || item.receiptImage);

                return (
                  <View key={item._id} style={styles.card}>
                    <View style={styles.cardHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.libName}>{item.libraryId?.name} ({item.libraryId?.code})</Text>
                        <Text style={styles.adminText}>👤 Admin: {item.adminUserId?.fullName} • 📞 {item.adminUserId?.phone}</Text>
                      </View>
                      <View style={item.status === 'REJECTED' ? [styles.pendingBadge, { backgroundColor: '#FEE2E2' }] : styles.pendingBadge}>
                        <Text style={item.status === 'REJECTED' ? [styles.pendingBadgeText, { color: '#DC2626' }] : styles.pendingBadgeText}>{item.status}</Text>
                      </View>
                    </View>

                    <View style={styles.detailsGrid}>
                      <View style={styles.detailBox}>
                        <Text style={styles.detailLabel}>Plan & Amount</Text>
                        <Text style={styles.detailVal}>₹{item.amount.toLocaleString()} ({item.planType})</Text>
                      </View>
                      <View style={styles.detailBox}>
                        <Text style={styles.detailLabel}>Submitted Date</Text>
                        <Text style={styles.detailVal}>{formatDateDDMonthYYYY(item.submittedAt)}</Text>
                      </View>
                    </View>

                    {item.transactionRef ? (
                      <Text style={styles.refText}>Ref / UTR: <Text style={{ fontWeight: '800', color: '#1E40AF' }}>{item.transactionRef}</Text></Text>
                    ) : null}

                    {item.status === 'REJECTED' && item.rejectionReason ? (
                      <Text style={styles.rejectionReasonText}>Reason: {item.rejectionReason}</Text>
                    ) : null}

                    {/* PROOF SCREENSHOT VIEW BUTTON */}
                    {fullProofUrl ? (
                      <TouchableOpacity
                        style={styles.proofPreviewBox}
                        onPress={() => {
                          setImageLoadError(false);
                          setViewingPayment(item);
                        }}
                        activeOpacity={0.8}
                      >
                        <Image source={{ uri: fullProofUrl }} style={styles.proofThumb} resizeMode="cover" />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.proofTitle}>🖼️ Payment Proof Screenshot</Text>
                          <Text style={styles.proofSub}>Tap to open full-screen lightbox preview</Text>
                        </View>
                        <View style={styles.viewBadge}>
                          <Text style={styles.viewBadgeText}>🔍 View</Text>
                        </View>
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.noProofBox}>
                        <Text style={styles.noProofText}>📷 Proof Screenshot: No file attached</Text>
                      </View>
                    )}

                    {/* ACTION BUTTONS */}
                    <View style={styles.actionRow}>
                      <TouchableOpacity
                        style={[styles.approveBtn, processing && styles.btnDisabled]}
                        onPress={() => handleApprove(item._id)}
                        disabled={processing}
                      >
                        <Text style={styles.approveText}>✓ Approve Payment</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.rejectBtn, processing && styles.btnDisabled]}
                        onPress={() => {
                          setRejectingItem(item);
                          setRejectionReason('');
                        }}
                        disabled={processing}
                      >
                        <Text style={styles.rejectText}>✕ Reject</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )
          )}

          {/* TAB 2: PAYMENT DEFAULTERS */}
          {activeTab === 'DEFAULTERS' && (
            defaulterLibraries.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>🎉 No payment defaulters! All libraries are up to date.</Text>
              </View>
            ) : (
              defaulterLibraries.map((lib: any) => (
                <View key={lib.libraryId} style={styles.defaulterCard}>
                  <View style={styles.cardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.libName}>{lib.name} ({lib.code})</Text>
                      <Text style={styles.adminText}>👤 Admin: {lib.adminName} • 📞 {lib.adminPhone}</Text>
                    </View>
                    <View style={styles.defaulterBadge}>
                      <Text style={styles.defaulterBadgeText}>🔴 DEFAULTER</Text>
                    </View>
                  </View>

                  <View style={styles.overdueDetailsBox}>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Subscribed Plan:</Text>
                      <Text style={styles.infoVal}>{lib.saasPlanType || 'MONTHLY'} (₹{(lib.saasAmount || 1200).toLocaleString()})</Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Payment Deadline:</Text>
                      <Text style={[styles.infoVal, { color: '#DC2626' }]}>{formatDateDDMonthYYYY(lib.saasNextDueDate)}</Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Admin Account Status:</Text>
                      <Text style={styles.infoVal}>{lib.adminIsActive ? '🟢 Active' : '🔴 Inactive'}</Text>
                    </View>
                  </View>
                </View>
              ))
            )
          )}

          {/* TAB 3: ALL PAYMENT HISTORY */}
          {activeTab === 'HISTORY' && (
            (payments || []).length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>No payment history records found.</Text>
              </View>
            ) : (
              (payments || []).map((item: any) => {
                const fullProofUrl = getFullImageUrl(item.proofImage || item.receiptImage);

                return (
                  <View key={item._id} style={styles.card}>
                    <View style={styles.cardHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.libName}>{item.libraryId?.name} ({item.libraryId?.code})</Text>
                        <Text style={styles.adminText}>Submitted: {formatDateDDMonthYYYY(item.submittedAt)}</Text>
                      </View>
                      <View
                        style={[
                          styles.historyBadge,
                          item.status === 'APPROVED'
                            ? styles.bgApproved
                            : item.status === 'REJECTED'
                              ? styles.bgRejected
                              : styles.bgPending,
                        ]}
                      >
                        <Text
                          style={[
                            styles.historyBadgeText,
                            item.status === 'APPROVED'
                              ? styles.textApproved
                              : item.status === 'REJECTED'
                                ? styles.textRejected
                                : styles.textPending,
                          ]}
                        >
                          {item.status}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.historyAmount}>
                      Amount: <Text style={{ fontWeight: '900', color: '#0F172A' }}>₹{item.amount.toLocaleString()}</Text> ({item.planType})
                    </Text>
                    {item.transactionRef ? <Text style={styles.refText}>Ref / UTR: {item.transactionRef}</Text> : null}

                    {fullProofUrl ? (
                      <TouchableOpacity
                        style={styles.historyProofBtn}
                        onPress={() => {
                          setImageLoadError(false);
                          setViewingPayment(item);
                        }}
                      >
                        <Text style={styles.historyProofBtnText}>🖼️ View Payment Proof Screenshot</Text>
                      </TouchableOpacity>
                    ) : null}

                    {item.rejectionReason ? (
                      <Text style={styles.rejectionReasonText}>Reason: {item.rejectionReason}</Text>
                    ) : null}
                  </View>
                );
              })
            )
          )}
        </ScrollView>
      </View>

      {/* LIGHTBOX PROOF SCREENSHOT MODAL */}
      <Modal visible={!!viewingPayment} transparent animationType="fade" onRequestClose={() => setViewingPayment(null)}>
        <View style={styles.fullImageOverlay}>
          <View style={styles.modalHeaderBox}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalLibTitle}>
                {viewingPayment?.libraryId?.name} ({viewingPayment?.libraryId?.code})
              </Text>
              <Text style={styles.modalMetaSub}>
                Amount: ₹{viewingPayment?.amount?.toLocaleString()} ({viewingPayment?.planType}) • Ref: {viewingPayment?.transactionRef || 'N/A'}
              </Text>
            </View>
            <TouchableOpacity style={styles.closeImageBtn} onPress={() => setViewingPayment(null)}>
              <Text style={styles.closeImageText}>✕ Close</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.imageContainerBox}>
            {viewingPayment && getFullImageUrl(viewingPayment.proofImage) && !imageLoadError ? (
              <Image
                source={{ uri: getFullImageUrl(viewingPayment.proofImage)! }}
                style={styles.fullImage}
                resizeMode="contain"
                onError={() => setImageLoadError(true)}
              />
            ) : (
              <View style={styles.imageErrorBox}>
                <Text style={styles.imageErrorIcon}>⚠️</Text>
                <Text style={styles.imageErrorTitle}>Unable to Load Proof Screenshot</Text>
                <Text style={styles.imageErrorSub}>The image file may have been moved, deleted, or is in an unsupported format.</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* REJECTION REASON MODAL */}
      <Modal visible={!!rejectingItem} transparent animationType="slide" onRequestClose={() => setRejectingItem(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Reject SaaS Payment</Text>
            <Text style={styles.modalSub}>
              {rejectingItem?.libraryId?.name} ({rejectingItem?.libraryId?.code})
            </Text>

            <Text style={styles.label}>Reason for Rejection *</Text>
            <TextInput
              style={styles.rejectInput}
              placeholder="e.g. Invalid UTR / Screenshot unreadable"
              placeholderTextColor="#64748B"
              value={rejectionReason}
              onChangeText={setRejectionReason}
              multiline
              numberOfLines={3}
            />

            <TouchableOpacity
              style={[styles.confirmRejectBtn, processing && styles.btnDisabled]}
              onPress={handleRejectSubmit}
              disabled={processing}
            >
              {processing ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.confirmRejectText}>Confirm Rejection</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelBtn} onPress={() => setRejectingItem(null)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  contentContainer: { flex: 1, padding: 16 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#0F172A' },
  subTitle: { fontSize: 13, color: '#64748B', marginTop: 4, marginBottom: 14 },
  tabRow: { flexDirection: 'row', gap: 6, marginBottom: 14 },
  tabBtn: { flex: 1, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#CBD5E1', paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  tabBtnActive: { backgroundColor: '#EFF6FF', borderColor: '#2563EB' },
  tabText: { fontSize: 12, fontWeight: '700', color: '#64748B' },
  tabTextActive: { color: '#1E40AF', fontWeight: '800' },
  scrollContent: { paddingBottom: 40 },
  emptyCard: { backgroundColor: '#FFFFFF', padding: 24, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center' },
  emptyText: { color: '#64748B', fontSize: 13 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0', elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, gap: 8 },
  libName: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  adminText: { fontSize: 12, color: '#64748B', marginTop: 2 },
  pendingBadge: { backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  pendingBadgeText: { color: '#B45309', fontWeight: '800', fontSize: 10 },
  detailsGrid: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  detailBox: { flex: 1, backgroundColor: '#F8FAFC', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  detailLabel: { fontSize: 11, color: '#64748B', fontWeight: '700' },
  detailVal: { fontSize: 13, fontWeight: '800', color: '#0F172A', marginTop: 2 },
  refText: { fontSize: 12, color: '#475569', marginBottom: 10 },
  proofPreviewBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
    gap: 10,
    marginBottom: 14,
  },
  proofThumb: { width: 48, height: 48, borderRadius: 8, borderWidth: 1, borderColor: '#93C5FD' },
  proofTitle: { fontSize: 12, color: '#1E40AF', fontWeight: '800' },
  proofSub: { fontSize: 11, color: '#3B82F6', marginTop: 1 },
  viewBadge: { backgroundColor: '#2563EB', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  viewBadgeText: { color: '#FFFFFF', fontWeight: '800', fontSize: 11 },
  noProofBox: { backgroundColor: '#F1F5F9', padding: 10, borderRadius: 8, marginBottom: 12, alignItems: 'center' },
  noProofText: { fontSize: 12, color: '#64748B', fontWeight: '600' },
  actionRow: { flexDirection: 'row', gap: 10 },
  approveBtn: { flex: 2, backgroundColor: '#16A34A', paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  approveText: { color: '#FFFFFF', fontWeight: '900', fontSize: 13 },
  rejectBtn: { flex: 1, backgroundColor: '#FEE2E2', borderWidth: 1, borderColor: '#FCA5A5', paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  rejectText: { color: '#991B1B', fontWeight: '800', fontSize: 13 },
  btnDisabled: { opacity: 0.6 },
  defaulterCard: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1.5, borderColor: '#FCA5A5', elevation: 2 },
  defaulterBadge: { backgroundColor: '#FEE2E2', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  defaulterBadgeText: { color: '#991B1B', fontWeight: '900', fontSize: 10 },
  overdueDetailsBox: { backgroundColor: '#FEF2F2', padding: 12, borderRadius: 10, marginTop: 10 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  infoLabel: { fontSize: 12, color: '#7F1D1D', fontWeight: '600' },
  infoVal: { fontSize: 12, color: '#991B1B', fontWeight: '800' },
  historyBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  historyBadgeText: { fontSize: 10, fontWeight: '800' },
  bgApproved: { backgroundColor: '#DCFCE7' },
  textApproved: { color: '#15803D' },
  bgRejected: { backgroundColor: '#FEE2E2' },
  textRejected: { color: '#B91C1C' },
  bgPending: { backgroundColor: '#FEF3C7' },
  textPending: { color: '#B45309' },
  historyAmount: { fontSize: 13, color: '#475569', marginBottom: 4 },
  historyProofBtn: { backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, alignSelf: 'flex-start', marginVertical: 6 },
  historyProofBtnText: { color: '#2563EB', fontWeight: '800', fontSize: 12 },
  rejectionReasonText: { fontSize: 11, color: '#991B1B', fontWeight: '600', marginTop: 4 },
  fullImageOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.95)', padding: 16, justifyContent: 'center' },
  modalHeaderBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 10 },
  modalLibTitle: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
  modalMetaSub: { fontSize: 12, color: '#94A3B8', marginTop: 2 },
  closeImageBtn: { backgroundColor: '#DC2626', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  closeImageText: { color: '#FFFFFF', fontWeight: '900', fontSize: 12 },
  imageContainerBox: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0F172A', borderRadius: 16, overflow: 'hidden' },
  fullImage: { width: '100%', height: '100%' },
  imageErrorBox: { padding: 24, alignItems: 'center' },
  imageErrorIcon: { fontSize: 36, marginBottom: 10 },
  imageErrorTitle: { fontSize: 16, fontWeight: '800', color: '#F87171', marginBottom: 6 },
  imageErrorSub: { fontSize: 13, color: '#94A3B8', textAlign: 'center', lineHeight: 18 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#E2E8F0' },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  modalSub: { fontSize: 13, color: '#64748B', marginTop: 2, marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 6 },
  rejectInput: { backgroundColor: '#F8FAFC', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, color: '#0F172A', fontSize: 14, borderWidth: 1, borderColor: '#CBD5E1', textAlignVertical: 'top', marginBottom: 14 },
  confirmRejectBtn: { backgroundColor: '#DC2626', paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginBottom: 10 },
  confirmRejectText: { color: '#FFFFFF', fontWeight: '900', fontSize: 14 },
  cancelBtn: { paddingVertical: 10, alignItems: 'center' },
  cancelText: { color: '#64748B', fontWeight: '700', fontSize: 13 },
});
