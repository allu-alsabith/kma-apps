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
  createSampleEmployeesForCompany,
  createSampleAttendanceForCompany,
} from './data';
import { KioskFace } from './components/KioskFace';
import { EmployeeApp } from './components/EmployeeApp';
import { AdminPortal } from './components/AdminPortal';
import { AppsManager } from './components/AppsManager';
import { InstallModal, AppInstallTarget } from './components/InstallModal';
import { NetworkSyncBadge } from './components/NetworkSyncBadge';
import { offlineSyncService } from './services/offlineSync';
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

  // Shared Core Hypermarket Database State for Real-World Business Use
  // Starts completely clean with 0 staff, 0 logs, 0 leaves until the store owner enrolls them
  const [employees, setEmployees] = useState<Employee[]>(() => {
    if (typeof window !== 'undefined') {
      const isCleaned = localStorage.getItem('attendo_real_workforce_clean_v1');
      if (!isCleaned) {
        // Clear all previous demo seed data
        localStorage.removeItem('attendo_user_enrolled_staff');
        localStorage.removeItem('attendo_hyper_employees');
        localStorage.removeItem('attendo_user_logs');
        localStorage.removeItem('attendo_hyper_logs');
        localStorage.removeItem('attendo_user_leaves');
        localStorage.removeItem('attendo_hyper_leaves');
        localStorage.removeItem('attendo_staff_session_id');
        localStorage.setItem('attendo_real_workforce_clean_v1', 'true');
        return [];
      }
      const saved = localStorage.getItem('attendo_real_workforce_staff');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            // Filter out any lingering mock demo entries
            return parsed.filter((e) => e.name !== 'Sarah Connor' && e.name !== 'Ahmed Al-Mansoor');
          }
        } catch {
          return [];
        }
      }
    }
    return [];
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
    return SHIFTS;
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
          if (Array.isArray(parsed)) {
            return parsed.filter((l) => l.employeeName !== 'Sarah Connor' && l.employeeName !== 'Ahmed Al-Mansoor');
          }
        } catch {
          return [];
        }
      }
    }
    return [];
  });

  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('attendo_real_workforce_leaves');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            return parsed.filter((lr) => lr.employeeName !== 'Priya Sharma' && lr.employeeName !== 'David Kim');
          }
        } catch {
          return [];
        }
      }
    }
    return [];
  });

  // Multi-Company State (Supports distinct supermarket companies with custom names, codes and passwords)
  const [companies, setCompanies] = useState<Company[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('attendo_companies');
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
    return DEFAULT_COMPANIES;
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
      if (urlComp) {
        const found = DEFAULT_COMPANIES.find(
          (c) =>
            c.code.toLowerCase() === urlComp.toLowerCase() ||
            c.id === urlComp ||
            c.supermarketName.toLowerCase() === urlComp.toLowerCase()
        );
        if (found) return found.id;
      }
      const saved = localStorage.getItem('attendo_active_company_id');
      if (saved) return saved;
    }
    return DEFAULT_COMPANIES[0]?.id || 'comp-kma';
  });

  const activeCompany = useMemo(() => {
    return companies.find((c) => c.id === activeCompanyId) || companies[0] || DEFAULT_COMPANIES[0];
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

  // Automatically guarantee that the active company has persistent shifts created
  useEffect(() => {
    if (activeCompany) {
      const hasShifts = shifts.some((s) => s.companyId === activeCompany.id);
      if (!hasShifts) {
        const generatedShifts = createDefaultShiftsForCompany(activeCompany.id);
        setShifts((prev) => [...prev, ...generatedShifts]);
        generatedShifts.forEach((s) => {
          offlineSyncService.enqueue('SYNC_SHIFT', s);
        });
      }
    }
  }, [activeCompany?.id, shifts]);

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
      if (remoteEmployees.length > 0) {
        // Clean out legacy mock staff if any
        const cleaned = remoteEmployees.filter(
          (e) => e.name !== 'Sarah Connor' && e.name !== 'Ahmed Al-Mansoor'
        );
        if (cleaned.length > 0) {
          setEmployees(cleaned);
        }
      }
    });

    const unsubAttendance = subscribeToAttendanceRecords((remoteLogs) => {
      if (remoteLogs.length > 0) {
        const cleaned = remoteLogs.filter(
          (l) => l.employeeName !== 'Sarah Connor' && l.employeeName !== 'Ahmed Al-Mansoor'
        );
        if (cleaned.length > 0) {
          setAttendanceLogs(cleaned);
        }
      }
    });

    const unsubLeaves = subscribeToLeaveRequests((remoteLeaves) => {
      if (remoteLeaves.length > 0) {
        const cleaned = remoteLeaves.filter(
          (lr) => lr.employeeName !== 'Priya Sharma' && lr.employeeName !== 'David Kim'
        );
        if (cleaned.length > 0) {
          setLeaveRequests(cleaned);
        }
      }
    });

    const unsubNotifications = subscribeToStaffNotifications((remoteNotifs) => {
      if (remoteNotifs && remoteNotifs.length > 0) {
        setNotifications(remoteNotifs);
      }
    });

    const unsubCompanies = subscribeToCompanies((remoteCompanies) => {
      if (remoteCompanies && remoteCompanies.length > 0) {
        setCompanies((prev) => {
          const map = new Map<string, Company>();
          prev.forEach((c) => map.set(c.id, c));
          remoteCompanies.forEach((c) => map.set(c.id, c));
          return Array.from(map.values());
        });
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
    setCompanies((prev) => {
      const filtered = prev.filter((c) => c.id !== newId && c.code.toUpperCase() !== newCompany.code.toUpperCase());
      return [...filtered, newCompany];
    });
    setActiveCompanyId(newId);

    // Persist company selection and pre-authenticate admin session so user can immediately manage their created company
    if (typeof window !== 'undefined') {
      localStorage.setItem('attendo_active_company_id', newId);
      localStorage.setItem('attendo_admin_company_id', newId);
      localStorage.setItem('attendo_admin_session_auth', 'true');
      localStorage.setItem('attendo_staff_company_id', newId);
      localStorage.setItem('attendo_staff_company_name', newCompany.supermarketName);
      localStorage.setItem('attendo_kiosk_company_id', newId);
    }

    // Initialize default shifts for the new supermarket company
    const newCompanyShifts = createDefaultShiftsForCompany(newId);
    setShifts((prev) => {
      const existingWithoutThis = prev.filter((s) => s.companyId !== newId);
      return [...existingWithoutThis, ...newCompanyShifts];
    });

    offlineSyncService.enqueue('SYNC_COMPANY', newCompany);
    return newCompany;
  };

  const handleUpdateCompany = async (updated: Company) => {
    setCompanies((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    offlineSyncService.enqueue('SYNC_COMPANY', updated);
  };

  const handleDeleteCompany = async (companyId: string) => {
    const remaining = companies.filter((c) => c.id !== companyId);
    if (remaining.length === 0) {
      const freshDefault: Company = {
        id: `comp-${Date.now()}`,
        name: 'Workforce Retail Pvt Ltd',
        supermarketName: 'Workforce',
        code: 'STORE',
        password: 'admin',
        address: 'Main Store HQ',
        contactEmail: 'admin@workforcesystems.com',
        contactPhone: '+91 98765 43210',
        isActive: true,
        createdAt: new Date().toISOString(),
      };
      setCompanies([freshDefault]);
      setActiveCompanyId(freshDefault.id);
      offlineSyncService.enqueue('SYNC_DELETE_COMPANY', companyId);
      offlineSyncService.enqueue('SYNC_COMPANY', freshDefault);
      return;
    }
    setCompanies(remaining);
    if (activeCompanyId === companyId) {
      setActiveCompanyId(remaining[0].id);
    }
    offlineSyncService.enqueue('SYNC_DELETE_COMPANY', companyId);
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

  // Admin restore / seed rich sample employees for ANY active company
  const handleRestoreSampleEmployees = () => {
    const targetComp = activeCompany || companies[0] || DEFAULT_COMPANIES[0];
    const targetCompId = targetComp.id;
    const sampleEmployees = createSampleEmployeesForCompany(targetComp);
    const sampleLogs = createSampleAttendanceForCompany(targetComp, sampleEmployees);

    setEmployees((prev) => {
      const otherEmps = prev.filter((e) => e.companyId !== targetCompId);
      return [...sampleEmployees, ...otherEmps];
    });
    setAttendanceLogs((prev) => {
      const otherLogs = prev.filter((l) => l.companyId !== targetCompId);
      return [...sampleLogs, ...otherLogs];
    });

    sampleEmployees.forEach((emp) => {
      offlineSyncService.enqueue('SYNC_EMPLOYEE', emp);
    });
    sampleLogs.forEach((log) => {
      offlineSyncService.enqueue('SYNC_PUNCH', log);
    });
    soundService.playSuccessChime();
  };

  // Admin approve/reject leave with instant UI feedback, staff notification & Firestore sync
  const handleApproveLeave = (leaveId: string, status: 'APPROVED' | 'REJECTED') => {
    const targetLeave = leaveRequests.find((l) => l.id === leaveId);
    setLeaveRequests((prev) =>
      prev.map((l) => (l.id === leaveId ? { ...l, status } : l))
    );
    offlineSyncService.enqueue('SYNC_LEAVE_STATUS', { id: leaveId, status });

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
    soundService.playNotificationTone();
  };

  // Staff mark notification as read
  const handleMarkNotificationAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    updateNotificationReadInFirestore(id, true);
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
        }
      }
    });
  };

  // Staff delete notification
  const handleDeleteNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    deleteNotificationFromFirestore(id);
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
  };

  // Navigate back to Apps Manager HQ
  const handleReturnToManager = () => {
    setStandaloneMode('MANAGER');
    setCurrentPortal('APPS_MANAGER');
    if (typeof window !== 'undefined') {
      try {
        window.history.pushState({}, '', '?app=manager');
      } catch {
        // ignore
      }
    }
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
            onRestoreSampleEmployees={handleRestoreSampleEmployees}
            onApproveLeave={handleApproveLeave}
            onDeleteLeave={handleDeleteLeave}
            onClearAllLeaves={handleClearAllLeaves}
            onClearOrphanedLeaves={handleClearOrphanedLeaves}
            onUpdateShift={handleUpdateShift}
            onManualPunch={handleNewPunch}
            onSubmitHelpRequest={handleCreateHelpRequest}
            onBackToAppsManager={handleReturnToManager}
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
            onBackToAppsManager={handleReturnToManager}
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
            onBackToAppsManager={handleReturnToManager}
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
            onRestoreSampleEmployees={handleRestoreSampleEmployees}
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
