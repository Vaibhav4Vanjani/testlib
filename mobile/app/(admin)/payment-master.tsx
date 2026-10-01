import React, { useState, useEffect, useCallback } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { apiRequest } from '../../src/services/api.client';
import { HamburgerMenu } from '../../src/components/HamburgerMenu';
import { LOCAL_ADMIN_MENU } from '../../src/constants/menuItems';

const DEFAULT_LIBRARY_RATES = ['400', '400', '400', '400', '800', '800', '800', '800', '1200', '1200', '1200', '1200'];
const DEFAULT_SEAT_RATES = ['200', '200', '200', '200', '350', '350', '350', '350', '500', '500', '500', '500'];
const DEFAULT_LOCKER_RATES = ['100', '100', '100', '100', '150', '150', '150', '150', '200', '200', '200', '200'];

export default function PaymentMasterScreen() {
  const queryClient = useQueryClient();

  // 1-12 Hour Rates State arrays (strings for inputs)
  const [libraryHourlyRates, setLibraryHourlyRates] = useState<string[]>(DEFAULT_LIBRARY_RATES);
  const [seatHourlyRates, setSeatHourlyRates] = useState<string[]>(DEFAULT_SEAT_RATES);
  const [lockerHourlyRates, setLockerHourlyRates] = useState<string[]>(DEFAULT_LOCKER_RATES);

  const [annualFee, setAnnualFee] = useState('12000');
  const [referralReward, setReferralReward] = useState('100');

  // Tab Selection for Hour-by-Hour Configuration
  const [activeCategory, setActiveCategory] = useState<'LIBRARY' | 'SEAT' | 'LOCKER'>('LIBRARY');

  // Quick Range Presets State
  const [range1to4Library, setRange1to4Library] = useState('400');
  const [range5to8Library, setRange5to8Library] = useState('800');
  const [range9to12Library, setRange9to12Library] = useState('1200');

  const [range1to4Seat, setRange1to4Seat] = useState('200');
  const [range5to8Seat, setRange5to8Seat] = useState('350');
  const [range9to12Seat, setRange9to12Seat] = useState('500');

  const [range1to4Locker, setRange1to4Locker] = useState('100');
  const [range5to8Locker, setRange5to8Locker] = useState('150');
  const [range9to12Locker, setRange9to12Locker] = useState('200');

  const [submitting, setSubmitting] = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['payment-master'],
    queryFn: async () => {
      const res = await apiRequest('/admin/payment-master');
      if (!res.success) throw new Error(res.error?.message || 'Failed to fetch payment master pricing');
      return res.data;
    },
    retry: 1,
    staleTime: 0,
  });

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  const enableSeats = data?.featureFlags?.enableReservedSeats !== false;
  const enableLockers = data?.featureFlags?.enableLockers !== false;

  useEffect(() => {
    if (!enableSeats && activeCategory === 'SEAT') {
      setActiveCategory('LIBRARY');
    }
    if (!enableLockers && activeCategory === 'LOCKER') {
      setActiveCategory('LIBRARY');
    }
  }, [enableSeats, enableLockers, activeCategory]);

  useEffect(() => {
    if (data) {
      if (Array.isArray(data.libraryHourlyRates) && data.libraryHourlyRates.length === 12) {
        setLibraryHourlyRates(data.libraryHourlyRates.map(String));
        setRange1to4Library(String(data.libraryHourlyRates[0] || '400'));
        setRange5to8Library(String(data.libraryHourlyRates[4] || '800'));
        setRange9to12Library(String(data.libraryHourlyRates[8] || '1200'));
      }
      if (Array.isArray(data.seatHourlyRates) && data.seatHourlyRates.length === 12) {
        setSeatHourlyRates(data.seatHourlyRates.map(String));
        setRange1to4Seat(String(data.seatHourlyRates[0] || '200'));
        setRange5to8Seat(String(data.seatHourlyRates[4] || '350'));
        setRange9to12Seat(String(data.seatHourlyRates[8] || '500'));
      }
      if (Array.isArray(data.lockerHourlyRates) && data.lockerHourlyRates.length === 12) {
        setLockerHourlyRates(data.lockerHourlyRates.map(String));
        setRange1to4Locker(String(data.lockerHourlyRates[0] || '100'));
        setRange5to8Locker(String(data.lockerHourlyRates[4] || '150'));
        setRange9to12Locker(String(data.lockerHourlyRates[8] || '200'));
      }
      setAnnualFee((data.annualFee || data.yearlyFee)?.toString() || '12000');
      setReferralReward((data.referralRewardAmount ?? 100)?.toString());
    }
  }, [data]);

  const handleUpdateHourRate = (category: 'LIBRARY' | 'SEAT' | 'LOCKER', hourIndex: number, val: string) => {
    if (category === 'LIBRARY') {
      const copy = [...libraryHourlyRates];
      copy[hourIndex] = val;
      setLibraryHourlyRates(copy);
    } else if (category === 'SEAT') {
      const copy = [...seatHourlyRates];
      copy[hourIndex] = val;
      setSeatHourlyRates(copy);
    } else {
      const copy = [...lockerHourlyRates];
      copy[hourIndex] = val;
      setLockerHourlyRates(copy);
    }
  };

  const applyRangeSlabs = () => {
    // Fill Library
    const libCopy = [...libraryHourlyRates];
    for (let i = 0; i < 4; i++) libCopy[i] = range1to4Library;
    for (let i = 4; i < 8; i++) libCopy[i] = range5to8Library;
    for (let i = 8; i < 12; i++) libCopy[i] = range9to12Library;
    setLibraryHourlyRates(libCopy);

    if (enableSeats) {
      const seatCopy = [...seatHourlyRates];
      for (let i = 0; i < 4; i++) seatCopy[i] = range1to4Seat;
      for (let i = 4; i < 8; i++) seatCopy[i] = range5to8Seat;
      for (let i = 8; i < 12; i++) seatCopy[i] = range9to12Seat;
      setSeatHourlyRates(seatCopy);
    }

    if (enableLockers) {
      const lockerCopy = [...lockerHourlyRates];
      for (let i = 0; i < 4; i++) lockerCopy[i] = range1to4Locker;
      for (let i = 4; i < 8; i++) lockerCopy[i] = range5to8Locker;
      for (let i = 8; i < 12; i++) lockerCopy[i] = range9to12Locker;
      setLockerHourlyRates(lockerCopy);
    }

    Alert.alert('Range Slabs Applied ✨', '1–12 hour rates populated successfully based on your range configurations.');
  };

  const handleSave = async () => {
    setSubmitting(true);
    try {
      const numLibrary = libraryHourlyRates.map((val) => Math.max(0, parseFloat(val) || 0));
      const numSeat = seatHourlyRates.map((val) => Math.max(0, parseFloat(val) || 0));
      const numLocker = lockerHourlyRates.map((val) => Math.max(0, parseFloat(val) || 0));

      const payload: any = {
        libraryHourlyRates: numLibrary,
        annualFee: parseFloat(annualFee) || 0,
        referralRewardAmount: parseFloat(referralReward) || 0,
      };

      if (enableSeats) {
        payload.seatHourlyRates = numSeat;
      }
      if (enableLockers) {
        payload.lockerHourlyRates = numLocker;
      }

      const res = await apiRequest('/admin/payment-master', 'PUT', payload);

      if (res.success) {
        Alert.alert('Payment Master Saved ✅', 'Hour-based monthly pricing rules saved successfully.');
        queryClient.invalidateQueries({ queryKey: ['payment-master'] });
        queryClient.invalidateQueries({ queryKey: ['payment-plans'] });
      } else {
        Alert.alert('Save Error', res.error?.message || 'Failed to update payment master');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Unable to save pricing configuration');
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Loading Payment & Pricing Master...</Text>
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.container}>
        <HamburgerMenu title="Payment & Pricing Master" role="LIBRARY_ADMIN" items={LOCAL_ADMIN_MENU} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>⚠️ Unable to Load Pricing Master</Text>
          <Text style={styles.errorText}>{(error as Error)?.message || 'Request failed or timed out.'}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()}>
            <Text style={styles.retryText}>🔄 Retry Loading</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const currentRatesArray =
    activeCategory === 'LIBRARY' ? libraryHourlyRates : activeCategory === 'SEAT' ? seatHourlyRates : lockerHourlyRates;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <HamburgerMenu title="Payment & Pricing Master" role="LIBRARY_ADMIN" items={LOCAL_ADMIN_MENU} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={styles.headerTitle}>Payment & Pricing Master</Text>
          <Text style={styles.subTitle}>
            Define monthly plan amounts based on 1–12 hours/day study duration for Main Library{enableSeats ? ', Reserved Seats' : ''}{enableLockers ? ', and Reserved Lockers' : ''}.
          </Text>

          {/* QUICK RANGE SLABS CONFIGURATOR */}
          <View style={styles.card}>
            <Text style={styles.sectionHeader}>⚡ Quick Range Slabs Configurator</Text>
            <Text style={styles.cardDesc}>Set monthly amounts for hour ranges and apply to 1–12 hrs/day arrays in one click.</Text>

            {/* Range 1-4 hrs */}
            <Text style={styles.rangeGroupLabel}>1–4 Hours / Day Range</Text>
            <View style={styles.rangeRow}>
              <View style={styles.flex1}>
                <Text style={styles.miniLabel}>Library (₹/mo)</Text>
                <TextInput style={styles.miniInput} keyboardType="numeric" value={range1to4Library} onChangeText={setRange1to4Library} />
              </View>
              {enableSeats && (
                <View style={styles.flex1}>
                  <Text style={styles.miniLabel}>Seat (₹/mo)</Text>
                  <TextInput style={styles.miniInput} keyboardType="numeric" value={range1to4Seat} onChangeText={setRange1to4Seat} />
                </View>
              )}
              {enableLockers && (
                <View style={styles.flex1}>
                  <Text style={styles.miniLabel}>Locker (₹/mo)</Text>
                  <TextInput style={styles.miniInput} keyboardType="numeric" value={range1to4Locker} onChangeText={setRange1to4Locker} />
                </View>
              )}
            </View>

            {/* Range 5-8 hrs */}
            <Text style={styles.rangeGroupLabel}>5–8 Hours / Day Range</Text>
            <View style={styles.rangeRow}>
              <View style={styles.flex1}>
                <Text style={styles.miniLabel}>Library (₹/mo)</Text>
                <TextInput style={styles.miniInput} keyboardType="numeric" value={range5to8Library} onChangeText={setRange5to8Library} />
              </View>
              {enableSeats && (
                <View style={styles.flex1}>
                  <Text style={styles.miniLabel}>Seat (₹/mo)</Text>
                  <TextInput style={styles.miniInput} keyboardType="numeric" value={range5to8Seat} onChangeText={setRange5to8Seat} />
                </View>
              )}
              {enableLockers && (
                <View style={styles.flex1}>
                  <Text style={styles.miniLabel}>Locker (₹/mo)</Text>
                  <TextInput style={styles.miniInput} keyboardType="numeric" value={range5to8Locker} onChangeText={setRange5to8Locker} />
                </View>
              )}
            </View>

            {/* Range 9-12 hrs */}
            <Text style={styles.rangeGroupLabel}>9–12+ Hours / Day Range (12-hr Rate)</Text>
            <View style={styles.rangeRow}>
              <View style={styles.flex1}>
                <Text style={styles.miniLabel}>Library (₹/mo)</Text>
                <TextInput style={styles.miniInput} keyboardType="numeric" value={range9to12Library} onChangeText={setRange9to12Library} />
              </View>
              {enableSeats && (
                <View style={styles.flex1}>
                  <Text style={styles.miniLabel}>Seat (₹/mo)</Text>
                  <TextInput style={styles.miniInput} keyboardType="numeric" value={range9to12Seat} onChangeText={setRange9to12Seat} />
                </View>
              )}
              {enableLockers && (
                <View style={styles.flex1}>
                  <Text style={styles.miniLabel}>Locker (₹/mo)</Text>
                  <TextInput style={styles.miniInput} keyboardType="numeric" value={range9to12Locker} onChangeText={setRange9to12Locker} />
                </View>
              )}
            </View>

            <TouchableOpacity style={styles.applyPresetsBtn} onPress={applyRangeSlabs}>
              <Text style={styles.applyPresetsText}>Apply Range Presets to 1–12 Hr Rates</Text>
            </TouchableOpacity>
          </View>

          {/* INDIVIDUAL HOUR-BY-HOUR CONFIGURATION CARD */}
          <View style={styles.card}>
            <Text style={styles.sectionHeader}>⏱️ Detailed 1–12 Hours Configurator</Text>

            {/* Category Selector Tabs */}
            <View style={styles.tabBar}>
              <TouchableOpacity
                style={[styles.tabBtn, activeCategory === 'LIBRARY' && styles.tabBtnActive]}
                onPress={() => setActiveCategory('LIBRARY')}
              >
                <Text style={[styles.tabText, activeCategory === 'LIBRARY' && styles.tabTextActive]}>Main Library</Text>
              </TouchableOpacity>
              {enableSeats && (
                <TouchableOpacity
                  style={[styles.tabBtn, activeCategory === 'SEAT' && styles.tabBtnActive]}
                  onPress={() => setActiveCategory('SEAT')}
                >
                  <Text style={[styles.tabText, activeCategory === 'SEAT' && styles.tabTextActive]}>Seat Fee</Text>
                </TouchableOpacity>
              )}
              {enableLockers && (
                <TouchableOpacity
                  style={[styles.tabBtn, activeCategory === 'LOCKER' && styles.tabBtnActive]}
                  onPress={() => setActiveCategory('LOCKER')}
                >
                  <Text style={[styles.tabText, activeCategory === 'LOCKER' && styles.tabTextActive]}>Locker Fee</Text>
                </TouchableOpacity>
              )}
            </View>

            <Text style={styles.categoryNote}>
              {activeCategory === 'LIBRARY' && 'Monthly base library fee for student studying N hours/day.'}
              {activeCategory === 'SEAT' && 'Monthly seat reservation surcharge for student studying N hours/day.'}
              {activeCategory === 'LOCKER' && 'Monthly locker reservation surcharge for student studying N hours/day.'}
            </Text>

            {/* 12 Hour Inputs Grid */}
            <View style={styles.hoursGrid}>
              {Array.from({ length: 12 }).map((_, idx) => {
                const hourNum = idx + 1;
                const is12 = hourNum === 12;
                return (
                  <View key={`hour-${hourNum}`} style={styles.hourGridItem}>
                    <Text style={styles.hourLabel}>
                      {hourNum} Hr/day {is12 ? '(or >12)' : ''}
                    </Text>
                    <TextInput
                      style={styles.hourInput}
                      keyboardType="numeric"
                      value={currentRatesArray[idx] || ''}
                      onChangeText={(val) => handleUpdateHourRate(activeCategory, idx, val)}
                      placeholder="₹/mo"
                    />
                  </View>
                );
              })}
            </View>
          </View>

          {/* MISC FEES */}
          <View style={styles.card}>
            <Text style={styles.sectionHeader}>🎁 Miscellaneous Fees</Text>

            <Text style={styles.label}>Annual Membership Fee (₹)</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={annualFee}
              onChangeText={setAnnualFee}
              placeholder="e.g. 12000"
            />

            <Text style={styles.label}>Referral Reward Discount (₹)</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={referralReward}
              onChangeText={setReferralReward}
              placeholder="e.g. 100"
            />
          </View>

          <TouchableOpacity style={[styles.saveBtn, submitting && styles.btnDisabled]} onPress={handleSave} disabled={submitting}>
            {submitting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveText}>Save Payment Master Configuration</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 16 },
  loadingContainer: { flex: 1, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadingText: { marginTop: 12, fontSize: 14, color: '#64748B', fontWeight: '600' },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorTitle: { fontSize: 18, fontWeight: '800', color: '#DC2626', marginBottom: 8 },
  errorText: { fontSize: 14, color: '#64748B', textAlign: 'center', marginBottom: 20 },
  retryBtn: { backgroundColor: '#2563EB', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10 },
  retryText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#0F172A' },
  subTitle: { fontSize: 14, color: '#64748B', marginTop: 4, marginBottom: 16 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionHeader: { fontSize: 16, fontWeight: '800', color: '#0F172A', marginBottom: 4 },
  cardDesc: { fontSize: 12, color: '#64748B', marginBottom: 14 },
  rangeGroupLabel: { fontSize: 13, fontWeight: '700', color: '#1E293B', marginTop: 8, marginBottom: 6 },
  rangeRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  flex1: { flex: 1 },
  miniLabel: { fontSize: 11, color: '#64748B', fontWeight: '600', marginBottom: 2 },
  miniInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 8,
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '700',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  applyPresetsBtn: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  applyPresetsText: { color: '#1D4ED8', fontWeight: '800', fontSize: 13 },
  tabBar: { flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: 10, padding: 4, marginVertical: 12 },
  tabBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  tabBtnActive: { backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  tabText: { fontSize: 12, fontWeight: '700', color: '#64748B' },
  tabTextActive: { color: '#2563EB', fontWeight: '800' },
  categoryNote: { fontSize: 12, color: '#64748B', fontStyle: 'italic', marginBottom: 12 },
  hoursGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  hourGridItem: { width: '31%', backgroundColor: '#F8FAFC', padding: 8, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  hourLabel: { fontSize: 11, fontWeight: '700', color: '#475569', marginBottom: 4 },
  hourInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '800',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  label: { color: '#334155', fontSize: 13, fontWeight: '700', marginTop: 10, marginBottom: 4 },
  input: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#0F172A',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    marginBottom: 4,
  },
  saveBtn: { backgroundColor: '#2563EB', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginBottom: 30 },
  btnDisabled: { opacity: 0.6 },
  saveText: { color: '#FFFFFF', fontWeight: '900', fontSize: 15 },
});
