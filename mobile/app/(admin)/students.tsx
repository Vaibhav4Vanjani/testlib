import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Modal,
  ScrollView,
  Image,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import { apiRequest } from '../../src/services/api.client';
import { HamburgerMenu } from '../../src/components/HamburgerMenu';
import { LOCAL_ADMIN_MENU } from '../../src/constants/menuItems';
import { getFullImageUrl } from '../../src/constants/config';
import { useDebounce } from '../../src/hooks/useDebounce';
import {
  HOURLY_TIME_SLOTS,
  getTimeSlotLabel,
  getValidToTimeSlots,
  parseTimeToHourNum,
} from '../../src/utils/timeSlots';

function formatDate(dateStr?: string | Date): string {
  if (!dateStr) return 'N/A';
  let year: number, monthIdx: number, day: number;
  if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
    const parts = dateStr.split('T')[0].split('-');
    year = parseInt(parts[0], 10);
    monthIdx = parseInt(parts[1], 10) - 1;
    day = parseInt(parts[2], 10);
  } else {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'N/A';
    year = d.getFullYear();
    monthIdx = d.getMonth();
    day = d.getDate();
  }
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const month = monthNames[monthIdx];
  if (!month || isNaN(day) || isNaN(year)) return 'N/A';
  const dayStr = String(day).padStart(2, '0');
  return `${dayStr}-${month}-${year}`;
}

