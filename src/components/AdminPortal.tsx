import React, { useState, useMemo, useEffect } from 'react';
import { 
  Users, 
  Clock, 
  CalendarDays,
  Calendar, 
  FileSpreadsheet, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  UserPlus, 
  Download, 
  Search, 
  Filter, 
  Store, 
  Activity, 
  ShieldCheck, 
  ScanFace,
  ChevronRight,
  TrendingUp,
  MapPin,
  Sparkles,
  Edit2,
  Trash2,
  Smartphone,
  QrCode,
  ExternalLink,
  Layers,
  Copy,
  Check,
  RotateCcw,
  X,
  Bell,
  BellRing,
  Building2,
  Lock,
  Eye,
  EyeOff,
  Plus,
  KeyRound,
  CheckCheck,
  SlidersHorizontal,
  LogOut,
  LifeBuoy,
  ShieldAlert,
  Camera,
  AlertOctagon,
  ZoomIn
} from 'lucide-react';
import { Employee, Shift, AttendanceRecord, LeaveRequest, Department, PayBasis, StaffNotification, Company, AppPortal, HelpRequest, DEFAULT_DEPARTMENTS } from '../types';
import { soundService } from '../services/sound';
import { FaceEnrollmentScanner } from './FaceEnrollmentScanner';
import { clearBiometricCache } from '../utils/faceRecognition';
import { AccountHelpModal } from './AccountHelpModal';
import { NetworkSyncBadge } from './NetworkSyncBadge';
import { signInWithGoogle, signOutUser, subscribeToAuth, type User } from '../services/firebase';
import { 
  formatTime12H, 
  get12HTimeString, 
  formatCurrencyINR, 
  formatSalaryRate, 
  formatShiftBadge 
} from '../utils/formatters';

interface AdminPortalProps {
  employees: Employee[];
  allEmployees?: Employee[];
  shifts: Shift[];
  allShifts?: Shift[];
  attendanceLogs: AttendanceRecord[];
  leaveRequests: LeaveRequest[];
  notifications?: StaffNotification[];
  activeCompany?: Company;
  companies?: Company[];
  autoOpenCreateCompany?: boolean;
  onResetAutoOpenCreateCompany?: () => void;
  onSelectCompany?: (companyId: string) => void;
  onCreateCompany?: (companyData: Omit<Company, 'id' | 'createdAt'>) => Promise<Company | void> | void;
  onUpdateCompany?: (company: Company) => void;
  onDeleteCompany?: (companyId: string) => void;
  onAddEmployee: (employee: Employee) => void;
  onUpdateEmployee: (employee: Employee) => void;
  onDeleteEmployee: (employeeId: string) => void;
  onClearAllEmployees: () => void;
  onClearAttendanceLogs?: () => void;
  onRestoreSampleEmployees?: () => void;
  onApproveLeave: (leaveId: string, status: 'APPROVED' | 'REJECTED') => void;
  onDeleteLeave?: (leaveId: string) => void;
  onClearAllLeaves?: () => void;
  onClearOrphanedLeaves?: () => void;
  onUpdateShift?: (shift: Shift) => void;
  onManualPunch: (record: Omit<AttendanceRecord, 'id' | 'timestamp' | 'date' | 'time'>) => void;
  onSubmitHelpRequest?: (request: Omit<HelpRequest, 'id' | 'createdAt' | 'status'>) => Promise<void> | void;
  onMarkNotificationAsRead?: (notificationId: string) => void;
  onDeleteNotification?: (notificationId: string) => void;
  onClearAllNotifications?: () => void;
}

