import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  Image,
  FlatList,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { apiRequest } from '../../src/services/api.client';
import { HamburgerMenu } from '../../src/components/HamburgerMenu';
import { STUDENT_MENU } from '../../src/constants/menuItems';
import { sortItemsNaturally } from '../../src/utils/sorting';

import {
  HOURLY_TIME_SLOTS,
  getTimeSlotLabel,
  calculateSlotDurationHours,
  calculateSlotPricing,
  getValidToTimeSlots,
  validateMonths,
  parseTimeToHourNum,
} from '../../src/utils/timeSlots';

export default function SeatsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [selectedSeat, setSelectedSeat] = useState<any | null>(null);
  const [selectedFloor, setSelectedFloor] = useState<number | null>(null);

  // Time & duration selection (default 16:00 to 18:00, 1 month)
  const [fromTime, setFromTime] = useState<string>('16:00');
  const [toTime, setToTime] = useState<string>('18:00');
  const [monthsInput, setMonthsInput] = useState<string>('1');
  const [months, setMonths] = useState<number>(1);
  const [utrNumber, setUtrNumber] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [viewingImageUri, setViewingImageUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [showFromModal, setShowFromModal] = useState(false);
  const [showToModal, setShowToModal] = useState(false);

  const { data: seatsData, isLoading: loadingSeats, isError: seatsError, error: seatErr } = useQuery({
    queryKey: ['student-seats-list'],
    queryFn: async () => {
      const res = await apiRequest('/seats');
      if (!res.success) throw new Error(res.error?.message || 'Failed to load seats');
      return res.data;
    },
  });

  // Fetch Student Dashboard / Profile (for current assigned seat)
  const { data: dashboardData } = useQuery({
    queryKey: ['student-dashboard'],
    queryFn: async () => {
      const res = await apiRequest('/students/dashboard');
      return res.data;
    },
  });

  // Fetch Student Payment History (to check single pending reservation rule)
  const { data: paymentHistory } = useQuery({
    queryKey: ['student-payment-history'],
    queryFn: async () => {
      const res = await apiRequest('/payments/history');
      return res.data || [];
    },
  });

  // Fetch Local Library Payment Master
  const { data: paymentMaster } = useQuery({
    queryKey: ['payment-plans'],
    queryFn: async () => {
      const res = await apiRequest('/payments/plans');
      return res.data || null;
    },
  });

  const seats = seatsData || [];
  const currentSeat = dashboardData?.student?.currentSeat;
  const currentSeatId = currentSeat?._id || currentSeat;

  // Extract unique available floors (sorted)
  const availableFloors: number[] = Array.from(
    new Set<number>(seats.map((s: any) => Number(s.floor || 1)))
  ).sort((a: number, b: number) => a - b);

  // If no floors found in dataset, default to [1]
  const floorsList: number[] = availableFloors.length > 0 ? availableFloors : [1];

  // Calculate statistics per floor
  const floorStats: Array<{ floor: number; total: number; available: number }> = floorsList.map((fl: number) => {
    const floorSeats = seats.filter((s: any) => Number(s.floor || 1) === fl);
    const available = floorSeats.filter((s: any) => s.status === 'AVAILABLE').length;
    return {
      floor: fl,
      total: floorSeats.length,
      available,
    };
  });

  // Display seats for selected floor only (sorted in natural numeric order)
  const displayedSeats = selectedFloor === null
    ? []
    : sortItemsNaturally(
      seats.filter((seat: any) => {
        const seatFloor = Number(seat.floor || 1);
        if (seatFloor !== selectedFloor) return false;
        const isAssignedToMe = currentSeatId && seat._id.toString() === currentSeatId.toString();
        return seat.status === 'AVAILABLE' || isAssignedToMe;
      }),
      'seatNumber'
    );

  // Check if student has a pending seat reservation payment
  const pendingSeatPayment = (paymentHistory || []).find(
    (p: any) => p.paymentType === 'SEAT' && p.status === 'PENDING'
  );
  const hasPendingReservation = !!pendingSeatPayment;

  const pickImage = async (shouldCrop = false) => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Camera roll permissions are required to upload payment screenshot.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.9,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        setImageUri(result.assets[0].uri);
      }
    } catch (err: any) {
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const handleOpenReservation = (seat: any) => {
    setSelectedSeat(seat);
    setUtrNumber('');
    setImageUri(null);
  };

  const handleMonthsInputChange = (text: string) => {
    const cleanText = text.replace(/[^0-9]/g, '');
    setMonthsInput(cleanText);
    const { isValid, parsed } = validateMonths(cleanText);
    if (isValid) {
      setMonths(parsed);
    }
  };

  const handleSubmitReservation = async () => {
    if (!selectedSeat) return;

    if (hasPendingReservation) {
      Alert.alert(
        'Pending Reservation Exists',
        'You already have a pending reservation request. Please wait for Local Admin approval before submitting a new reservation.'
      );
      return;
    }

    const { isValid: isMonthsValid, parsed: validMonthsCount, errorMsg } = validateMonths(monthsInput);
    if (!isMonthsValid) {
      Alert.alert('Invalid Duration', errorMsg || 'Please enter a valid whole number of months between 1 and 50.');
      return;
    }

    const calculatedHours = calculateSlotDurationHours(fromTime, toTime);
    if (calculatedHours < 1) {
      Alert.alert('Invalid Time Slot', 'To Time must be at least 1 hour after From Time.');
      return;
    }

    if (!imageUri) {
      Alert.alert('Payment Proof Required', 'Please upload a screenshot of your payment receipt.');
      return;
    }

    setSubmitting(true);
    try {
      const { seatCharge } = calculateSlotPricing(
        paymentMaster,
        calculatedHours,
        validMonthsCount,
        true,
        false,
        selectedSeat.priceMonthly
      );
      const calculatedAmount = Math.max(0, seatCharge);

      const formData = new FormData();
      formData.append('paymentType', 'SEAT');
      if (selectedSeat._id && !selectedSeat._id.startsWith('fallback-')) {
        formData.append('targetSeatId', selectedSeat._id);
      }
      formData.append('amount', calculatedAmount.toString());
      formData.append('hours', calculatedHours.toString());
      formData.append('months', validMonthsCount.toString());
      formData.append('fromTime', fromTime);
      formData.append('toTime', toTime);
      if (utrNumber.trim()) {
        formData.append('utrNumber', utrNumber.trim());
      }

      const filename = imageUri.split('/').pop() || 'proof.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';

      formData.append('proofFile', {
        uri: imageUri,
        name: filename,
        type,
      } as any);

      const res = await apiRequest('/payments/submit-manual', {
        method: 'POST',
        body: formData,
      });

      if (res.success) {
        Alert.alert(
          'Reservation Request Submitted! ⏳',
          'Your seat reservation request has been submitted and is pending Local Admin approval. Your seat will be allocated once approved.'
        );
        setSelectedSeat(null);
        queryClient.invalidateQueries({ queryKey: ['student-seats-list'] });
        queryClient.invalidateQueries({ queryKey: ['student-payment-history'] });
      } else {
        Alert.alert('Reservation Failed', res.error?.message || 'Failed to submit reservation.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Network error submitting payment proof.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingSeats) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar style="dark" backgroundColor="#FFFFFF" />
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  const isSeatDisabled = dashboardData?.library?.featureFlags?.enableReservedSeats === false;

  if (seatsError || isSeatDisabled) {
    return (
      <View style={styles.container}>
        <StatusBar style="dark" backgroundColor="#FFFFFF" />
        <HamburgerMenu title="Seat Reservation" role="STUDENT" items={STUDENT_MENU} />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <Text style={{ fontSize: 48, marginBottom: 12 }}>🪑</Text>
          <Text style={{ fontSize: 18, fontWeight: '800', color: '#DC2626', marginBottom: 8, textAlign: 'center' }}>
            Seat Reservation Disabled
          </Text>
          <Text style={{ fontSize: 14, color: '#64748B', textAlign: 'center', marginBottom: 20 }}>
            {(seatErr as Error)?.message || 'Seat reservation functionality is currently disabled for your library.'}
          </Text>
          <TouchableOpacity
            style={{ backgroundColor: '#2563EB', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10 }}
            onPress={() => router.push('/(student)')}
          >
            <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 14 }}>Return to Home</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const renderSeatItem = ({ item: seat }: { item: any }) => {
    const isAssignedToMe = currentSeatId && seat._id.toString() === currentSeatId.toString();
    const isAvailable = seat.status === 'AVAILABLE' && !isAssignedToMe;
    const isOccupied = !isAvailable && !isAssignedToMe;

    return (
      <TouchableOpacity
        key={seat._id}
        style={[
          styles.seatCard,
          isAssignedToMe && styles.cardCurrent,
          isAvailable && styles.cardAvailable,
          isOccupied && styles.cardOccupied,
        ]}
        disabled={!isAvailable || hasPendingReservation}
        onPress={() => handleOpenReservation(seat)}
        activeOpacity={0.7}
      >
        <Text style={styles.seatNum}>{seat.seatNumber}</Text>
        <Text style={styles.floorText}>Floor {seat.floor || 1}</Text>
        <Text style={styles.seatPrice}>₹{seat.priceMonthly}/mo</Text>

        <View
          style={[
            styles.badge,
            isAssignedToMe
              ? styles.badgeCurrent
              : isAvailable
                ? styles.badgeAvailable
                : styles.badgeOccupied,
          ]}
        >
          <Text
            style={[
              styles.badgeText,
              isAssignedToMe
                ? styles.textCurrent
                : isAvailable
                  ? styles.textAvailable
                  : styles.textOccupied,
            ]}
          >
            {isAssignedToMe ? 'YOUR SEAT' : isAvailable ? 'AVAILABLE' : 'BOOKED'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderHeader = () => (
    <View style={styles.headerContent}>
      <Text style={styles.headerTitle}>Seat Reservation</Text>
      <Text style={styles.subTitle}>Select your desired time slot, choose a floor, and pick an available seat</Text>

      {/* Pending Request Rule Banner */}
      {hasPendingReservation && (
        <View style={styles.pendingBanner}>
          <Text style={styles.pendingBannerTitle}>⏳ Pending Reservation Approval</Text>
          <Text style={styles.pendingBannerText}>
            You have a pending reservation request waiting for Local Admin approval. You can submit another reservation request once your pending request is approved or rejected.
          </Text>
        </View>
      )}

      {/* Time Slot & Duration Selection Bar */}
      <View style={styles.timeSlotCard}>
        <Text style={styles.cardSectionTitle}>1. Select Time Slot & Duration</Text>

        {/* From Time & To Time Pickers */}
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 8, marginBottom: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: '#64748B', marginBottom: 4 }}>From Time 🕒</Text>
            <TouchableOpacity
              style={styles.dropdownBtn}
              onPress={() => setShowFromModal(true)}
            >
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F172A' }}>
                {getTimeSlotLabel(fromTime)}
              </Text>
              <Text style={{ fontSize: 11, color: '#64748B' }}>▼</Text>
            </TouchableOpacity>
          </View>

          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: '#64748B', marginBottom: 4 }}>To Time 🕒</Text>
            <TouchableOpacity
              style={styles.dropdownBtn}
              onPress={() => setShowToModal(true)}
            >
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F172A' }}>
                {getTimeSlotLabel(toTime)}
              </Text>
              <Text style={{ fontSize: 11, color: '#64748B' }}>▼</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Duration Preset Chips */}
        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
          {[1, 2, 3, 6, 12].map((m) => (
            <TouchableOpacity
              key={m}
              style={[
                styles.durationChip,
                months === m && styles.durationChipActive,
              ]}
              onPress={() => {
                setMonths(m);
                setMonthsInput(String(m));
              }}
            >
              <Text style={[styles.durationChipText, months === m && styles.durationChipTextActive]}>
                {m} {m === 1 ? 'Mo' : 'Mos'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
          Duration: {calculateSlotDurationHours(fromTime, toTime)} hrs/day • {months} {months === 1 ? 'month' : 'months'}
        </Text>
      </View>

      {/* Floor Filter Bar (No 'All Floors' option) */}
      <View style={styles.floorFilterSection}>
        <Text style={styles.cardSectionTitle}>2. Select Floor</Text>
        <Text style={styles.floorFilterSub}>Tap a floor below to view available seats</Text>

        <View style={styles.floorRow}>
          {floorStats.map((stat: { floor: number; total: number; available: number }) => {
            const isSelected = selectedFloor === stat.floor;
            return (
              <TouchableOpacity
                key={`floor-tab-${stat.floor}`}
                style={[
                  styles.floorTabCard,
                  isSelected && styles.floorTabCardActive,
                ]}
                onPress={() => setSelectedFloor(stat.floor)}
                activeOpacity={0.8}
              >
                <Text style={[styles.floorTabTitle, isSelected && styles.floorTabTitleActive]}>
                  Floor {stat.floor}
                </Text>
                <View style={[styles.floorBadge, isSelected ? styles.floorBadgeActive : styles.floorBadgeInactive]}>
                  <Text style={[styles.floorBadgeText, isSelected && styles.floorBadgeTextActive]}>
                    {stat.available} Available
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Legend Row (Shown only when a floor is selected) */}
      {selectedFloor !== null && (
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, styles.bgAvailable]} />
            <Text style={styles.legendText}>Available</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, styles.bgOccupied]} />
            <Text style={styles.legendText}>Booked</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, styles.bgCurrent]} />
            <Text style={styles.legendText}>Your Seat</Text>
          </View>
        </View>
      )}

    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar style="dark" backgroundColor="#FFFFFF" />
      <HamburgerMenu title="Seat Reservation" role="STUDENT" items={STUDENT_MENU} />

      <FlatList
        key={selectedFloor === null ? 'seats-no-floor' : `seats-floor-${selectedFloor}`}
        data={displayedSeats}
        keyExtractor={(item: any) => item._id}
        numColumns={selectedFloor === null ? 1 : 3}
        columnWrapperStyle={selectedFloor !== null ? styles.columnWrapper : undefined}
        renderItem={renderSeatItem}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          selectedFloor !== null ? (
            <View style={styles.emptyContainer}>
              <Text style={{ fontSize: 32, marginBottom: 8 }}>🪑</Text>
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#475569' }}>
                No Available Seats Found
              </Text>
              <Text style={{ fontSize: 12, color: '#94A3B8', marginTop: 4, textAlign: 'center' }}>
                There are no available seats on Floor {selectedFloor} for the selected criteria.
              </Text>
            </View>
          ) : null
        }
        contentContainerStyle={styles.listContent}
        initialNumToRender={18}
        maxToRenderPerBatch={24}
        windowSize={5}
        removeClippedSubviews={true}
      />

      {/* Modal: Seat Reservation & Payment Upload */}
      <Modal
        animationType="slide"
        transparent
        visible={!!selectedSeat}
        onRequestClose={() => setSelectedSeat(null)}
      >
        {selectedSeat && (
          <View style={styles.modalOverlay}>
            <StatusBar style="dark" backgroundColor="#FFFFFF" />
            <SafeAreaView style={styles.modalSafeArea} edges={['top', 'bottom', 'left', 'right']}>
              <View style={styles.modalContainer}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Reserve Seat {selectedSeat.seatNumber}</Text>
                  <TouchableOpacity onPress={() => setSelectedSeat(null)} style={styles.closeBtn}>
                    <Text style={styles.closeBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>

                <ScrollView contentContainerStyle={styles.modalBody} showsVerticalScrollIndicator={false}>
                  {(() => {
                    const calculatedHours = calculateSlotDurationHours(fromTime, toTime);
                    const { seatCharge } = calculateSlotPricing(
                      paymentMaster,
                      calculatedHours,
                      months,
                      true,
                      false,
                      selectedSeat.priceMonthly
                    );

                    return (
                      <View style={styles.priceSummaryBox}>
                        <Text style={styles.priceSummaryLabel}>Seat Location & Price</Text>
                        <Text style={styles.priceSummaryTitle}>
                          Seat {selectedSeat.seatNumber} • Floor {selectedSeat.floor || 1}
                        </Text>
                        <Text style={{ fontSize: 13, color: '#475569', marginTop: 4, fontWeight: '600' }}>
                          Time Slot: {getTimeSlotLabel(fromTime)} → {getTimeSlotLabel(toTime)} ({calculatedHours} hrs/day) • {months} {months === 1 ? 'month' : 'months'}
                        </Text>
                        <Text style={styles.priceSummaryAmount}>Total: ₹{seatCharge}</Text>
                      </View>
                    );
                  })()}

                  {/* From Time & To Time Pickers */}
                  <Text style={styles.label}>1. Daily Study Time Slot (Hourly Dropdowns)</Text>
                  <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: '#64748B', marginBottom: 4 }}>From Time 🕒</Text>
                      <TouchableOpacity
                        style={styles.dropdownBtn}
                        onPress={() => setShowFromModal(true)}
                      >
                        <Text style={{ fontSize: 14, fontWeight: '700', color: '#0F172A' }}>
                          {getTimeSlotLabel(fromTime)}
                        </Text>
                        <Text style={{ fontSize: 12, color: '#64748B' }}>▼</Text>
                      </TouchableOpacity>
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: '#64748B', marginBottom: 4 }}>To Time 🕒</Text>
                      <TouchableOpacity
                        style={styles.dropdownBtn}
                        onPress={() => setShowToModal(true)}
                      >
                        <Text style={{ fontSize: 14, fontWeight: '700', color: '#0F172A' }}>
                          {getTimeSlotLabel(toTime)}
                        </Text>
                        <Text style={{ fontSize: 12, color: '#64748B' }}>▼</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Duration Months Selector & Direct Numeric Input */}
                  <Text style={styles.label}>2. Reservation Duration (Months: 1–50)</Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                    {[1, 2, 3, 6, 12].map((m) => (
                      <TouchableOpacity
                        key={m}
                        style={[
                          { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: '#CBD5E1', backgroundColor: '#F8FAFC', alignItems: 'center' },
                          months === m && { backgroundColor: '#2563EB', borderColor: '#1D4ED8' },
                        ]}
                        onPress={() => {
                          setMonths(m);
                          setMonthsInput(String(m));
                        }}
                      >
                        <Text style={[{ fontSize: 13, fontWeight: '700', color: '#334155' }, months === m && { color: '#FFFFFF', fontWeight: '800' }]}>
                          {m} {m === 1 ? 'Mo' : 'Mos'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: '#475569' }}>Custom Months (1–50):</Text>
                    <TextInput
                      style={[styles.input, { flex: 1, marginBottom: 0, paddingVertical: 8, fontWeight: '700' }]}
                      placeholder="Enter 1 to 50"
                      placeholderTextColor="#94A3B8"
                      keyboardType="number-pad"
                      maxLength={2}
                      value={monthsInput}
                      onChangeText={handleMonthsInputChange}
                    />
                  </View>

                  <Text style={styles.label}>UTR / Transaction Reference (Optional)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter 12-digit UTR or Transaction Ref"
                    placeholderTextColor="#94A3B8"
                    value={utrNumber}
                    onChangeText={setUtrNumber}
                  />

                  <Text style={styles.label}>Upload Payment Proof Screenshot *</Text>
                  {imageUri ? (
                    <View style={styles.imagePreviewCard}>
                      <Image source={{ uri: imageUri }} style={styles.previewImage} resizeMode="contain" />
                      <View style={{ flexDirection: 'row', gap: 10, marginTop: 10, paddingHorizontal: 12, paddingBottom: 12 }}>
                        <TouchableOpacity
                          style={[styles.changeImageBtn, { backgroundColor: '#2563EB', flex: 1 }]}
                          onPress={() => setViewingImageUri(imageUri)}
                        >
                          <Text style={[styles.changeImageText, { color: '#FFFFFF' }]}>View</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.changeImageBtn, { backgroundColor: '#EF4444', flex: 1 }]}
                          onPress={() => setImageUri(null)}
                        >
                          <Text style={[styles.changeImageText, { color: '#FFFFFF' }]}>Reset</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <TouchableOpacity style={styles.uploadBox} onPress={() => pickImage(false)}>
                      <Text style={styles.uploadIcon}>📷</Text>
                      <Text style={styles.uploadTitle}>Tap to Upload Full Receipt Screenshot</Text>
                      <Text style={styles.uploadSub}>Select payment receipt screenshot directly from gallery</Text>
                    </TouchableOpacity>
                  )}

                  <View style={styles.noticeBox}>
                    <Text style={styles.noticeText}>
                      ℹ️ Your reservation request will be marked as **Pending Approval**. The seat will be officially allocated to you once the Local Admin approves your payment proof.
                    </Text>
                  </View>

                  <View style={styles.modalActions}>
                    <TouchableOpacity style={styles.cancelModalBtn} onPress={() => setSelectedSeat(null)}>
                      <Text style={styles.cancelModalText}>Cancel</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.submitModalBtn, (submitting || !imageUri || hasPendingReservation) && styles.btnDisabled]}
                      onPress={handleSubmitReservation}
                      disabled={submitting || !imageUri || hasPendingReservation}
                    >
                      {submitting ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <Text style={styles.submitModalText}>Submit Reservation Request</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              </View>
            </SafeAreaView>
          </View>
        )}
      </Modal>

      {/* From Time Dropdown Modal */}
      <Modal animationType="fade" transparent visible={showFromModal} onRequestClose={() => setShowFromModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowFromModal(false)}>
          <View style={{ width: '85%', maxHeight: '60%', backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16 }}>
            <Text style={{ fontSize: 16, fontWeight: '800', color: '#0F172A', marginBottom: 12 }}>Select From Time 🕒</Text>
            <ScrollView showsVerticalScrollIndicator={true}>
              {HOURLY_TIME_SLOTS.slice(0, HOURLY_TIME_SLOTS.length - 1).map((slot) => (
                <TouchableOpacity
                  key={`from-${slot.value}`}
                  style={{
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                    borderRadius: 8,
                    backgroundColor: fromTime === slot.value ? '#EFF6FF' : 'transparent',
                    borderBottomWidth: 1,
                    borderBottomColor: '#F1F5F9',
                  }}
                  onPress={() => {
                    setFromTime(slot.value);
                    setShowFromModal(false);
                    const fNum = parseTimeToHourNum(slot.value);
                    const tNum = parseTimeToHourNum(toTime);
                    if (tNum <= fNum) {
                      const validTo = getValidToTimeSlots(slot.value);
                      if (validTo.length > 0) {
                        setToTime(validTo[0].value);
                      }
                    }
                  }}
                >
                  <Text style={{ fontSize: 15, fontWeight: fromTime === slot.value ? '800' : '600', color: fromTime === slot.value ? '#2563EB' : '#1E293B' }}>
                    {slot.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* To Time Dropdown Modal */}
      <Modal animationType="fade" transparent visible={showToModal} onRequestClose={() => setShowToModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowToModal(false)}>
          <View style={{ width: '85%', maxHeight: '60%', backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16 }}>
            <Text style={{ fontSize: 16, fontWeight: '800', color: '#0F172A', marginBottom: 12 }}>Select To Time 🕒 (Must be {'>'} From Time)</Text>
            <ScrollView showsVerticalScrollIndicator={true}>
              {getValidToTimeSlots(fromTime).map((slot) => (
                <TouchableOpacity
                  key={`to-${slot.value}`}
                  style={{
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                    borderRadius: 8,
                    backgroundColor: toTime === slot.value ? '#EFF6FF' : 'transparent',
                    borderBottomWidth: 1,
                    borderBottomColor: '#F1F5F9',
                  }}
                  onPress={() => {
                    setToTime(slot.value);
                    setShowToModal(false);
                  }}
                >
                  <Text style={{ fontSize: 15, fontWeight: toTime === slot.value ? '800' : '600', color: toTime === slot.value ? '#2563EB' : '#1E293B' }}>
                    {slot.label}
                  </Text>
                </TouchableOpacity>
              ))}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  headerContent: {
    marginBottom: 12,
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
  pendingBanner: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  pendingBannerTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#B45309',
  },
  pendingBannerText: {
    fontSize: 12,
    color: '#92400E',
    marginTop: 4,
    lineHeight: 16,
  },
  timeSlotCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardSectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  dropdownBtn: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  durationChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
  },
  durationChipActive: {
    backgroundColor: '#2563EB',
    borderColor: '#1D4ED8',
  },
  durationChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  durationChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  floorFilterSection: {
    marginBottom: 16,
  },
  floorFilterSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    marginBottom: 10,
  },
  floorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  floorTabCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  floorTabCardActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2563EB',
  },
  floorTabTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#334155',
  },
  floorTabTitleActive: {
    color: '#1D4ED8',
  },
  floorBadge: {
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  floorBadgeInactive: {
    backgroundColor: '#F1F5F9',
  },
  floorBadgeActive: {
    backgroundColor: '#DBEAFE',
  },
  floorBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  floorBadgeTextActive: {
    color: '#1E40AF',
  },
  promptCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    marginVertical: 8,
  },
  promptIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  promptTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  promptSub: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
  },
  legendRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
    justifyContent: 'center',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '700',
  },
  bgAvailable: { backgroundColor: '#10B981' },
  bgOccupied: { backgroundColor: '#94A3B8' },
  bgCurrent: { backgroundColor: '#2563EB' },
  columnWrapper: {
    justifyContent: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  seatCard: {
    width: '31.2%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardAvailable: {
    borderColor: '#10B981',
    backgroundColor: '#FFFFFF',
  },
  cardOccupied: {
    borderColor: '#CBD5E1',
    backgroundColor: '#F1F5F9',
    opacity: 0.7,
  },
  cardCurrent: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  seatNum: {
    color: '#0F172A',
    fontWeight: '800',
    fontSize: 16,
  },
  floorText: {
    color: '#64748B',
    fontSize: 10,
    marginTop: 2,
  },
  seatPrice: {
    color: '#16A34A',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 4,
  },
  badge: {
    marginTop: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeAvailable: { backgroundColor: '#DCFCE7' },
  badgeOccupied: { backgroundColor: '#E2E8F0' },
  badgeCurrent: { backgroundColor: '#DBEAFE' },
  badgeText: { fontSize: 9, fontWeight: '800' },
  textAvailable: { color: '#15803D' },
  textOccupied: { color: '#64748B' },
  textCurrent: { color: '#1D4ED8' },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* MODAL STYLES */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
  },
  modalSafeArea: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
    backgroundColor: 'transparent',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    maxHeight: '94%',
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  closeBtn: { padding: 4 },
  closeBtnText: { fontSize: 18, color: '#64748B', fontWeight: '800' },
  modalBody: { padding: 20, backgroundColor: '#FFFFFF' },
  priceSummaryBox: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  priceSummaryLabel: { fontSize: 10, fontWeight: '800', color: '#2563EB', textTransform: 'uppercase' },
  priceSummaryTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A', marginTop: 2 },
  priceSummaryAmount: { fontSize: 18, fontWeight: '900', color: '#16A34A', marginTop: 4 },
  label: { fontSize: 12, fontWeight: '700', color: '#334155', marginBottom: 6, marginTop: 6 },
  input: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#0F172A',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    marginBottom: 12,
  },
  uploadBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 2,
    borderColor: '#93C5FD',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
  },
  uploadIcon: { fontSize: 28, marginBottom: 4 },
  uploadTitle: { fontSize: 14, fontWeight: '800', color: '#2563EB' },
  uploadSub: { fontSize: 11, color: '#64748B', marginTop: 2 },
  imagePreviewCard: { alignItems: 'center', marginBottom: 16 },
  previewImage: { width: '100%', height: 180, borderRadius: 10, resizeMode: 'contain', backgroundColor: '#0F172A' },
  previewActionRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  changeImageBtn: { flex: 1, paddingVertical: 8, paddingHorizontal: 10, backgroundColor: '#E0F2FE', borderRadius: 8, borderWidth: 1, borderColor: '#BAE6FD', alignItems: 'center' },
  changeImageText: { color: '#0284C7', fontSize: 12, fontWeight: '800' },
  noticeBox: { backgroundColor: '#F1F5F9', padding: 12, borderRadius: 8, marginBottom: 16 },
  noticeText: { fontSize: 11, color: '#475569', lineHeight: 15 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 4, marginBottom: 10 },
  cancelModalBtn: { flex: 1, backgroundColor: '#E2E8F0', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  cancelModalText: { color: '#475569', fontWeight: '700', fontSize: 13 },
  submitModalBtn: { flex: 2, backgroundColor: '#2563EB', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  submitModalText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  btnDisabled: { opacity: 0.6 },
});
