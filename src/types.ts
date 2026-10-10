export const DEFAULT_DEPARTMENTS: string[] = [
  'Cashiers & Front End',
  'Fresh Produce & Fruits',
  'Butchery & Seafood',
  'Bakery & Deli',
  'Grocery & Packaged Goods',
  'Warehouse & Receiving',
  'Store Security & Floor Safety',
  'Hygiene & Cleaning Operations',
];

export const SUGGESTED_DEPARTMENTS: string[] = [
  'Cashiers & Front End',
  'Fresh Produce & Fruits',
  'Butchery & Seafood',
  'Bakery & Deli',
  'Grocery & Packaged Goods',
  'Warehouse & Receiving',
  'Store Security & Floor Safety',
  'Hygiene & Cleaning Operations',
  'Dairy & Frozen Foods',
  'Customer Service & Billing',
  'Inventory & Stock Control',
  'Online Orders & Dispatch',
];

export type Department = string;

export type ShiftId = string;

export interface Shift {
  id: ShiftId;
  companyId?: string;
  name: string;
  code: string;
  startTime: string; // "06:00"
  endTime: string;   // "15:00"
  color: string;
  badge: string;
  gracePeriodMins: number;
}

export type PunchType = 'IN' | 'OUT' | 'BREAK_START' | 'BREAK_END';

export type PayBasis = 'DAILY' | 'WEEKLY' | 'MONTHLY';

export interface Company {
  id: string; // Unique ID, e.g. "comp-172666..."
  name: string; // Full company name e.g. "Metro Supermarkets Pvt Ltd"
  supermarketName: string; // Supermarket brand name e.g. "Metro Mart"
  code: string; // Short code e.g. "METRO"
  password: string; // Company password created by owner
  adminPin?: string; // 4-digit PIN for manager portal
  createdAt: string;
  adminName?: string;
  address?: string;
  phone?: string;
  email?: string;
  contactEmail?: string;
  contactPhone?: string;
  isActive?: boolean;
  departments?: string[]; // Configured department floor coverage for this company
}

export interface Employee {
  id: string; // e.g. "EMP-1042"
  companyId?: string; // Multi-tenant company scoping
  name: string;
  role: string;
  department: Department;
  shiftId: ShiftId;
  shiftStartTime?: string; // e.g. "09:00 AM"
  shiftEndTime?: string;   // e.g. "05:00 PM"
  phone: string;
  email: string;
  pin: string; // 4-digit PIN for backup kiosk punch
  avatar: string;
  faceRegistered: boolean;
  faceRegisteredDate?: string;
  hourlyRate: number; // for backward compatibility or hourly calculations
  payBasis: PayBasis; // 'DAILY' (Daily Wage) | 'WEEKLY' (Weekly Wage) | 'MONTHLY' (Monthly Salary)
  wageRate: number;   // Amount in Indian Rupees (₹)
  allowMobilePunch?: boolean; // When true, staff can clock in via Staff App; when false, must use Entrance Face Kiosk
  badgeNumber: string;
  status?: 'PRESENT' | 'ABSENT' | 'ON_LEAVE';
  lastPunch?: string;
}

export interface AttendanceRecord {
  id: string;
  companyId?: string;
  employeeId: string;
  employeeName: string;
  department: Department;
  timestamp: string; // ISO string
  date: string; // YYYY-MM-DD
  time: string; // HH:MM:SS
  type: PunchType;
  device: 'KIOSK_FACE' | 'KIOSK_PIN' | 'KIOSK_QR' | 'MOBILE_APP_GPS';
  kioskLocation: string;
  confidenceScore?: number; // 0.0 - 1.0 (e.g. 0.98)
  snapshotUrl?: string; // photo proof captured during scan
  status: 'ON_TIME' | 'LATE' | 'OVERTIME' | 'EARLY_DEPARTURE' | 'NORMAL';
  notes?: string;
}

export interface LeaveRequest {
  id: string;
  companyId?: string;
  employeeId: string;
  employeeName: string;
  department: Department;
  type: 'CASUAL' | 'SICK' | 'EMERGENCY' | 'ANNUAL';
  startDate: string;
  endDate: string;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  requestedAt: string;
}

export type NotificationType = 'LEAVE_STATUS' | 'SHIFT_UPDATE' | 'SYSTEM' | 'SECURITY_ALERT';

export interface StaffNotification {
  id: string;
  companyId?: string;
  employeeId: string; // Target employeeId or 'ALL' or 'ADMIN'
  employeeName?: string;
  title: string;
  message: string;
  type: NotificationType;
  timestamp: string; // ISO string
  timeFormatted?: string; // e.g. "09:30 AM"
  read: boolean;
  leaveStatus?: 'APPROVED' | 'REJECTED';
  photoUrl?: string; // Captured photo of unrecognized face or security incident
  meta?: {
    leaveId?: string;
    shiftId?: string;
    shiftName?: string;
    oldTimings?: string;
    newTimings?: string;
    capturedPhoto?: string;
    kioskLocation?: string;
    alertType?: 'UNRECOGNIZED_FACE' | 'NO_FACE' | 'SPOOF_ATTEMPT';
  };
}

export type AppPortal = 'ADMIN_PORTAL' | 'KIOSK_FACE' | 'EMPLOYEE_APP' | 'APPS_MANAGER';

export type HelpRequestIssueType = 
  | 'CANNOT_LOGIN' 
  | 'FACE_SCAN_FAIL' 
  | 'PIN_PASSWORD_RESET' 
  | 'TERMINAL_PAIRING' 
  | 'ACCOUNT_LOCKED' 
  | 'OTHER';

export interface HelpRequest {
  id: string;
  appName: string; // e.g. "Store Admin Console", "Staff Mobile App", "Entrance Face Kiosk"
  companyId?: string;
  companyName?: string;
  companyCode?: string;
  userName?: string;
  contactInfo?: string;
  issueType: HelpRequestIssueType;
  message: string;
  status: 'PENDING' | 'RESOLVED';
  createdAt: string; // ISO string
}

export interface AppToggles {
  adminPayrollEnabled: boolean;
  adminLiveSplitEnabled: boolean;
  kioskStrictBiometrics: boolean;
  kioskAudioFeedback: boolean;
  kioskBackupPin: boolean;
  allowMobileGeoPunch: boolean;
  allowStaffLeaves: boolean;
  staffShiftAlerts: boolean;
  managerSelfRegisterEnabled: boolean;
  managerPinRequired: boolean;
  managerCloudSyncAuditEnabled: boolean;
}

export const DEFAULT_APP_TOGGLES: AppToggles = {
  adminPayrollEnabled: true,
  adminLiveSplitEnabled: true,
  kioskStrictBiometrics: true,
  kioskAudioFeedback: true,
  kioskBackupPin: true,
  allowMobileGeoPunch: true,
  allowStaffLeaves: true,
  staffShiftAlerts: true,
  managerSelfRegisterEnabled: true,
  managerPinRequired: true,
  managerCloudSyncAuditEnabled: true,
};