export const AdminPortal: React.FC<AdminPortalProps> = ({
  employees,
  allEmployees,
  shifts,
  allShifts,
  attendanceLogs,
  leaveRequests,
  notifications = [],
  activeCompany,
  companies = [],
  autoOpenCreateCompany = false,
  onResetAutoOpenCreateCompany,
  onSelectCompany,
  onCreateCompany,
  onUpdateCompany,
  onDeleteCompany,
  onAddEmployee,
  onUpdateEmployee,
  onDeleteEmployee,
  onClearAllEmployees,
  onClearAttendanceLogs,
  onRestoreSampleEmployees,
  onApproveLeave,
  onDeleteLeave,
  onClearAllLeaves,
  onClearOrphanedLeaves,
  onUpdateShift,
  onManualPunch,
  onSubmitHelpRequest,
  onMarkNotificationAsRead,
  onDeleteNotification,
  onClearAllNotifications,
}) => {
  const [showAccountHelpModal, setShowAccountHelpModal] = useState<boolean>(false);
  const [adminTab, setAdminTab] = useState<'OVERVIEW' | 'DIRECTORY' | 'SHIFTS' | 'LEAVES' | 'PAYROLL' | 'SECURITY'>('OVERVIEW');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedDepartmentFilter, setSelectedDepartmentFilter] = useState<string>('ALL');

  // Real-time Push Notification & Security Inspection States
  const [liveSecurityToast, setLiveSecurityToast] = useState<StaffNotification | null>(null);
  const [inspectingAlertPhoto, setInspectingAlertPhoto] = useState<StaffNotification | null>(null);
  const [lastSeenAlertId, setLastSeenAlertId] = useState<string>('');

  // Scoped Security Notifications
  const securityAlertNotifications = useMemo(() => {
    return (notifications || []).filter(
      (n) => n.type === 'SECURITY_ALERT' && (!n.companyId || !activeCompany?.id || n.companyId === activeCompany.id)
    );
  }, [notifications, activeCompany]);

  const unreadSecurityAlertsCount = useMemo(() => {
    return securityAlertNotifications.filter((n) => !n.read).length;
  }, [securityAlertNotifications]);

  // Detect incoming security alert push notifications and trigger audio + toast banner
  useEffect(() => {
    if (securityAlertNotifications.length > 0) {
      const latest = securityAlertNotifications[0];
      if (latest && !latest.read && latest.id !== lastSeenAlertId) {
        setLastSeenAlertId(latest.id);
        setLiveSecurityToast(latest);
        soundService.playSecurityAlertTone();
      }
    }
  }, [securityAlertNotifications, lastSeenAlertId]);

  // Store Admin Company Session Authentication
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState<boolean>(false);

  const [loginCompanyName, setLoginCompanyName] = useState<string>('');
  const [loginCompanyCode, setLoginCompanyCode] = useState<string>('');
  const [loginCompanyPassword, setLoginCompanyPassword] = useState<string>('');
  const [showLoginPassword, setShowLoginPassword] = useState<boolean>(false);
  const [adminLoginError, setAdminLoginError] = useState<string | null>(null);
  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [isSigningInWithGoogle, setIsSigningInWithGoogle] = useState<boolean>(false);

  useEffect(() => {
    const unsub = subscribeToAuth((user) => {
      setGoogleUser(user);
    });
    return () => unsub();
  }, []);

  const handleGoogleSignIn = async () => {
    setIsSigningInWithGoogle(true);
    setAdminLoginError(null);
    try {
      const user = await signInWithGoogle();
      if (user) {
        setIsAdminLoggedIn(true);
        if (typeof window !== 'undefined') {
          localStorage.setItem('attendo_admin_session_auth', 'true');
        }
        soundService.playSuccessChime();
      }
    } catch (err: unknown) {
      const errorObj = err as { code?: string; message?: string };
      if (errorObj?.code === 'auth/popup-blocked') {
        setAdminLoginError('Pop-up was blocked by the browser. Please allow pop-ups for this site or use company credentials below.');
      } else if (errorObj?.code === 'auth/cancelled-popup-request' || errorObj?.code === 'auth/popup-closed-by-user') {
        setAdminLoginError('Sign-in popup was closed. Please try again.');
      } else {
        setAdminLoginError(errorObj?.message || 'Google authentication failed. Please try again or use company credentials.');
      }
      soundService.playWarningTone();
    } finally {
      setIsSigningInWithGoogle(false);
    }
  };

  const handleGoogleSignOut = async () => {
    try {
      await signOutUser();
      setGoogleUser(null);
    } catch {
      // ignore
    }
  };

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setAdminLoginError(null);

    const inputName = loginCompanyName.trim().toLowerCase();
    const inputCode = loginCompanyCode.trim().toUpperCase();
    const inputPassword = loginCompanyPassword.trim();

    if (!inputCode && !inputName) {
      setAdminLoginError('Please enter your Company Code or Name.');
      soundService.playWarningTone();
      return;
    }
    if (!inputPassword) {
      setAdminLoginError('Please enter the Company Password.');
      soundService.playWarningTone();
      return;
    }

    // Match company prioritizing Code, then Supermarket Name / Full Name
    let matchedCompany = companies.find((c) => inputCode && c.code.trim().toUpperCase() === inputCode);
    if (!matchedCompany && inputName) {
      matchedCompany = companies.find(
        (c) =>
          c.supermarketName.trim().toLowerCase() === inputName ||
          c.name.trim().toLowerCase() === inputName ||
          c.code.trim().toLowerCase() === inputName
      );
    }

    if (!matchedCompany) {
      setAdminLoginError(`No registered company found with Code "${inputCode || loginCompanyName}". Please verify store credentials or contact administrator.`);
      soundService.playWarningTone();
      return;
    }

    // Validate Password (supporting exact, case-insensitive, and PIN)
    const expectedPassword = (matchedCompany.password || '').trim();
    const isPasswordValid =
      (expectedPassword && inputPassword === expectedPassword) ||
      (expectedPassword && inputPassword.toLowerCase() === expectedPassword.toLowerCase()) ||
      inputPassword === matchedCompany.adminPin?.trim();

    if (!isPasswordValid) {
      setAdminLoginError(`Incorrect Company Password for ${matchedCompany.supermarketName}. Please verify password or contact administrator.`);
      soundService.playWarningTone();
      return;
    }

    // Successful Admin Login
    setIsAdminLoggedIn(true);
    if (onSelectCompany && matchedCompany.id !== activeCompany?.id) {
      onSelectCompany(matchedCompany.id);
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem('attendo_admin_session_auth', 'true');
      localStorage.setItem('attendo_admin_company_id', matchedCompany.id);
      localStorage.setItem('attendo_active_company_id', matchedCompany.id);
    }
    soundService.playSuccessChime();
  };

  const handleAdminLogout = () => {
    setIsAdminLoggedIn(false);
    setLoginCompanyPassword('');
    setAdminLoginError(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('attendo_admin_session_auth');
      localStorage.removeItem('attendo_admin_company_id');
    }
    soundService.playWarningTone();
  };

  // Department health & presence breakdown: strictly scoped to the active company's selected department floor coverage
  const departmentsList: string[] = useMemo(() => {
    if (activeCompany?.departments && activeCompany.departments.length > 0) {
      return activeCompany.departments;
    }
    return DEFAULT_DEPARTMENTS;
  }, [activeCompany?.departments]);

  // New Employee Enrollment Modal State
  const [showAddEmpModal, setShowAddEmpModal] = useState<boolean>(false);
  const [enrollError, setEnrollError] = useState<string | null>(null);
  const [enrollSuccessMessage, setEnrollSuccessMessage] = useState<string | null>(null);
  const [newEmpId, setNewEmpId] = useState<string>('');
  const [newEmpName, setNewEmpName] = useState<string>('');
  const [newEmpRole, setNewEmpRole] = useState<string>('Cashier');
  const [newEmpDept, setNewEmpDept] = useState<string>(() => departmentsList[0] || 'Cashiers & Front End');
  const [newEmpShift, setNewEmpShift] = useState<Shift['id']>('shift-morning');
  const [newEmpPayBasis, setNewEmpPayBasis] = useState<PayBasis>('DAILY');
  const [newEmpWageRate, setNewEmpWageRate] = useState<number>(650);
  const [newEmpAllowMobilePunch, setNewEmpAllowMobilePunch] = useState<boolean>(true);
  const [newEmpPin, setNewEmpPin] = useState<string>('');
  const [newEmpPhone, setNewEmpPhone] = useState<string>('');
  const [newEmpAvatar, setNewEmpAvatar] = useState<string>('');

  // Keep newEmpDept in sync with company department coverage if company changes
  useEffect(() => {
    if (departmentsList.length > 0 && !departmentsList.includes(newEmpDept)) {
      setNewEmpDept(departmentsList[0]);
    }
  }, [departmentsList, newEmpDept]);

  const handleOpenAddEmp = () => {
    const nextNum = employees.length + 1;
    setNewEmpId(`EMP-${1000 + nextNum}`);
    setNewEmpName('');
    setNewEmpRole('Cashier');
    setNewEmpDept(departmentsList[0] || 'Cashiers & Front End');
    setNewEmpShift(shifts[0]?.id || 'shift-morning');
    setNewEmpPayBasis('DAILY');
    setNewEmpWageRate(650);
    setNewEmpAllowMobilePunch(true);
    setNewEmpPin('');
    setNewEmpPhone('');
    setNewEmpAvatar('');
    setEnrollError(null);
    setShowAddEmpModal(true);
  };

  // Edit Employee Modal State
  const [showEditEmpModal, setShowEditEmpModal] = useState<boolean>(false);
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null);

  // Shift Schedule Editor State
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [shiftEditName, setShiftEditName] = useState<string>('');
  const [shiftEditStart, setShiftEditStart] = useState<string>('06:00');
  const [shiftEditEnd, setShiftEditEnd] = useState<string>('15:00');
  const [shiftEditGrace, setShiftEditGrace] = useState<number>(15);
  const [shiftBroadcastAlert, setShiftBroadcastAlert] = useState<string | null>(null);
  const [leaveActionFeedback, setLeaveActionFeedback] = useState<string | null>(null);

  // Safe In-App Confirmation Modal State (Avoids window.confirm / SecurityError in iframe)
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    confirmText: string;
    onConfirm: () => void;
  } | null>(null);

  const handleStartEditShift = (shift: Shift) => {
    setEditingShift(shift);
    setShiftEditName(shift.name);
    setShiftEditStart(shift.startTime || '06:00');
    setShiftEditEnd(shift.endTime || '15:00');
    setShiftEditGrace(shift.gracePeriodMins || 15);
    setShiftBroadcastAlert(null);
  };

  const handleSaveShiftEdit = () => {
    if (!editingShift || !onUpdateShift) return;
    const badge = formatShiftBadge(shiftEditStart, shiftEditEnd);
    const updated: Shift = {
      ...editingShift,
      name: shiftEditName.trim() || editingShift.name,
      startTime: shiftEditStart,
      endTime: shiftEditEnd,
      badge,
      gracePeriodMins: Number(shiftEditGrace) || 15,
    };
    onUpdateShift(updated);
    setShiftBroadcastAlert(`Schedule update for ${updated.name} broadcast to all staff!`);
    soundService.playSuccessChime();
    setTimeout(() => {
      setEditingShift(null);
      setShiftBroadcastAlert(null);
    }, 1400);
  };

  // Real-time calculations strictly bounded by enrolled employees
  const totalStaff = employees.length;

  // Active floor staff: strictly enrolled staff whose latest punch is 'IN' (or whose current status is PRESENT)
  const activeFloorStaffCount = useMemo(() => {
    if (employees.length === 0) return 0;
    return employees.filter((emp) => {
      // Find the latest punch for this enrolled employee (logs are prepended newest-first)
      const latestPunch = attendanceLogs.find((l) => l.employeeId === emp.id);
      if (latestPunch) {
        return latestPunch.type === 'IN';
      }
      return emp.status === 'PRESENT';
    }).length;
  }, [employees, attendanceLogs]);

  // Late arrivals today for currently enrolled staff only
  const lateCount = useMemo(() => {
    if (employees.length === 0) return 0;
    const enrolledIds = new Set(employees.map(e => e.id));
    const todayStr = new Date().toISOString().slice(0, 10);
    return attendanceLogs.filter(l => 
      l.status === 'LATE' && 
      enrolledIds.has(l.employeeId) && 
      (l.date === todayStr || !l.date)
    ).length;
  }, [employees, attendanceLogs]);

  // Pending leaves for currently enrolled staff
  const pendingLeavesCount = useMemo(() => {
    if (employees.length === 0) return 0;
    const enrolledIds = new Set(employees.map(e => e.id));
    return leaveRequests.filter(l => l.status === 'PENDING' && enrolledIds.has(l.employeeId)).length;
  }, [employees, leaveRequests]);

  // Orphaned leaves (staff member was deleted from the directory)
  const orphanedLeaves = useMemo(() => {
    const enrolledIds = new Set(employees.map(e => e.id));
    const enrolledNames = new Set(employees.map(e => e.name.trim().toLowerCase()));
    return leaveRequests.filter(
      l => !enrolledIds.has(l.employeeId) && !enrolledNames.has(l.employeeName.trim().toLowerCase())
    );
  }, [employees, leaveRequests]);

  // Filtered employees
  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch = emp.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          emp.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          emp.role.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDept = selectedDepartmentFilter === 'ALL' || emp.department === selectedDepartmentFilter;
    return matchesSearch && matchesDept;
  });

  const handleEnrollEmployee = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setEnrollError(null);

    const trimmedName = newEmpName.trim();
    if (!trimmedName) {
      setEnrollError('Please enter the employee full name to confirm enrollment.');
      soundService.playWarningTone();
      return;
    }

    const trimmedRole = newEmpRole.trim();
    if (!trimmedRole) {
      setEnrollError('Please enter a job designation.');
      soundService.playWarningTone();
      return;
    }

    const assignedId = newEmpId.trim() || `EMP-${1000 + employees.length + 1}`;
    
    const trimmedPin = newEmpPin.trim();
    if (!trimmedPin || trimmedPin.length !== 4 || !/^\d{4}$/.test(trimmedPin)) {
      setEnrollError('Please enter a secure 4-digit staff PIN (e.g. 7492).');
      soundService.playWarningTone();
      return;
    }

    const trimmedPhone = newEmpPhone.trim();
    if (!trimmedPhone) {
      setEnrollError('Please enter the employee contact phone number.');
      soundService.playWarningTone();
      return;
    }

    const finalAvatar =
      newEmpAvatar.trim() ||
      `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(trimmedName)}&backgroundColor=0284c7,059669,d97706`;

    const rateNum = Number(newEmpWageRate) || 650;
    const computedHourly =
      newEmpPayBasis === 'DAILY'
        ? Math.round(rateNum / 8)
        : newEmpPayBasis === 'WEEKLY'
        ? Math.round(rateNum / 48)
        : Math.round(rateNum / 200);

    const newEmp: Employee = {
      companyId: activeCompany?.id || companies?.[0]?.id || '',
      id: assignedId,
      name: trimmedName,
      role: trimmedRole,
      department: newEmpDept,
      shiftId: newEmpShift,
      phone: trimmedPhone,
      email: `${trimmedName.toLowerCase().replace(/\s+/g, '.')}@${(activeCompany?.code || 'store').toLowerCase()}supermarket.com`,
      pin: trimmedPin,
      avatar: finalAvatar,
      faceRegistered: true,
      faceRegisteredDate: new Date().toISOString().split('T')[0],
      payBasis: newEmpPayBasis,
      wageRate: rateNum,
      hourlyRate: computedHourly,
      allowMobilePunch: newEmpAllowMobilePunch,
      badgeNumber: `BC-${Math.floor(10000 + Math.random() * 90000)}`,
    };

    onAddEmployee(newEmp);
    clearBiometricCache(newEmp.id);
    soundService.playSuccessChime();
    setEnrollSuccessMessage(`Successfully enrolled ${newEmp.name} (${newEmp.id})! Biometrics & ${newEmpPayBasis === 'DAILY' ? 'Daily Wage' : newEmpPayBasis === 'WEEKLY' ? 'Weekly Wage' : 'Monthly Salary'} active.`);
    setTimeout(() => {
      setEnrollSuccessMessage(null);
    }, 6000);

    setShowAddEmpModal(false);
    setNewEmpName('');
    setNewEmpId('');
    setNewEmpAvatar('');
    setEnrollError(null);
  };

  const handleStartEdit = (emp: Employee) => {
    setEditingEmp({
      ...emp,
      payBasis: emp.payBasis || 'DAILY',
      wageRate: emp.wageRate || (emp.hourlyRate ? emp.hourlyRate * 8 : 650),
      allowMobilePunch: emp.allowMobilePunch !== false,
    });
    setShowEditEmpModal(true);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmp || !editingEmp.name.trim()) return;

    onUpdateEmployee(editingEmp);
    clearBiometricCache(editingEmp.id);
    soundService.playSuccessChime();
    setShowEditEmpModal(false);
    setEditingEmp(null);
  };

  const handleDeletePrompt = (emp: Employee) => {
    setConfirmModal({
      title: 'Remove Staff Member',
      message: `Are you sure you want to remove ${emp.name} (${emp.id}) from the employee directory?`,
      confirmText: 'Remove Staff',
      onConfirm: () => {
        onDeleteEmployee(emp.id);
        soundService.playSuccessChime();
        setConfirmModal(null);
      },
    });
  };

  const handleClearAllPrompt = () => {
    setConfirmModal({
      title: 'Clear Staff Directory',
      message: 'Clear all demo employees from the roster? This will let you add your own supermarket staff from scratch.',
      confirmText: 'Clear All Staff',
      onConfirm: () => {
        onClearAllEmployees();
        soundService.playSuccessChime();
        setConfirmModal(null);
      },
    });
  };

  const exportAttendanceCSV = () => {
    const headers = ['Record ID', 'Employee ID', 'Name', 'Department', 'Date', 'Time', 'Punch Type', 'Device', 'Status'];
    const rows = attendanceLogs.map(log => [
      log.id,
      log.employeeId,
      `"${log.employeeName}"`,
      `"${log.department}"`,
      log.date,
      log.time,
      log.type,
      log.device,
      log.status,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    const csvFileName = `${(activeCompany?.supermarketName || 'Supermarket').replace(/\s+/g, '_')}_Attendance_${new Date().toISOString().slice(0, 10)}.csv`;
    link.setAttribute('download', csvFileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ==========================================
  // VIEW 1: STORE ADMIN COMPANY LOGIN SCREEN
  // ==========================================
  if (!isAdminLoggedIn) {
    return (
      <div className="w-full max-w-xl mx-auto px-4 py-8 sm:py-16 select-none animate-scale-in">
        <div className="bg-white rounded-xl p-6 sm:p-8 border border-[#E2E8F0] shadow-sm space-y-6 text-[#1E293B]">
          {/* Header Identity */}
          <div className="flex items-center justify-between gap-3.5">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-[#2563EB] shrink-0">
                <Store className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-bold text-[#1E293B] tracking-tight">
                    Store Admin Login
                  </h1>
                  <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-semibold border border-[#E2E8F0]">
                    STORE HR CONSOLE
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Supermarket Store HR &amp; Workforce Administration
                </p>
              </div>
            </div>
          </div>

          {/* Guidance Banner */}
          <div className="p-3.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-xs text-slate-700 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-[#2563EB] shrink-0 mt-0.5" />
            <div className="space-y-1 leading-relaxed">
              <p>
                Sign in with your <strong>Company Code</strong> and <strong>Company Password</strong> to access staff enrollment, shifts roster, attendance, and payroll.
              </p>
            </div>
          </div>

          {/* Login Form */}
          <form onSubmit={handleAdminLogin} className="space-y-4">
            {adminLoginError && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span className="font-semibold">{adminLoginError}</span>
              </div>
            )}

            {/* Empty Companies Notice */}
            {(!companies || companies.length === 0) && (
              <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                <p className="leading-relaxed">
                  No company has been registered yet. Please complete the Business Registration wizard to set up your store credentials.
                </p>
              </div>
            )}

            {/* Field 1: Company Name */}
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Store className="w-3.5 h-3.5 text-[#2563EB]" />
                  <span>Company / Supermarket Name</span>
                </span>
                <span className="text-[10px] text-slate-400">Supermarket Brand</span>
              </label>
              <div className="relative">
                <input
                  id="input-admin-company-name"
                  type="text"
                  placeholder="Enter supermarket or brand name"
                  value={loginCompanyName}
                  onChange={(e) => {
                    setLoginCompanyName(e.target.value);
                    if (adminLoginError) setAdminLoginError(null);
                  }}
                  className="w-full bg-white border border-[#CBD5E1] focus:border-[#2563EB] rounded-lg px-3.5 py-2.5 text-xs text-[#1E293B] outline-none transition-all placeholder-slate-400"
                />
              </div>
            </div>

            {/* Field 2: Company Code */}
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-[#2563EB]" />
                  <span>Company Code</span>
                </span>
                <span className="text-[10px] text-slate-400">Store Code</span>
              </label>
              <div className="relative">
                <input
                  id="input-admin-company-code"
                  type="text"
                  required
                  placeholder="Enter company code"
                  value={loginCompanyCode}
                  onChange={(e) => {
                    setLoginCompanyCode(e.target.value.toUpperCase());
                    if (adminLoginError) setAdminLoginError(null);
                  }}
                  className="w-full bg-white border border-[#CBD5E1] focus:border-[#2563EB] rounded-lg px-3.5 py-2.5 text-xs text-[#1E293B] font-mono uppercase tracking-wider outline-none transition-all placeholder-slate-400"
                />
              </div>
            </div>

            {/* Field 3: Company Password */}
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-[#2563EB]" />
                  <span>Company Password</span>
                </span>
                <span className="text-[10px] text-slate-400">Store Admin Password</span>
              </label>
              <div className="relative">
                <input
                  id="input-admin-company-password"
                  type={showLoginPassword ? 'text' : 'password'}
                  required
                  placeholder="Enter store company password"
                  value={loginCompanyPassword}
                  onChange={(e) => {
                    setLoginCompanyPassword(e.target.value);
                    if (adminLoginError) setAdminLoginError(null);
                  }}
                  className="w-full bg-white border border-[#CBD5E1] focus:border-[#2563EB] rounded-lg px-3.5 py-2.5 pr-10 text-xs text-[#1E293B] font-mono outline-none transition-all placeholder-slate-400"
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword(!showLoginPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              id="btn-admin-login-submit"
              type="submit"
              className="w-full py-2.5 px-4 rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white font-semibold text-xs shadow-xs cursor-pointer transition-all active:scale-[0.99] flex items-center justify-center gap-2 mt-2"
            >
              <Lock className="w-4 h-4 text-white" />
              <span>Log In as Store Admin</span>
            </button>

            {/* Google Sign-in with Firebase Auth */}
            <div className="relative my-2.5">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#E2E8F0]" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-white px-2.5 text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
                  OR SIGN IN WITH FIREBASE AUTH
                </span>
              </div>
            </div>

            <button
              type="button"
              id="btn-admin-google-signin"
              onClick={handleGoogleSignIn}
              disabled={isSigningInWithGoogle}
              className="w-full py-2.5 px-4 rounded-lg bg-white hover:bg-slate-50 border border-[#CBD5E1] text-[#1E293B] font-semibold text-xs shadow-xs transition-all active:scale-[0.99] flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-60"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span>{isSigningInWithGoogle ? 'Connecting Google Account...' : 'Continue with Google Account'}</span>
            </button>
          </form>

          {/* Account Help Option */}
          <div className="pt-3 border-t border-[#E2E8F0] flex items-center justify-between text-xs text-slate-500">
            <span>Can&apos;t log in or forgot password?</span>
            <button
              type="button"
              id="btn-admin-account-help"
              onClick={() => setShowAccountHelpModal(true)}
              className="text-[#2563EB] hover:text-blue-700 font-semibold flex items-center gap-1.5 cursor-pointer transition-all hover:underline"
            >
              <LifeBuoy className="w-3.5 h-3.5" />
              <span>Account Help</span>
            </button>
          </div>
        </div>

        {/* Account Help Modal */}
        <AccountHelpModal
          isOpen={showAccountHelpModal}
          onClose={() => setShowAccountHelpModal(false)}
          appName="Store Admin Console"
          defaultCompanyName={loginCompanyName}
          defaultCompanyCode={loginCompanyCode}
          onSubmitHelpRequest={async (req) => {
            if (onSubmitHelpRequest) {
              await onSubmitHelpRequest(req);
            }
          }}
        />
      </div>
    );
  }

  // ==========================================
  // VIEW 2: AUTHENTICATED STORE ADMIN DASHBOARD
  // ==========================================
  return (
    <div className="w-full max-w-7xl mx-auto p-4 md:p-6 space-y-6 select-none text-[#1E293B]">
      
      {/* STORE MANAGER COMMAND BAR */}
      <div className="bg-white rounded-xl p-5 border border-[#E2E8F0] shadow-xs flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 text-[#1E293B]">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Active Store Switcher Dropdown */}
            {companies && companies.length > 0 ? (
              <div className="flex items-center gap-1.5 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg px-2.5 py-1 text-slate-700">
                <Store className="w-3.5 h-3.5 text-[#2563EB] shrink-0" />
                <span className="text-[10px] text-slate-500 font-semibold">Store:</span>
                <select
                  id="select-admin-active-company"
                  value={activeCompany?.id || companies?.[0]?.id || ''}
                  onChange={(e) => {
                    const newCompId = e.target.value;
                    if (onSelectCompany) {
                      onSelectCompany(newCompId);
                    }
                    if (typeof window !== 'undefined') {
                      localStorage.setItem('attendo_active_company_id', newCompId);
                      localStorage.setItem('attendo_admin_company_id', newCompId);
                    }
                    soundService.playSuccessChime();
                  }}
                  className="bg-transparent border-none text-[11px] text-slate-800 font-bold outline-none cursor-pointer"
                >
                  {companies.map((c) => (
                    <option key={c.id} value={c.id} className="bg-white text-slate-800 font-medium">
                      {c.supermarketName} ({c.code})
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <span className="text-xs font-mono text-slate-700 font-semibold uppercase tracking-wider flex items-center gap-1.5">
                <Store className="w-3.5 h-3.5 text-[#2563EB]" /> {activeCompany?.supermarketName || 'Store'} Supermarket &bull; Store HQ
              </span>
            )}

            <NetworkSyncBadge compact />
            <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-[#E2E8F0] text-slate-700 text-[10px] font-mono font-bold">
              CODE: {activeCompany?.code || 'STORE'}
            </span>

            {/* Google Auth User Badge */}
            {googleUser && (
              <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 rounded-lg px-2 py-0.5 text-[11px] text-blue-800">
                {googleUser.photoURL ? (
                  <img src={googleUser.photoURL} alt="" className="w-4 h-4 rounded-full object-cover" />
                ) : (
                  <div className="w-4 h-4 rounded-full bg-[#2563EB] text-[9px] text-white flex items-center justify-center font-bold">G</div>
                )}
                <span className="font-semibold truncate max-w-[120px]">{googleUser.displayName || googleUser.email}</span>
                <button
                  type="button"
                  onClick={handleGoogleSignOut}
                  className="text-[#2563EB] hover:underline text-[10px] ml-0.5 cursor-pointer font-medium"
                  title="Sign out of Google Account"
                >
                  Sign Out
                </button>
              </div>
            )}

            {/* Switch Company / Sign Out */}
            <button
              id="btn-admin-sign-out"
              onClick={handleAdminLogout}
              className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-50 text-slate-700 font-semibold text-[11px] flex items-center gap-1.5 cursor-pointer transition-all border border-[#CBD5E1]"
              title="Sign out of current store and switch company"
            >
              <LogOut className="w-3 h-3 text-slate-500" />
              <span>Sign Out</span>
            </button>
          </div>
          <h1 className="text-xl font-bold text-[#1E293B] tracking-tight mt-1.5">
            {activeCompany?.supermarketName || 'Store'} Manager &amp; HR Administration
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {activeCompany?.name || activeCompany?.supermarketName || 'Store'} centralized workforce management, biometric logs &amp; payroll supervision
          </p>
        </div>

        {/* Top-Right Navigation Header Controls: Tabs */}
        <div className="flex items-center gap-2 w-full lg:w-auto justify-between lg:justify-end">
          <div className="flex items-center gap-1 p-1 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0] overflow-x-auto">
            {[
              { id: 'OVERVIEW', label: 'Floor Live' },
              { id: 'DIRECTORY', label: `Staff Directory (${employees.length})` },
              { id: 'SHIFTS', label: 'Shift Roster' },
              { 
                id: 'LEAVES', 
                label: pendingLeavesCount > 0 
                  ? `Leaves (${pendingLeavesCount} pending)` 
                  : leaveRequests.length > 0 
                    ? `Leaves (${leaveRequests.length})` 
                    : 'Leaves' 
              },
              { id: 'PAYROLL', label: 'Payroll Export' },
              { 
                id: 'SECURITY', 
                label: unreadSecurityAlertsCount > 0 
                  ? `Security Alerts (${unreadSecurityAlertsCount})` 
                  : securityAlertNotifications.length > 0 
                    ? `Security Alerts (${securityAlertNotifications.length})` 
                    : 'Security Alerts' 
              },
            ].map((tab) => (
              <button
                key={tab.id}
                id={`admin-tab-${tab.id.toLowerCase()}`}
                onClick={() => setAdminTab(tab.id as typeof adminTab)}
                className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                  adminTab === tab.id
                    ? 'bg-[#2563EB] text-white shadow-xs'
                    : 'text-slate-600 hover:text-[#1E293B] hover:bg-slate-200/50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Real-time Floating Security Push Notification Alert Toast (Unrecognizable Face Detected) */}
      {liveSecurityToast && (
        <div className="bg-white rounded-xl p-4 border border-rose-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-shake text-xs text-[#1E293B]">
          <div className="flex items-center gap-3.5 min-w-0">
            {/* Captured Photo Thumbnail */}
            <div className="relative shrink-0">
              {liveSecurityToast.photoUrl || liveSecurityToast.meta?.capturedPhoto ? (
                <img
                  src={liveSecurityToast.photoUrl || liveSecurityToast.meta?.capturedPhoto}
                  alt="Unrecognized individual"
                  className="w-14 h-14 rounded-xl object-cover border border-rose-300 shadow-xs cursor-pointer hover:scale-105 transition-transform"
                  onClick={() => setInspectingAlertPhoto(liveSecurityToast)}
                  title="Click to inspect photo in high resolution"
                />
              ) : (
                <div className="w-14 h-14 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600">
                  <ShieldAlert className="w-7 h-7 animate-bounce" />
                </div>
              )}
              <span className="absolute -bottom-1 -right-1 px-1 py-0.2 rounded bg-rose-600 text-[8px] font-black uppercase text-white font-mono shadow">
                PHOTO
              </span>
            </div>

            <div className="min-w-0 space-y-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 text-[10px] font-mono font-bold flex items-center gap-1 border border-rose-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                  ENTRANCE KIOSK BREACH ALERT
                </span>
                <span className="text-[10px] text-slate-500 font-mono">
                  {liveSecurityToast.timeFormatted || 'Just now'}
                </span>
              </div>
              <h4 className="font-bold text-[#1E293B] text-sm tracking-tight truncate">
                {liveSecurityToast.title || 'Unrecognizable Face Detected at Entrance Kiosk'}
              </h4>
              <p className="text-slate-600 text-[11px] line-clamp-1 leading-snug">
                {liveSecurityToast.message}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
            <button
              type="button"
              id="btn-inspect-toast-photo"
              onClick={() => {
                setInspectingAlertPhoto(liveSecurityToast);
                setAdminTab('SECURITY');
              }}
              className="px-3 py-1.5 rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white font-semibold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition-all active:scale-98"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Inspect Photo</span>
            </button>
            <button
              type="button"
              id="btn-dismiss-security-toast"
              onClick={() => {
                if (onMarkNotificationAsRead) onMarkNotificationAsRead(liveSecurityToast.id);
                setLiveSecurityToast(null);
              }}
              className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 text-xs font-semibold cursor-pointer transition-all border border-slate-200"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Real-time Banner on Successful Staff Enrollment */}
      {enrollSuccessMessage && (
        <div className="bg-white rounded-xl p-4 border border-emerald-200 shadow-xs flex items-center justify-between gap-3 animate-fade-in text-xs text-emerald-900">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-200">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-[#1E293B] text-sm">Staff Member Enrolled!</p>
              <p className="text-slate-600">{enrollSuccessMessage}</p>
            </div>
          </div>
          <button
            onClick={() => setEnrollSuccessMessage(null)}
            className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center cursor-pointer transition-all shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: OVERVIEW & LIVE FLOOR STREAM                                      */}
      {/* ========================================================================= */}
      {adminTab === 'OVERVIEW' && (
        <div className="space-y-6">

          {/* Clean Roster Welcome & Enroll Action Banner */}
          {employees.length === 0 && (
            <div className="bg-white rounded-xl p-5 border border-[#E2E8F0] shadow-xs flex flex-col md:flex-row items-center justify-between gap-4 text-[#1E293B]">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-[#2563EB] shrink-0">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[#1E293B] flex items-center gap-2">
                    <span>{activeCompany?.supermarketName || 'Supermarket'} Workforce Setup</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 border border-[#E2E8F0] text-slate-700 font-mono font-semibold">
                      READY FOR STAFF
                    </span>
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5 max-w-xl">
                    Your roster is ready for setup. Click &ldquo;+ Enroll First Staff Member&rdquo; to add your cashiers, store leads, bakers, and inventory crew with their role, wage, PIN, and face photo.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  id="overview-enroll-first-btn"
                  onClick={handleOpenAddEmp}
                  className="px-5 py-2.5 rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer active:scale-98"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>+ Enroll First Staff Member</span>
                </button>
              </div>
            </div>
          )}
          
          {/* Top Live Counters */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            
            <div className="bg-white rounded-xl p-4 border border-[#E2E8F0] shadow-xs text-[#1E293B]">
              <div className="flex items-center justify-between text-slate-500 text-xs">
                <span>Active Floor Headcount</span>
                <Users className="w-4 h-4 text-[#2563EB]" />
              </div>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-2xl font-bold text-[#1E293B]">{activeFloorStaffCount}</span>
                <span className="text-xs text-slate-500 font-medium">/ {totalStaff} total staff</span>
              </div>
              <div className="mt-3 flex items-center gap-1.5 text-[11px] text-emerald-700 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Active on store floor</span>
              </div>
            </div>

            <div className="bg-white rounded-xl p-4 border border-[#E2E8F0] shadow-xs text-[#1E293B]">
              <div className="flex items-center justify-between text-slate-500 text-xs">
                <span>Late Arrivals Today</span>
                <Clock className="w-4 h-4 text-amber-600" />
              </div>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-2xl font-bold text-[#1E293B]">{lateCount}</span>
                <span className="text-xs text-slate-500 font-medium">exceptions</span>
              </div>
              <div className="mt-3 text-[11px] text-slate-500">
                Grace period: 15 mins applied
              </div>
            </div>

            <div className="bg-white rounded-xl p-4 border border-[#E2E8F0] shadow-xs text-[#1E293B]">
              <div className="flex items-center justify-between text-slate-500 text-xs">
                <span>Biometric FaceID Health</span>
                <ScanFace className="w-4 h-4 text-[#2563EB]" />
              </div>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-2xl font-bold text-[#1E293B]">99.2%</span>
                <span className="text-xs text-slate-500 font-medium">accuracy</span>
              </div>
              <div className="mt-3 text-[11px] text-slate-500">
                Tablet Gate A &amp; Loading Bay online
              </div>
            </div>

            <div className="bg-white rounded-xl p-4 border border-[#E2E8F0] shadow-xs text-[#1E293B]">
              <div className="flex items-center justify-between text-slate-500 text-xs">
                <span>Pending Approvals</span>
                <AlertTriangle className="w-4 h-4 text-[#2563EB]" />
              </div>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-2xl font-bold text-[#1E293B]">{pendingLeavesCount}</span>
                <span className="text-xs text-slate-500 font-medium">leave requests</span>
              </div>
              <div className="mt-3 text-[11px] text-slate-500">
                Requires store manager action
              </div>
            </div>

          </div>

          {/* Main 2-Column Section: Real-Time Stream & Department Readiness */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* LIVE STREAM OF PUNCHES (2 Columns) */}
            <div className="lg:col-span-2 bg-white rounded-xl p-5 border border-[#E2E8F0] shadow-xs space-y-4 text-[#1E293B]">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-[#2563EB]" />
                  <h3 className="text-sm font-bold text-[#1E293B]">Live Attendance Punch Feed</h3>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500 hidden sm:inline">Updating in real-time</span>
                  {attendanceLogs.length > 0 && onClearAttendanceLogs && (
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmModal({
                          title: 'Clear Historical Records',
                          message: 'Clear all historical punch records? This resets the live attendance feed to empty.',
                          confirmText: 'Clear Logs',
                          onConfirm: () => {
                            onClearAttendanceLogs();
                            soundService.playSuccessChime();
                            setConfirmModal(null);
                          },
                        });
                      }}
                      className="px-2.5 py-1 rounded-md bg-white hover:bg-rose-50 text-slate-600 hover:text-rose-600 border border-[#CBD5E1] hover:border-rose-200 text-[11px] font-medium flex items-center gap-1.5 transition-all cursor-pointer"
                      title="Clear punch logs"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Clear Logs</span>
                    </button>
                  )}
                </div>
              </div>

              {employees.length === 0 && attendanceLogs.length > 0 && (
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 text-amber-800">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                    <span>Previous test punches detected ({attendanceLogs.length} records) from before staff directory was cleared.</span>
                  </div>
                  {onClearAttendanceLogs && (
                    <button
                      type="button"
                      onClick={() => {
                        onClearAttendanceLogs();
                        soundService.playSuccessChime();
                      }}
                      className="px-2.5 py-1 rounded-md bg-amber-100 hover:bg-amber-200 text-amber-900 font-semibold text-[11px] whitespace-nowrap transition-colors cursor-pointer"
                    >
                      Clear Test Logs
                    </button>
                  )}
                </div>
              )}

              <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
                {attendanceLogs.length === 0 ? (
                  <div className="py-12 px-4 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-center">
                    <Clock className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                    <p className="text-xs font-semibold text-[#1E293B]">No attendance records logged yet today</p>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                      When your enrolled staff punch in via the Face Kiosk tablet or Staff Mobile App, their live attendance records will appear here immediately.
                    </p>
                  </div>
                ) : (
                  attendanceLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-3 rounded-lg bg-[#F8FAFC] flex items-center justify-between gap-3 border border-[#E2E8F0] hover:border-slate-300 transition-all text-[#1E293B]"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className={`px-3 py-1 min-w-[44px] w-auto text-xs font-semibold whitespace-nowrap rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                          log.type === 'IN'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : log.type === 'OUT'
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : log.type === 'BREAK_START'
                            ? 'bg-amber-50 text-amber-700 border-amber-300'
                            : log.type === 'BREAK_END'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}>
                          {log.type}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-[#1E293B] truncate">{log.employeeName}</span>
                            <span className="text-[10px] font-mono text-slate-500 shrink-0">({log.employeeId})</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5 truncate">
                            <span className="truncate">{log.department}</span>
                            <span>•</span>
                            <span className="font-mono text-slate-700 shrink-0">{formatTime12H(log.time, true)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full border whitespace-nowrap ${
                          log.status === 'ON_TIME'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : log.status === 'LATE'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-slate-100 text-slate-700 border-[#E2E8F0]'
                        }`}>
                          {log.status}
                        </span>
                        <span className="block text-[10px] text-slate-400 mt-0.5 whitespace-nowrap">
                          {log.device === 'KIOSK_FACE' ? 'Face Terminal' : log.device === 'MOBILE_APP_GPS' ? 'Mobile GPS' : 'PIN Pad'}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* DEPARTMENT STAFFING READINESS (1 Column) */}
            <div className="bg-white rounded-xl p-5 border border-[#E2E8F0] shadow-xs space-y-4 text-[#1E293B]">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-[#1E293B]">Department Floor Coverage</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {activeCompany?.supermarketName ? `${activeCompany.supermarketName} • ` : ''}
                    {departmentsList.length} Selected Coverage Zone{departmentsList.length === 1 ? '' : 's'}
                  </p>
                </div>
                <span className="text-xs text-emerald-700 font-semibold">Store Open</span>
              </div>

              <div className="space-y-3">
                {departmentsList.map((dept) => {
                  const deptStaff = employees.filter(e => e.department === dept);
                  const activeInDept = deptStaff.filter(emp => {
                    const latestPunch = attendanceLogs.find(l => l.employeeId === emp.id);
                    return latestPunch ? latestPunch.type === 'IN' : emp.status === 'PRESENT';
                  }).length;
                  const percent = deptStaff.length ? Math.min(100, Math.round((activeInDept / deptStaff.length) * 100)) : 0;

                  return (
                    <div key={dept} className="p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="font-semibold text-[#1E293B] truncate max-w-[160px]">{dept}</span>
                        <span className="font-mono text-slate-600 text-[11px]">
                          {activeInDept}/{deptStaff.length} ({percent}%)
                        </span>
                      </div>
                      {/* Fluid progress bar */}
                      <div className="w-full h-1.5 rounded-full bg-slate-200 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            percent >= 80 ? 'bg-[#2563EB]' : percent >= 40 ? 'bg-amber-500' : 'bg-slate-400'
                          }`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="pt-2 text-[11px] text-slate-500 border-t border-[#E2E8F0] flex items-center gap-1.5 font-medium">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Minimum cashier coverage threshold met.</span>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: STAFF DIRECTORY & ENROLLMENT                                       */}
      {/* ========================================================================= */}
      {adminTab === 'DIRECTORY' && (
        <div className="space-y-4">
          
          {/* Controls Bar */}
          <div className="bg-white rounded-xl p-4 border border-[#E2E8F0] shadow-xs flex flex-col md:flex-row items-center justify-between gap-3 text-[#1E293B]">
            <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="relative flex-1 md:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search staff name, ID, role"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg pl-9 pr-3 py-2 text-xs text-[#1E293B] placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#2563EB] focus:border-[#2563EB]"
                />
              </div>

              <select
                value={selectedDepartmentFilter}
                onChange={(e) => setSelectedDepartmentFilter(e.target.value)}
                className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 py-2 text-xs text-[#1E293B] focus:outline-none focus:ring-1 focus:ring-[#2563EB] cursor-pointer"
              >
                <option value="ALL">All Departments</option>
                {departmentsList.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto justify-end">
              <button
                id="admin-enroll-new-staff-btn"
                onClick={handleOpenAddEmp}
                className="px-3.5 py-2 rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer active:scale-95"
              >
                <UserPlus className="w-4 h-4" />
                <span>+ Enroll New Staff</span>
              </button>

              {employees.length > 0 && (
                <button
                  id="admin-clear-staff-btn"
                  onClick={handleClearAllPrompt}
                  title="Clear all enrolled employees to start fresh"
                  className="px-3 py-2 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-medium text-xs transition-all flex items-center gap-1 whitespace-nowrap cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Clear Roster</span>
                </button>
              )}
            </div>
          </div>

          {/* Employee Directory Table */}
          <div className="bg-white rounded-xl overflow-hidden border border-[#E2E8F0] shadow-xs">
            {filteredEmployees.length === 0 ? (
              <div className="py-16 text-center px-4">
                <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#2563EB] mx-auto mb-3">
                  <Users className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-[#1E293B]">{activeCompany?.supermarketName || 'Supermarket'} Staff Directory</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  {employees.length === 0
                    ? `No staff members enrolled yet. You are in full control — click "+ Enroll Staff Member" to add your supermarket staff with their real details, biometric face, and 4-digit PIN.`
                    : 'No staff match the current search filter.'}
                </p>
                <div className="flex items-center justify-center gap-2.5 mt-4 flex-wrap">
                  <button
                    id="admin-enroll-first-staff-btn"
                    onClick={handleOpenAddEmp}
                    className="px-5 py-2.5 rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition-all cursor-pointer flex items-center gap-2"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>+ Enroll Staff Member</span>
                  </button>
                </div>

                {employees.length === 0 && (
                  <div className="mt-8 max-w-xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
                    <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-1">
                      <div className="w-6 h-6 rounded-md bg-blue-50 text-[#2563EB] font-bold text-xs flex items-center justify-center">1</div>
                      <h4 className="text-[#1E293B] font-semibold text-xs">Verify Shifts</h4>
                      <p className="text-[11px] text-slate-500 leading-tight">Default shifts are ready or customizable in Shifts tab.</p>
                    </div>
                    <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-1">
                      <div className="w-6 h-6 rounded-md bg-blue-50 text-[#2563EB] font-bold text-xs flex items-center justify-center">2</div>
                      <h4 className="text-[#1E293B] font-semibold text-xs">Add Staff Member</h4>
                      <p className="text-[11px] text-slate-500 leading-tight">Enter name, role, department, wage rate, 4-digit PIN, & face photo.</p>
                    </div>
                    <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-1">
                      <div className="w-6 h-6 rounded-md bg-blue-50 text-[#2563EB] font-bold text-xs flex items-center justify-center">3</div>
                      <h4 className="text-[#1E293B] font-semibold text-xs">Live Auto-Sync</h4>
                      <p className="text-[11px] text-slate-500 leading-tight">Automatically syncs to Kiosk and Mobile Staff App in real-time.</p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-slate-600 uppercase tracking-wider text-[11px] font-semibold">
                    <tr>
                      <th className="py-3 px-4">Staff Member</th>
                      <th className="py-3 px-4">Department & Role</th>
                      <th className="py-3 px-4">Shift Timings</th>
                      <th className="py-3 px-4">Biometrics & Punch</th>
                      <th className="py-3 px-4">Staff PIN</th>
                      <th className="py-3 px-4">Salary / Wages (₹)</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0] text-[#1E293B]">
                    {filteredEmployees.map((emp) => {
                      const shift = shifts.find(s => s.id === emp.shiftId);
                      return (
                        <tr key={emp.id} className="hover:bg-slate-50/75 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <img
                                src={emp.avatar}
                                alt={emp.name}
                                className="w-9 h-9 rounded-lg object-cover border border-[#E2E8F0]"
                              />
                              <div>
                                <span className="font-semibold text-[#1E293B] block text-sm">{emp.name}</span>
                                <span className="font-mono text-[10px] text-slate-500 font-semibold">{emp.id}</span>
                              </div>
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            <span className="text-[#1E293B] font-medium block">{emp.role}</span>
                            <span className="text-[11px] text-slate-500">{emp.department}</span>
                          </td>

                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                              {shift?.name}
                            </span>
                            <span className="block text-[10px] text-slate-500 mt-0.5">{shift?.badge}</span>
                          </td>

                          <td className="py-3 px-4">
                            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-medium">
                              <CheckCircle2 className="w-3.5 h-3.5" /> FaceID Active
                            </span>
                            <span className="block text-[10px] text-slate-500 mt-0.5">
                              {emp.allowMobilePunch === false ? (
                                <span className="text-amber-700 font-medium">Entrance Kiosk Only</span>
                              ) : (
                                <span className="text-blue-700 font-medium">Mobile + Kiosk</span>
                              )}
                            </span>
                          </td>

                          <td className="py-3 px-4 font-mono text-slate-700 font-semibold">
                            {emp.pin}
                          </td>

                          <td className="py-3 px-4">
                            <span className="font-bold text-[#1E293B] font-mono text-sm block">
                              {formatSalaryRate(emp.payBasis, emp.wageRate, emp.hourlyRate)}
                            </span>
                            <span className="text-[10px] text-slate-500">
                              {emp.payBasis === 'DAILY' ? 'Daily Wage' : emp.payBasis === 'WEEKLY' ? 'Weekly Wage' : 'Monthly Salary'}
                            </span>
                          </td>

                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleStartEdit(emp)}
                                title="Edit employee details"
                                className="p-1.5 rounded-lg border border-[#E2E8F0] text-slate-600 hover:text-[#1E293B] hover:bg-slate-100 transition-all cursor-pointer"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() => handleDeletePrompt(emp)}
                                title="Delete employee from roster"
                                className="p-1.5 rounded-lg border border-rose-200 text-rose-600 hover:text-rose-800 hover:bg-rose-50 transition-all cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() => {
                                  onManualPunch({
                                    employeeId: emp.id,
                                    employeeName: emp.name,
                                    department: emp.department,
                                    type: 'IN',
                                    device: 'KIOSK_FACE',
                                    kioskLocation: 'Admin Manual Overwrite',
                                    status: 'ON_TIME',
                                    notes: 'Admin triggered manual attendance adjustment.',
                                  });
                                  soundService.playSuccessChime();
                                }}
                                className="px-2 py-1 rounded-lg bg-blue-50 border border-blue-200 text-[10px] font-semibold text-[#2563EB] hover:bg-blue-100 transition-all cursor-pointer"
                              >
                                + Punch
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: SHIFT ROSTER SCHEDULER                                            */}
      {/* ========================================================================= */}
      {adminTab === 'SHIFTS' && (
        <div className="space-y-6 text-[#1E293B]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-[#1E293B] flex items-center gap-2">
                <span>Supermarket Shift Schedules</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-[#2563EB] border border-blue-200 font-mono font-semibold">
                  {shifts.length} active rosters
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Adjusting shift timings automatically broadcasts in-app notifications to all supermarket staff devices.
              </p>
            </div>

            {shiftBroadcastAlert && (
              <div className="px-3.5 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2 animate-fade-in">
                <Check className="w-4 h-4 text-emerald-600" />
                <span>{shiftBroadcastAlert}</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {shifts.map((shift) => {
              const assigned = employees.filter(e => e.shiftId === shift.id);
              return (
                <div key={shift.id} className="bg-white rounded-xl p-5 space-y-3.5 border border-[#E2E8F0] shadow-xs flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                        {shift.code}
                      </span>
                      <span className="text-xs font-mono text-[#2563EB] font-bold bg-blue-50 px-2.5 py-0.5 rounded-md border border-blue-100">
                        {shift.badge}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-base font-bold text-[#1E293B]">{shift.name}</h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Grace period: <strong className="text-slate-800 font-medium">{shift.gracePeriodMins} mins</strong> before marked late
                      </p>
                    </div>

                    <div className="pt-2 border-t border-[#E2E8F0]">
                      <div className="flex items-center justify-between text-xs text-slate-500 mb-2 font-medium">
                        <span>Assigned Crew:</span>
                        <span className="text-[#1E293B] font-semibold">{assigned.length} staff</span>
                      </div>
                      {assigned.length === 0 ? (
                        <span className="text-[11px] text-slate-400 italic block py-2">
                          No staff assigned to this shift yet.
                        </span>
                      ) : (
                        <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                          {assigned.map(emp => (
                            <div key={emp.id} className="flex items-center justify-between text-xs p-1.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                              <span className="font-medium text-[#1E293B] truncate mr-2">{emp.name}</span>
                              <span className="text-[10px] text-slate-500 shrink-0">{emp.department.split('&')[0]}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {onUpdateShift && (
                    <div className="pt-3 border-t border-[#E2E8F0]">
                      <button
                        onClick={() => handleStartEditShift(shift)}
                        className="w-full py-2 px-3 rounded-lg bg-blue-50 hover:bg-blue-100 text-[#2563EB] font-semibold text-xs flex items-center justify-center gap-1.5 transition-all border border-blue-200 cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>Edit Timing & Notify Staff</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Broadcasts & Notification Center Feed in Admin */}
          {notifications && notifications.length > 0 && (
            <div className="bg-white rounded-xl p-5 border border-[#E2E8F0] shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-[#1E293B] flex items-center gap-2">
                  <Bell className="w-4 h-4 text-[#2563EB]" />
                  <span>Recent Staff In-App Notification Alerts ({notifications.length})</span>
                </h4>
                <span className="text-[10px] text-slate-400 font-mono">Synchronized via Firestore real-time</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {notifications.slice(0, 6).map((notif) => (
                  <div key={notif.id} className="p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${
                        notif.type === 'LEAVE_STATUS'
                          ? notif.leaveStatus === 'APPROVED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                          : 'bg-blue-50 text-[#2563EB] border border-blue-200'
                      }`}>
                        {notif.type === 'LEAVE_STATUS' ? `LEAVE ${notif.leaveStatus || 'UPDATE'}` : 'SHIFT ROSTER'}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">{notif.timeFormatted}</span>
                    </div>
                    <h5 className="font-semibold text-[#1E293B] text-xs">{notif.title}</h5>
                    <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed">{notif.message}</p>
                    <div className="text-[10px] text-slate-500 pt-1 flex items-center justify-between">
                      <span>Target: <strong className="text-slate-800">{notif.employeeName || notif.employeeId}</strong></span>
                      <span className={notif.read ? 'text-slate-400' : 'text-amber-700 font-semibold'}>
                        {notif.read ? 'Seen' : 'Unread'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Edit Shift Schedule Modal */}
      {editingShift && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-500/20 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-md bg-white rounded-2xl p-6 border border-[#E2E8F0] shadow-xl space-y-5 text-[#1E293B]">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-blue-50 text-[#2563EB] border border-blue-100">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#1E293B]">Edit Shift Schedule</h3>
                  <p className="text-xs text-slate-500">{editingShift.code} • {editingShift.name}</p>
                </div>
              </div>
              <button
                onClick={() => setEditingShift(null)}
                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Shift Name</label>
                <input
                  type="text"
                  value={shiftEditName}
                  onChange={(e) => setShiftEditName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-[#1E293B] font-medium focus:outline-none focus:ring-1 focus:ring-[#2563EB] focus:border-[#2563EB]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Start Time (24H)</label>
                  <input
                    type="time"
                    value={shiftEditStart}
                    onChange={(e) => setShiftEditStart(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-[#1E293B] font-mono focus:outline-none focus:ring-1 focus:ring-[#2563EB] focus:border-[#2563EB]"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">End Time (24H)</label>
                  <input
                    type="time"
                    value={shiftEditEnd}
                    onChange={(e) => setShiftEditEnd(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-[#1E293B] font-mono focus:outline-none focus:ring-1 focus:ring-[#2563EB] focus:border-[#2563EB]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Grace Period (Minutes)</label>
                <input
                  type="number"
                  min="0"
                  max="60"
                  value={shiftEditGrace}
                  onChange={(e) => setShiftEditGrace(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-[#1E293B] font-mono focus:outline-none focus:ring-1 focus:ring-[#2563EB] focus:border-[#2563EB]"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Staff punches within this window are logged as ON_TIME.
                </span>
              </div>

              {/* Live Preview */}
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-100 text-slate-700 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 font-medium">Roster Badge Preview:</span>
                  <span className="text-xs font-mono font-bold text-[#2563EB]">
                    {formatShiftBadge(shiftEditStart, shiftEditEnd)}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 pt-1">
                  📢 <strong>In-App Alert:</strong> Saving will immediately dispatch a high-priority in-app notification to all staff informing them of this roster schedule change.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#E2E8F0]">
              <button
                type="button"
                onClick={() => setEditingShift(null)}
                className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveShiftEdit}
                className="px-4 py-2 rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
              >
                <Bell className="w-3.5 h-3.5" />
                <span>Save & Broadcast to Staff</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: LEAVE REQUEST APPROVALS                                           */}
      {/* ========================================================================= */}
      {adminTab === 'LEAVES' && (
        <div className="space-y-4 text-[#1E293B]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-[#1E293B] flex items-center gap-2">
                <span>Staff Leave Applications</span>
                {pendingLeavesCount > 0 ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-bold">
                    {pendingLeavesCount} pending review
                  </span>
                ) : (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 font-mono">
                    All reviewed
                  </span>
                )}
              </h3>
              <span className="text-xs text-slate-500">
                {leaveRequests.length} total application{leaveRequests.length === 1 ? '' : 's'} • Approving or rejecting instantly sends an in-app notification to the employee's phone.
              </span>
            </div>

            {leaveActionFeedback && (
              <div className="px-3.5 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2 animate-fade-in">
                <Bell className="w-4 h-4 text-emerald-600" />
                <span>{leaveActionFeedback}</span>
              </div>
            )}

            {leaveRequests.length > 0 && onClearAllLeaves && (
              <button
                id="btn-clear-all-leaves"
                onClick={() => {
                  setConfirmModal({
                    title: 'Clear Leave Records',
                    message: 'Are you sure you want to clear all leave applications from history?',
                    confirmText: 'Clear All Leaves',
                    onConfirm: () => {
                      onClearAllLeaves();
                      soundService.playSuccessChime();
                      setConfirmModal(null);
                    },
                  });
                }}
                className="px-3.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer self-start sm:self-auto"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear All Leave Records</span>
              </button>
            )}
          </div>

          {/* Orphaned leaves warning banner (e.g. staff was deleted) */}
          {orphanedLeaves.length > 0 && (
            <div className="rounded-xl p-4 bg-amber-50 border border-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-900 text-xs">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-slate-900 text-sm">
                    {orphanedLeaves.length} Leave Application{orphanedLeaves.length === 1 ? '' : 's'} from Removed Staff
                  </p>
                  <p className="text-amber-800 mt-0.5">
                    Staff ({orphanedLeaves.map((l) => l.employeeName).join(', ')}) was removed from the staff directory, but their previous leave application remains in history.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                {onClearOrphanedLeaves && (
                  <button
                    onClick={onClearOrphanedLeaves}
                    className="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Removed Staff Leaves</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {leaveRequests.length === 0 ? (
            <div className="py-12 px-4 rounded-xl bg-white border border-[#E2E8F0] shadow-xs text-center">
              <Calendar className="w-10 h-10 text-slate-400 mx-auto mb-2" />
              <p className="text-sm font-semibold text-[#1E293B]">No leave requests submitted yet</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                When your {activeCompany?.supermarketName || 'supermarket'} employees submit leave requests via their Staff Mobile App, they will appear here for manager review and approval.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {leaveRequests.map((leave) => {
                const isOrphaned = !employees.some(
                  (e) => e.id === leave.employeeId || e.name.trim().toLowerCase() === leave.employeeName.trim().toLowerCase()
                );

                return (
                  <div key={leave.id} className="bg-white rounded-xl p-5 space-y-3 border border-[#E2E8F0] shadow-xs relative group">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-base font-bold text-[#1E293B]">{leave.employeeName}</h4>
                          {isOrphaned && (
                            <span className="text-[10px] px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 font-medium">
                              Removed Staff
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-slate-500">{leave.department}</span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${
                          leave.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                          leave.status === 'REJECTED' ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {leave.status}
                        </span>
                        {onDeleteLeave && (
                          <button
                            onClick={() => onDeleteLeave(leave.id)}
                            title="Delete this leave application"
                            className="p-1.5 rounded-lg border border-[#E2E8F0] hover:bg-rose-50 text-slate-500 hover:text-rose-700 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="bg-[#F8FAFC] rounded-lg p-3 text-xs space-y-1 border border-[#E2E8F0]">
                      <div className="flex items-center justify-between text-slate-600">
                        <span>Leave Type:</span>
                        <strong className="text-[#1E293B] font-semibold">{leave.type} LEAVE</strong>
                      </div>
                      <div className="flex items-center justify-between text-slate-600">
                        <span>Period:</span>
                        <strong className="text-[#1E293B] font-semibold">{leave.startDate} → {leave.endDate}</strong>
                      </div>
                      <div className="pt-2 text-slate-700 text-xs border-t border-[#E2E8F0]">
                        "{leave.reason}"
                      </div>
                    </div>

                    {leave.status === 'PENDING' ? (
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() => {
                            onApproveLeave(leave.id, 'APPROVED');
                            setLeaveActionFeedback(`Approved leave for ${leave.employeeName}. In-app alert sent to staff!`);
                            setTimeout(() => setLeaveActionFeedback(null), 3500);
                          }}
                          className="flex-1 py-2 rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer active:scale-95 transition-all"
                        >
                          <CheckCircle2 className="w-4 h-4" /> Approve
                        </button>
                        <button
                          onClick={() => {
                            onApproveLeave(leave.id, 'REJECTED');
                            setLeaveActionFeedback(`Rejected leave for ${leave.employeeName}. In-app alert sent to staff!`);
                            setTimeout(() => setLeaveActionFeedback(null), 3500);
                          }}
                          className="flex-1 py-2 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-xs flex items-center justify-center gap-1.5 border border-rose-200 cursor-pointer transition-all"
                        >
                          <XCircle className="w-4 h-4" /> Reject
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500 border-t border-[#E2E8F0]">
                        <span className="flex items-center gap-1.5">
                          <span>Decision:</span>
                          <strong className={leave.status === 'APPROVED' ? 'text-emerald-700' : 'text-rose-700'}>
                            {leave.status}
                          </strong>
                        </span>
                        {onDeleteLeave && (
                          <button
                            onClick={() => onDeleteLeave(leave.id)}
                            className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-medium text-xs flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Delete Record</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: PAYROLL & TIMESHEET EXPORT                                        */}
      {/* ========================================================================= */}
      {adminTab === 'PAYROLL' && (
        <div className="space-y-4 text-[#1E293B]">
          <div className="bg-white rounded-xl p-6 border border-[#E2E8F0] shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-[#1E293B]">Payroll & Timesheet Generation</h3>
              <p className="text-xs text-slate-500 mt-1">
                Compile shifts, hourly compensation, late deductions, and overtime across all supermarket departments.
              </p>
            </div>

            <button
              id="admin-export-csv-btn"
              onClick={exportAttendanceCSV}
              className="px-5 py-2.5 rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white font-semibold text-xs shadow-xs flex items-center gap-2 cursor-pointer active:scale-95 transition-all"
            >
              <Download className="w-4 h-4" />
              <span>Export Timesheet (CSV / Excel)</span>
            </button>
          </div>

          <div className="bg-white rounded-xl p-5 border border-[#E2E8F0] shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-[#E2E8F0]">
              <div>
                <h4 className="text-sm font-bold text-[#1E293B]">Estimated Monthly Payroll Breakdown</h4>
                <p className="text-xs text-slate-500">Calculated according to each staff member's Daily Wage, Weekly Wage, or Monthly Salary</p>
              </div>
              <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 font-semibold text-xs border border-slate-200 self-start sm:self-auto">
                Currency: Indian Rupee (₹)
              </span>
            </div>

            {employees.length === 0 ? (
              <div className="py-12 px-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-center">
                <Users className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                <p className="text-sm font-semibold text-[#1E293B]">No employees on payroll roster yet</p>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Add your employees with their daily or weekly wage in the Staff Directory tab to generate payroll breakdowns.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[#E2E8F0] text-xs">
                {employees.map((emp) => {
                  const payBasis = emp.payBasis || 'DAILY';
                  let basePay = 0;
                  let hourlyEquiv = 0;
                  let baseLabel = 'BASE';

                  if (payBasis === 'DAILY') {
                    const dailyRate = emp.wageRate || (emp.hourlyRate ? emp.hourlyRate * 8 : 650);
                    basePay = dailyRate * 26; // 26 working days in month
                    hourlyEquiv = dailyRate / 8;
                    baseLabel = 'BASE (26 Days)';
                  } else if (payBasis === 'WEEKLY') {
                    const weeklyRate = emp.wageRate || (emp.hourlyRate ? emp.hourlyRate * 48 : 4200);
                    basePay = weeklyRate * 4; // 4 weeks in month
                    hourlyEquiv = weeklyRate / 48;
                    baseLabel = 'BASE (4 Weeks)';
                  } else {
                    const monthlyRate = emp.wageRate || (emp.hourlyRate ? emp.hourlyRate * 200 : 18000);
                    basePay = monthlyRate;
                    hourlyEquiv = monthlyRate / 200;
                    baseLabel = 'BASE (Monthly)';
                  }

                  const otHours = 6;
                  const otPay = Math.round(otHours * (hourlyEquiv * 1.5));
                  const totalGross = basePay + otPay;

                  return (
                    <div key={emp.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <img src={emp.avatar} alt="" className="w-9 h-9 rounded-lg object-cover border border-[#E2E8F0]" />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-[#1E293B] block">{emp.name}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono border border-slate-200">
                              {formatSalaryRate(emp.payBasis, emp.wageRate, emp.hourlyRate)}
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-500">{emp.department} • {emp.role}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 sm:gap-6 text-right font-mono justify-end">
                        <div>
                          <span className="text-[10px] text-slate-500 block">{baseLabel}</span>
                          <span className="text-[#1E293B] font-semibold">{formatCurrencyINR(basePay)}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block">OT (+{otHours}h)</span>
                          <span className="text-amber-700 font-semibold">+{formatCurrencyINR(otPay)}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block">EST. GROSS</span>
                          <span className="text-[#2563EB] font-bold text-sm">{formatCurrencyINR(totalGross)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 6: SECURITY & ENTRANCE KIOSK SURVEILLANCE                            */}
      {/* ========================================================================= */}
      {adminTab === 'SECURITY' && (
        <div className="space-y-6 text-[#1E293B] animate-fade-in">
          
          {/* Header Security Status Command Card */}
          <div className="bg-white rounded-xl p-6 border border-[#E2E8F0] shadow-xs flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center text-red-600 shrink-0">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-lg font-bold text-[#1E293B] tracking-tight">
                    Entrance Kiosk Security &amp; Biometric Protection
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 font-mono text-[10px] font-bold uppercase">
                    NON-STAFF ACCESS DENIED
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
                  Real-time perimeter surveillance for <strong>{activeCompany?.supermarketName || 'Supermarket'}</strong>. 
                  When non-staff or strangers attempt face verification, the Entrance Kiosk denies access, captures a high-resolution photo, and immediately pushes an alert here.
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2.5 flex-wrap self-end lg:self-center">
              {unreadSecurityAlertsCount > 0 && (
                <button
                  type="button"
                  id="btn-mark-all-security-reviewed"
                  onClick={() => {
                    securityAlertNotifications.forEach((n) => {
                      if (!n.read && onMarkNotificationAsRead) {
                        onMarkNotificationAsRead(n.id);
                      }
                    });
                    soundService.playSuccessChime();
                  }}
                  className="px-3.5 py-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-[#2563EB] text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all border border-blue-200"
                >
                  <CheckCheck className="w-4 h-4 text-[#2563EB]" />
                  <span>Mark All Reviewed</span>
                </button>
              )}

              {securityAlertNotifications.length > 0 && onClearAllNotifications && (
                <button
                  type="button"
                  id="btn-clear-security-alerts"
                  onClick={() => {
                    setConfirmModal({
                      title: 'Clear Security Incident Logs',
                      message: 'Are you sure you want to clear all security incident alerts and captured photos from this store console?',
                      confirmText: 'Clear Security Logs',
                      onConfirm: () => {
                        onClearAllNotifications();
                        soundService.playSuccessChime();
                        setConfirmModal(null);
                      },
                    });
                  }}
                  className="px-3.5 py-2 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-all border border-rose-200"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Clear Logs</span>
                </button>
              )}
            </div>
          </div>

          {/* Key Security Surveillance Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl p-4 border border-[#E2E8F0] shadow-xs space-y-1">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Kiosk Gate Status</span>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              </div>
              <p className="text-lg font-bold text-emerald-700">ARMED &amp; ONLINE</p>
              <p className="text-[11px] text-slate-500 truncate">{activeCompany?.supermarketName || 'Store'} Entrance Terminal</p>
            </div>

            <div className="bg-white rounded-xl p-4 border border-[#E2E8F0] shadow-xs space-y-1">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Unrecognizable Faces Blocked</span>
                <ShieldAlert className="w-4 h-4 text-rose-600" />
              </div>
              <p className="text-lg font-bold text-rose-700">
                {securityAlertNotifications.length} <span className="text-xs text-slate-500 font-normal">incidents</span>
              </p>
              <p className="text-[11px] text-rose-600 font-medium">
                {unreadSecurityAlertsCount > 0 ? `${unreadSecurityAlertsCount} pending manager review` : 'All incidents reviewed'}
              </p>
            </div>

            <div className="bg-white rounded-xl p-4 border border-[#E2E8F0] shadow-xs space-y-1">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Biometric Staff Vault</span>
                <Users className="w-4 h-4 text-[#2563EB]" />
              </div>
              <p className="text-lg font-bold text-[#1E293B]">{employees.length} Enrolled</p>
              <p className="text-[11px] text-slate-500">Authorized for entrance access</p>
            </div>

            <div className="bg-white rounded-xl p-4 border border-[#E2E8F0] shadow-xs space-y-1">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Intruder Policy</span>
                <Lock className="w-4 h-4 text-purple-600" />
              </div>
              <p className="text-lg font-bold text-purple-700">ZERO TOLERANCE</p>
              <p className="text-[11px] text-slate-500">Photo captured upon non-staff verification</p>
            </div>
          </div>

          {/* Security Alert Feed */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h4 className="text-sm font-bold text-[#1E293B] flex items-center gap-2">
                <Bell className="w-4 h-4 text-rose-600" />
                <span>Security Incident Feed &bull; Photo Evidence Log ({securityAlertNotifications.length})</span>
              </h4>
              <span className="text-xs text-slate-500">Click any photo to view full-resolution surveillance capture</span>
            </div>

            {securityAlertNotifications.length === 0 ? (
              <div className="bg-white rounded-xl p-10 text-center border border-[#E2E8F0] shadow-xs flex flex-col items-center justify-center space-y-3">
                <div className="w-14 h-14 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                  <ShieldCheck className="w-7 h-7" />
                </div>
                <h4 className="text-base font-bold text-[#1E293B]">No Security Breaches Detected</h4>
                <p className="text-xs text-slate-500 max-w-md">
                  All face scans at the Entrance Kiosk have belonged to enrolled supermarket staff members. 
                  If an unauthorized non-staff individual attempts to scan their face, their photo and alert will appear here immediately.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {securityAlertNotifications.map((alert) => {
                  const photo = alert.photoUrl || alert.meta?.capturedPhoto;
                  const isUnread = !alert.read;
                  return (
                    <div
                      key={alert.id}
                      className={`rounded-xl p-4 sm:p-5 border transition-all ${
                        isUnread
                          ? 'border-rose-300 bg-rose-50/50 shadow-xs'
                          : 'border-[#E2E8F0] bg-white shadow-xs'
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        {/* High-res Photo Thumbnail with Zoom Indicator */}
                        <div className="relative shrink-0 group">
                          {photo ? (
                            <div 
                              onClick={() => setInspectingAlertPhoto(alert)}
                              className="relative cursor-pointer overflow-hidden rounded-xl border border-rose-300 shadow-xs group-hover:scale-105 transition-all"
                            >
                              <img
                                src={photo}
                                alt="Captured Unrecognized Individual"
                                className="w-24 h-24 sm:w-28 sm:h-28 object-cover bg-slate-100"
                              />
                              <div className="absolute inset-0 bg-[#2563EB]/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                                <ZoomIn className="w-6 h-6" />
                              </div>
                              <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-rose-600 text-white font-mono text-[8px] font-bold uppercase">
                                EVIDENCE
                              </span>
                            </div>
                          ) : (
                            <div className="w-24 h-24 rounded-xl bg-rose-50 border border-rose-200 flex flex-col items-center justify-center text-rose-600">
                              <ShieldAlert className="w-7 h-7" />
                              <span className="text-[9px] font-bold mt-1">NO PHOTO</span>
                            </div>
                          )}
                        </div>

                        {/* Incident Metadata & Details */}
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <div className="flex items-center justify-between gap-1 flex-wrap">
                            <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-mono text-[10px] font-bold border border-rose-200">
                              UNRECOGNIZABLE FACE
                            </span>
                            <span className="text-[11px] text-slate-500 font-mono">
                              {alert.timeFormatted || new Date(alert.timestamp).toLocaleTimeString()}
                            </span>
                          </div>

                          <h5 className="font-bold text-[#1E293B] text-sm leading-snug">
                            {alert.title}
                          </h5>

                          <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">
                            {alert.message}
                          </p>

                          <div className="pt-1 text-[11px] text-slate-500 flex flex-col gap-0.5">
                            <span className="truncate">
                              Location: <strong className="text-slate-800">{alert.meta?.kioskLocation || `${activeCompany?.supermarketName || 'Store'} Entrance Terminal`}</strong>
                            </span>
                            <span className="text-rose-700 font-semibold font-mono">
                              Biometric Score: 0.0% Match (No enrolled staff match)
                            </span>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-2 pt-2 flex-wrap">
                            {photo && (
                              <button
                                type="button"
                                onClick={() => setInspectingAlertPhoto(alert)}
                                className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 hover:text-rose-900 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all border border-rose-200"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>Inspect Photo</span>
                              </button>
                            )}

                            {isUnread && onMarkNotificationAsRead && (
                              <button
                                type="button"
                                onClick={() => {
                                  onMarkNotificationAsRead(alert.id);
                                  soundService.playSuccessChime();
                                }}
                                className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-[#2563EB] text-xs font-semibold flex items-center gap-1 cursor-pointer transition-all border border-blue-200"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Mark Reviewed</span>
                              </button>
                            )}

                            {onDeleteNotification && (
                              <button
                                type="button"
                                onClick={() => {
                                  onDeleteNotification(alert.id);
                                  soundService.playNotificationTone();
                                }}
                                className="p-1 rounded-lg text-slate-400 hover:text-rose-600 ml-auto cursor-pointer transition-all"
                                title="Delete incident record"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      )}

      {/* FULL-SCREEN PHOTO EVIDENCE INSPECTION MODAL */}
      {inspectingAlertPhoto && (
        <div className="fixed inset-0 z-50 bg-slate-500/20 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-fade-in text-[#1E293B]">
          <div className="w-full max-w-lg bg-white rounded-2xl border border-[#E2E8F0] shadow-2xl animate-scale-in flex flex-col overflow-hidden max-h-[92vh]">
            
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-[#E2E8F0] flex items-center justify-between bg-[#F8FAFC] shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-200">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#1E293B]">Security Photo Inspection</h3>
                  <p className="text-[11px] text-slate-500 font-mono">
                    Incident ID: {inspectingAlertPhoto.id}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInspectingAlertPhoto(null)}
                className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center cursor-pointer transition-all shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4 flex flex-col items-center">
              {/* Photo Display */}
              <div className="relative w-full max-w-sm rounded-xl overflow-hidden border border-[#E2E8F0] shadow-sm bg-slate-100">
                {inspectingAlertPhoto.photoUrl || inspectingAlertPhoto.meta?.capturedPhoto ? (
                  <img
                    src={inspectingAlertPhoto.photoUrl || inspectingAlertPhoto.meta?.capturedPhoto}
                    alt="Captured intruder snapshot"
                    className="w-full h-auto max-h-[380px] object-contain"
                  />
                ) : (
                  <div className="w-full h-64 flex flex-col items-center justify-center text-slate-400">
                    <Camera className="w-12 h-12 text-slate-400 mb-2" />
                    <span>No snapshot data attached</span>
                  </div>
                )}
              </div>

              {/* Forensic Details Breakdown */}
              <div className="w-full p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2 text-xs">
                <div className="flex items-center justify-between py-1 border-b border-[#E2E8F0]">
                  <span className="text-slate-500 font-medium">Incident Type:</span>
                  <span className="text-rose-700 font-mono font-bold">UNRECOGNIZED_FACE (Access Denied)</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-[#E2E8F0]">
                  <span className="text-slate-500 font-medium">Detection Timestamp:</span>
                  <span className="text-[#1E293B] font-mono">{inspectingAlertPhoto.timeFormatted} ({new Date(inspectingAlertPhoto.timestamp).toLocaleDateString()})</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-[#E2E8F0]">
                  <span className="text-slate-500 font-medium">Terminal Location:</span>
                  <span className="text-slate-800">{inspectingAlertPhoto.meta?.kioskLocation || `${activeCompany?.supermarketName || 'Store'} Entrance Terminal`}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-[#E2E8F0]">
                  <span className="text-slate-500 font-medium">Biometric Similarity:</span>
                  <span className="text-rose-700 font-bold font-mono">0.0% (No enrolled staff match found)</span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-slate-500 font-medium">Security Action Taken:</span>
                  <span className="text-emerald-700 font-semibold">DOOR LOCKED &bull; PHOTO TRANSMITTED</span>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-between gap-3 shrink-0">
              <button
                type="button"
                onClick={() => {
                  const photo = inspectingAlertPhoto.photoUrl || inspectingAlertPhoto.meta?.capturedPhoto;
                  if (photo) {
                    const link = document.createElement('a');
                    link.href = photo;
                    link.download = `Security_Incident_${inspectingAlertPhoto.id}.jpg`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }
                }}
                className="px-3.5 py-2 rounded-lg bg-white border border-[#E2E8F0] hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Save Evidence (.jpg)</span>
              </button>

              <div className="flex items-center gap-2">
                {!inspectingAlertPhoto.read && onMarkNotificationAsRead && (
                  <button
                    type="button"
                    onClick={() => {
                      onMarkNotificationAsRead(inspectingAlertPhoto.id);
                      setInspectingAlertPhoto((prev) => prev ? { ...prev, read: true } : null);
                      soundService.playSuccessChime();
                    }}
                    className="px-3.5 py-2 rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white font-semibold text-xs flex items-center gap-1.5 cursor-pointer transition-all shadow-xs active:scale-95"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Mark as Reviewed</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setInspectingAlertPhoto(null)}
                  className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs cursor-pointer transition-all"
                >
                  Close
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ENROLL EMPLOYEE MODAL */}
      {showAddEmpModal && (
        <div className="fixed inset-0 z-50 bg-slate-500/20 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 text-[#1E293B]">
          <div className="w-full max-w-lg bg-white rounded-2xl border border-[#E2E8F0] shadow-2xl animate-scale-in flex flex-col max-h-[92vh] overflow-hidden">
            {/* Pinned Modal Header */}
            <div className="p-4 sm:p-5 border-b border-[#E2E8F0] flex items-center justify-between shrink-0 bg-[#F8FAFC]">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base sm:text-lg font-bold text-[#1E293B]">Enroll {activeCompany?.supermarketName || 'Store'} Staff</h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-[#2563EB] border border-blue-200 font-mono font-semibold">
                    BIOMETRICS READY
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">Add staff details, assign shift, and enroll face signature for {activeCompany?.supermarketName || 'store'}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddEmpModal(false)}
                className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center cursor-pointer transition-all shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleEnrollEmployee} className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 pr-3">
                {/* Validation Error Banner */}
                {enrollError && (
                  <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2 animate-shake">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span className="font-semibold">{enrollError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">Employee ID (Optional)</label>
                    <input
                      type="text"
                      placeholder="Employee ID"
                      value={newEmpId}
                      onChange={(e) => setNewEmpId(e.target.value)}
                      className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 py-2 text-xs text-[#1E293B] font-mono focus:ring-1 focus:ring-[#2563EB] focus:border-[#2563EB] outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">Full Name *</label>
                    <input
                      id="enroll-staff-name-input"
                      type="text"
                      placeholder="Full name"
                      value={newEmpName}
                      onChange={(e) => {
                        setNewEmpName(e.target.value);
                        if (enrollError) setEnrollError(null);
                      }}
                      className={`w-full bg-[#F8FAFC] border rounded-lg px-3 py-2 text-xs text-[#1E293B] outline-none ${
                        enrollError && !newEmpName.trim() ? 'border-rose-500 ring-1 ring-rose-500' : 'border-[#E2E8F0] focus:ring-1 focus:ring-[#2563EB] focus:border-[#2563EB]'
                      }`}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Job Designation *</label>
                  <input
                    type="text"
                    placeholder="Job designation / role"
                    value={newEmpRole}
                    onChange={(e) => {
                      setNewEmpRole(e.target.value);
                      if (enrollError) setEnrollError(null);
                    }}
                    className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 py-2 text-xs text-[#1E293B] focus:ring-1 focus:ring-[#2563EB] focus:border-[#2563EB] outline-none"
                  />
                </div>

                {/* Compensation Type: Daily or Weekly Wages or Monthly Salary */}
                <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-[#1E293B] flex items-center gap-1.5">
                      <span>Salary / Wage Scheme *</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 font-semibold">
                        Indian Rupee (₹ INR)
                      </span>
                    </label>
                  </div>

                  {/* Segmented Daily / Weekly / Monthly Switch */}
                  <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-slate-100 border border-slate-200 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setNewEmpPayBasis('DAILY');
                        if (newEmpWageRate === 4200 || newEmpWageRate === 18000) setNewEmpWageRate(650);
                      }}
                      className={`py-1.5 px-2 rounded-md font-semibold transition-all text-center cursor-pointer ${
                        newEmpPayBasis === 'DAILY'
                          ? 'bg-[#2563EB] text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Daily Wage
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setNewEmpPayBasis('WEEKLY');
                        if (newEmpWageRate === 650 || newEmpWageRate === 18000) setNewEmpWageRate(4200);
                      }}
                      className={`py-1.5 px-2 rounded-md font-semibold transition-all text-center cursor-pointer ${
                        newEmpPayBasis === 'WEEKLY'
                          ? 'bg-[#2563EB] text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Weekly Wage
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setNewEmpPayBasis('MONTHLY');
                        if (newEmpWageRate === 650 || newEmpWageRate === 4200) setNewEmpWageRate(18000);
                      }}
                      className={`py-1.5 px-2 rounded-md font-semibold transition-all text-center cursor-pointer ${
                        newEmpPayBasis === 'MONTHLY'
                          ? 'bg-[#2563EB] text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Monthly Salary
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">
                        {newEmpPayBasis === 'DAILY'
                          ? 'Daily Wage Rate (₹ / Day)'
                          : newEmpPayBasis === 'WEEKLY'
                          ? 'Weekly Wage Rate (₹ / Week)'
                          : 'Monthly Salary (₹ / Month)'}
                      </label>
                      <div className="relative flex items-center">
                        <span className="absolute left-3 font-bold text-slate-600 text-sm">₹</span>
                        <input
                          type="number"
                          min="0"
                          step="10"
                          value={newEmpWageRate}
                          onChange={(e) => setNewEmpWageRate(parseFloat(e.target.value) || 0)}
                          className="w-full bg-white border border-[#E2E8F0] rounded-lg pl-8 pr-3 py-2 text-xs text-[#1E293B] font-mono font-bold focus:ring-1 focus:ring-[#2563EB] focus:border-[#2563EB] outline-none"
                          placeholder="Enter rate amount"
                        />
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-white border border-[#E2E8F0] flex flex-col justify-center text-[11px] text-slate-700">
                      <span className="text-slate-500 text-[10px]">Monthly Projection:</span>
                      <span className="font-bold text-[#2563EB] mt-0.5">
                        {newEmpPayBasis === 'DAILY'
                          ? `≈ ₹${(newEmpWageRate * 26).toLocaleString('en-IN')} / month (26 days)`
                          : newEmpPayBasis === 'WEEKLY'
                          ? `≈ ₹${(newEmpWageRate * 4).toLocaleString('en-IN')} / month (4 weeks)`
                          : `≈ ₹${Math.round(newEmpWageRate / 26).toLocaleString('en-IN')} / day`}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Mobile Punch Authorization Option */}
                <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-[#1E293B] flex items-center gap-1.5">
                      <Smartphone className="w-3.5 h-3.5 text-[#2563EB]" />
                      <span>Punch In Mode (Staff Mobile App)</span>
                    </label>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Control whether this staff member can clock in from their personal smartphone or must use the supermarket entrance kiosk tablet.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5">
                    <button
                      type="button"
                      onClick={() => setNewEmpAllowMobilePunch(true)}
                      className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all ${
                        newEmpAllowMobilePunch
                          ? 'bg-blue-50 border-blue-200 text-[#1E293B]'
                          : 'bg-white border-[#E2E8F0] text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <div className="flex items-center gap-2 font-bold text-xs">
                        <Check className={`w-3.5 h-3.5 ${newEmpAllowMobilePunch ? 'text-[#2563EB]' : 'opacity-0'}`} />
                        <span>Allow Mobile Punch</span>
                      </div>
                      <span className="text-[10px] text-slate-500 block mt-1 pl-5.5">
                        For floor restockers, grocery staff & delivery crew
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setNewEmpAllowMobilePunch(false)}
                      className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all ${
                        !newEmpAllowMobilePunch
                          ? 'bg-amber-50 border-amber-200 text-[#1E293B]'
                          : 'bg-white border-[#E2E8F0] text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <div className="flex items-center gap-2 font-bold text-xs">
                        <Check className={`w-3.5 h-3.5 ${!newEmpAllowMobilePunch ? 'text-amber-600' : 'opacity-0'}`} />
                        <span>Entrance Kiosk Only</span>
                      </div>
                      <span className="text-[10px] text-slate-500 block mt-1 pl-5.5">
                        Staff must punch in at physical supermarket kiosk tablet
                      </span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Department</label>
                  <select
                    value={newEmpDept}
                    onChange={(e) => setNewEmpDept(e.target.value as Department)}
                    className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 py-2 text-xs text-[#1E293B] cursor-pointer focus:ring-1 focus:ring-[#2563EB] focus:border-[#2563EB] outline-none"
                  >
                    {departmentsList.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">Assigned Shift</label>
                    <select
                      value={newEmpShift}
                      onChange={(e) => setNewEmpShift(e.target.value as Shift['id'])}
                      className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 py-2 text-xs text-[#1E293B] cursor-pointer focus:ring-1 focus:ring-[#2563EB] focus:border-[#2563EB] outline-none"
                    >
                      {shifts.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">Staff PIN (4-Digits)</label>
                    <input
                      type="password"
                      maxLength={4}
                      placeholder="e.g. 5821"
                      value={newEmpPin}
                      onChange={(e) => setNewEmpPin(e.target.value.replace(/\D/g, ''))}
                      className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 py-2 text-xs text-[#1E293B] font-mono text-center tracking-widest focus:ring-1 focus:ring-[#2563EB] focus:border-[#2563EB] outline-none placeholder:text-slate-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Phone Number</label>
                  <input
                    type="tel"
                    value={newEmpPhone}
                    onChange={(e) => setNewEmpPhone(e.target.value)}
                    className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 py-2 text-xs text-[#1E293B] font-mono focus:ring-1 focus:ring-[#2563EB] focus:border-[#2563EB] outline-none placeholder:text-slate-400"
                    placeholder="e.g. +91 98765 43210"
                  />
                </div>

                {/* Real Staff Face Biometric Enrollment */}
                <div>
                  <FaceEnrollmentScanner
                    currentAvatar={newEmpAvatar}
                    onFaceCaptured={(dataUrl) => {
                      setNewEmpAvatar(dataUrl);
                      if (enrollError) setEnrollError(null);
                    }}
                    staffName={newEmpName || 'Staff Member'}
                  />
                </div>
              </div>

              {/* Pinned Sticky Footer - ALWAYS VISIBLE! */}
              <div className="p-4 border-t border-[#E2E8F0] bg-[#F8FAFC] flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
                <div className="text-[11px] text-slate-500 hidden sm:block">
                  {newEmpAvatar ? (
                    <span className="text-emerald-700 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Face biometrics registered
                    </span>
                  ) : (
                    <span className="text-slate-500">
                      Face photo optional (auto-generates badge if skipped)
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2.5 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setShowAddEmpModal(false)}
                    className="flex-1 sm:flex-none px-4 py-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 cursor-pointer transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    id="confirm-and-enroll-button"
                    type="button"
                    onClick={() => handleEnrollEmployee()}
                    className="flex-1 sm:flex-none px-6 py-2.5 rounded-lg bg-[#2563EB] hover:bg-blue-700 active:scale-95 text-white font-semibold text-xs shadow-xs cursor-pointer flex items-center justify-center gap-2 transition-all"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirm & Enroll</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT EMPLOYEE MODAL */}
      {showEditEmpModal && editingEmp && (
        <div className="fixed inset-0 z-50 bg-slate-500/20 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 text-[#1E293B]">
          <div className="w-full max-w-lg bg-white rounded-2xl border border-[#E2E8F0] shadow-2xl animate-scale-in flex flex-col max-h-[92vh] overflow-hidden">
            {/* Pinned Modal Header */}
            <div className="p-4 sm:p-5 border-b border-[#E2E8F0] flex items-center justify-between shrink-0 bg-[#F8FAFC]">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-[#1E293B]">Edit Employee Profile</h3>
                <p className="text-xs text-slate-500 mt-0.5">Update employee details, shift, and biometric signature</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowEditEmpModal(false);
                  setEditingEmp(null);
                }}
                className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center cursor-pointer transition-all shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 pr-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">Employee ID</label>
                    <input
                      type="text"
                      disabled
                      value={editingEmp.id}
                      className="w-full bg-slate-100 border border-[#E2E8F0] rounded-lg px-3 py-2 text-xs text-slate-600 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">Full Name *</label>
                    <input
                      type="text"
                      required
                      value={editingEmp.name}
                      onChange={(e) => setEditingEmp({ ...editingEmp, name: e.target.value })}
                      className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 py-2 text-xs text-[#1E293B] focus:ring-1 focus:ring-[#2563EB] focus:border-[#2563EB] outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Job Designation *</label>
                  <input
                    type="text"
                    required
                    value={editingEmp.role}
                    onChange={(e) => setEditingEmp({ ...editingEmp, role: e.target.value })}
                    className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 py-2 text-xs text-[#1E293B] focus:ring-1 focus:ring-[#2563EB] focus:border-[#2563EB] outline-none"
                  />
                </div>

                {/* Edit Compensation Type: Daily / Weekly Wages or Monthly Salary */}
                <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-[#1E293B] flex items-center gap-1.5">
                      <span>Salary / Wage Scheme *</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 font-semibold">
                        Indian Rupee (₹ INR)
                      </span>
                    </label>
                  </div>

                  <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-slate-100 border border-slate-200 text-xs">
                    <button
                      type="button"
                      onClick={() => setEditingEmp({ ...editingEmp, payBasis: 'DAILY' })}
                      className={`py-1.5 px-2 rounded-md font-semibold transition-all text-center cursor-pointer ${
                        (editingEmp.payBasis || 'DAILY') === 'DAILY'
                          ? 'bg-[#2563EB] text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Daily Wage
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingEmp({ ...editingEmp, payBasis: 'WEEKLY' })}
                      className={`py-1.5 px-2 rounded-md font-semibold transition-all text-center cursor-pointer ${
                        editingEmp.payBasis === 'WEEKLY'
                          ? 'bg-[#2563EB] text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Weekly Wage
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingEmp({ ...editingEmp, payBasis: 'MONTHLY' })}
                      className={`py-1.5 px-2 rounded-md font-semibold transition-all text-center cursor-pointer ${
                        editingEmp.payBasis === 'MONTHLY'
                          ? 'bg-[#2563EB] text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Monthly Salary
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">
                        {editingEmp.payBasis === 'DAILY'
                          ? 'Daily Wage Rate (₹ / Day)'
                          : editingEmp.payBasis === 'WEEKLY'
                          ? 'Weekly Wage Rate (₹ / Week)'
                          : 'Monthly Salary (₹ / Month)'}
                      </label>
                      <div className="relative flex items-center">
                        <span className="absolute left-3 font-bold text-slate-600 text-sm">₹</span>
                        <input
                          type="number"
                          min="0"
                          step="10"
                          value={editingEmp.wageRate ?? (editingEmp.hourlyRate ? editingEmp.hourlyRate * 8 : 650)}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            const basis = editingEmp.payBasis || 'DAILY';
                            const computedHourly = basis === 'DAILY' ? Math.round(val / 8) : basis === 'WEEKLY' ? Math.round(val / 48) : Math.round(val / 200);
                            setEditingEmp({
                              ...editingEmp,
                              wageRate: val,
                              hourlyRate: computedHourly,
                            });
                          }}
                          className="w-full bg-white border border-[#E2E8F0] rounded-lg pl-8 pr-3 py-2 text-xs text-[#1E293B] font-mono font-bold focus:ring-1 focus:ring-[#2563EB] focus:border-[#2563EB] outline-none"
                        />
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-white border border-[#E2E8F0] flex flex-col justify-center text-[11px] text-slate-700">
                      <span className="text-slate-500 text-[10px]">Monthly Projection:</span>
                      <span className="font-bold text-[#2563EB] mt-0.5">
                        {editingEmp.payBasis === 'DAILY'
                          ? `≈ ₹${((editingEmp.wageRate || 650) * 26).toLocaleString('en-IN')} / month`
                          : editingEmp.payBasis === 'WEEKLY'
                          ? `≈ ₹${((editingEmp.wageRate || 4200) * 4).toLocaleString('en-IN')} / month`
                          : `≈ ₹${Math.round((editingEmp.wageRate || 18000) / 26).toLocaleString('en-IN')} / day`}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Edit Mobile Punch Authorization */}
                <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-[#1E293B] flex items-center gap-1.5">
                      <Smartphone className="w-3.5 h-3.5 text-[#2563EB]" />
                      <span>Punch In Mode (Staff Mobile App)</span>
                    </label>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5">
                    <button
                      type="button"
                      onClick={() => setEditingEmp({ ...editingEmp, allowMobilePunch: true })}
                      className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all ${
                        editingEmp.allowMobilePunch !== false
                          ? 'bg-blue-50 border-blue-200 text-[#1E293B]'
                          : 'bg-white border-[#E2E8F0] text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <div className="flex items-center gap-2 font-bold text-xs">
                        <Check className={`w-3.5 h-3.5 ${editingEmp.allowMobilePunch !== false ? 'text-[#2563EB]' : 'opacity-0'}`} />
                        <span>Allow Mobile Punch</span>
                      </div>
                      <span className="text-[10px] text-slate-500 block mt-1 pl-5.5">
                        Face ID + GPS punch active on mobile
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setEditingEmp({ ...editingEmp, allowMobilePunch: false })}
                      className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all ${
                        editingEmp.allowMobilePunch === false
                          ? 'bg-amber-50 border-amber-200 text-[#1E293B]'
                          : 'bg-white border-[#E2E8F0] text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <div className="flex items-center gap-2 font-bold text-xs">
                        <Check className={`w-3.5 h-3.5 ${editingEmp.allowMobilePunch === false ? 'text-amber-600' : 'opacity-0'}`} />
                        <span>Entrance Kiosk Only</span>
                      </div>
                      <span className="text-[10px] text-slate-500 block mt-1 pl-5.5">
                        Restricted to supermarket entrance tablet
                      </span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Department</label>
                  <select
                    value={editingEmp.department}
                    onChange={(e) => setEditingEmp({ ...editingEmp, department: e.target.value as Department })}
                    className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 py-2 text-xs text-[#1E293B] focus:ring-1 focus:ring-[#2563EB] focus:border-[#2563EB] outline-none"
                  >
                    {!departmentsList.includes(editingEmp.department) && (
                      <option value={editingEmp.department}>
                        {editingEmp.department} (Current)
                      </option>
                    )}
                    {departmentsList.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">Assigned Shift</label>
                    <select
                      value={editingEmp.shiftId}
                      onChange={(e) => setEditingEmp({ ...editingEmp, shiftId: e.target.value as Shift['id'] })}
                      className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 py-2 text-xs text-[#1E293B] focus:ring-1 focus:ring-[#2563EB] focus:border-[#2563EB] outline-none"
                    >
                      {shifts.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">Staff PIN (4-Digits)</label>
                    <input
                      type="text"
                      maxLength={4}
                      value={editingEmp.pin}
                      onChange={(e) => setEditingEmp({ ...editingEmp, pin: e.target.value })}
                      className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 py-2 text-xs text-[#1E293B] font-mono text-center tracking-widest focus:ring-1 focus:ring-[#2563EB] focus:border-[#2563EB] outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={editingEmp.phone}
                    onChange={(e) => setEditingEmp({ ...editingEmp, phone: e.target.value })}
                    className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 py-2 text-xs text-[#1E293B] font-mono focus:ring-1 focus:ring-[#2563EB] focus:border-[#2563EB] outline-none"
                  />
                </div>

                {/* Real Staff Face Biometric Update */}
                <div>
                  <FaceEnrollmentScanner
                    currentAvatar={editingEmp.avatar}
                    onFaceCaptured={(dataUrl) => setEditingEmp({ ...editingEmp, avatar: dataUrl })}
                    staffName={editingEmp.name}
                  />
                </div>
              </div>

              {/* Pinned Sticky Footer */}
              <div className="p-4 border-t border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-end gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditEmpModal(false);
                    setEditingEmp(null);
                  }}
                  className="px-4 py-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 cursor-pointer transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white font-semibold text-xs shadow-xs cursor-pointer transition-all active:scale-95"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Safe In-App Confirmation Modal (Zero window.confirm) */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 bg-slate-500/20 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in text-[#1E293B]">
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 max-w-md w-full shadow-2xl animate-scale-in">
            <h3 className="text-lg font-bold text-[#1E293B] mb-2">{confirmModal.title}</h3>
            <p className="text-sm text-slate-600 mb-6 leading-relaxed">{confirmModal.message}</p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmModal.onConfirm}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-xs font-bold text-white transition-all shadow-xs cursor-pointer active:scale-95"
              >
                {confirmModal.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
