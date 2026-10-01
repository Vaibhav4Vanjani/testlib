import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { apiRequest } from '../../src/services/api.client';
import { getFullImageUrl } from '../../src/constants/config';
import { HamburgerMenu } from '../../src/components/HamburgerMenu';
import { LOCAL_ADMIN_MENU } from '../../src/constants/menuItems';

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

export default function PaySaaSScreen() {
  const queryClient = useQueryClient();
  const [paymentMethod, setPaymentMethod] = useState<'UPI' | 'BANK_TRANSFER' | 'CASH'>('UPI');
  const [transactionRef, setTransactionRef] = useState('');
  const [proofImage, setProofImage] = useState<string | null>(null);
  const [viewingImageUri, setViewingImageUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { data: saasData, isLoading, refetch } = useQuery({
    queryKey: ['admin-saas-payment'],
    queryFn: async () => {
      const res = await apiRequest('/admin/saas-payment');
      if (!res.success) throw new Error(res.error?.message || 'Failed to fetch SaaS payment details');
      return res.data;
    },
  });

  const pickImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Denied', 'Permission to access media library is required to upload proof screenshot.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        setProofImage(result.assets[0].uri);
      }
    } catch (err: any) {
      Alert.alert('Image Pick Error', err.message || 'Failed to pick image');
    }
  };

  const handleSubmitPayment = async () => {
    if (!transactionRef.trim() && !proofImage) {
      Alert.alert('Validation Error', 'Please provide either a Transaction Ref / UTR number or upload a Payment Proof Screenshot.');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('amount', String(saasData?.saasAmount || 1200));
      formData.append('paymentMethod', paymentMethod);
      if (transactionRef.trim()) {
        formData.append('transactionRef', transactionRef.trim());
      }

      if (proofImage) {
        const filename = proofImage.split('/').pop() || 'proof.jpg';
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : 'image/jpeg';
        formData.append('proofImage', {
          uri: proofImage,
          name: filename,
          type,
        } as any);
      }

      const res = await apiRequest('/admin/saas-payment', 'POST', formData);

      if (res.success) {
        Alert.alert('Payment Submitted! 🎉', 'Your payment proof has been submitted to Super Admin for review.');
        setTransactionRef('');
        setProofImage(null);
        queryClient.invalidateQueries({ queryKey: ['admin-saas-payment'] });
        refetch();
      } else {
        Alert.alert('Submission Error', res.error?.message || 'Failed to submit payment.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'An unexpected error occurred.');
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366F1" />
        </View>
      </SafeAreaView>
    );
  }

  const status = saasData?.saasPaymentStatus || 'UP_TO_DATE';
  const isOverdue = status === 'OVERDUE_DEFAULTER';
  const isPending = status === 'PENDING_APPROVAL';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <HamburgerMenu title="App Service Payment" role="LIBRARY_ADMIN" items={LOCAL_ADMIN_MENU} />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* OVERDUE / DEFAULTER BANNER */}
        {isOverdue && (
          <View style={styles.overdueBanner}>
            <Text style={styles.overdueTitle}>⚠️ APP SUBSCRIPTION PAYMENT OVERDUE</Text>
            <Text style={styles.overdueText}>
              Your subscription payment of ₹{(saasData?.saasAmount || 1200).toLocaleString()} was due on{' '}
              {formatDateDDMonthYYYY(saasData?.saasNextDueDate)}. Please submit payment proof immediately to avoid service interruption.
            </Text>
          </View>
        )}

        {/* SUBSCRIPTION STATUS CARD */}
        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{saasData?.libraryName} ({saasData?.libraryCode})</Text>
              <Text style={styles.planSub}>
                Plan: <Text style={{ fontWeight: '800', color: '#1E40AF' }}>{saasData?.saasPlanType || 'MONTHLY'}</Text> • ₹
                {(saasData?.saasAmount || 1200).toLocaleString()}
              </Text>
            </View>
            <View
              style={[
                styles.statusBadge,
                isOverdue ? styles.bgOverdue : isPending ? styles.bgPending : styles.bgUpToDate,
              ]}
            >
              <Text
                style={[
                  styles.statusBadgeText,
                  isOverdue ? styles.textOverdue : isPending ? styles.textPending : styles.textUpToDate,
                ]}
              >
                {isOverdue ? '🔴 PAYMENT OVERDUE' : isPending ? '⏳ PENDING APPROVAL' : '🟢 UP TO DATE'}
              </Text>
            </View>
          </View>

          <View style={styles.dueDateRow}>
            <Text style={styles.dueDateLabel}>Next Payment Due Date:</Text>
            <Text style={styles.dueDateVal}>{formatDateDDMonthYYYY(saasData?.saasNextDueDate)}</Text>
          </View>
        </View>

        {/* PAYMENT SUBMISSION FORM */}
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>💳 Submit Payment Proof to Super Admin</Text>

          <Text style={styles.label}>Payable Amount (₹)</Text>
          <View style={styles.amountBox}>
            <Text style={styles.amountVal}>₹{(saasData?.saasAmount || 1200).toLocaleString()}</Text>
          </View>

          <Text style={styles.label}>Payment Method *</Text>
          <View style={styles.methodRow}>
            {(['UPI', 'BANK_TRANSFER', 'CASH'] as const).map((method) => (
              <TouchableOpacity
                key={method}
                style={[styles.methodPill, paymentMethod === method && styles.methodPillActive]}
                onPress={() => setPaymentMethod(method)}
              >
                <Text style={[styles.methodText, paymentMethod === method && styles.methodTextActive]}>
                  {method === 'UPI' ? '📲 UPI / QR' : method === 'BANK_TRANSFER' ? '🏛️ Bank' : '💵 Cash'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Transaction Reference / UTR Number</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. UPI1234567890 / UTR-98765"
            placeholderTextColor="#64748B"
            value={transactionRef}
            onChangeText={setTransactionRef}
          />

          <Text style={styles.label}>Payment Screenshot / Proof Image</Text>
          <TouchableOpacity style={styles.uploadBtn} onPress={pickImage}>
            <Text style={styles.uploadBtnText}>
              {proofImage ? '📷 Change Screenshot' : '📷 Upload Screenshot / Receipt'}
            </Text>
          </TouchableOpacity>

          {proofImage ? (
            <View style={styles.previewContainer}>
              <Image source={{ uri: proofImage }} style={styles.previewImage} resizeMode="contain" />
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                <TouchableOpacity
                  style={[styles.removeImgBtn, { backgroundColor: '#2563EB', flex: 1 }]}
                  onPress={() => setViewingImageUri(proofImage)}
                >
                  <Text style={[styles.removeImgText, { color: '#FFFFFF' }]}>View</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.removeImgBtn, { backgroundColor: '#EF4444', flex: 1 }]}
                  onPress={() => setProofImage(null)}
                >
                  <Text style={[styles.removeImgText, { color: '#FFFFFF' }]}>Reset</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.submitBtn, submitting && styles.btnDisabled]}
            onPress={handleSubmitPayment}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitBtnText}>Submit Payment for Approval</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* PAYMENT HISTORY */}
        <Text style={styles.historySectionTitle}>📜 SaaS Payment History</Text>
        {(!saasData?.paymentHistory || saasData.paymentHistory.length === 0) ? (
          <View style={styles.emptyHistoryCard}>
            <Text style={styles.emptyHistoryText}>No past SaaS payments recorded.</Text>
          </View>
        ) : (
          saasData.paymentHistory.map((item: any) => (
            <View key={item._id} style={styles.historyCard}>
              <View style={styles.historyHeader}>
                <View>
                  <Text style={styles.historyAmount}>₹{item.amount.toLocaleString()} ({item.planType})</Text>
                  <Text style={styles.historyDate}>Submitted: {formatDateDDMonthYYYY(item.submittedAt)}</Text>
                </View>
                <View
                  style={[
                    styles.historyBadge,
                    item.status === 'APPROVED'
                      ? styles.bgUpToDate
                      : item.status === 'REJECTED'
                        ? styles.bgOverdue
                        : styles.bgPending,
                  ]}
                >
                  <Text
                    style={[
                      styles.historyBadgeText,
                      item.status === 'APPROVED'
                        ? styles.textUpToDate
                        : item.status === 'REJECTED'
                          ? styles.textOverdue
                          : styles.textPending,
                    ]}
                  >
                    {item.status}
                  </Text>
                </View>
              </View>

              {item.transactionRef ? (
                <Text style={styles.historyMeta}>Ref: <Text style={{ fontWeight: '700' }}>{item.transactionRef}</Text></Text>
              ) : null}

              {item.proofImage ? (
                <View style={{ marginTop: 6 }}>
                  <Image source={{ uri: getFullImageUrl(item.proofImage)! }} style={{ width: 80, height: 80, borderRadius: 8, borderWidth: 1, borderColor: '#CBD5E1' }} resizeMode="cover" />
                </View>
              ) : null}

              {item.rejectionReason ? (
                <View style={styles.rejectionBox}>
                  <Text style={styles.rejectionText}>Reason for Rejection: {item.rejectionReason}</Text>
                </View>
              ) : null}
            </View>
          ))
        )}
      </ScrollView>

      {/* VIEW-ONLY FULL IMAGE PREVIEW MODAL */}
      <Modal animationType="fade" transparent visible={!!viewingImageUri} onRequestClose={() => setViewingImageUri(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.92)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <View style={{ width: '100%', maxHeight: '85%', backgroundColor: '#0F172A', borderRadius: 16, overflow: 'hidden', padding: 16, borderWidth: 1, borderColor: '#334155' }}>
            {viewingImageUri ? (
              <Image source={{ uri: viewingImageUri }} style={{ width: '100%', height: 380, backgroundColor: '#020617', borderRadius: 8 }} resizeMode="contain" />
            ) : null}
            <TouchableOpacity
              style={{ backgroundColor: '#EF4444', paddingVertical: 12, borderRadius: 10, marginTop: 16, alignItems: 'center' }}
              onPress={() => setViewingImageUri(null)}
            >
              <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 15 }}>Close</Text>
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
  content: { padding: 16, paddingBottom: 40 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#0F172A' },
  subTitle: { fontSize: 13, color: '#64748B', marginTop: 4, marginBottom: 16 },
  overdueBanner: { backgroundColor: '#FEF2F2', borderWidth: 1.5, borderColor: '#FCA5A5', borderRadius: 12, padding: 14, marginBottom: 16 },
  overdueTitle: { fontSize: 13, fontWeight: '900', color: '#991B1B', marginBottom: 4 },
  overdueText: { fontSize: 12, color: '#7F1D1D', lineHeight: 17, fontWeight: '600' },
  statusCard: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 16, elevation: 2 },
  statusHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 8 },
  cardTitle: { fontSize: 17, fontWeight: '800', color: '#0F172A' },
  planSub: { fontSize: 13, color: '#475569', marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  statusBadgeText: { fontSize: 11, fontWeight: '900' },
  bgUpToDate: { backgroundColor: '#DCFCE7' },
  textUpToDate: { color: '#15803D' },
  bgPending: { backgroundColor: '#FEF3C7' },
  textPending: { color: '#B45309' },
  bgOverdue: { backgroundColor: '#FEE2E2' },
  textOverdue: { color: '#B91C1C' },
  dueDateRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  dueDateLabel: { fontSize: 13, color: '#64748B', fontWeight: '600' },
  dueDateVal: { fontSize: 14, color: '#1E3A8A', fontWeight: '800' },
  formCard: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 20 },
  formTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A', marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 6 },
  amountBox: { backgroundColor: '#F1F5F9', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: '#CBD5E1', marginBottom: 14 },
  amountVal: { fontSize: 18, fontWeight: '900', color: '#0F172A' },
  methodRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  methodPill: { flex: 1, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#CBD5E1', paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  methodPillActive: { backgroundColor: '#EFF6FF', borderColor: '#2563EB' },
  methodText: { fontSize: 12, fontWeight: '700', color: '#64748B' },
  methodTextActive: { color: '#1E40AF', fontWeight: '800' },
  input: { backgroundColor: '#F8FAFC', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, color: '#0F172A', fontSize: 14, borderWidth: 1, borderColor: '#CBD5E1', marginBottom: 14 },
  uploadBtn: { backgroundColor: '#EFF6FF', borderWidth: 1.5, borderColor: '#BFDBFE', paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginBottom: 10 },
  uploadBtnText: { color: '#2563EB', fontWeight: '800', fontSize: 13 },
  previewContainer: { marginBottom: 14, alignItems: 'center' },
  previewImage: { width: '100%', height: 160, borderRadius: 10, borderWidth: 1, borderColor: '#CBD5E1' },
  removeImgBtn: { marginTop: 6, backgroundColor: '#FEE2E2', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 6 },
  removeImgText: { color: '#991B1B', fontWeight: '800', fontSize: 12 },
  submitBtn: { backgroundColor: '#2563EB', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  btnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#FFFFFF', fontWeight: '900', fontSize: 14 },
  historySectionTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A', marginBottom: 10 },
  emptyHistoryCard: { backgroundColor: '#FFFFFF', padding: 20, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center' },
  emptyHistoryText: { color: '#64748B', fontSize: 13 },
  historyCard: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 10 },
  historyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  historyAmount: { fontSize: 14, fontWeight: '800', color: '#0F172A' },
  historyDate: { fontSize: 11, color: '#64748B', marginTop: 2 },
  historyBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  historyBadgeText: { fontSize: 10, fontWeight: '800' },
  historyMeta: { fontSize: 12, color: '#475569', marginTop: 2 },
  rejectionBox: { backgroundColor: '#FEF2F2', padding: 8, borderRadius: 6, marginTop: 6 },
  rejectionText: { color: '#991B1B', fontSize: 11, fontWeight: '700' },
});
