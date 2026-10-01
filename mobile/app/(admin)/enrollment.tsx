import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { apiRequest } from '../../src/services/api.client';
import { HamburgerMenu } from '../../src/components/HamburgerMenu';
import { LOCAL_ADMIN_MENU } from '../../src/constants/menuItems';
import { sortItemsNaturally } from '../../src/utils/sorting';
import * as Clipboard from 'expo-clipboard';

import {
  HOURLY_TIME_SLOTS,
  getTimeSlotLabel,
  calculateSlotDurationHours,
  calculateSlotPricing,
  getValidToTimeSlots,
  parseTimeToHourNum,
} from '../../src/utils/timeSlots';

interface IPaymentMaster {
  monthlyFee: number;
  quarterlyFee: number;
  halfYearlyFee: number;
  annualFee: number;
  seatMonthlyFee?: number;
  lockerMonthlyFee: number;
  referralRewardAmount: number;
  libraryHourlyRates?: number[];
  seatHourlyRates?: number[];
  lockerHourlyRates?: number[];
}

interface ISeatItem {
  _id: string;
  seatNumber: string;
  floor: number;
  status: string;
  priceMonthly?: number;
  isAvailableInSlot?: boolean;
}

interface ILockerItem {
  _id: string;
  lockerNumber: string;
  floor: number;
  status: string;
  priceMonthly?: number;
  isAvailableInSlot?: boolean;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const WEEKDAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(dateStr: string): string {
  const parts = dateStr.trim().split('-').map(Number);
  if (parts.length !== 3) return dateStr;
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  if (isNaN(d.getTime())) return dateStr;
  return `${d.getDate()} ${MONTH_NAMES[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

export default function EnrollmentScreen() {
  const today = useMemo(() => new Date(), []);
  const todayMidnight = useMemo(() => {
    return new Date(today.getFullYear(), today.getMonth(), today.getDate());
  }, [today]);

  const defaultToDate = useMemo(() => addMonths(today, 1), [today]);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [aadharNumber, setAadharNumber] = useState('');

  // Date Pickers state (YYYY-MM-DD)
  const [fromDate, setFromDate] = useState(formatDate(today));
  const [toDate, setToDate] = useState(formatDate(defaultToDate));

  // Calendar Modal state
  const [showDatePickerModal, setShowDatePickerModal] = useState(false);
  const [datePickerTarget, setDatePickerTarget] = useState<'FROM' | 'TO'>('FROM');
  const [calendarYear, setCalendarYear] = useState(today.getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(today.getMonth());

  const [profileImage, setProfileImage] = useState<{
    uri: string;
    type?: string;
    fileName?: string;
    fileSize?: number;
  } | null>(null);

  // Time Slot selection states
  const [fromTime, setFromTime] = useState<string>('06:00');
  const [toTime, setToTime] = useState<string>('23:00');
  const [showFromTimeModal, setShowFromTimeModal] = useState(false);
  const [showToTimeModal, setShowToTimeModal] = useState(false);

  // Time Slot Capacity Data
  const [capacity, setCapacity] = useState<{
    totalSeats: number;
    occupiedSeatsCount: number;
    availableSeatsCount: number;
    totalLockers: number;
    occupiedLockersCount: number;
    availableLockersCount: number;
  } | null>(null);

  // Seat & Locker states
  const [selectedSeatId, setSelectedSeatId] = useState<string | null>(null);
  const [selectedLockerId, setSelectedLockerId] = useState<string | null>(null);

  // Floor Collapse/Expand states (Default Floor 1 expanded, others collapsed)
  const [expandedSeatFloors, setExpandedSeatFloors] = useState<Record<number, boolean>>({ 1: true });
  const [expandedLockerFloors, setExpandedLockerFloors] = useState<Record<number, boolean>>({ 1: true });

  // Created Credentials Modal State
  const [createdCredentials, setCreatedCredentials] = useState<{
    email: string;
    password: string;
    phone: string;
    fullName: string;
    studentIdCardNo?: string;
  } | null>(null);
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [copiedState, setCopiedState] = useState<'NONE' | 'ALL' | 'EMAIL' | 'PASSWORD'>('NONE');

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

  const handleCopyAction = async (target: 'ALL' | 'EMAIL' | 'PASSWORD', text: string) => {
    const success = await copyToClipboard(text);
    setCopiedState(target);
    setTimeout(() => {
      setCopiedState('NONE');
    }, 2500);

    if (!success) {
      Alert.alert('Student Credentials', text);
    }
  };

  // Payment method
  const [paymentMethod, setPaymentMethod] = useState<'UPI' | 'CASH' | 'CARD'>('UPI');

  // Feature Flags loaded from backend
  const [featureFlags, setFeatureFlags] = useState<{
    enableReservedSeats?: boolean;
    enableLockers?: boolean;
    enableReferrals?: boolean;
  }>({ enableReservedSeats: true, enableLockers: true, enableReferrals: true });

  // Options loaded from backend
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [paymentMaster, setPaymentMaster] = useState<IPaymentMaster | null>(null);
  const [seats, setSeats] = useState<ISeatItem[]>([]);
  const [lockers, setLockers] = useState<ILockerItem[]>([]);

  // Referral Coupon State
  const [referredByCode, setReferredByCode] = useState('');
  const [appliedReferral, setAppliedReferral] = useState<{
    code: string;
    discountAmount: number;
    referrerName: string;
  } | null>(null);
  const [validatingReferral, setValidatingReferral] = useState(false);

  const handleApplyReferral = async () => {
    if (!referredByCode.trim()) {
      Alert.alert('Referral Code Required', 'Please enter a referral coupon code.');
      return;
    }
    setValidatingReferral(true);
    try {
      const res = await apiRequest(`/admin/validate-referral?code=${encodeURIComponent(referredByCode.trim())}`);
      if (res.success && res.data) {
        setAppliedReferral({
          code: res.data.referralCode,
          discountAmount: res.data.discountAmount,
          referrerName: res.data.referrerName,
        });
        Alert.alert('Referral Coupon Applied! 🎉', res.data.message || `₹${res.data.discountAmount} discount applied.`);
      } else {
        setAppliedReferral(null);
        Alert.alert('Invalid Referral Coupon', res.error?.message || 'Referral coupon is invalid for this library.');
      }
    } catch (err: any) {
      setAppliedReferral(null);
      Alert.alert('Referral Error', err.message || 'Failed to validate referral coupon.');
    } finally {
      setValidatingReferral(false);
    }
  };

  const handleRemoveReferral = () => {
    setAppliedReferral(null);
    setReferredByCode('');
  };

  const [submitting, setSubmitting] = useState(false);

  // Minimum allowed To Date (From Date + 1 month)
  const minAllowedToDate = useMemo(() => {
    const fromParts = fromDate.trim().split('-').map(Number);
    if (fromParts.length !== 3) return addMonths(todayMidnight, 1);
    const from = new Date(fromParts[0], fromParts[1] - 1, fromParts[2]);
    if (isNaN(from.getTime())) return addMonths(todayMidnight, 1);
    const minTo = new Date(from);
    minTo.setMonth(minTo.getMonth() + 1);
    return minTo;
  }, [fromDate, todayMidnight]);

  // Duration & Validation Logic
  const { diffDays, monthsFactor, isDurationValid, durationErrorMsg } = useMemo(() => {
    const fromParts = fromDate.trim().split('-').map(Number);
    const toParts = toDate.trim().split('-').map(Number);

    if (fromParts.length !== 3 || toParts.length !== 3) {
      return { diffDays: 0, monthsFactor: 0, isDurationValid: false, durationErrorMsg: 'Please select valid dates.' };
    }

    const from = new Date(fromParts[0], fromParts[1] - 1, fromParts[2]);
    const to = new Date(toParts[0], toParts[1] - 1, toParts[2]);

    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
      return { diffDays: 0, monthsFactor: 0, isDurationValid: false, durationErrorMsg: 'Please select valid From Date and To Date.' };
    }

    if (from < todayMidnight) {
      return { diffDays: 0, monthsFactor: 0, isDurationValid: false, durationErrorMsg: 'From Date cannot be in the past.' };
    }

    if (to < minAllowedToDate) {
      return {
        diffDays: 0,
        monthsFactor: 0,
        isDurationValid: false,
        durationErrorMsg: 'To Date must be at least 1 month after From Date.',
      };
    }

    const d1 = new Date(from.getFullYear(), from.getMonth(), from.getDate());
    const d2 = new Date(to.getFullYear(), to.getMonth(), to.getDate());

    let fullMonths = 0;
    let cursor = new Date(d1);

    while (true) {
      const nextMonth = new Date(cursor);
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      if (nextMonth <= d2) {
        fullMonths++;
        cursor = nextMonth;
      } else {
        break;
      }
    }

    const remainingTime = d2.getTime() - cursor.getTime();
    const partialDays = Math.max(0, Math.round(remainingTime / (1000 * 60 * 60 * 24)));
    const factor = Number((fullMonths + partialDays / 30).toFixed(4));
    const timeDiff = Math.abs(to.getTime() - from.getTime());
    const days = Math.max(30, Math.ceil(timeDiff / (1000 * 60 * 60 * 24)));

    return { diffDays: days, monthsFactor: factor, isDurationValid: true, durationErrorMsg: null };
  }, [fromDate, toDate, todayMidnight, minAllowedToDate]);

  // Open Calendar Picker Modal
  const openDatePicker = (target: 'FROM' | 'TO') => {
    setDatePickerTarget(target);
    const currentStr = target === 'FROM' ? fromDate : toDate;
    const parts = currentStr.trim().split('-').map(Number);
    if (parts.length === 3 && !isNaN(parts[0])) {
      setCalendarYear(parts[0]);
      setCalendarMonth(parts[1] - 1);
    } else {
      setCalendarYear(today.getFullYear());
      setCalendarMonth(today.getMonth());
    }
    setShowDatePickerModal(true);
  };

  // Check if calendar day is disabled
  const isCalendarDayDisabled = useCallback(
    (day: number): boolean => {
      const cellDate = new Date(calendarYear, calendarMonth, day);
      if (datePickerTarget === 'FROM') {
        return cellDate < todayMidnight;
      } else {
        return cellDate < minAllowedToDate;
      }
    },
    [calendarYear, calendarMonth, datePickerTarget, todayMidnight, minAllowedToDate]
  );

  // Check if prev month navigation is allowed
  const canNavigatePrevMonth = useMemo(() => {
    const minNavDate = datePickerTarget === 'FROM' ? todayMidnight : minAllowedToDate;
    const navYear = minNavDate.getFullYear();
    const navMonth = minNavDate.getMonth();
    if (calendarYear < navYear) return false;
    if (calendarYear === navYear && calendarMonth <= navMonth) return false;
    return true;
  }, [calendarYear, calendarMonth, datePickerTarget, todayMidnight, minAllowedToDate]);

  // Calendar Day Select Handler
  const handleSelectCalendarDay = (day: number) => {
    if (isCalendarDayDisabled(day)) return;

    const d = new Date(calendarYear, calendarMonth, day);
    const formatted = formatDate(d);
    if (datePickerTarget === 'FROM') {
      setFromDate(formatted);
      // Auto-adjust To Date if current To Date becomes invalid (< From Date + 1 month)
      const newMinTo = new Date(d);
      newMinTo.setMonth(newMinTo.getMonth() + 1);

      const toParts = toDate.trim().split('-').map(Number);
      const currentTo = toParts.length === 3 ? new Date(toParts[0], toParts[1] - 1, toParts[2]) : newMinTo;
      if (currentTo < newMinTo) {
        setToDate(formatDate(newMinTo));
      }
    } else {
      setToDate(formatted);
    }
    setShowDatePickerModal(false);
  };

  // Calendar Days Computation
  const calendarDaysGrid = useMemo(() => {
    const firstDayOfWeek = new Date(calendarYear, calendarMonth, 1).getDay();
    const totalDaysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();

    const days: Array<{ day: number | null; key: string }> = [];
    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push({ day: null, key: `empty-${i}` });
    }
    for (let d = 1; d <= totalDaysInMonth; d++) {
      days.push({ day: d, key: `day-${d}` });
    }
    return days;
  }, [calendarYear, calendarMonth]);

  // Fetch enrollment options when dates or time slots change
  const fetchEnrollmentOptions = useCallback(async () => {
    setLoadingOptions(true);
    try {
      const query = `?fromDate=${encodeURIComponent(fromDate)}&toDate=${encodeURIComponent(toDate)}&fromTime=${encodeURIComponent(fromTime)}&toTime=${encodeURIComponent(toTime)}`;
      const res = await apiRequest(`/admin/enrollment-options${query}`);
      if (res.success && res.data) {
        if (res.data.featureFlags) {
          setFeatureFlags(res.data.featureFlags);
        }
        setPaymentMaster(res.data.paymentMaster || null);
        setCapacity(res.data.capacity || null);
        const seatList: ISeatItem[] = res.data.seats || [];
        const lockerList: ILockerItem[] = res.data.lockers || [];
        setSeats(seatList);
        setLockers(lockerList);

        // Default 1st floor expanded, others collapsed for space efficiency & fast rendering
        setExpandedSeatFloors({ 1: true });
        setExpandedLockerFloors({ 1: true });
      }
    } catch (err) {
      console.error('Failed to load enrollment options', err);
    } finally {
      setLoadingOptions(false);
    }
  }, [fromDate, toDate, fromTime, toTime]);

  useFocusEffect(
    useCallback(() => {
      fetchEnrollmentOptions();
    }, [fetchEnrollmentOptions])
  );

  useEffect(() => {
    fetchEnrollmentOptions();
  }, [fetchEnrollmentOptions]);

  const handlePickImage = async () => {
    try {
      if (typeof ImagePicker.requestMediaLibraryPermissionsAsync === 'function') {
        const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (permissionResult && !permissionResult.granted) {
          Alert.alert('Permission Denied', 'Permission to access gallery is required to upload profile pictures.');
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];

        if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
          Alert.alert('File Too Large', 'Selected image exceeds maximum allowed size of 5MB.');
          return;
        }

        const ext = asset.uri.split('.').pop()?.toLowerCase();
        if (ext && !['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
          Alert.alert('Invalid Format', 'Only JPEG, PNG, and WEBP image formats are supported.');
          return;
        }

        setProfileImage({
          uri: asset.uri,
          type: asset.mimeType || `image/${ext || 'jpeg'}`,
          fileName: asset.fileName || `profile.${ext || 'jpg'}`,
          fileSize: asset.fileSize,
        });
      }
    } catch (err: any) {
      Alert.alert('Image Selection Error', err.message || 'Failed to pick image');
    }
  };

  // Available seats grouped by Floor
  const seatsByFloor = useMemo(() => {
    const map: Record<number, ISeatItem[]> = {};
    seats.filter((s) => s.status === 'AVAILABLE' && s.isAvailableInSlot !== false).forEach((s) => {
      const fl = s.floor || 1;
      if (!map[fl]) map[fl] = [];
      map[fl].push(s);
    });
    Object.keys(map).forEach((flKey) => {
      const fl = Number(flKey);
      map[fl] = sortItemsNaturally(map[fl], 'seatNumber');
    });
    return map;
  }, [seats]);

  const seatFloorNumbers = useMemo(() => {
    return Object.keys(seatsByFloor).map(Number).sort((a, b) => a - b);
  }, [seatsByFloor]);

  // Available lockers grouped by Floor
  const lockersByFloor = useMemo(() => {
    const map: Record<number, ILockerItem[]> = {};
    lockers.filter((l) => l.status === 'AVAILABLE' && l.isAvailableInSlot !== false).forEach((l) => {
      const fl = l.floor || 1;
      if (!map[fl]) map[fl] = [];
      map[fl].push(l);
    });
    Object.keys(map).forEach((flKey) => {
      const fl = Number(flKey);
      map[fl] = sortItemsNaturally(map[fl], 'lockerNumber');
    });
    return map;
  }, [lockers]);

  const lockerFloorNumbers = useMemo(() => {
    return Object.keys(lockersByFloor).map(Number).sort((a, b) => a - b);
  }, [lockers]);

  // Selected seat details
  const selectedSeatObj = useMemo(() => {
    return seats.find((s) => s._id === selectedSeatId) || null;
  }, [seats, selectedSeatId]);

  // Selected locker details
  const selectedLockerObj = useMemo(() => {
    return lockers.find((l) => l._id === selectedLockerId) || null;
  }, [lockers, selectedLockerId]);

  // Dynamic Pricing calculations using Payment & Pricing Master hour-based rates
  const calculatedHours = useMemo(() => {
    return calculateSlotDurationHours(fromTime, toTime);
  }, [fromTime, toTime]);

  const { libraryCharge: baseLibraryCharge, seatCharge, lockerCharge, subtotal: subtotalAmount } = useMemo(() => {
    return calculateSlotPricing(
      paymentMaster,
      calculatedHours,
      monthsFactor,
      !!selectedSeatObj,
      !!selectedLockerObj,
      selectedSeatObj?.priceMonthly,
      selectedLockerObj?.priceMonthly
    );
  }, [paymentMaster, calculatedHours, monthsFactor, selectedSeatObj, selectedLockerObj]);

  const referralDiscount = useMemo(() => {
    return appliedReferral ? appliedReferral.discountAmount : 0;
  }, [appliedReferral]);

  const finalPayableAmount = useMemo(() => {
    return Math.max(0, subtotalAmount - referralDiscount);
  }, [subtotalAmount, referralDiscount]);

  // Quick Preset Helper for Duration
  const setPresetMonths = (monthsToAdd: number) => {
    const fromParts = fromDate.trim().split('-').map(Number);
    const start = fromParts.length === 3 ? new Date(fromParts[0], fromParts[1] - 1, fromParts[2]) : new Date();
    const end = addMonths(start, monthsToAdd);
    setToDate(formatDate(end));
  };

  const toggleSeatFloorExpand = (fl: number) => {
    setExpandedSeatFloors((prev) => ({ ...prev, [fl]: !prev[fl] }));
  };

  const toggleLockerFloorExpand = (fl: number) => {
    setExpandedLockerFloors((prev) => ({ ...prev, [fl]: !prev[fl] }));
  };

  const handleEnroll = async () => {
    if (!fullName.trim() || fullName.trim().length < 2) {
      Alert.alert('Validation Error', 'Please enter a valid full name (at least 2 characters).');
      return;
    }

    const phoneRegex = /^\d{10}$/;
    if (!phoneRegex.test(phone.trim())) {
      Alert.alert('Validation Error', 'Please enter a valid 10-digit phone number.');
      return;
    }

    const aadharRegex = /^\d{12}$/;
    if (!aadharRegex.test(aadharNumber.trim())) {
      Alert.alert('Validation Error', 'Please enter a valid 12-digit Aadhar Card number.');
      return;
    }

    if (!isDurationValid) {
      Alert.alert('Validation Error ⚠️', durationErrorMsg || 'To Date must be at least 1 month after From Date.');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('fullName', fullName.trim());
      formData.append('phone', phone.trim());
      formData.append('aadharNumber', aadharNumber.trim());
      formData.append('fromDate', fromDate.trim());
      formData.append('toDate', toDate.trim());
      formData.append('fromTime', fromTime.trim());
      formData.append('toTime', toTime.trim());
      formData.append('paymentMethod', paymentMethod);
      formData.append('dailyHours', String(calculatedHours));
      formData.append('totalAmount', String(finalPayableAmount));

      if (appliedReferral) {
        formData.append('referredBy', appliedReferral.code);
      } else if (referredByCode.trim()) {
        formData.append('referredBy', referredByCode.trim().toUpperCase());
      }

      if (selectedSeatId) {
        formData.append('seatId', selectedSeatId);
      }

      if (selectedLockerId) {
        formData.append('lockerId', selectedLockerId);
      }

      if (profileImage) {
        const uriParts = profileImage.uri.split('.');
        const fileExtension = uriParts[uriParts.length - 1];
        formData.append('profilePicture', {
          uri: profileImage.uri,
          name: profileImage.fileName || `photo.${fileExtension}`,
          type: profileImage.type || `image/${fileExtension}`,
        } as any);
      }

      const res = await apiRequest('/admin/enroll-student', {
        method: 'POST',
        body: formData,
      });

      if (res.success && res.data) {
        if (res.data.credentials) {
          setCreatedCredentials({
            email: res.data.credentials.email,
            password: res.data.credentials.password,
            phone: res.data.credentials.phone,
            fullName: res.data.credentials.fullName || fullName.trim(),
            studentIdCardNo: res.data.profile?.studentIdCardNo,
          });
          setShowCredentialsModal(true);
        } else {
          Alert.alert(
            'Student Enrolled & Paid! ✅',
            `Student ${fullName.trim()} enrolled successfully!\n\nDuration: ${fromDate} to ${toDate} (${diffDays} days)\nTotal Paid: ₹${finalPayableAmount} via ${paymentMethod}`
          );
        }

        // Reset form
        setFullName('');
        setPhone('');
        setAadharNumber('');
        setProfileImage(null);
        setSelectedSeatId(null);
        setSelectedLockerId(null);
        setReferredByCode('');
        setAppliedReferral(null);
        setFromDate(formatDate(new Date()));
        setToDate(formatDate(addMonths(new Date(), 1)));
        fetchEnrollmentOptions();
      } else {
        Alert.alert('Enrollment Error', res.error?.message || 'Failed to enroll student');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'An unexpected error occurred.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <HamburgerMenu title="Enroll Walk-in Student" role="LIBRARY_ADMIN" items={LOCAL_ADMIN_MENU} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={styles.headerTitle}>Walk-in Student Enrollment</Text>
          <Text style={styles.subTitle}>Register offline walk-in student with plan, seat, locker & payment</Text>

          <View style={styles.formCard}>
            {/* Profile Picture Section */}
            <Text style={styles.label}>Profile Picture (Optional)</Text>
            <View style={styles.avatarSection}>
              {profileImage ? (
                <Image source={{ uri: profileImage.uri }} style={styles.avatarPreview} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarPlaceholderText}>
                    {fullName ? fullName.charAt(0).toUpperCase() : '📷'}
                  </Text>
                </View>
              )}
              <View style={styles.avatarBtnContainer}>
                <TouchableOpacity style={styles.pickImageBtn} onPress={handlePickImage}>
                  <Text style={styles.pickImageBtnText}>
                    {profileImage ? 'Change Photo' : 'Upload Photo'}
                  </Text>
                </TouchableOpacity>
                {profileImage && (
                  <TouchableOpacity style={styles.removeImageBtn} onPress={() => setProfileImage(null)}>
                    <Text style={styles.removeImageBtnText}>Remove</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Full Name */}
            <Text style={styles.label}>Full Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Rahul Sharma"
              placeholderTextColor="#64748B"
              value={fullName}
              onChangeText={setFullName}
            />

            {/* Phone Number */}
            <Text style={styles.label}>Phone Number *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 9876543210"
              placeholderTextColor="#64748B"
              keyboardType="phone-pad"
              maxLength={10}
              value={phone}
              onChangeText={setPhone}
            />

            {/* Aadhar Card Number */}
            <Text style={styles.label}>Aadhar Card Number *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 123456789012"
              placeholderTextColor="#64748B"
              keyboardType="number-pad"
              maxLength={12}
              value={aadharNumber}
              onChangeText={setAadharNumber}
            />

            {/* DATES & TIME SLOTS PICKER SECTION */}
            <View style={styles.sectionDivider} />
            <Text style={styles.sectionTitle}>⏱️ Daily Study Time Slot & Membership Duration</Text>

            {/* From Time & To Time Pickers */}
            <Text style={styles.subLabel}>Daily Study Time Slot (Dropdowns):</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#64748B', marginBottom: 4 }}>From Time 🕒</Text>
                <TouchableOpacity
                  style={{
                    borderWidth: 1,
                    borderColor: '#CBD5E1',
                    borderRadius: 10,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    backgroundColor: '#FFFFFF',
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                  onPress={() => setShowFromTimeModal(true)}
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
                  style={{
                    borderWidth: 1,
                    borderColor: '#CBD5E1',
                    borderRadius: 10,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    backgroundColor: '#FFFFFF',
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                  onPress={() => setShowToTimeModal(true)}
                >
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#0F172A' }}>
                    {getTimeSlotLabel(toTime)}
                  </Text>
                  <Text style={{ fontSize: 12, color: '#64748B' }}>▼</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* REAL-TIME TIME-SLOT CAPACITY INDICATOR CARD */}
            {capacity && (
              <View
                style={{
                  backgroundColor: '#EFF6FF',
                  borderWidth: 1,
                  borderColor: '#93C5FD',
                  borderRadius: 12,
                  padding: 14,
                  marginBottom: 16,
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: '800', color: '#1E40AF', marginBottom: 6 }}>
                  📊 Time Slot Capacity ({getTimeSlotLabel(fromTime)} → {getTimeSlotLabel(toTime)})
                </Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                  {featureFlags.enableReservedSeats !== false && (
                    <Text style={{ fontSize: 13, color: '#1E3A8A', fontWeight: '700' }}>
                      🪑 Seats: <Text style={{ color: capacity.availableSeatsCount > 0 ? '#16A34A' : '#DC2626' }}>{capacity.availableSeatsCount} / {capacity.totalSeats}</Text>
                    </Text>
                  )}
                  {featureFlags.enableLockers !== false && (
                    <Text style={{ fontSize: 13, color: '#1E3A8A', fontWeight: '700' }}>
                      🔒 Lockers: <Text style={{ color: capacity.availableLockersCount > 0 ? '#16A34A' : '#DC2626' }}>{capacity.availableLockersCount} / {capacity.totalLockers}</Text>
                    </Text>
                  )}
                </View>
              </View>
            )}

            {/* Quick Preset Buttons */}
            <Text style={styles.subLabel}>Quick Duration Presets:</Text>
            <View style={styles.monthPresetsRow}>
              {[1, 2, 3, 6, 12].map((m) => (
                <TouchableOpacity
                  key={m}
                  style={styles.monthChip}
                  onPress={() => setPresetMonths(m)}
                >
                  <Text style={styles.monthChipText}>
                    +{m} {m === 1 ? 'Month' : 'Months'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Interactive Date Selector Cards */}
            <View style={styles.datePickerRow}>
              <TouchableOpacity style={styles.dateSelectorCard} onPress={() => openDatePicker('FROM')}>
                <Text style={styles.dateSelectorLabel}>From Date 📅</Text>
                <Text style={styles.dateSelectorVal}>{formatDisplayDate(fromDate)}</Text>
                <Text style={styles.dateSubText}>{fromDate}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.dateSelectorCard, !isDurationValid && styles.dateSelectorCardError]}
                onPress={() => openDatePicker('TO')}
              >
                <Text style={styles.dateSelectorLabel}>To Date 📅</Text>
                <Text style={styles.dateSelectorVal}>{formatDisplayDate(toDate)}</Text>
                <Text style={styles.dateSubText}>{toDate}</Text>
              </TouchableOpacity>
            </View>

            {/* Duration Status / Error Banner */}
            {!isDurationValid ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>⚠️ {durationErrorMsg}</Text>
              </View>
            ) : (
              <View style={styles.successBanner}>
                <Text style={styles.successBannerText}>
                  ✅ Membership Duration: <Text style={styles.boldText}>{diffDays} days</Text> ({monthsFactor.toFixed(1)} month equivalent)
                </Text>
              </View>
            )}

            {/* --- OPTIONAL SEAT RESERVATION (COMPACT FLOOR LAYOUT FOR 100+ SEATS) --- */}
            {featureFlags.enableReservedSeats !== false && (
              <>
                <View style={styles.sectionDivider} />
                <View style={styles.sectionTitleRow}>
                  <Text style={styles.sectionTitle}>🪑 Optional Seat Reservation</Text>
                  {selectedSeatObj && (
                    <TouchableOpacity onPress={() => setSelectedSeatId(null)}>
                      <Text style={styles.clearSelectionText}>Clear Seat Selection</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {loadingOptions ? (
                  <ActivityIndicator size="small" color="#2563EB" style={{ marginVertical: 8 }} />
                ) : seatFloorNumbers.length === 0 ? (
                  <Text style={styles.noItemsText}>No available seats in library.</Text>
                ) : (
                  seatFloorNumbers.map((fl) => {
                    const floorSeats = seatsByFloor[fl] || [];
                    const isExpanded = expandedSeatFloors[fl] !== false;

                    return (
                      <View key={`seat-floor-${fl}`} style={styles.floorGroupCard}>
                        <TouchableOpacity style={styles.floorHeaderRow} onPress={() => toggleSeatFloorExpand(fl)}>
                          <Text style={styles.floorHeaderTitle}>🏢 Floor {fl} ({floorSeats.length} Available Seats)</Text>
                          <Text style={styles.floorExpandIcon}>{isExpanded ? '▲ Collapse' : '▼ View Seats'}</Text>
                        </TouchableOpacity>

                        {/* LAZY HIGH-PERFORMANCE RENDERING: Only mount items if expanded */}
                        {isExpanded && (
                          <View style={styles.compactItemsGrid}>
                            {floorSeats.map((s) => {
                              const isSelected = selectedSeatId === s._id;
                              return (
                                <TouchableOpacity
                                  key={s._id}
                                  style={[styles.compactPill, isSelected && styles.compactPillSelected]}
                                  onPress={() => setSelectedSeatId(isSelected ? null : s._id)}
                                >
                                  <Text style={[styles.compactPillText, isSelected && styles.compactPillTextSelected]}>
                                    {s.seatNumber}
                                  </Text>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        )}
                      </View>
                    );
                  })
                )}
              </>
            )}

            {/* --- OPTIONAL LOCKER RESERVATION (COMPACT FLOOR LAYOUT FOR 100+ LOCKERS) --- */}
            {featureFlags.enableLockers !== false && (
              <>
                <View style={styles.sectionDivider} />
                <View style={styles.sectionTitleRow}>
                  <Text style={styles.sectionTitle}>🔒 Optional Locker Reservation</Text>
                  {selectedLockerObj && (
                    <TouchableOpacity onPress={() => setSelectedLockerId(null)}>
                      <Text style={styles.clearSelectionText}>Clear Locker Selection</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {loadingOptions ? (
                  <ActivityIndicator size="small" color="#2563EB" style={{ marginVertical: 8 }} />
                ) : lockerFloorNumbers.length === 0 ? (
                  <Text style={styles.noItemsText}>No available lockers in library.</Text>
                ) : (
                  lockerFloorNumbers.map((fl) => {
                    const floorLockers = lockersByFloor[fl] || [];
                    const isExpanded = expandedLockerFloors[fl] !== false;

                    return (
                      <View key={`locker-floor-${fl}`} style={styles.floorGroupCard}>
                        <TouchableOpacity style={styles.floorHeaderRow} onPress={() => toggleLockerFloorExpand(fl)}>
                          <Text style={styles.floorHeaderTitle}>🏢 Floor {fl} ({floorLockers.length} Available Lockers)</Text>
                          <Text style={styles.floorExpandIcon}>{isExpanded ? '▲ Collapse' : '▼ View Lockers'}</Text>
                        </TouchableOpacity>

                        {/* LAZY HIGH-PERFORMANCE RENDERING: Only mount items if expanded */}
                        {isExpanded && (
                          <View style={styles.compactItemsGrid}>
                            {floorLockers.map((l) => {
                              const isSelected = selectedLockerId === l._id;
                              return (
                                <TouchableOpacity
                                  key={l._id}
                                  style={[styles.compactPill, isSelected && styles.compactPillSelected]}
                                  onPress={() => setSelectedLockerId(isSelected ? null : l._id)}
                                >
                                  <Text style={[styles.compactPillText, isSelected && styles.compactPillTextSelected]}>
                                    {l.lockerNumber}
                                  </Text>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        )}
                      </View>
                    );
                  })
                )}
              </>
            )}

            {/* --- REFERRAL COUPON (OPTIONAL) --- */}
            {featureFlags.enableReferrals !== false && (
              <>
                <View style={styles.sectionDivider} />
                <Text style={styles.sectionTitle}>🏷️ Referred By (Optional Referral Coupon)</Text>
                <Text style={styles.fieldDesc}>Enter coupon code generated by an existing student of this library.</Text>

                {appliedReferral ? (
                  <View style={styles.referralAppliedBanner}>
                    <View style={styles.referralAppliedTextContainer}>
                      <Text style={styles.referralAppliedTitle}>🎉 Coupon {appliedReferral.code} Applied!</Text>
                      <Text style={styles.referralAppliedSub}>
                        ₹{appliedReferral.discountAmount} discount applied via referral from {appliedReferral.referrerName}.
                      </Text>
                    </View>
                    <TouchableOpacity style={styles.removeReferralBtn} onPress={handleRemoveReferral}>
                      <Text style={styles.removeReferralBtnText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.referralInputRow}>
                    <TextInput
                      style={[styles.input, styles.referralInput]}
                      placeholder="e.g. REF-A1B2C3"
                      placeholderTextColor="#64748B"
                      value={referredByCode}
                      onChangeText={setReferredByCode}
                      autoCapitalize="characters"
                    />
                    <TouchableOpacity
                      style={[styles.applyReferralBtn, validatingReferral && styles.btnDisabled]}
                      onPress={handleApplyReferral}
                      disabled={validatingReferral}
                    >
                      {validatingReferral ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={styles.applyReferralBtnText}>Apply Code</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}

            {/* --- PAYMENT METHOD --- */}
            <View style={styles.sectionDivider} />
            <Text style={styles.sectionTitle}>💳 Payment Method</Text>
            <View style={styles.monthPresetsRow}>
              {(['UPI', 'CASH', 'CARD'] as const).map((method) => (
                <TouchableOpacity
                  key={method}
                  style={[styles.paymentChip, paymentMethod === method && styles.paymentChipActive]}
                  onPress={() => setPaymentMethod(method)}
                >
                  <Text style={[styles.paymentChipText, paymentMethod === method && styles.paymentChipTextActive]}>
                    {method === 'UPI' ? '📱 UPI' : method === 'CASH' ? '💵 Cash' : '💳 Card'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* --- TOTAL AMOUNT SUMMARY --- */}
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Fee Summary & Total</Text>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Daily Study Time Slot:</Text>
                <Text style={styles.summaryVal}>{getTimeSlotLabel(fromTime)} → {getTimeSlotLabel(toTime)} ({calculatedHours} hrs/day)</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Main Library Fee:</Text>
                <Text style={styles.summaryVal}>₹{baseLibraryCharge}</Text>
              </View>

              {selectedSeatObj && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Seat {selectedSeatObj.seatNumber} (Floor {selectedSeatObj.floor}):</Text>
                  <Text style={styles.summaryVal}>+ ₹{seatCharge}</Text>
                </View>
              )}

              {selectedLockerObj && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Locker {selectedLockerObj.lockerNumber} (Floor {selectedLockerObj.floor}):</Text>
                  <Text style={styles.summaryVal}>+ ₹{lockerCharge}</Text>
                </View>
              )}

              {referralDiscount > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabelGreen}>Referral Discount ({appliedReferral?.code}):</Text>
                  <Text style={styles.summaryValGreen}>- ₹{referralDiscount}</Text>
                </View>
              )}

              <View style={styles.summaryDivider} />

              <View style={styles.summaryRow}>
                <Text style={styles.totalLabel}>Total Payable Amount:</Text>
                <Text style={styles.totalVal}>₹{finalPayableAmount}</Text>
              </View>
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.submitBtn, (submitting || !isDurationValid) && styles.submitBtnDisabled]}
              onPress={handleEnroll}
              disabled={submitting || !isDurationValid}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitBtnText}>Enroll & Receive Payment (₹{finalPayableAmount})</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* --- INTERACTIVE CALENDAR DATE PICKER MODAL --- */}
        <Modal visible={showDatePickerModal} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.calendarCard}>
              <View style={styles.calendarHeaderRow}>
                <TouchableOpacity
                  style={[styles.calNavBtn, !canNavigatePrevMonth && styles.calNavBtnDisabled]}
                  disabled={!canNavigatePrevMonth}
                  onPress={() => {
                    if (!canNavigatePrevMonth) return;
                    if (calendarMonth === 0) {
                      setCalendarMonth(11);
                      setCalendarYear(calendarYear - 1);
                    } else {
                      setCalendarMonth(calendarMonth - 1);
                    }
                  }}
                >
                  <Text style={[styles.calNavBtnText, !canNavigatePrevMonth && styles.calNavBtnTextDisabled]}>◀</Text>
                </TouchableOpacity>

                <Text style={styles.calMonthTitle}>
                  {MONTH_NAMES[calendarMonth]} {calendarYear}
                </Text>

                <TouchableOpacity
                  style={styles.calNavBtn}
                  onPress={() => {
                    if (calendarMonth === 11) {
                      setCalendarMonth(0);
                      setCalendarYear(calendarYear + 1);
                    } else {
                      setCalendarMonth(calendarMonth + 1);
                    }
                  }}
                >
                  <Text style={styles.calNavBtnText}>▶</Text>
                </TouchableOpacity>
              </View>

              {/* Weekday Headers */}
              <View style={styles.calWeekdayRow}>
                {WEEKDAY_NAMES.map((w) => (
                  <Text key={w} style={styles.calWeekdayText}>{w}</Text>
                ))}
              </View>

              {/* Days Grid */}
              <View style={styles.calDaysGrid}>
                {calendarDaysGrid.map(({ day, key }) => {
                  if (!day) {
                    return <View key={key} style={styles.calDayCellEmpty} />;
                  }

                  const currentStr = datePickerTarget === 'FROM' ? fromDate : toDate;
                  const [curY, curM, curD] = currentStr.trim().split('-').map(Number);
                  const isSelected = curY === calendarYear && curM === calendarMonth + 1 && curD === day;
                  const isDisabled = isCalendarDayDisabled(day);

                  return (
                    <TouchableOpacity
                      key={key}
                      style={[
                        styles.calDayCell,
                        isSelected && styles.calDayCellSelected,
                        isDisabled && styles.calDayCellDisabled,
                      ]}
                      disabled={isDisabled}
                      onPress={() => !isDisabled && handleSelectCalendarDay(day)}
                    >
                      <Text
                        style={[
                          styles.calDayText,
                          isSelected && styles.calDayTextSelected,
                          isDisabled && styles.calDayTextDisabled,
                        ]}
                      >
                        {day}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Modal Actions Footer */}
              <View style={styles.calFooterRow}>
                <TouchableOpacity
                  style={styles.calTodayBtn}
                  onPress={() => {
                    setCalendarYear(today.getFullYear());
                    setCalendarMonth(today.getMonth());
                    handleSelectCalendarDay(today.getDate());
                  }}
                >
                  <Text style={styles.calTodayBtnText}>Select Today</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.calCloseBtn} onPress={() => setShowDatePickerModal(false)}>
                  <Text style={styles.calCloseBtnText}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* --- SUCCESS CREATED CREDENTIALS MODAL --- */}
        <Modal visible={showCredentialsModal} transparent animationType="fade" statusBarTranslucent>
          <ScrollView
            style={styles.credModalOverlay}
            contentContainerStyle={styles.credModalScrollContent}
            bounces={false}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.credentialsCard}>
              <Text style={styles.credTitle}>🎉 Student Successfully Enrolled!</Text>
              <Text style={styles.credSub}>Generated Account Credentials for Walk-in Student:</Text>

              {createdCredentials && (
                <View style={styles.credDetailsBox}>
                  <Text style={styles.credName}>{createdCredentials.fullName}</Text>

                  {/* Email Row */}
                  <View style={styles.credRow}>
                    <View style={styles.credRowHeader}>
                      <Text style={styles.credLabel}>📧 LOGIN EMAIL:</Text>
                      <TouchableOpacity
                        style={[styles.smallCopyBtn, copiedState === 'EMAIL' && styles.smallCopyBtnSuccess]}
                        onPress={() => handleCopyAction('EMAIL', createdCredentials.email)}
                      >
                        <Text style={[styles.smallCopyBtnText, copiedState === 'EMAIL' && styles.smallCopyBtnTextSuccess]}>
                          {copiedState === 'EMAIL' ? 'Copied! ✅' : 'Copy'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    <View style={styles.valueBox}>
                      <Text style={styles.credEmailVal} selectable>{createdCredentials.email}</Text>
                    </View>
                  </View>

                  {/* Password Row */}
                  <View style={styles.credRow}>
                    <View style={styles.credRowHeader}>
                      <Text style={styles.credLabel}>🔑 SECURE PASSWORD:</Text>
                      <TouchableOpacity
                        style={[styles.smallCopyBtn, copiedState === 'PASSWORD' && styles.smallCopyBtnSuccess]}
                        onPress={() => handleCopyAction('PASSWORD', createdCredentials.password)}
                      >
                        <Text style={[styles.smallCopyBtnText, copiedState === 'PASSWORD' && styles.smallCopyBtnTextSuccess]}>
                          {copiedState === 'PASSWORD' ? 'Copied! ✅' : 'Copy'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    <View style={styles.passwordPill}>
                      <Text style={styles.credPasswordVal} selectable>{createdCredentials.password}</Text>
                    </View>
                  </View>

                  {/* Phone Row */}
                  <View style={styles.credRow}>
                    <Text style={styles.credLabel}>📱 REGISTERED PHONE:</Text>
                    <View style={styles.valueBox}>
                      <Text style={styles.credPhoneVal} selectable>{createdCredentials.phone}</Text>
                    </View>
                  </View>
                </View>
              )}

              <TouchableOpacity
                style={[styles.mainCopyBtn, copiedState === 'ALL' && styles.mainCopyBtnSuccess]}
                onPress={() => {
                  if (createdCredentials) {
                    const textToCopy = `Student Name: ${createdCredentials.fullName}\nEmail: ${createdCredentials.email}\nPassword: ${createdCredentials.password}\nPhone: ${createdCredentials.phone}`;
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
                  setShowCredentialsModal(false);
                  setCreatedCredentials(null);
                  setCopiedState('NONE');
                }}
              >
                <Text style={styles.doneBtnText}>Done / Close</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </Modal>

        {/* From Time Dropdown Modal */}
        <Modal animationType="fade" transparent visible={showFromTimeModal} onRequestClose={() => setShowFromTimeModal(false)}>
          <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.5)', justifyContent: 'center', alignItems: 'center' }} activeOpacity={1} onPress={() => setShowFromTimeModal(false)}>
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
                      setShowFromTimeModal(false);
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
        <Modal animationType="fade" transparent visible={showToTimeModal} onRequestClose={() => setShowToTimeModal(false)}>
          <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.5)', justifyContent: 'center', alignItems: 'center' }} activeOpacity={1} onPress={() => setShowToTimeModal(false)}>
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
                      setShowToTimeModal(false);
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
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 16, paddingBottom: 40 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#0F172A' },
  subTitle: { fontSize: 13, color: '#64748B', marginTop: 4, marginBottom: 16 },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  label: { fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 6 },
  subLabel: { fontSize: 12, fontWeight: '600', color: '#64748B', marginBottom: 8, marginTop: 4 },
  input: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
    marginBottom: 14,
  },
  avatarSection: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  avatarPreview: { width: 64, height: 64, borderRadius: 32 },
  avatarPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarPlaceholderText: { fontSize: 24, fontWeight: '700', color: '#64748B' },
  avatarBtnContainer: { marginLeft: 14 },
  pickImageBtn: { backgroundColor: '#2563EB', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  pickImageBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  removeImageBtn: { marginTop: 6 },
  removeImageBtnText: { color: '#DC2626', fontSize: 12, fontWeight: '600' },
  sectionDivider: { height: 1, backgroundColor: '#E2E8F0', marginVertical: 18 },
  sectionTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  clearSelectionText: { fontSize: 12, fontWeight: '700', color: '#DC2626' },
  monthPresetsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  monthChip: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  monthChipText: { fontSize: 12, fontWeight: '700', color: '#334155' },
  datePickerRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  dateSelectorCard: {
    flex: 1,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 10,
    padding: 12,
  },
  dateSelectorCardError: { backgroundColor: '#FEF2F2', borderColor: '#FCA5A5' },
  dateSelectorLabel: { fontSize: 11, fontWeight: '700', color: '#1E40AF', marginBottom: 2 },
  dateSelectorVal: { fontSize: 15, fontWeight: '800', color: '#1E3A8A' },
  dateSubText: { fontSize: 10, color: '#64748B', marginTop: 2 },
  errorBanner: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 8,
    padding: 10,
    marginBottom: 14,
  },
  errorBannerText: { color: '#DC2626', fontSize: 12, fontWeight: '700' },
  successBanner: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#86EFAC',
    borderRadius: 8,
    padding: 10,
    marginBottom: 14,
  },
  successBannerText: { color: '#166534', fontSize: 12 },
  boldText: { fontWeight: '800' },

  /* HIGH-PERFORMANCE SPACE-EFFICIENT FLOOR & ITEM LAYOUT (OPTIMIZED FOR 100+ SEATS) */
  floorGroupCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 10,
    marginBottom: 10,
  },
  floorHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  floorHeaderTitle: { fontSize: 13, fontWeight: '800', color: '#0F172A' },
  floorExpandIcon: { fontSize: 12, color: '#2563EB', fontWeight: '700' },

  compactItemsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  compactPill: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    minWidth: 54,
    alignItems: 'center',
  },
  compactPillSelected: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  compactPillText: { fontSize: 12, fontWeight: '800', color: '#334155' },
  compactPillTextSelected: { color: '#FFFFFF' },

  noItemsText: { fontSize: 12, color: '#64748B', fontStyle: 'italic', marginBottom: 12 },
  paymentChip: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  paymentChipActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  paymentChipText: { fontSize: 13, fontWeight: '700', color: '#334155' },
  paymentChipTextActive: { color: '#FFFFFF' },
  summaryCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 18,
    marginBottom: 18,
  },
  summaryTitle: { fontSize: 14, fontWeight: '800', color: '#0F172A', marginBottom: 10 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  summaryLabel: { fontSize: 13, color: '#475569' },
  summaryVal: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  summaryLabelGreen: { fontSize: 13, color: '#15803D', fontWeight: '700' },
  summaryValGreen: { fontSize: 14, fontWeight: '800', color: '#166534' },
  summaryDivider: { height: 1, backgroundColor: '#CBD5E1', marginVertical: 8 },
  totalLabel: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  totalVal: { fontSize: 18, fontWeight: '900', color: '#2563EB' },
  referralInputRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  referralInput: { flex: 1, marginBottom: 0, fontWeight: '800', letterSpacing: 1, color: '#1E3A8A' },
  applyReferralBtn: { backgroundColor: '#2563EB', borderRadius: 8, paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center' },
  applyReferralBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  referralAppliedBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1.5,
    borderColor: '#86EFAC',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  referralAppliedTextContainer: { flex: 1, marginRight: 8 },
  referralAppliedTitle: { fontSize: 13, fontWeight: '900', color: '#166534' },
  referralAppliedSub: { fontSize: 11, color: '#15803D', marginTop: 2 },
  removeReferralBtn: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FCA5A5', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
  removeReferralBtnText: { color: '#991B1B', fontSize: 11, fontWeight: '800' },
  fieldDesc: { fontSize: 11, color: '#64748B', marginBottom: 6, marginTop: -4 },
  btnDisabled: { opacity: 0.6 },
  submitBtn: { backgroundColor: '#2563EB', paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { color: '#FFFFFF', fontWeight: '900', fontSize: 15 },

  /* CALENDAR MODAL STYLES */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  calendarCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
  calendarHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  calNavBtn: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#F1F5F9', borderRadius: 8 },
  calNavBtnDisabled: { opacity: 0.3 },
  calNavBtnText: { fontSize: 14, color: '#2563EB', fontWeight: '800' },
  calNavBtnTextDisabled: { color: '#94A3B8' },
  calMonthTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  calWeekdayRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 8 },
  calWeekdayText: { width: 36, textAlign: 'center', fontSize: 12, fontWeight: '700', color: '#64748B' },
  calDaysGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start' },
  calDayCellEmpty: { width: '14.28%', height: 36 },
  calDayCell: {
    width: '14.28%',
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    marginVertical: 2,
  },
  calDayCellSelected: { backgroundColor: '#2563EB' },
  calDayCellDisabled: { backgroundColor: '#F1F5F9', opacity: 0.4 },
  calDayText: { fontSize: 13, fontWeight: '600', color: '#0F172A' },
  calDayTextSelected: { color: '#FFFFFF', fontWeight: '800' },
  calDayTextDisabled: { color: '#94A3B8', textDecorationLine: 'line-through' },
  calFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  calTodayBtn: { paddingHorizontal: 12, paddingVertical: 6 },
  calTodayBtnText: { fontSize: 13, fontWeight: '800', color: '#2563EB' },
  calCloseBtn: { paddingHorizontal: 14, paddingVertical: 6, backgroundColor: '#F1F5F9', borderRadius: 6 },
  calCloseBtnText: { fontSize: 13, fontWeight: '700', color: '#64748B' },

  /* CREDENTIALS MODAL STYLES (OPAQUE OVERLAY FIX) */
  credModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    zIndex: 9999,
  },
  credModalScrollContent: {
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
  credTitle: { fontSize: 18, fontWeight: '900', color: '#065F46', textAlign: 'center', marginBottom: 4 },
  credSub: { fontSize: 12, color: '#475569', textAlign: 'center', marginBottom: 16, fontWeight: '600' },
  credDetailsBox: {
    width: '100%',
    backgroundColor: '#F0FDF4',
    borderWidth: 1.5,
    borderColor: '#86EFAC',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  credName: { fontSize: 17, fontWeight: '900', color: '#0F172A' },
  credIdBadgeRow: { marginTop: 4, marginBottom: 10, alignSelf: 'flex-start' },
  credIdBadgeText: { fontSize: 11, fontWeight: '800', color: '#1E40AF', backgroundColor: '#DBEAFE', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  credRow: { marginVertical: 6 },
  credRowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  credLabel: { fontSize: 11, color: '#334155', fontWeight: '800' },
  smallCopyBtn: { backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  smallCopyBtnSuccess: { backgroundColor: '#DCFCE7', borderColor: '#86EFAC' },
  smallCopyBtnText: { fontSize: 11, fontWeight: '800', color: '#2563EB' },
  smallCopyBtnTextSuccess: { color: '#166534' },
  valueBox: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 2,
  },
  credEmailVal: { fontSize: 13, fontWeight: '800', color: '#1E3A8A', flexWrap: 'wrap' },
  passwordPill: { backgroundColor: '#FEF2F2', borderWidth: 1.5, borderColor: '#FCA5A5', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6, alignSelf: 'flex-start', marginTop: 2 },
  credPasswordVal: { fontSize: 16, fontWeight: '900', color: '#991B1B', letterSpacing: 1 },
  credPhoneVal: { fontSize: 13, fontWeight: '800', color: '#0F172A' },
  mainCopyBtn: {
    width: '100%',
    backgroundColor: '#2563EB',
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  mainCopyBtnSuccess: { backgroundColor: '#16A34A' },
  mainCopyBtnText: { color: '#FFFFFF', fontWeight: '900', fontSize: 14 },
  doneBtn: { width: '100%', paddingVertical: 12, alignItems: 'center', borderRadius: 10, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#CBD5E1' },
  doneBtnText: { color: '#334155', fontWeight: '800', fontSize: 13 },
});
