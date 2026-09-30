import React, { useState, useEffect, useMemo } from 'react';
import { AppPortal, Employee, Shift, AttendanceRecord, LeaveRequest, PunchType, StaffNotification, Company, HelpRequest } from './types';
import {
  INITIAL_EMPLOYEES,
  SHIFTS,
  ALL_INITIAL_SHIFTS,
  INITIAL_ATTENDANCE_LOGS,
  INITIAL_LEAVES,
  DEFAULT_COMPANIES,
  createDefaultShiftsForCompany,
} from './data';

// Helper to filter out any legacy or generated mock staff records so user controls all staff data
export const isSampleStaff = (emp: { name?: string; employeeName?: string; id?: string; employeeId?: string }): boolean => {
  if (!emp) return false;
  const name = (emp.name || emp.employeeName || '').trim();
  const id = (emp.id || emp.employeeId || '').trim();
  const sampleNames = [
    'Sarah Jenkins', 'Carlos Ramirez', 'Fatima Al-Zahra', 'Priya Patel', 
    'Marcus Vance', 'David Chen', 'Sarah Connor', 'Ahmed Al-Mansoor', 'Priya Sharma', 'David Kim'
  ];
  if (name && sampleNames.includes(name)) return true;
  if (id && (id.startsWith('KMA-10') || id.startsWith('CITY-10') || id.startsWith('FRESH-10'))) return true;
  return false;
};

// Helper to filter out any legacy pre-seeded mock companies so user starts with a real-life clean company setup
export const isSampleCompany = (c: Partial<Company>): boolean => {
  if (!c) return false;
  const sampleIds = ['comp-kma', 'comp-city', 'comp-fresh'];
  const sampleCodes = ['KMA', 'CITY', 'FRESH'];
  const sampleNames = [
    'KMA Supermarket', 'City Central Hypermarket Ltd', 'FreshMart Organic & Gourmet Store',
    'KMA', 'City Hyper', 'FreshMart', 'Workforce Retail Pvt Ltd'
  ];
  if (c.id && sampleIds.includes(c.id)) return true;
  if (c.code && sampleCodes.includes(c.code.toUpperCase())) return true;
  if (c.name && sampleNames.includes(c.name)) return true;
  if (c.supermarketName && sampleNames.includes(c.supermarketName)) return true;
  return false;
};
import { KioskFace } from './components/KioskFace';
import { EmployeeApp } from './components/EmployeeApp';
import { AdminPortal } from './components/AdminPortal';
import { AppsManager } from './components/AppsManager';
import { InstallModal, AppInstallTarget } from './components/InstallModal';
import { NetworkSyncBadge } from './components/NetworkSyncBadge';
import { offlineSyncService } from './services/offlineSync';
import { autoSyncService } from './services/autoSync';
import { soundService } from './services/sound';
import { get12HTimeString } from './utils/formatters';
import {
  subscribeToEmployees,
  subscribeToAttendanceRecords,
  subscribeToLeaveRequests,
  subscribeToStaffNotifications,
  subscribeToCompanies,
  subscribeToHelpRequests,
  syncEmployeeToFirestore,
  deleteEmployeeFromFirestore,
  clearAllEmployeesInFirestore,
  syncAttendanceRecordToFirestore,
  syncLeaveRequestToFirestore,
  updateLeaveStatusInFirestore,
  deleteLeaveRequestFromFirestore,
  deleteLeaveRequestsByEmployeeInFirestore,
  clearAllLeaveRequestsInFirestore,
  deleteAttendanceByEmployeeInFirestore,
  syncStaffNotificationToFirestore,
  updateNotificationReadInFirestore,
  deleteNotificationFromFirestore,
  syncCompanyToFirestore,
  deleteCompanyFromFirestore,
  syncHelpRequestToFirestore,
  updateHelpRequestStatusInFirestore,
  deleteHelpRequestFromFirestore,
  testFirestoreConnection,
  subscribeToShifts,
  syncShiftToFirestore,
  syncAllDataToFirestore,
} from './services/firebase';

