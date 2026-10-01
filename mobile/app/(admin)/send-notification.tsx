import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../src/services/api.client';
import { HamburgerMenu } from '../../src/components/HamburgerMenu';
import { LOCAL_ADMIN_MENU } from '../../src/constants/menuItems';
import {
  HOURLY_TIME_SLOTS,
  getTimeSlotLabel,
  parseTimeToHourNum,
} from '../../src/utils/timeSlots';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function formatDateDDMonthYYYY(date: Date): string {
  const dayStr = String(date.getDate()).padStart(2, '0');
  const monthStr = MONTH_NAMES[date.getMonth()];
  const year = date.getFullYear();
  return `${dayStr}-${monthStr}-${year}`;
}

function formatDisplayDateTime(dateStr?: string | Date): string {
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'N/A';
  const dayStr = String(d.getDate()).padStart(2, '0');
  const monthStr = MONTH_NAMES[d.getMonth()];
  const year = d.getFullYear();
  const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return `${dayStr}-${monthStr}-${year} ${timeStr}`;
}

export default function SendNotificationScreen() {
  const queryClient = useQueryClient();

  const [target, setTarget] = useState<'ALL' | 'SELECTED'>('ALL');
  const [title, setTitle] = useState('');

  // Expiry Date & Hour State
  const defaultInitialExp = useMemo(() => new Date(Date.now() + 24 * 60 * 60 * 1000), []);
  const [expiryDate, setExpiryDate] = useState<Date>(defaultInitialExp);
  const [expiryHourVal, setExpiryHourVal] = useState<string>(() => {
    const h = defaultInitialExp.getHours();
    return `${String(h).padStart(2, '0')}:00`;
  });

  // Modal visibility states
  const [showDatePickerModal, setShowDatePickerModal] = useState(false);
  const [showTimePickerModal, setShowTimePickerModal] = useState(false);

  // Selected Students state
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudents, setSelectedStudents] = useState<any[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [actionNotifId, setActionNotifId] = useState<string | null>(null);

  // Fetch Active Students for Library
  const { data: activeStudentsData } = useQuery({
    queryKey: ['active-students-list-notif'],
    queryFn: async () => {
      const res = await apiRequest('/admin/students?status=ACTIVE');
      return res.data?.students || [];
    },
  });

  const activeStudents: any[] = activeStudentsData || [];

  // Filtered active students matching search term
  const searchedStudents = useMemo(() => {
    if (!studentSearch.trim()) return [];
    const term = studentSearch.trim().toLowerCase();
    const selectedIds = new Set(selectedStudents.map((s) => s._id));

    return activeStudents.filter((s) => {
      if (selectedIds.has(s._id)) return false;
      const name = (s.userId?.fullName || '').toLowerCase();
      const phone = (s.userId?.phone || '').toLowerCase();
      const cardNo = (s.studentIdCardNo || '').toLowerCase();
      return name.includes(term) || phone.includes(term) || cardNo.includes(term);
    });
  }, [studentSearch, activeStudents, selectedStudents]);

  // Fetch Sent Notification History
  const { data: sentNotifications, isLoading: loadingHistory, refetch: refetchHistory } = useQuery({
    queryKey: ['sent-notifications-list'],
    queryFn: async () => {
      const res = await apiRequest('/admin/notifications');
      return res.data || [];
    },
  });

  // Filtered Valid Time Slots (Hides invalid past/early hours for today)
  const validTimeSlots = useMemo(() => {
    const now = new Date();
    const minAllowed = now.getTime() + 60 * 60 * 1000 - 5000;

    return HOURLY_TIME_SLOTS.slice(0, -1).filter((slot) => {
      const candidateDate = new Date(
        expiryDate.getFullYear(),
        expiryDate.getMonth(),
        expiryDate.getDate(),
        slot.hourNum,
        0,
        0
      );
      return candidateDate.getTime() >= minAllowed;
    });
  }, [expiryDate]);

  // Auto-adjust selected hour if current hour becomes invalid (e.g. switching date to Today)
  useEffect(() => {
    if (validTimeSlots.length > 0) {
      const isCurrentHourValid = validTimeSlots.some((s) => s.value === expiryHourVal);
      if (!isCurrentHourValid) {
        setExpiryHourVal(validTimeSlots[0].value);
      }
    }
  }, [expiryDate, validTimeSlots, expiryHourVal]);

  // Combined Expiry Timestamp Computation
  const calculatedExpiryDate = useMemo(() => {
    const hourNum = parseTimeToHourNum(expiryHourVal);
    const d = new Date(expiryDate);
    d.setHours(hourNum, 0, 0, 0);
    return d;
  }, [expiryDate, expiryHourVal]);

  // Frontend Expiry Validation Check
  const expiryValidation = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const selectedDayStart = new Date(expiryDate.getFullYear(), expiryDate.getMonth(), expiryDate.getDate(), 0, 0, 0, 0);

    // 1. Expiry Date validation: Only today and future dates allowed
    if (selectedDayStart.getTime() < startOfToday.getTime()) {
      return { isValid: false, message: 'Expiry Date must be today or a future date.' };
    }

    // 2. Expiry Time validation: Must be at least 1 hour from current time
    const minAllowedTime = now.getTime() + 60 * 60 * 1000 - 5000;
    if (calculatedExpiryDate.getTime() < minAllowedTime) {
      return { isValid: false, message: 'Minimum expiry time must be at least 1 hour from current time.' };
    }

    return { isValid: true, expiryDateObj: calculatedExpiryDate };
  }, [expiryDate, calculatedExpiryDate]);

  // Quick Preset Helper
  const applyPresetExpiry = (hoursToAdd: number) => {
    const targetDate = new Date(Date.now() + hoursToAdd * 60 * 60 * 1000);
    setExpiryDate(targetDate);
    const h = targetDate.getHours();
    setExpiryHourVal(`${String(h).padStart(2, '0')}:00`);
  };

  const handleToggleSelectStudent = (student: any) => {
    if (selectedStudents.some((s) => s._id === student._id)) {
      setSelectedStudents((prev) => prev.filter((s) => s._id !== student._id));
    } else {
      setSelectedStudents((prev) => [...prev, student]);
    }
    setStudentSearch('');
  };

  const handleRemoveSelectedStudent = (studentId: string) => {
    setSelectedStudents((prev) => prev.filter((s) => s._id !== studentId));
  };

  const handleSend = async () => {
    if (!title.trim()) {
      Alert.alert('Validation Error', 'Headline is required.');
      return;
    }

    if (target === 'SELECTED' && selectedStudents.length === 0) {
      Alert.alert('Validation Error', 'Please select at least one student recipient.');
      return;
    }

    if (!expiryValidation.isValid) {
      Alert.alert('Expiry Validation Error', expiryValidation.message);
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        target,
        title: title.trim(),
        expiresAt: calculatedExpiryDate.toISOString(),
      };

      if (target === 'SELECTED') {
        payload.recipientStudentIds = selectedStudents.map((s) => s._id);
      }

      const res = await apiRequest('/admin/send-notification', 'POST', payload);

      if (res.success) {
        Alert.alert('Notification Sent! 📢', 'Broadcast announcement published successfully.');
        setTitle('');
        setSelectedStudents([]);
        queryClient.invalidateQueries({ queryKey: ['sent-notifications-list'] });
      } else {
        Alert.alert('Broadcast Error', res.error?.message || 'Failed to send notification.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'An unexpected error occurred.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleHideNotification = async (notificationId: string, headline: string) => {
    const targetNotif = (sentNotifications || []).find((n: any) => n._id === notificationId);
    if (targetNotif && (targetNotif.type === 'SUPER_ADMIN_BROADCAST' || targetNotif.type === 'SUPER_ADMIN_ANNOUNCEMENT')) {
      Alert.alert('Permission Denied', 'Local Admins are not permitted to hide or reset notifications created by Super Admin.');
      return;
    }

    Alert.alert(
      'Confirm Reset / Hide',
      `Hide "${headline}" immediately from all student dashboards?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Hide Notification',
          style: 'destructive',
          onPress: async () => {
            setActionNotifId(notificationId);
            try {
              const res = await apiRequest(`/admin/notifications/${notificationId}/hide`, 'PATCH');
              if (res.success) {
                Alert.alert('Notification Hidden 🚫', 'Notification has been withdrawn from all dashboards.');
                refetchHistory();
              } else {
                Alert.alert('Error', res.error?.message || 'Failed to hide notification.');
              }
            } catch (err: any) {
              Alert.alert('Error', err.message);
            } finally {
              setActionNotifId(null);
            }
          },
        },
      ]
    );
  };

  // Date Modal options filtered to exclude past options completely
  const now = new Date();
  const currentYear = now.getFullYear();
  const yearOptions = [currentYear, currentYear + 1, currentYear + 2];

  // Available Months (Past months in current year are hidden)
  const isCurrentYearSelected = expiryDate.getFullYear() === currentYear;
  const availableMonths = useMemo(() => {
    return MONTH_NAMES.map((name, idx) => ({ name, idx })).filter(
      (m) => !isCurrentYearSelected || m.idx >= now.getMonth()
    );
  }, [isCurrentYearSelected, now]);

  // Available Days (Past days in current month are hidden)
  const isCurrentMonthSelected = isCurrentYearSelected && expiryDate.getMonth() === now.getMonth();
  const daysInMonthCount = new Date(expiryDate.getFullYear(), expiryDate.getMonth() + 1, 0).getDate();
  const startDay = isCurrentMonthSelected ? now.getDate() : 1;
  const availableDays = useMemo(() => {
    return Array.from({ length: daysInMonthCount - startDay + 1 }, (_, i) => startDay + i);
  }, [daysInMonthCount, startDay]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <HamburgerMenu title="Send Student Notification" role="LIBRARY_ADMIN" items={LOCAL_ADMIN_MENU} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={styles.headerTitle}>Send Notification</Text>
          <Text style={styles.subTitle}>Push light-theme announcement banners to student dashboards</Text>

          {/* BROADCAST FORM CARD */}
          <View style={styles.card}>
            <Text style={styles.label}>Recipient Target *</Text>
            <View style={styles.targetRow}>
              <TouchableOpacity
                style={[styles.targetBtn, target === 'ALL' && styles.targetActive]}
                onPress={() => setTarget('ALL')}
              >
                <Text style={[styles.targetText, target === 'ALL' && styles.targetTextActive]}>📢 ALL STUDENTS</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.targetBtn, target === 'SELECTED' && styles.targetActive]}
                onPress={() => setTarget('SELECTED')}
              >
                <Text style={[styles.targetText, target === 'SELECTED' && styles.targetTextActive]}>🎯 SELECTED STUDENTS</Text>
              </TouchableOpacity>
            </View>

            {/* SELECTED STUDENTS RECIPIENT PICKER */}
            {target === 'SELECTED' && (
              <View style={styles.selectedStudentsSection}>
                <Text style={styles.label}>Search & Select Students *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Search student by name, phone, or ID..."
                  placeholderTextColor="#64748B"
                  value={studentSearch}
                  onChangeText={setStudentSearch}
                />

                {/* Dropdown search results */}
                {searchedStudents.length > 0 && (
                  <View style={styles.searchResultsBox}>
                    <ScrollView nestedScrollEnabled style={{ maxHeight: 150 }}>
                      {searchedStudents.map((st) => (
                        <TouchableOpacity
                          key={st._id}
                          style={styles.searchResultItem}
                          onPress={() => handleToggleSelectStudent(st)}
                        >
                          <Text style={styles.searchResultName}>{st.userId?.fullName || 'Student'}</Text>
                          <Text style={styles.searchResultSub}>📞 {st.userId?.phone || 'N/A'} • ID: {st.studentIdCardNo || 'N/A'}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}

                {/* Selected Students Chips */}
                {selectedStudents.length > 0 && (
                  <View style={styles.chipsContainer}>
                    <Text style={styles.chipsTitle}>Recipients ({selectedStudents.length}):</Text>
                    <View style={styles.chipsRow}>
                      {selectedStudents.map((st) => (
                        <View key={st._id} style={styles.chip}>
                          <Text style={styles.chipText}>👤 {st.userId?.fullName || 'Student'}</Text>
                          <TouchableOpacity onPress={() => handleRemoveSelectedStudent(st._id)}>
                            <Text style={styles.chipRemove}>✕</Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* HEADLINE (TITLE) */}
            <Text style={styles.label}>Headline (Announcement Title) *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Holiday Notice / Extended Library Hours"
              placeholderTextColor="#64748B"
              value={title}
              onChangeText={setTitle}
            />

            {/* EXPIRY DATE & TIME PICKERS */}
            <Text style={styles.label}>Expiry Schedule *</Text>
            <View style={styles.pickerRow}>
              {/* Expiry Date Button */}
              <TouchableOpacity
                style={styles.pickerBtn}
                onPress={() => setShowDatePickerModal(true)}
              >
                <Text style={styles.pickerSubLabel}>Expiry Date (DD-Month-YYYY)</Text>
                <Text style={styles.pickerValText}>
                  📅 {formatDateDDMonthYYYY(expiryDate)} ▾
                </Text>
              </TouchableOpacity>

              {/* Expiry Time Button */}
              <TouchableOpacity
                style={styles.pickerBtn}
                onPress={() => setShowTimePickerModal(true)}
              >
                <Text style={styles.pickerSubLabel}>Expiry Time (Hourly)</Text>
                <Text style={styles.pickerValText}>
                  ⏰ {getTimeSlotLabel(expiryHourVal)} ▾
                </Text>
              </TouchableOpacity>
            </View>

            {/* Quick Expiry Presets */}
            <Text style={styles.presetLabel}>Quick Presets:</Text>
            <View style={styles.presetsRow}>
              <TouchableOpacity style={styles.presetBtn} onPress={() => applyPresetExpiry(1)}>
                <Text style={styles.presetText}>+1 Hour</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.presetBtn} onPress={() => applyPresetExpiry(6)}>
                <Text style={styles.presetText}>+6 Hours</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.presetBtn} onPress={() => applyPresetExpiry(12)}>
                <Text style={styles.presetText}>+12 Hours</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.presetBtn} onPress={() => applyPresetExpiry(24)}>
                <Text style={styles.presetText}>+24 Hours</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.presetBtn} onPress={() => applyPresetExpiry(72)}>
                <Text style={styles.presetText}>+3 Days</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.presetBtn} onPress={() => applyPresetExpiry(168)}>
                <Text style={styles.presetText}>+7 Days</Text>
              </TouchableOpacity>
            </View>

            {/* Validation Message */}
            {!expiryValidation.isValid && (
              <Text style={styles.errorText}>⚠️ {expiryValidation.message}</Text>
            )}

            {/* SUBMIT BUTTON */}
            <TouchableOpacity
              style={[styles.sendBtn, (submitting || !expiryValidation.isValid) && styles.btnDisabled]}
              onPress={handleSend}
              disabled={submitting || !expiryValidation.isValid}
            >
              {submitting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.sendText}>📢 Publish Notification Banner</Text>}
            </TouchableOpacity>
          </View>

          {/* SENT NOTIFICATIONS HISTORY SECTION */}
          <Text style={styles.sectionHeaderTitle}>Sent Notification History</Text>

          {loadingHistory ? (
            <ActivityIndicator size="small" color="#2563EB" style={{ marginVertical: 20 }} />
          ) : !sentNotifications || sentNotifications.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No notifications sent yet.</Text>
            </View>
          ) : (
            <View style={styles.historyList}>
              {sentNotifications.map((notif: any) => {
                const isActive = notif.status === 'ACTIVE';
                const isHidden = notif.status === 'HIDDEN';
                const isSuperAdminBroadcast = notif.type === 'SUPER_ADMIN_BROADCAST';
                const isSuperAdminAnnouncement = notif.type === 'SUPER_ADMIN_ANNOUNCEMENT';
                const isStudentBroadcast = notif.type === 'BROADCAST';

                const targetText = isSuperAdminBroadcast
                  ? '👑 Received from Super Admin (Global Platform Announcement)'
                  : isSuperAdminAnnouncement
                    ? '👑 Received from Super Admin (Direct Announcement)'
                    : isStudentBroadcast
                      ? 'All Students'
                      : `Selected Students (${notif.recipientStudentIds?.length || 1})`;

                return (
                  <View key={notif._id} style={[styles.historyCard, (isSuperAdminBroadcast || isSuperAdminAnnouncement) && { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
                    <View style={styles.historyHeader}>
                      <Text style={styles.historyTitle}>
                        {(isSuperAdminBroadcast || isSuperAdminAnnouncement) ? '👑 ' : ''}{notif.title}
                      </Text>
                      <View
                        style={[
                          styles.statusBadge,
                          isActive ? styles.bgActive : isHidden ? styles.bgHidden : styles.bgExpired,
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusText,
                            isActive ? styles.textActive : isHidden ? styles.textHidden : styles.textExpired,
                          ]}
                        >
                          {notif.status}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.historyMeta}>
                      🎯 Target: {targetText}
                    </Text>

                    <Text style={styles.historyMeta}>
                      ⏱️ Expires: {formatDisplayDateTime(notif.expiresAt)}
                    </Text>

                    {/* Reset / Hide Action for Active Notifications */}
                    {isActive && !isSuperAdminBroadcast && !isSuperAdminAnnouncement ? (
                      <TouchableOpacity
                        style={[styles.hideBtn, actionNotifId === notif._id && styles.btnDisabled]}
                        onPress={() => handleHideNotification(notif._id, notif.title)}
                        disabled={actionNotifId === notif._id}
                      >
                        {actionNotifId === notif._id ? (
                          <ActivityIndicator size="small" color="#DC2626" />
                        ) : (
                          <Text style={styles.hideBtnText}>🚫 Reset / Hide Notification Now</Text>
                        )}
                      </TouchableOpacity>
                    ) : (isSuperAdminBroadcast || isSuperAdminAnnouncement) ? (
                      <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={{ fontSize: 11, color: '#64748B', fontWeight: '700', fontStyle: 'italic' }}>🔒 (Notification)</Text>
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          )}

          {/* MODAL: EXPIRY DATE PICKER */}
          <Modal animationType="slide" transparent visible={showDatePickerModal} onRequestClose={() => setShowDatePickerModal(false)}>
            <View style={styles.modalOverlay}>
              <View style={[styles.modalCard, { maxHeight: '80%' }]}>
                <Text style={styles.modalTitle}>Select Expiry Date</Text>
                <Text style={styles.modalSubTitle}>Format: DD-Month-YYYY (Today and Future Dates Only)</Text>

                {/* Quick Date Presets */}
                <View style={styles.datePresetRow}>
                  <TouchableOpacity
                    style={styles.datePresetChip}
                    onPress={() => {
                      setExpiryDate(new Date());
                    }}
                  >
                    <Text style={styles.datePresetText}>Today</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.datePresetChip}
                    onPress={() => {
                      const d = new Date();
                      d.setDate(d.getDate() + 1);
                      setExpiryDate(d);
                    }}
                  >
                    <Text style={styles.datePresetText}>Tomorrow</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.datePresetChip}
                    onPress={() => {
                      const d = new Date();
                      d.setDate(d.getDate() + 3);
                      setExpiryDate(d);
                    }}
                  >
                    <Text style={styles.datePresetText}>+3 Days</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.datePresetChip}
                    onPress={() => {
                      const d = new Date();
                      d.setDate(d.getDate() + 7);
                      setExpiryDate(d);
                    }}
                  >
                    <Text style={styles.datePresetText}>+7 Days</Text>
                  </TouchableOpacity>
                </View>

                {/* Year Selection */}
                <Text style={styles.modalSectionLabel}>Select Year</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScrollContent}>
                  {yearOptions.map((yr) => (
                    <TouchableOpacity
                      key={yr}
                      style={[styles.modalOptionPill, expiryDate.getFullYear() === yr && styles.modalOptionPillActive]}
                      onPress={() => {
                        const newD = new Date(expiryDate);
                        newD.setFullYear(yr);
                        setExpiryDate(newD);
                      }}
                    >
                      <Text style={[styles.modalOptionText, expiryDate.getFullYear() === yr && styles.modalOptionTextActive]}>
                        {yr}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* Month Selection (Past months hidden) */}
                <Text style={styles.modalSectionLabel}>Select Month</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScrollContent}>
                  {availableMonths.map((m) => (
                    <TouchableOpacity
                      key={m.name}
                      style={[styles.modalOptionPill, expiryDate.getMonth() === m.idx && styles.modalOptionPillActive]}
                      onPress={() => {
                        const newD = new Date(expiryDate);
                        newD.setMonth(m.idx);
                        setExpiryDate(newD);
                      }}
                    >
                      <Text style={[styles.modalOptionText, expiryDate.getMonth() === m.idx && styles.modalOptionTextActive]}>
                        {m.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* Day Selection (Past days hidden) */}
                <Text style={styles.modalSectionLabel}>Select Day</Text>
                <ScrollView contentContainerStyle={styles.daysGrid} style={{ maxHeight: 180 }}>
                  {availableDays.map((dNum) => {
                    const isSelected = expiryDate.getDate() === dNum;

                    return (
                      <TouchableOpacity
                        key={dNum}
                        style={[styles.dayBox, isSelected && styles.dayBoxActive]}
                        onPress={() => {
                          const newD = new Date(expiryDate);
                          newD.setDate(dNum);
                          setExpiryDate(newD);
                        }}
                      >
                        <Text style={[styles.dayText, isSelected && styles.dayTextActive]}>
                          {dNum}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {/* Formatted Date Display */}
                <View style={styles.selectedDatePreview}>
                  <Text style={styles.previewText}>
                    Selected Date: <Text style={{ fontWeight: '900', color: '#2563EB' }}>{formatDateDDMonthYYYY(expiryDate)}</Text>
                  </Text>
                </View>

                <TouchableOpacity style={styles.confirmModalBtn} onPress={() => setShowDatePickerModal(false)}>
                  <Text style={styles.confirmModalText}>Done</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          {/* MODAL: EXPIRY TIME PICKER (Hides invalid early hours) */}
          <Modal animationType="slide" transparent visible={showTimePickerModal} onRequestClose={() => setShowTimePickerModal(false)}>
            <View style={styles.modalOverlay}>
              <View style={[styles.modalCard, { maxHeight: '65%' }]}>
                <Text style={styles.modalTitle}>Select Expiry Hour</Text>
                <Text style={styles.modalSubTitle}>Hourly time slots (No minutes). Must be at least 1 hour from current time.</Text>

                <ScrollView nestedScrollEnabled style={{ marginVertical: 10 }}>
                  {validTimeSlots.length === 0 ? (
                    <View style={{ padding: 16, alignItems: 'center' }}>
                      <Text style={{ color: '#DC2626', fontWeight: '700', textAlign: 'center' }}>
                        No valid expiry hours remaining for today. Please select a future date.
                      </Text>
                    </View>
                  ) : (
                    validTimeSlots.map((slot) => {
                      const isSelected = expiryHourVal === slot.value;

                      return (
                        <TouchableOpacity
                          key={slot.value}
                          style={[styles.timePickerItem, isSelected && styles.timePickerItemActive]}
                          onPress={() => {
                            setExpiryHourVal(slot.value);
                            setShowTimePickerModal(false);
                          }}
                        >
                          <Text style={[styles.timePickerText, isSelected && styles.timePickerTextActive]}>
                            ⏰ {slot.label} ({slot.value})
                          </Text>
                        </TouchableOpacity>
                      );
                    })
                  )}
                </ScrollView>

                <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowTimePickerModal(false)}>
                  <Text style={styles.cancelText}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 16 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#0F172A' },
  subTitle: { fontSize: 13, color: '#64748B', marginTop: 4, marginBottom: 16 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#64748B', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  label: { color: '#334155', fontSize: 12, fontWeight: '800', marginBottom: 6, marginTop: 4 },
  targetRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  targetBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: '#F8FAFC', alignItems: 'center', borderWidth: 1, borderColor: '#CBD5E1' },
  targetActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  targetText: { color: '#64748B', fontSize: 11, fontWeight: '800' },
  targetTextActive: { color: '#FFFFFF' },
  selectedStudentsSection: { backgroundColor: '#F8FAFC', borderRadius: 10, padding: 10, marginBottom: 14, borderWidth: 1, borderColor: '#E2E8F0' },
  searchResultsBox: { backgroundColor: '#FFFFFF', borderRadius: 8, borderWidth: 1, borderColor: '#CBD5E1', marginBottom: 10, overflow: 'hidden' },
  searchResultItem: { padding: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  searchResultName: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  searchResultSub: { fontSize: 11, color: '#64748B', marginTop: 2 },
  chipsContainer: { marginTop: 4 },
  chipsTitle: { fontSize: 11, fontWeight: '700', color: '#475569', marginBottom: 6 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, gap: 6 },
  chipText: { fontSize: 12, fontWeight: '700', color: '#1E40AF' },
  chipRemove: { fontSize: 12, fontWeight: '800', color: '#EF4444' },
  input: { backgroundColor: '#F8FAFC', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, color: '#0F172A', fontSize: 14, borderWidth: 1, borderColor: '#CBD5E1', marginBottom: 10 },
  pickerRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  pickerBtn: { flex: 1, backgroundColor: '#F8FAFC', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: '#CBD5E1' },
  pickerSubLabel: { fontSize: 9, fontWeight: '700', color: '#64748B', textTransform: 'uppercase' },
  pickerValText: { fontSize: 13, fontWeight: '800', color: '#0F172A', marginTop: 4 },
  presetLabel: { fontSize: 11, fontWeight: '700', color: '#64748B', marginBottom: 6 },
  presetsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  presetBtn: { backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#CBD5E1', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  presetText: { fontSize: 11, fontWeight: '700', color: '#334155' },
  errorText: { color: '#DC2626', fontSize: 12, fontWeight: '700', marginBottom: 10 },
  sendBtn: { backgroundColor: '#2563EB', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 6 },
  btnDisabled: { opacity: 0.6 },
  sendText: { color: '#FFFFFF', fontWeight: '900', fontSize: 14 },
  sectionHeaderTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A', marginTop: 24, marginBottom: 12 },
  historyList: { gap: 12, marginBottom: 30 },
  historyCard: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#E2E8F0', elevation: 1 },
  historyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  historyTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A', flex: 1, marginRight: 8 },
  historyMeta: { fontSize: 11, color: '#64748B', marginTop: 2, fontWeight: '600' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  bgActive: { backgroundColor: '#DCFCE7' },
  bgHidden: { backgroundColor: '#F1F5F9' },
  bgExpired: { backgroundColor: '#FEF3C7' },
  statusText: { fontSize: 10, fontWeight: '800' },
  textActive: { color: '#15803D' },
  textHidden: { color: '#64748B' },
  textExpired: { color: '#B45309' },
  hideBtn: { marginTop: 10, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FCA5A5', paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  hideBtnText: { color: '#DC2626', fontSize: 12, fontWeight: '800' },
  emptyCard: { backgroundColor: '#FFFFFF', padding: 20, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 20 },
  emptyText: { color: '#94A3B8', fontSize: 13 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.5)', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: '#E2E8F0' },
  modalTitle: { color: '#0F172A', fontSize: 16, fontWeight: '800' },
  modalSubTitle: { color: '#64748B', fontSize: 11, marginTop: 2, marginBottom: 10 },
  modalSectionLabel: { fontSize: 11, fontWeight: '800', color: '#475569', marginTop: 8, marginBottom: 4, textTransform: 'uppercase' },
  datePresetRow: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  datePresetChip: { backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  datePresetText: { fontSize: 11, fontWeight: '800', color: '#2563EB' },
  hScrollContent: { paddingVertical: 8, paddingHorizontal: 2, alignItems: 'center' },
  modalOptionPill: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#CBD5E1', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, marginRight: 8, minHeight: 40, justifyContent: 'center', alignItems: 'center' },
  modalOptionPillActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  modalOptionText: { fontSize: 13, fontWeight: '800', color: '#475569', lineHeight: 18, textAlign: 'center' },
  modalOptionTextActive: { color: '#FFFFFF', fontWeight: '900' },
  daysGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingVertical: 6 },
  dayBox: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 10, borderWidth: 1, borderColor: '#CBD5E1' },
  dayBoxActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  dayText: { fontSize: 13, fontWeight: '800', color: '#0F172A' },
  dayTextActive: { color: '#FFFFFF' },
  selectedDatePreview: { marginTop: 12, padding: 10, backgroundColor: '#F8FAFC', borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  previewText: { fontSize: 13, color: '#334155' },
  confirmModalBtn: { backgroundColor: '#2563EB', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 12 },
  confirmModalText: { color: '#FFFFFF', fontWeight: '900', fontSize: 14 },
  cancelBtn: { backgroundColor: '#E2E8F0', borderRadius: 10, paddingVertical: 10, alignItems: 'center', marginTop: 10 },
  cancelText: { color: '#475569', fontWeight: '700', fontSize: 13 },
  timePickerItem: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: 8, marginBottom: 6, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#CBD5E1' },
  timePickerItemActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  timePickerText: { fontSize: 14, fontWeight: '800', color: '#334155' },
  timePickerTextActive: { color: '#FFFFFF', fontWeight: '900' },
});
