import React, { useState, useEffect } from 'react';
import { Lock, CheckCircle2, KeyRound, Wrench, Layers, Loader2 } from 'lucide-react';
import { sortItemsNaturally } from '../../utils/sorting';

export interface ILocker {
  _id: string;
  lockerNumber: string;
  floor: number;
  status: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'MAINTENANCE' | string;
  priceMonthly?: number;
  isAvailableInSlot?: boolean;
  assignedStudent?: any;
}

interface LockerGridProps {
  lockers: ILocker[];
  selectedLockerId?: string | null;
  onSelectLocker?: (locker: ILocker) => void;
  onRemoveLocker?: () => void;
  showDetailsOnHover?: boolean;
  loading?: boolean;
}

export const LockerGrid: React.FC<LockerGridProps> = ({
  lockers,
  selectedLockerId,
  onSelectLocker,
  showDetailsOnHover = true,
  loading = false,
}) => {
  const floorsMap: Record<number, ILocker[]> = {};
  lockers.forEach((locker) => {
    const f = locker.floor || 1;
    if (!floorsMap[f]) floorsMap[f] = [];
    floorsMap[f].push(locker);
  });

  const sortedFloors = Object.keys(floorsMap)
    .map(Number)
    .sort((a, b) => a - b);

  const [activeFloor, setActiveFloor] = useState<number>(sortedFloors[0] || 1);

  useEffect(() => {
    if (sortedFloors.length > 0 && !sortedFloors.includes(activeFloor)) {
      setActiveFloor(sortedFloors[0]);
    }
  }, [sortedFloors, activeFloor]);

  // If a locker is selected, automatically switch tab to that locker's floor
  useEffect(() => {
    if (selectedLockerId) {
      const selected = lockers.find((l) => l._id === selectedLockerId);
      if (selected && selected.floor && selected.floor !== activeFloor) {
        setActiveFloor(selected.floor);
      }
    }
  }, [selectedLockerId, lockers]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '32px', color: '#64748B', backgroundColor: '#F8FAFC', borderRadius: '12px', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
        <Loader2 className="animate-spin" size={18} /> Refreshing available lockers for selected date & shift time...
      </div>
    );
  }

  if (lockers.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '32px', color: '#64748B', backgroundColor: '#F8FAFC', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
        No lockers available for the selected dates and shift hours.
      </div>
    );
  }

  const currentFloorLockers = sortItemsNaturally(floorsMap[activeFloor] || [], (l) => l.lockerNumber);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        {sortedFloors.length > 1 && (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#475569', display: 'flex', alignItems: 'center', gap: '6px', marginRight: '4px' }}>
              <Layers size={16} /> Select Floor:
            </span>
            {sortedFloors.map((fl) => {
              const isActive = fl === activeFloor;
              const count = floorsMap[fl]?.length || 0;
              return (
                <button
                  key={fl}
                  type="button"
                  onClick={() => setActiveFloor(fl)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '20px',
                    border: isActive ? '1.5px solid #D97706' : '1px solid #CBD5E1',
                    backgroundColor: isActive ? '#FEF3C7' : '#FFFFFF',
                    color: isActive ? '#D97706' : '#64748B',
                    fontWeight: isActive ? 700 : 500,
                    fontSize: '13px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  Floor {fl} ({count})
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ backgroundColor: '#F8FAFC', padding: '16px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
        <h4 style={{ fontSize: '14px', color: '#475569', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
          🔑 Floor {activeFloor} ({currentFloorLockers.length} Lockers)
        </h4>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '12px' }}>
          {currentFloorLockers.map((locker) => {
            const isSelected = selectedLockerId === locker._id;
            const isAvailable = locker.status === 'AVAILABLE' && (locker.isAvailableInSlot !== false);

            let bg = '#FFFFFF';
            let borderColor = '#CBD5E1';
            let textColor = '#0F172A';
            let icon = <Lock size={18} />;

            if (isSelected) {
              bg = '#FEF3C7';
              borderColor = '#D97706';
              textColor = '#B45309';
            } else if (isAvailable) {
              bg = '#ECFDF5';
              borderColor = '#10B981';
              textColor = '#047857';
              icon = <CheckCircle2 size={18} />;
            } else if (locker.status === 'OCCUPIED' || locker.status === 'RESERVED') {
              bg = '#FEF2F2';
              borderColor = '#FCA5A5';
              textColor = '#B91C1C';
              icon = <KeyRound size={18} />;
            } else if (locker.status === 'MAINTENANCE') {
              bg = '#F1F5F9';
              borderColor = '#94A3B8';
              textColor = '#64748B';
              icon = <Wrench size={18} />;
            }

            return (
              <button
                key={locker._id}
                type="button"
                onClick={() => isAvailable && onSelectLocker && onSelectLocker(locker)}
                disabled={!isAvailable && !onSelectLocker}
                title={
                  showDetailsOnHover
                    ? `${locker.lockerNumber} (${locker.status})`
                    : locker.lockerNumber
                }
                style={{
                  backgroundColor: bg,
                  border: `1.5px solid ${borderColor}`,
                  borderRadius: '10px',
                  padding: '12px 8px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '4px',
                  cursor: isAvailable || onSelectLocker ? 'pointer' : 'default',
                  transition: 'transform 0.15s ease',
                  opacity: isAvailable || isSelected ? 1 : 0.7,
                }}
              >
                <div style={{ color: textColor }}>{icon}</div>
                <span style={{ fontSize: '14px', fontWeight: 700, color: textColor }}>
                  {locker.lockerNumber}
                </span>
                {locker.priceMonthly ? (
                  <span style={{ fontSize: '10px', color: '#64748B' }}>₹{locker.priceMonthly}/mo</span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