export default function AdminStudentsScreen() {
  const [search, setSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [editingStudent, setEditingStudent] = useState<any | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Edit form state
  const [editFullName, setEditFullName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAadharNumber, setEditAadharNumber] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editProfileImage, setEditProfileImage] = useState<{
    uri: string;
    type?: string;
    fileName?: string;
  } | null>(null);
  const [editFromTime, setEditFromTime] = useState('06:00');
  const [editToTime, setEditToTime] = useState('23:00');
  const [showFromTimeModal, setShowFromTimeModal] = useState(false);
  const [showToTimeModal, setShowToTimeModal] = useState(false);
  const [submittingEdit, setSubmittingEdit] = useState(false);

  // Temporary password visibility (10-minute timer per student ID)
  const [tempPasswordMap, setTempPasswordMap] = useState<
    Record<string, { password: string; expiresAt: number }>
  >({});
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const getTempPasswordInfo = (studentId?: string) => {
    if (!studentId || !tempPasswordMap[studentId]) return null;
    const info = tempPasswordMap[studentId];
    const remainingMs = info.expiresAt - now;
    if (remainingMs <= 0) return null;
    const totalSec = Math.floor(remainingMs / 1000);
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    const formattedTime = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    return { password: info.password, formattedTime };
  };

  const handleClearTempPassword = (studentId: string) => {
    setTempPasswordMap((prev) => {
      const copy = { ...prev };
      delete copy[studentId];
      return copy;
    });
  };

  const debouncedSearch = useDebounce(search, 350);
  const [page, setPage] = useState(1);
  const [studentList, setStudentList] = useState<any[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [viewingImageUri, setViewingImageUri] = useState<string | null>(null);

  const { data: dashboardMetricsData } = useQuery({
    queryKey: ['admin-dashboard-metrics-flags'],
    queryFn: async () => {
      const res = await apiRequest('/admin/dashboard-metrics');
      return res.data || null;
    },
  });
  const featureFlags = dashboardMetricsData?.featureFlags || { enableReservedSeats: true, enableLockers: true, enableReferrals: true };

  // Reset page when search term changes
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const { isLoading, refetch } = useQuery({
    queryKey: ['admin-students', debouncedSearch, page],
    queryFn: async () => {
      const res = await apiRequest(
        `/admin/students?search=${encodeURIComponent(debouncedSearch)}&page=${page}&limit=20`
      );
      if (!res.success) throw new Error(res.error?.message || 'Failed to fetch students');

      const newStudents = res.data?.students || [];
      const pagination = res.data?.pagination || {};
      setHasMore(!!pagination.hasMore);

      if (page === 1) {
        setStudentList(newStudents);
      } else {
        setStudentList((prev) => {
          const existingIds = new Set(prev.map((s) => s._id));
          const filteredNew = newStudents.filter((s: any) => !existingIds.has(s._id));
          return [...prev, ...filteredNew];
        });
      }
      setIsFetchingMore(false);
      setIsRefreshing(false);
      return res.data;
    },
    placeholderData: (previousData) => previousData,
  });

  const handleLoadMore = () => {
    if (hasMore && !isLoading && !isFetchingMore) {
      setIsFetchingMore(true);
      setPage((prev) => prev + 1);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    if (page === 1) {
      await refetch();
    } else {
      setPage(1);
    }
  };

  const handleToggleStatus = (student: any) => {
    const isCurrentlyActive = student.membershipStatus === 'ACTIVE';

    if (isCurrentlyActive) {
      Alert.alert(
        'Confirm Inactivation',
        'Student will no longer be part of your library. Continue?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Yes, Mark Inactive',
            style: 'destructive',
            onPress: () => updateStatus(student._id, 'INACTIVE'),
          },
        ]
      );
    } else {
      Alert.alert(
        'Reactivate Student',
        `Reactivate ${student.userId?.fullName || 'student'} into your library?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Reactivate',
            onPress: () => updateStatus(student._id, 'ACTIVE'),
          },
        ]
      );
    }
  };

  const updateStatus = async (studentProfileId: string, newStatus: 'ACTIVE' | 'INACTIVE') => {
    setUpdatingStatus(true);
    try {
      const res = await apiRequest(`/admin/students/${studentProfileId}/status`, 'PATCH', { status: newStatus });

      if (res.success) {
        Alert.alert(
          'Status Updated',
          newStatus === 'INACTIVE'
            ? 'Student marked as Inactive. Assigned seat and locker have been released. Record will auto-delete in 30 days.'
            : 'Student reactivated successfully.'
        );
        setSelectedStudent(null);
        refetch();
      } else {
        Alert.alert('Error', res.error?.message || 'Failed to update student status');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'An unexpected error occurred.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleReferToOtherLibrary = (student: any) => {
    Alert.prompt(
      'Refer to Partner Library',
      `Enter Target Library Code to refer ${student.userId?.fullName || 'student'}:`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Refer Student',
          onPress: async (targetCode?: string) => {
            if (!targetCode) return;
            try {
              const res = await apiRequest('/admin/refer-student', 'POST', {
                studentProfileId: student._id,
                targetLibraryId: targetCode.trim(),
              });
              if (res.success) {
                Alert.alert('Referral Success', res.data?.message || 'Student referred successfully.');
              } else {
                Alert.alert('Error', res.error?.message || 'Referral failed.');
              }
            } catch (err: any) {
              Alert.alert('Error', err.message);
            }
          },
        },
      ]
    );
  };

  const handleStartEdit = (student: any) => {
    setEditingStudent(student);
    setEditFullName(student.userId?.fullName || '');
    setEditPhone(student.userId?.phone || '');
    setEditAadharNumber(student.aadharNumber || '');
    setEditFromTime(student.fromTime || '06:00');
    setEditToTime(student.toTime || '23:00');
    setEditPassword('');
    setEditProfileImage(null);
  };

  const handlePickEditImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permissionResult && !permissionResult.granted) {
        Alert.alert('Permission Denied', 'Permission to access gallery is required to upload profile photo.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const ext = asset.uri.split('.').pop()?.toLowerCase() || 'jpg';

        setEditProfileImage({
          uri: asset.uri,
          type: asset.mimeType || `image/${ext}`,
          fileName: asset.fileName || `profile.${ext}`,
        });
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to pick profile picture');
    }
  };

  const handleSaveEdit = async () => {
    if (!editingStudent) return;

    if (!editFullName.trim() || editFullName.trim().length < 2) {
      Alert.alert('Validation Error', 'Full Name must be at least 2 characters.');
      return;
    }

    const phoneRegex = /^\d{10}$/;
    if (!phoneRegex.test(editPhone.trim())) {
      Alert.alert('Validation Error', 'Phone number must be exactly 10 numeric digits.');
      return;
    }

    if (editAadharNumber.trim() && !/^\d{12}$/.test(editAadharNumber.trim())) {
      Alert.alert('Validation Error', 'Aadhaar Card number must be exactly 12 numeric digits.');
      return;
    }

    if (editPassword.trim() && editPassword.trim().length < 4) {
      Alert.alert('Validation Error', 'New password must be at least 4 characters long.');
      return;
    }

    const fromNum = parseTimeToHourNum(editFromTime);
    const toNum = parseTimeToHourNum(editToTime);
    const effToNum = toNum > fromNum ? toNum : 24;
    if (effToNum <= fromNum) {
      Alert.alert('Validation Error', 'To Time must be after From Time.');
      return;
    }

    setSubmittingEdit(true);
    try {
      const formData = new FormData();
      formData.append('fullName', editFullName.trim());
      formData.append('phone', editPhone.trim());
      if (editAadharNumber.trim()) {
        formData.append('aadharNumber', editAadharNumber.trim());
      }
      formData.append('fromTime', editFromTime);
      formData.append('toTime', editToTime);

      if (editPassword.trim()) {
        formData.append('newPassword', editPassword.trim());
      }

      if (editProfileImage) {
        formData.append('profilePicture', {
          uri: editProfileImage.uri,
          name: editProfileImage.fileName || 'profile.jpg',
          type: editProfileImage.type || 'image/jpeg',
        } as any);
      }

      const res = await apiRequest(`/admin/students/${editingStudent._id}`, {
        method: 'PUT',
        body: formData,
      });

      if (res.success && res.data) {
        Alert.alert('Student Profile Updated ✅', 'Student profile details updated successfully.');

        if (res.data.passwordUpdated && res.data.tempPassword) {
          // Store 10-minute temporary password in state
          setTempPasswordMap((prev) => ({
            ...prev,
            [editingStudent._id]: {
              password: res.data.tempPassword,
              expiresAt: Date.now() + 10 * 60 * 1000,
            },
          }));
        }

        if (res.data.student) {
          setSelectedStudent(res.data.student);
        }

        setEditingStudent(null);
        refetch();
      } else {
        Alert.alert('Update Error', res.error?.message || 'Failed to update student profile.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'An unexpected error occurred while updating profile.');
    } finally {
      setSubmittingEdit(false);
    }
  };

  const handleCopyPassword = async (pwd: string) => {
    try {
      if (Clipboard && typeof Clipboard.setStringAsync === 'function') {
        await Clipboard.setStringAsync(pwd);
        Alert.alert('Copied! 📋', 'New password copied to clipboard.');
      } else {
        Alert.alert('New Password', pwd);
      }
    } catch {
      Alert.alert('New Password', pwd);
    }
  };

  const renderStudentItem = ({ item }: { item: any }) => {
    const isActive = item.membershipStatus === 'ACTIVE';
    const isInactive = item.membershipStatus === 'INACTIVE';
    const imgUrl = getFullImageUrl(item.profilePictureUrl || item.profilePicture);

    return (
      <TouchableOpacity style={styles.studentCard} onPress={() => setSelectedStudent(item)} activeOpacity={0.7}>
        <View style={styles.studentHeader}>
          <View style={styles.studentHeaderLeft}>
            {imgUrl ? (
              <Image source={{ uri: imgUrl }} style={styles.cardAvatar} />
            ) : (
              <View style={styles.cardAvatarFallback}>
                <Text style={styles.cardAvatarText}>
                  {(item.userId?.fullName || 'S').slice(0, 2).toUpperCase()}
                </Text>
              </View>
            )}
            <View>
              <Text style={styles.studentName}>{item.userId?.fullName || 'Student'}</Text>
              <Text style={styles.cardSubText}>ID: {item.studentIdCardNo || 'N/A'}</Text>
            </View>
          </View>

          <View style={[styles.badge, isActive ? styles.bgActive : isInactive ? styles.bgInactive : styles.bgExpired]}>
            <Text style={[styles.badgeText, isActive ? styles.textActive : isInactive ? styles.textInactive : styles.textExpired]}>
              {item.membershipStatus}
            </Text>
          </View>
        </View>

        <Text style={styles.detailText}>📞 Phone: {item.userId?.phone || 'N/A'}</Text>
        <Text style={styles.detailText}>🪪 Aadhaar: {item.aadharNumber || 'N/A'}</Text>
        <Text style={styles.detailText}>🗓️ Plan: {item.monthsCount || 1} Month(s) ({formatDate(item.fromDate)} to {formatDate(item.toDate || item.membershipExpiresAt)})</Text>

        {(featureFlags.enableReservedSeats !== false || featureFlags.enableLockers !== false) && (
          <View style={styles.miniMetaRow}>
            {featureFlags.enableReservedSeats !== false && (
              <Text style={styles.miniMetaText}>
                🪑 Seat: {item.currentSeatId ? `Floor ${item.currentSeatId.floor || 1} (S-${item.currentSeatId.seatNumber})` : 'None'}
              </Text>
            )}
            {featureFlags.enableLockers !== false && (
              <Text style={styles.miniMetaText}>
                🔒 Locker: {item.currentLockerId ? `Floor ${item.currentLockerId.floor || 1} (L-${item.currentLockerId.lockerNumber})` : 'None'}
              </Text>
            )}
          </View>
        )}

        <Text style={styles.tapToViewHint}>Tap for complete profile details ➔</Text>
      </TouchableOpacity>
    );
  };

  const tempPwdInfo = selectedStudent ? getTempPasswordInfo(selectedStudent._id) : null;
  const currentDetailsImgUrl = selectedStudent
    ? getFullImageUrl(selectedStudent.profilePictureUrl || selectedStudent.profilePicture)
    : null;

  return (
    <View style={styles.container}>
      <HamburgerMenu title="Search & Manage Students" role="LIBRARY_ADMIN" items={LOCAL_ADMIN_MENU} />

      <View style={styles.contentPadding}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search student by name, phone, or ID..."
          placeholderTextColor="#64748B"
          value={search}
          onChangeText={setSearch}
        />

        {isLoading && page === 1 && studentList.length === 0 ? (
          <ActivityIndicator size="large" color="#2563EB" style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={studentList}
            keyExtractor={(item) => item._id}
            renderItem={renderStudentItem}
            contentContainerStyle={styles.list}
            keyboardShouldPersistTaps="handled"
            initialNumToRender={10}
            maxToRenderPerBatch={10}
            windowSize={5}
            removeClippedSubviews={Platform.OS !== 'web'}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.5}
            refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor="#2563EB" />}
            ListEmptyComponent={<Text style={styles.emptyText}>No students found matching search criteria.</Text>}
            ListFooterComponent={
              isFetchingMore ? (
                <View style={{ paddingVertical: 16, alignItems: 'center' }}>
                  <ActivityIndicator size="small" color="#2563EB" />
                  <Text style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>Loading more students...</Text>
                </View>
              ) : null
            }
          />
        )}
      </View>

      {/* --- STUDENT DETAIL MODAL --- */}
      <Modal visible={!!selectedStudent} animationType="slide" transparent={true} onRequestClose={() => setSelectedStudent(null)}>
        {selectedStudent && (
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Student Profile Details</Text>
                <TouchableOpacity onPress={() => setSelectedStudent(null)} style={styles.closeBtn}>
                  <Text style={styles.closeBtnText}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView contentContainerStyle={styles.modalBody}>
                {/* Profile Photo & Name Header */}
                <View style={styles.profileHeroCard}>
                  {currentDetailsImgUrl ? (
                    <Image source={{ uri: currentDetailsImgUrl }} style={styles.heroAvatar} />
                  ) : (
                    <View style={styles.heroAvatarFallback}>
                      <Text style={styles.heroAvatarText}>
                        {(selectedStudent.userId?.fullName || 'S').slice(0, 2).toUpperCase()}
                      </Text>
                    </View>
                  )}

                  <Text style={styles.profileName}>{selectedStudent.userId?.fullName || 'Student Name'}</Text>
                  <View
                    style={[
                      styles.badge,
                      selectedStudent.membershipStatus === 'ACTIVE'
                        ? styles.bgActive
                        : selectedStudent.membershipStatus === 'INACTIVE'
                          ? styles.bgInactive
                          : styles.bgExpired,
                      { marginTop: 6 },
                    ]}
                  >
                    <Text
                      style={[
                        styles.badgeText,
                        selectedStudent.membershipStatus === 'ACTIVE'
                          ? styles.textActive
                          : selectedStudent.membershipStatus === 'INACTIVE'
                            ? styles.textInactive
                            : styles.textExpired,
                      ]}
                    >
                      {selectedStudent.membershipStatus}
                    </Text>
                  </View>
                </View>

                {/* 10-MINUTE TEMPORARY PASSWORD BANNER */}
                {tempPwdInfo && (
                  <View style={styles.tempPwdBanner}>
                    <View style={styles.tempPwdHeader}>
                      <Text style={styles.tempPwdIcon}>🔑</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.tempPwdTitle}>Newly Set Password</Text>
                        <Text style={styles.tempPwdSub}>
                          ⏱️ Visible for: <Text style={styles.boldTime}>{tempPwdInfo.formattedTime}</Text> (Auto-hides in 10 minutes)
                        </Text>
                      </View>
                      <TouchableOpacity style={styles.tempPwdCopyBtn} onPress={() => handleCopyPassword(tempPwdInfo.password)}>
                        <Text style={styles.tempPwdCopyText}>📋 Copy</Text>
                      </TouchableOpacity>
                    </View>
                    <View style={styles.tempPwdBox}>
                      <Text style={styles.tempPwdText} selectable={true}>
                        {tempPwdInfo.password}
                      </Text>
                    </View>
                    <TouchableOpacity style={styles.tempPwdHideBtn} onPress={() => handleClearTempPassword(selectedStudent._id)}>
                      <Text style={styles.tempPwdHideText}>Hide Password Now</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Profile Information List */}
                <View style={styles.detailBox}>
                  <Text style={styles.fieldLabel}>Phone Number</Text>
                  <Text style={styles.fieldValue}>{selectedStudent.userId?.phone || 'N/A'}</Text>
                </View>

                <View style={styles.detailBox}>
                  <Text style={styles.fieldLabel}>Aadhaar Card Number</Text>
                  <Text style={styles.fieldValue}>{selectedStudent.aadharNumber || 'N/A'}</Text>
                </View>

                <View style={styles.detailBox}>
                  <Text style={styles.fieldLabel}>Payment Rejection Strikes</Text>
                  <Text style={[styles.fieldValue, selectedStudent.rejectionCount >= 2 ? styles.textDanger : null]}>
                    {selectedStudent.rejectionCount || 0} / 3 Strikes{' '}
                    {selectedStudent.rejectionCount >= 3
                      ? '(ACCOUNT INACTIVE)'
                      : selectedStudent.rejectionCount === 2
                        ? '(⚠️ 1 Strike Remaining)'
                        : ''}
                  </Text>
                </View>

                <View style={styles.detailBox}>
                  <Text style={styles.fieldLabel}>Months Enrolled</Text>
                  <Text style={styles.fieldValue}>{selectedStudent.monthsCount || 1} Month(s)</Text>
                </View>

                <View style={styles.detailBox}>
                  <Text style={styles.fieldLabel}>Coverage Dates (From / To)</Text>
                  <Text style={styles.fieldValue}>
                    {formatDate(selectedStudent.fromDate)} — {formatDate(selectedStudent.toDate || selectedStudent.membershipExpiresAt)}
                  </Text>
                </View>

                <View style={styles.detailBox}>
                  <Text style={styles.fieldLabel}>From Time</Text>
                  <Text style={styles.fieldValue}>
                    {selectedStudent.fromTime ? getTimeSlotLabel(selectedStudent.fromTime) : 'N/A'}
                  </Text>
                </View>

                <View style={styles.detailBox}>
                  <Text style={styles.fieldLabel}>To Time</Text>
                  <Text style={styles.fieldValue}>
                    {selectedStudent.toTime ? getTimeSlotLabel(selectedStudent.toTime) : 'N/A'}
                  </Text>
                </View>

                {/* Seat Reservation Details */}
                {featureFlags.enableReservedSeats !== false && (
                  <View style={styles.detailBox}>
                    <Text style={styles.fieldLabel}>Seat Reserved</Text>
                    {selectedStudent.currentSeatId ? (
                      <Text style={styles.fieldValueHighlight}>
                        Floor {selectedStudent.currentSeatId.floor || 1} • Seat {selectedStudent.currentSeatId.seatNumber}
                      </Text>
                    ) : (
                      <Text style={styles.fieldValueMuted}>No seat reserved</Text>
                    )}
                  </View>
                )}

                {/* Locker Reservation Details */}
                {featureFlags.enableLockers !== false && (
                  <View style={styles.detailBox}>
                    <Text style={styles.fieldLabel}>Locker Reserved</Text>
                    {selectedStudent.currentLockerId ? (
                      <Text style={styles.fieldValueHighlight}>
                        Floor {selectedStudent.currentLockerId.floor || 1} • Locker {selectedStudent.currentLockerId.lockerNumber}
                      </Text>
                    ) : (
                      <Text style={styles.fieldValueMuted}>No locker reserved</Text>
                    )}
                  </View>
                )}

                {/* Payment Amount & Method */}
                <View style={styles.detailBox}>
                  <Text style={styles.fieldLabel}>Latest Payment Info</Text>
                  {selectedStudent.latestPayment ? (
                    <Text style={styles.fieldValueSuccess}>
                      ₹{selectedStudent.latestPayment.amount} via {selectedStudent.latestPayment.paymentMethod || 'Cash'} (
                      {selectedStudent.latestPayment.paymentType})
                    </Text>
                  ) : (
                    <Text style={styles.fieldValueMuted}>No payment recorded</Text>
                  )}
                </View>

                {/* Complete Payment History */}
                <View style={{ marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#E2E8F0' }}>
                  <Text style={{ fontSize: 14, fontWeight: '800', color: '#0F172A', marginBottom: 8 }}>
                    💳 Payment History & Screenshots
                  </Text>
                  {selectedStudent.paymentsHistory && selectedStudent.paymentsHistory.length > 0 ? (
                    selectedStudent.paymentsHistory.map((pay: any, idx: number) => (
                      <View
                        key={pay._id || idx}
                        style={{
                          backgroundColor: '#F8FAFC',
                          borderRadius: 8,
                          padding: 10,
                          marginBottom: 8,
                          borderWidth: 1,
                          borderColor: '#E2E8F0',
                        }}
                      >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={{ fontSize: 14, fontWeight: '800', color: '#16A34A' }}>₹{pay.amount}</Text>
                          <Text
                            style={{
                              fontSize: 10,
                              fontWeight: '800',
                              paddingHorizontal: 8,
                              paddingVertical: 2,
                              borderRadius: 4,
                              overflow: 'hidden',
                              color: pay.status === 'APPROVED' ? '#16A34A' : pay.status === 'REJECTED' ? '#DC2626' : '#D97706',
                              backgroundColor: pay.status === 'APPROVED' ? '#DCFCE7' : pay.status === 'REJECTED' ? '#FEE2E2' : '#FEF3C7',
                            }}
                          >
                            {pay.status}
                          </Text>
                        </View>
                        <Text style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>
                          {pay.paymentMethod || 'Cash'} • {pay.paymentType} • {formatDate(pay.createdAt)}
                        </Text>
                        {pay.adminNotes ? (
                          <Text style={{ fontSize: 11, color: '#D97706', marginTop: 2, fontStyle: 'italic' }}>
                            Notes: {pay.adminNotes}
                          </Text>
                        ) : null}
                        {pay.proofImageUrl ? (
                          <TouchableOpacity
                            style={{
                              backgroundColor: '#EFF6FF',
                              borderWidth: 1,
                              borderColor: '#BFDBFE',
                              paddingVertical: 6,
                              paddingHorizontal: 10,
                              borderRadius: 6,
                              marginTop: 8,
                              alignItems: 'center',
                            }}
                            onPress={() => setViewingImageUri(pay.proofImageUrl)}
                          >
                            <Text style={{ color: '#2563EB', fontWeight: '800', fontSize: 12 }}>
                              👁️ View Payment Proof Screenshot
                            </Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    ))
                  ) : (
                    <Text style={styles.fieldValueMuted}>No payments recorded for this student.</Text>
                  )}
                </View>

                {/* Inactive Policy Warning */}
                {selectedStudent.membershipStatus === 'INACTIVE' && (
                  <View style={styles.inactiveWarningBox}>
                    <Text style={styles.inactiveWarningText}>
                      ⚠️ Student is inactive. Reserved seat and locker have been released. Inactive record will be permanently deleted 30 days after inactivation.
                    </Text>
                  </View>
                )}

                {/* Action Buttons */}
                <View style={styles.actionBtnContainer}>
                  {/* EDIT PROFILE BUTTON */}
                  <TouchableOpacity style={styles.editProfileBtn} onPress={() => handleStartEdit(selectedStudent)}>
                    <Text style={styles.editProfileBtnText}>✏️ Edit Profile Details & Password</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.statusToggleBtn,
                      selectedStudent.membershipStatus === 'ACTIVE' ? styles.btnDanger : styles.btnSuccess,
                      updatingStatus && styles.btnDisabled,
                    ]}
                    onPress={() => handleToggleStatus(selectedStudent)}
                    disabled={updatingStatus}
                  >
                    {updatingStatus ? (
                      <ActivityIndicator color="#FFF" />
                    ) : (
                      <Text style={styles.statusToggleBtnText}>
                        {selectedStudent.membershipStatus === 'ACTIVE' ? '🚫 Mark as Inactive' : '✅ Reactivate Student'}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </View>
        )}
      </Modal>

      {/* --- EDIT STUDENT PROFILE MODAL --- */}
      <Modal visible={!!editingStudent} animationType="slide" transparent={true} onRequestClose={() => setEditingStudent(null)}>
        {editingStudent && (
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'center' }}>
              <View style={styles.modalContainer}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Edit Student Details</Text>
                  <TouchableOpacity onPress={() => setEditingStudent(null)} style={styles.closeBtn}>
                    <Text style={styles.closeBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>

                <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
                  {/* Profile Picture Upload/Preview */}
                  <View style={styles.editAvatarContainer}>
                    {editProfileImage ? (
                      <Image source={{ uri: editProfileImage.uri }} style={styles.editAvatarImage} />
                    ) : editingStudent.profilePictureUrl || editingStudent.profilePicture ? (
                      <Image
                        source={{ uri: getFullImageUrl(editingStudent.profilePictureUrl || editingStudent.profilePicture)! }}
                        style={styles.editAvatarImage}
                      />
                    ) : (
                      <View style={styles.editAvatarFallback}>
                        <Text style={styles.editAvatarText}>📷</Text>
                      </View>
                    )}

                    <TouchableOpacity style={styles.pickPhotoBtn} onPress={handlePickEditImage}>
                      <Text style={styles.pickPhotoBtnText}>📸 Upload / Change Photo</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Full Name */}
                  <Text style={styles.inputLabel}>Full Name *</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={editFullName}
                    onChangeText={setEditFullName}
                    placeholder="e.g. Rahul Sharma"
                    placeholderTextColor="#94A3B8"
                  />

                  {/* Phone Number */}
                  <Text style={styles.inputLabel}>Phone Number *</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={editPhone}
                    onChangeText={setEditPhone}
                    keyboardType="phone-pad"
                    maxLength={10}
                    placeholder="e.g. 9876543210"
                    placeholderTextColor="#94A3B8"
                  />

                  {/* Aadhaar Number */}
                  <Text style={styles.inputLabel}>Aadhaar Card Number</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={editAadharNumber}
                    onChangeText={setEditAadharNumber}
                    keyboardType="number-pad"
                    maxLength={12}
                    placeholder="e.g. 123456789012"
                    placeholderTextColor="#94A3B8"
                  />

                  {/* From Time & To Time Pickers */}
                  <Text style={styles.inputLabel}>Daily Library Hours (From / To)</Text>
                  <View style={styles.timePickerRow}>
                    <TouchableOpacity style={styles.timeSlotBtn} onPress={() => setShowFromTimeModal(true)}>
                      <Text style={styles.timeSlotSubText}>From Time</Text>
                      <Text style={styles.timeSlotValueText}>{getTimeSlotLabel(editFromTime)} ▾</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.timeSlotBtn} onPress={() => setShowToTimeModal(true)}>
                      <Text style={styles.timeSlotSubText}>To Time</Text>
                      <Text style={styles.timeSlotValueText}>{getTimeSlotLabel(editToTime)} ▾</Text>
                    </TouchableOpacity>
                  </View>

                  {/* CHANGE PASSWORD SECTION */}
                  <View style={styles.passwordSectionBox}>
                    <Text style={styles.passwordSectionTitle}>🔒 Change Password</Text>
                    <Text style={styles.passwordSubText}>
                      Enter a new password to reset the student&apos;s credentials. Existing password is protected by hash and will never be displayed.
                    </Text>

                    <TextInput
                      style={styles.modalInput}
                      value={editPassword}
                      onChangeText={setEditPassword}
                      placeholder="Leave blank to keep existing password"
                      placeholderTextColor="#94A3B8"
                      secureTextEntry={false}
                    />
                  </View>

                  {/* Edit Actions */}
                  <View style={styles.editActionsRow}>
                    <TouchableOpacity style={styles.cancelEditBtn} onPress={() => setEditingStudent(null)}>
                      <Text style={styles.cancelEditText}>Cancel</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.saveEditBtn, submittingEdit && styles.btnDisabled]}
                      onPress={handleSaveEdit}
                      disabled={submittingEdit}
                    >
                      {submittingEdit ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveEditText}>Save Changes</Text>}
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              </View>
            </KeyboardAvoidingView>
          </View>
        )}
      </Modal>
      {/* FROM TIME PICKER MODAL */}
      <Modal visible={showFromTimeModal} animationType="slide" transparent={true} onRequestClose={() => setShowFromTimeModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { maxHeight: '60%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select From Time</Text>
              <TouchableOpacity onPress={() => setShowFromTimeModal(false)} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={HOURLY_TIME_SLOTS.slice(0, -1)}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.slotPickerItem, editFromTime === item.value && styles.slotPickerItemSelected]}
                  onPress={() => {
                    setEditFromTime(item.value);
                    const validToSlots = getValidToTimeSlots(item.value);
                    if (validToSlots.length > 0) {
                      const curToNum = parseTimeToHourNum(editToTime);
                      const fromNum = item.hourNum;
                      if (curToNum <= fromNum) {
                        setEditToTime(validToSlots[validToSlots.length - 1].value);
                      }
                    }
                    setShowFromTimeModal(false);
                  }}
                >
                  <Text style={[styles.slotPickerText, editFromTime === item.value && styles.slotPickerTextSelected]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* TO TIME PICKER MODAL */}
      <Modal visible={showToTimeModal} animationType="slide" transparent={true} onRequestClose={() => setShowToTimeModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { maxHeight: '60%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select To Time</Text>
              <TouchableOpacity onPress={() => setShowToTimeModal(false)} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={getValidToTimeSlots(editFromTime)}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.slotPickerItem, editToTime === item.value && styles.slotPickerItemSelected]}
                  onPress={() => {
                    setEditToTime(item.value);
                    setShowToTimeModal(false);
                  }}
                >
                  <Text style={[styles.slotPickerText, editToTime === item.value && styles.slotPickerTextSelected]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
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
  contentPadding: {
    flex: 1,
    padding: 16,
  },
  searchInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#0F172A',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    marginBottom: 16,
  },
  list: {
    gap: 12,
  },
  emptyText: {
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 40,
    fontSize: 14,
  },
  studentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  studentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  studentHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  cardAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  cardAvatarFallback: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardAvatarText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#2563EB',
  },
  studentName: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '800',
  },
  cardSubText: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '600',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  bgActive: { backgroundColor: '#DCFCE7' },
  bgInactive: { backgroundColor: '#FEE2E2' },
  bgExpired: { backgroundColor: '#FEF3C7' },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  textActive: { color: '#15803D' },
  textInactive: { color: '#B91C1C' },
  textExpired: { color: '#B45309' },
  detailText: {
    color: '#475569',
    fontSize: 13,
    marginTop: 3,
  },
  miniMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  miniMetaText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  tapToViewHint: {
    fontSize: 11,
    color: '#2563EB',
    fontWeight: '700',
    marginTop: 10,
    textAlign: 'right',
  },
  /* MODAL STYLES */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    padding: 16,
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    maxHeight: '90%',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  closeBtn: {
    padding: 4,
  },
  closeBtnText: {
    fontSize: 18,
    color: '#64748B',
    fontWeight: '800',
  },
  modalBody: {
    padding: 20,
  },
  profileHeroCard: {
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  heroAvatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 2,
    borderColor: '#2563EB',
    marginBottom: 8,
  },
  heroAvatarFallback: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#EFF6FF',
    borderWidth: 2,
    borderColor: '#BFDBFE',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  heroAvatarText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#2563EB',
  },
  profileName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  profileIdText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '600',
  },
  tempPwdBanner: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  tempPwdHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tempPwdIcon: { fontSize: 20 },
  tempPwdTitle: { fontSize: 13, fontWeight: '800', color: '#B45309' },
  tempPwdSub: { fontSize: 11, color: '#78350F' },
  boldTime: { fontWeight: '800', color: '#DC2626' },
  tempPwdCopyBtn: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  tempPwdCopyText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  tempPwdBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 8,
    marginTop: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  tempPwdText: { fontSize: 16, fontWeight: '800', color: '#0F172A', letterSpacing: 1 },
  tempPwdHideBtn: { marginTop: 6, alignItems: 'center' },
  tempPwdHideText: { fontSize: 11, color: '#B45309', fontWeight: '700', textDecorationLine: 'underline' },
  detailBox: {
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  fieldValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  textDanger: {
    color: '#DC2626',
    fontWeight: '800',
  },
  fieldValueHighlight: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2563EB',
  },
  fieldValueSuccess: {
    fontSize: 14,
    fontWeight: '800',
    color: '#16A34A',
  },
  fieldValueMuted: {
    fontSize: 14,
    color: '#94A3B8',
    fontStyle: 'italic',
  },
  inactiveWarningBox: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 10,
    padding: 12,
    marginVertical: 10,
  },
  inactiveWarningText: {
    fontSize: 12,
    color: '#991B1B',
    lineHeight: 16,
  },
  actionBtnContainer: {
    marginTop: 16,
    gap: 10,
  },
  editProfileBtn: {
    backgroundColor: '#2563EB',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  editProfileBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  statusToggleBtn: {
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  btnDanger: {
    backgroundColor: '#DC2626',
  },
  btnSuccess: {
    backgroundColor: '#16A34A',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  statusToggleBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  referModalBtn: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#2563EB',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  referModalBtnText: {
    color: '#2563EB',
    fontWeight: '800',
    fontSize: 13,
  },
  /* EDIT MODAL STYLES */
  editAvatarContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  editAvatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: '#2563EB',
    marginBottom: 8,
  },
  editAvatarFallback: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    marginBottom: 8,
  },
  editAvatarText: { fontSize: 28 },
  pickPhotoBtn: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  pickPhotoBtnText: { fontSize: 12, fontWeight: '700', color: '#1D4ED8' },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 4,
    marginTop: 6,
  },
  modalInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '600',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    marginBottom: 10,
  },
  passwordSectionBox: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 12,
    padding: 12,
    marginVertical: 10,
  },
  passwordSectionTitle: { fontSize: 13, fontWeight: '800', color: '#B45309', marginBottom: 2 },
  passwordSubText: { fontSize: 11, color: '#78350F', marginBottom: 8, lineHeight: 15 },
  editActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  cancelEditBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelEditText: { color: '#475569', fontWeight: '800', fontSize: 14 },
  saveEditBtn: {
    flex: 1,
    backgroundColor: '#2563EB',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveEditText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
  timePickerRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10,
  },
  timeSlotBtn: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  timeSlotSubText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  timeSlotValueText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  slotPickerItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  slotPickerItemSelected: {
    backgroundColor: '#EFF6FF',
  },
  slotPickerText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#334155',
  },
  slotPickerTextSelected: {
    color: '#2563EB',
    fontWeight: '800',
  },
});