export default function App() {
  // App Portal Mode detection: 'STAFF' (Employee Phone), 'KIOSK' (Door Tablet), 'ADMIN' (Manager HR), 'MANAGER' (Apps Manager)
  const [standaloneMode, setStandaloneMode] = useState<'STAFF' | 'KIOSK' | 'ADMIN' | 'MANAGER'>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const app = (params.get('app') || params.get('portal'))?.toLowerCase();
      if (app === 'employee' || app === 'staff') return 'STAFF';
      if (app === 'kiosk' || app === 'face') return 'KIOSK';
      if (app === 'admin') return 'ADMIN';
      if (app === 'manager' || app === 'apps' || app === 'appsmanager' || app === 'apps_manager') return 'MANAGER';
    }
    return 'MANAGER';
  });

  const [currentPortal, setCurrentPortal] = useState<AppPortal>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const portal = (params.get('app') || params.get('portal'))?.toLowerCase();
      if (portal === 'employee' || portal === 'staff') return 'EMPLOYEE_APP';
      if (portal === 'kiosk' || portal === 'face') return 'KIOSK_FACE';
      if (portal === 'admin') return 'ADMIN_PORTAL';
      if (portal === 'manager' || portal === 'apps' || portal === 'appsmanager' || portal === 'apps_manager') return 'APPS_MANAGER';
    }
    return 'APPS_MANAGER';
  });

  // Handle browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const app = (params.get('app') || params.get('portal'))?.toLowerCase();
      if (app === 'employee' || app === 'staff') {
        setStandaloneMode('STAFF');
        setCurrentPortal('EMPLOYEE_APP');
      } else if (app === 'kiosk' || app === 'face') {
        setStandaloneMode('KIOSK');
        setCurrentPortal('KIOSK_FACE');
      } else if (app === 'admin') {
        setStandaloneMode('ADMIN');
        setCurrentPortal('ADMIN_PORTAL');
      } else {
        setStandaloneMode('MANAGER');
        setCurrentPortal('APPS_MANAGER');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Mobile Installation Modal State & Target Tab
  const [isInstallModalOpen, setIsInstallModalOpen] = useState<boolean>(false);
  const [installModalTarget, setInstallModalTarget] = useState<AppInstallTarget>('STAFF');
  const [isFirebaseLive, setIsFirebaseLive] = useState<boolean>(true);
  const [autoOpenCreateCompany, setAutoOpenCreateCompany] = useState<boolean>(false);

  const openInstallHub = (target: AppInstallTarget = 'STAFF') => {
    setInstallModalTarget(target);
    setIsInstallModalOpen(true);
  };

  // Shared Core Hypermarket Database State - 100% clean initial state so user adds all staff information
  const [employees, setEmployees] = useState<Employee[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('attendo_real_workforce_staff');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const filtered = parsed.filter((e) => !isSampleStaff(e));
            return filtered;
          }
        } catch {
          // fallback to INITIAL_EMPLOYEES
        }
      }
    }
    return INITIAL_EMPLOYEES;
  });

  const [shifts, setShifts] = useState<Shift[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('attendo_hyper_shifts');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
          }
        } catch {
          // ignore
        }
      }
    }
    return ALL_INITIAL_SHIFTS;
  });

  const [notifications, setNotifications] = useState<StaffNotification[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('attendo_staff_notifications');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            return parsed;
          }
        } catch {
          return [];
        }
      }
    }
    return [];
  });

  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceRecord[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('attendo_real_workforce_logs');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const filtered = parsed.filter((l) => !isSampleStaff({ employeeName: l.employeeName, employeeId: l.employeeId }));
            return filtered;
          }
        } catch {
          // fallback to INITIAL_ATTENDANCE_LOGS
        }
      }
    }
    return INITIAL_ATTENDANCE_LOGS;
  });

  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('attendo_real_workforce_leaves');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const filtered = parsed.filter((lr) => !isSampleStaff({ employeeName: lr.employeeName, employeeId: lr.employeeId }));
            return filtered;
          }
        } catch {
          // fallback to INITIAL_LEAVES
        }
      }
    }
    return INITIAL_LEAVES;
  });

  // Multi-Company State (Supports distinct supermarket companies added by the business owner)
  const [companies, setCompanies] = useState<Company[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('attendo_companies');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const real = parsed.filter((c) => !isSampleCompany(c));
            return real;
          }
        } catch {
          // ignore
        }
      }
    }
    return [];
  });

  // Help & Support Requests State (from all apps login screens)
  const [helpRequests, setHelpRequests] = useState<HelpRequest[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('attendo_help_requests');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) return parsed;
        } catch {
          // ignore
        }
      }
    }
    return [];
  });

  const [activeCompanyId, setActiveCompanyId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const urlComp = urlParams.get('company') || urlParams.get('store') || urlParams.get('code');
      const saved = localStorage.getItem('attendo_active_company_id');
      if (saved && !isSampleCompany({ id: saved, code: saved })) {
        return saved;
      }
    }
    return '';
  });

  const activeCompany = useMemo(() => {
    return companies.find((c) => c.id === activeCompanyId) || companies[0] || undefined;
  }, [companies, activeCompanyId]);

  // Scoped Data for Active Company in Admin Portal (Accurately isolated per company)
  const scopedAdminEmployees = useMemo(() => {
    if (!activeCompany) return employees;
    return employees.filter((e) => (e.companyId || activeCompany.id) === activeCompany.id);
  }, [employees, activeCompany]);

  const scopedAdminAttendanceLogs = useMemo(() => {
    if (!activeCompany) return attendanceLogs;
    const empIds = new Set(scopedAdminEmployees.map((e) => e.id));
    return attendanceLogs.filter(
      (l) => (l.companyId ? l.companyId === activeCompany.id : empIds.has(l.employeeId))
    );
  }, [attendanceLogs, activeCompany, scopedAdminEmployees]);

  const scopedAdminLeaveRequests = useMemo(() => {
    if (!activeCompany) return leaveRequests;
    const empIds = new Set(scopedAdminEmployees.map((e) => e.id));
    return leaveRequests.filter(
      (lr) => (lr.companyId ? lr.companyId === activeCompany.id : empIds.has(lr.employeeId))
    );
  }, [leaveRequests, activeCompany, scopedAdminEmployees]);

  const scopedAdminShifts = useMemo(() => {
    if (!activeCompany) return shifts;
    const companyShifts = shifts.filter((s) => s.companyId === activeCompany.id);
    if (companyShifts.length > 0) return companyShifts;
    return createDefaultShiftsForCompany(activeCompany.id);
  }, [shifts, activeCompany]);

  // Ensure default shift templates exist for companies so user can assign shifts when creating staff
  useEffect(() => {
    if (!companies || companies.length === 0) return;
    let hasNewShifts = false;
    let newShiftsList = [...shifts];

    companies.forEach((comp) => {
      const compShifts = newShiftsList.filter((s) => s.companyId === comp.id);
      if (compShifts.length === 0) {
        const generatedShifts = createDefaultShiftsForCompany(comp.id);
        newShiftsList = [...newShiftsList, ...generatedShifts];
        hasNewShifts = true;
        generatedShifts.forEach((s) => offlineSyncService.enqueue('SYNC_SHIFT', s));
      }
    });

    if (hasNewShifts) setShifts(newShiftsList);
  }, [companies, shifts.length]);

  // Real-time Automatic Cross-Tab & Cross-Device Sync Subscription
  useEffect(() => {
    const unsubAutoSync = autoSyncService.subscribe((msg) => {
      switch (msg.type) {
        case 'PUNCH_CREATED': {
          const punch = msg.payload as AttendanceRecord;
          setAttendanceLogs((prev) => [punch, ...prev.filter((p) => p.id !== punch.id)]);
          setEmployees((prev) =>
            prev.map((e) =>
              e.id === punch.employeeId
                ? {
                    ...e,
                    status: punch.type === 'IN' || punch.type === 'BREAK_END' ? 'PRESENT' : 'ABSENT',
                    lastPunch: punch.time,
                  }
                : e
            )
          );
          break;
        }
        case 'EMPLOYEE_ADDED': {
          const emp = msg.payload as Employee;
          setEmployees((prev) => [...prev.filter((e) => e.id !== emp.id), emp]);
          break;
        }
        case 'EMPLOYEE_UPDATED': {
          const emp = msg.payload as Employee;
          setEmployees((prev) => prev.map((e) => (e.id === emp.id ? emp : e)));
          break;
        }
        case 'EMPLOYEE_DELETED': {
          const empId = msg.payload as string;
          setEmployees((prev) => prev.filter((e) => e.id !== empId));
          setAttendanceLogs((prev) => prev.filter((l) => l.employeeId !== empId));
          setLeaveRequests((prev) => prev.filter((lr) => lr.employeeId !== empId));
          break;
        }
        case 'LEAVE_REQUESTED': {
          const req = msg.payload as LeaveRequest;
          setLeaveRequests((prev) => [req, ...prev.filter((l) => l.id !== req.id)]);
          break;
        }
        case 'LEAVE_STATUS_CHANGED': {
          const { id, status } = msg.payload;
          setLeaveRequests((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)));
          break;
        }
        case 'LEAVE_DELETED': {
          const leaveId = msg.payload as string;
          setLeaveRequests((prev) => prev.filter((l) => l.id !== leaveId));
          break;
        }
        case 'COMPANY_ADDED': {
          const company = msg.payload as Company;
          setCompanies((prev) => [...prev.filter((c) => c.id !== company.id), company]);
          break;
        }
        case 'COMPANY_UPDATED': {
          const company = msg.payload as Company;
          setCompanies((prev) => prev.map((c) => (c.id === company.id ? company : c)));
          break;
        }
        case 'COMPANY_DELETED': {
          const companyId = msg.payload as string;
          setCompanies((prev) => prev.filter((c) => c.id !== companyId));
          break;
        }
        case 'SHIFT_UPDATED': {
          const shift = msg.payload as Shift;
          setShifts((prev) => prev.map((s) => (s.id === shift.id ? shift : s)));
          break;
        }
        case 'NOTIFICATION_ADDED': {
          const notif = msg.payload as StaffNotification;
          setNotifications((prev) => [notif, ...prev.filter((n) => n.id !== notif.id)]);
          break;
        }
        case 'NOTIFICATION_READ': {
          const notifId = msg.payload as string;
          setNotifications((prev) => prev.map((n) => (n.id === notifId ? { ...n, read: true } : n)));
          break;
        }
        case 'NOTIFICATION_DELETED': {
          const notifId = msg.payload as string;
          setNotifications((prev) => prev.filter((n) => n.id !== notifId));
          break;
        }
        case 'ACTIVE_COMPANY_CHANGED': {
          const compId = msg.payload as string;
          setActiveCompanyId(compId);
          break;
        }
        case 'HELP_REQUEST_ADDED': {
          const req = msg.payload as HelpRequest;
          setHelpRequests((prev) => [req, ...prev.filter((r) => r.id !== req.id)]);
          break;
        }
        case 'HELP_REQUEST_STATUS': {
          const { id, status } = msg.payload;
          setHelpRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
          break;
        }
        default:
          break;
      }
    });

    return () => unsubAutoSync();
  }, []);

  // Firebase Real-time Synchronization Listeners
  useEffect(() => {
    testFirestoreConnection().then(async (ok) => {
      setIsFirebaseLive(ok);
      if (ok) {
        // Ensure every data entity exists in Firebase Firestore
        await syncAllDataToFirestore({
          companies,
          employees,
          attendanceLogs,
          shifts,
          leaveRequests,
          notifications,
          helpRequests,
        });
      }
    });

    // Listen to remote changes in real-time
    const unsubEmployees = subscribeToEmployees((remoteEmployees) => {
      if (remoteEmployees) {
        // Clean out sample/mock staff so user only sees what they enrolled
        const cleaned = remoteEmployees.filter((e) => !isSampleStaff(e));
        setEmployees(cleaned);
      }
    });

    const unsubAttendance = subscribeToAttendanceRecords((remoteLogs) => {
      if (remoteLogs) {
        const cleaned = remoteLogs.filter(
          (l) => !isSampleStaff({ employeeName: l.employeeName, employeeId: l.employeeId })
        );
        setAttendanceLogs(cleaned);
      }
    });

    const unsubLeaves = subscribeToLeaveRequests((remoteLeaves) => {
      if (remoteLeaves) {
        const cleaned = remoteLeaves.filter(
          (lr) => !isSampleStaff({ employeeName: lr.employeeName, employeeId: lr.employeeId })
        );
        setLeaveRequests(cleaned);
      }
    });

    const unsubNotifications = subscribeToStaffNotifications((remoteNotifs) => {
      if (remoteNotifs && remoteNotifs.length > 0) {
        setNotifications(remoteNotifs);
      }
    });

    const unsubCompanies = subscribeToCompanies((remoteCompanies) => {
      if (remoteCompanies) {
        const real = remoteCompanies.filter((c) => !isSampleCompany(c));
        setCompanies(real);
        if (real.length > 0) {
          setActiveCompanyId((current) => current || real[0].id);
        }
      }
    });

    const unsubShifts = subscribeToShifts((remoteShifts) => {
      if (remoteShifts && remoteShifts.length > 0) {
        setShifts(remoteShifts);
      }
    });

    const unsubHelpRequests = subscribeToHelpRequests((remoteRequests) => {
      if (remoteRequests) {
        setHelpRequests(remoteRequests);
      }
    });

    let prevPending = offlineSyncService.getState().pendingCount;
    const unsubSync = offlineSyncService.subscribe((state) => {
      if (prevPending > 0 && state.pendingCount === 0 && state.isOnline) {
        soundService.playSuccessChime();
      }
      prevPending = state.pendingCount;
    });

    return () => {
      unsubEmployees();
      unsubAttendance();
      unsubLeaves();
      unsubNotifications();
      unsubCompanies();
      unsubShifts();
      unsubHelpRequests();
      unsubSync();
    };
  }, []);

  // Save changes to localStorage for persistent hypermarket production operations (Fast offline-first cache)
  useEffect(() => {
    localStorage.setItem('attendo_real_workforce_staff', JSON.stringify(employees));
    localStorage.setItem('attendo_user_enrolled_staff', JSON.stringify(employees));
  }, [employees]);

  useEffect(() => {
    localStorage.setItem('attendo_real_workforce_logs', JSON.stringify(attendanceLogs));
    localStorage.setItem('attendo_user_logs', JSON.stringify(attendanceLogs));
  }, [attendanceLogs]);

  useEffect(() => {
    localStorage.setItem('attendo_real_workforce_leaves', JSON.stringify(leaveRequests));
    localStorage.setItem('attendo_user_leaves', JSON.stringify(leaveRequests));
  }, [leaveRequests]);

  useEffect(() => {
    localStorage.setItem('attendo_staff_notifications', JSON.stringify(notifications));
  }, [notifications]);

  useEffect(() => {
    localStorage.setItem('attendo_hyper_shifts', JSON.stringify(shifts));
  }, [shifts]);

  useEffect(() => {
    localStorage.setItem('attendo_companies', JSON.stringify(companies));
  }, [companies]);

  useEffect(() => {
    localStorage.setItem('attendo_active_company_id', activeCompanyId);
  }, [activeCompanyId]);

  useEffect(() => {
    localStorage.setItem('attendo_help_requests', JSON.stringify(helpRequests));
  }, [helpRequests]);

  // One-time cleanup: ensure any previously cached mock staff or mock companies are completely removed
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const rawCompanies = localStorage.getItem('attendo_companies');
        if (rawCompanies) {
          const parsed = JSON.parse(rawCompanies);
          if (Array.isArray(parsed)) {
            const realOnly = parsed.filter((c) => !isSampleCompany(c));
            if (realOnly.length !== parsed.length) {
              setCompanies(realOnly);
              localStorage.setItem('attendo_companies', JSON.stringify(realOnly));
              if (realOnly.length > 0) {
                setActiveCompanyId(realOnly[0].id);
              } else {
                setActiveCompanyId('');
                localStorage.removeItem('attendo_active_company_id');
                localStorage.removeItem('attendo_admin_company_id');
                localStorage.removeItem('attendo_admin_session_auth');
              }
            }
          }
        }
        const rawStaff = localStorage.getItem('attendo_real_workforce_staff');
        if (rawStaff) {
          const parsed = JSON.parse(rawStaff);
          if (Array.isArray(parsed)) {
            const realOnly = parsed.filter((e) => !isSampleStaff(e));
            if (realOnly.length !== parsed.length) {
              setEmployees(realOnly);
              localStorage.setItem('attendo_real_workforce_staff', JSON.stringify(realOnly));
              localStorage.setItem('attendo_user_enrolled_staff', JSON.stringify(realOnly));
            }
          }
        }
        const rawLogs = localStorage.getItem('attendo_real_workforce_logs');
        if (rawLogs) {
          const parsed = JSON.parse(rawLogs);
          if (Array.isArray(parsed)) {
            const realLogs = parsed.filter((l) => !isSampleStaff({ employeeName: l.employeeName, employeeId: l.employeeId }));
            if (realLogs.length !== parsed.length) {
              setAttendanceLogs(realLogs);
              localStorage.setItem('attendo_real_workforce_logs', JSON.stringify(realLogs));
              localStorage.setItem('attendo_user_logs', JSON.stringify(realLogs));
            }
          }
        }
        const rawLeaves = localStorage.getItem('attendo_real_workforce_leaves');
        if (rawLeaves) {
          const parsed = JSON.parse(rawLeaves);
          if (Array.isArray(parsed)) {
            const realLeaves = parsed.filter((lr) => !isSampleStaff({ employeeName: lr.employeeName, employeeId: lr.employeeId }));
            if (realLeaves.length !== parsed.length) {
              setLeaveRequests(realLeaves);
              localStorage.setItem('attendo_real_workforce_leaves', JSON.stringify(realLeaves));
              localStorage.setItem('attendo_user_leaves', JSON.stringify(realLeaves));
            }
          }
        }
      } catch {
        // ignore
      }
    }
  }, []);

  // Account Help & Support Request Handlers
  const handleCreateHelpRequest = async (
    requestData: Omit<HelpRequest, 'id' | 'createdAt' | 'status'>
  ) => {
    const newRequest: HelpRequest = {
      ...requestData,
      id: `help-req-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    };
    setHelpRequests((prev) => [newRequest, ...prev]);
    offlineSyncService.enqueue('SYNC_HELP_REQUEST', newRequest);
    soundService.playSuccessChime();
  };

  const handleUpdateHelpRequestStatus = async (
    id: string,
    status: HelpRequest['status']
  ) => {
    setHelpRequests((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status } : r))
    );
    offlineSyncService.enqueue('SYNC_HELP_STATUS', { id, status });
    soundService.playSuccessChime();
  };

  const handleDeleteHelpRequest = async (id: string) => {
    setHelpRequests((prev) => prev.filter((r) => r.id !== id));
    offlineSyncService.enqueue('SYNC_DELETE_HELP_REQUEST', id);
    soundService.playSuccessChime();
  };

  // Company management handlers
  const handleCreateCompany = async (companyData: Omit<Company, 'id' | 'createdAt'>) => {
    const newId = `comp-${Date.now()}`;
    const newCompany: Company = {
      ...companyData,
      id: newId,
      createdAt: new Date().toISOString(),
    };

    // Auto-generate standard shift templates for the new company so shifts can be assigned to staff
    const autoShifts = createDefaultShiftsForCompany(newId);

    setCompanies((prev) => {
      const filtered = prev.filter((c) => c.id !== newId && c.code.toUpperCase() !== newCompany.code.toUpperCase());
      return [...filtered, newCompany];
    });
    setShifts((prev) => [...prev.filter((s) => s.companyId !== newId), ...autoShifts]);

    setActiveCompanyId(newId);

    // Persist company selection
    if (typeof window !== 'undefined') {
      localStorage.setItem('attendo_active_company_id', newId);
      localStorage.setItem('attendo_admin_company_id', newId);
      localStorage.setItem('attendo_staff_company_id', newId);
      localStorage.setItem('attendo_staff_company_name', newCompany.supermarketName);
      localStorage.setItem('attendo_kiosk_company_id', newId);
    }

    offlineSyncService.enqueue('SYNC_COMPANY', newCompany);
    autoShifts.forEach((s) => offlineSyncService.enqueue('SYNC_SHIFT', s));

    // Broadcast newly created company and shift schedules to all open tabs/windows
    autoSyncService.broadcast('COMPANY_ADDED', newCompany);
    autoShifts.forEach((s) => autoSyncService.broadcast('SHIFT_UPDATED', s));
    autoSyncService.broadcast('ACTIVE_COMPANY_CHANGED', newId);

    return newCompany;
  };

  const handleUpdateCompany = async (updated: Company) => {
    setCompanies((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    offlineSyncService.enqueue('SYNC_COMPANY', updated);
    autoSyncService.broadcast('COMPANY_UPDATED', updated);
  };

  const handleDeleteCompany = async (companyId: string) => {
    const remaining = companies.filter((c) => c.id !== companyId);
    setCompanies(remaining);
    if (activeCompanyId === companyId) {
      const nextId = remaining.length > 0 ? remaining[0].id : '';
      setActiveCompanyId(nextId);
      if (typeof window !== 'undefined') {
        if (nextId) {
          localStorage.setItem('attendo_active_company_id', nextId);
        } else {
          localStorage.removeItem('attendo_active_company_id');
          localStorage.removeItem('attendo_admin_session_auth');
          localStorage.removeItem('attendo_admin_company_id');
        }
      }
      if (nextId) autoSyncService.broadcast('ACTIVE_COMPANY_CHANGED', nextId);
    }
    offlineSyncService.enqueue('SYNC_DELETE_COMPANY', companyId);
    autoSyncService.broadcast('COMPANY_DELETED', companyId);
  };

  // Handle new punch coming from ANY device (Kiosk or Mobile or Admin) with Optimistic 0ms UI update
  const handleNewPunch = (
    punchData: Omit<AttendanceRecord, 'id' | 'timestamp' | 'date' | 'time'>
  ) => {
    const now = new Date();
    const emp = employees.find((e) => e.id === punchData.employeeId);
    const companyId = punchData.companyId || emp?.companyId || activeCompany?.id || activeCompanyId;

    const newRecord: AttendanceRecord = {
      ...punchData,
      companyId,
      id: `att-log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: now.toISOString(),
      date: now.toISOString().slice(0, 10),
      time: get12HTimeString(now, true),
    };

    // Instant local UI response
    setAttendanceLogs((prev) => [newRecord, ...prev]);

    // Asynchronously write to Firestore or queue if offline
    offlineSyncService.enqueue('SYNC_PUNCH', newRecord);

    // Cross-tab real-time auto sync
    autoSyncService.broadcast('PUNCH_CREATED', newRecord);

    // Update employee status & last punch
    setEmployees((prev) =>
      prev.map((emp) => {
        if (emp.id === punchData.employeeId) {
          const updated: Employee = {
            ...emp,
            lastPunch: newRecord.time,
            status: punchData.type === 'IN' ? 'PRESENT' : 'ABSENT',
          };
          offlineSyncService.enqueue('SYNC_EMPLOYEE', updated);
          return updated;
        }
        return emp;
      })
    );
  };

  // Staff mobile GPS & Biometric Face punch handler
  const handleMobileGeoPunch = (
    employee: Employee,
    punchType: PunchType = 'IN',
    snapshotUrl?: string
  ) => {
    handleNewPunch({
      companyId: employee.companyId || activeCompany?.id,
      employeeId: employee.id,
      employeeName: employee.name,
      department: employee.department,
      type: punchType,
      device: 'MOBILE_APP_GPS',
      kioskLocation: 'Mobile Staff App (Store Geofence Aisle 4)',
      confidenceScore: 0.998,
      snapshotUrl: snapshotUrl || employee.avatar,
      status: 'ON_TIME',
      notes: `Biometric face scan verified on mobile device (${punchType === 'IN' ? 'Clock In' : 'Clock Out'}). Store geofence confirmed.`,
    });
  };

  // Admin add new employee with fast optimistic update & Firestore sync
  const handleAddEmployee = (newEmp: Employee) => {
    const enrichedEmp: Employee = {
      ...newEmp,
      companyId: newEmp.companyId || activeCompany?.id || activeCompanyId,
    };
    setEmployees((prev) => [enrichedEmp, ...prev]);
    offlineSyncService.enqueue('SYNC_EMPLOYEE', enrichedEmp);
    autoSyncService.broadcast('EMPLOYEE_ADDED', enrichedEmp);
  };

  // Admin update existing employee
  const handleUpdateEmployee = (updatedEmp: Employee) => {
    const oldEmp = employees.find((e) => e.id === updatedEmp.id);
    const enrichedEmp: Employee = {
      ...updatedEmp,
      companyId: updatedEmp.companyId || oldEmp?.companyId || activeCompany?.id || activeCompanyId,
    };
    setEmployees((prev) =>
      prev.map((emp) => (emp.id === enrichedEmp.id ? enrichedEmp : emp))
    );
    offlineSyncService.enqueue('SYNC_EMPLOYEE', enrichedEmp);
    autoSyncService.broadcast('EMPLOYEE_UPDATED', enrichedEmp);

    // If shift assignment was updated, dispatch in-app notification to staff member
    if (oldEmp && oldEmp.shiftId !== enrichedEmp.shiftId) {
      const newShift = shifts.find((s) => s.id === enrichedEmp.shiftId);
      const oldShift = shifts.find((s) => s.id === oldEmp.shiftId);
      const now = new Date();
      const notif: StaffNotification = {
        id: `notif-shift-assign-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        employeeId: enrichedEmp.id,
        employeeName: enrichedEmp.name,
        title: 'Shift Assignment Updated',
        message: `Your supermarket roster shift has been changed from ${oldShift?.name || 'Previous Shift'} to ${newShift?.name || 'New Shift'} (${newShift?.badge || ''}).`,
        type: 'SHIFT_UPDATE',
        timestamp: now.toISOString(),
        timeFormatted: get12HTimeString(now, false),
        read: false,
        meta: {
          shiftId: enrichedEmp.shiftId,
          shiftName: newShift?.name,
          oldTimings: oldShift?.badge,
          newTimings: newShift?.badge,
        },
      };
      setNotifications((prev) => [notif, ...prev]);
      offlineSyncService.enqueue('SYNC_NOTIFICATION', notif);
      autoSyncService.broadcast('NOTIFICATION_ADDED', notif);
      soundService.playNotificationTone();
    }
  };

  // Admin delete employee and clear their punch logs & associated leave requests
  const handleDeleteEmployee = (empId: string) => {
    const targetEmp = employees.find((emp) => emp.id === empId);
    setEmployees((prev) => prev.filter((emp) => emp.id !== empId));
    setAttendanceLogs((prev) => prev.filter((log) => log.employeeId !== empId));
    setLeaveRequests((prev) =>
      prev.filter(
        (l) => l.employeeId !== empId && (!targetEmp || l.employeeName.trim().toLowerCase() !== targetEmp.name.trim().toLowerCase())
      )
    );
    offlineSyncService.enqueue('SYNC_DELETE_EMPLOYEE', empId);
    deleteAttendanceByEmployeeInFirestore(empId);
    deleteLeaveRequestsByEmployeeInFirestore(empId, targetEmp?.name);
    autoSyncService.broadcast('EMPLOYEE_DELETED', empId);
  };

  // Clear attendance logs (e.g. wipe past test punches, scoped to active company if selected)
  const handleClearAttendanceLogs = () => {
    if (activeCompany) {
      const targetEmpIds = new Set(scopedAdminEmployees.map((e) => e.id));
      setAttendanceLogs((prev) =>
        prev.filter((l) => l.companyId !== activeCompany.id && !targetEmpIds.has(l.employeeId))
      );
    } else {
      setAttendanceLogs([]);
      try {
        localStorage.removeItem('attendo_real_workforce_logs');
        localStorage.removeItem('attendo_user_logs');
      } catch {
        // ignore
      }
    }
  };

  // Admin clear all employees to start empty, cascading to all punch logs and leave requests (scoped to active company)
  const handleClearAllEmployees = () => {
    if (activeCompany) {
      const targetEmpIds = new Set<string>(scopedAdminEmployees.map((e) => e.id));
      targetEmpIds.forEach((id: string) => {
        deleteEmployeeFromFirestore(id);
        deleteAttendanceByEmployeeInFirestore(id);
        deleteLeaveRequestsByEmployeeInFirestore(id);
        autoSyncService.broadcast('EMPLOYEE_DELETED', id);
      });
      setEmployees((prev) => prev.filter((e) => !targetEmpIds.has(e.id)));
      setAttendanceLogs((prev) => prev.filter((l) => !targetEmpIds.has(l.employeeId)));
      setLeaveRequests((prev) => prev.filter((lr) => !targetEmpIds.has(lr.employeeId)));
    } else {
      setEmployees([]);
      setAttendanceLogs([]);
      setLeaveRequests([]);
      clearAllEmployeesInFirestore();
      clearAllLeaveRequestsInFirestore();
      try {
        localStorage.removeItem('attendo_real_workforce_staff');
        localStorage.removeItem('attendo_user_enrolled_staff');
        localStorage.removeItem('attendo_real_workforce_logs');
        localStorage.removeItem('attendo_user_logs');
        localStorage.removeItem('attendo_real_workforce_leaves');
        localStorage.removeItem('attendo_user_leaves');
        localStorage.removeItem('attendo_hyper_leaves');
      } catch {
        // ignore
      }
    }
  };

  // Admin delete specific leave request
  const handleDeleteLeave = (leaveId: string) => {
    setLeaveRequests((prev) => prev.filter((l) => l.id !== leaveId));
    offlineSyncService.enqueue('SYNC_DELETE_LEAVE', leaveId);
    autoSyncService.broadcast('LEAVE_DELETED', leaveId);
  };

  // Admin clear all leave requests (scoped to active company)
  const handleClearAllLeaves = () => {
    if (activeCompany) {
      const targetEmpIds = new Set(scopedAdminEmployees.map((e) => e.id));
      scopedAdminLeaveRequests.forEach((l) => deleteLeaveRequestFromFirestore(l.id));
      setLeaveRequests((prev) =>
        prev.filter((l) => l.companyId !== activeCompany.id && !targetEmpIds.has(l.employeeId))
      );
    } else {
      setLeaveRequests([]);
      clearAllLeaveRequestsInFirestore();
      try {
        localStorage.removeItem('attendo_real_workforce_leaves');
        localStorage.removeItem('attendo_user_leaves');
        localStorage.removeItem('attendo_hyper_leaves');
      } catch {
        // ignore
      }
    }
  };

  // Admin clear orphaned leave requests (e.g. from previously removed staff)
  const handleClearOrphanedLeaves = () => {
    const enrolledIds = new Set(employees.map((e) => e.id));
    const enrolledNames = new Set(employees.map((e) => e.name.trim().toLowerCase()));
    const orphaned = leaveRequests.filter(
      (l) => !enrolledIds.has(l.employeeId) && !enrolledNames.has(l.employeeName.trim().toLowerCase())
    );
    orphaned.forEach((l) => {
      deleteLeaveRequestFromFirestore(l.id);
    });
    setLeaveRequests((prev) =>
      prev.filter(
        (l) => enrolledIds.has(l.employeeId) || enrolledNames.has(l.employeeName.trim().toLowerCase())
      )
    );
  };


  // Admin approve/reject leave with instant UI feedback, staff notification & Firestore sync
  const handleApproveLeave = (leaveId: string, status: 'APPROVED' | 'REJECTED') => {
    const targetLeave = leaveRequests.find((l) => l.id === leaveId);
    setLeaveRequests((prev) =>
      prev.map((l) => (l.id === leaveId ? { ...l, status } : l))
    );
    offlineSyncService.enqueue('SYNC_LEAVE_STATUS', { id: leaveId, status });
    autoSyncService.broadcast('LEAVE_STATUS_CHANGED', { id: leaveId, status });

    if (targetLeave) {
      const now = new Date();
      const notif: StaffNotification = {
        id: `notif-leave-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        employeeId: targetLeave.employeeId,
        employeeName: targetLeave.employeeName,
        title: status === 'APPROVED' ? 'Leave Request Approved' : 'Leave Request Rejected',
        message: status === 'APPROVED'
          ? `Your ${targetLeave.type} Leave request for ${targetLeave.startDate} to ${targetLeave.endDate} has been APPROVED by Store Management.`
          : `Your ${targetLeave.type} Leave request for ${targetLeave.startDate} to ${targetLeave.endDate} was REJECTED by Store Management. Reason: Operational staffing coverage.`,
        type: 'LEAVE_STATUS',
        leaveStatus: status,
        timestamp: now.toISOString(),
        timeFormatted: get12HTimeString(now, false),
        read: false,
        meta: {
          leaveId: targetLeave.id,
        },
      };
      setNotifications((prev) => [notif, ...prev]);
      offlineSyncService.enqueue('SYNC_NOTIFICATION', notif);
      autoSyncService.broadcast('NOTIFICATION_ADDED', notif);
      soundService.playNotificationTone();
    } else {
      if (status === 'APPROVED') {
        soundService.playSuccessChime();
      }
    }
  };

  // Admin update shift timings & broadcast schedule update notification to staff
  const handleUpdateShift = (updatedShift: Shift) => {
    setShifts((prev) =>
      prev.map((s) => (s.id === updatedShift.id ? updatedShift : s))
    );
    syncShiftToFirestore(updatedShift);
    offlineSyncService.enqueue('SYNC_SHIFT', updatedShift);
    autoSyncService.broadcast('SHIFT_UPDATED', updatedShift);

    const now = new Date();
    const notif: StaffNotification = {
      id: `notif-shift-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      employeeId: 'ALL',
      title: `Shift Schedule Updated: ${updatedShift.name}`,
      message: `${updatedShift.name} roster schedule updated to ${updatedShift.badge} (${updatedShift.startTime} - ${updatedShift.endTime}). Grace period is ${updatedShift.gracePeriodMins} mins.`,
      type: 'SHIFT_UPDATE',
      timestamp: now.toISOString(),
      timeFormatted: get12HTimeString(now, false),
      read: false,
      meta: {
        shiftId: updatedShift.id,
        shiftName: updatedShift.name,
        newTimings: `${updatedShift.startTime} - ${updatedShift.endTime}`,
      },
    };
    setNotifications((prev) => [notif, ...prev]);
    syncStaffNotificationToFirestore(notif);
    autoSyncService.broadcast('NOTIFICATION_ADDED', notif);
    soundService.playNotificationTone();
  };

  // Staff mark notification as read
  const handleMarkNotificationAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    updateNotificationReadInFirestore(id, true);
    autoSyncService.broadcast('NOTIFICATION_READ', id);
  };

  // Staff mark all notifications as read
  const handleMarkAllNotificationsAsRead = (employeeId?: string) => {
    setNotifications((prev) =>
      prev.map((n) => {
        if (!employeeId || n.employeeId === employeeId || n.employeeId === 'ALL') {
          return { ...n, read: true };
        }
        return n;
      })
    );
    notifications.forEach((n) => {
      if (!employeeId || n.employeeId === employeeId || n.employeeId === 'ALL') {
        if (!n.read) {
          updateNotificationReadInFirestore(n.id, true);
          autoSyncService.broadcast('NOTIFICATION_READ', n.id);
        }
      }
    });
  };

  // Staff delete notification
  const handleDeleteNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    deleteNotificationFromFirestore(id);
    autoSyncService.broadcast('NOTIFICATION_DELETED', id);
  };

  // Staff submit leave
  const handleApplyLeave = (leaveData: Omit<LeaveRequest, 'id' | 'requestedAt' | 'status'>) => {
    const now = new Date();
    const emp = employees.find((e) => e.id === leaveData.employeeId);
    const companyId = leaveData.companyId || emp?.companyId || activeCompany?.id || activeCompanyId;
    const newReq: LeaveRequest = {
      ...leaveData,
      companyId,
      id: `leave-${Date.now()}`,
      status: 'PENDING',
      requestedAt: `${now.toISOString().slice(0, 10)} ${get12HTimeString(now, false)}`,
    };
    setLeaveRequests((prev) => [newReq, ...prev]);
    offlineSyncService.enqueue('SYNC_LEAVE', newReq);
    autoSyncService.broadcast('LEAVE_REQUESTED', newReq);
  };

  return (
    <div className="min-h-screen bg-[#05070D] text-slate-100 flex flex-col relative selection:bg-emerald-500 selection:text-black">
      
      {/* Background Lighting Meshes for Liquid Glass Refraction */}
      <div className="fixed top-0 left-1/4 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none -z-10 animate-fluid-orb"></div>
      <div className="fixed bottom-0 right-1/4 w-[600px] h-[600px] bg-sky-500/10 rounded-full blur-[140px] pointer-events-none -z-10 animate-fluid-orb" style={{ animationDelay: '4s' }}></div>
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-purple-500/5 rounded-full blur-[160px] pointer-events-none -z-10"></div>

      {/* Main Active Portal Render */}
      <main className="flex-1 flex flex-col items-center justify-start pb-12 w-full">
        {currentPortal === 'ADMIN_PORTAL' && (
          <AdminPortal
            employees={scopedAdminEmployees}
            allEmployees={employees}
            shifts={scopedAdminShifts}
            attendanceLogs={scopedAdminAttendanceLogs}
            leaveRequests={scopedAdminLeaveRequests}
            notifications={notifications}
            activeCompany={activeCompany}
            companies={companies}
            autoOpenCreateCompany={autoOpenCreateCompany}
            onResetAutoOpenCreateCompany={() => setAutoOpenCreateCompany(false)}
            onSelectCompany={setActiveCompanyId}
            onCreateCompany={handleCreateCompany}
            onUpdateCompany={handleUpdateCompany}
            onDeleteCompany={handleDeleteCompany}
            onAddEmployee={handleAddEmployee}
            onUpdateEmployee={handleUpdateEmployee}
            onDeleteEmployee={handleDeleteEmployee}
            onClearAllEmployees={handleClearAllEmployees}
            onClearAttendanceLogs={handleClearAttendanceLogs}
            onApproveLeave={handleApproveLeave}
            onDeleteLeave={handleDeleteLeave}
            onClearAllLeaves={handleClearAllLeaves}
            onClearOrphanedLeaves={handleClearOrphanedLeaves}
            onUpdateShift={handleUpdateShift}
            onManualPunch={handleNewPunch}
            onSubmitHelpRequest={handleCreateHelpRequest}
          />
        )}

        {currentPortal === 'KIOSK_FACE' && (
          <KioskFace
            employees={employees}
            attendanceLogs={attendanceLogs}
            companies={companies}
            activeCompany={activeCompany}
            onSelectCompany={setActiveCompanyId}
            onNewPunch={handleNewPunch}
            isKioskOnlyMode={true}
            onSubmitHelpRequest={handleCreateHelpRequest}
          />
        )}

        {currentPortal === 'EMPLOYEE_APP' && (
          <EmployeeApp
            employees={employees}
            shifts={shifts}
            attendanceLogs={attendanceLogs}
            leaveRequests={leaveRequests}
            companies={companies}
            activeCompany={activeCompany}
            onSelectCompany={setActiveCompanyId}
            notifications={notifications}
            onApplyLeave={handleApplyLeave}
            onMobileGeoPunch={handleMobileGeoPunch}
            onMarkNotificationAsRead={handleMarkNotificationAsRead}
            onMarkAllNotificationsAsRead={handleMarkAllNotificationsAsRead}
            onDeleteNotification={handleDeleteNotification}
            onOpenInstallModal={() => openInstallHub('STAFF')}
            isStaffOnlyMode={true}
            onSubmitHelpRequest={handleCreateHelpRequest}
          />
        )}

        {currentPortal === 'APPS_MANAGER' && (
          <AppsManager
            companies={companies}
            activeCompany={activeCompany}
            onSelectCompany={setActiveCompanyId}
            onCreateCompany={handleCreateCompany}
            onUpdateCompany={handleUpdateCompany}
            onDeleteCompany={handleDeleteCompany}
            employees={employees}
            attendanceLogs={attendanceLogs}
            shifts={shifts}
            leaveRequests={leaveRequests}
            notifications={notifications}
            isStandalone={standaloneMode === 'MANAGER'}
            onLaunchPortal={(portal) => {
              if (portal === 'EMPLOYEE_APP') {
                setStandaloneMode('STAFF');
                setCurrentPortal('EMPLOYEE_APP');
                if (typeof window !== 'undefined') {
                  try {
                    window.history.pushState({}, '', '?app=staff');
                  } catch {
                    // Ignore sandboxed pushState restrictions
                  }
                }
              } else if (portal === 'KIOSK_FACE') {
                setStandaloneMode('KIOSK');
                setCurrentPortal('KIOSK_FACE');
                if (typeof window !== 'undefined') {
                  try {
                    window.history.pushState({}, '', '?app=kiosk');
                  } catch {
                    // Ignore sandboxed pushState restrictions
                  }
                }
              } else if (portal === 'ADMIN_PORTAL') {
                setStandaloneMode('ADMIN');
                setCurrentPortal('ADMIN_PORTAL');
                if (typeof window !== 'undefined') {
                  try {
                    window.history.pushState({}, '', '?app=admin');
                  } catch {
                    // Ignore sandboxed pushState restrictions
                  }
                }
              } else {
                setCurrentPortal(portal);
              }
            }}
            onOpenInstallModal={(target) => openInstallHub(target || 'MANAGER')}
            isFirebaseConnected={isFirebaseLive}
            helpRequests={helpRequests}
            onUpdateHelpRequestStatus={handleUpdateHelpRequestStatus}
            onDeleteHelpRequest={handleDeleteHelpRequest}
          />
        )}
      </main>

      {/* Enterprise Multi-App Deployment Hub Modal */}
      <InstallModal
        isOpen={isInstallModalOpen}
        onClose={() => setIsInstallModalOpen(false)}
        initialApp={installModalTarget}
        isManagerHub={currentPortal === 'APPS_MANAGER'}
        onLaunchApp={currentPortal === 'APPS_MANAGER' ? (target) => {
          if (target === 'STAFF') {
            setStandaloneMode('STAFF');
            setCurrentPortal('EMPLOYEE_APP');
          } else if (target === 'KIOSK') {
            setStandaloneMode('KIOSK');
            setCurrentPortal('KIOSK_FACE');
          } else if (target === 'ADMIN') {
            setStandaloneMode('ADMIN');
            setCurrentPortal('ADMIN_PORTAL');
          } else if (target === 'MANAGER') {
            setStandaloneMode('MANAGER');
            setCurrentPortal('APPS_MANAGER');
          }
        } : undefined}
      />

    </div>
  );
}
