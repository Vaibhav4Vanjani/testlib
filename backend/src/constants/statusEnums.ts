export enum LibraryStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
  HOLIDAY = 'HOLIDAY',
  SPECIAL_NOTICE = 'SPECIAL_NOTICE',
}

export enum MembershipStatus {
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  PENDING_PAYMENT = 'PENDING_PAYMENT',
  SUSPENDED = 'SUSPENDED',
  INACTIVE = 'INACTIVE',
}

export enum SeatStatus {
  AVAILABLE = 'AVAILABLE',
  RESERVED = 'RESERVED',
  OCCUPIED = 'OCCUPIED',
  BLOCKED = 'BLOCKED',
}

export enum LockerStatus {
  AVAILABLE = 'AVAILABLE',
  RESERVED = 'RESERVED',
  OCCUPIED = 'OCCUPIED',
  BLOCKED = 'BLOCKED',
}

export enum AttendanceStatus {
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  AUTO_CHECKOUT = 'AUTO_CHECKOUT',
}

export enum PaymentType {
  FEES = 'FEES',
  SEAT = 'SEAT',
  LOCKER = 'LOCKER',
  COMBINED = 'COMBINED',
}

export enum PaymentMethod {
  ONLINE_GATEWAY = 'ONLINE_GATEWAY',
  MANUAL_QR = 'MANUAL_QR',
  CASH = 'CASH',
  UPI = 'UPI',
  CARD = 'CARD',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

export enum ComplaintStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED',
}
