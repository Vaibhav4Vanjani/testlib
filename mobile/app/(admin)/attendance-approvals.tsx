import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  Image,
  RefreshControl,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../src/services/api.client';
import { HamburgerMenu } from '../../src/components/HamburgerMenu';
import { LOCAL_ADMIN_MENU } from '../../src/constants/menuItems';
import { getFullImageUrl } from '../../src/constants/config';

function formatScanTime(dateStr?: string | Date): string {
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'N/A';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
}

function formatDate(dateStr?: string | Date): string {
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'N/A';
  return d.toISOString().split('T')[0];
}

export default function AttendanceApprovalsScreen() {
  const queryClient = useQueryClient();
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const { data: requests = [], isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['admin-attendance-requests'],
    queryFn: async () => {
      const res = await apiRequest('/attendance/requests');
      if (!res.success) throw new Error(res.error?.message || 'Failed to fetch attendance requests');
      return res.data || [];
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const res = await apiRequest(`/attendance/requests/${requestId}/approve`, 'POST');
      if (!res.success) throw new Error(res.error?.message || 'Failed to approve attendance request');
      return res.data;
    },
    onSuccess: (data) => {
      Alert.alert('Approved!', 'Attendance check-in approved. Check-in time set to exact QR scan timestamp.');
      queryClient.invalidateQueries({ queryKey: ['admin-attendance-requests'] });
    },
    onError: (err: any) => {
      Alert.alert('Approval Error', err.message);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ requestId, reason }: { requestId: string; reason: string }) => {
      const res = await apiRequest(`/attendance/requests/${requestId}/reject`, 'POST', { rejectionReason: reason });
      if (!res.success) throw new Error(res.error?.message || 'Failed to reject attendance request');
      return res.data;
    },
    onSuccess: () => {
      Alert.alert('Rejected', 'Attendance request rejected and student notified.');
      setRejectModalVisible(false);
      setRejectionReason('');
      queryClient.invalidateQueries({ queryKey: ['admin-attendance-requests'] });
    },
    onError: (err: any) => {
      Alert.alert('Rejection Error', err.message);
    },
  });

  const handleOpenRejectModal = (item: any) => {
    setSelectedRequest(item);
    setRejectionReason('Payment pending / Subscription verification required.');
    setRejectModalVisible(true);
  };

  const handleConfirmReject = () => {
    if (!selectedRequest) return;
    if (!rejectionReason.trim()) {
      Alert.alert('Validation Error', 'Please specify a rejection reason.');
      return;
    }
    rejectMutation.mutate({ requestId: selectedRequest._id, reason: rejectionReason.trim() });
  };

  const renderItem = ({ item }: { item: any }) => {
    const studentUser = item.userId || {};
    const profile = item.studentProfileId || {};
    const photoUrl = getFullImageUrl(profile.profilePictureUrl || profile.profilePicture);

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.userRow}>
            {photoUrl ? (
              <Image source={{ uri: photoUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Text style={styles.avatarInitial}>{studentUser.fullName?.charAt(0) || 'S'}</Text>
              </View>
            )}
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.studentName}>{studentUser.fullName || 'Student'}</Text>
              <Text style={styles.studentPhone}>📞 {studentUser.phone || 'N/A'}</Text>
              <Text style={styles.studentCardNo}>🪪 Card: {profile.studentIdCardNo || 'N/A'}</Text>
            </View>
          </View>
        </View>

        <View style={styles.detailsDivider} />

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Exact QR Scan Timestamp:</Text>
          <Text style={styles.scanTimeText}>⏱️ {formatScanTime(item.scanTimestamp)}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Subscription Expiry:</Text>
          <Text style={styles.infoVal}>{formatDate(profile.membershipExpiresAt)}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Payment Status:</Text>
          <Text
            style={[
              styles.badgeText,
              item.paymentStatusAtScan === 'PAID' ? styles.badgeSuccess : styles.badgeWarning,
            ]}
          >
            {item.paymentStatusAtScan || 'PAID'}
          </Text>
        </View>

        <View style={styles.btnRow}>
          <TouchableOpacity
            style={[styles.btn, styles.btnApprove, approveMutation.isPending && styles.btnDisabled]}
            onPress={() => approveMutation.mutate(item._id)}
            disabled={approveMutation.isPending}
          >
            <Text style={styles.btnApproveText}>✅ Approve Entry</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btn, styles.btnReject, rejectMutation.isPending && styles.btnDisabled]}
            onPress={() => handleOpenRejectModal(item)}
            disabled={rejectMutation.isPending}
          >
            <Text style={styles.btnRejectText}>❌ Reject</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <HamburgerMenu title="Attendance Approvals" role="LIBRARY_ADMIN" items={LOCAL_ADMIN_MENU} />

      <View style={styles.headerInfo}>
        <Text style={styles.headerTitle}>QR Attendance Entry Requests</Text>
        <Text style={styles.headerSub}>
          Entry timestamps are locked to the exact second when the student scanned the QR code.
        </Text>
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color="#2563EB" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>🎉</Text>
              <Text style={styles.emptyTitle}>No Pending Attendance Requests</Text>
              <Text style={styles.emptySub}>All student QR scans have been processed.</Text>
            </View>
          }
        />
      )}

      {/* REJECTION REASON MODAL */}
      <Modal animationType="fade" transparent visible={rejectModalVisible} onRequestClose={() => setRejectModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Reject Attendance Request</Text>
            <Text style={styles.modalSub}>
              Please select or type a rejection reason to notify the student.
            </Text>

            <TextInput
              style={styles.reasonInput}
              placeholder="Type rejection reason..."
              placeholderTextColor="#94A3B8"
              value={rejectionReason}
              onChangeText={setRejectionReason}
              multiline
            />

            <View style={styles.quickReasonRow}>
              <TouchableOpacity
                style={styles.quickChip}
                onPress={() => setRejectionReason('Payment pending / Subscription expired.')}
              >
                <Text style={styles.quickChipText}>💳 Payment Pending</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickChip}
                onPress={() => setRejectionReason('Student identity verification failed.')}
              >
                <Text style={styles.quickChipText}>🪪 Identity Check</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnCancel]}
                onPress={() => setRejectModalVisible(false)}
              >
                <Text style={styles.modalBtnCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnConfirm]}
                onPress={handleConfirmReject}
                disabled={rejectMutation.isPending}
              >
                {rejectMutation.isPending ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalBtnConfirmText}>Reject Request</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  headerInfo: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  headerSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  listContent: {
    padding: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 2,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EFF6FF',
  },
  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#DBEAFE',
  },
  avatarInitial: {
    fontSize: 20,
    fontWeight: '800',
    color: '#2563EB',
  },
  studentName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  studentPhone: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  studentCardNo: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 1,
  },
  detailsDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  infoLabel: {
    fontSize: 13,
    color: '#64748B',
  },
  scanTimeText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#2563EB',
  },
  infoVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  badgeSuccess: {
    color: '#16A34A',
    backgroundColor: '#DCFCE7',
  },
  badgeWarning: {
    color: '#D97706',
    backgroundColor: '#FEF3C7',
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  btn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnApprove: {
    backgroundColor: '#16A34A',
  },
  btnApproveText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  btnReject: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  btnRejectText: {
    color: '#DC2626',
    fontWeight: '800',
    fontSize: 14,
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 60,
  },
  emptyIcon: {
    fontSize: 48,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 12,
  },
  emptySub: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalSub: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
    marginBottom: 14,
  },
  reasonInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: '#0F172A',
    height: 80,
    textAlignVertical: 'top',
  },
  quickReasonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  quickChip: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  quickChipText: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '600',
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalBtnCancel: {
    backgroundColor: '#F1F5F9',
  },
  modalBtnCancelText: {
    color: '#475569',
    fontWeight: '700',
  },
  modalBtnConfirm: {
    backgroundColor: '#DC2626',
  },
  modalBtnConfirmText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
});
