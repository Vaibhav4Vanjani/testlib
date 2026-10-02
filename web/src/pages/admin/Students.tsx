import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { apiRequest } from '../../services/api.client';
import { getFullImageUrl } from '../../constants/config';
import { DataTable, type Column } from '../../components/UI/DataTable';
import { Badge } from '../../components/UI/Badge';
import { Modal } from '../../components/UI/Modal';
import { Lightbox } from '../../components/UI/Lightbox';
import { SeatGrid, type ISeat } from '../../components/UI/SeatGrid';
import { LockerGrid, type ILocker } from '../../components/UI/LockerGrid';
import { UserCheck, ShieldAlert, Search, Eye, CreditCard, Pencil, LogIn, LogOut, Upload, Calculator, AlertTriangle, KeyRound } from 'lucide-react';
import { formatDisplayDate, formatShiftTiming, formatDate, addMonths, calculateMonthsBetween, calculateExactMonthsAndDays } from '../../utils/dates';
import { HOURLY_TIME_SLOTS, getValidToTimeSlots, calculateSlotDurationHours, calculateSlotPricing, parseTimeToHourNum } from '../../utils/timeSlots';

import { useSearchParams } from 'react-router-dom';

export const AdminStudents: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialStatus = searchParams.get('status') || 'ALL';

  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalRecords, setTotalRecords] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState(initialStatus);

  useEffect(() => {
    const s = searchParams.get('status');
    if (s) setStatusFilter(s);
  }, [searchParams]);

  // Selected student for details drawer / extend / status change / password reset
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [paymentHistoryModalOpen, setPaymentHistoryModalOpen] = useState(false);
  const [extendModalOpen, setExtendModalOpen] = useState(false);
  const [extendMonths, setExtendMonths] = useState('1');
  const [extendToDate, setExtendToDate] = useState('');
  const [currentSavedToDate, setCurrentSavedToDate] = useState('');
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [paymentMaster, setPaymentMaster] = useState<any | null>(null);

  // Edit Student profile state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editFullName, setEditFullName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAadharNumber, setEditAadharNumber] = useState('');
  const [editFromTime, setEditFromTime] = useState('06:00');
  const [editToTime, setEditToTime] = useState('23:00');
  const [editFromDate, setEditFromDate] = useState('');
  const [editToDate, setEditToDate] = useState('');
  const [editSelectedSeatId, setEditSelectedSeatId] = useState<string | null>(null);
  const [editSelectedLockerId, setEditSelectedLockerId] = useState<string | null>(null);
  const [availableSeatsForEdit, setAvailableSeatsForEdit] = useState<ISeat[]>([]);
  const [availableLockersForEdit, setAvailableLockersForEdit] = useState<ILocker[]>([]);
  const [loadingEditAmenities, setLoadingEditAmenities] = useState(false);
  const [editPhotoFile, setEditPhotoFile] = useState<File | null>(null);
  const [editPhotoPreview, setEditPhotoPreview] = useState<string | null>(null);
  const [editPassword, setEditPassword] = useState('');
  const [recordExtensionPayment, setRecordExtensionPayment] = useState<boolean>(true);
  const [savingEdit, setSavingEdit] = useState(false);

  // Release Amenity Confirmation Modal state
  const [confirmReleaseModal, setConfirmReleaseModal] = useState<{
    type: 'SEAT' | 'LOCKER';
    itemId: string;
    itemNumber: string;
    floor?: number;
    studentId: string;
    studentName: string;
  } | null>(null);
  const [releasingAmenity, setReleasingAmenity] = useState(false);

  // Attendance Check-In / Check-Out loading state
  const [attendanceLoading, setAttendanceLoading] = useState(false);

  useEffect(() => {
    async function loadMaster() {
      try {
        const res = await apiRequest('/payments/plans');
        if (res.success) setPaymentMaster(res.data);
      } catch (e) {
        console.error(e);
      }
    }
    loadMaster();
  }, []);

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        page: String(currentPage),
        limit: '10',
        search: searchQuery,
        status: statusFilter !== 'ALL' ? statusFilter : '',
      });

      const res = await apiRequest(`/admin/students?${queryParams.toString()}`);
      if (res.success && res.data) {
        setStudents(res.data.students || []);
        setTotalRecords(res.data.pagination?.total ?? res.data.total ?? (res.data.students || []).length);
        setTotalPages(res.data.pagination?.totalPages ?? res.data.totalPages ?? 1);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [currentPage, searchQuery, statusFilter]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  const handleStatusChange = async (studentId: string, newStatus: string) => {
    if (!confirm(`Change student status to ${newStatus}?`)) return;
    try {
      const res = await apiRequest(`/admin/students/${studentId}/status`, 'PATCH', { status: newStatus });
      if (res.success) {
        alert('Student status updated successfully!');
        if (profileModalOpen) setProfileModalOpen(false);
        fetchStudents();
      } else {
        alert(res.error?.message || 'Failed to update status');
      }
    } catch (e: any) {
      alert(e.message || 'Error updating status');
    }
  };

  const handleOpenExtendModal = (student: any) => {
    setSelectedStudent(student);
    const expiry = student.toDate || student.membershipExpiresAt;
    const baseToDateStr = expiry ? (typeof expiry === 'string' ? expiry.split('T')[0] : formatDate(new Date(expiry))) : formatDate(new Date());
    setCurrentSavedToDate(baseToDateStr);
    setExtendMonths('1');
    const defaultNewExpiry = formatDate(addMonths(baseToDateStr, 1));
    setExtendToDate(defaultNewExpiry);
    setExtendModalOpen(true);
  };

  const handleExtendToDateChange = (newDateStr: string) => {
    setExtendToDate(newDateStr);
    if (currentSavedToDate && newDateStr) {
      const monthsCount = calculateMonthsBetween(currentSavedToDate, newDateStr);
      setExtendMonths(String(Math.max(1, monthsCount)));
    }
  };

  const handleExtendMonthsChange = (monthsVal: string) => {
    setExtendMonths(monthsVal);
    const monthsNum = Math.max(1, parseInt(monthsVal, 10) || 1);
    if (currentSavedToDate) {
      const newD = addMonths(currentSavedToDate, monthsNum);
      setExtendToDate(formatDate(newD));
    }
  };

  // Extension duration in months and days for Extend Plan modal
  const extendDuration = useMemo(() => {
    if (!currentSavedToDate || !extendToDate) {
      return { months: 0, days: 0, totalMonthFactor: 0, durationLabel: '0 Month(s)' };
    }
    return calculateExactMonthsAndDays(currentSavedToDate, extendToDate);
  }, [currentSavedToDate, extendToDate]);

  // Membership extension calculation preview for Extend Plan modal
  const extensionPricing = useMemo(() => {
    if (!selectedStudent || !paymentMaster || extendDuration.totalMonthFactor <= 0) return { libraryCharge: 0, seatCharge: 0, lockerCharge: 0, subtotal: 0 };
    const fTime = selectedStudent.fromTime || '06:00';
    const tTime = selectedStudent.toTime || '23:00';
    const hours = calculateSlotDurationHours(fTime, tTime);
    const hasSeat = !!(selectedStudent.currentSeatId || selectedStudent.assignedSeatId);
    const hasLocker = !!(selectedStudent.currentLockerId || selectedStudent.assignedLockerId);
    const seatObj = selectedStudent.currentSeatId || selectedStudent.assignedSeatId;
    const lockerObj = selectedStudent.currentLockerId || selectedStudent.assignedLockerId;

    return calculateSlotPricing(
      paymentMaster,
      hours,
      extendDuration.totalMonthFactor,
      hasSeat,
      hasLocker,
      seatObj?.priceMonthly,
      lockerObj?.priceMonthly
    );
  }, [selectedStudent, paymentMaster, extendDuration]);


  // Extension duration in months and days for Edit Profile modal
  const editExtensionDuration = useMemo(() => {
    if (!currentSavedToDate || !editToDate) {
      return { months: 0, days: 0, totalMonthFactor: 0, durationLabel: '0 Month(s)' };
    }
    return calculateExactMonthsAndDays(currentSavedToDate, editToDate);
  }, [currentSavedToDate, editToDate]);

  // Extension pricing calculation for Edit Profile modal
  const editExtensionPricing = useMemo(() => {
    if (!selectedStudent || !paymentMaster || editExtensionDuration.totalMonthFactor <= 0) {
      return { libraryCharge: 0, seatCharge: 0, lockerCharge: 0, subtotal: 0 };
    }
    const hours = calculateSlotDurationHours(editFromTime, editToTime);
    const hasSeat = !!editSelectedSeatId;
    const hasLocker = !!editSelectedLockerId;

    let seatPrice: number | undefined;
    if (editSelectedSeatId) {
      const seatObj = availableSeatsForEdit.find((s: any) => s._id === editSelectedSeatId) || (selectedStudent.currentSeatId?._id === editSelectedSeatId ? selectedStudent.currentSeatId : null);
      seatPrice = seatObj?.priceMonthly;
    }
    let lockerPrice: number | undefined;
    if (editSelectedLockerId) {
      const lockerObj = availableLockersForEdit.find((l: any) => l._id === editSelectedLockerId) || (selectedStudent.currentLockerId?._id === editSelectedLockerId ? selectedStudent.currentLockerId : null);
      lockerPrice = lockerObj?.priceMonthly;
    }

    return calculateSlotPricing(
      paymentMaster,
      hours,
      editExtensionDuration.totalMonthFactor,
      hasSeat,
      hasLocker,
      seatPrice,
      lockerPrice
    );
  }, [selectedStudent, paymentMaster, editExtensionDuration, editFromTime, editToTime, editSelectedSeatId, editSelectedLockerId, availableSeatsForEdit, availableLockersForEdit]);

  const handleExtendSubscription = async () => {
    if (!selectedStudent) return;
    const months = parseInt(extendMonths, 10);
    if (isNaN(months) || months < 1 || months > 50) {
      alert('Months must be between 1 and 50.');
      return;
    }

    try {
      const res = await apiRequest(`/admin/students/${selectedStudent._id}/extend`, 'POST', {
        months,
        newToDate: extendToDate,
        baseDate: currentSavedToDate,
      });
      if (res.success && res.data) {
        const updatedStudent = res.data.student || {
          ...selectedStudent,
          toDate: res.data.newToDate || extendToDate || selectedStudent.toDate,
          membershipExpiresAt: res.data.newToDate || extendToDate || selectedStudent.membershipExpiresAt,
          membershipStatus: 'ACTIVE',
        };
        alert(res.message || res.data?.message || `Subscription extended until ${formatDisplayDate(extendToDate)}! 🎉`);
        setExtendModalOpen(false);
        setSelectedStudent(updatedStudent);
        await fetchStudents();
      } else {
        alert(res.error?.message || 'Failed to extend subscription');
      }
    } catch (e: any) {
      alert(e.message || 'Error extending subscription');
    }
  };

  const handleResetPassword = async () => {
    if (!selectedStudent || !newPassword) {
      alert('Please enter a new password');
      return;
    }
    if (newPassword.trim().length < 4) {
      alert('New password must be at least 4 characters long.');
      return;
    }

    try {
      const res = await apiRequest(`/admin/students/${selectedStudent._id}`, 'PUT', { newPassword: newPassword.trim() });
      if (res.success) {
        const studentName = selectedStudent.fullName || selectedStudent.userId?.fullName || 'Student';
        alert(`Password for ${studentName} reset successfully! 🎉`);
        setPasswordModalOpen(false);
        setNewPassword('');
        await fetchStudents();
      } else {
        alert(res.error?.message || 'Failed to reset password');
      }
    } catch (e: any) {
      alert(e.message || 'Error resetting password');
    }
  };

  const handleDirectCheckIn = async (studentProfileId: string) => {
    setAttendanceLoading(true);
    try {
      const res = await apiRequest('/attendance/direct-checkin', 'POST', { studentProfileId });
      if (res.success) {
        alert(res.message || 'Student checked in successfully!');
        await fetchStudents();
        if (selectedStudent && selectedStudent._id === studentProfileId) {
          setSelectedStudent((prev: any) => ({ ...prev, isCheckedIn: true, activeAttendanceSession: res.data?.session || { status: 'ACTIVE' } }));
        }
      } else {
        alert(res.error?.message || 'Check-in failed');
      }
    } catch (e: any) {
      alert(e.message || 'Error checking in student');
    } finally {
      setAttendanceLoading(false);
    }
  };

  const handleDirectCheckOut = async (studentProfileId: string) => {
    setAttendanceLoading(true);
    try {
      const res = await apiRequest('/attendance/direct-checkout', 'POST', { studentProfileId });
      if (res.success) {
        alert(res.message || 'Student checked out successfully!');
        await fetchStudents();
        if (selectedStudent && selectedStudent._id === studentProfileId) {
          setSelectedStudent((prev: any) => ({ ...prev, isCheckedIn: false, activeAttendanceSession: null, pendingAttendanceRequest: null }));
        }
      } else {
        alert(res.error?.message || 'Check-out failed');
      }
    } catch (e: any) {
      alert(e.message || 'Error checking out student');
    } finally {
      setAttendanceLoading(false);
    }
  };

  const handleConfirmReleaseAmenity = async () => {
    if (!confirmReleaseModal) return;
    setReleasingAmenity(true);
    try {
      const { type, itemId, studentId } = confirmReleaseModal;
      const endpoint = type === 'SEAT' ? '/admin/seat-master' : '/admin/locker-master';
      const payload = {
        action: 'UNASSIGN_STUDENT',
        [type === 'SEAT' ? 'seatId' : 'lockerId']: itemId,
        studentProfileId: studentId,
      };

      const res = await apiRequest(endpoint, 'POST', payload);
      if (res.success) {
        alert(`${type === 'SEAT' ? 'Seat' : 'Locker'} released successfully!`);
        setConfirmReleaseModal(null);
        if (profileModalOpen) setProfileModalOpen(false);
        if (editModalOpen) setEditModalOpen(false);
        await fetchStudents();
      } else {
        alert(res.error?.message || `Failed to release ${type.toLowerCase()}`);
      }
    } catch (err: any) {
      alert(err.message || 'Error releasing item');
    } finally {
      setReleasingAmenity(false);
    }
  };

  const fetchEditAmenities = useCallback(async (fDate: string, tDate: string, fTime: string, tTime: string) => {
    if (!fDate || !tDate || !fTime || !tTime) return;
    setLoadingEditAmenities(true);
    try {
      const queryParams = new URLSearchParams({ fromDate: fDate, toDate: tDate, fromTime: fTime, toTime: tTime });
      const [sRes, lRes] = await Promise.all([
        apiRequest(`/admin/seat-master?${queryParams.toString()}`),
        apiRequest(`/admin/locker-master?${queryParams.toString()}`),
      ]);
      if (sRes.success) setAvailableSeatsForEdit(sRes.data?.seats || sRes.data || []);
      if (lRes.success) setAvailableLockersForEdit(lRes.data?.lockers || lRes.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingEditAmenities(false);
    }
  }, []);

  const handleOpenEditModal = (student: any) => {
    setSelectedStudent(student);
    setEditFullName(student.fullName || student.userId?.fullName || '');
    setEditPhone(student.phone || student.userId?.phone || '');
    setEditAadharNumber(student.aadharNumber || '');
    const photo = student.profilePictureUrl || student.profileImage || student.userId?.profilePicture;
    setEditPhotoPreview(getFullImageUrl(photo));
    setEditPhotoFile(null);
    setEditPassword('');

    const todayObj = new Date();
    const rawFromDate = student.fromDate || student.membershipStartedAt || student.createdAt;
    const fDate = rawFromDate ? (typeof rawFromDate === 'string' ? rawFromDate.split('T')[0] : formatDate(new Date(rawFromDate))) : formatDate(todayObj);
    const expiry = student.toDate || student.membershipExpiresAt;
    const tDate = expiry ? (typeof expiry === 'string' ? expiry.split('T')[0] : formatDate(new Date(expiry))) : formatDate(addMonths(todayObj, 1));
    const fTime = student.fromTime || '06:00';
    const tTime = student.toTime || '23:00';

    setCurrentSavedToDate(tDate);
    setEditFromDate(fDate);
    setEditToDate(tDate);
    setEditFromTime(fTime);
    setEditToTime(tTime);

    const currentSeatObj = student.currentSeatId || student.assignedSeatId;
    const currentLockerObj = student.currentLockerId || student.assignedLockerId;
    setEditSelectedSeatId(currentSeatObj?._id || currentSeatObj || null);
    setEditSelectedLockerId(currentLockerObj?._id || currentLockerObj || null);

    fetchEditAmenities(fDate, tDate, fTime, tTime);
    setEditModalOpen(true);
  };

  const handleEditPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setEditPhotoFile(file);
      setEditPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleSaveStudentEdit = async () => {
    if (!selectedStudent) return;
    if (!editFullName.trim()) {
      alert('Student Full Name is required');
      return;
    }
    if (!editPhone.trim() || editPhone.trim().length !== 10) {
      alert('Phone Number must be exactly 10 digits.');
      return;
    }

    if (editAadharNumber.trim() && editAadharNumber.trim().length !== 12) {
      alert('Aadhaar Number must be exactly 12 digits.');
      return;
    }

    setSavingEdit(true);
    try {
      if (currentSavedToDate && editToDate && editToDate > currentSavedToDate) {
        const extendRes = await apiRequest(`/admin/students/${selectedStudent._id}/extend`, 'POST', {
          newToDate: editToDate,
          baseDate: currentSavedToDate,
          recordPayment: recordExtensionPayment,
          fromTime: editFromTime,
          toTime: editToTime,
        });
        if (!extendRes.success) {
          throw new Error(extendRes.error?.message || 'Failed to process subscription extension');
        }
      }
      const formData = new FormData();
      formData.append('fullName', editFullName.trim());
      formData.append('phone', editPhone.trim());
      formData.append('aadharNumber', editAadharNumber.trim());
      formData.append('fromTime', editFromTime);
      formData.append('toTime', editToTime);
      formData.append('fromDate', editFromDate);
      formData.append('toDate', editToDate);

      if (editPassword.trim()) {
        if (editPassword.trim().length < 4) {
          alert('New password must be at least 4 characters long.');
          setSavingEdit(false);
          return;
        }
        formData.append('newPassword', editPassword.trim());
      }
      if (editPhotoFile) {
        formData.append('profilePicture', editPhotoFile);
      }

      const profileRes = await apiRequest(`/admin/students/${selectedStudent._id}`, 'PUT', formData);
      if (!profileRes.success) {
        throw new Error(profileRes.error?.message || 'Failed to update student profile');
      }

      // Handle Seat Assignment Changes
      const origSeatObj = selectedStudent.currentSeatId || selectedStudent.assignedSeatId;
      const originalSeatId = origSeatObj?._id || origSeatObj;
      const isSeatChanged = editSelectedSeatId !== originalSeatId;
      const isShiftChanged = selectedStudent.fromTime !== editFromTime || selectedStudent.toTime !== editToTime;

      if (isSeatChanged || (editSelectedSeatId && isShiftChanged)) {
        if (originalSeatId && isSeatChanged) {
          const unassignRes = await apiRequest('/admin/seat-master', 'POST', {
            action: 'UNASSIGN_STUDENT',
            seatId: originalSeatId,
            studentProfileId: selectedStudent._id,
          });
          if (!unassignRes.success) {
            throw new Error(unassignRes.error?.message || 'Failed to release previous seat assignment');
          }
        }
        if (editSelectedSeatId) {
          const assignRes = await apiRequest('/admin/seat-master', 'POST', {
            action: 'ASSIGN_STUDENT',
            seatId: editSelectedSeatId,
            studentProfileId: selectedStudent._id,
            fromTime: editFromTime,
            toTime: editToTime,
            fromDate: editFromDate,
            toDate: editToDate,
          });
          if (!assignRes.success) {
            throw new Error(assignRes.error?.message || 'Failed to assign selected seat');
          }
        }
      }

      // Handle Locker Assignment Changes
      const origLockerObj = selectedStudent.currentLockerId || selectedStudent.assignedLockerId;
      const originalLockerId = origLockerObj?._id || origLockerObj;
      const isLockerChanged = editSelectedLockerId !== originalLockerId;

      if (isLockerChanged || (editSelectedLockerId && isShiftChanged)) {
        if (originalLockerId && isLockerChanged) {
          const unassignLockerRes = await apiRequest('/admin/locker-master', 'POST', {
            action: 'UNASSIGN_STUDENT',
            lockerId: originalLockerId,
            studentProfileId: selectedStudent._id,
          });
          if (!unassignLockerRes.success) {
            throw new Error(unassignLockerRes.error?.message || 'Failed to release previous locker assignment');
          }
        }
        if (editSelectedLockerId) {
          const assignLockerRes = await apiRequest('/admin/locker-master', 'POST', {
            action: 'ASSIGN_STUDENT',
            lockerId: editSelectedLockerId,
            studentProfileId: selectedStudent._id,
            fromTime: editFromTime,
            toTime: editToTime,
            fromDate: editFromDate,
            toDate: editToDate,
          });
          if (!assignLockerRes.success) {
            throw new Error(assignLockerRes.error?.message || 'Failed to assign selected locker');
          }
        }
      }

      // Re-fetch updated list from backend
      await fetchStudents();

      // Update selectedStudent if detail view modal is open
      if (profileRes.data?.student) {
        setSelectedStudent(profileRes.data.student);
      }

      setEditModalOpen(false);
      setEditPassword('');
      alert('Student profile saved successfully!');
    } catch (e: any) {
      alert(e.message || 'Error updating student profile');
    } finally {
      setSavingEdit(false);
    }
  };

  const isStudentExpired = (student: any): boolean => {
    if (!student) return false;
    if (student.membershipStatus === 'EXPIRED') return true;
    const expiryDate = student.toDate || student.membershipExpiresAt || student.validTo;
    if (!expiryDate) return false;

    const exp = new Date(expiryDate);
    if (isNaN(exp.getTime())) return false;

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    return exp.getTime() < startOfToday.getTime();
  };

  const columns: Column<any>[] = [
    {
      header: 'Photo',
      accessor: (row: any) => {
        const photo = row.profilePictureUrl || row.profileImage || row.userId?.profilePicture;
        const name = row.fullName || row.userId?.fullName || 'Student';
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {photo ? (
              <img
                src={getFullImageUrl(photo) || ''}
                alt={name}
                onClick={() => setLightboxImage(getFullImageUrl(photo) || '')}
                style={{ width: '34px', height: '34px', borderRadius: '50%', objectFit: 'cover', cursor: 'pointer', border: '1px solid #E2E8F0', flexShrink: 0 }}
              />
            ) : (
              <div style={{ width: '34px', height: '34px', borderRadius: '50%', backgroundColor: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#4F46E5', fontSize: '13px', flexShrink: 0 }}>
                {name.charAt(0)}
              </div>
            )}
            <div>
              <div style={{ fontWeight: 700, color: '#0F172A', fontSize: '13px', lineHeight: 1.2 }}>{name}</div>
              <div style={{ fontSize: '11px', color: '#64748B' }}>{row.phone || row.userId?.phone || 'N/A'}</div>
            </div>
          </div>
        );
      },
    },
    {
      header: 'Assigned Amenities',
      accessor: (row: any) => {
        const seatObj = row.currentSeatId || row.assignedSeatId;
        const lockerObj = row.currentLockerId || row.assignedLockerId;
        const seatNum = seatObj?.seatNumber;
        const seatFloor = seatObj?.floor;
        const lockerNum = lockerObj?.lockerNumber;
        const lockerFloor = lockerObj?.floor;
        const fromT = row.fromTime || row.shiftFromTime;
        const toT = row.toTime || row.shiftToTime;

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', fontSize: '11.5px' }}>
            <div>
              <strong style={{ color: '#475569' }}>Seat:</strong> {seatNum ? `Seat ${seatNum}${seatFloor !== undefined && seatFloor !== null ? ` | Floor: ${seatFloor}` : ''}` : 'None'}
            </div>
            <div>
              <strong style={{ color: '#475569' }}>Locker:</strong> {lockerNum ? `Locker ${lockerNum}${lockerFloor !== undefined && lockerFloor !== null ? ` | Floor: ${lockerFloor}` : ''}` : 'None'}
            </div>
            {fromT && toT && <div style={{ color: '#64748B', fontSize: '11px' }}>Shift: {formatShiftTiming(fromT, toT)}</div>}
          </div>
        );
      },
    },
    {
      header: 'Status & Expiry',
      accessor: (row: any) => {
        const expiryDate = row.toDate || row.membershipExpiresAt || row.validTo;
        const expired = isStudentExpired(row);
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'flex-start' }}>
            <Badge status={expired ? 'EXPIRED' : (row.membershipStatus || 'ACTIVE')} />
            <span style={{ fontSize: '11px', color: expired ? '#DC2626' : '#64748B', fontWeight: expired ? 600 : 400 }}>Exp: {formatDisplayDate(expiryDate)}</span>
          </div>
        );
      },
    },
    {
      header: 'Check-In/Out Status',
      accessor: (row: any) => {
        const isCheckedIn = row.isCheckedIn || !!row.activeAttendanceSession;
        const isPending = !!row.pendingAttendanceRequest;
        if (isCheckedIn) {
          return (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', backgroundColor: '#DCFCE7', color: '#15803D', padding: '3px 8px', borderRadius: '10px', fontSize: '11.5px', fontWeight: 700 }}>
              🟢 Checked In
            </span>
          );
        }
        if (isPending) {
          return (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', backgroundColor: '#FEF3C7', color: '#B45309', padding: '3px 8px', borderRadius: '10px', fontSize: '11.5px', fontWeight: 700 }}>
              ⏳ Pending
            </span>
          );
        }
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', backgroundColor: '#F1F5F9', color: '#64748B', padding: '3px 8px', borderRadius: '10px', fontSize: '11.5px', fontWeight: 600 }}>
            ⚪ Checked Out
          </span>
        );
      },
    },
    {
      header: 'Actions',
      accessor: (row: any) => (
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center', whiteSpace: 'nowrap' }}>
          <button
            className="btn btn-secondary btn-xs"
            onClick={() => {
              setSelectedStudent(row);
              setProfileModalOpen(true);
            }}
            title="View Details"
          >
            <Eye size={13} /> View
          </button>
          <button
            className="btn btn-secondary btn-xs"
            style={{ color: '#2563EB', borderColor: '#BFDBFE', backgroundColor: '#EFF6FF' }}
            onClick={() => handleOpenEditModal(row)}
            title="Edit Profile"
          >
            <Pencil size={13} /> Edit
          </button>
          <button
            className="btn btn-secondary btn-xs"
            style={{ color: '#D97706', borderColor: '#FDE68A', backgroundColor: '#FFFBEB' }}
            onClick={() => {
              setSelectedStudent(row);
              setNewPassword('');
              setPasswordModalOpen(true);
            }}
            title="Reset Password"
          >
            <KeyRound size={13} /> Reset
          </button>
          <button
            className="btn btn-primary btn-xs"
            onClick={() => handleOpenExtendModal(row)}
            title="Extend Membership Plan"
          >
            Extend Plan
          </button>
        </div>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div>
        <h1 style={{ fontSize: '20px', fontWeight: 800, color: '#0F172A', marginBottom: '2px' }}>Student Directory & Management</h1>
        <p style={{ fontSize: '13px', color: '#64748B', margin: 0 }}>View enrolled students, attendance status, assign/release seats & lockers, and extend plans</p>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="card" style={{ padding: '10px 14px', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div className="form-group" style={{ flex: 1, minWidth: '220px', marginBottom: 0 }}>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: '36px', paddingTop: '8px', paddingBottom: '8px', fontSize: '13px' }}
              placeholder="Search by student name or phone number..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
        </div>

        <div className="form-group" style={{ width: '180px', marginBottom: 0 }}>
          <select
            className="form-select"
            style={{ paddingTop: '8px', paddingBottom: '8px', fontSize: '13px' }}
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="ALL">All Membership Status</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="EXPIRED">Expired</option>
          </select>
        </div>
      </div>

      {/* DATA TABLE */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <DataTable
          columns={columns}
          data={students}
          loading={loading}
          totalRecords={totalRecords}
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={(page) => setCurrentPage(page)}
          getRowStyle={(student) => (isStudentExpired(student) ? { backgroundColor: '#FEF2F2' } : undefined)}
        />
      </div>

      {/* PROFILE DETAIL MODAL */}
      <Modal isOpen={profileModalOpen} onClose={() => setProfileModalOpen(false)} title="Student Profile & Status">
        {selectedStudent && (() => {
          const photo = selectedStudent.profilePictureUrl || selectedStudent.profileImage || selectedStudent.userId?.profilePicture;
          const name = selectedStudent.fullName || selectedStudent.userId?.fullName || 'Student';
          const phone = selectedStudent.phone || selectedStudent.userId?.phone || 'N/A';
          const expiryDate = selectedStudent.toDate || selectedStudent.membershipExpiresAt || selectedStudent.validTo;
          const seatObj = selectedStudent.currentSeatId || selectedStudent.assignedSeatId;
          const lockerObj = selectedStudent.currentLockerId || selectedStudent.assignedLockerId;
          const seatNum = seatObj?.seatNumber;
          const seatFloor = seatObj?.floor;
          const lockerNum = lockerObj?.lockerNumber;
          const lockerFloor = lockerObj?.floor;
          const fromT = selectedStudent.fromTime || selectedStudent.shiftFromTime;
          const toT = selectedStudent.toTime || selectedStudent.shiftToTime;
          const isCheckedIn = selectedStudent.isCheckedIn || !!selectedStudent.activeAttendanceSession;
          const isPending = !!selectedStudent.pendingAttendanceRequest;

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Header Hero Card */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '10px 14px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {photo ? (
                    <img
                      src={getFullImageUrl(photo) || ''}
                      alt={name}
                      style={{ width: '44px', height: '44px', borderRadius: '50%', objectFit: 'cover', border: '1.5px solid #CBD5E1' }}
                    />
                  ) : (
                    <div style={{ width: '44px', height: '44px', borderRadius: '50%', backgroundColor: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: 800, color: '#4F46E5' }}>
                      {name.charAt(0)}
                    </div>
                  )}
                  <div>
                    <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A', margin: 0, lineHeight: 1.2 }}>{name}</h3>
                    <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                      Phone: <strong>{phone}</strong> • Aadhaar: {selectedStudent.aadharNumber || 'N/A'}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  className="btn btn-secondary btn-xs"
                  style={{ color: '#2563EB', borderColor: '#BFDBFE', backgroundColor: '#EFF6FF' }}
                  onClick={() => handleOpenEditModal(selectedStudent)}
                >
                  <Pencil size={13} /> Edit Profile
                </button>
              </div>

              {/* Compact Details Grid */}
              <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', fontSize: '12.5px' }}>
                <div><strong>Status:</strong> <Badge status={selectedStudent.membershipStatus || 'ACTIVE'} /></div>
                <div><strong>Expiry Date:</strong> {formatDisplayDate(expiryDate)}</div>

                <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #F1F5F9', paddingTop: '6px' }}>
                  <span><strong>Assigned Seat:</strong> {seatNum ? `Seat ${seatNum}${seatFloor !== undefined && seatFloor !== null ? ` (Floor ${seatFloor})` : ''}` : 'None'}</span>
                  {seatObj && (
                    <button
                      type="button"
                      style={{ padding: '2px 7px', fontSize: '10.5px', color: '#DC2626', backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '5px', cursor: 'pointer', fontWeight: 700 }}
                      onClick={() => setConfirmReleaseModal({ type: 'SEAT', itemId: seatObj._id || seatObj, itemNumber: seatNum, floor: seatFloor, studentId: selectedStudent._id, studentName: name })}
                    >
                      Release Seat
                    </button>
                  )}
                </div>

                <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #F1F5F9', paddingTop: '6px' }}>
                  <span><strong>Assigned Locker:</strong> {lockerNum ? `Locker ${lockerNum}${lockerFloor !== undefined && lockerFloor !== null ? ` (Floor ${lockerFloor})` : ''}` : 'None'}</span>
                  {lockerObj && (
                    <button
                      type="button"
                      style={{ padding: '2px 7px', fontSize: '10.5px', color: '#DC2626', backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '5px', cursor: 'pointer', fontWeight: 700 }}
                      onClick={() => setConfirmReleaseModal({ type: 'LOCKER', itemId: lockerObj._id || lockerObj, itemNumber: lockerNum, floor: lockerFloor, studentId: selectedStudent._id, studentName: name })}
                    >
                      Release Locker
                    </button>
                  )}
                </div>

                <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: '6px' }}><strong>Shift Hours:</strong> {formatShiftTiming(fromT, toT)}</div>
                <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: '6px' }}><strong>Rejection Strikes:</strong> {selectedStudent.rejectionCount || 0} / 3</div>

                <div style={{ gridColumn: '1 / -1', borderTop: '1px solid #F1F5F9', paddingTop: '6px' }}>
                  <strong>Attendance:</strong>{' '}
                  {isCheckedIn ? (
                    <span style={{ color: '#16A34A', fontWeight: 800 }}>🟢 Checked In</span>
                  ) : isPending ? (
                    <span style={{ color: '#D97706', fontWeight: 800 }}>⏳ Pending Approval</span>
                  ) : (
                    <span style={{ color: '#64748B', fontWeight: 600 }}>⚪ Checked Out</span>
                  )}
                </div>
              </div>

              {/* Compact 2x2 Actions Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '2px' }}>
                {isCheckedIn ? (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ backgroundColor: '#FEF2F2', borderColor: '#FCA5A5', color: '#DC2626', fontWeight: 700, padding: '8px 12px', fontSize: '12.5px', justifyContent: 'center' }}
                    onClick={() => handleDirectCheckOut(selectedStudent._id)}
                    disabled={attendanceLoading}
                  >
                    <LogOut size={15} /> Direct Check Out
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ fontWeight: 700, padding: '8px 12px', fontSize: '12.5px', justifyContent: 'center' }}
                    onClick={() => handleDirectCheckIn(selectedStudent._id)}
                    disabled={attendanceLoading}
                  >
                    <LogIn size={15} /> Direct Check In
                  </button>
                )}

                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ borderColor: '#BFDBFE', backgroundColor: '#EFF6FF', color: '#1E40AF', fontWeight: 700, padding: '8px 12px', fontSize: '12.5px', justifyContent: 'center' }}
                  onClick={() => setPaymentHistoryModalOpen(true)}
                >
                  <CreditCard size={15} /> Payment History ({(selectedStudent.paymentsHistory || []).length})
                </button>

                <button
                  className="btn btn-secondary"
                  style={{ color: '#D97706', borderColor: '#FDE68A', backgroundColor: '#FFFBEB', fontWeight: 700, padding: '8px 12px', fontSize: '12.5px', justifyContent: 'center' }}
                  onClick={() => {
                    setNewPassword('');
                    setPasswordModalOpen(true);
                  }}
                >
                  <KeyRound size={15} /> Reset Password
                </button>

                {selectedStudent.membershipStatus !== 'ACTIVE' ? (
                  <button
                    className="btn btn-success"
                    style={{ fontWeight: 700, padding: '8px 12px', fontSize: '12.5px', justifyContent: 'center' }}
                    onClick={() => handleStatusChange(selectedStudent._id, 'ACTIVE')}
                  >
                    <UserCheck size={15} /> Set Active
                  </button>
                ) : (
                  <button
                    className="btn btn-danger"
                    style={{ fontWeight: 700, padding: '8px 12px', fontSize: '12.5px', justifyContent: 'center' }}
                    onClick={() => handleStatusChange(selectedStudent._id, 'INACTIVE')}
                  >
                    <ShieldAlert size={15} /> Mark Inactive
                  </button>
                )}
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* STUDENT PAYMENT HISTORY MODAL */}
      <Modal isOpen={paymentHistoryModalOpen} onClose={() => setPaymentHistoryModalOpen(false)} title={`Payment History - ${selectedStudent?.fullName || selectedStudent?.userId?.fullName || 'Student'}`}>
        {selectedStudent && (() => {
          const historyList = selectedStudent.paymentsHistory || [];
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ fontSize: '13px', color: '#64748B' }}>
                Complete payment records for <strong>{selectedStudent?.fullName || selectedStudent?.userId?.fullName}</strong> ({selectedStudent?.phone || selectedStudent?.userId?.phone || 'N/A'})
              </div>

              {historyList.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: '#94A3B8', fontSize: '14px', backgroundColor: '#F8FAFC', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                  No payment history recorded for this student.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '420px', overflowY: 'auto', paddingRight: '4px' }}>
                  {historyList.map((pay: any, idx: number) => {
                    const proofUrl = pay.proofImageUrl || pay.proofFile || pay.proofUrl;
                    const fullProofUrl = getFullImageUrl(proofUrl);

                    return (
                      <div
                        key={pay._id || idx}
                        style={{
                          backgroundColor: '#F8FAFC',
                          border: '1px solid #E2E8F0',
                          borderRadius: '12px',
                          padding: '14px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '16px', fontWeight: 800, color: '#059669' }}>
                            ₹{pay.amount}
                          </span>
                          <span
                            className={
                              pay.status === 'APPROVED'
                                ? 'badge badge-success'
                                : pay.status === 'REJECTED'
                                  ? 'badge badge-danger'
                                  : 'badge badge-warning'
                            }
                          >
                            {pay.status}
                          </span>
                        </div>

                        <div style={{ fontSize: '13px', color: '#475569', display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                          <span>💳 <strong>Method:</strong> {pay.paymentMethod || 'Cash'}</span>
                          <span>📦 <strong>Type:</strong> {pay.paymentType || 'MEMBERSHIP'} {pay.months ? `(${pay.months} mo)` : ''}</span>
                          {pay.utrNumber ? <span>🔢 <strong>UTR:</strong> {pay.utrNumber}</span> : null}
                          {pay.fromTime && pay.toTime ? <span>⏰ <strong>Shift:</strong> {formatShiftTiming(pay.fromTime, pay.toTime)}</span> : null}
                        </div>

                        <div style={{ fontSize: '12px', color: '#64748B' }}>
                          📅 <strong>Date:</strong> {pay.createdAt ? new Date(pay.createdAt).toLocaleString() : 'N/A'}
                        </div>

                        {pay.adminNotes ? (
                          <div style={{ fontSize: '12px', color: '#D97706', fontStyle: 'italic', backgroundColor: '#FEF3C7', padding: '6px 10px', borderRadius: '6px' }}>
                            Notes: {pay.adminNotes}
                          </div>
                        ) : null}

                        {fullProofUrl ? (
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{
                              marginTop: '4px',
                              fontSize: '12px',
                              padding: '6px 12px',
                              color: '#2563EB',
                              borderColor: '#BFDBFE',
                              backgroundColor: '#EFF6FF',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px',
                            }}
                            onClick={() => setLightboxImage(fullProofUrl)}
                          >
                            <Eye size={14} /> View Payment Proof Screenshot
                          </button>
                        ) : (
                          <div style={{ fontSize: '11px', color: '#94A3B8', fontStyle: 'italic' }}>
                            No payment proof screenshot attached
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}
      </Modal>

      {/* EXTEND SUBSCRIPTION MODAL WITH PRICING PREVIEW & DATE SELECTION */}
      <Modal isOpen={extendModalOpen} onClose={() => setExtendModalOpen(false)} title={`Extend Plan for ${selectedStudent?.fullName || selectedStudent?.userId?.fullName || 'Student'}`}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ backgroundColor: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: '10px', padding: '10px 14px', fontSize: '13px', color: '#3730A3', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Current Expiry (Saved To Date):</span>
            <strong style={{ fontSize: '14px' }}>{formatDisplayDate(currentSavedToDate)}</strong>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">New Expiry Date *</label>
              <input
                type="date"
                className="form-input"
                min={currentSavedToDate}
                value={extendToDate}
                onChange={(e) => handleExtendToDateChange(e.target.value)}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Extend Duration (Months 1-50)</label>
              <input
                type="number"
                className="form-input"
                min={1}
                max={50}
                value={extendMonths}
                onChange={(e) => handleExtendMonthsChange(e.target.value)}
              />
            </div>
          </div>

          <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
              <span>Extension Period:</span>
              <strong style={{ color: '#4F46E5' }}>{formatDisplayDate(currentSavedToDate)} → {formatDisplayDate(extendToDate)} ({extendDuration.durationLabel})</strong>
            </div>
            <div style={{ borderTop: '1px dashed #CBD5E1', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', color: '#64748B' }}>
              <span>Base Library Fee ({extendDuration.durationLabel}):</span>
              <span>₹{extensionPricing.libraryCharge}</span>
            </div>
            {extensionPricing.seatCharge > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#059669' }}>
                <span>Seat Charge:</span>
                <span>+ ₹{extensionPricing.seatCharge}</span>
              </div>
            )}
            {extensionPricing.lockerCharge > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#D97706' }}>
                <span>Locker Charge:</span>
                <span>+ ₹{extensionPricing.lockerCharge}</span>
              </div>
            )}
            <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: 800 }}>
              <span>Total Extension Fee:</span>
              <span style={{ color: '#4F46E5' }}>₹{extensionPricing.subtotal}</span>
            </div>
            <div style={{ fontSize: '11px', color: '#64748B', fontStyle: 'italic' }}>
              * Calculated strictly for the extension period. Original membership period is not re-billed.
            </div>
          </div>

          <button className="btn btn-primary" onClick={handleExtendSubscription} style={{ width: '100%', padding: '12px' }}>
            <Calculator size={18} /> Confirm Subscription Extension (₹{extensionPricing.subtotal})
          </button>
        </div>
      </Modal>

      {/* RESET PASSWORD MODAL */}
      <Modal isOpen={passwordModalOpen} onClose={() => setPasswordModalOpen(false)} title={`Reset Password for ${selectedStudent?.fullName || selectedStudent?.userId?.fullName || 'Student'}`}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="form-group">
            <label className="form-label">New Password *</label>
            <input
              type="text"
              className="form-input"
              placeholder="Enter new password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>

          <button className="btn btn-primary" onClick={handleResetPassword}>
            Reset Password
          </button>
        </div>
      </Modal>

      {/* CONFIRM RELEASE SEAT/LOCKER MODAL */}
      <Modal isOpen={!!confirmReleaseModal} onClose={() => setConfirmReleaseModal(null)} title={`Confirm Release ${confirmReleaseModal?.type === 'SEAT' ? 'Seat' : 'Locker'}`}>
        {confirmReleaseModal && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '12px', padding: '16px', color: '#B91C1C', fontSize: '14px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <AlertTriangle size={24} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                Are you sure you want to release <strong>{confirmReleaseModal.type === 'SEAT' ? `Seat ${confirmReleaseModal.itemNumber}` : `Locker ${confirmReleaseModal.itemNumber}`}</strong>{confirmReleaseModal.floor !== undefined ? ` (Floor ${confirmReleaseModal.floor})` : ''} assigned to <strong>{confirmReleaseModal.studentName}</strong>?
                <div style={{ marginTop: '6px', fontSize: '12px', color: '#991B1B' }}>
                  This will unassign the {confirmReleaseModal.type.toLowerCase()} and make it immediately available for other students.
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setConfirmReleaseModal(null)} disabled={releasingAmenity}>
                Cancel
              </button>
              <button type="button" className="btn btn-danger" onClick={handleConfirmReleaseAmenity} disabled={releasingAmenity}>
                {releasingAmenity ? 'Releasing...' : `Confirm Release ${confirmReleaseModal.type === 'SEAT' ? 'Seat' : 'Locker'}`}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* EDIT STUDENT PROFILE MODAL WITH SEAT & LOCKER ALLOTMENT/CHANGE */}
      <Modal isOpen={editModalOpen} onClose={() => setEditModalOpen(false)} title="Edit Student Profile">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxHeight: '75vh', overflowY: 'auto', overflowX: 'hidden', paddingRight: '4px' }}>
          {/* PROFILE PHOTO PREVIEW & UPLOAD */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            {editPhotoPreview ? (
              <img
                src={editPhotoPreview}
                alt="Profile Preview"
                style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #3B82F6' }}
              />
            ) : (
              <div style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', fontWeight: 800, color: '#4F46E5' }}>
                {editFullName.charAt(0) || 'S'}
              </div>
            )}
            <label className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Upload size={14} /> Change Photo
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleEditPhotoChange} />
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Full Name *</label>
              <input
                type="text"
                className="form-input"
                value={editFullName}
                onChange={(e) => setEditFullName(e.target.value)}
                placeholder="Student full name"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Phone Number *</label>
              <input
                type="text"
                className="form-input"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                maxLength={10}
                placeholder="10-digit phone number"
              />
            </div>

            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Aadhaar Number</label>
              <input
                type="text"
                className="form-input"
                value={editAadharNumber}
                onChange={(e) => setEditAadharNumber(e.target.value.replace(/\D/g, '').slice(0, 12))}
                maxLength={12}
                placeholder="12-digit Aadhaar number"
              />
            </div>

            {/* CHANGE / RESET PASSWORD SECTION */}
            <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px', gridColumn: '1 / -1' }}>
              <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#1E1B4B', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <KeyRound size={16} style={{ color: '#D97706' }} /> Change / Reset Password
              </h4>
              <p style={{ fontSize: '12px', color: '#64748B', margin: 0 }}>
                Enter a new password to update student login credentials. Existing password is encrypted and will never be displayed.
              </p>
              <input
                type="text"
                className="form-input"
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
                placeholder="Leave blank to keep existing password"
              />
            </div>
          </div>

          {/* DATES & SHIFT HOURS */}
          <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#4F46E5', margin: 0 }}>Membership Shift Timing & Availability Dates</h4>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">From Date</label>
                <input
                  type="date"
                  className="form-input"
                  value={editFromDate}
                  onChange={(e) => {
                    const newF = e.target.value;
                    setEditFromDate(newF);
                    fetchEditAmenities(newF, editToDate, editFromTime, editToTime);
                  }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">To Date</label>
                <input
                  type="date"
                  className="form-input"
                  value={editToDate}
                  onChange={(e) => {
                    const newT = e.target.value;
                    setEditToDate(newT);
                    fetchEditAmenities(editFromDate, newT, editFromTime, editToTime);
                  }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">From Time</label>
                <select
                  className="form-select"
                  value={editFromTime}
                  onChange={(e) => {
                    const newF = e.target.value;
                    setEditFromTime(newF);
                    const fNum = parseTimeToHourNum(newF);
                    const tNum = parseTimeToHourNum(editToTime);
                    let targetTo = editToTime;
                    if (tNum <= fNum) {
                      const validTo = getValidToTimeSlots(newF);
                      if (validTo.length > 0) targetTo = validTo[0].value;
                      setEditToTime(targetTo);
                    }
                    fetchEditAmenities(editFromDate, editToDate, newF, targetTo);
                  }}
                >
                  {HOURLY_TIME_SLOTS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">To Time</label>
                <select
                  className="form-select"
                  value={editToTime}
                  onChange={(e) => {
                    const newT = e.target.value;
                    setEditToTime(newT);
                    fetchEditAmenities(editFromDate, editToDate, editFromTime, newT);
                  }}
                >
                  {getValidToTimeSlots(editFromTime).map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* EXTENSION PRICING PREVIEW CARD IN EDIT PROFILE */}
            {editExtensionDuration.totalMonthFactor > 0 && (
              <div style={{ backgroundColor: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: '10px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px', marginTop: '4px' }}>
                <div style={{ fontWeight: 700, color: '#4338CA', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Calculator size={16} /> Extension Fee Preview (Extension Period Only)
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#374151' }}>
                  <span>Current Expiry (Saved To Date):</span>
                  <strong>{formatDisplayDate(currentSavedToDate)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#374151' }}>
                  <span>New Expiry Date:</span>
                  <strong style={{ color: '#4F46E5' }}>{formatDisplayDate(editToDate)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B' }}>
                  <span>Extension Duration:</span>
                  <strong style={{ color: '#1E40AF' }}>{editExtensionDuration.durationLabel}</strong>
                </div>
                <div style={{ borderTop: '1px dashed #A5B4FC', paddingTop: '6px', display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
                  <span>Base Library Fee ({editExtensionDuration.durationLabel}):</span>
                  <span>₹{editExtensionPricing.libraryCharge}</span>
                </div>
                {editExtensionPricing.seatCharge > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#059669' }}>
                    <span>Seat Charge:</span>
                    <span>+ ₹{editExtensionPricing.seatCharge}</span>
                  </div>
                )}
                {editExtensionPricing.lockerCharge > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#D97706' }}>
                    <span>Locker Charge:</span>
                    <span>+ ₹{editExtensionPricing.lockerCharge}</span>
                  </div>
                )}
                <div style={{ borderTop: '1px solid #818CF8', paddingTop: '6px', display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontWeight: 800, color: '#312E81' }}>
                  <span>Additional Amount to Charge:</span>
                  <span style={{ color: '#4F46E5' }}>₹{editExtensionPricing.subtotal}</span>
                </div>

                {/* RECORD PAYMENT DECISION FOR LOCAL ADMIN */}
                <div style={{ marginTop: '6px', backgroundColor: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '8px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ fontWeight: 700, color: '#0F172A', fontSize: '13px' }}>
                    💳 Record Payment in Today's Collection?
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748B', lineHeight: '1.3' }}>
                    User might be editing details or extending the plan. Do you want to bill this extension (₹{editExtensionPricing.subtotal}) and add it to Today's Collection?
                  </div>
                  <div style={{ display: 'flex', gap: '16px', marginTop: '4px', flexWrap: 'wrap' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: 700, color: recordExtensionPayment ? '#15803D' : '#475569', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="recordExtensionPayment"
                        checked={recordExtensionPayment === true}
                        onChange={() => setRecordExtensionPayment(true)}
                      />
                      Yes, Bill & Add ₹{editExtensionPricing.subtotal} to Today's Collection
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: 700, color: !recordExtensionPayment ? '#DC2626' : '#475569', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="recordExtensionPayment"
                        checked={recordExtensionPayment === false}
                        onChange={() => setRecordExtensionPayment(false)}
                      />
                      No, Just Update Expiry Date (No Payment Billed)
                    </label>
                  </div>
                </div>

                <div style={{ fontSize: '11.5px', color: '#6366F1', fontStyle: 'italic', marginTop: '2px' }}>
                  * Note: Previous membership period is not re-billed.
                </div>
              </div>
            )}
          </div>

          {/* SEAT SELECTION SECTION */}
          <div style={{ border: '1px solid #E2E8F0', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#059669', margin: 0 }}>Assign / Change Reading Seat</h4>
              {editSelectedSeatId && (
                <button
                  type="button"
                  style={{ padding: '4px 10px', fontSize: '12px', color: '#DC2626', backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '6px', cursor: 'pointer', fontWeight: 700 }}
                  onClick={() => setEditSelectedSeatId(null)}
                >
                  Clear
                </button>
              )}
            </div>

            <SeatGrid
              seats={availableSeatsForEdit}
              selectedSeatId={editSelectedSeatId}
              onSelectSeat={(s) => setEditSelectedSeatId(s._id)}
              onRemoveSeat={() => setEditSelectedSeatId(null)}
              loading={loadingEditAmenities}
            />
          </div>

          {/* LOCKER SELECTION SECTION */}
          {paymentMaster?.featureFlags?.enableLockers !== false && (
            <div style={{ border: '1px solid #E2E8F0', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#D97706', margin: 0 }}>Assign / Change Storage Locker</h4>
                {editSelectedLockerId && (
                  <button
                    type="button"
                    style={{ padding: '4px 10px', fontSize: '12px', color: '#DC2626', backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '6px', cursor: 'pointer', fontWeight: 700 }}
                    onClick={() => setEditSelectedLockerId(null)}
                  >
                    Clear
                  </button>
                )}
              </div>

              <LockerGrid
                lockers={availableLockersForEdit}
                selectedLockerId={editSelectedLockerId}
                onSelectLocker={(l) => setEditSelectedLockerId(l._id)}
                onRemoveLocker={() => setEditSelectedLockerId(null)}
                loading={loadingEditAmenities}
              />
            </div>
          )}

          <div
            style={{
              position: 'sticky',
              bottom: '-24px',
              backgroundColor: '#FFFFFF',
              paddingTop: '12px',
              paddingBottom: '16px',
              marginTop: '12px',
              borderTop: '1px solid #E2E8F0',
              zIndex: 10,
              boxShadow: '0 -4px 12px rgba(0, 0, 0, 0.05)',
              marginLeft: '-24px',
              marginRight: '-24px',
              paddingLeft: '24px',
              paddingRight: '24px',
              borderRadius: '0 0 16px 16px',
            }}
          >
            <button
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: '15px' }}
              onClick={handleSaveStudentEdit}
              disabled={savingEdit}
            >
              {savingEdit ? 'Saving Profile...' : 'Save Profile'}
            </button>
          </div>
        </div>
      </Modal>

      {/* LIGHTBOX FOR PROFILE PHOTO */}
      {lightboxImage && <Lightbox isOpen={!!lightboxImage} imageUrl={lightboxImage} onClose={() => setLightboxImage(null)} />}

      {/* RESET PASSWORD MODAL */}
      <Modal isOpen={passwordModalOpen} onClose={() => setPasswordModalOpen(false)} title={`Reset Password - ${selectedStudent?.fullName || selectedStudent?.userId?.fullName || 'Student'}`}>
        {selectedStudent && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p style={{ fontSize: '13px', color: '#64748B', margin: 0 }}>
              Enter a new password for <strong>{selectedStudent.fullName || selectedStudent.userId?.fullName}</strong>. Existing password is encrypted and will never be displayed.
            </p>

            <div className="form-group">
              <label className="form-label">New Password *</label>
              <input
                type="text"
                className="form-input"
                placeholder="Minimum 4 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setPasswordModalOpen(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleResetPassword}>
                Reset Password
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
