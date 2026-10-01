import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../src/services/api.client';
import { getFullImageUrl } from '../../src/constants/config';
import { HamburgerMenu } from '../../src/components/HamburgerMenu';
import { LOCAL_ADMIN_MENU } from '../../src/constants/menuItems';

export default function PaymentApprovalsScreen() {
  const queryClient = useQueryClient();
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  const { data: pending = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['pending-payments'],
    queryFn: async () => {
      const res = await apiRequest('/payments/pending');
      if (!res.success) throw new Error(res.error?.message || 'Failed to fetch pending payment submissions');
      return res.data || [];
    },
    retry: 1,
  });

  const pendingList = Array.isArray(pending) ? pending : [];

  const handleApprove = async (paymentId: string) => {
    try {
      setProcessingId(paymentId);
      const res = await apiRequest(`/payments/${paymentId}/approve`, 'POST', { adminNotes: 'Verified & approved' });
      if (res.success) {
        Alert.alert(
          'Approved! ✅',
          'Payment approved successfully. Subscription extended from student\'s previous expiry date and seat/locker allocated.'
        );
        queryClient.invalidateQueries({ queryKey: ['pending-payments'] });
        queryClient.invalidateQueries({ queryKey: ['admin-pending-payments'] });
        queryClient.invalidateQueries({ queryKey: ['admin-metrics'] });
        queryClient.invalidateQueries({ queryKey: ['admin-due-payments'] });
      } else {
        Alert.alert('Approval Error', res.error?.message || 'Failed to approve payment');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (pay: any) => {
    const studentRejectionCount = pay.studentId?.rejectionCount || 0;
    const isStrike3 = studentRejectionCount >= 2;

    const message = isStrike3
      ? '⚠️ Warning: Rejecting this payment will be the 3rd strike. The student account will be automatically set to INACTIVE and all reservations released. Proceed?'
      : 'Are you sure you want to reject this payment request?';

    Alert.alert('Reject Payment', message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm Reject',
        style: 'destructive',
        onPress: async () => {
          try {
            setProcessingId(pay._id);
            const res = await apiRequest(`/payments/${pay._id}/reject`, 'POST', { adminNotes: 'Payment proof or UTR unverified' });
            if (res.success) {
              const newCount = res.data?.rejectionCount || studentRejectionCount + 1;
              if (res.data?.isStudentInactive || newCount >= 3) {
                Alert.alert('Payment Rejected ⚠️', 'Payment rejected. Student reached 3 rejections and has been set to INACTIVE.');
              } else {
                Alert.alert('Rejected', `Payment request rejected. Student has ${newCount} rejection(s).`);
              }
              queryClient.invalidateQueries({ queryKey: ['pending-payments'] });
              queryClient.invalidateQueries({ queryKey: ['admin-pending-payments'] });
              queryClient.invalidateQueries({ queryKey: ['admin-metrics'] });
            } else {
              Alert.alert('Rejection Error', res.error?.message || 'Failed to reject payment');
            }
          } catch (err: any) {
            Alert.alert('Error', err.message);
          } finally {
            setProcessingId(null);
          }
        },
      },
    ]);
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
        <HamburgerMenu title="Payment Approval" role="LIBRARY_ADMIN" items={LOCAL_ADMIN_MENU} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>⚠️ Unable to Load Submissions</Text>
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
      <HamburgerMenu title="Payment Approval" role="LIBRARY_ADMIN" items={LOCAL_ADMIN_MENU} />

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.headerTitle}>Student Payment Approvals</Text>
        <Text style={styles.subTitle}>Review student-submitted payment proofs & UTRs to approve or reject</Text>

        {pendingList.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>✅</Text>
            <Text style={styles.emptyTitle}>No Submissions Pending Approval</Text>
            <Text style={styles.emptySub}>All student payment submissions have been reviewed.</Text>
          </View>
        ) : (
          pendingList.map((pay: any) => {
            const studentName = pay.studentId?.userId?.fullName || 'Student';
            const studentPhone = pay.studentId?.userId?.phone || '';
            const cardNo = pay.studentId?.studentIdCardNo || '';
            const rejectionCount = pay.studentId?.rejectionCount || 0;
            const rawProof = pay.proofUrl || (pay.proofObjectKey ? `/uploads/${pay.proofObjectKey.replace(/^\/+/, '')}` : null);
            const fullProofUrl = getFullImageUrl(rawProof);

            return (
              <View key={pay._id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.studentName}>{studentName}</Text>
                    <Text style={styles.studentMeta}>Card: {cardNo} • {studentPhone}</Text>
                  </View>
                  <Text style={styles.amountText}>₹{pay.amount}</Text>
                </View>

                {/* Strike Warning Badge */}
                {rejectionCount > 0 && (
                  <View style={[styles.strikeBadge, rejectionCount >= 2 && styles.strikeBadgeHigh]}>
                    <Text style={[styles.strikeText, rejectionCount >= 2 && styles.strikeTextHigh]}>
                      ⚠️ {rejectionCount} Previous Rejection(s) {rejectionCount >= 2 ? '(Next rejection deactivates account)' : ''}
                    </Text>
                  </View>
                )}

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Payment Type:</Text>
                  <Text style={styles.detailValue}>{pay.paymentType} {pay.months ? `(${pay.months} mo)` : ''}</Text>
                </View>

                {pay.utrNumber ? (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>UTR Ref:</Text>
                    <Text style={styles.utrValue}>{pay.utrNumber}</Text>
                  </View>
                ) : null}

                {/* Requested Seat Details */}
                {pay.targetSeatId ? (
                  <View style={styles.requestedBox}>
                    <Text style={styles.requestedLabel}>🪑 REQUESTED SEAT RESERVATION</Text>
                    <Text style={styles.requestedTitle}>
                      Seat {pay.targetSeatId.seatNumber} • Floor {pay.targetSeatId.floor || 1}
                    </Text>
                    <Text style={styles.requestedSub}>
                      Price: ₹{pay.targetSeatId.priceMonthly || pay.amount}/mo
                    </Text>
                  </View>
                ) : null}

                {/* Requested Locker Details */}
                {pay.targetLockerId ? (
                  <View style={styles.requestedBox}>
                    <Text style={styles.requestedLabel}>🔒 REQUESTED LOCKER RESERVATION</Text>
                    <Text style={styles.requestedTitle}>
                      Locker {pay.targetLockerId.lockerNumber} • Floor {pay.targetLockerId.floor || 1}
                    </Text>
                    <Text style={styles.requestedSub}>
                      Price: ₹{pay.targetLockerId.priceMonthly || pay.amount}/mo
                    </Text>
                  </View>
                ) : null}

                {/* Uploaded Payment Screenshot Preview */}
                {fullProofUrl ? (
                  <View style={styles.proofWrapper}>
                    <Text style={styles.proofHeaderLabel}>📸 UPLOADED PAYMENT SCREENSHOT</Text>
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
                  </View>
                ) : (
                  <View style={styles.noProofBox}>
                    <Text style={styles.noProofText}>No payment proof image attached</Text>
                  </View>
                )}

                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={[styles.btn, styles.btnReject, processingId === pay._id && styles.btnDisabled]}
                    disabled={processingId === pay._id}
                    onPress={() => handleReject(pay)}
                  >
                    <Text style={styles.btnText}>REJECT</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.btn, styles.btnApprove, processingId === pay._id && styles.btnDisabled]}
                    disabled={processingId === pay._id}
                    onPress={() => handleApprove(pay._id)}
                  >
                    {processingId === pay._id ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.btnText}>APPROVE</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Expandable Image Preview Modal */}
      <Modal
        animationType="fade"
        transparent
        visible={!!previewImageUrl}
        onRequestClose={() => setPreviewImageUrl(null)}
      >
        {previewImageUrl && (
          <View style={styles.imageModalOverlay}>
            <SafeAreaView style={styles.imageModalSafeArea}>
              <TouchableOpacity style={styles.imageModalCloseBtn} onPress={() => setPreviewImageUrl(null)}>
                <Text style={styles.imageModalCloseText}>✕ Close Preview</Text>
              </TouchableOpacity>

              <View style={styles.imageModalCard}>
                <Image source={{ uri: previewImageUrl }} style={styles.fullProofImage} resizeMode="contain" />
              </View>
            </SafeAreaView>
          </View>
        )}
      </Modal>
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
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
  },
  subTitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
    marginBottom: 16,
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
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
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
  amountText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#16A34A',
  },
  strikeBadge: {
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 12,
  },
  strikeBadgeHigh: {
    backgroundColor: '#FEE2E2',
  },
  strikeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B45309',
  },
  strikeTextHigh: {
    color: '#991B1B',
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
  utrValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#2563EB',
  },
  requestedBox: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
    marginBottom: 10,
  },
  requestedLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#2563EB',
  },
  requestedTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  requestedSub: {
    fontSize: 11,
    color: '#475569',
    marginTop: 2,
  },
  proofWrapper: {
    marginTop: 8,
    marginBottom: 14,
  },
  proofHeaderLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
    marginBottom: 6,
  },
  proofContainer: {
    height: 160,
    backgroundColor: '#0F172A',
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  proofImg: {
    width: '100%',
    height: '100%',
  },
  zoomHint: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingVertical: 6,
    alignItems: 'center',
  },
  zoomHintText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  noProofBox: {
    backgroundColor: '#F1F5F9',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginVertical: 10,
  },
  noProofText: {
    fontSize: 12,
    color: '#64748B',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  btn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnReject: {
    backgroundColor: '#EF4444',
  },
  btnApprove: {
    backgroundColor: '#10B981',
  },
  btnText: {
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
  imageModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    justifyContent: 'center',
  },
  imageModalSafeArea: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 16,
  },
  imageModalCloseBtn: {
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  imageModalCloseText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  imageModalCard: {
    flex: 1,
    marginVertical: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullProofImage: {
    width: '100%',
    height: '100%',
  },
});
