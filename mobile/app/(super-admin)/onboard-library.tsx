import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../src/services/api.client';
import { HamburgerMenu } from '../../src/components/HamburgerMenu';
import * as Clipboard from 'expo-clipboard';

const SUPER_ADMIN_MENU = [
  { label: 'Search Libraries', route: '/(super-admin)/libraries', icon: '🏛️', category: 'Library Operations' },
  { label: 'Onboard New Library', route: '/(super-admin)/onboard-library', icon: '➕', category: 'Library Operations' },
  { label: 'Platform Revenue', route: '/(super-admin)/analytics', icon: '📈', category: 'SaaS Platform Analytics' },
  { label: 'Feature Entitlements', route: '/(super-admin)/feature-flags', icon: '⚡', category: 'SaaS Platform Analytics' },
];

export default function OnboardLibraryScreen() {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [address, setAddress] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminPhone, setAdminPhone] = useState('');
  const [adminPassword, setAdminPassword] = useState('123456');

  // SaaS Billing Plan State
  const [saasPlanType, setSaasPlanType] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY');
  const [saasAmount, setSaasAmount] = useState('1200');

  const [loadingNextCode, setLoadingNextCode] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Success Modal & Credentials State
  const [onboardedResult, setOnboardedResult] = useState<{
    libraryName: string;
    libraryCode: string;
    address?: string;
    contactPhone?: string;
    adminName: string;
    phone: string;
    email: string;
    password: string;
  } | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [copiedState, setCopiedState] = useState<'NONE' | 'ALL' | 'PHONE' | 'EMAIL' | 'PASSWORD'>('NONE');

  // Fetch Auto-generated Next Library Code (preserves custom prefix if entered)
  const fetchNextCode = async (customPrefix = '') => {
    setLoadingNextCode(true);
    try {
      const targetPrefix = customPrefix || code.trim() || 'LIB';
      const res = await apiRequest(`/super-admin/next-code?prefix=${encodeURIComponent(targetPrefix)}`);
      if (res.success && res.data?.nextCode) {
        setCode(res.data.nextCode);
      }
    } catch (e) {
      console.log('Failed to fetch next library code:', e);
    } finally {
      setLoadingNextCode(false);
    }
  };

  useEffect(() => {
    fetchNextCode('LIB');
  }, []);

  const copyToClipboard = async (text: string): Promise<boolean> => {
    try {
      if (Clipboard && typeof Clipboard.setStringAsync === 'function') {
        await Clipboard.setStringAsync(text);
        return true;
      }
    } catch (err) {
      console.log('Clipboard.setStringAsync error:', err);
    }

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (err) {
      console.log('navigator.clipboard error:', err);
    }

    try {
      if (typeof document !== 'undefined') {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        if (successful) return true;
      }
    } catch (err) {
      console.log('execCommand copy error:', err);
    }

    return false;
  };

  const handleCopyAction = async (target: 'ALL' | 'PHONE' | 'EMAIL' | 'PASSWORD', text: string) => {
    const success = await copyToClipboard(text);
    setCopiedState(target);
    setTimeout(() => {
      setCopiedState('NONE');
    }, 2500);

    if (!success) {
      Alert.alert('Credentials', text);
    }
  };

  const handleOnboard = async () => {
    if (!name.trim() || !adminName.trim() || !adminPhone.trim()) {
      Alert.alert('Validation Error', 'Please fill in Library Name, Admin Name, and Admin Phone.');
      return;
    }

    const phoneRegex = /^\d{10}$/;
    if (!phoneRegex.test(adminPhone.trim())) {
      Alert.alert('Validation Error', 'Please enter a valid 10-digit Admin Phone Number.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiRequest(
        '/super-admin/libraries',
        'POST',
        {
          name: name.trim(),
          code: code.trim() ? code.trim().toUpperCase() : undefined,
          address: address.trim() || undefined,
          contactPhone: contactPhone.trim() || undefined,
          adminName: adminName.trim(),
          adminPhone: adminPhone.trim(),
          adminPassword: adminPassword.trim() || undefined,
          saasPlanType,
          saasAmount: parseFloat(saasAmount) || (saasPlanType === 'YEARLY' ? 12000 : 1200),
        },
        30000
      );

      if (res.success && res.data) {
        const creds = res.data.credentials;
        if (creds) {
          setOnboardedResult({
            libraryName: creds.libraryName,
            libraryCode: creds.libraryCode,
            address: creds.address,
            contactPhone: creds.contactPhone,
            adminName: creds.adminName,
            phone: creds.phone,
            email: creds.email,
            password: creds.password,
          });
          setShowSuccessModal(true);
        } else {
          Alert.alert('Library Onboarded! 🎉', `Library '${name}' created successfully.`);
        }

        setName('');
        setCode('');
        setAddress('');
        setContactPhone('');
        setAdminName('');
        setAdminPhone('');
        setAdminPassword('123456');
        setSaasPlanType('MONTHLY');
        setSaasAmount('1200');
        queryClient.invalidateQueries({ queryKey: ['super-admin-libraries-summary'] });
        fetchNextCode('LIB');
      } else {
        Alert.alert('Onboarding Error', res.error?.message || 'Failed to onboard library.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'An unexpected error occurred during onboarding.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <HamburgerMenu title="Onboard New Library" role="SUPER_ADMIN" items={SUPER_ADMIN_MENU} />

      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.headerTitle}>Onboard Library Tenant</Text>
          <Text style={styles.subTitle}>Create a new local library and assign its Local Library Admin</Text>

          <View style={styles.card}>
            <Text style={styles.sectionTag}>LIBRARY DETAILS</Text>

            <Text style={styles.label}>Library Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Apex Reading Room"
              placeholderTextColor="#64748B"
              value={name}
              onChangeText={setName}
            />

            <View style={styles.labelRow}>
              <Text style={styles.label}>Library Unique Code *</Text>
              <TouchableOpacity
                style={styles.autoGenBtn}
                onPress={() => fetchNextCode(code)}
                disabled={loadingNextCode}
              >
                <Text style={styles.autoGenBtnText}>
                  {loadingNextCode ? 'Generating...' : '⚡ Auto-Generate'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.codeContainer}>
              <TextInput
                style={[styles.input, styles.codeInput]}
                placeholder="e.g. LIB-001"
                placeholderTextColor="#64748B"
                value={code}
                onChangeText={setCode}
                autoCapitalize="characters"
              />
            </View>

            <Text style={styles.label}>Address</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Main Street, Sector 12"
              placeholderTextColor="#64748B"
              value={address}
              onChangeText={setAddress}
            />

            <Text style={styles.label}>Library Contact Phone</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 9876543210"
              placeholderTextColor="#64748B"
              keyboardType="phone-pad"
              value={contactPhone}
              onChangeText={setContactPhone}
            />

            <Text style={styles.sectionTag}>LOCAL LIBRARY ADMIN CREATION</Text>

            <Text style={styles.label}>Admin Full Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Vikram Singh"
              placeholderTextColor="#64748B"
              value={adminName}
              onChangeText={setAdminName}
            />

            <Text style={styles.label}>Admin Phone Number *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 9123456789"
              placeholderTextColor="#64748B"
              keyboardType="phone-pad"
              value={adminPhone}
              onChangeText={setAdminPhone}
            />

            <Text style={styles.label}>Admin Initial Password</Text>
            <TextInput
              style={styles.input}
              value={adminPassword}
              onChangeText={setAdminPassword}
              secureTextEntry
            />

            <Text style={styles.sectionTag}>SAAS SUBSCRIPTION BILLING PLAN</Text>

            <Text style={styles.label}>Subscription Plan Type *</Text>
            <View style={styles.planRadioRow}>
              <TouchableOpacity
                style={[styles.planRadioPill, saasPlanType === 'MONTHLY' && styles.planRadioPillActive]}
                onPress={() => {
                  setSaasPlanType('MONTHLY');
                  if (!saasAmount || saasAmount === '12000') setSaasAmount('1200');
                }}
              >
                <Text style={[styles.planRadioText, saasPlanType === 'MONTHLY' && styles.planRadioTextActive]}>
                  📅 Monthly Plan
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.planRadioPill, saasPlanType === 'YEARLY' && styles.planRadioPillActive]}
                onPress={() => {
                  setSaasPlanType('YEARLY');
                  if (!saasAmount || saasAmount === '1200') setSaasAmount('12000');
                }}
              >
                <Text style={[styles.planRadioText, saasPlanType === 'YEARLY' && styles.planRadioTextActive]}>
                  🌟 Yearly Plan
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Subscription Amount Payable to Super Admin (₹) *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 1200"
              placeholderTextColor="#64748B"
              keyboardType="numeric"
              value={saasAmount}
              onChangeText={setSaasAmount}
            />
            <Text style={styles.helperText}>
              {saasPlanType === 'MONTHLY'
                ? '⚡ First payment is due on onboarding date. Next payment due on onboarding date + 1 month.'
                : '⚡ First payment is due on onboarding date. Next payment due on onboarding date + 1 year.'}
            </Text>

            <TouchableOpacity
              style={[styles.submitBtn, submitting && styles.btnDisabled]}
              onPress={handleOnboard}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitText}>Create Library Tenant & Admin</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* --- SUCCESS ONBOARDING CREDENTIALS MODAL --- */}
      <Modal visible={showSuccessModal} transparent animationType="fade" statusBarTranslucent>
        <ScrollView
          style={styles.modalOverlay}
          contentContainerStyle={styles.modalScrollContent}
          bounces={false}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.credentialsCard}>
            <Text style={styles.credTitle}>🎉 Library Tenant Onboarded!</Text>
            <Text style={styles.credSub}>New library and Local Admin account successfully created:</Text>

            {onboardedResult && (
              <View style={styles.credDetailsBox}>
                {/* Library Summary */}
                <View style={styles.libSummaryHeader}>
                  <Text style={styles.libNameText}>{onboardedResult.libraryName}</Text>
                  <View style={styles.codeBadge}>
                    <Text style={styles.codeBadgeText}>CODE: {onboardedResult.libraryCode}</Text>
                  </View>
                </View>

                {onboardedResult.address ? (
                  <Text style={styles.libMetaText}>📍 {onboardedResult.address}</Text>
                ) : null}
                {onboardedResult.contactPhone ? (
                  <Text style={styles.libMetaText}>📞 Contact: {onboardedResult.contactPhone}</Text>
                ) : null}

                <View style={styles.divider} />

                {/* Local Admin Details */}
                <Text style={styles.adminHeaderLabel}>👔 LOCAL LIBRARY ADMIN CREDENTIALS</Text>
                <Text style={styles.credAdminName}>{onboardedResult.adminName}</Text>

                {/* Phone Row */}
                <View style={styles.credRow}>
                  <View style={styles.credRowHeader}>
                    <Text style={styles.credLabel}>📱 REGISTERED PHONE:</Text>
                    <TouchableOpacity
                      style={[styles.smallCopyBtn, copiedState === 'PHONE' && styles.smallCopyBtnSuccess]}
                      onPress={() => handleCopyAction('PHONE', onboardedResult.phone)}
                    >
                      <Text style={[styles.smallCopyBtnText, copiedState === 'PHONE' && styles.smallCopyBtnTextSuccess]}>
                        {copiedState === 'PHONE' ? 'Copied! ✅' : 'Copy'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.valueBox}>
                    <Text style={styles.credPhoneVal} selectable>{onboardedResult.phone}</Text>
                  </View>
                </View>

                {/* Email Row */}
                <View style={styles.credRow}>
                  <View style={styles.credRowHeader}>
                    <Text style={styles.credLabel}>📧 LOGIN EMAIL:</Text>
                    <TouchableOpacity
                      style={[styles.smallCopyBtn, copiedState === 'EMAIL' && styles.smallCopyBtnSuccess]}
                      onPress={() => handleCopyAction('EMAIL', onboardedResult.email)}
                    >
                      <Text style={[styles.smallCopyBtnText, copiedState === 'EMAIL' && styles.smallCopyBtnTextSuccess]}>
                        {copiedState === 'EMAIL' ? 'Copied! ✅' : 'Copy'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.valueBox}>
                    <Text style={styles.credEmailVal} selectable>{onboardedResult.email}</Text>
                  </View>
                </View>

                {/* Password Row */}
                <View style={styles.credRow}>
                  <View style={styles.credRowHeader}>
                    <Text style={styles.credLabel}>🔑 INITIAL PASSWORD:</Text>
                    <TouchableOpacity
                      style={[styles.smallCopyBtn, copiedState === 'PASSWORD' && styles.smallCopyBtnSuccess]}
                      onPress={() => handleCopyAction('PASSWORD', onboardedResult.password)}
                    >
                      <Text style={[styles.smallCopyBtnText, copiedState === 'PASSWORD' && styles.smallCopyBtnTextSuccess]}>
                        {copiedState === 'PASSWORD' ? 'Copied! ✅' : 'Copy'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.passwordPill}>
                    <Text style={styles.credPasswordVal} selectable>{onboardedResult.password}</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Main Action Buttons */}
            <TouchableOpacity
              style={[styles.mainCopyBtn, copiedState === 'ALL' && styles.mainCopyBtnSuccess]}
              onPress={() => {
                if (onboardedResult) {
                  const textToCopy = `Library: ${onboardedResult.libraryName} (${onboardedResult.libraryCode})\nAdmin Name: ${onboardedResult.adminName}\nPhone: ${onboardedResult.phone}\nEmail: ${onboardedResult.email}\nPassword: ${onboardedResult.password}`;
                  handleCopyAction('ALL', textToCopy);
                }
              }}
            >
              <Text style={styles.mainCopyBtnText}>
                {copiedState === 'ALL' ? '✅ All Credentials Copied!' : '📋 Copy All Credentials'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.doneBtn}
              onPress={() => {
                setShowSuccessModal(false);
                setOnboardedResult(null);
                setCopiedState('NONE');
              }}
            >
              <Text style={styles.doneBtnText}>Done / Close</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  keyboardContainer: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#0F172A' },
  subTitle: { fontSize: 14, color: '#64748B', marginTop: 4, marginBottom: 20 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTag: { color: '#2563EB', fontSize: 11, fontWeight: '800', letterSpacing: 1, marginTop: 10, marginBottom: 12 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  label: { color: '#334155', fontSize: 13, fontWeight: '700', marginBottom: 6 },
  autoGenBtn: { backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  autoGenBtnText: { color: '#2563EB', fontSize: 11, fontWeight: '800' },
  codeContainer: { marginBottom: 14 },
  codeInput: { marginBottom: 0, fontWeight: '800', letterSpacing: 1, color: '#1E3A8A' },
  input: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#0F172A',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    marginBottom: 14,
  },
  submitBtn: { backgroundColor: '#2563EB', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 12 },
  btnDisabled: { opacity: 0.6 },
  submitText: { color: '#FFFFFF', fontWeight: '900', fontSize: 14 },

  /* MODAL STYLES (100% SYMMETRIC NO-CLIPPING FIX) */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    zIndex: 9999,
  },
  modalScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 16,
  },
  credentialsCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    elevation: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    zIndex: 10000,
  },
  credTitle: { fontSize: 19, fontWeight: '900', color: '#065F46', textAlign: 'center', marginBottom: 4, width: '100%' },
  credSub: { fontSize: 13, color: '#475569', textAlign: 'center', marginBottom: 18, fontWeight: '600', width: '100%', lineHeight: 18 },
  credDetailsBox: {
    width: '100%',
    alignSelf: 'stretch',
    backgroundColor: '#F0FDF4',
    borderWidth: 1.5,
    borderColor: '#86EFAC',
    borderRadius: 14,
    padding: 16,
    marginBottom: 18,
  },
  libSummaryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, gap: 8, width: '100%' },
  libNameText: { fontSize: 17, fontWeight: '900', color: '#0F172A', flex: 1 },
  codeBadge: { backgroundColor: '#DBEAFE', borderWidth: 1, borderColor: '#93C5FD', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  codeBadgeText: { fontSize: 11, fontWeight: '800', color: '#1E40AF' },
  libMetaText: { fontSize: 12, color: '#475569', marginTop: 3 },
  divider: { height: 1, backgroundColor: '#86EFAC', marginVertical: 14 },
  adminHeaderLabel: { fontSize: 10, fontWeight: '800', color: '#166534', letterSpacing: 0.5, marginBottom: 4 },
  credAdminName: { fontSize: 17, fontWeight: '900', color: '#0F172A', marginBottom: 10 },
  credRow: { marginVertical: 6, width: '100%' },
  credRowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, width: '100%' },
  credLabel: { fontSize: 11, color: '#334155', fontWeight: '800' },
  smallCopyBtn: { backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  smallCopyBtnSuccess: { backgroundColor: '#DCFCE7', borderColor: '#86EFAC' },
  smallCopyBtnText: { fontSize: 11, fontWeight: '800', color: '#2563EB' },
  smallCopyBtnTextSuccess: { color: '#166534' },
  valueBox: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 2,
  },
  credPhoneVal: { fontSize: 14, fontWeight: '800', color: '#0F172A' },
  credEmailVal: { fontSize: 13, fontWeight: '800', color: '#1E3A8A', flexWrap: 'wrap' },
  passwordPill: { backgroundColor: '#FEF2F2', borderWidth: 1.5, borderColor: '#FCA5A5', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, alignSelf: 'flex-start', marginTop: 2 },
  credPasswordVal: { fontSize: 16, fontWeight: '900', color: '#991B1B', letterSpacing: 1 },
  mainCopyBtn: {
    width: '100%',
    alignSelf: 'stretch',
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    elevation: 2,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  mainCopyBtnSuccess: { backgroundColor: '#16A34A', shadowColor: '#16A34A' },
  mainCopyBtnText: { color: '#FFFFFF', fontWeight: '900', fontSize: 15, textAlign: 'center' },
  doneBtn: { width: '100%', alignSelf: 'stretch', paddingVertical: 13, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#CBD5E1' },
  doneBtnText: { color: '#334155', fontWeight: '800', fontSize: 14, textAlign: 'center' },
  planRadioRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  planRadioPill: { flex: 1, backgroundColor: '#F8FAFC', borderWidth: 1.5, borderColor: '#CBD5E1', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  planRadioPillActive: { backgroundColor: '#EFF6FF', borderColor: '#2563EB' },
  planRadioText: { fontSize: 13, fontWeight: '800', color: '#64748B' },
  planRadioTextActive: { color: '#1E40AF' },
  helperText: { fontSize: 11, color: '#64748B', marginTop: -8, marginBottom: 14, fontStyle: 'italic' },
});
