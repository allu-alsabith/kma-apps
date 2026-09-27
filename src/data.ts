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

// Sample Workforce Generator for ANY Company
export const createSampleEmployeesForCompany = (company: Company): Employee[] => {
  const code = (company.code || 'EMP').toUpperCase();
  const cId = company.id;
  const cName = company.supermarketName || company.name || 'Store';
  const emailDomain = (company.code || 'store').toLowerCase();

  return [
    {
      companyId: cId,
      id: `${code}-101`,
      badgeNumber: `BG-${code}-101`,
      name: 'Sarah Jenkins',
      role: 'Senior Checkout Cashier',
      department: 'Cashiers & Front End',
      shiftId: `shift-morning-${cId}`,
      phone: '+91 98765 10101',
      email: `sarah.jenkins@${emailDomain}supermarket.com`,
      pin: '1234',
      avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=256',
      faceRegistered: true,
      faceRegisteredDate: '2026-02-10',
      payBasis: 'DAILY',
      wageRate: 650,
      hourlyRate: 81,
      status: 'PRESENT',
      lastPunch: '08:45 AM',
      allowMobilePunch: true,
    },
    {
      companyId: cId,
      id: `${code}-102`,
      badgeNumber: `BG-${code}-102`,
      name: 'Carlos Ramirez',
      role: 'Master Butcher & Meat Lead',
      department: 'Butchery & Seafood',
      shiftId: `shift-morning-${cId}`,
      phone: '+91 98765 10202',
      email: `carlos.ramirez@${emailDomain}supermarket.com`,
      pin: '2345',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=256',
      faceRegistered: true,
      faceRegisteredDate: '2026-02-11',
      payBasis: 'DAILY',
      wageRate: 750,
      hourlyRate: 94,
      status: 'PRESENT',
      lastPunch: '08:52 AM',
      allowMobilePunch: false,
    },
    {
      companyId: cId,
      id: `${code}-103`,
      badgeNumber: `BG-${code}-103`,
      name: 'Fatima Al-Zahra',
      role: 'Head Baker & Deli Chef',
      department: 'Bakery & Deli',
      shiftId: `shift-morning-${cId}`,
      phone: '+91 98765 10303',
      email: `fatima.al@${emailDomain}supermarket.com`,
      pin: '3456',
      avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=256',
      faceRegistered: true,
      faceRegisteredDate: '2026-02-12',
      payBasis: 'WEEKLY',
      wageRate: 4800,
      hourlyRate: 100,
      status: 'PRESENT',
      lastPunch: '06:02 AM',
      allowMobilePunch: true,
    },
    {
      companyId: cId,
      id: `${code}-104`,
      badgeNumber: `BG-${code}-104`,
      name: 'Priya Patel',
      role: 'Fresh Fruits & Veg Lead',
      department: 'Fresh Produce & Fruits',
      shiftId: `shift-afternoon-${cId}`,
      phone: '+91 98765 10404',
      email: `priya.patel@${emailDomain}supermarket.com`,
      pin: '4567',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=256',
      faceRegistered: true,
      faceRegisteredDate: '2026-02-14',
      payBasis: 'DAILY',
      wageRate: 600,
      hourlyRate: 75,
      status: 'ABSENT',
      allowMobilePunch: true,
    },
    {
      companyId: cId,
      id: `${code}-105`,
      badgeNumber: `BG-${code}-105`,
      name: 'Marcus Vance',
      role: 'Warehouse & Receiving Clerk',
      department: 'Warehouse & Receiving',
      shiftId: `shift-night-${cId}`,
      phone: '+91 98765 10505',
      email: `marcus.vance@${emailDomain}supermarket.com`,
      pin: '5678',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=256',
      faceRegistered: true,
      faceRegisteredDate: '2026-02-15',
      payBasis: 'DAILY',
      wageRate: 700,
      hourlyRate: 88,
      status: 'ABSENT',
      allowMobilePunch: true,
    },
    {
      companyId: cId,
      id: `${code}-106`,
      badgeNumber: `BG-${code}-106`,
      name: 'David Chen',
      role: 'Floor Safety & Loss Prevention Officer',
      department: 'Store Security & Floor Safety',
      shiftId: `shift-afternoon-${cId}`,
      phone: '+91 98765 10606',
      email: `david.chen@${emailDomain}supermarket.com`,
      pin: '6789',
      avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&q=80&w=256',
      faceRegistered: true,
      faceRegisteredDate: '2026-02-16',
      payBasis: 'MONTHLY',
      wageRate: 22000,
      hourlyRate: 110,
      status: 'PRESENT',
      lastPunch: '01:50 PM',
      allowMobilePunch: true,
    },
  ];
};

export const createSampleAttendanceForCompany = (company: Company, emps: Employee[]): AttendanceRecord[] => {
  const today = new Date().toISOString().slice(0, 10);
  const cId = company.id;
  const supName = company.supermarketName || 'Store';

  const presentEmps = emps.filter(e => e.status === 'PRESENT');
  return presentEmps.map((e, idx) => ({
    id: `att-${cId}-${e.id}-${idx}`,
    companyId: cId,
    employeeId: e.id,
    employeeName: e.name,
    department: e.department,
    type: 'IN',
    timestamp: `${today}T08:${40 + idx}:00.000Z`,
    date: today,
    time: e.lastPunch || `08:${40 + idx} AM`,
    device: idx % 2 === 0 ? 'KIOSK_FACE' : 'MOBILE_APP_GPS',
    kioskLocation: idx % 2 === 0 ? `${supName} Main Entrance Gate` : `${supName} Geofenced Mobile Staff`,
    confidenceScore: 0.992,
    status: 'ON_TIME',
    notes: `Biometric verification verified at ${supName}.`,
    snapshotUrl: e.avatar,
  }));
};

export const INITIAL_EMPLOYEES: Employee[] = [];
export const INITIAL_ATTENDANCE_LOGS: AttendanceRecord[] = [];
export const INITIAL_LEAVES: LeaveRequest[] = [];
