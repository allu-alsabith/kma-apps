import { Employee, Shift, AttendanceRecord, LeaveRequest, Company } from './types';

// Zero pre-populated companies - 100% user-configured for real business operations
export const INITIAL_COMPANIES: Company[] = [];
export const DEFAULT_COMPANIES: Company[] = INITIAL_COMPANIES;

// Helper function to generate standard initial shifts when a user creates their company
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

export const ALL_INITIAL_SHIFTS: Shift[] = [];
export const SHIFTS: Shift[] = ALL_INITIAL_SHIFTS;

// Zero pre-populated workforce or attendance - 100% added by user
export const INITIAL_EMPLOYEES: Employee[] = [];
export const INITIAL_ATTENDANCE_LOGS: AttendanceRecord[] = [];
export const INITIAL_LEAVES: LeaveRequest[] = [];
