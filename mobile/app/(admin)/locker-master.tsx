import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../src/services/api.client';
import { sortItemsNaturally } from '../../src/utils/sorting';
import { HamburgerMenu } from '../../src/components/HamburgerMenu';
import { LOCAL_ADMIN_MENU } from '../../src/constants/menuItems';
import { useDebounce } from '../../src/hooks/useDebounce';

const parseItemPrefixAndNum = (numStr: string) => {
  const str = (numStr || '').trim();
  if (!str) return { prefix: '', num: 0 };

  const match = str.match(/^([A-Za-z\s_-]+)?(\d+)$/);
  if (match) {
    const rawP = match[1] || '';
    const normP = rawP.trim().toUpperCase().replace(/[-_]+$/, '');
    const num = parseInt(match[2], 10);
    return { prefix: normP, num };
  }

  const digitMatch = str.match(/\d+$/);
  if (digitMatch) {
    const num = parseInt(digitMatch[0], 10);
    const rawP = str.substring(0, str.length - digitMatch[0].length);
    const normP = rawP.trim().toUpperCase().replace(/[-_]+$/, '');
    return { prefix: normP, num };
  }

  return { prefix: str.toUpperCase(), num: 0 };
};

const formatItemNumber = (rawPrefix: string, candidate: number, existingItems: any[]) => {
  const cleanPrefix = (rawPrefix || '').trim();
  if (!cleanPrefix) {
    return `${candidate}`;
  }

  const pNorm = cleanPrefix.toUpperCase().replace(/[-_]+$/, '');
  let usesHyphen = cleanPrefix.endsWith('-') || cleanPrefix.endsWith('_');
  let usesZeroPadding = false;

  for (const item of existingItems) {
    const val = (item.seatNumber || item.lockerNumber || '').trim();
    if (val.toUpperCase().startsWith(pNorm)) {
      if (val.includes('-') || val.includes('_')) usesHyphen = true;
      const parsed = parseItemPrefixAndNum(val);
      if (parsed.prefix === pNorm) {
        const matchDigits = val.match(/\d+$/);
        if (matchDigits && matchDigits[0].length >= 2 && matchDigits[0].startsWith('0')) {
          usesZeroPadding = true;
        }
      }
    }
  }

  const numPart = (usesZeroPadding && candidate < 10) ? `0${candidate}` : `${candidate}`;
  const prefixPart = usesHyphen && !cleanPrefix.endsWith('-') && !cleanPrefix.endsWith('_') ? `${cleanPrefix}-` : cleanPrefix;

  return `${prefixPart}${numPart}`;
};

const getPreviewItems = (
  targetFloorStr: string,
  prefixStr: string,
  startNumStr: string,
  countStr: string,
  allExistingItems: any[]
) => {
  const parsedFloor = parseInt(targetFloorStr.trim(), 10);
  const parsedCount = parseInt(countStr.trim(), 10);
  if (isNaN(parsedFloor) || parsedFloor < 1 || isNaN(parsedCount) || parsedCount < 1 || parsedCount > 500) {
    return null;
  }

  const floorItems = (allExistingItems || []).filter((item: any) => Math.max(1, Number(item.floor) || 1) === parsedFloor);
  const existingSet = new Set(floorItems.map((s: any) => (s.seatNumber || s.lockerNumber || '').toUpperCase().trim()));

  const rawPrefix = prefixStr.trim();
  const targetPrefixNorm = rawPrefix ? rawPrefix.toUpperCase().replace(/[-_]+$/, '') : '';
  const explicitStart = startNumStr.trim() ? parseInt(startNumStr.trim(), 10) : undefined;

  let candidate = 1;
  if (explicitStart && !isNaN(explicitStart) && explicitStart > 0) {
    candidate = explicitStart;
  } else {
    let maxFloorNum = 0;
    for (const item of floorItems) {
      const numStr = (item.seatNumber || item.lockerNumber || '').trim();
      const parsed = parseItemPrefixAndNum(numStr);
      if (parsed.prefix === targetPrefixNorm) {
        if (parsed.num > maxFloorNum) {
          maxFloorNum = parsed.num;
        }
      }
    }
    candidate = maxFloorNum > 0 ? maxFloorNum + 1 : 1;
  }

  const preview: string[] = [];
  while (preview.length < parsedCount && candidate < 10000) {
    const itemNum = formatItemNumber(rawPrefix, candidate, floorItems);
    if (!existingSet.has(itemNum.toUpperCase())) {
      preview.push(itemNum);
    }
    candidate++;
  }
  return preview;
};

import {
  HOURLY_TIME_SLOTS,
  getTimeSlotLabel,
  calculateSlotDurationHours,
  calculateSlotPricing,
  getValidToTimeSlots,
  validateMonths,
  parseTimeToHourNum,
} from '../../src/utils/timeSlots';

const SHIFT_OPTIONS = ['Full Day', 'Morning Shift', 'Evening Shift', 'Night Shift'];

