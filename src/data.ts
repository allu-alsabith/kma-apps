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
  address: 'Central Hypermarket Boulevard, Sector 4',
  phone: '+91 98765 43210',
};

export const CITY_COMPANY: Company = {
  id: 'comp-city',
  name: 'City Central Hypermarket Ltd',
  supermarketName: 'City Hyper',
  code: 'CITY',
  password: 'city123',
  adminPin: '1234',
  createdAt: '2026-01-15T00:00:00.000Z',
  adminName: 'City Operations Director',
  address: 'Down Town Plaza, Metro Mall Level 1',
  phone: '+91 98111 22334',
};

export const FRESH_COMPANY: Company = {
  id: 'comp-fresh',
  name: 'FreshMart Organic & Gourmet Store',
  supermarketName: 'FreshMart',
  code: 'FRESH',
  password: 'fresh123',
  adminPin: '1234',
  createdAt: '2026-02-01T00:00:00.000Z',
  adminName: 'FreshMart General Manager',
  address: 'Green Avenue, Organic Food District',
  phone: '+91 98222 33445',
};

export const INITIAL_COMPANIES: Company[] = [
  DEFAULT_COMPANY,
  CITY_COMPANY,
  FRESH_COMPANY,
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

export const ALL_INITIAL_SHIFTS: Shift[] = [
  ...createDefaultShiftsForCompany('comp-kma'),
  ...createDefaultShiftsForCompany('comp-city'),
  ...createDefaultShiftsForCompany('comp-fresh'),
];

export const SHIFTS: Shift[] = ALL_INITIAL_SHIFTS;

export const INITIAL_EMPLOYEES: Employee[] = [];

export const INITIAL_ATTENDANCE_LOGS: AttendanceRecord[] = [];

export const INITIAL_LEAVES: LeaveRequest[] = [];


