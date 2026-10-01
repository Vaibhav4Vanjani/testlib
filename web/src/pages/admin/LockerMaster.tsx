import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { apiRequest } from '../../services/api.client';
import { DataTable, type Column } from '../../components/UI/DataTable';
import { Modal } from '../../components/UI/Modal';
import { useDebounce } from '../../hooks/useDebounce';
import { sortItemsNaturally } from '../../utils/sorting';
import {
  HOURLY_TIME_SLOTS,
  getTimeSlotLabel,
  parseTimeToHourNum,
  getValidToTimeSlots,
  validateMonths,
  calculateSlotDurationHours,
  calculateSlotPricing,
  type ITimeSlot,
} from '../../utils/timeSlots';
import {
  Trash2,
  Grid,
  Search,
  RotateCcw,
  UserCheck,
  UserX,
  Layers,
  LayoutGrid,
  List,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

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

export const AdminLockerMaster: React.FC = () => {
  const [lockers, setLockers] = useState<any[]>([]);
  const [dataMeta, setDataMeta] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [activeStudents, setActiveStudents] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Filter States
  const [selectedFloorFilter, setSelectedFloorFilter] = useState<number>(1);
  const [filterSearchStudent, setFilterSearchStudent] = useState<string>('');
  const debouncedSearchStudent = useDebounce(filterSearchStudent, 350);
  const [filterFromTime, setFilterFromTime] = useState<string>('ALL');
  const [filterToTime, setFilterToTime] = useState<string>('ALL');

  // Bulk Delete Selection
  const [isSelectMode, setIsSelectMode] = useState<boolean>(false);
  const [selectedLockerIds, setSelectedLockerIds] = useState<string[]>([]);
  const [deletingBulk, setDeletingBulk] = useState<boolean>(false);

  // Modals State
  const [bulkModalOpen, setBulkModalOpen] = useState<boolean>(false);
  const [actionMenuOpen, setActionMenuOpen] = useState<boolean>(false);
  const [assignModalOpen, setAssignModalOpen] = useState<boolean>(false);
  const [editModalOpen, setEditModalOpen] = useState<boolean>(false);
  const [selectedLocker, setSelectedLocker] = useState<any>(null);

  // Form States - Pricing Configuration
  const [paymentMasterData, setPaymentMasterData] = useState<any>(null);

  // Form States - Bulk Create
  const [bulkPrefix, setBulkPrefix] = useState('L-');
  const [bulkStartNum, setBulkStartNum] = useState('1');
  const [bulkCount, setBulkCount] = useState('20');
  const [bulkFloor, setBulkFloor] = useState('1');

  // Form States - Assign Student
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [assignStudentSearch, setAssignStudentSearch] = useState('');
  const [fromTime, setFromTime] = useState<string>('06:00');
  const [toTime, setToTime] = useState<string>('23:00');
  const [durationMonthsInput, setDurationMonthsInput] = useState<string>('1');

  const filteredAssignStudents = useMemo(() => {
    if (!assignStudentSearch.trim()) return activeStudents.slice(0, 10);
    const q = assignStudentSearch.trim().toLowerCase();
    return activeStudents.filter((st: any) => {
      const name = (st.fullName || st.userId?.fullName || '').toLowerCase();
      const phone = (st.phone || st.userId?.phone || '').toLowerCase();
      const cardNo = (st.studentIdCardNo || '').toLowerCase();
      return name.includes(q) || phone.includes(q) || cardNo.includes(q);
    });
  }, [activeStudents, assignStudentSearch]);

  // Form States - Edit Single
  const [editPrice, setEditPrice] = useState('');
  const [editFloor, setEditFloor] = useState('1');
  const [submitting, setSubmitting] = useState(false);

  // Fetch Locker Master Data
  const fetchLockers = useCallback(async () => {
    setLoading(true);
    try {
      const params: string[] = [];
      if (selectedFloorFilter) params.push(`floor=${selectedFloorFilter}`);
      const qStr = params.length > 0 ? `?${params.join('&')}` : '';
      const res = await apiRequest(`/admin/locker-master${qStr}`);
      if (res.success) {
        setLockers(res.data?.lockers || []);
        setDataMeta(res.data || {});
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [selectedFloorFilter]);

  // Fetch Active Students for Assignment
  const fetchActiveStudents = useCallback(async () => {
    try {
      const res = await apiRequest('/admin/students?status=ACTIVE');
      if (res.success) {
        setActiveStudents(res.data?.students || []);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  // Fetch Payment Master for Pricing Configuration
  const fetchPaymentMaster = useCallback(async () => {
    try {
      const res = await apiRequest('/admin/payment-master');
      if (res.success && res.data) {
        setPaymentMasterData(res.data);
      }
    } catch (e) {
      console.error('Failed to fetch payment master in LockerMaster:', e);
    }
  }, []);

  const currentFilterHours = useMemo(() => {
    if (filterFromTime !== 'ALL' && filterToTime !== 'ALL') {
      return calculateSlotDurationHours(filterFromTime, filterToTime);
    }
    return 12;
  }, [filterFromTime, filterToTime]);

  const activeLockerPrice = useMemo(() => {
    if (!paymentMasterData) return 200;
    const { lockerCharge } = calculateSlotPricing(paymentMasterData, currentFilterHours, 1, false, true);
    return lockerCharge || paymentMasterData.lockerMonthlyFee || 200;
  }, [paymentMasterData, currentFilterHours]);

  useEffect(() => {
    fetchLockers();
    fetchPaymentMaster();
  }, [fetchLockers, fetchPaymentMaster]);

  useEffect(() => {
    fetchActiveStudents();
  }, [fetchActiveStudents]);

  // Derive Floor Numbers
  const floorsMap: Record<number, any[]> = dataMeta?.floorsMap || {};
  const apiFloorNumbers: number[] = dataMeta?.floorNumbers || [];
  const rawFloorNumbers = Object.keys(floorsMap)
    .map((f) => parseInt(f, 10))
    .filter((n) => !isNaN(n));
  const combinedFloors = Array.from(
    new Set([...apiFloorNumbers, ...rawFloorNumbers])
  ).sort((a, b) => a - b);
  const floorNumbers = combinedFloors.length > 0 ? combinedFloors : [1];

  // Helper checks identical to mobile
  const isLockerOccupiedInTimeSlot = (locker: any, fTime: string, tTime: string) => {
    const rawAssigned =
      locker.assignedReservations && locker.assignedReservations.length > 0
        ? locker.assignedReservations
        : locker.currentReservation?.studentId
          ? [locker.currentReservation]
          : [];
    const activeList = rawAssigned.filter(
      (r: any) => !r.endAt || new Date(r.endAt) > new Date()
    );

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
    const rawAssigned =
      locker.assignedReservations && locker.assignedReservations.length > 0
        ? locker.assignedReservations
        : locker.currentReservation?.studentId
          ? [locker.currentReservation]
          : [];
    const activeList = rawAssigned.filter(
      (r: any) => !r.endAt || new Date(r.endAt) > new Date()
    );

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
    const rawAssigned =
      locker.assignedReservations && locker.assignedReservations.length > 0
        ? locker.assignedReservations
        : locker.currentReservation?.studentId
          ? [locker.currentReservation]
          : [];
    const activeList = rawAssigned.filter(
      (r: any) => !r.endAt || new Date(r.endAt) > new Date()
    );
    return locker.status === 'OCCUPIED' || locker.status === 'RESERVED' || activeList.length > 0;
  };

  // Filtered Lockers
  const filteredLockers = sortItemsNaturally(
    lockers.filter((l: any) => {
      if (l.floor !== selectedFloorFilter) return false;
      if (debouncedSearchStudent.trim()) {
        if (!isLockerAssignedToStudent(l, debouncedSearchStudent)) return false;
      }
      return true;
    }),
    (l: any) => l.lockerNumber
  );

  // Dynamic Counts based on selected time range and active floor/search filters
  const totalLockersCount = filteredLockers.length;
  const occupiedLockersCount = filteredLockers.filter(isLockerOccupiedInTimeSlotOrOverall).length;
  const availableLockersCount = totalLockersCount - occupiedLockersCount;

  // Handlers
  const handleBulkCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const flNum = parseInt(bulkFloor.trim(), 10);
    const cNum = parseInt(bulkCount.trim(), 10);
    const sNum = bulkStartNum.trim() ? parseInt(bulkStartNum.trim(), 10) : undefined;

    if (!bulkFloor.trim() || isNaN(flNum) || flNum < 1 || bulkFloor.includes('.')) {
      alert('Floor Number must be a valid positive whole number (e.g. 1, 2, 3).');
      return;
    }
    if (flNum > 10) {
      alert('Floor Number cannot exceed 10 (maximum 10 floors per library).');
      return;
    }
    if (!bulkCount.trim() || isNaN(cNum) || cNum < 1 || bulkCount.includes('.')) {
      alert('Number of Lockers to Create must be a valid positive whole number (e.g. 10, 20).');
      return;
    }
    if (cNum > 100) {
      alert('Number of Lockers to Create cannot exceed 100 per floor per request.');
      return;
    }
    if (sNum !== undefined && (isNaN(sNum) || sNum < 1 || bulkStartNum.includes('.'))) {
      alert('Starting Number must be a valid positive whole number (e.g. 1, 10, 20).');
      return;
    }
    if (sNum !== undefined && sNum > cNum) {
      alert(`Starting Number (${sNum}) cannot exceed the number of lockers being created (${cNum}).`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiRequest('/admin/locker-master', 'POST', {
        action: 'BULK_CREATE',
        floor: flNum,
        bulkPrefix: bulkPrefix.trim(),
        bulkStartNumber: bulkStartNum.trim(),
        bulkCount: cNum,
      });

      if (res.success) {
        alert(res.data?.message || `Successfully created ${cNum} lockers for Floor ${flNum}!`);
        setBulkModalOpen(false);
        setBulkStartNum('');
        fetchLockers();
      } else {
        alert(res.error?.message || 'Failed to generate lockers');
      }
    } catch (err: any) {
      alert(err.message || 'Error creating bulk lockers');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAssignStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLocker || !selectedStudentId) {
      alert('Please select an active student');
      return;
    }

    const { isValid, parsed: validMonths, errorMsg } = validateMonths(durationMonthsInput);
    if (!isValid) {
      alert(errorMsg || 'Invalid duration');
      return;
    }

    const fNum = parseTimeToHourNum(fromTime);
    const tNum = parseTimeToHourNum(toTime);
    if (tNum <= fNum) {
      alert('To Time must be after From Time.');
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
        alert(res.data?.message || 'Student assigned to locker successfully!');
        setAssignModalOpen(false);
        setActionMenuOpen(false);
        fetchLockers();
      } else {
        alert(res.error?.message || 'Assignment failed');
      }
    } catch (err: any) {
      alert(err.message || 'Error assigning locker');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnassignLocker = async (studentProfileId?: string) => {
    if (!selectedLocker) return;
    if (!confirm(`Release reservation for Locker ${selectedLocker.lockerNumber}?`)) return;

    setSubmitting(true);
    try {
      const res = await apiRequest('/admin/locker-master', 'POST', {
        action: 'UNASSIGN_STUDENT',
        lockerId: selectedLocker._id,
        studentProfileId,
      });

      if (res.success) {
        alert('Locker reservation released!');
        setActionMenuOpen(false);
        fetchLockers();
      } else {
        alert(res.error?.message || 'Failed to release locker');
      }
    } catch (err: any) {
      alert(err.message || 'Error releasing locker');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateLocker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLocker) return;
    setSubmitting(true);
    try {
      const res = await apiRequest('/admin/locker-master', 'POST', {
        action: 'UPDATE',
        lockerId: selectedLocker._id,
        floor: parseInt(editFloor, 10),
        priceMonthly: parseFloat(editPrice) || activeLockerPrice,
      });
      if (res.success) {
        alert('Locker updated!');
        setEditModalOpen(false);
        setActionMenuOpen(false);
        fetchLockers();
      } else {
        alert(res.error?.message || 'Failed to update locker');
      }
    } catch (err: any) {
      alert(err.message || 'Error updating locker');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteLocker = async (lockerId: string) => {
    if (!confirm('Are you sure you want to delete this locker?')) return;
    try {
      const res = await apiRequest('/admin/locker-master', 'POST', {
        action: 'DELETE',
        lockerId,
      });
      if (res.success) {
        alert('Locker deleted successfully');
        setActionMenuOpen(false);
        fetchLockers();
      } else {
        alert(res.error?.message || 'Failed to delete locker');
      }
    } catch (err: any) {
      alert(err.message || 'Error deleting locker');
    }
  };

  const handleBulkDeleteLockers = async () => {
    if (selectedLockerIds.length === 0) return;
    if (!confirm(`Delete ${selectedLockerIds.length} selected locker(s)? This action cannot be undone.`)) return;

    setDeletingBulk(true);
    try {
      const res = await apiRequest('/admin/locker-master', 'POST', {
        action: 'BULK_DELETE',
        lockerIds: selectedLockerIds,
      });
      if (res.success) {
        alert(`${selectedLockerIds.length} lockers deleted.`);
        setSelectedLockerIds([]);
        setIsSelectMode(false);
        fetchLockers();
      } else {
        alert(res.error?.message || 'Bulk delete failed');
      }
    } catch (err: any) {
      alert(err.message || 'Error performing bulk delete');
    } finally {
      setDeletingBulk(false);
    }
  };

  const handleToggleSelectLocker = (lockerId: string) => {
    setSelectedLockerIds((prev) =>
      prev.includes(lockerId) ? prev.filter((id) => id !== lockerId) : [...prev, lockerId]
    );
  };

  const handleToggleSelectAll = () => {
    const currentFloorIds = filteredLockers.map((l) => l._id);
    const allSelected = currentFloorIds.every((id) => selectedLockerIds.includes(id));
    if (allSelected) {
      setSelectedLockerIds((prev) => prev.filter((id) => !currentFloorIds.includes(id)));
    } else {
      setSelectedLockerIds((prev) => Array.from(new Set([...prev, ...currentFloorIds])));
    }
  };

  // Table View Columns
  const columns: Column<any>[] = [
    {
      header: 'Locker Number',
      accessor: (row) => (
        <span style={{ fontWeight: 800, color: '#0F172A', fontSize: '15px' }}>
          🔒 {row.lockerNumber}
        </span>
      ),
    },
    {
      header: 'Floor',
      accessor: (row) => <span className="badge badge-secondary">Floor {row.floor || 1}</span>,
    },
    {
      header: 'Assigned Student',
      accessor: (row) => {
        const rawAssigned =
          row.assignedReservations && row.assignedReservations.length > 0
            ? row.assignedReservations
            : row.currentReservation?.studentId
              ? [row.currentReservation]
              : [];
        const activeList = rawAssigned.filter(
          (r: any) => !r.endAt || new Date(r.endAt) > new Date()
        );
        if (activeList.length === 0) return <span style={{ color: '#94A3B8' }}>Unassigned</span>;
        return (
          <div style={{ fontSize: '13px' }}>
            {activeList.map((r: any, idx: number) => (
              <div key={idx} style={{ fontWeight: 700, color: '#1E40AF' }}>
                👤 {r.studentId?.userId?.fullName || 'Active Student'}
              </div>
            ))}
          </div>
        );
      },
    },
    {
      header: 'Monthly Fee',
      accessor: () => (
        <span style={{ fontWeight: 700, color: '#0F172A' }}>₹{activeLockerPrice}/mo</span>
      ),
    },
    {
      header: 'Status',
      accessor: (row) => (
        <span
          className={`badge ${row.status === 'AVAILABLE'
            ? 'badge-success'
            : row.status === 'OCCUPIED'
              ? 'badge-danger'
              : 'badge-warning'
            }`}
        >
          {row.status}
        </span>
      ),
    },
    {
      header: 'Actions',
      accessor: (row) => (
        <button
          className="btn btn-secondary"
          style={{ padding: '6px 12px', fontSize: '12px' }}
          onClick={() => {
            setSelectedLocker(row);
            setActionMenuOpen(true);
          }}
        >
          Manage
        </button>
      ),
    },
  ];

  if (paymentMasterData?.featureFlags?.enableLockers === false) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '48px 24px', margin: '32px auto', maxWidth: '600px' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
        <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#0F172A', marginBottom: '8px' }}>
          Locker Feature Disabled
        </h2>
        <p style={{ fontSize: '14px', color: '#64748B' }}>
          Storage locker configuration and hourly rates are currently disabled for this library by Super Admin.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A' }}>
            Locker Master Configurator
          </h1>
          <p style={{ fontSize: '14px', color: '#64748B' }}>
            Manage storage lockers, floors, live occupancy & assign active students
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            className="btn btn-primary"
            onClick={() => {
              setBulkFloor(String(selectedFloorFilter));
              setBulkModalOpen(true);
            }}
          >
            <Grid size={16} /> Bulk Generate Lockers
          </button>
        </div>
      </div>

      {/* Summary Counts Strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
        }}
      >
        <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '10px',
              backgroundColor: '#EFF6FF',
              color: '#2563EB',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Layers size={22} />
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
              Total Lockers
            </div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A' }}>{totalLockersCount}</div>
          </div>
        </div>

        <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '10px',
              backgroundColor: '#F0FDF4',
              color: '#166534',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CheckCircle2 size={22} />
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
              Available Lockers
            </div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#166534' }}>{availableLockersCount}</div>
          </div>
        </div>

        <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '10px',
              backgroundColor: '#FFFBEB',
              color: '#D97706',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <AlertTriangle size={22} />
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
              Occupied Lockers
            </div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#D97706' }}>{occupiedLockersCount}</div>
          </div>
        </div>
      </div>

      {/* Filter Controls Bar */}
      <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Search size={18} color="#2563EB" /> Search & Time Range Filters
          </h3>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              className={`btn ${viewMode === 'grid' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '6px 12px', fontSize: '13px' }}
              onClick={() => setViewMode('grid')}
            >
              <LayoutGrid size={15} /> Grid View
            </button>
            <button
              className={`btn ${viewMode === 'table' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '6px 12px', fontSize: '13px' }}
              onClick={() => setViewMode('table')}
            >
              <List size={15} /> Table View
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
          {/* Student Search */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ fontSize: '13px', fontWeight: 600 }}>
              Student Search (Name or Phone)
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                className="form-input"
                placeholder="Search assigned student..."
                value={filterSearchStudent}
                onChange={(e) => setFilterSearchStudent(e.target.value)}
                style={{ paddingRight: filterSearchStudent ? '60px' : '12px' }}
              />
              {filterSearchStudent && (
                <button
                  type="button"
                  onClick={() => setFilterSearchStudent('')}
                  style={{
                    position: 'absolute',
                    right: '8px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: '#64748B',
                    fontSize: '12px',
                    cursor: 'pointer',
                    fontWeight: 700,
                  }}
                >
                  ✕ Clear
                </button>
              )}
            </div>
          </div>

          {/* From Time */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ fontSize: '13px', fontWeight: 600 }}>
              Daily From Time (Hour-Only)
            </label>
            <select
              className="form-select"
              value={filterFromTime}
              onChange={(e) => {
                const newFrom = e.target.value;
                setFilterFromTime(newFrom);
                if (newFrom !== 'ALL' && filterToTime !== 'ALL') {
                  const fNum = parseTimeToHourNum(newFrom);
                  const tNum = parseTimeToHourNum(filterToTime);
                  if (tNum <= fNum) {
                    const validToSlots = getValidToTimeSlots(newFrom);
                    if (validToSlots.length > 0) {
                      setFilterToTime(validToSlots[validToSlots.length - 1].value);
                    } else {
                      setFilterToTime('ALL');
                    }
                  }
                }
              }}
            >
              <option value="ALL">All Hours (From)</option>
              {HOURLY_TIME_SLOTS.slice(0, -1).map((slot) => (
                <option key={slot.value} value={slot.value}>
                  {slot.label}
                </option>
              ))}
            </select>
          </div>

          {/* To Time */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ fontSize: '13px', fontWeight: 600 }}>
              Daily To Time (Hour-Only)
            </label>
            <select
              className="form-select"
              value={filterToTime}
              onChange={(e) => setFilterToTime(e.target.value)}
            >
              <option value="ALL">All Hours (To)</option>
              {(filterFromTime === 'ALL' ? HOURLY_TIME_SLOTS.slice(1) : getValidToTimeSlots(filterFromTime)).map((slot: ITimeSlot) => (
                <option key={slot.value} value={slot.value}>
                  {slot.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {(filterFromTime !== 'ALL' || filterToTime !== 'ALL' || filterSearchStudent) && (
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              className="btn btn-secondary"
              style={{ padding: '6px 12px', fontSize: '12px', color: '#DC2626' }}
              onClick={() => {
                setFilterFromTime('ALL');
                setFilterToTime('ALL');
                setFilterSearchStudent('');
              }}
            >
              <RotateCcw size={14} /> Reset All Filters
            </button>
          </div>
        )}
      </div>

      {/* Floor Filter Tabs */}
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
        {floorNumbers.map((flNum) => {
          const flSummary = dataMeta?.floorsSummary?.[flNum];
          const flCount = flSummary ? flSummary.total : floorsMap[flNum]?.length || 0;
          const isActive = selectedFloorFilter === flNum;

          return (
            <button
              key={flNum}
              onClick={() => {
                setSelectedFloorFilter(flNum);
                setSelectedLockerIds([]);
              }}
              style={{
                padding: '10px 18px',
                borderRadius: '10px',
                fontSize: '14px',
                fontWeight: 700,
                border: '1px solid',
                borderColor: isActive ? '#2563EB' : '#E2E8F0',
                backgroundColor: isActive ? '#2563EB' : '#FFFFFF',
                color: isActive ? '#FFFFFF' : '#475569',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.15s ease',
              }}
            >
              Floor {flNum}
              <span
                style={{
                  backgroundColor: isActive ? 'rgba(255, 255, 255, 0.25)' : '#F1F5F9',
                  color: isActive ? '#FFFFFF' : '#64748B',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontSize: '12px',
                }}
              >
                {flCount}
              </span>
            </button>
          );
        })}
      </div>

      {/* Bulk Select Control Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#F8FAFC',
          padding: '12px 16px',
          borderRadius: '10px',
          border: '1px solid #E2E8F0',
        }}
      >
        <button
          className={`btn ${isSelectMode ? 'btn-secondary' : 'btn-secondary'}`}
          style={{
            fontSize: '13px',
            color: isSelectMode ? '#DC2626' : '#2563EB',
            borderColor: isSelectMode ? '#FECACA' : '#BFDBFE',
            backgroundColor: isSelectMode ? '#FEF2F2' : '#EFF6FF',
          }}
          onClick={() => {
            setIsSelectMode(!isSelectMode);
            setSelectedLockerIds([]);
          }}
        >
          {isSelectMode ? '✕ Cancel Bulk Selection' : '☑️ Select Lockers to Bulk Delete'}
        </button>

        {isSelectMode && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button className="btn btn-secondary" style={{ fontSize: '13px' }} onClick={handleToggleSelectAll}>
              {filteredLockers.length > 0 && filteredLockers.every((l) => selectedLockerIds.includes(l._id))
                ? 'Deselect All'
                : 'Select All on Floor'}
            </button>

            {selectedLockerIds.length > 0 && (
              <button
                className="btn btn-danger"
                style={{ fontSize: '13px', backgroundColor: '#DC2626' }}
                onClick={handleBulkDeleteLockers}
                disabled={deletingBulk}
              >
                <Trash2 size={14} /> Delete Selected ({selectedLockerIds.length})
              </button>
            )}
          </div>
        )}
      </div>

      {/* Content Rendering: Grid vs Table */}
      {viewMode === 'table' ? (
        <div className="card">
          <DataTable
            columns={columns}
            data={filteredLockers}
            loading={loading}
            onRefresh={fetchLockers}
            searchPlaceholder="Search locker in table..."
          />
        </div>
      ) : loading ? (
        <div className="card" style={{ padding: '40px', textAlign: 'center', color: '#64748B' }}>
          Loading locker master layout...
        </div>
      ) : filteredLockers.length === 0 ? (
        <div
          className="card"
          style={{ padding: '40px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}
        >
          <AlertCircle size={36} color="#94A3B8" />
          <div style={{ fontSize: '15px', fontWeight: 600, color: '#475569' }}>
            No lockers match the selected floor, time range, or search query.
          </div>
          <button
            className="btn btn-primary"
            style={{ marginTop: '8px' }}
            onClick={() => {
              setBulkFloor(String(selectedFloorFilter));
              setBulkModalOpen(true);
            }}
          >
            Generate Lockers for Floor {selectedFloorFilter}
          </button>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
            gap: '14px',
          }}
        >
          {filteredLockers.map((locker: any) => {
            const isOccupied = isLockerOccupiedInTimeSlotOrOverall(locker);
            const isSearchedMatch =
              debouncedSearchStudent.trim() && isLockerAssignedToStudent(locker, debouncedSearchStudent);
            const isChecked = selectedLockerIds.includes(locker._id);

            const rawAssigned =
              locker.assignedReservations && locker.assignedReservations.length > 0
                ? locker.assignedReservations
                : locker.currentReservation?.studentId
                  ? [locker.currentReservation]
                  : [];
            const activeList = rawAssigned.filter(
              (r: any) => !r.endAt || new Date(r.endAt) > new Date()
            );
            const firstStudentName = activeList[0]?.studentId?.userId?.fullName;

            return (
              <div
                key={locker._id}
                onClick={() => {
                  if (isSelectMode) {
                    handleToggleSelectLocker(locker._id);
                  } else {
                    setSelectedLocker(locker);
                    setActionMenuOpen(true);
                  }
                }}
                style={{
                  backgroundColor: isChecked
                    ? '#FEF2F2'
                    : isSearchedMatch
                      ? '#EFF6FF'
                      : isOccupied
                        ? '#FFFBEB'
                        : '#FFFFFF',
                  border: '2px solid',
                  borderColor: isChecked
                    ? '#DC2626'
                    : isSearchedMatch
                      ? '#2563EB'
                      : isOccupied
                        ? '#F59E0B'
                        : '#22C55E',
                  borderRadius: '12px',
                  padding: '14px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A' }}>
                    {isSelectMode && (isChecked ? '☑️ ' : '☐ ')}
                    🔒 {locker.lockerNumber}
                  </div>
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      backgroundColor: '#F1F5F9',
                      color: '#475569',
                      padding: '2px 6px',
                      borderRadius: '4px',
                    }}
                  >
                    Fl {locker.floor}
                  </span>
                </div>

                {isSearchedMatch && (
                  <div
                    style={{
                      fontSize: '10px',
                      fontWeight: 800,
                      color: '#2563EB',
                      backgroundColor: '#DBEAFE',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      textAlign: 'center',
                    }}
                  >
                    ⭐ MATCHING SEARCH
                  </div>
                )}

                {isOccupied ? (
                  <div style={{ marginTop: '2px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#B45309' }}>
                      👤 {firstStudentName || 'Occupied'}
                    </div>
                    {activeList.length > 1 && (
                      <div style={{ fontSize: '10px', color: '#D97706' }}>
                        +{activeList.length - 1} more student
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#15803D' }}>
                    🟢 Available
                  </div>
                )}

                <div style={{ fontSize: '11px', color: '#64748B', borderTop: '1px solid #F1F5F9', paddingTop: '6px' }}>
                  ₹{activeLockerPrice}/mo
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* LOCKER ACTION & DETAILS MODAL */}
      <Modal isOpen={actionMenuOpen} onClose={() => setActionMenuOpen(false)} title={`Locker ${selectedLocker?.lockerNumber} Options`}>
        {selectedLocker && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ backgroundColor: '#F8FAFC', padding: '12px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
              <div style={{ fontSize: '14px', fontWeight: 800, color: '#0F172A' }}>
                Locker Number: {selectedLocker.lockerNumber}
              </div>
              <div style={{ fontSize: '13px', color: '#64748B', marginTop: '4px' }}>
                Floor {selectedLocker.floor} • Monthly Price: ₹{activeLockerPrice}/mo
              </div>
            </div>

            {/* Active Student Reservations */}
            {(() => {
              const rawAssigned =
                selectedLocker?.assignedReservations && selectedLocker.assignedReservations.length > 0
                  ? selectedLocker.assignedReservations
                  : selectedLocker?.currentReservation?.studentId
                    ? [selectedLocker.currentReservation]
                    : [];
              const activeList = rawAssigned.filter(
                (r: any) => !r.endAt || new Date(r.endAt) > new Date()
              );

              if (activeList.length === 0) {
                return (
                  <div style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', padding: '12px', borderRadius: '8px', color: '#166534', fontWeight: 700, fontSize: '13px' }}>
                    🟢 Locker is currently Available for Student Assignment
                  </div>
                );
              }

              return (
                <div>
                  <h4 style={{ fontSize: '14px', fontWeight: 800, color: '#0F172A', marginBottom: '8px' }}>
                    Assigned Active Student(s):
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
                    {activeList.map((res: any, idx: number) => {
                      const stName = res.studentId?.userId?.fullName || 'Active Student';
                      const stPhone = res.studentId?.userId?.phone || '';
                      const stFrom = res.fromTime ? getTimeSlotLabel(res.fromTime) : '06:00 AM';
                      const stTo = res.toTime ? getTimeSlotLabel(res.toTime) : '11:00 PM';
                      const stId = res.studentId?._id || res.studentId;

                      return (
                        <div
                          key={idx}
                          style={{
                            backgroundColor: '#EFF6FF',
                            border: '1px solid #BFDBFE',
                            borderRadius: '8px',
                            padding: '10px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: 800, color: '#1E40AF' }}>
                              👤 {stName}
                            </div>
                            <div style={{ fontSize: '12px', color: '#1E3A8A', marginTop: '2px' }}>
                              ⏱️ Slot: {stFrom} → {stTo}
                            </div>
                            {stPhone && (
                              <div style={{ fontSize: '11px', color: '#3B82F6', marginTop: '2px' }}>
                                📞 {stPhone}
                              </div>
                            )}
                          </div>
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '4px 8px', fontSize: '11px', color: '#DC2626', borderColor: '#FECACA' }}
                            onClick={() => handleUnassignLocker(stId)}
                          >
                            <UserX size={12} /> Release
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Modal Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
              <button
                className="btn btn-primary"
                style={{ justifyContent: 'center' }}
                onClick={() => {
                  setSelectedStudentId('');
                  setAssignStudentSearch('');
                  setAssignModalOpen(true);
                }}
              >
                <UserCheck size={16} /> Assign Active Student
              </button>

              <button
                className="btn btn-danger"
                style={{ width: '100%', justifyContent: 'center', backgroundColor: '#DC2626' }}
                onClick={() => handleDeleteLocker(selectedLocker._id)}
              >
                <Trash2 size={15} /> Delete Locker
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ASSIGN STUDENT MODAL */}
      <Modal isOpen={assignModalOpen} onClose={() => setAssignModalOpen(false)} title={`Assign Student to Locker ${selectedLocker?.lockerNumber}`}>
        <form onSubmit={handleAssignStudent}>
          <div className="form-group">
            <label className="form-label">Search & Select Active Student *</label>
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748B' }} />
              <input
                type="text"
                className="form-input"
                style={{ paddingLeft: '36px' }}
                placeholder="Search by student name or phone number..."
                value={assignStudentSearch}
                onChange={(e) => setAssignStudentSearch(e.target.value)}
              />
            </div>

            {/* SEARCH RESULTS PICKER */}
            {filteredAssignStudents.length > 0 ? (
              <div
                style={{
                  maxHeight: '180px',
                  overflowY: 'auto',
                  border: '1px solid #CBD5E1',
                  borderRadius: '8px',
                  marginTop: '6px',
                  backgroundColor: '#FFFFFF',
                }}
              >
                {filteredAssignStudents.slice(0, 30).map((st: any) => {
                  const isSelected = selectedStudentId === st._id;
                  const name = st.fullName || st.userId?.fullName || 'Student';
                  const phone = st.phone || st.userId?.phone || 'No Phone';
                  const photo = st.profilePictureUrl || st.profileImage || st.userId?.profilePicture;
                  const fullPhoto = photo ? (photo.startsWith('http') ? photo : `http://localhost:5000${photo}`) : null;

                  return (
                    <div
                      key={st._id}
                      style={{
                        padding: '8px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        backgroundColor: isSelected ? '#EFF6FF' : '#FFFFFF',
                        borderBottom: '1px solid #F1F5F9',
                      }}
                      onClick={() => {
                        setSelectedStudentId(st._id);
                        setAssignStudentSearch(`${name} (${phone})`);
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {fullPhoto ? (
                          <img
                            src={fullPhoto}
                            alt={name}
                            style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', border: '1px solid #CBD5E1' }}
                          />
                        ) : (
                          <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#EEF2FF', color: '#4F46E5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '13px' }}>
                            {name.charAt(0)}
                          </div>
                        )}
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>{name}</div>
                          <div style={{ fontSize: '11px', color: '#64748B' }}>📞 {phone}</div>
                        </div>
                      </div>

                      {isSelected && (
                        <span style={{ fontSize: '12px', fontWeight: 800, color: '#2563EB', backgroundColor: '#DBEAFE', padding: '2px 8px', borderRadius: '12px' }}>
                          Selected ✓
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : assignStudentSearch.trim() ? (
              <></>
            ) : (
              <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px', fontStyle: 'italic' }}>
                Type student name or phone number above to select a student.
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">From Time</label>
              <select
                className="form-select"
                value={fromTime}
                onChange={(e) => {
                  const newFrom = e.target.value;
                  setFromTime(newFrom);
                  const fNum = parseTimeToHourNum(newFrom);
                  const tNum = parseTimeToHourNum(toTime);
                  if (tNum <= fNum) {
                    const validToSlots = getValidToTimeSlots(newFrom);
                    if (validToSlots.length > 0) {
                      setToTime(validToSlots[0].value);
                    }
                  }
                }}
              >
                {HOURLY_TIME_SLOTS.slice(0, -1).map((slot) => (
                  <option key={slot.value} value={slot.value}>
                    {slot.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">To Time</label>
              <select className="form-select" value={toTime} onChange={(e) => setToTime(e.target.value)}>
                {getValidToTimeSlots(fromTime).map((slot: ITimeSlot) => (
                  <option key={slot.value} value={slot.value}>
                    {slot.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Duration (Months)</label>
            <input
              type="number"
              className="form-input"
              min={1}
              max={50}
              value={durationMonthsInput}
              onChange={(e) => setDurationMonthsInput(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setAssignModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Assigning...' : 'Confirm Assignment'}
            </button>
          </div>
        </form>
      </Modal>

      {/* EDIT LOCKER MODAL */}
      <Modal isOpen={editModalOpen} onClose={() => setEditModalOpen(false)} title={`Edit Locker ${selectedLocker?.lockerNumber}`}>
        <form onSubmit={handleUpdateLocker}>
          <div className="form-group">
            <label className="form-label">Floor Number</label>
            <input
              type="number"
              className="form-input"
              min={1}
              max={10}
              value={editFloor}
              onChange={(e) => setEditFloor(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Monthly Price (₹)</label>
            <input
              type="number"
              className="form-input"
              value={editPrice}
              onChange={(e) => setEditPrice(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setEditModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Updating...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* BULK LOCKER CREATE MODAL */}
      <Modal isOpen={bulkModalOpen} onClose={() => setBulkModalOpen(false)} title="Bulk Generate Lockers">
        <form onSubmit={handleBulkCreate}>
          <div className="form-group">
            <label className="form-label">Floor Number * (Max 10)</label>
            <input
              type="number"
              className="form-input"
              min={1}
              max={10}
              value={bulkFloor}
              onChange={(e) => setBulkFloor(e.target.value)}
              placeholder="e.g. 1"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Locker Number Prefix (Optional)</label>
            <input
              type="text"
              className="form-input"
              value={bulkPrefix}
              onChange={(e) => setBulkPrefix(e.target.value)}
              placeholder="Leave blank for 1, 2, 3... or enter e.g. L- or B-"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">Starting Number (Optional)</label>
              <input
                type="number"
                className="form-input"
                min={1}
                value={bulkStartNum}
                onChange={(e) => setBulkStartNum(e.target.value)}
                placeholder="e.g. 1 (Leave blank to auto-continue)"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Number of Lockers * (Max 100)</label>
              <input
                type="number"
                className="form-input"
                min={1}
                max={100}
                value={bulkCount}
                onChange={(e) => setBulkCount(e.target.value)}
                placeholder="e.g. 20"
                required
              />
            </div>
          </div>

          {(() => {
            const allLockersList = dataMeta?.allLockers || lockers || [];
            const previewLockers = getPreviewItems(bulkFloor, bulkPrefix, bulkStartNum, bulkCount, allLockersList);

            if (!previewLockers || previewLockers.length === 0) return null;

            return (
              <div
                style={{
                  backgroundColor: '#EFF6FF',
                  border: '1px solid #BFDBFE',
                  borderRadius: '8px',
                  padding: '12px',
                  marginBottom: '16px',
                }}
              >
                <div style={{ fontSize: '13px', fontWeight: 800, color: '#1E40AF', marginBottom: '4px' }}>
                  ✨ Live Preview ({previewLockers.length} lockers on Floor {bulkFloor}):
                </div>
                <div style={{ fontSize: '12px', color: '#1E3A8A', wordBreak: 'break-word' }}>
                  {previewLockers.length > 15
                    ? `${previewLockers.slice(0, 15).join(', ')} ... ${previewLockers[previewLockers.length - 1]}`
                    : previewLockers.join(', ')}
                </div>
              </div>
            );
          })()}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setBulkModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Generating...' : 'Bulk Generate Lockers'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
