export interface ITimeSlot {
  value: string;
  label: string;
  hourNum: number;
}

export const HOURLY_TIME_SLOTS: ITimeSlot[] = [
  { value: '00:00', label: '12:00 AM', hourNum: 0 },
  { value: '01:00', label: '01:00 AM', hourNum: 1 },
  { value: '02:00', label: '02:00 AM', hourNum: 2 },
  { value: '03:00', label: '03:00 AM', hourNum: 3 },
  { value: '04:00', label: '04:00 AM', hourNum: 4 },
  { value: '05:00', label: '05:00 AM', hourNum: 5 },
  { value: '06:00', label: '06:00 AM', hourNum: 6 },
  { value: '07:00', label: '07:00 AM', hourNum: 7 },
  { value: '08:00', label: '08:00 AM', hourNum: 8 },
  { value: '09:00', label: '09:00 AM', hourNum: 9 },
  { value: '10:00', label: '10:00 AM', hourNum: 10 },
  { value: '11:00', label: '11:00 AM', hourNum: 11 },
  { value: '12:00', label: '12:00 PM', hourNum: 12 },
  { value: '13:00', label: '01:00 PM', hourNum: 13 },
  { value: '14:00', label: '02:00 PM', hourNum: 14 },
  { value: '15:00', label: '03:00 PM', hourNum: 15 },
  { value: '16:00', label: '04:00 PM', hourNum: 16 },
  { value: '17:00', label: '05:00 PM', hourNum: 17 },
  { value: '18:00', label: '06:00 PM', hourNum: 18 },
  { value: '19:00', label: '07:00 PM', hourNum: 19 },
  { value: '20:00', label: '08:00 PM', hourNum: 20 },
  { value: '21:00', label: '09:00 PM', hourNum: 21 },
  { value: '22:00', label: '10:00 PM', hourNum: 22 },
  { value: '23:00', label: '11:00 PM', hourNum: 23 },
  { value: '24:00', label: '12:00 Midnight', hourNum: 24 },
];

export function parseTimeToHourNum(tVal?: string): number {
  if (!tVal) return 0;
  const str = tVal.trim().toUpperCase();
  const isPM = str.includes('PM');
  const isAM = str.includes('AM');
  const clean = str.replace(/(AM|PM)/g, '').trim();
  const parts = clean.split(':').map(Number);
  let h = parts[0] || 0;
  if (isPM && h < 12) h += 12;
  if (isAM && h === 12) h = 0;
  return h;
}

export function getTimeSlotLabel(tVal?: string): string {
  if (!tVal) return 'Select Time';
  const found = HOURLY_TIME_SLOTS.find((s) => s.value === tVal);
  if (found) return found.label;
  const hourNum = parseTimeToHourNum(tVal);
  const foundByHour = HOURLY_TIME_SLOTS.find((s) => s.hourNum === hourNum);
  return foundByHour ? foundByHour.label : tVal;
}

export function calculateSlotDurationHours(fromVal: string, toVal: string): number {
  const f = parseTimeToHourNum(fromVal);
  const t = parseTimeToHourNum(toVal);
  const effT = t > f ? t : 24;
  return Math.max(1, effT - f);
}

export function calculateSlotPricing(
  paymentMaster: any,
  hours: number,
  months: number,
  hasSeat: boolean = false,
  hasLocker: boolean = false,
  customSeatPrice?: number,
  customLockerPrice?: number
): {
  libraryCharge: number;
  seatCharge: number;
  lockerCharge: number;
  subtotal: number;
} {
  const effHours = Math.max(1, Math.min(12, hours));
  const idx = effHours - 1;

  const libRates = paymentMaster?.libraryHourlyRates;
  const libRate = Array.isArray(libRates) && libRates.length === 12
    ? libRates[idx]
    : (paymentMaster?.monthlyFee || 1200);

  let seatRate = 0;
  if (hasSeat) {
    const seatRates = paymentMaster?.seatHourlyRates;
    seatRate = Array.isArray(seatRates) && seatRates.length === 12
      ? seatRates[idx]
      : (customSeatPrice || paymentMaster?.seatMonthlyFee || 500);
  }

  let lockerRate = 0;
  if (hasLocker) {
    const lockerRates = paymentMaster?.lockerHourlyRates;
    lockerRate = Array.isArray(lockerRates) && lockerRates.length === 12
      ? lockerRates[idx]
      : (customLockerPrice || paymentMaster?.lockerMonthlyFee || 200);
  }

  const libraryCharge = Math.round(libRate * months);
  const seatCharge = Math.round(seatRate * months);
  const lockerCharge = Math.round(lockerRate * months);
  const subtotal = libraryCharge + seatCharge + lockerCharge;

  return {
    libraryCharge,
    seatCharge,
    lockerCharge,
    subtotal,
  };
}

export function getValidToTimeSlots(fromVal: string): ITimeSlot[] {
  const fromHour = parseTimeToHourNum(fromVal);
  return HOURLY_TIME_SLOTS.filter((slot) => slot.hourNum >= fromHour + 1);
}

export function validateMonths(val: string | number): { isValid: boolean; parsed: number; errorMsg?: string } {
  const str = String(val).trim();
  if (!str) return { isValid: false, parsed: 1, errorMsg: 'Months duration is required.' };
  if (!/^\d+$/.test(str)) {
    return { isValid: false, parsed: 1, errorMsg: 'Months must be a whole number between 1 and 50.' };
  }
  const num = parseInt(str, 10);
  if (num < 1 || num > 50) {
    return { isValid: false, parsed: Math.max(1, Math.min(50, num || 1)), errorMsg: 'Months must be between 1 and 50.' };
  }
  return { isValid: true, parsed: num };
}
