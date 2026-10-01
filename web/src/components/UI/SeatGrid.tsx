import React, { useState, useEffect } from 'react';
import { Armchair, CheckCircle2, UserCheck, Wrench, Layers, Loader2 } from 'lucide-react';
import { sortItemsNaturally } from '../../utils/sorting';

export interface ISeat {
  _id: string;
  seatNumber: string;
  floor: number;
  status: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'MAINTENANCE' | string;
  priceMonthly?: number;
  isAvailableInSlot?: boolean;
  occupantName?: string;
  assignedStudent?: any;
}

interface SeatGridProps {
  seats: ISeat[];
  selectedSeatId?: string | null;
  onSelectSeat?: (seat: ISeat) => void;
  onRemoveSeat?: () => void;
  showDetailsOnHover?: boolean;
  loading?: boolean;
}

export const SeatGrid: React.FC<SeatGridProps> = ({
  seats,
  selectedSeatId,
  onSelectSeat,
  showDetailsOnHover = true,
  loading = false,
}) => {
  const floorsMap: Record<number, ISeat[]> = {};
  seats.forEach((seat) => {
    const f = seat.floor || 1;
    if (!floorsMap[f]) floorsMap[f] = [];
    floorsMap[f].push(seat);
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

  // If a seat is selected, automatically switch tab to that seat's floor
  useEffect(() => {
    if (selectedSeatId) {
      const selected = seats.find((s) => s._id === selectedSeatId);
      if (selected && selected.floor && selected.floor !== activeFloor) {
        setActiveFloor(selected.floor);
      }
    }
  }, [selectedSeatId, seats]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '32px', color: '#64748B', backgroundColor: '#F8FAFC', borderRadius: '12px', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
        <Loader2 className="animate-spin" size={18} /> Refreshing available seats for selected date & shift time...
      </div>
    );
  }

  if (seats.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '32px', color: '#64748B', backgroundColor: '#F8FAFC', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
        No seats available for the selected dates and shift hours.
      </div>
    );
  }

  const currentFloorSeats = sortItemsNaturally(floorsMap[activeFloor] || [], (s) => s.seatNumber);

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
                    border: isActive ? '1.5px solid #4F46E5' : '1px solid #CBD5E1',
                    backgroundColor: isActive ? '#EEF2FF' : '#FFFFFF',
                    color: isActive ? '#4F46E5' : '#64748B',
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
          🏢 Floor {activeFloor} ({currentFloorSeats.length} Seats)
        </h4>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '12px' }}>
          {currentFloorSeats.map((seat) => {
            const isSelected = selectedSeatId === seat._id;
            const isAvailable = seat.status === 'AVAILABLE' && (seat.isAvailableInSlot !== false);

            let bg = '#FFFFFF';
            let borderColor = '#CBD5E1';
            let textColor = '#0F172A';
            let icon = <Armchair size={18} />;

            if (isSelected) {
              bg = '#EEF2FF';
              borderColor = '#4F46E5';
              textColor = '#4338CA';
            } else if (isAvailable) {
              bg = '#ECFDF5';
              borderColor = '#10B981';
              textColor = '#047857';
              icon = <CheckCircle2 size={18} />;
            } else if (seat.status === 'OCCUPIED' || seat.status === 'RESERVED') {
              bg = '#FEF2F2';
              borderColor = '#FCA5A5';
              textColor = '#B91C1C';
              icon = <UserCheck size={18} />;
            } else if (seat.status === 'MAINTENANCE') {
              bg = '#F1F5F9';
              borderColor = '#94A3B8';
              textColor = '#64748B';
              icon = <Wrench size={18} />;
            }

            return (
              <button
                key={seat._id}
                type="button"
                onClick={() => isAvailable && onSelectSeat && onSelectSeat(seat)}
                disabled={!isAvailable && !onSelectSeat}
                title={
                  showDetailsOnHover
                    ? `${seat.seatNumber} (${seat.status}) ${seat.assignedStudent?.fullName ? `- ${seat.assignedStudent.fullName}` : ''}`
                    : seat.seatNumber
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
                  cursor: isAvailable || onSelectSeat ? 'pointer' : 'default',
                  transition: 'transform 0.15s ease',
                  opacity: isAvailable || isSelected ? 1 : 0.7,
                }}
              >
                <div style={{ color: textColor }}>{icon}</div>
                <span style={{ fontSize: '14px', fontWeight: 700, color: textColor }}>
                  {seat.seatNumber}
                </span>
                {seat.priceMonthly ? (
                  <span style={{ fontSize: '10px', color: '#64748B' }}>₹{seat.priceMonthly}/mo</span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
