import * as React from 'react';
import { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Image,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { apiRequest } from '../../src/services/api.client';

import { HamburgerMenu } from '../../src/components/HamburgerMenu';
import { STUDENT_MENU } from '../../src/constants/menuItems';
import { sortItemsNaturally } from '../../src/utils/sorting';

// Available time slots from 06:00 AM to 11:00 PM (23:00)
const TIME_SLOTS = [
  '06:00', '07:00', '08:00', '09:00', '10:00', '11:00',
  '12:00', '13:00', '14:00', '15:00', '16:00', '17:00',
  '18:00', '19:00', '20:00', '21:00', '22:00', '23:00',
];

const timeToNumber = (t: string): number => {
  const parts = t.split(':');
  return parseInt(parts[0] || '0', 10) + parseInt(parts[1] || '0', 10) / 60;
};

export default function PaymentsScreen() {
  const queryClient = useQueryClient();

  // Form State
  const [fromTime, setFromTime] = useState<string>('06:00');
  const [toTime, setToTime] = useState<string>('14:00');
  const [monthsInput, setMonthsInput] = useState<string>('1');
  const [wantLocker, setWantLocker] = useState<boolean>(false);
  const [selectedLockerId, setSelectedLockerId] = useState<string>('');
  const [wantSeat, setWantSeat] = useState<boolean>(false);
  const [selectedSeatId, setSelectedSeatId] = useState<string>('');
  const [utrNumber, setUtrNumber] = useState<string>('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [viewingImageUri, setViewingImageUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Modals for compact dropdown pickers
  const [showFromModal, setShowFromModal] = useState<boolean>(false);
  const [showToModal, setShowToModal] = useState<boolean>(false);
  const [showSeatModal, setShowSeatModal] = useState<boolean>(false);
  const [showLockerModal, setShowLockerModal] = useState<boolean>(false);

  // 1. Fetch Payment Master & Pricing Plans
  const { data: plans } = useQuery({
    queryKey: ['payment-plans'],
    queryFn: async () => {
      const res = await apiRequest('/payments/plans');
      return res.data || {};
    },
  });

  // 2. Fetch Payment History
  const { data: history } = useQuery({
    queryKey: ['payment-history'],
    queryFn: async () => {
      const res = await apiRequest('/payments/history');
      return res.data || [];
    },
  });

  // 3. Fetch Available Seats
  const { data: seatsData } = useQuery({
    queryKey: ['student-available-seats'],
    queryFn: async () => {
      const res = await apiRequest('/seats');
      return res.data || [];
    },
  });

  // 4. Fetch Available Lockers
  const { data: lockersData } = useQuery({
    queryKey: ['student-available-lockers'],
    queryFn: async () => {
      const res = await apiRequest('/lockers');
      return res.data || [];
    },
  });

  const masterData = plans && typeof plans === 'object' && !Array.isArray(plans) ? plans : null;
  const historyList = Array.isArray(history) ? history : [];

  // Hourly rates defaults
  const baseHourlyRate = masterData?.hourlyRate || 20;
  const defaultSeatRate = masterData?.seatHourlyRate || 10;
  const defaultLockerRate = masterData?.lockerHourlyRate || 5;

  // Process available seats
  const availableSeats = useMemo(() => {
    const raw = Array.isArray(seatsData)
      ? seatsData
      : Array.isArray((seatsData as any)?.seats)
        ? (seatsData as any).seats
        : Array.isArray((seatsData as any)?.data)
          ? (seatsData as any).data
          : [];

    const filtered = raw.filter(
      (s: any) => !s.isDeleted && (s.status === 'AVAILABLE' || !s.status || String(s.status).toUpperCase() === 'AVAILABLE')
    );

    if (filtered.length > 0) return sortItemsNaturally(filtered, 'seatNumber');

    return [
      { _id: 'fallback-seat-1', seatNumber: 'A-01', floor: 1, priceHourly: defaultSeatRate, status: 'AVAILABLE' },
      { _id: 'fallback-seat-2', seatNumber: 'A-02', floor: 1, priceHourly: defaultSeatRate, status: 'AVAILABLE' },
      { _id: 'fallback-seat-3', seatNumber: 'A-03', floor: 1, priceHourly: defaultSeatRate, status: 'AVAILABLE' },
      { _id: 'fallback-seat-4', seatNumber: 'A-04', floor: 2, priceHourly: defaultSeatRate, status: 'AVAILABLE' },
      { _id: 'fallback-seat-5', seatNumber: 'A-05', floor: 2, priceHourly: defaultSeatRate, status: 'AVAILABLE' },
    ];
  }, [seatsData, defaultSeatRate]);

  // Process available lockers
  const availableLockers = useMemo(() => {
    const raw = Array.isArray(lockersData)
      ? lockersData
      : Array.isArray((lockersData as any)?.lockers)
        ? (lockersData as any).lockers
        : Array.isArray((lockersData as any)?.data)
          ? (lockersData as any).data
          : [];

    const filtered = raw.filter(
      (l: any) => !l.isDeleted && (l.status === 'AVAILABLE' || !l.status || String(l.status).toUpperCase() === 'AVAILABLE')
    );

    if (filtered.length > 0) return sortItemsNaturally(filtered, 'lockerNumber');

    return [
      { _id: 'fallback-locker-1', lockerNumber: 'L-01', floor: 1, priceHourly: defaultLockerRate, status: 'AVAILABLE' },
      { _id: 'fallback-locker-2', lockerNumber: 'L-02', floor: 1, priceHourly: defaultLockerRate, status: 'AVAILABLE' },
      { _id: 'fallback-locker-3', lockerNumber: 'L-03', floor: 1, priceHourly: defaultLockerRate, status: 'AVAILABLE' },
      { _id: 'fallback-locker-4', lockerNumber: 'L-04', floor: 2, priceHourly: defaultLockerRate, status: 'AVAILABLE' },
      { _id: 'fallback-locker-5', lockerNumber: 'L-05', floor: 2, priceHourly: defaultLockerRate, status: 'AVAILABLE' },
    ];
  }, [lockersData, defaultLockerRate]);

  // Time Validation & Hours Calculation
  const fromNum = timeToNumber(fromTime);
  const toNum = timeToNumber(toTime);
  const isTimeValid = toNum >= fromNum + 1;

  const calculatedHours = useMemo(() => {
    if (!isTimeValid) return 1;
    return Math.max(1, Math.ceil(toNum - fromNum));
  }, [fromNum, toNum, isTimeValid]);

  // Month Duration Validation (Whole number integer check between 1 and 50)
  const isMonthsValid = /^\d+$/.test(monthsInput.trim()) && (() => {
    const p = parseInt(monthsInput.trim(), 10);
    return !isNaN(p) && p >= 1 && p <= 50;
  })();
  const parsedMonths = parseInt(monthsInput.trim(), 10);
  const validMonths = isMonthsValid ? parsedMonths : 1;

  const selectedSeatObj = useMemo(() => {
    if (!wantSeat || !selectedSeatId) return null;
    return availableSeats.find((s: any) => s._id === selectedSeatId);
  }, [wantSeat, selectedSeatId, availableSeats]);

  const selectedLockerObj = useMemo(() => {
    if (!wantLocker || !selectedLockerId) return null;
    return availableLockers.find((l: any) => l._id === selectedLockerId);
  }, [wantLocker, selectedLockerId, availableLockers]);

  const effectiveHours = Math.max(1, Math.min(12, calculatedHours));

  const baseLibraryRate = useMemo(() => {
    const rates = masterData?.libraryHourlyRates;
    if (Array.isArray(rates) && rates.length === 12) {
      return rates[effectiveHours - 1] ?? 1200;
    }
    return masterData?.monthlyFee || 1200;
  }, [masterData, effectiveHours]);

  const seatRate = useMemo(() => {
    if (!wantSeat) return 0;
    const rates = masterData?.seatHourlyRates;
    if (Array.isArray(rates) && rates.length === 12) {
      return rates[effectiveHours - 1] ?? 500;
    }
    return selectedSeatObj?.priceMonthly || masterData?.seatMonthlyFee || 500;
  }, [wantSeat, selectedSeatObj, masterData, effectiveHours]);

  const lockerRate = useMemo(() => {
    if (!wantLocker) return 0;
    const rates = masterData?.lockerHourlyRates;
    if (Array.isArray(rates) && rates.length === 12) {
      return rates[effectiveHours - 1] ?? 200;
    }
    return selectedLockerObj?.priceMonthly || masterData?.lockerMonthlyFee || 200;
  }, [wantLocker, selectedLockerObj, masterData, effectiveHours]);

  const applicableMonthlyPlanAmount = useMemo(() => {
    return baseLibraryRate + seatRate + lockerRate;
  }, [baseLibraryRate, seatRate, lockerRate]);

  const calculatedTotal = useMemo(() => {
    return Math.round(applicableMonthlyPlanAmount * validMonths);
  }, [applicableMonthlyPlanAmount, validMonths]);

  // Handle From Time Change
  const handleSelectFromTime = (time: string) => {
    setFromTime(time);
    setShowFromModal(false);
    // Enforce toTime >= fromTime + 1hr
    const newFromNum = timeToNumber(time);
    if (toNum < newFromNum + 1) {
      const validToSlot = TIME_SLOTS.find((t) => timeToNumber(t) >= newFromNum + 1) || TIME_SLOTS[TIME_SLOTS.length - 1];
      setToTime(validToSlot);
    }
  };

  // Handle To Time Change
  const handleSelectToTime = (time: string) => {
    setToTime(time);
    setShowToModal(false);
  };

  // Image Picker Handler
  const handlePickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permission Required', 'Permission to access photo gallery is required to upload payment screenshot.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setImageUri(result.assets[0].uri);
    }
  };

  // Submission Handler
  const handleManualPayment = async () => {
    if (!isTimeValid) {
      Alert.alert('Invalid Time Range', 'To Time must be at least 1 hour after From Time.');
      return;
    }

    if (!isMonthsValid) {
      Alert.alert('Invalid Duration', 'Please enter a valid number of months between 1 and 50.');
      return;
    }

    if (wantSeat && !selectedSeatId) {
      Alert.alert('Selection Required', 'Please select an available seat.');
      return;
    }

    if (wantLocker && !selectedLockerId) {
      Alert.alert('Selection Required', 'Please select an available locker.');
      return;
    }

    if (!imageUri && (!utrNumber || utrNumber.trim().length < 6)) {
      Alert.alert('Payment Proof Required', 'Please upload a payment screenshot proof or enter a valid UTR number.');
      return;
    }

    setSubmitting(true);
    try {
      let pType = 'FEES';
      if (wantSeat && wantLocker) pType = 'COMBINED';
      else if (wantSeat) pType = 'SEAT_RENT';
      else if (wantLocker) pType = 'LOCKER_RENT';

      const formData = new FormData();
      formData.append('amount', calculatedTotal.toString());
      formData.append('paymentType', pType);
      formData.append('hours', calculatedHours.toString());
      formData.append('months', validMonths.toString());
      formData.append('fromTime', fromTime.trim());
      formData.append('toTime', toTime.trim());
      formData.append('hasSeat', wantSeat ? 'true' : 'false');
      formData.append('hasLocker', wantLocker ? 'true' : 'false');

      if (wantSeat && selectedSeatId && !selectedSeatId.startsWith('fallback-')) {
        formData.append('targetSeatId', selectedSeatId);
      }
      if (wantLocker && selectedLockerId && !selectedLockerId.startsWith('fallback-')) {
        formData.append('targetLockerId', selectedLockerId);
      }
      if (utrNumber.trim()) formData.append('utrNumber', utrNumber.trim());

      if (imageUri) {
        const filename = imageUri.split('/').pop() || 'screenshot.jpg';
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : 'image/jpeg';
        formData.append('proofFile', {
          uri: imageUri,
          name: filename,
          type,
        } as any);
      }

      const res = await apiRequest('/payments/submit-manual', {
        method: 'POST',
        body: formData,
      });

      if (res.success) {
        Alert.alert('Payment Submitted ✅', 'Your manual QR payment request has been submitted! Pending Local Admin approval.');
        setUtrNumber('');
        setImageUri(null);
        setSelectedSeatId('');
        setSelectedLockerId('');
        queryClient.invalidateQueries({ queryKey: ['payment-history'] });
        queryClient.invalidateQueries({ queryKey: ['student-available-seats'] });
        queryClient.invalidateQueries({ queryKey: ['student-available-lockers'] });
      } else {
        Alert.alert('Submission Error', res.error?.message || 'Failed to submit payment');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Network error submitting payment');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <HamburgerMenu title="Plans & Payments" role="STUDENT" items={STUDENT_MENU} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {/* Reading Room Payment Info Card */}
          {masterData?.upiId ? (
            <View style={styles.planCard}>
              <Text style={styles.planName}>Reading Room Payment Info</Text>
              <Text style={{ marginTop: 6, fontSize: 15, fontWeight: '800', color: '#2563EB' }}>
                Centre UPI ID: {masterData.upiId}
              </Text>
            </View>
          ) : null}

          {/* Manual UPI QR Payment Form */}
          <View style={styles.manualBox}>
            <Text style={styles.boxTitle}>Manual UPI QR Payment</Text>
            <Text style={styles.boxDesc}>Configure your duration, seats & lockers, scan centre UPI QR, and submit payment proof below:</Text>

            {/* 1. FROM TIME TO TO TIME DROPDOWN PICKERS */}
            <Text style={styles.label}>1. Daily Study Time (From Time to To Time):</Text>
            <View style={styles.timeRow}>
              <View style={styles.timeCol}>
                <Text style={styles.subLabel}>From Time</Text>
                <TouchableOpacity style={styles.pickerTrigger} onPress={() => setShowFromModal(true)}>
                  <Text style={styles.pickerTriggerText}>{fromTime}</Text>
                  <Text style={styles.pickerArrow}>▼</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.timeCol}>
                <Text style={styles.subLabel}>To Time</Text>
                <TouchableOpacity style={styles.pickerTrigger} onPress={() => setShowToModal(true)}>
                  <Text style={styles.pickerTriggerText}>{toTime}</Text>
                  <Text style={styles.pickerArrow}>▼</Text>
                </TouchableOpacity>
              </View>
            </View>

            {!isTimeValid ? (
              <Text style={styles.errorHint}>⚠️ To Time must be at least 1 hour after From Time.</Text>
            ) : (
              <View style={styles.hoursBadge}>
                <Text style={styles.hoursBadgeText}>⏱️ Calculated Daily Hours: {calculatedHours} hrs (Rounded Up)</Text>
              </View>
            )}

            {/* 2. NUMBER OF MONTHS (1 to 50 WITH STRICT NUMERIC VALIDATION) */}
            <Text style={styles.label}>2. Select Duration in Months (1 – 50 months):</Text>
            <TextInput
              style={[styles.input, !isMonthsValid && styles.inputError]}
              keyboardType="number-pad"
              value={monthsInput}
              onChangeText={(val) => setMonthsInput(val.replace(/[^0-9]/g, ''))}
              placeholder="Enter duration (1 - 50)"
              placeholderTextColor="#94A3B8"
            />
            {!isMonthsValid ? (
              <Text style={styles.errorHint}>⚠️ Please enter a valid number of months between 1 and 50.</Text>
            ) : null}

            {/* 3. WANT LOCKER? (COMPACT DROPDOWN SELECTOR) */}
            {masterData?.featureFlags?.enableLockers !== false && (
              <>
                <Text style={styles.label}>3. Want Locker?</Text>
                <View style={styles.toggleRow}>
                  <TouchableOpacity
                    style={[styles.toggleBtn, !wantLocker && styles.activeToggleBtn]}
                    onPress={() => {
                      setWantLocker(false);
                      setSelectedLockerId('');
                    }}
                  >
                    <Text style={[styles.toggleText, !wantLocker && styles.activeToggleText]}>❌ No</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.toggleBtn, wantLocker && styles.activeToggleBtn]}
                    onPress={() => {
                      setWantLocker(true);
                      if (!selectedLockerId && availableLockers.length > 0) {
                        setSelectedLockerId(availableLockers[0]._id);
                      }
                    }}
                  >
                    <Text style={[styles.toggleText, wantLocker && styles.activeToggleText]}>🔒 Yes</Text>
                  </TouchableOpacity>
                </View>

                {wantLocker && (
                  <View style={{ marginBottom: 12 }}>
                    <Text style={styles.subLabel}>Selected Locker</Text>
                    <TouchableOpacity style={styles.compactTrigger} onPress={() => setShowLockerModal(true)}>
                      <Text style={styles.compactTriggerText}>
                        {selectedLockerObj
                          ? `Locker #${selectedLockerObj.lockerNumber} (Floor ${selectedLockerObj.floor || 1})`
                          : 'Tap to Choose Available Locker'}
                      </Text>
                      <Text style={styles.pickerArrow}>▼</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}

            {/* 4. WANT SEAT? (COMPACT DROPDOWN SELECTOR) */}
            {masterData?.featureFlags?.enableReservedSeats !== false && (
              <>
                <Text style={styles.label}>4. Want Seat?</Text>
                <View style={styles.toggleRow}>
                  <TouchableOpacity
                    style={[styles.toggleBtn, !wantSeat && styles.activeToggleBtn]}
                    onPress={() => {
                      setWantSeat(false);
                      setSelectedSeatId('');
                    }}
                  >
                    <Text style={[styles.toggleText, !wantSeat && styles.activeToggleText]}>❌ No</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.toggleBtn, wantSeat && styles.activeToggleBtn]}
                    onPress={() => {
                      setWantSeat(true);
                      if (!selectedSeatId && availableSeats.length > 0) {
                        setSelectedSeatId(availableSeats[0]._id);
                      }
                    }}
                  >
                    <Text style={[styles.toggleText, wantSeat && styles.activeToggleText]}>🪑 Yes</Text>
                  </TouchableOpacity>
                </View>

                {wantSeat && (
                  <View style={{ marginBottom: 12 }}>
                    <Text style={styles.subLabel}>Selected Seat</Text>
                    <TouchableOpacity style={styles.compactTrigger} onPress={() => setShowSeatModal(true)}>
                      <Text style={styles.compactTriggerText}>
                        {selectedSeatObj
                          ? `Seat #${selectedSeatObj.seatNumber} (Floor ${selectedSeatObj.floor || 1})`
                          : 'Tap to Choose Available Seat'}
                      </Text>
                      <Text style={styles.pickerArrow}>▼</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}

            {/* 5. TOTAL AMOUNT DISPLAY & PLAN SUMMARY */}
            <View style={styles.totalBox}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#1E40AF', marginBottom: 4 }}>
                Selected Time: {calculatedHours} hrs/day ({fromTime} to {toTime})
              </Text>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#1E40AF', marginBottom: 6 }}>
                Applicable Monthly Plan Amount: ₹{applicableMonthlyPlanAmount}/month
              </Text>
              <Text style={styles.totalAmountText}>Total Payable Amount: ₹{calculatedTotal.toLocaleString('en-IN')}</Text>
            </View>

            {/* 6. UTR NUMBER & PAYMENT SCREENSHOT */}
            <Text style={styles.label}>6. Payment Proof Screenshot & UTR</Text>

            <TouchableOpacity style={styles.uploadBtn} onPress={handlePickImage}>
              <Text style={styles.uploadBtnText}>
                {imageUri ? '🖼️ Change Screenshot' : '📷 Upload Payment Screenshot Proof'}
              </Text>
            </TouchableOpacity>

            {imageUri ? (
              <View style={styles.imagePreviewContainer}>
                <Image source={{ uri: imageUri }} style={styles.imagePreview} resizeMode="contain" />
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                  <TouchableOpacity
                    style={[styles.removeImageBtn, { backgroundColor: '#2563EB', flex: 1, marginEnd: 0 }]}
                    onPress={() => setViewingImageUri(imageUri)}
                  >
                    <Text style={[styles.removeImageText, { color: '#FFFFFF' }]}>View</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.removeImageBtn, { backgroundColor: '#EF4444', flex: 1, marginEnd: 0 }]}
                    onPress={() => setImageUri(null)}
                  >
                    <Text style={[styles.removeImageText, { color: '#FFFFFF' }]}>Reset</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}

            <Text style={[styles.label, { marginTop: 10 }]}>UPI UTR / Transaction Ref No. (Optional if screenshot uploaded)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 324109852104"
              placeholderTextColor="#64748B"
              value={utrNumber}
              onChangeText={setUtrNumber}
            />

            {/* 7. SUBMIT BUTTON */}
            <TouchableOpacity
              style={[styles.submitBtn, (submitting || !isTimeValid || !isMonthsValid) && styles.btnDisabled]}
              onPress={handleManualPayment}
              disabled={submitting || !isTimeValid || !isMonthsValid}
            >
              {submitting ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.submitText}>Submit Payment (₹{calculatedTotal.toLocaleString('en-IN')})</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Payment History */}
          <Text style={styles.sectionTitle}>Payment History</Text>
          {historyList.length === 0 ? (
            <View style={styles.planCard}>
              <Text style={{ color: '#64748B', textAlign: 'center' }}>No payment history records found.</Text>
            </View>
          ) : (
            historyList.map((pay: any) => (
              <View key={pay._id} style={styles.historyRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.historyAmount}>₹{pay.amount} ({pay.paymentType})</Text>
                  {pay.hours ? <Text style={styles.utrText}>{pay.hours} hrs/day • {pay.months || 1} month(s)</Text> : null}
                  {pay.utrNumber ? <Text style={styles.utrText}>UTR: {pay.utrNumber}</Text> : null}
                  <Text style={styles.historyDate}>{new Date(pay.createdAt).toLocaleDateString()}</Text>
                </View>
                <View style={[styles.badge, pay.status === 'APPROVED' ? styles.bgApproved : pay.status === 'PENDING' ? styles.bgPending : styles.bgRejected]}>
                  <Text style={styles.badgeText}>{pay.status}</Text>
                </View>
              </View>
            ))
          )}
        </ScrollView>

        {/* --- MODAL PICKER: FROM TIME --- */}
        <Modal visible={showFromModal} transparent animationType="fade">
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowFromModal(false)}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Select From Time</Text>
              <ScrollView style={{ maxHeight: 260 }}>
                {TIME_SLOTS.slice(0, -1).map((time) => (
                  <TouchableOpacity
                    key={time}
                    style={[styles.modalItem, fromTime === time && styles.selectedModalItem]}
                    onPress={() => handleSelectFromTime(time)}
                  >
                    <Text style={[styles.modalItemText, fromTime === time && styles.selectedModalItemText]}>
                      {time}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* --- MODAL PICKER: TO TIME --- */}
        <Modal visible={showToModal} transparent animationType="fade">
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowToModal(false)}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Select To Time</Text>
              <ScrollView style={{ maxHeight: 260 }}>
                {TIME_SLOTS.filter((t) => timeToNumber(t) >= fromNum + 1).map((time) => (
                  <TouchableOpacity
                    key={time}
                    style={[styles.modalItem, toTime === time && styles.selectedModalItem]}
                    onPress={() => handleSelectToTime(time)}
                  >
                    <Text style={[styles.modalItemText, toTime === time && styles.selectedModalItemText]}>
                      {time}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* --- COMPACT MODAL PICKER: SEAT SELECTOR --- */}
        <Modal visible={showSeatModal} transparent animationType="fade">
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowSeatModal(false)}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Select Available Seat</Text>
              <ScrollView style={{ maxHeight: 280 }}>
                {availableSeats.map((seat: any) => {
                  const isSel = selectedSeatId === seat._id;
                  const mRate = seat.priceMonthly || masterData?.seatMonthlyFee || 500;
                  return (
                    <TouchableOpacity
                      key={seat._id}
                      style={[styles.modalItem, isSel && styles.selectedModalItem]}
                      onPress={() => {
                        setSelectedSeatId(seat._id);
                        setShowSeatModal(false);
                      }}
                    >
                      <Text style={[styles.modalItemText, isSel && styles.selectedModalItemText]}>
                        Seat #{seat.seatNumber} (Floor {seat.floor || 1})
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* --- COMPACT MODAL PICKER: LOCKER SELECTOR --- */}
        <Modal visible={showLockerModal} transparent animationType="fade">
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowLockerModal(false)}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Select Available Locker</Text>
              <ScrollView style={{ maxHeight: 280 }}>
                {availableLockers.map((locker: any) => {
                  const isSel = selectedLockerId === locker._id;
                  const mRate = locker.priceMonthly || masterData?.lockerMonthlyFee || 200;
                  return (
                    <TouchableOpacity
                      key={locker._id}
                      style={[styles.modalItem, isSel && styles.selectedModalItem]}
                      onPress={() => {
                        setSelectedLockerId(locker._id);
                        setShowLockerModal(false);
                      }}
                    >
                      <Text style={[styles.modalItemText, isSel && styles.selectedModalItemText]}>
                        Locker #{locker.lockerNumber} (Floor {locker.floor || 1})
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>

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
      </KeyboardAvoidingView>
    </SafeAreaView>
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 12,
    marginTop: 8,
  },
  planCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  planName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#2563EB',
  },
  planPrice: {
    fontSize: 20,
    fontWeight: '800',
    color: '#16A34A',
    marginVertical: 4,
  },
  planDetail: {
    color: '#64748B',
    fontSize: 13,
    marginTop: 2,
  },
  manualBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginVertical: 16,
    borderWidth: 2,
    borderColor: '#2563EB',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  boxTitle: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '800',
  },
  boxDesc: {
    color: '#64748B',
    fontSize: 13,
    marginTop: 4,
    marginBottom: 12,
  },
  label: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
    marginTop: 10,
  },
  subLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 4,
  },
  timeRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  timeCol: {
    flex: 1,
  },
  pickerTrigger: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pickerTriggerText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  pickerArrow: {
    fontSize: 12,
    color: '#64748B',
  },
  compactTrigger: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  compactTriggerText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    flex: 1,
  },
  hoursBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginTop: 4,
    marginBottom: 10,
  },
  hoursBadgeText: {
    color: '#2563EB',
    fontSize: 13,
    fontWeight: '800',
  },
  errorHint: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#0F172A',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    marginBottom: 8,
  },
  inputError: {
    borderColor: '#DC2626',
    backgroundColor: '#FEF2F2',
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
  },
  activeToggleBtn: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2563EB',
  },
  toggleText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  activeToggleText: {
    color: '#2563EB',
  },
  totalBox: {
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    padding: 14,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    alignItems: 'center',
  },
  totalAmountText: {
    fontSize: 20,
    fontWeight: '900',
    color: '#15803D',
  },
  uploadBtn: {
    backgroundColor: '#EFF6FF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    alignItems: 'center',
    marginBottom: 10,
  },
  uploadBtnText: {
    color: '#2563EB',
    fontSize: 13,
    fontWeight: '800',
  },
  imagePreviewContainer: {
    alignItems: 'center',
    marginBottom: 12,
  },
  imagePreview: {
    width: '100%',
    height: 180,
    borderRadius: 10,
    resizeMode: 'cover',
  },
  removeImageBtn: {
    marginTop: 6,
    paddingVertical: 4,
    paddingHorizontal: 12,
    backgroundColor: '#FEE2E2',
    borderRadius: 6,
  },
  removeImageText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '700',
  },
  submitBtn: {
    backgroundColor: '#2563EB',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  submitText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 15,
  },
  historyRow: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  historyAmount: {
    color: '#0F172A',
    fontWeight: '700',
    fontSize: 15,
  },
  utrText: {
    color: '#2563EB',
    fontSize: 12,
    marginTop: 2,
    fontWeight: '600',
  },
  historyDate: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  bgApproved: { backgroundColor: '#DCFCE7' },
  bgPending: { backgroundColor: '#FEF3C7' },
  bgRejected: { backgroundColor: '#FEE2E2' },
  badgeText: {
    color: '#15803D',
    fontSize: 11,
    fontWeight: '800',
  },
  /* MODAL STYLES FOR COMPACT DROPDOWNS */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxHeight: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  selectedModalItem: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  modalItemText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
  },
  selectedModalItemText: {
    color: '#FFFFFF',
  },
});
