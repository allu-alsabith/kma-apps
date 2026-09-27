import { Employee, Shift, AttendanceRecord, LeaveRequest, Company } from './types';

export const DEFAULT_COMPANY: Company = {
  id: 'comp-kma',
  name: 'KMA Supermarket',
  supermarketName: 'KMA',
  code: 'KMA',
  password: 'kma', // Also supports 'kma123'
  adminPin: '1234',
  createdAt: '2026-01-01T00:00:00.000Z',
  adminName: 'Store Administrator',
  address: 'Central Hypermarket Boulevard',
  phone: '+91 98765 43210',
};

export const INITIAL_COMPANIES: Company[] = [
  DEFAULT_COMPANY,
];
export const DEFAULT_COMPANIES: Company[] = INITIAL_COMPANIES;

export const createDefaultShiftsForCompany = (companyId: string): Shift[] => [
  {
    id: `shift-morning-${companyId}`,
    companyId,
    name: 'Morning Opening Shift',
    code: 'SH-AM',
    startTime: '06:00',
    endTime: '15:00',
    color: 'emerald',
    badge: '06:00 AM - 03:00 PM',
    gracePeriodMins: 15,
  },
  {
    id: `shift-afternoon-${companyId}`,
    companyId,
    name: 'Peak Afternoon & Evening',
    code: 'SH-PM',
    startTime: '14:00',
    endTime: '23:00',
    color: 'sky',
    badge: '02:00 PM - 11:00 PM',
    gracePeriodMins: 15,
  },
  {
    id: `shift-night-${companyId}`,
    companyId,
    name: 'Night Logistics & Restock',
    code: 'SH-NT',
    startTime: '22:00',
    endTime: '07:00',
    color: 'purple',
    badge: '10:00 PM - 07:00 AM',
    gracePeriodMins: 20,
  },
];

export const SHIFTS: Shift[] = createDefaultShiftsForCompany('comp-kma');

// Real-world production state: Starts clean with 0 employees, 0 logs, 0 leaves
// Store owner enrolls their real hypermarket staff, schedules real shifts, and records real punches
export const INITIAL_EMPLOYEES: Employee[] = [];

export const INITIAL_ATTENDANCE_LOGS: AttendanceRecord[] = [];

export const INITIAL_LEAVES: LeaveRequest[] = [];