export default function LockerMasterScreen() {
  const queryClient = useQueryClient();
  const [selectedFloorFilter, setSelectedFloorFilter] = useState<number>(1);

  // Multi-select bulk delete states
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedLockerIds, setSelectedLockerIds] = useState<string[]>([]);
  const [deletingBulk, setDeletingBulk] = useState(false);

  // Modals
  const [bulkModalVisible, setBulkModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [actionMenuVisible, setActionMenuVisible] = useState(false);

  // Active Locker selection
  const [selectedLocker, setSelectedLocker] = useState<any>(null);

  // Bulk form
  const [floor, setFloor] = useState('1');
  const [bulkPrefix, setBulkPrefix] = useState('');
  const [bulkStartNumber, setBulkStartNumber] = useState('');
  const [bulkCount, setBulkCount] = useState('10');
  const [priceMonthly, setPriceMonthly] = useState('300');

  // Edit Single Locker form
  const [editPrice, setEditPrice] = useState('');
  const [editFloor, setEditFloor] = useState('');

  // Assign Student form
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [fromTime, setFromTime] = useState<string>('06:00');
  const [toTime, setToTime] = useState<string>('23:00');
  const [showFromModal, setShowFromModal] = useState(false);
  const [showToModal, setShowToModal] = useState(false);
  const [durationMonthsInput, setDurationMonthsInput] = useState<string>('1');
  const [submitting, setSubmitting] = useState(false);

  // Configurator Filter states
  const [filterSearchStudent, setFilterSearchStudent] = useState('');
  const debouncedFilterSearchStudent = useDebounce(filterSearchStudent, 350);
  const [filterFromTime, setFilterFromTime] = useState<string>('ALL');
  const [filterToTime, setFilterToTime] = useState<string>('ALL');
  const [showFilterFromModal, setShowFilterFromModal] = useState(false);
  const [showFilterToModal, setShowFilterToModal] = useState(false);

  // Fetch Locker Master
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['locker-master-list', selectedFloorFilter],
    queryFn: async () => {
      const params: string[] = [];
      if (selectedFloorFilter) params.push(`floor=${selectedFloorFilter}`);
      const qStr = params.length > 0 ? `?${params.join('&')}` : '';
      const res = await apiRequest(`/admin/locker-master${qStr}`);
      if (!res.success) throw new Error(res.error?.message || 'Failed to fetch Locker Master');
      return res.data;
    },
    placeholderData: (previousData) => previousData,
    retry: 1,
  });

  // Fetch Active Students for Library
  const { data: activeStudents, isLoading: loadingStudents } = useQuery({
    queryKey: ['active-students-list'],
    queryFn: async () => {
      const res = await apiRequest('/admin/students?status=ACTIVE');
      return res.data?.students || [];
    },
    retry: 1,
  });

  const lockers = data?.lockers || [];
  const floorsMap: Record<number, any[]> = data?.floorsMap || {};
  const apiFloorNumbers: number[] = data?.floorNumbers || [];
  const rawFloorNumbers = Object.keys(floorsMap).map((f) => parseInt(f, 10)).filter((n) => !isNaN(n)).sort((a, b) => a - b);
  const combinedFloors = Array.from(new Set([...apiFloorNumbers, ...rawFloorNumbers])).sort((a, b) => a - b);
  const floorNumbers = combinedFloors.length > 0 ? combinedFloors : [1];

  if (isLoading && !data) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Loading Locker Layout & Master...</Text>
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.container}>
        <HamburgerMenu title="Locker Master Configuration" role="LIBRARY_ADMIN" items={LOCAL_ADMIN_MENU} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>⚠️ Unable to Load Locker Layout</Text>
          <Text style={styles.errorText}>{(error as Error)?.message || 'Request timed out or failed.'}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()}>
            <Text style={styles.retryText}>🔄 Retry Loading</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const handleBulkCreate = async () => {
    const flNum = parseInt(floor.trim(), 10);
    const cNum = parseInt(bulkCount.trim(), 10);
    const sNum = bulkStartNumber.trim() ? parseInt(bulkStartNumber.trim(), 10) : undefined;

    if (!floor.trim() || isNaN(flNum) || flNum < 1 || floor.includes('.')) {
      Alert.alert('Validation Error', 'Floor Number must be a valid positive whole number (e.g. 1, 2, 3).');
      return;
    }
    if (flNum > 10) {
      Alert.alert('Validation Error', 'Floor Number cannot exceed 10 (maximum 10 floors per library).');
      return;
    }
    if (!bulkCount.trim() || isNaN(cNum) || cNum < 1 || bulkCount.includes('.')) {
      Alert.alert('Validation Error', 'Number of Lockers to Create must be a valid positive whole number (e.g. 10, 20).');
      return;
    }
    if (cNum > 100) {
      Alert.alert('Validation Error', 'Number of Lockers to Create cannot exceed 100 per floor per request.');
      return;
    }
    if (sNum !== undefined && (isNaN(sNum) || sNum < 1 || bulkStartNumber.includes('.'))) {
      Alert.alert('Validation Error', 'Starting Number must be a valid positive whole number (e.g. 1, 10, 20).');
      return;
    }
    if (sNum !== undefined && sNum > cNum) {
      Alert.alert('Validation Error', `Starting Number (${sNum}) cannot exceed the number of lockers being created (${cNum}).`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiRequest('/admin/locker-master', 'POST', {
        action: 'BULK_CREATE',
        floor: flNum,
        bulkPrefix: bulkPrefix.trim(),
        bulkStartNumber: bulkStartNumber.trim(),
        bulkCount: cNum,
      });

      if (res.success) {
        Alert.alert('Lockers Generated!', res.data?.message || 'Lockers created successfully.');
        setBulkModalVisible(false);
        setBulkStartNumber('');
        queryClient.invalidateQueries({ queryKey: ['locker-master-list'] });
      } else {
        Alert.alert('Error', res.error?.message || 'Failed to generate lockers');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'An error occurred during locker generation');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateLocker = async () => {
    if (!selectedLocker) return;

    setSubmitting(true);
    try {
      const res = await apiRequest('/admin/locker-master', 'POST', {
        action: 'UPDATE',
        lockerId: selectedLocker._id,
        floor: parseInt(editFloor, 10),
      });

      if (res.success) {
        Alert.alert('Locker Updated', `Locker ${selectedLocker.lockerNumber} updated.`);
        setEditModalVisible(false);
        queryClient.invalidateQueries({ queryKey: ['locker-master-list'] });
      } else {
        Alert.alert('Error', res.error?.message || 'Failed to update locker');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAssignStudent = async () => {
    if (!selectedLocker || !selectedStudentId) {
      Alert.alert('Validation Error', 'Please select an active student to assign.');
      return;
    }

    const { isValid: isMonthsValid, parsed: validMonths, errorMsg } = validateMonths(durationMonthsInput);
    if (!isMonthsValid) {
      Alert.alert('Invalid Duration', errorMsg || 'Please enter a valid duration between 1 and 50 months.');
      return;
    }

    const fNum = parseTimeToHourNum(fromTime);
    const tNum = parseTimeToHourNum(toTime);
    if (tNum <= fNum) {
      Alert.alert('Invalid Time Range', 'To Time must be at least 1 hour after From Time.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiRequest('/admin/locker-master', 'POST', {
        action: 'ASSIGN_STUDENT',
        lockerId: selectedLocker._id,
        studentProfileId: selectedStudentId,
        fromTime,
        toTime,
        durationMonths: validMonths,
      });

      if (res.success) {
        Alert.alert('Assignment Successful', res.data?.message || `Locker assigned successfully.`);
        setAssignModalVisible(false);
        queryClient.invalidateQueries({ queryKey: ['locker-master-list'] });
      } else {
        Alert.alert('Assignment Error', res.error?.message || 'Failed to assign locker.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnassignLocker = async (studentProfileId?: string) => {
    if (!selectedLocker) return;

    Alert.alert(
      'Release Locker Reservation',
      `Release reservation for Locker ${selectedLocker.lockerNumber}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Release',
          style: 'destructive',
          onPress: async () => {
            setSubmitting(true);
            try {
              const res = await apiRequest('/admin/locker-master', 'POST', {
                action: 'UNASSIGN_STUDENT',
                lockerId: selectedLocker._id,
                studentProfileId,
              });

              if (res.success) {
                Alert.alert('Locker Released', `Locker ${selectedLocker.lockerNumber} reservation released.`);
                setActionMenuVisible(false);
                queryClient.invalidateQueries({ queryKey: ['locker-master-list'] });
              } else {
                Alert.alert('Error', res.error?.message || 'Failed to release locker.');
              }
            } catch (err: any) {
              Alert.alert('Error', err.message);
            } finally {
              setSubmitting(false);
            }
          },
        },
      ]
    );
  };

  const handleBulkDeleteLockers = async () => {
    if (selectedLockerIds.length === 0) return;

    Alert.alert(
      'Confirm Bulk Delete',
      `Are you sure you want to delete ${selectedLockerIds.length} selected locker(s)? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: `Delete ${selectedLockerIds.length} Locker(s)`,
          style: 'destructive',
          onPress: async () => {
            setDeletingBulk(true);
            try {
              const res = await apiRequest('/admin/locker-master', 'POST', {
                action: 'BULK_DELETE',
                lockerIds: selectedLockerIds,
              });

              if (res.success) {
                Alert.alert('Lockers Deleted ✅', res.data?.message || `${selectedLockerIds.length} lockers deleted successfully.`);
                setSelectedLockerIds([]);
                setIsSelectMode(false);
                refetch();
              } else {
                Alert.alert('Delete Failed', res.error?.message || 'Failed to delete selected lockers.');
              }
            } catch (err: any) {
              Alert.alert('Error', err.message || 'An error occurred while deleting lockers.');
            } finally {
              setDeletingBulk(false);
            }
          },
        },
      ]
    );
  };

  const handleToggleSelectLocker = (lockerId: string) => {
    setSelectedLockerIds((prev) =>
      prev.includes(lockerId) ? prev.filter((id) => id !== lockerId) : [...prev, lockerId]
    );
  };

  const handleToggleSelectAllFloorLockers = (floorLockers: any[]) => {
    const floorLockerIds = floorLockers.map((l) => l._id);
    const allSelected = floorLockerIds.every((id) => selectedLockerIds.includes(id));

    if (allSelected) {
      setSelectedLockerIds((prev) => prev.filter((id) => !floorLockerIds.includes(id)));
    } else {
      setSelectedLockerIds((prev) => Array.from(new Set([...prev, ...floorLockerIds])));
    }
  };

  if (isLoading && !data) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Loading Locker Layout & Master...</Text>
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.container}>
        <HamburgerMenu title="Locker Master Configuration" role="LIBRARY_ADMIN" items={LOCAL_ADMIN_MENU} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>⚠️ Unable to Load Locker Layout</Text>
          <Text style={styles.errorText}>{(error as Error)?.message || 'Request timed out or failed.'}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => (refetch as any)()}>
            <Text style={styles.retryText}>🔄 Retry Loading</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const isLockerOccupiedInTimeSlot = (locker: any, fTime: string, tTime: string) => {
    const rawAssigned = locker.assignedReservations && locker.assignedReservations.length > 0
      ? locker.assignedReservations
      : locker.currentReservation?.studentId ? [locker.currentReservation] : [];
    const activeList = rawAssigned.filter((r: any) => !r.endAt || new Date(r.endAt) > new Date());

    return activeList.some((r: any) => {
      const f1 = parseTimeToHourNum(r.fromTime || '06:00');
      const t1 = parseTimeToHourNum(r.toTime || '23:00');
      const f2 = parseTimeToHourNum(fTime);
      const t2 = parseTimeToHourNum(tTime);
      const effT1 = t1 > f1 ? t1 : 24;
      const effT2 = t2 > f2 ? t2 : 24;
      return f1 < effT2 && effT1 > f2;
    });
  };

  const isLockerAssignedToStudent = (locker: any, searchStr: string) => {
    if (!searchStr.trim()) return false;
    const sTerm = searchStr.trim().toLowerCase();
    const rawAssigned = locker.assignedReservations && locker.assignedReservations.length > 0
      ? locker.assignedReservations
      : locker.currentReservation?.studentId ? [locker.currentReservation] : [];
    const activeList = rawAssigned.filter((r: any) => !r.endAt || new Date(r.endAt) > new Date());

    return activeList.some((r: any) => {
      const uName = (r.studentId?.userId?.fullName || '').toLowerCase();
      const uPhone = (r.studentId?.userId?.phone || '').toLowerCase();
      return uName.includes(sTerm) || uPhone.includes(sTerm);
    });
  };

  const isLockerOccupiedInTimeSlotOrOverall = (locker: any) => {
    if (filterFromTime !== 'ALL' && filterToTime !== 'ALL') {
      return isLockerOccupiedInTimeSlot(locker, filterFromTime, filterToTime);
    }
    const rawAssigned = locker.assignedReservations && locker.assignedReservations.length > 0
      ? locker.assignedReservations
      : locker.currentReservation?.studentId ? [locker.currentReservation] : [];
    const activeList = rawAssigned.filter((r: any) => !r.endAt || new Date(r.endAt) > new Date());
    return locker.status === 'OCCUPIED' || locker.status === 'RESERVED' || activeList.length > 0;
  };

  const filteredLockers = sortItemsNaturally(
    lockers.filter((l: any) => {
      if (l.floor !== selectedFloorFilter) return false;
      if (filterSearchStudent.trim()) {
        if (!isLockerAssignedToStudent(l, filterSearchStudent)) return false;
      }
      return true;
    }),
    'lockerNumber'
  );

  const totalLockersCount = filteredLockers.length;
  const occupiedLockersCount = filteredLockers.filter(isLockerOccupiedInTimeSlotOrOverall).length;
  const availableLockersCount = totalLockersCount - occupiedLockersCount;

  return (
    <View style={styles.container}>
      <HamburgerMenu title="Locker Master Configuration" role="LIBRARY_ADMIN" items={LOCAL_ADMIN_MENU} />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>Locker Master Configurator</Text>
            <Text style={styles.subTitle}>Click any locker to assign active student, change floor, or release</Text>
          </View>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => {
              setFloor(String(selectedFloorFilter));
              setBulkModalVisible(true);
            }}
          >
            <Text style={styles.addBtnText}>➕ Bulk Add Lockers</Text>
          </TouchableOpacity>
        </View>

        {/* Filter Controls Bar */}
        <View style={styles.filterSection}>
          <Text style={styles.filterSectionTitle}>🔍 Search & Time Filters</Text>

          {/* Student Search Filter */}
          <Text style={styles.filterInputLabel}>Student Search (Name or Phone)</Text>
          <View style={styles.searchBoxRow}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search assigned student..."
              placeholderTextColor="#94A3B8"
              value={filterSearchStudent}
              onChangeText={setFilterSearchStudent}
            />
            {filterSearchStudent ? (
              <TouchableOpacity style={styles.clearSearchBtn} onPress={() => setFilterSearchStudent('')}>
                <Text style={styles.clearSearchText}>✕ Clear</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Time Range Filter (Hour-Only Dropdowns) */}
          <Text style={styles.filterInputLabel}>Daily Time Range (Hour-Only)</Text>
          <View style={styles.timeFilterRow}>
            <TouchableOpacity style={styles.timeFilterBtn} onPress={() => setShowFilterFromModal(true)}>
              <Text style={styles.timeFilterSubText}>From Time</Text>
              <Text style={styles.timeFilterValText}>
                {filterFromTime === 'ALL' ? 'All Hours' : getTimeSlotLabel(filterFromTime)} ▾
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.timeFilterBtn} onPress={() => setShowFilterToModal(true)}>
              <Text style={styles.timeFilterSubText}>To Time</Text>
              <Text style={styles.timeFilterValText}>
                {filterToTime === 'ALL' ? 'All Hours' : getTimeSlotLabel(filterToTime)} ▾
              </Text>
            </TouchableOpacity>

            {(filterFromTime !== 'ALL' || filterToTime !== 'ALL') && (
              <TouchableOpacity
                style={styles.resetTimeBtn}
                onPress={() => {
                  setFilterFromTime('ALL');
                  setFilterToTime('ALL');
                }}
              >
                <Text style={styles.resetTimeText}>🔄 Reset</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Metrics Summary Strip */}
          <View style={styles.summaryStrip}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryNum}>{totalLockersCount}</Text>
              <Text style={styles.summaryLabel}>Total Lockers</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryNum, { color: '#059669' }]}>{availableLockersCount}</Text>
              <Text style={styles.summaryLabel}>Available</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryNum, { color: '#D97706' }]}>{occupiedLockersCount}</Text>
              <Text style={styles.summaryLabel}>Occupied</Text>
            </View>
          </View>
        </View>

        {/* Floor Filter Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillsScroll}>
          {floorNumbers.map((flNum) => {
            const flSummary = data?.floorsSummary?.[flNum];
            const flCount = flSummary ? flSummary.total : (floorsMap[flNum]?.length || 0);

            return (
              <TouchableOpacity
                key={flNum}
                style={[styles.pill, selectedFloorFilter === flNum && styles.activePill]}
                onPress={() => {
                  setSelectedFloorFilter(flNum);
                  setSelectedLockerIds([]);
                }}
              >
                <Text style={[styles.pillText, selectedFloorFilter === flNum && styles.activePillText]}>
                  Floor {flNum} ({flCount})
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Bulk Selection Bar */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 10 }}>
          <TouchableOpacity
            style={{
              backgroundColor: isSelectMode ? '#FEF2F2' : '#EFF6FF',
              borderWidth: 1,
              borderColor: isSelectMode ? '#FECACA' : '#BFDBFE',
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 8,
            }}
            onPress={() => {
              setIsSelectMode(!isSelectMode);
              setSelectedLockerIds([]);
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: '700', color: isSelectMode ? '#DC2626' : '#1D4ED8' }}>
              {isSelectMode ? '✕ Cancel Bulk Delete' : '☑️ Select Lockers to Delete'}
            </Text>
          </TouchableOpacity>

          {isSelectMode && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TouchableOpacity
                style={{ backgroundColor: '#F1F5F9', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8 }}
                onPress={() => handleToggleSelectAllFloorLockers(filteredLockers)}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#334155' }}>
                  {filteredLockers.length > 0 && filteredLockers.every((l: any) => selectedLockerIds.includes(l._id))
                    ? 'Deselect All'
                    : 'Select All'}
                </Text>
              </TouchableOpacity>

              {selectedLockerIds.length > 0 && (
                <TouchableOpacity
                  style={{
                    backgroundColor: '#DC2626',
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 8,
                  }}
                  onPress={handleBulkDeleteLockers}
                  disabled={deletingBulk}
                >
                  {deletingBulk ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={{ fontSize: 12, fontWeight: '800', color: '#FFFFFF' }}>
                      🗑️ Delete ({selectedLockerIds.length})
                    </Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* Floor-wise Locker Grid */}
        {filteredLockers.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No lockers match the selected floor, time range, or search query.</Text>
            <TouchableOpacity style={styles.inlineAddBtn} onPress={() => setBulkModalVisible(true)}>
              <Text style={styles.inlineAddText}>Generate Lockers for Floor {selectedFloorFilter}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.grid}>
            {filteredLockers.map((locker: any) => {
              const isOccupied = isLockerOccupiedInTimeSlotOrOverall(locker);
              const reservedUser = locker.currentReservation?.studentId?.userId?.fullName;
              const isSearchedMatch = filterSearchStudent.trim() && isLockerAssignedToStudent(locker, filterSearchStudent);
              const isChecked = selectedLockerIds.includes(locker._id);

              return (
                <TouchableOpacity
                  key={locker._id}
                  style={[
                    styles.card,
                    isChecked
                      ? { borderColor: '#DC2626', borderWidth: 2, backgroundColor: '#FEF2F2' }
                      : isSearchedMatch
                      ? styles.lockerHighlighted
                      : isOccupied
                      ? styles.occupied
                      : styles.available,
                  ]}
                  onPress={() => {
                    if (isSelectMode) {
                      handleToggleSelectLocker(locker._id);
                    } else {
                      setSelectedLocker(locker);
                      setActionMenuVisible(true);
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.topRow}>
                    <Text style={styles.numberText}>
                      {isSelectMode ? (isChecked ? '☑️ ' : '☐ ') : ''}{locker.lockerNumber}
                    </Text>
                    <View style={styles.floorBadge}>
                      <Text style={styles.floorText}>Fl {locker.floor || 1}</Text>
                    </View>
                  </View>

                  {isSearchedMatch && (
                    <View style={styles.highlightBadge}>
                      <Text style={styles.highlightBadgeText}>⭐ MATCHING SEARCH</Text>
                    </View>
                  )}

                  {isOccupied ? (
                    <View style={{ marginTop: 4 }}>
                      <Text style={styles.occupantText} numberOfLines={1}>👤 {reservedUser || 'Reserved'}</Text>
                    </View>
                  ) : (
                    <Text style={styles.availableText}>🟢 Available (Tap)</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Modal: Locker Action Menu */}
        <Modal animationType="fade" transparent visible={actionMenuVisible} onRequestClose={() => setActionMenuVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.actionMenuCard}>
              <Text style={styles.actionMenuTitle}>Locker {selectedLocker?.lockerNumber} Options</Text>
              <Text style={styles.actionMenuSub}>Floor {selectedLocker?.floor}</Text>

              {/* Multi-student Reservation List */}
              {(() => {
                const rawAssigned = selectedLocker?.assignedReservations && selectedLocker.assignedReservations.length > 0
                  ? selectedLocker.assignedReservations
                  : selectedLocker?.currentReservation?.studentId ? [selectedLocker.currentReservation] : [];
                
                const activeList = rawAssigned.filter((r: any) => !r.endAt || new Date(r.endAt) > new Date());

                if (activeList.length === 0) {
                  return (
                    <View style={{ backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#BBF7D0', borderRadius: 8, padding: 10, marginBottom: 12 }}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: '#166534' }}>🟢 Currently Available for Assignment</Text>
                    </View>
                  );
                }

                return (
                  <View style={{ marginBottom: 12, maxHeight: 180 }}>
                    <Text style={{ fontSize: 13, fontWeight: '800', color: '#0F172A', marginBottom: 6 }}>Assigned Active Student(s):</Text>
                    <ScrollView nestedScrollEnabled>
                      {activeList.map((res: any, idx: number) => {
                        const stName = res.studentId?.userId?.fullName || 'Student';
                        const stPhone = res.studentId?.userId?.phone || '';
                        const stFrom = res.fromTime ? getTimeSlotLabel(res.fromTime) : '06:00 AM';
                        const stTo = res.toTime ? getTimeSlotLabel(res.toTime) : '11:00 PM';
                        const stId = res.studentId?._id || res.studentId;

                        return (
                          <View key={res._id || `res-${idx}`} style={{ backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE', borderRadius: 10, padding: 10, marginBottom: 8 }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Text style={{ fontSize: 13, fontWeight: '800', color: '#1E40AF' }}>👤 {stName}</Text>
                              <TouchableOpacity style={{ backgroundColor: '#FEE2E2', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }} onPress={() => handleUnassignLocker(stId)}>
                                <Text style={{ fontSize: 11, fontWeight: '800', color: '#DC2626' }}>❌ Release</Text>
                              </TouchableOpacity>
                            </View>
                            <Text style={{ fontSize: 12, color: '#1E3A8A', marginTop: 4, fontWeight: '600' }}>
                              ⏱️ Slot: {stFrom} → {stTo}
                            </Text>
                            {stPhone ? <Text style={{ fontSize: 11, color: '#3B82F6', marginTop: 2 }}>📞 {stPhone}</Text> : null}
                          </View>
                        );
                      })}
                    </ScrollView>
                  </View>
                );
              })()}

              <View style={styles.actionList}>
                <TouchableOpacity
                  style={styles.actionOptionBtnPrimary}
                  onPress={() => {
                    setActionMenuVisible(false);
                    setSelectedStudentId('');
                    setAssignModalVisible(true);
                  }}
                >
                  <Text style={styles.actionOptionTextPrimary}>➕ Assign Student to Locker</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionOptionBtnSecondary}
                  onPress={() => {
                    setActionMenuVisible(false);
                    setEditFloor(selectedLocker?.floor?.toString() || '1');
                    setEditModalVisible(true);
                  }}
                >
                  <Text style={styles.actionOptionTextSecondary}>✏️ Change Floor Number</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.closeMenuBtn} onPress={() => setActionMenuVisible(false)}>
                  <Text style={styles.closeMenuText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Modal: Assign Student to Locker */}
        <Modal animationType="slide" transparent visible={assignModalVisible} onRequestClose={() => setAssignModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Assign Locker {selectedLocker?.lockerNumber}</Text>
              <Text style={styles.modalSub}>Select active student, daily time slot, and duration</Text>

              <Text style={styles.label}>Active Student *</Text>
              {loadingStudents ? (
                <ActivityIndicator size="small" color="#2563EB" style={{ marginVertical: 8 }} />
              ) : !activeStudents || activeStudents.length === 0 ? (
                <Text style={styles.noStudentsText}>No active students found in your local library.</Text>
              ) : (
                <ScrollView style={styles.studentPickerList} nestedScrollEnabled>
                  {activeStudents.map((st: any) => {
                    const isSelected = selectedStudentId === st._id;
                    return (
                      <TouchableOpacity
                        key={st._id}
                        style={[styles.studentPickerItem, isSelected && styles.studentPickerItemActive]}
                        onPress={() => setSelectedStudentId(st._id)}
                      >
                        <Text style={[styles.studentPickerName, isSelected && styles.studentPickerNameActive]}>
                          {st.userId?.fullName || 'Student'}
                        </Text>
                        <Text style={[styles.studentPickerPhone, isSelected && styles.studentPickerPhoneActive]}>
                          📞 {st.userId?.phone}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}

              {/* Time Slots Selection */}
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>From Time *</Text>
                  <TouchableOpacity
                    style={{ backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, justifyContent: 'center' }}
                    onPress={() => setShowFromModal(true)}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F172A' }}>{getTimeSlotLabel(fromTime)}</Text>
                  </TouchableOpacity>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>To Time *</Text>
                  <TouchableOpacity
                    style={{ backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, justifyContent: 'center' }}
                    onPress={() => setShowToModal(true)}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F172A' }}>{getTimeSlotLabel(toTime)}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <Text style={styles.label}>Duration (Months: 1–50) *</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={durationMonthsInput}
                onChangeText={(val) => setDurationMonthsInput(val.replace(/[^0-9]/g, ''))}
                placeholder="1"
                placeholderTextColor="#64748B"
              />

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setAssignModalVisible(false)}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.confirmBtn, (submitting || !selectedStudentId) && styles.btnDisabled]}
                  onPress={handleAssignStudent}
                  disabled={submitting || !selectedStudentId}
                >
                  {submitting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.confirmText}>Confirm Assignment</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Modal: From Time Picker */}
        <Modal animationType="fade" transparent visible={showFromModal} onRequestClose={() => setShowFromModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Select From Time</Text>
              <ScrollView style={{ maxHeight: 300, marginVertical: 12 }} nestedScrollEnabled>
                {HOURLY_TIME_SLOTS.slice(0, -1).map((slot) => {
                  const isSelected = fromTime === slot.value;
                  return (
                    <TouchableOpacity
                      key={slot.value}
                      style={[styles.studentPickerItem, isSelected && styles.studentPickerItemActive]}
                      onPress={() => {
                        setFromTime(slot.value);
                        setShowFromModal(false);
                        const validTos = getValidToTimeSlots(slot.value);
                        if (validTos.length > 0) {
                          const currentToHour = parseTimeToHourNum(toTime);
                          const fromHour = parseTimeToHourNum(slot.value);
                          if (currentToHour <= fromHour) {
                            setToTime(validTos[0].value);
                          }
                        }
                      }}
                    >
                      <Text style={[styles.studentPickerName, isSelected && styles.studentPickerNameActive]}>{slot.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowFromModal(false)}>
                <Text style={styles.cancelText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Modal: To Time Picker */}
        <Modal animationType="fade" transparent visible={showToModal} onRequestClose={() => setShowToModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Select To Time</Text>
              <Text style={{ fontSize: 12, color: '#64748B', marginTop: 2, marginBottom: 8 }}>
                Must be at least 1 hour after {getTimeSlotLabel(fromTime)}
              </Text>
              <ScrollView style={{ maxHeight: 300, marginVertical: 12 }} nestedScrollEnabled>
                {getValidToTimeSlots(fromTime).map((slot) => {
                  const isSelected = toTime === slot.value;
                  return (
                    <TouchableOpacity
                      key={slot.value}
                      style={[styles.studentPickerItem, isSelected && styles.studentPickerItemActive]}
                      onPress={() => {
                        setToTime(slot.value);
                        setShowToModal(false);
                      }}
                    >
                      <Text style={[styles.studentPickerName, isSelected && styles.studentPickerNameActive]}>{slot.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowToModal(false)}>
                <Text style={styles.cancelText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Modal: Bulk Generate Lockers */}
        <Modal animationType="slide" transparent visible={bulkModalVisible} onRequestClose={() => setBulkModalVisible(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
            <View style={[styles.modalCard, { maxHeight: '85%', paddingBottom: 16 }]}>
              <Text style={styles.modalTitle}>Bulk Generate Lockers</Text>
              <Text style={styles.modalSub}>Specify floor, prefix and locker count</Text>

              <ScrollView style={{ flexShrink: 1, marginVertical: 8 }} keyboardShouldPersistTaps="handled">
                <Text style={styles.label}>Floor Number *</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={floor}
                  onChangeText={(val) => setFloor(val.replace(/[^0-9]/g, ''))}
                  placeholder="e.g. 1"
                  placeholderTextColor="#64748B"
                />

                <Text style={styles.label}>Locker Number Prefix (Optional)</Text>
                <TextInput
                  style={styles.input}
                  value={bulkPrefix}
                  onChangeText={setBulkPrefix}
                  placeholder="Leave blank for 1, 2, 3... or enter e.g. L-"
                  placeholderTextColor="#64748B"
                />

                <Text style={styles.label}>Starting Number (Optional)</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={bulkStartNumber}
                  onChangeText={(val) => setBulkStartNumber(val.replace(/[^0-9]/g, ''))}
                  placeholder="e.g. 1, 101, 201 (Leave blank to auto-continue)"
                  placeholderTextColor="#64748B"
                />

                <Text style={styles.label}>Number of Lockers to Create *</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={bulkCount}
                  onChangeText={(val) => setBulkCount(val.replace(/[^0-9]/g, ''))}
                  placeholder="e.g. 10"
                  placeholderTextColor="#64748B"
                />

                {(() => {
                  const allLockersList = data?.allLockers || data?.lockers || [];
                  const previewLockers = getPreviewItems(floor, bulkPrefix, bulkStartNumber, bulkCount, allLockersList);

                  if (!previewLockers || previewLockers.length === 0) return null;

                  return (
                    <View style={styles.previewBox}>
                      <Text style={styles.previewTitle}>✨ Live Preview ({previewLockers.length} lockers on Floor {floor}):</Text>
                      <Text style={styles.previewText} numberOfLines={2}>
                        {previewLockers.length > 10
                          ? `${previewLockers.slice(0, 10).join(', ')} ... ${previewLockers[previewLockers.length - 1]}`
                          : previewLockers.join(', ')}
                      </Text>
                    </View>
                  );
                })()}
              </ScrollView>

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setBulkModalVisible(false)}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.confirmBtn, submitting && styles.btnDisabled]} onPress={handleBulkCreate} disabled={submitting}>
                  {submitting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.confirmText}>Generate Lockers</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* Modal: Edit Locker Floor */}
        <Modal animationType="slide" transparent visible={editModalVisible} onRequestClose={() => setEditModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Edit Locker {selectedLocker?.lockerNumber}</Text>

              <Text style={styles.label}>Floor Number</Text>
              <TextInput style={styles.input} keyboardType="numeric" value={editFloor} onChangeText={setEditFloor} />

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditModalVisible(false)}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.confirmBtn, submitting && styles.btnDisabled]} onPress={handleUpdateLocker} disabled={submitting}>
                  {submitting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.confirmText}>Save Changes</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* MODAL: FILTER FROM TIME PICKER */}
        <Modal animationType="slide" transparent visible={showFilterFromModal} onRequestClose={() => setShowFilterFromModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, { maxHeight: '60%' }]}>
              <Text style={styles.modalTitle}>Select From Time Filter</Text>
              <ScrollView nestedScrollEnabled style={{ marginVertical: 10 }}>
                <TouchableOpacity
                  style={[styles.pickerFilterItem, filterFromTime === 'ALL' && styles.pickerFilterItemActive]}
                  onPress={() => {
                    setFilterFromTime('ALL');
                    setShowFilterFromModal(false);
                  }}
                >
                  <Text style={[styles.pickerFilterText, filterFromTime === 'ALL' && styles.pickerFilterTextActive]}>
                    🌐 All Hours (No Filter)
                  </Text>
                </TouchableOpacity>
                {HOURLY_TIME_SLOTS.slice(0, -1).map((slot) => (
                  <TouchableOpacity
                    key={slot.value}
                    style={[styles.pickerFilterItem, filterFromTime === slot.value && styles.pickerFilterItemActive]}
                    onPress={() => {
                      setFilterFromTime(slot.value);
                      if (filterToTime !== 'ALL') {
                        const fNum = slot.hourNum;
                        const tNum = parseTimeToHourNum(filterToTime);
                        if (tNum <= fNum) {
                          const validToSlots = getValidToTimeSlots(slot.value);
                          if (validToSlots.length > 0) {
                            setFilterToTime(validToSlots[validToSlots.length - 1].value);
                          }
                        }
                      }
                      setShowFilterFromModal(false);
                    }}
                  >
                    <Text style={[styles.pickerFilterText, filterFromTime === slot.value && styles.pickerFilterTextActive]}>
                      {slot.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowFilterFromModal(false)}>
                <Text style={styles.cancelText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* MODAL: FILTER TO TIME PICKER */}
        <Modal animationType="slide" transparent visible={showFilterToModal} onRequestClose={() => setShowFilterToModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, { maxHeight: '60%' }]}>
              <Text style={styles.modalTitle}>Select To Time Filter</Text>
              <ScrollView nestedScrollEnabled style={{ marginVertical: 10 }}>
                <TouchableOpacity
                  style={[styles.pickerFilterItem, filterToTime === 'ALL' && styles.pickerFilterItemActive]}
                  onPress={() => {
                    setFilterToTime('ALL');
                    setShowFilterToModal(false);
                  }}
                >
                  <Text style={[styles.pickerFilterText, filterToTime === 'ALL' && styles.pickerFilterTextActive]}>
                    🌐 All Hours (No Filter)
                  </Text>
                </TouchableOpacity>
                {(filterFromTime === 'ALL' ? HOURLY_TIME_SLOTS.slice(1) : getValidToTimeSlots(filterFromTime)).map((slot) => (
                  <TouchableOpacity
                    key={slot.value}
                    style={[styles.pickerFilterItem, filterToTime === slot.value && styles.pickerFilterItemActive]}
                    onPress={() => {
                      setFilterToTime(slot.value);
                      setShowFilterToModal(false);
                    }}
                  >
                    <Text style={[styles.pickerFilterText, filterToTime === slot.value && styles.pickerFilterTextActive]}>
                      {slot.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowFilterToModal(false)}>
                <Text style={styles.cancelText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 16 },
  loadingContainer: { flex: 1, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center' },
  headerRow: { marginBottom: 16 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#0F172A' },
  subTitle: { fontSize: 13, color: '#64748B', marginTop: 4 },
  addBtn: { backgroundColor: '#2563EB', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, alignSelf: 'flex-start', marginTop: 12 },
  addBtnText: { color: '#FFFFFF', fontWeight: '900', fontSize: 13 },
  pillsScroll: { marginBottom: 16, flexDirection: 'row' },
  pill: { backgroundColor: '#FFFFFF', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginRight: 8, borderWidth: 1, borderColor: '#CBD5E1' },
  activePill: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  pillText: { color: '#64748B', fontSize: 13, fontWeight: '700' },
  activePillText: { color: '#FFFFFF', fontWeight: '900' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: { width: '48%', backgroundColor: '#FFFFFF', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#64748B', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  available: { borderColor: '#10B981' },
  occupied: { borderColor: '#F59E0B' },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  numberText: { color: '#0F172A', fontSize: 16, fontWeight: '800' },
  floorBadge: { backgroundColor: '#FEF3C7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  floorText: { color: '#B45309', fontSize: 10, fontWeight: '800' },
  priceText: { color: '#16A34A', fontSize: 14, fontWeight: '800', marginBottom: 4 },
  occupantText: { color: '#D97706', fontSize: 11, fontWeight: '700' },
  shiftTag: { color: '#B45309', fontSize: 10, marginTop: 2 },
  availableText: { color: '#059669', fontSize: 11, fontWeight: '600' },
  emptyCard: { backgroundColor: '#FFFFFF', padding: 24, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  emptyText: { color: '#64748B' },
  inlineAddBtn: { marginTop: 12, backgroundColor: '#2563EB', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  inlineAddText: { color: '#FFFFFF', fontWeight: '800', fontSize: 12 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.5)', justifyContent: 'center', padding: 20 },
  actionMenuCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#E2E8F0' },
  actionMenuTitle: { color: '#0F172A', fontSize: 18, fontWeight: '800' },
  actionMenuSub: { color: '#64748B', fontSize: 12, marginTop: 2, marginBottom: 8 },
  occupantDetailText: { color: '#D97706', fontSize: 12, fontWeight: '700', marginBottom: 12, backgroundColor: '#FEF3C7', padding: 8, borderRadius: 6 },
  actionList: { gap: 10, marginTop: 8 },
  actionOptionBtnPrimary: { backgroundColor: '#2563EB', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  actionOptionTextPrimary: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  actionOptionBtnSecondary: { backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#CBD5E1', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  actionOptionTextSecondary: { color: '#334155', fontWeight: '700', fontSize: 13 },
  actionOptionBtnDanger: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#EF4444', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  actionOptionTextDanger: { color: '#EF4444', fontWeight: '800', fontSize: 13 },
  closeMenuBtn: { paddingVertical: 10, alignItems: 'center' },
  closeMenuText: { color: '#64748B', fontWeight: '700' },
  modalCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#E2E8F0', maxHeight: '85%' },
  modalTitle: { color: '#0F172A', fontSize: 18, fontWeight: '800' },
  modalSub: { color: '#64748B', fontSize: 12, marginTop: 4, marginBottom: 12 },
  label: { color: '#334155', fontSize: 12, fontWeight: '700', marginBottom: 4 },
  noStudentsText: { color: '#94A3B8', fontSize: 12, marginVertical: 8 },
  studentPickerList: { maxHeight: 160, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, padding: 6, marginBottom: 12, backgroundColor: '#F8FAFC' },
  studentPickerItem: { paddingVertical: 8, paddingHorizontal: 10, borderRadius: 6, marginBottom: 4, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0' },
  studentPickerItemActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  studentPickerName: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  studentPickerNameActive: { color: '#FFFFFF' },
  studentPickerPhone: { fontSize: 11, color: '#64748B', marginTop: 2 },
  studentPickerPhoneActive: { color: '#EFF6FF' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  chipItem: { backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#CBD5E1', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  chipItemActive: { backgroundColor: '#1E293B', borderColor: '#1E293B' },
  chipItemText: { fontSize: 11, fontWeight: '600', color: '#334155' },
  chipItemTextActive: { color: '#FFFFFF', fontWeight: '800' },
  input: { backgroundColor: '#F8FAFC', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, color: '#0F172A', fontSize: 14, borderWidth: 1, borderColor: '#CBD5E1', marginBottom: 12 },
  loadingText: { marginTop: 12, fontSize: 14, color: '#64748B', fontWeight: '600' },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorTitle: { fontSize: 18, fontWeight: '800', color: '#DC2626', marginBottom: 8 },
  errorText: { fontSize: 14, color: '#64748B', textAlign: 'center', marginBottom: 20 },
  retryBtn: { backgroundColor: '#2563EB', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10 },
  retryText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 12 },
  cancelBtn: { backgroundColor: '#E2E8F0', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  cancelText: { color: '#475569', fontWeight: '700' },
  confirmBtn: { backgroundColor: '#2563EB', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  confirmText: { color: '#FFFFFF', fontWeight: '900' },
  btnDisabled: { opacity: 0.6 },
  /* FILTER BAR STYLES */
  filterSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    marginBottom: 14,
  },
  filterSectionTitle: { fontSize: 14, fontWeight: '800', color: '#0F172A', marginBottom: 10 },
  filterInputLabel: { fontSize: 11, fontWeight: '700', color: '#475569', marginBottom: 4, textTransform: 'uppercase' },
  searchBoxRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  searchInput: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0F172A',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  clearSearchBtn: { backgroundColor: '#F1F5F9', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#CBD5E1' },
  clearSearchText: { fontSize: 12, fontWeight: '700', color: '#475569' },
  timeFilterRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  timeFilterBtn: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  timeFilterSubText: { fontSize: 9, fontWeight: '700', color: '#64748B', textTransform: 'uppercase' },
  timeFilterValText: { fontSize: 13, fontWeight: '800', color: '#1E293B', marginTop: 2 },
  resetTimeBtn: { backgroundColor: '#EFF6FF', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#BFDBFE' },
  resetTimeText: { fontSize: 11, fontWeight: '800', color: '#2563EB' },
  summaryStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  summaryItem: { alignItems: 'center' },
  summaryNum: { fontSize: 16, fontWeight: '900', color: '#0F172A' },
  summaryLabel: { fontSize: 10, fontWeight: '700', color: '#64748B', marginTop: 1 },
  summaryDivider: { width: 1, height: 24, backgroundColor: '#CBD5E1' },
  lockerHighlighted: { backgroundColor: '#FEF3C7', borderColor: '#D97706', borderWidth: 2 },
  highlightBadge: { backgroundColor: '#D97706', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, alignSelf: 'flex-start', marginVertical: 4 },
  highlightBadgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900' },
  pickerFilterItem: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 6, marginBottom: 4, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' },
  pickerFilterItemActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  pickerFilterText: { fontSize: 13, fontWeight: '700', color: '#334155' },
  pickerFilterTextActive: { color: '#FFFFFF', fontWeight: '900' },
  previewBox: {
    backgroundColor: '#EFF6FF',
    borderColor: '#93C5FD',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
    marginBottom: 4,
  },
  previewTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E40AF',
    marginBottom: 4,
  },
  previewText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1D4ED8',
  },
});
