const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatDisplayDate(dateStr?: string | Date): string {
  if (!dateStr) return 'N/A';
  if (typeof dateStr === 'string') {
    const clean = dateStr.split('T')[0];
    const parts = clean.split('-').map((p) => parseInt(p, 10));
    if (parts.length === 3 && !parts.some(isNaN)) {
      const year = parts[0];
      const monthIdx = parts[1] - 1;
      const day = parts[2];
      if (MONTH_NAMES[monthIdx]) {
        return `${String(day).padStart(2, '0')} ${MONTH_NAMES[monthIdx].slice(0, 3)} ${year}`;
      }
    }
  }
  const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  if (isNaN(d.getTime())) return String(dateStr);
  return `${d.getDate()} ${MONTH_NAMES[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;
}

export function addMonths(dateInput: Date | string, months: number): Date {
  let year: number;
  let month: number;
  let day: number;

  if (typeof dateInput === 'string') {
    const cleanStr = dateInput.split('T')[0];
    const parts = cleanStr.split('-').map((p) => parseInt(p, 10));
    if (parts.length === 3 && !parts.some(isNaN)) {
      year = parts[0];
      month = parts[1] - 1;
      day = parts[2];
    } else {
      const d = new Date(dateInput);
      year = d.getFullYear();
      month = d.getMonth();
      day = d.getDate();
    }
  } else {
    year = dateInput.getFullYear();
    month = dateInput.getMonth();
    day = dateInput.getDate();
  }

  const numMonths = Math.max(1, Math.min(50, months || 1));
  const targetMonthIndex = month + numMonths;
  const targetYear = year + Math.floor(targetMonthIndex / 12);
  const normalizedMonth = ((targetMonthIndex % 12) + 12) % 12;

  const maxDaysInTargetMonth = new Date(targetYear, normalizedMonth + 1, 0).getDate();
  const targetDay = Math.min(day, maxDaysInTargetMonth);

  return new Date(targetYear, normalizedMonth, targetDay);
}

export function calculateExactMonthsAndDays(fromDateInput: string | Date, toDateInput: string | Date): { months: number; days: number; totalMonthFactor: number; durationLabel: string } {
  const parseCleanDate = (input: string | Date) => {
    if (typeof input === 'string') {
      const clean = input.split('T')[0];
      const parts = clean.split('-').map((p) => parseInt(p, 10));
      if (parts.length === 3 && !parts.some(isNaN)) {
        return new Date(parts[0], parts[1] - 1, parts[2]);
      }
    }
    return new Date(input);
  };

  const d1 = parseCleanDate(fromDateInput);
  const d2 = parseCleanDate(toDateInput);
  if (isNaN(d1.getTime()) || isNaN(d2.getTime()) || d2 <= d1) {
    return { months: 0, days: 0, totalMonthFactor: 0, durationLabel: '0 Month(s)' };
  }

  let fullMonths = 0;
  while (true) {
    const nextTarget = addMonths(d1, fullMonths + 1);
    if (nextTarget <= d2) {
      fullMonths++;
    } else {
      break;
    }
  }

  const cursor = fullMonths > 0 ? addMonths(d1, fullMonths) : d1;
  const diffTime = d2.getTime() - cursor.getTime();
  const extraDays = Math.max(0, Math.round(diffTime / (1000 * 60 * 60 * 24)));

  const totalMonthFactor = fullMonths + (extraDays / 30);

  let durationLabel = '';
  if (fullMonths > 0 && extraDays > 0) {
    durationLabel = `${fullMonths} Month(s), ${extraDays} Day(s)`;
  } else if (fullMonths > 0) {
    durationLabel = `${fullMonths} Month(s)`;
  } else {
    durationLabel = `${extraDays} Day(s)`;
  }

  return { months: fullMonths, days: extraDays, totalMonthFactor, durationLabel };
}

export function calculateMonthsBetween(fromDateInput: string | Date, toDateInput: string | Date): number {
  const { months, days } = calculateExactMonthsAndDays(fromDateInput, toDateInput);
  if (months === 0 && days > 0) return 1;
  return months + (days > 15 ? 1 : 0);
}

export function formatDateTime(dateStr?: string | Date): string {
  if (!dateStr) return 'N/A';
  const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  if (isNaN(d.getTime())) return String(dateStr);
  return `${formatDisplayDate(d)}, ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

export function formatSingleTime(timeStr?: string): string {
  if (!timeStr || typeof timeStr !== 'string') return '';
  const trimmed = timeStr.trim();
  if (!trimmed) return '';

  // If already formatted with AM/PM
  if (/[a-zA-Z]/.test(trimmed)) {
    return trimmed;
  }

  // Match HH:MM or HH:MM:SS
  const match = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (match) {
    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);

    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    if (hours === 0) hours = 12;

    if (minutes === 0) {
      return `${hours} ${ampm}`;
    }
    const minStr = String(minutes).padStart(2, '0');
    return `${hours}:${minStr} ${ampm}`;
  }

  return trimmed;
}

export function formatShiftTiming(fromTime?: string, toTime?: string): string {
  if (!fromTime || !toTime) return 'Full Day';
  const formattedFrom = formatSingleTime(fromTime);
  const formattedTo = formatSingleTime(toTime);
  if (formattedFrom && formattedTo) {
    return `${formattedFrom} - ${formattedTo}`;
  }
  return 'Full Day';
}
