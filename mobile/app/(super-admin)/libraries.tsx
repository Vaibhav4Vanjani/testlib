import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Alert,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../src/services/api.client';
import { HamburgerMenu } from '../../src/components/HamburgerMenu';

const SUPER_ADMIN_MENU = [
  { label: 'Search Libraries', route: '/(super-admin)/libraries', icon: '🏛️', category: 'Library Operations' },
  { label: 'Onboard New Library', route: '/(super-admin)/onboard-library', icon: '➕', category: 'Library Operations' },
  { label: 'Local Admin Payments', route: '/(super-admin)/saas-payments', icon: '💳', category: 'Library Operations' },
  { label: 'Platform Revenue', route: '/(super-admin)/analytics', icon: '📈', category: 'SaaS Platform Analytics' },
  { label: 'Feature Entitlements', route: '/(super-admin)/feature-flags', icon: '⚡', category: 'SaaS Platform Analytics' },
];

export default function SuperAdminLibrariesScreen() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedLibrary, setSelectedLibrary] = useState<any | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Edit Mode State
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [editAdminName, setEditAdminName] = useState('');
  const [editAdminPhone, setEditAdminPhone] = useState('');
  const [editSaasPlanType, setEditSaasPlanType] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY');
  const [editSaasAmount, setEditSaasAmount] = useState('');
  const [savingDetails, setSavingDetails] = useState(false);

  const { data: libraries, isLoading } = useQuery({
    queryKey: ['super-admin-libraries-summary'],
    queryFn: async () => {
      const res = await apiRequest('/super-admin/libraries/summary');
      if (!res.success) throw new Error(res.error?.message || 'Failed to fetch summary');
      return res.data || [];
    },
    placeholderData: (previousData) => previousData,
  });

  const filteredLibraries = (libraries || []).filter((lib: any) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      lib.name?.toLowerCase().includes(q) ||
      lib.code?.toLowerCase().includes(q) ||
      lib.adminName?.toLowerCase().includes(q) ||
      lib.adminPhone?.includes(q)
    );
  });

  const handleOpenModal = (lib: any) => {
    setSelectedLibrary(lib);
    setIsEditingDetails(false);
    setEditAdminName(lib.adminName || '');
    setEditAdminPhone(lib.adminPhone || '');
    setEditSaasPlanType(lib.saasPlanType || 'MONTHLY');
    setEditSaasAmount(String(lib.saasAmount || (lib.saasPlanType === 'YEARLY' ? 12000 : 1200)));
    setModalVisible(true);
  };

  const handleToggleAdminStatus = async (lib: any) => {
    const nextStatus = !lib.adminIsActive;
    const actionText = nextStatus ? 'Reactivate' : 'Deactivate';
    const warningMessage = nextStatus
      ? `Reactivating Local Admin "${lib.adminName}" will restore login access for the admin and eligible students of ${lib.name}.`
      : `Deactivating Local Admin "${lib.adminName}" will IMMEDIATELY block login and API access for the admin and ALL students assigned to ${lib.name}.`;

    Alert.alert(
      `Confirm ${actionText} Local Admin`,
      warningMessage,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: `${actionText} Now`,
          style: nextStatus ? 'default' : 'destructive',
          onPress: async () => {
            setUpdatingStatus(true);
            try {
              const res = await apiRequest(`/super-admin/libraries/${lib.libraryId}/admin-status`, 'PATCH', {
                isActive: nextStatus,
              });

              if (res.success) {
                Alert.alert(
                  'Status Updated',
                  `Local Admin "${lib.adminName}" status set to ${nextStatus ? 'ACTIVE' : 'INACTIVE'}.`
                );
                setSelectedLibrary(null);
                setModalVisible(false);
                queryClient.invalidateQueries({ queryKey: ['super-admin-libraries-summary'] });
              } else {
                Alert.alert('Error', res.error?.message || 'Failed to update admin status.');
              }
            } catch (err: any) {
              Alert.alert('Error', err.message || 'An error occurred.');
            } finally {
              setUpdatingStatus(false);
            }
          },
        },
      ]
    );
  };

  const handleSaveDetails = async () => {
    if (!selectedLibrary) return;
    if (!editAdminName.trim() || !editAdminPhone.trim()) {
      Alert.alert('Validation Error', 'Please enter both Local Admin Name and Phone Number.');
      return;
    }

    const phoneRegex = /^\d{10}$/;
    if (!phoneRegex.test(editAdminPhone.trim())) {
      Alert.alert('Validation Error', 'Please enter a valid 10-digit Admin Phone Number.');
      return;
    }

    const parsedAmount = parseFloat(editSaasAmount);
    if (isNaN(parsedAmount) || parsedAmount < 0) {
      Alert.alert('Validation Error', 'Please enter a valid Subscription Amount.');
      return;
    }

    setSavingDetails(true);
    try {
      const res = await apiRequest(`/super-admin/libraries/${selectedLibrary.libraryId}/admin-details`, 'PATCH', {
        adminName: editAdminName.trim(),
        adminPhone: editAdminPhone.trim(),
        saasPlanType: editSaasPlanType,
        saasAmount: parsedAmount,
      });

      if (res.success) {
        Alert.alert('Details Saved! 🎉', 'Local Admin and SaaS plan details updated successfully.');
        setIsEditingDetails(false);
        setModalVisible(false);
        setSelectedLibrary(null);
        queryClient.invalidateQueries({ queryKey: ['super-admin-libraries-summary'] });
      } else {
        Alert.alert('Update Error', res.error?.message || 'Failed to update details.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'An unexpected error occurred.');
    } finally {
      setSavingDetails(false);
    }
  };

  if (isLoading && !libraries) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#F59E0B" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <HamburgerMenu title="Local Libraries Directory" role="SUPER_ADMIN" items={SUPER_ADMIN_MENU} />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Search Bar for Libraries */}
        <TextInput
          style={styles.searchInput}
          placeholder="🔍 Search library by name, code, admin phone..."
          placeholderTextColor="#64748B"
          value={search}
          onChangeText={setSearch}
        />

        {filteredLibraries.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No matching libraries found.</Text>
          </View>
        ) : (
          filteredLibraries.map((lib: any) => {
            const isActive = lib.adminIsActive !== false;
            const isOverdue = lib.saasPaymentStatus === 'OVERDUE_DEFAULTER';

            return (
              <View key={lib.libraryId} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.libName}>{lib.name} ({lib.code})</Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    {isOverdue && (
                      <View style={styles.overdueBadge}>
                        <Text style={styles.overdueBadgeText}>🔴 DEFAULTER</Text>
                      </View>
                    )}
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{lib.status}</Text>
                    </View>
                  </View>
                </View>

                {/* Clickable Local Admin Row */}
                <TouchableOpacity
                  style={[styles.adminBanner, isActive ? styles.adminBannerActive : styles.adminBannerInactive]}
                  onPress={() => handleOpenModal(lib)}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.adminTitleText}>👤 Local Admin Details (Tap for Info & Status)</Text>
                    <Text style={styles.adminContactText}>
                      {lib.adminName} • 📞 {lib.adminPhone}
                    </Text>
                  </View>
                  <View style={[styles.statusTag, isActive ? styles.bgActive : styles.bgInactive]}>
                    <Text style={[styles.statusTagText, isActive ? styles.textActive : styles.textInactive]}>
                      {isActive ? '🟢 ACTIVE' : '🔴 INACTIVE'}
                    </Text>
                  </View>
                </TouchableOpacity>

                <View style={styles.metricGrid}>
                  <View style={styles.metricBox}>
                    <Text style={styles.metricLabel}>Active Students</Text>
                    <Text style={styles.metricValue}>{lib.activeStudentCount} / {lib.totalStudentCount}</Text>
                  </View>
                  <View style={styles.metricBox}>
                    <Text style={styles.metricLabel}>Payments Received</Text>
                    <Text style={styles.greenValue}>₹{lib.paymentsReceived.toLocaleString()}</Text>
                  </View>
                  <View style={styles.metricBox}>
                    <Text style={styles.metricLabel}>Payments Pending</Text>
                    <Text style={styles.yellowValue}>₹{lib.paymentsPending.toLocaleString()}</Text>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* MODAL: LOCAL ADMIN DETAILS & SINGLE PLAN RECEIVABLES & EDIT MODE */}
      {selectedLibrary && (
        <Modal animationType="slide" transparent visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <ScrollView contentContainerStyle={styles.modalScrollContent} bounces={false}>
              <View style={styles.modalCard}>
                <View style={styles.modalHeaderRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalTitle}>Local Admin & Receivables</Text>
                    <Text style={styles.modalSubTitle}>{selectedLibrary.name} ({selectedLibrary.code})</Text>
                  </View>
                  {!isEditingDetails && (
                    <TouchableOpacity
                      style={styles.editBtn}
                      onPress={() => setIsEditingDetails(true)}
                    >
                      <Text style={styles.editBtnText}>✏️ Edit</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {isEditingDetails ? (
                  /* EDIT MODE FORM */
                  <View style={styles.editFormContainer}>
                    <Text style={styles.editHeaderLabel}>📝 EDIT LOCAL ADMIN & PLAN DETAILS</Text>

                    <Text style={styles.inputLabel}>Local Admin Name *</Text>
                    <TextInput
                      style={styles.editInput}
                      value={editAdminName}
                      onChangeText={setEditAdminName}
                      placeholder="e.g. Vikram Singh"
                      placeholderTextColor="#64748B"
                    />

                    <Text style={styles.inputLabel}>Phone Number *</Text>
                    <TextInput
                      style={styles.editInput}
                      value={editAdminPhone}
                      onChangeText={setEditAdminPhone}
                      keyboardType="phone-pad"
                      placeholder="e.g. 9876543210"
                      placeholderTextColor="#64748B"
                    />

                    <Text style={styles.inputLabel}>SaaS Plan Type *</Text>
                    <View style={styles.planRadioRow}>
                      <TouchableOpacity
                        style={[styles.planRadioPill, editSaasPlanType === 'MONTHLY' && styles.planRadioPillActive]}
                        onPress={() => {
                          setEditSaasPlanType('MONTHLY');
                          if (!editSaasAmount || editSaasAmount === '12000') setEditSaasAmount('1200');
                        }}
                      >
                        <Text style={[styles.planRadioText, editSaasPlanType === 'MONTHLY' && styles.planRadioTextActive]}>
                          📅 Monthly Plan
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.planRadioPill, editSaasPlanType === 'YEARLY' && styles.planRadioPillActive]}
                        onPress={() => {
                          setEditSaasPlanType('YEARLY');
                          if (!editSaasAmount || editSaasAmount === '1200') setEditSaasAmount('12000');
                        }}
                      >
                        <Text style={[styles.planRadioText, editSaasPlanType === 'YEARLY' && styles.planRadioTextActive]}>
                          🌟 Yearly Plan
                        </Text>
                      </TouchableOpacity>
                    </View>

                    <Text style={styles.inputLabel}>Subscription Amount (₹) *</Text>
                    <TextInput
                      style={styles.editInput}
                      value={editSaasAmount}
                      onChangeText={setEditSaasAmount}
                      keyboardType="numeric"
                      placeholder="e.g. 1200"
                      placeholderTextColor="#64748B"
                    />

                    <TouchableOpacity
                      style={[styles.saveBtn, savingDetails && styles.btnDisabled]}
                      onPress={handleSaveDetails}
                      disabled={savingDetails}
                    >
                      {savingDetails ? (
                        <ActivityIndicator color="#FFF" />
                      ) : (
                        <Text style={styles.saveBtnText}>💾 Save Changes</Text>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.cancelEditBtn}
                      onPress={() => setIsEditingDetails(false)}
                      disabled={savingDetails}
                    >
                      <Text style={styles.cancelEditText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  /* READ-ONLY VIEW MODE */
                  <>
                    {/* Admin Info Card */}
                    <View style={styles.infoBlock}>
                      <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Local Admin Name:</Text>
                        <Text style={styles.infoVal}>{selectedLibrary.adminName}</Text>
                      </View>
                      <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Phone Number:</Text>
                        <Text style={styles.infoVal}>📞 {selectedLibrary.adminPhone}</Text>
                      </View>
                      <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Admin Account Status:</Text>
                        <View style={[styles.statusTag, selectedLibrary.adminIsActive ? styles.bgActive : styles.bgInactive]}>
                          <Text style={[styles.statusTagText, selectedLibrary.adminIsActive ? styles.textActive : styles.textInactive]}>
                            {selectedLibrary.adminIsActive ? '🟢 ACTIVE' : '🔴 INACTIVE'}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* SINGLE ACTIVE PLAN RECEIVABLE BOX */}
                    <Text style={styles.sectionHeaderLabel}>💰 RECEIVABLE BY SUPER ADMIN</Text>
                    <View style={styles.singleReceivablesBox}>
                      <View style={styles.planHeaderTag}>
                        <Text style={styles.planHeaderTagText}>
                          {selectedLibrary.saasPlanType === 'YEARLY' ? '🌟 YEARLY PLAN' : '📅 MONTHLY PLAN'}
                        </Text>
                      </View>
                      <Text style={styles.singleReceivableLabel}>
                        {selectedLibrary.saasPlanType === 'YEARLY' ? 'Yearly Amount Receivable' : 'Monthly Amount Receivable'}
                      </Text>
                      <Text style={styles.singleReceivableVal}>
                        ₹{(selectedLibrary.saasAmount || (selectedLibrary.saasPlanType === 'YEARLY' ? 12000 : 1200)).toLocaleString()}
                      </Text>
                      <Text style={styles.singleReceivableSub}>
                        {selectedLibrary.saasPlanType === 'YEARLY' ? 'per year' : 'per month'}
                      </Text>
                    </View>

                    {/* Account Status Warning Note */}
                    <View style={[styles.noteBox, selectedLibrary.adminIsActive ? styles.noteActive : styles.noteInactive]}>
                      <Text style={styles.noteText}>
                        {selectedLibrary.adminIsActive
                          ? '🟢 Active Status: Local Admin and library students can log in and access all features.'
                          : '🔴 Inactive Status: Local Admin and ALL students assigned to this library are BLOCKED from logging in.'}
                      </Text>
                    </View>

                    {/* Status Toggle Action Button */}
                    <TouchableOpacity
                      style={[
                        styles.toggleBtn,
                        selectedLibrary.adminIsActive ? styles.toggleBtnDeactivate : styles.toggleBtnReactivate,
                        updatingStatus && styles.btnDisabled,
                      ]}
                      onPress={() => handleToggleAdminStatus(selectedLibrary)}
                      disabled={updatingStatus}
                    >
                      {updatingStatus ? (
                        <ActivityIndicator color="#FFF" />
                      ) : (
                        <Text style={styles.toggleBtnText}>
                          {selectedLibrary.adminIsActive ? '🚫 Set Status to INACTIVE' : '🟢 Set Status to ACTIVE'}
                        </Text>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.closeBtn} onPress={() => setModalVisible(false)}>
                      <Text style={styles.closeText}>Close</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </ScrollView>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 16 },
  loadingContainer: { flex: 1, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center' },
  searchInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#0F172A',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    marginBottom: 16,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyText: { color: '#64748B' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#64748B', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  libName: { color: '#0F172A', fontSize: 17, fontWeight: '800' },
  badge: { backgroundColor: '#DCFCE7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, alignSelf: 'flex-start' },
  badgeText: { color: '#15803D', fontWeight: '800', fontSize: 11 },
  adminBanner: { borderRadius: 10, padding: 12, marginBottom: 12, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  adminBannerActive: { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' },
  adminBannerInactive: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  adminTitleText: { fontSize: 10, fontWeight: '800', color: '#64748B', textTransform: 'uppercase', marginBottom: 2 },
  adminContactText: { fontSize: 13, color: '#0F172A', fontWeight: '700' },
  statusTag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  bgActive: { backgroundColor: '#DCFCE7' },
  bgInactive: { backgroundColor: '#FEE2E2' },
  statusTagText: { fontSize: 11, fontWeight: '900' },
  textActive: { color: '#15803D' },
  textInactive: { color: '#DC2626' },
  metricGrid: { flexDirection: 'row', gap: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  metricBox: { flex: 1, backgroundColor: '#F8FAFC', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  metricLabel: { color: '#64748B', fontSize: 11, fontWeight: '700' },
  metricValue: { color: '#0F172A', fontSize: 14, fontWeight: '800', marginTop: 4 },
  greenValue: { color: '#16A34A', fontSize: 14, fontWeight: '800', marginTop: 4 },
  yellowValue: { color: '#D97706', fontSize: 14, fontWeight: '800', marginTop: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)' },
  modalScrollContent: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#E2E8F0' },
  modalHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  modalTitle: { color: '#0F172A', fontSize: 18, fontWeight: '800' },
  modalSubTitle: { color: '#64748B', fontSize: 13, marginTop: 2 },
  editBtn: { backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  editBtnText: { color: '#2563EB', fontWeight: '800', fontSize: 12 },
  infoBlock: { backgroundColor: '#F8FAFC', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 14 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  infoLabel: { fontSize: 13, color: '#64748B', fontWeight: '600' },
  infoVal: { fontSize: 13, color: '#0F172A', fontWeight: '800' },
  sectionHeaderLabel: { fontSize: 11, fontWeight: '800', color: '#475569', textTransform: 'uppercase', marginBottom: 8, letterSpacing: 0.5 },
  singleReceivablesBox: { backgroundColor: '#EFF6FF', borderRadius: 14, padding: 16, borderWidth: 1.5, borderColor: '#BFDBFE', alignItems: 'center', marginBottom: 14 },
  planHeaderTag: { backgroundColor: '#DBEAFE', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, marginBottom: 8 },
  planHeaderTagText: { fontSize: 11, fontWeight: '900', color: '#1E40AF' },
  singleReceivableLabel: { fontSize: 12, fontWeight: '700', color: '#1E40AF', textAlign: 'center' },
  singleReceivableVal: { fontSize: 26, fontWeight: '900', color: '#1D4ED8', marginTop: 4 },
  singleReceivableSub: { fontSize: 11, color: '#3B82F6', marginTop: 2, fontWeight: '600' },
  noteBox: { padding: 10, borderRadius: 8, borderWidth: 1, marginBottom: 14 },
  noteActive: { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' },
  noteInactive: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  noteText: { fontSize: 11, fontWeight: '700', color: '#334155', lineHeight: 16 },
  toggleBtn: { paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginBottom: 10 },
  toggleBtnDeactivate: { backgroundColor: '#DC2626' },
  toggleBtnReactivate: { backgroundColor: '#16A34A' },
  toggleBtnText: { color: '#FFFFFF', fontWeight: '900', fontSize: 14 },
  btnDisabled: { opacity: 0.6 },
  closeBtn: { paddingVertical: 10, alignItems: 'center' },
  closeText: { color: '#64748B', fontWeight: '700', fontSize: 13 },
  overdueBadge: { backgroundColor: '#FEE2E2', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: '#FCA5A5' },
  overdueBadgeText: { color: '#991B1B', fontWeight: '900', fontSize: 10 },
  editFormContainer: { backgroundColor: '#F8FAFC', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#CBD5E1', marginVertical: 4 },
  editHeaderLabel: { fontSize: 11, fontWeight: '900', color: '#2563EB', marginBottom: 12 },
  inputLabel: { fontSize: 12, fontWeight: '700', color: '#334155', marginBottom: 4 },
  editInput: { backgroundColor: '#FFFFFF', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, color: '#0F172A', fontSize: 14, borderWidth: 1, borderColor: '#CBD5E1', marginBottom: 12 },
  planRadioRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  planRadioPill: { flex: 1, backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#CBD5E1', paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  planRadioPillActive: { backgroundColor: '#EFF6FF', borderColor: '#2563EB' },
  planRadioText: { fontSize: 12, fontWeight: '800', color: '#64748B' },
  planRadioTextActive: { color: '#1E40AF' },
  saveBtn: { backgroundColor: '#2563EB', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 4, marginBottom: 8 },
  saveBtnText: { color: '#FFFFFF', fontWeight: '900', fontSize: 14 },
  cancelEditBtn: { paddingVertical: 8, alignItems: 'center' },
  cancelEditText: { color: '#64748B', fontWeight: '700', fontSize: 13 },
});
