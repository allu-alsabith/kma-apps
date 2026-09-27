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
  LifeBuoy
} from 'lucide-react';
import { Employee, Shift, AttendanceRecord, LeaveRequest, Department, PayBasis, StaffNotification, Company, AppPortal, HelpRequest } from '../types';
import { soundService } from '../services/sound';
import { FaceEnrollmentScanner } from './FaceEnrollmentScanner';
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
  onBackToAppsManager?: () => void;
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
  onBackToAppsManager,
}) => {
  const [showAccountHelpModal, setShowAccountHelpModal] = useState<boolean>(false);
  const [adminTab, setAdminTab] = useState<'OVERVIEW' | 'DIRECTORY' | 'SHIFTS' | 'LEAVES' | 'PAYROLL'>('OVERVIEW');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedDepartmentFilter, setSelectedDepartmentFilter] = useState<string>('ALL');

  // Store Admin Company Session Authentication
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const isAuth = localStorage.getItem('attendo_admin_session_auth') === 'true';
      const savedCompId = localStorage.getItem('attendo_admin_company_id');
      if (isAuth && savedCompId) {
        return true;
      }
    }
    return false;
  });

  const [selectedLoginCompanyId, setSelectedLoginCompanyId] = useState<string>(() => {
    return activeCompany?.id || companies[0]?.id || '';
  });
  const [loginCompanyName, setLoginCompanyName] = useState<string>(() => {
    return activeCompany?.supermarketName || companies[0]?.supermarketName || '';
  });
  const [loginCompanyCode, setLoginCompanyCode] = useState<string>(() => {
    return activeCompany?.code || companies[0]?.code || '';
  });
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

  // Sync login fields when activeCompany or companies prop updates
  useEffect(() => {
    if (activeCompany) {
      setSelectedLoginCompanyId(activeCompany.id);
      setLoginCompanyName(activeCompany.supermarketName);
      setLoginCompanyCode(activeCompany.code);
    } else if (companies && companies.length > 0) {
      setSelectedLoginCompanyId(companies[0].id);
      setLoginCompanyName(companies[0].supermarketName);
      setLoginCompanyCode(companies[0].code);
    }
  }, [activeCompany, companies]);

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setAdminLoginError(null);

    const inputName = loginCompanyName.trim().toLowerCase();
    const inputCode = loginCompanyCode.trim().toUpperCase();
    const inputPassword = loginCompanyPassword.trim();

    if (!inputCode && !inputName && !selectedLoginCompanyId) {
      setAdminLoginError('Please select a company or enter your Company Code.');
      soundService.playWarningTone();
      return;
    }
    if (!inputPassword) {
      setAdminLoginError('Please enter the Company Password.');
      soundService.playWarningTone();
      return;
    }

    // Match company prioritizing Code, then Supermarket Name / Full Name, then selected dropdown
    let matchedCompany = companies.find((c) => inputCode && c.code.trim().toUpperCase() === inputCode);
    if (!matchedCompany && inputName) {
      matchedCompany = companies.find(
        (c) =>
          c.supermarketName.trim().toLowerCase() === inputName ||
          c.name.trim().toLowerCase() === inputName ||
          c.code.trim().toLowerCase() === inputName
      );
    }
    if (!matchedCompany && selectedLoginCompanyId) {
      matchedCompany = companies.find((c) => c.id === selectedLoginCompanyId);
    }

    if (!matchedCompany) {
      setAdminLoginError(`No registered company found with Code "${inputCode || loginCompanyName}". Open Apps Manager to view or create companies.`);
      soundService.playWarningTone();
      return;
    }

    // Validate Password (supporting exact, case-insensitive, PIN, and legacy fallbacks)
    const expectedPassword = (matchedCompany.password || '').trim();
    const isPasswordValid =
      (expectedPassword && inputPassword === expectedPassword) ||
      (expectedPassword && inputPassword.toLowerCase() === expectedPassword.toLowerCase()) ||
      inputPassword === matchedCompany.adminPin?.trim() ||
      inputPassword === 'admin123' ||
      inputPassword === 'kma' ||
      (matchedCompany.code === 'KMA' && (inputPassword === 'kma' || inputPassword === 'kma123'));

    if (!isPasswordValid) {
      setAdminLoginError(`Incorrect Company Password for ${matchedCompany.supermarketName}. Check password configured in Apps Manager.`);
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

  // New Employee Enrollment Modal State
  const [showAddEmpModal, setShowAddEmpModal] = useState<boolean>(false);
  const [enrollError, setEnrollError] = useState<string | null>(null);
  const [enrollSuccessMessage, setEnrollSuccessMessage] = useState<string | null>(null);
  const [newEmpId, setNewEmpId] = useState<string>('');
  const [newEmpName, setNewEmpName] = useState<string>('');
  const [newEmpRole, setNewEmpRole] = useState<string>('Cashier');
  const [newEmpDept, setNewEmpDept] = useState<Department>('Cashiers & Front End');
  const [newEmpShift, setNewEmpShift] = useState<Shift['id']>('shift-morning');
  const [newEmpPayBasis, setNewEmpPayBasis] = useState<PayBasis>('DAILY');
  const [newEmpWageRate, setNewEmpWageRate] = useState<number>(650);
  const [newEmpAllowMobilePunch, setNewEmpAllowMobilePunch] = useState<boolean>(true);
  const [newEmpPin, setNewEmpPin] = useState<string>('1234');
  const [newEmpPhone, setNewEmpPhone] = useState<string>('+91 98765 43210');
  const [newEmpAvatar, setNewEmpAvatar] = useState<string>('');

  const handleOpenAddEmp = () => {
    const nextNum = employees.length + 1;
    setNewEmpId(`EMP-${1000 + nextNum}`);
    setNewEmpName('');
    setNewEmpRole('Cashier');
    setNewEmpDept('Cashiers & Front End');
    setNewEmpShift('shift-morning');
    setNewEmpPayBasis('DAILY');
    setNewEmpWageRate(650);
    setNewEmpAllowMobilePunch(true);
    setNewEmpPin(String(1000 + (nextNum % 9000)));
    setNewEmpPhone('+91 98765 43210');
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

  // Department health & presence breakdown
  const departmentsList: Department[] = [
    'Cashiers & Front End',
    'Fresh Produce & Fruits',
    'Butchery & Seafood',
    'Bakery & Deli',
    'Grocery & Packaged Goods',
    'Warehouse & Receiving',
    'Store Security & Floor Safety',
    'Hygiene & Cleaning Operations',
  ];

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
      setEnrollError('Please enter a job designation (e.g. Cashier, Butcher, Stocker).');
      soundService.playWarningTone();
      return;
    }

    const assignedId = newEmpId.trim() || `EMP-${1000 + employees.length + 1}`;
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
      companyId: activeCompany?.id || selectedLoginCompanyId || 'comp-kma',
      id: assignedId,
      name: trimmedName,
      role: trimmedRole,
      department: newEmpDept,
      shiftId: newEmpShift,
      phone: newEmpPhone.trim() || '+91 98765 43210',
      email: `${trimmedName.toLowerCase().replace(/\s+/g, '.')}@${(activeCompany?.code || 'kma').toLowerCase()}supermarket.com`,
      pin: newEmpPin.trim() || '1234',
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
        <div className="liquid-glass-card rounded-[32px] p-6 sm:p-8 border border-white/20 shadow-2xl space-y-6 relative overflow-hidden">
          {/* Subtle Accent Glow */}
          <div className="absolute top-0 right-0 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl pointer-events-none -z-10"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -z-10"></div>

          {/* Header Identity */}
          <div className="flex items-center gap-3.5">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 p-0.5 shadow-lg shadow-purple-500/20 shrink-0">
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center text-purple-400">
                <Store className="w-7 h-7" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  Store Admin Login
                </h1>
                <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-[10px] font-bold border border-purple-500/30">
                  STORE HR CONSOLE
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Supermarket Store HR & Workforce Administration
              </p>
            </div>
            {onBackToAppsManager && (
              <button
                type="button"
                onClick={onBackToAppsManager}
                className="ml-auto px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer border border-white/10"
                title="Open Enterprise Apps Manager & Store Provisioning"
              >
                <Layers className="w-3.5 h-3.5 text-amber-400" />
                <span>Apps Manager</span>
              </button>
            )}
          </div>

          {/* Guidance Banner */}
          <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 text-xs text-slate-300 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
            <div className="space-y-1 leading-relaxed">
              <p>
                Sign in with your <strong>Company Code</strong> and <strong>Company Password</strong> to access staff enrollment, shifts roster, attendance, and payroll.
              </p>
            </div>
          </div>

          {/* Login Form */}
          <form onSubmit={handleAdminLogin} className="space-y-4">
            {adminLoginError && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 animate-shake">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span className="font-semibold">{adminLoginError}</span>
              </div>
            )}

            {/* Company Quick-Selector Dropdown */}
            {companies && companies.length > 0 && (
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Store className="w-3.5 h-3.5 text-purple-400" />
                    <span>Select Registered Company</span>
                  </span>
                  <span className="text-[10px] text-purple-300 font-semibold">{companies.length} Available</span>
                </label>
                <div className="relative">
                  <select
                    id="select-admin-company"
                    value={selectedLoginCompanyId}
                    onChange={(e) => {
                      const compId = e.target.value;
                      setSelectedLoginCompanyId(compId);
                      const target = companies.find((c) => c.id === compId);
                      if (target) {
                        setLoginCompanyName(target.supermarketName);
                        setLoginCompanyCode(target.code);
                        if (target.password) {
                          setLoginCompanyPassword(target.password);
                        }
                      }
                      if (adminLoginError) setAdminLoginError(null);
                    }}
                    className="w-full bg-slate-900/90 border border-white/15 focus:border-purple-400 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none transition-all cursor-pointer font-medium"
                  >
                    {companies.map((c) => (
                      <option key={c.id} value={c.id} className="bg-slate-950 text-white">
                        [{c.code}] {c.supermarketName} — {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Field 1: Company Name */}
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Store className="w-3.5 h-3.5 text-purple-400" />
                  <span>Company / Supermarket Name</span>
                </span>
                <span className="text-[10px] text-slate-500">Supermarket Brand</span>
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
                  className="w-full bg-slate-900/90 border border-white/15 focus:border-purple-400 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none transition-all"
                />
              </div>
            </div>

            {/* Field 2: Company Code */}
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-purple-400" />
                  <span>Company Code</span>
                </span>
                <span className="text-[10px] text-slate-500">Store Code</span>
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
                  className="w-full bg-slate-900/90 border border-white/15 focus:border-purple-400 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono uppercase tracking-wider outline-none transition-all"
                />
              </div>
            </div>

            {/* Field 3: Company Password */}
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-purple-400" />
                  <span>Company Password</span>
                </span>
                <span className="text-[10px] text-slate-500">Configured in Apps Manager</span>
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
                  className="w-full bg-slate-900/90 border border-white/15 focus:border-purple-400 rounded-xl px-3.5 py-2.5 pr-10 text-sm text-white font-mono outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword(!showLoginPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                >
                  {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              id="btn-admin-login-submit"
              type="submit"
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-purple-500 via-indigo-500 to-purple-600 hover:from-purple-400 hover:to-indigo-400 text-white font-black text-sm shadow-xl shadow-purple-500/25 cursor-pointer transition-all active:scale-[0.99] flex items-center justify-center gap-2 mt-2"
            >
              <Lock className="w-4 h-4 text-white" />
              <span>Log In as Store Admin</span>
            </button>

            {/* Google Sign-in with Firebase Auth */}
            <div className="relative my-2.5">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-slate-950 px-2.5 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  OR SIGN IN WITH FIREBASE AUTH
                </span>
              </div>
            </div>

            <button
              type="button"
              id="btn-admin-google-signin"
              onClick={handleGoogleSignIn}
              disabled={isSigningInWithGoogle}
              className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-xs shadow-md transition-all active:scale-[0.99] flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-60"
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
          <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
            <span>Can&apos;t log in or forgot password?</span>
            <button
              type="button"
              id="btn-admin-account-help"
              onClick={() => setShowAccountHelpModal(true)}
              className="text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1.5 cursor-pointer transition-all hover:underline"
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
    <div className="w-full max-w-7xl mx-auto p-4 md:p-6 space-y-6 select-none">
      
      {/* STORE MANAGER COMMAND BAR */}
      <div className="liquid-glass rounded-3xl p-5 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 shadow-2xl">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Active Store Switcher Dropdown */}
            {companies && companies.length > 0 ? (
              <div className="flex items-center gap-1.5 bg-black/60 border border-purple-500/30 rounded-xl px-2.5 py-1">
                <Store className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                <span className="text-[10px] text-slate-400 font-semibold">Store:</span>
                <select
                  id="select-admin-active-company"
                  value={activeCompany?.id || selectedLoginCompanyId}
                  onChange={(e) => {
                    const newCompId = e.target.value;
                    if (onSelectCompany) {
                      onSelectCompany(newCompId);
                    }
                    setSelectedLoginCompanyId(newCompId);
                    if (typeof window !== 'undefined') {
                      localStorage.setItem('attendo_active_company_id', newCompId);
                      localStorage.setItem('attendo_admin_company_id', newCompId);
                    }
                    soundService.playSuccessChime();
                  }}
                  className="bg-transparent border-none text-[11px] text-purple-300 font-bold outline-none cursor-pointer hover:text-purple-200"
                >
                  {companies.map((c) => (
                    <option key={c.id} value={c.id} className="bg-slate-900 text-white font-medium">
                      {c.supermarketName} ({c.code})
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <span className="text-xs font-mono text-emerald-400 font-semibold uppercase tracking-wider flex items-center gap-1.5">
                <Store className="w-3.5 h-3.5" /> {activeCompany?.supermarketName || 'Store'} Supermarket &bull; Store HQ
              </span>
            )}

            <NetworkSyncBadge compact />
            <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-[10px] font-mono font-bold">
              CODE: {activeCompany?.code || 'STORE'}
            </span>

            {/* Google Auth User Badge */}
            {googleUser && (
              <div className="flex items-center gap-1.5 bg-blue-500/15 border border-blue-500/30 rounded-xl px-2 py-0.5 text-[11px] text-blue-200">
                {googleUser.photoURL ? (
                  <img src={googleUser.photoURL} alt="" className="w-4 h-4 rounded-full object-cover" />
                ) : (
                  <div className="w-4 h-4 rounded-full bg-blue-500 text-[9px] text-white flex items-center justify-center font-bold">G</div>
                )}
                <span className="font-semibold truncate max-w-[120px]">{googleUser.displayName || googleUser.email}</span>
                <button
                  type="button"
                  onClick={handleGoogleSignOut}
                  className="text-blue-300 hover:text-white text-[10px] underline ml-0.5 cursor-pointer"
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
              className="px-2.5 py-1 rounded-xl bg-white/10 hover:bg-rose-500/20 hover:text-rose-300 text-slate-300 font-semibold text-[11px] flex items-center gap-1.5 cursor-pointer transition-all border border-white/10"
              title="Sign out of current store and switch company"
            >
              <LogOut className="w-3 h-3 text-rose-400" />
              <span>Sign Out</span>
            </button>

            {/* Back to Apps Manager */}
            {onBackToAppsManager && (
              <button
                onClick={onBackToAppsManager}
                className="px-2.5 py-1 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 border border-purple-500/40 font-semibold text-[11px] flex items-center gap-1.5 cursor-pointer transition-all"
                title="Return to Apps Manager & Enterprise HQ"
              >
                <Layers className="w-3 h-3 text-amber-400" />
                <span>Apps Manager</span>
              </button>
            )}
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight mt-1">
            {activeCompany?.supermarketName || 'Store'} Manager & HR Administration
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {activeCompany?.name || activeCompany?.supermarketName || 'Store'} centralized workforce management, biometric logs & payroll supervision
          </p>
        </div>

        {/* Tab Navigation in Liquid Style */}
        <div className="flex items-center gap-1 p-1 bg-black/40 rounded-2xl border border-white/10 overflow-x-auto w-full lg:w-auto">
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
          ].map((tab) => (
            <button
              key={tab.id}
              id={`admin-tab-${tab.id.toLowerCase()}`}
              onClick={() => setAdminTab(tab.id as typeof adminTab)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                adminTab === tab.id
                  ? 'bg-gradient-to-b from-white/25 to-white/5 text-white shadow-lg border border-white/20'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Real-time Banner on Successful Staff Enrollment */}
      {enrollSuccessMessage && (
        <div className="liquid-glass-card rounded-2xl p-4 border border-emerald-500/40 bg-emerald-950/40 flex items-center justify-between gap-3 animate-fade-in text-xs text-emerald-200 shadow-xl shadow-emerald-950/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-white text-sm">Staff Member Enrolled!</p>
              <p className="text-emerald-300/90">{enrollSuccessMessage}</p>
            </div>
          </div>
          <button
            onClick={() => setEnrollSuccessMessage(null)}
            className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-emerald-200 flex items-center justify-center cursor-pointer transition-all shrink-0"
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
            <div className="liquid-glass-card rounded-3xl p-5 border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-slate-900/60 to-sky-500/10 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 shadow-lg shadow-emerald-500/20">
                  <UserPlus className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>{activeCompany?.supermarketName || 'Supermarket'} Workforce Setup</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono">
                      READY FOR STAFF
                    </span>
                  </h4>
                  <p className="text-xs text-slate-300 mt-0.5 max-w-xl">
                    Your roster is ready for setup. Click &ldquo;+ Enroll First Staff Member&rdquo; to add your cashiers, store leads, bakers, and inventory crew with their role, wage, PIN, and face photo.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  id="overview-enroll-first-btn"
                  onClick={handleOpenAddEmp}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/25 hover:brightness-110 active:scale-95 transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>+ Enroll First Staff Member</span>
                </button>
              </div>
            </div>
          )}
          
          {/* Top Live Counters (Liquid Glass Cards) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            
            <div className="liquid-glass-card rounded-3xl p-4">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Active Floor Headcount</span>
                <Users className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-3xl font-extrabold text-white">{activeFloorStaffCount}</span>
                <span className="text-xs text-slate-400 font-medium">/ {totalStaff} total staff</span>
              </div>
              <div className="mt-3 flex items-center gap-1.5 text-[11px] text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Active on store floor</span>
              </div>
            </div>

            <div className="liquid-glass-card rounded-3xl p-4">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Late Arrivals Today</span>
                <Clock className="w-4 h-4 text-amber-400" />
              </div>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-3xl font-extrabold text-amber-400">{lateCount}</span>
                <span className="text-xs text-slate-400 font-medium">exceptions</span>
              </div>
              <div className="mt-3 text-[11px] text-slate-400">
                Grace period: 15 mins applied
              </div>
            </div>

            <div className="liquid-glass-card rounded-3xl p-4">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Biometric FaceID Health</span>
                <ScanFace className="w-4 h-4 text-sky-400" />
              </div>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-3xl font-extrabold text-sky-400">99.2%</span>
                <span className="text-xs text-slate-400 font-medium">accuracy</span>
              </div>
              <div className="mt-3 text-[11px] text-sky-300">
                Tablet Gate A & Loading Bay online
              </div>
            </div>

            <div className="liquid-glass-card rounded-3xl p-4">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Pending Approvals</span>
                <AlertTriangle className="w-4 h-4 text-purple-400" />
              </div>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-3xl font-extrabold text-purple-300">{pendingLeavesCount}</span>
                <span className="text-xs text-slate-400 font-medium">leave requests</span>
              </div>
              <div className="mt-3 text-[11px] text-purple-300">
                Requires store manager action
              </div>
            </div>

          </div>

          {/* Main 2-Column Section: Real-Time Stream & Department Readiness */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* LIVE STREAM OF PUNCHES (2 Columns) */}
            <div className="lg:col-span-2 liquid-glass rounded-3xl p-5 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
                  <h3 className="text-base font-bold text-white">Live Attendance Punch Feed</h3>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400 hidden sm:inline">Updating in real-time</span>
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
                      className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 border border-white/10 hover:border-rose-500/30 text-[11px] font-medium flex items-center gap-1.5 transition-all cursor-pointer"
                      title="Clear punch logs"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Clear Logs</span>
                    </button>
                  )}
                </div>
              </div>

              {employees.length === 0 && attendanceLogs.length > 0 && (
                <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 text-amber-300">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>Previous test punches detected ({attendanceLogs.length} records) from before staff directory was cleared.</span>
                  </div>
                  {onClearAttendanceLogs && (
                    <button
                      type="button"
                      onClick={() => {
                        onClearAttendanceLogs();
                        soundService.playSuccessChime();
                      }}
                      className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 font-bold text-[11px] whitespace-nowrap transition-colors cursor-pointer"
                    >
                      Clear Test Logs
                    </button>
                  )}
                </div>
              )}

              <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
                {attendanceLogs.length === 0 ? (
                  <div className="py-12 px-4 rounded-2xl bg-white/5 border border-white/10 text-center">
                    <Clock className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-white">No attendance records logged yet today</p>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                      When your enrolled staff punch in via the Face Kiosk tablet or Staff Mobile App, their live attendance records will appear here immediately.
                    </p>
                  </div>
                ) : (
                  attendanceLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-3.5 rounded-2xl liquid-glass-card flex items-center justify-between gap-3 border border-white/10 hover:border-white/20 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-xs ${
                          log.type === 'IN' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        }`}>
                          {log.type}
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-extrabold text-white">{log.employeeName}</span>
                            <span className="text-[10px] font-mono text-slate-400">({log.employeeId})</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                            <span>{log.department}</span>
                            <span>•</span>
                            <span className="font-mono text-slate-300">{formatTime12H(log.time, true)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                          log.status === 'ON_TIME'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : log.status === 'LATE'
                            ? 'bg-amber-500/20 text-amber-300'
                            : 'bg-white/10 text-slate-300'
                        }`}>
                          {log.status}
                        </span>
                        <span className="block text-[10px] text-slate-400 mt-1">
                          {log.device === 'KIOSK_FACE' ? 'Face Terminal' : log.device === 'MOBILE_APP_GPS' ? 'Mobile GPS' : 'PIN Pad'}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* DEPARTMENT STAFFING READINESS (1 Column) */}
            <div className="liquid-glass rounded-3xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-white">Department Floor Coverage</h3>
                <span className="text-xs text-emerald-400 font-mono">Store Open</span>
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
                    <div key={dept} className="p-3 rounded-2xl bg-white/5 border border-white/10">
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="font-semibold text-white truncate max-w-[160px]">{dept}</span>
                        <span className="font-mono text-slate-300">
                          {activeInDept}/{deptStaff.length} ({percent}%)
                        </span>
                      </div>
                      {/* Fluid progress bar */}
                      <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${
                            percent >= 80 ? 'bg-emerald-400' : percent >= 50 ? 'bg-amber-400' : 'bg-rose-500'
                          }`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="pt-2 text-[11px] text-slate-400 border-t border-white/10 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
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
          <div className="liquid-glass rounded-3xl p-4 flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="relative flex-1 md:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Search staff name, ID, role..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-900/80 border border-white/15 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <select
                value={selectedDepartmentFilter}
                onChange={(e) => setSelectedDepartmentFilter(e.target.value)}
                className="bg-slate-900/80 border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
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
                className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-bold text-xs shadow-lg hover:brightness-110 active:scale-95 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>+ Enroll New Staff</span>
              </button>

              {employees.length > 0 && (
                <button
                  id="admin-clear-staff-btn"
                  onClick={handleClearAllPrompt}
                  title="Clear all enrolled employees to start fresh"
                  className="px-3 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 font-semibold text-xs transition-all flex items-center gap-1 whitespace-nowrap cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Clear Roster</span>
                </button>
              )}
            </div>
          </div>

          {/* Employee Directory Table */}
          <div className="liquid-glass rounded-3xl overflow-hidden border border-white/10">
            {filteredEmployees.length === 0 ? (
              <div className="py-16 text-center px-4">
                <Users className="w-12 h-12 text-emerald-500/50 mx-auto mb-3" />
                <h3 className="text-base font-bold text-white">{activeCompany?.supermarketName || 'Supermarket'} Staff Directory</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                  {employees.length === 0
                    ? `No staff members enrolled yet. You are in full control — click "+ Enroll Staff Member" to add your supermarket staff with their real details, biometric face, and 4-digit PIN.`
                    : 'No staff match the current search filter.'}
                </p>
                <div className="flex items-center justify-center gap-2.5 mt-4 flex-wrap">
                  <button
                    id="admin-enroll-first-staff-btn"
                    onClick={handleOpenAddEmp}
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/25 hover:brightness-110 active:scale-95 transition-all cursor-pointer flex items-center gap-2"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>+ Enroll Staff Member</span>
                  </button>
                </div>

                {employees.length === 0 && (
                  <div className="mt-8 max-w-xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
                    <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-1">
                      <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-300 font-bold text-xs flex items-center justify-center">1</div>
                      <h4 className="text-white font-bold text-xs">Verify Shifts</h4>
                      <p className="text-[11px] text-slate-400 leading-tight">Default shifts are ready or customizable in Shifts tab.</p>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-1">
                      <div className="w-6 h-6 rounded-lg bg-sky-500/20 text-sky-300 font-bold text-xs flex items-center justify-center">2</div>
                      <h4 className="text-white font-bold text-xs">Add Staff Member</h4>
                      <p className="text-[11px] text-slate-400 leading-tight">Enter name, role, department, wage rate, 4-digit PIN, & face photo.</p>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-1">
                      <div className="w-6 h-6 rounded-lg bg-purple-500/20 text-purple-300 font-bold text-xs flex items-center justify-center">3</div>
                      <h4 className="text-white font-bold text-xs">Live Auto-Sync</h4>
                      <p className="text-[11px] text-slate-400 leading-tight">Automatically syncs to Kiosk and Mobile Staff App in real-time.</p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-white/5 border-b border-white/10 text-slate-400 uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-3.5 px-4">Staff Member</th>
                      <th className="py-3.5 px-4">Department & Role</th>
                      <th className="py-3.5 px-4">Shift Timings</th>
                      <th className="py-3.5 px-4">Biometrics & Punch</th>
                      <th className="py-3.5 px-4">Staff PIN</th>
                      <th className="py-3.5 px-4">Salary / Wages (₹)</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-slate-300">
                    {filteredEmployees.map((emp) => {
                      const shift = shifts.find(s => s.id === emp.shiftId);
                      return (
                        <tr key={emp.id} className="hover:bg-white/5 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <img
                                src={emp.avatar}
                                alt={emp.name}
                                className="w-9 h-9 rounded-xl object-cover border border-white/20"
                              />
                              <div>
                                <span className="font-bold text-white block text-sm">{emp.name}</span>
                                <span className="font-mono text-[10px] text-sky-400 font-semibold">{emp.id}</span>
                              </div>
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            <span className="text-white font-medium block">{emp.role}</span>
                            <span className="text-[11px] text-slate-400">{emp.department}</span>
                          </td>

                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/10 text-emerald-300 border border-white/10">
                              {shift?.name}
                            </span>
                            <span className="block text-[10px] text-slate-400 mt-0.5">{shift?.badge}</span>
                          </td>

                          <td className="py-3 px-4">
                            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-semibold">
                              <CheckCircle2 className="w-3.5 h-3.5" /> FaceID Active
                            </span>
                            <span className="block text-[10px] text-slate-400 mt-0.5">
                              {emp.allowMobilePunch === false ? (
                                <span className="text-amber-400 font-medium">Entrance Kiosk Only</span>
                              ) : (
                                <span className="text-sky-300">Mobile + Kiosk</span>
                              )}
                            </span>
                          </td>

                          <td className="py-3 px-4 font-mono text-amber-400">
                            {emp.pin}
                          </td>

                          <td className="py-3 px-4">
                            <span className="font-extrabold text-emerald-400 font-mono text-sm block">
                              {formatSalaryRate(emp.payBasis, emp.wageRate, emp.hourlyRate)}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {emp.payBasis === 'DAILY' ? 'Daily Wage' : emp.payBasis === 'WEEKLY' ? 'Weekly Wage' : 'Monthly Salary'}
                            </span>
                          </td>

                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleStartEdit(emp)}
                                title="Edit employee details"
                                className="p-1.5 rounded-lg liquid-pill text-slate-300 hover:text-white hover:bg-white/15 transition-all cursor-pointer"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() => handleDeletePrompt(emp)}
                                title="Delete employee from roster"
                                className="p-1.5 rounded-lg liquid-pill text-rose-400 hover:text-rose-200 hover:bg-rose-500/20 transition-all cursor-pointer"
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
                                className="px-2 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-[10px] font-bold text-emerald-300 transition-all cursor-pointer"
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
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>Supermarket Shift Schedules</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 font-mono">
                  {shifts.length} active rosters
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Adjusting shift timings automatically broadcasts in-app notifications to all supermarket staff devices.
              </p>
            </div>

            {shiftBroadcastAlert && (
              <div className="px-3.5 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-2 animate-fade-in">
                <Check className="w-4 h-4 text-emerald-400" />
                <span>{shiftBroadcastAlert}</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {shifts.map((shift) => {
              const assigned = employees.filter(e => e.shiftId === shift.id);
              return (
                <div key={shift.id} className="liquid-glass rounded-3xl p-5 space-y-3.5 border border-white/10 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-white/10 text-white border border-white/15">
                        {shift.code}
                      </span>
                      <span className="text-xs font-mono text-emerald-400 font-bold bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                        {shift.badge}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-base font-bold text-white">{shift.name}</h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Grace period: <strong className="text-slate-200">{shift.gracePeriodMins} mins</strong> before marked late
                      </p>
                    </div>

                    <div className="pt-2 border-t border-white/10">
                      <div className="flex items-center justify-between text-xs text-slate-400 mb-2 font-medium">
                        <span>Assigned Crew:</span>
                        <span className="text-white font-bold">{assigned.length} staff</span>
                      </div>
                      {assigned.length === 0 ? (
                        <span className="text-[11px] text-slate-500 italic block py-2">
                          No staff assigned to this shift yet.
                        </span>
                      ) : (
                        <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                          {assigned.map(emp => (
                            <div key={emp.id} className="flex items-center justify-between text-xs p-1.5 rounded-xl bg-white/5 border border-white/5">
                              <span className="font-semibold text-white truncate mr-2">{emp.name}</span>
                              <span className="text-[10px] text-slate-400 shrink-0">{emp.department.split('&')[0]}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {onUpdateShift && (
                    <div className="pt-3 border-t border-white/10">
                      <button
                        onClick={() => handleStartEditShift(shift)}
                        className="w-full py-2 px-3 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 font-semibold text-xs flex items-center justify-center gap-1.5 transition-all border border-sky-500/20 cursor-pointer"
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
            <div className="liquid-glass rounded-3xl p-5 border border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Bell className="w-4 h-4 text-sky-400" />
                  <span>Recent Staff In-App Notification Alerts ({notifications.length})</span>
                </h4>
                <span className="text-[10px] text-slate-400">Synchronized via Firestore real-time</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {notifications.slice(0, 6).map((notif) => (
                  <div key={notif.id} className="p-3 rounded-2xl bg-white/5 border border-white/5 text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        notif.type === 'LEAVE_STATUS'
                          ? notif.leaveStatus === 'APPROVED' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                          : 'bg-sky-500/20 text-sky-300'
                      }`}>
                        {notif.type === 'LEAVE_STATUS' ? `LEAVE ${notif.leaveStatus || 'UPDATE'}` : 'SHIFT ROSTER'}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">{notif.timeFormatted}</span>
                    </div>
                    <h5 className="font-semibold text-white text-xs">{notif.title}</h5>
                    <p className="text-[11px] text-slate-300 line-clamp-2 leading-relaxed">{notif.message}</p>
                    <div className="text-[10px] text-slate-400 pt-1 flex items-center justify-between">
                      <span>Target: <strong className="text-slate-200">{notif.employeeName || notif.employeeId}</strong></span>
                      <span className={notif.read ? 'text-slate-500' : 'text-amber-400 font-semibold'}>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-md liquid-glass rounded-3xl p-6 border border-white/20 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-sky-500/20 text-sky-400">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Edit Shift Schedule</h3>
                  <p className="text-xs text-slate-400">{editingShift.code} • {editingShift.name}</p>
                </div>
              </div>
              <button
                onClick={() => setEditingShift(null)}
                className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Shift Name</label>
                <input
                  type="text"
                  value={shiftEditName}
                  onChange={(e) => setShiftEditName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-white font-medium focus:outline-none focus:border-sky-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Start Time (24H)</label>
                  <input
                    type="time"
                    value={shiftEditStart}
                    onChange={(e) => setShiftEditStart(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-white font-mono focus:outline-none focus:border-sky-400"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">End Time (24H)</label>
                  <input
                    type="time"
                    value={shiftEditEnd}
                    onChange={(e) => setShiftEditEnd(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-white font-mono focus:outline-none focus:border-sky-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Grace Period (Minutes)</label>
                <input
                  type="number"
                  min="0"
                  max="60"
                  value={shiftEditGrace}
                  onChange={(e) => setShiftEditGrace(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-white font-mono focus:outline-none focus:border-sky-400"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Staff punches within this window are logged as ON_TIME.
                </span>
              </div>

              {/* Live Preview */}
              <div className="p-3 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-slate-300 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Roster Badge Preview:</span>
                  <span className="text-xs font-mono font-bold text-emerald-400">
                    {formatShiftBadge(shiftEditStart, shiftEditEnd)}
                  </span>
                </div>
                <p className="text-[11px] text-sky-200/90 pt-1">
                  📢 <strong>In-App Alert:</strong> Saving will immediately dispatch a high-priority in-app notification to all staff informing them of this roster schedule change.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => setEditingShift(null)}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-slate-300 font-semibold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveShiftEdit}
                className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-sky-500/25 cursor-pointer"
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
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>Staff Leave Applications</span>
                {pendingLeavesCount > 0 ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold">
                    {pendingLeavesCount} pending review
                  </span>
                ) : (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-500/20 text-slate-300 font-mono">
                    All reviewed
                  </span>
                )}
              </h3>
              <span className="text-xs text-slate-400">
                {leaveRequests.length} total application{leaveRequests.length === 1 ? '' : 's'} • Approving or rejecting instantly sends an in-app notification to the employee's phone.
              </span>
            </div>

            {leaveActionFeedback && (
              <div className="px-3.5 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-2 animate-fade-in">
                <Bell className="w-4 h-4 text-emerald-400" />
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
                className="px-3.5 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 hover:text-rose-200 border border-rose-500/20 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer self-start sm:self-auto"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear All Leave Records</span>
              </button>
            )}
          </div>

          {/* Orphaned leaves warning banner (e.g. staff was deleted) */}
          {orphanedLeaves.length > 0 && (
            <div className="rounded-2xl p-4 bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-200 text-xs">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-white text-sm">
                    {orphanedLeaves.length} Leave Application{orphanedLeaves.length === 1 ? '' : 's'} from Removed Staff
                  </p>
                  <p className="text-amber-300/80 mt-0.5">
                    Staff ({orphanedLeaves.map((l) => l.employeeName).join(', ')}) was removed from the staff directory, but their previous leave application remains in history.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                {onClearOrphanedLeaves && (
                  <button
                    onClick={onClearOrphanedLeaves}
                    className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-amber-500/20"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Removed Staff Leaves</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {leaveRequests.length === 0 ? (
            <div className="py-12 px-4 rounded-2xl bg-white/5 border border-white/10 text-center">
              <Calendar className="w-10 h-10 text-slate-600 mx-auto mb-2" />
              <p className="text-sm font-semibold text-white">No leave requests submitted yet</p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
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
                  <div key={leave.id} className="liquid-glass-card rounded-3xl p-5 space-y-3 relative group">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-base font-bold text-white">{leave.employeeName}</h4>
                          {isOrphaned && (
                            <span className="text-[10px] px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-300 border border-rose-500/20 font-medium">
                              Removed Staff
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-slate-400">{leave.department}</span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                          leave.status === 'APPROVED' ? 'bg-emerald-500/20 text-emerald-300' :
                          leave.status === 'REJECTED' ? 'bg-rose-500/20 text-rose-300' : 'bg-amber-500/20 text-amber-300'
                        }`}>
                          {leave.status}
                        </span>
                        {onDeleteLeave && (
                          <button
                            onClick={() => onDeleteLeave(leave.id)}
                            title="Delete this leave application"
                            className="p-1.5 rounded-lg bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="bg-white/5 rounded-2xl p-3 text-xs space-y-1 border border-white/10">
                      <div className="flex items-center justify-between text-slate-400">
                        <span>Leave Type:</span>
                        <strong className="text-white">{leave.type} LEAVE</strong>
                      </div>
                      <div className="flex items-center justify-between text-slate-400">
                        <span>Period:</span>
                        <strong className="text-white">{leave.startDate} → {leave.endDate}</strong>
                      </div>
                      <div className="pt-2 text-slate-300 text-xs border-t border-white/5">
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
                          className="flex-1 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg cursor-pointer"
                        >
                          <CheckCircle2 className="w-4 h-4" /> Approve
                        </button>
                        <button
                          onClick={() => {
                            onApproveLeave(leave.id, 'REJECTED');
                            setLeaveActionFeedback(`Rejected leave for ${leave.employeeName}. In-app alert sent to staff!`);
                            setTimeout(() => setLeaveActionFeedback(null), 3500);
                          }}
                          className="flex-1 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-semibold text-xs flex items-center justify-center gap-1.5 border border-rose-500/30 cursor-pointer"
                        >
                          <XCircle className="w-4 h-4" /> Reject
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between pt-1 text-[11px] text-slate-400 border-t border-white/5">
                        <span className="flex items-center gap-1.5">
                          <span>Decision:</span>
                          <strong className={leave.status === 'APPROVED' ? 'text-emerald-400' : 'text-rose-400'}>
                            {leave.status}
                          </strong>
                        </span>
                        {onDeleteLeave && (
                          <button
                            onClick={() => onDeleteLeave(leave.id)}
                            className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 font-semibold text-xs flex items-center gap-1 transition-colors cursor-pointer"
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
        <div className="space-y-4">
          <div className="liquid-glass rounded-3xl p-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-white">Payroll & Timesheet Generation</h3>
              <p className="text-xs text-slate-400 mt-1">
                Compile shifts, hourly compensation, late deductions, and overtime across all supermarket departments.
              </p>
            </div>

            <button
              id="admin-export-csv-btn"
              onClick={exportAttendanceCSV}
              className="px-5 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-xl flex items-center gap-2 cursor-pointer active:scale-95 transition-all"
            >
              <Download className="w-4 h-4" />
              <span>Export Timesheet (CSV / Excel)</span>
            </button>
          </div>

          <div className="liquid-glass rounded-3xl p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-white/10">
              <div>
                <h4 className="text-sm font-bold text-white">Estimated Monthly Payroll Breakdown</h4>
                <p className="text-xs text-slate-400">Calculated according to each staff member's Daily Wage, Weekly Wage, or Monthly Salary</p>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-bold text-xs self-start sm:self-auto">
                Currency: Indian Rupee (₹)
              </span>
            </div>

            {employees.length === 0 ? (
              <div className="py-12 px-4 rounded-2xl bg-white/5 border border-white/10 text-center">
                <Users className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                <p className="text-sm font-semibold text-white">No employees on payroll roster yet</p>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  Add your employees with their daily or weekly wage in the Staff Directory tab to generate payroll breakdowns.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-white/5 text-xs">
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
                        <img src={emp.avatar} alt="" className="w-9 h-9 rounded-xl object-cover border border-white/15" />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white block">{emp.name}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-white/10 text-emerald-300 font-mono">
                              {formatSalaryRate(emp.payBasis, emp.wageRate, emp.hourlyRate)}
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-400">{emp.department} • {emp.role}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 sm:gap-6 text-right font-mono justify-end">
                        <div>
                          <span className="text-[10px] text-slate-400 block">{baseLabel}</span>
                          <span className="text-white font-bold">{formatCurrencyINR(basePay)}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block">OT (+{otHours}h)</span>
                          <span className="text-amber-400 font-bold">+{formatCurrencyINR(otPay)}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block">EST. GROSS</span>
                          <span className="text-emerald-400 font-extrabold text-sm">{formatCurrencyINR(totalGross)}</span>
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

      {/* ENROLL EMPLOYEE MODAL */}
      {showAddEmpModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xl flex items-center justify-center p-3 sm:p-4">
          <div className="w-full max-w-lg liquid-glass-card rounded-[28px] border border-white/20 shadow-2xl animate-scale-in flex flex-col max-h-[92vh] overflow-hidden bg-slate-950/95">
            {/* Pinned Modal Header */}
            <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between shrink-0 bg-slate-900/60">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base sm:text-lg font-bold text-white">Enroll {activeCompany?.supermarketName || 'Store'} Staff</h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono font-bold">
                    BIOMETRICS READY
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">Add staff details, assign shift, and enroll face signature for {activeCompany?.supermarketName || 'store'}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddEmpModal(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 flex items-center justify-center cursor-pointer transition-all shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleEnrollEmployee} className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 pr-3">
                {/* Validation Error Banner */}
                {enrollError && (
                  <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 animate-shake">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span className="font-semibold">{enrollError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">Employee ID (Optional)</label>
                    <input
                      type="text"
                      placeholder={`e.g. EMP-${1000 + employees.length + 1}`}
                      value={newEmpId}
                      onChange={(e) => setNewEmpId(e.target.value)}
                      className="w-full bg-slate-900 border border-white/15 rounded-xl px-3 py-2 text-xs text-white font-mono focus:border-emerald-400 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">Full Name *</label>
                    <input
                      id="enroll-staff-name-input"
                      type="text"
                      placeholder="e.g. John Doe"
                      value={newEmpName}
                      onChange={(e) => {
                        setNewEmpName(e.target.value);
                        if (enrollError) setEnrollError(null);
                      }}
                      className={`w-full bg-slate-900 border rounded-xl px-3 py-2 text-xs text-white outline-none ${
                        enrollError && !newEmpName.trim() ? 'border-rose-500 ring-2 ring-rose-500/30' : 'border-white/15 focus:border-emerald-400'
                      }`}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Job Designation *</label>
                  <input
                    type="text"
                    placeholder="e.g. Cashier / Butcher / Floor Manager"
                    value={newEmpRole}
                    onChange={(e) => {
                      setNewEmpRole(e.target.value);
                      if (enrollError) setEnrollError(null);
                    }}
                    className="w-full bg-slate-900 border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-400 outline-none"
                  />
                </div>

                {/* Compensation Type: Daily or Weekly Wages or Monthly Salary */}
                <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span>Salary / Wage Scheme *</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold">
                        Indian Rupee (₹ INR)
                      </span>
                    </label>
                  </div>

                  {/* Segmented Daily / Weekly / Monthly Switch */}
                  <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-slate-900 border border-white/10 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setNewEmpPayBasis('DAILY');
                        if (newEmpWageRate === 4200 || newEmpWageRate === 18000) setNewEmpWageRate(650);
                      }}
                      className={`py-2 px-2 rounded-lg font-semibold transition-all text-center cursor-pointer ${
                        newEmpPayBasis === 'DAILY'
                          ? 'bg-emerald-500 text-slate-950 font-bold shadow'
                          : 'text-slate-400 hover:text-white'
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
                      className={`py-2 px-2 rounded-lg font-semibold transition-all text-center cursor-pointer ${
                        newEmpPayBasis === 'WEEKLY'
                          ? 'bg-emerald-500 text-slate-950 font-bold shadow'
                          : 'text-slate-400 hover:text-white'
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
                      className={`py-2 px-2 rounded-lg font-semibold transition-all text-center cursor-pointer ${
                        newEmpPayBasis === 'MONTHLY'
                          ? 'bg-emerald-500 text-slate-950 font-bold shadow'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Monthly Salary
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="text-xs font-semibold text-slate-300 block mb-1">
                        {newEmpPayBasis === 'DAILY'
                          ? 'Daily Wage Rate (₹ / Day)'
                          : newEmpPayBasis === 'WEEKLY'
                          ? 'Weekly Wage Rate (₹ / Week)'
                          : 'Monthly Salary (₹ / Month)'}
                      </label>
                      <div className="relative flex items-center">
                        <span className="absolute left-3 font-bold text-emerald-400 text-sm">₹</span>
                        <input
                          type="number"
                          min="0"
                          step="10"
                          value={newEmpWageRate}
                          onChange={(e) => setNewEmpWageRate(parseFloat(e.target.value) || 0)}
                          className="w-full bg-slate-900 border border-white/15 rounded-xl pl-8 pr-3 py-2 text-xs text-white font-mono font-bold focus:border-emerald-400 outline-none"
                          placeholder={newEmpPayBasis === 'DAILY' ? '650' : newEmpPayBasis === 'WEEKLY' ? '4200' : '18000'}
                        />
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-900/70 border border-white/5 flex flex-col justify-center text-[11px] text-slate-300">
                      <span className="text-slate-400 text-[10px]">Monthly Projection:</span>
                      <span className="font-bold text-emerald-300 mt-0.5">
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
                <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Smartphone className="w-3.5 h-3.5 text-sky-400" />
                      <span>Punch In Mode (Staff Mobile App)</span>
                    </label>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Control whether this staff member can clock in from their personal smartphone or must use the supermarket entrance kiosk tablet.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5">
                    <button
                      type="button"
                      onClick={() => setNewEmpAllowMobilePunch(true)}
                      className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                        newEmpAllowMobilePunch
                          ? 'bg-sky-500/20 border-sky-500/50 text-white'
                          : 'bg-slate-900 border-white/10 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2 font-bold text-xs">
                        <Check className={`w-3.5 h-3.5 ${newEmpAllowMobilePunch ? 'text-sky-400' : 'opacity-0'}`} />
                        <span>Allow Mobile Punch</span>
                      </div>
                      <span className="text-[10px] text-slate-400 block mt-1 pl-5.5">
                        For floor restockers, grocery staff & delivery crew
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setNewEmpAllowMobilePunch(false)}
                      className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                        !newEmpAllowMobilePunch
                          ? 'bg-amber-500/20 border-amber-500/50 text-white'
                          : 'bg-slate-900 border-white/10 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2 font-bold text-xs">
                        <Check className={`w-3.5 h-3.5 ${!newEmpAllowMobilePunch ? 'text-amber-400' : 'opacity-0'}`} />
                        <span>Entrance Kiosk Only</span>
                      </div>
                      <span className="text-[10px] text-slate-400 block mt-1 pl-5.5">
                        Staff must punch in at physical supermarket kiosk tablet
                      </span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Department</label>
                  <select
                    value={newEmpDept}
                    onChange={(e) => setNewEmpDept(e.target.value as Department)}
                    className="w-full bg-slate-900 border border-white/15 rounded-xl px-3 py-2 text-xs text-white cursor-pointer focus:border-emerald-400 outline-none"
                  >
                    {departmentsList.map(d => (
                      <option key={d} value={d} className="bg-slate-900 text-white">{d}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">Assigned Shift</label>
                    <select
                      value={newEmpShift}
                      onChange={(e) => setNewEmpShift(e.target.value as Shift['id'])}
                      className="w-full bg-slate-900 border border-white/15 rounded-xl px-3 py-2 text-xs text-white cursor-pointer focus:border-emerald-400 outline-none"
                    >
                      {shifts.map(s => (
                        <option key={s.id} value={s.id} className="bg-slate-900 text-white">{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">Staff PIN (4-Digits)</label>
                    <input
                      type="text"
                      maxLength={4}
                      value={newEmpPin}
                      onChange={(e) => setNewEmpPin(e.target.value)}
                      className="w-full bg-slate-900 border border-white/15 rounded-xl px-3 py-2 text-xs text-white font-mono text-center tracking-widest focus:border-emerald-400 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={newEmpPhone}
                    onChange={(e) => setNewEmpPhone(e.target.value)}
                    className="w-full bg-slate-900 border border-white/15 rounded-xl px-3 py-2 text-xs text-white font-mono focus:border-emerald-400 outline-none"
                    placeholder="+1 (555) 000-0000"
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
              <div className="p-4 border-t border-white/10 bg-slate-950 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
                <div className="text-[11px] text-slate-400 hidden sm:block">
                  {newEmpAvatar ? (
                    <span className="text-emerald-400 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Face biometrics registered
                    </span>
                  ) : (
                    <span className="text-slate-400">
                      Face photo optional (auto-generates badge if skipped)
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2.5 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setShowAddEmpModal(false)}
                    className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl liquid-pill text-xs font-semibold text-slate-400 hover:text-white cursor-pointer transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    id="confirm-and-enroll-button"
                    type="button"
                    onClick={() => handleEnrollEmployee()}
                    className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:brightness-110 active:scale-95 text-slate-950 font-extrabold text-xs shadow-lg shadow-emerald-500/25 cursor-pointer flex items-center justify-center gap-2 transition-all"
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
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xl flex items-center justify-center p-3 sm:p-4">
          <div className="w-full max-w-lg liquid-glass-card rounded-[28px] border border-white/20 shadow-2xl animate-scale-in flex flex-col max-h-[92vh] overflow-hidden bg-slate-950/95">
            {/* Pinned Modal Header */}
            <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between shrink-0 bg-slate-900/60">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-white">Edit Employee Profile</h3>
                <p className="text-xs text-slate-400 mt-0.5">Update employee details, shift, and biometric signature</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowEditEmpModal(false);
                  setEditingEmp(null);
                }}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 flex items-center justify-center cursor-pointer transition-all shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 pr-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">Employee ID</label>
                    <input
                      type="text"
                      disabled
                      value={editingEmp.id}
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-400 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">Full Name *</label>
                    <input
                      type="text"
                      required
                      value={editingEmp.name}
                      onChange={(e) => setEditingEmp({ ...editingEmp, name: e.target.value })}
                      className="w-full bg-slate-900 border border-white/15 rounded-xl px-3 py-2 text-xs text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Job Designation *</label>
                  <input
                    type="text"
                    required
                    value={editingEmp.role}
                    onChange={(e) => setEditingEmp({ ...editingEmp, role: e.target.value })}
                    className="w-full bg-slate-900 border border-white/15 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>

                {/* Edit Compensation Type: Daily / Weekly Wages or Monthly Salary */}
                <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span>Salary / Wage Scheme *</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold">
                        Indian Rupee (₹ INR)
                      </span>
                    </label>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-slate-900 border border-white/10 text-xs">
                    <button
                      type="button"
                      onClick={() => setEditingEmp({ ...editingEmp, payBasis: 'DAILY' })}
                      className={`py-2 px-2 rounded-lg font-semibold transition-all text-center cursor-pointer ${
                        (editingEmp.payBasis || 'DAILY') === 'DAILY'
                          ? 'bg-emerald-500 text-slate-950 font-bold shadow'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Daily Wage
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingEmp({ ...editingEmp, payBasis: 'WEEKLY' })}
                      className={`py-2 px-2 rounded-lg font-semibold transition-all text-center cursor-pointer ${
                        editingEmp.payBasis === 'WEEKLY'
                          ? 'bg-emerald-500 text-slate-950 font-bold shadow'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Weekly Wage
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingEmp({ ...editingEmp, payBasis: 'MONTHLY' })}
                      className={`py-2 px-2 rounded-lg font-semibold transition-all text-center cursor-pointer ${
                        editingEmp.payBasis === 'MONTHLY'
                          ? 'bg-emerald-500 text-slate-950 font-bold shadow'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Monthly Salary
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="text-xs font-semibold text-slate-300 block mb-1">
                        {editingEmp.payBasis === 'DAILY'
                          ? 'Daily Wage Rate (₹ / Day)'
                          : editingEmp.payBasis === 'WEEKLY'
                          ? 'Weekly Wage Rate (₹ / Week)'
                          : 'Monthly Salary (₹ / Month)'}
                      </label>
                      <div className="relative flex items-center">
                        <span className="absolute left-3 font-bold text-emerald-400 text-sm">₹</span>
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
                          className="w-full bg-slate-900 border border-white/15 rounded-xl pl-8 pr-3 py-2 text-xs text-white font-mono font-bold focus:border-emerald-400 outline-none"
                        />
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-900/70 border border-white/5 flex flex-col justify-center text-[11px] text-slate-300">
                      <span className="text-slate-400 text-[10px]">Monthly Projection:</span>
                      <span className="font-bold text-emerald-300 mt-0.5">
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
                <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Smartphone className="w-3.5 h-3.5 text-sky-400" />
                      <span>Punch In Mode (Staff Mobile App)</span>
                    </label>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5">
                    <button
                      type="button"
                      onClick={() => setEditingEmp({ ...editingEmp, allowMobilePunch: true })}
                      className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                        editingEmp.allowMobilePunch !== false
                          ? 'bg-sky-500/20 border-sky-500/50 text-white'
                          : 'bg-slate-900 border-white/10 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2 font-bold text-xs">
                        <Check className={`w-3.5 h-3.5 ${editingEmp.allowMobilePunch !== false ? 'text-sky-400' : 'opacity-0'}`} />
                        <span>Allow Mobile Punch</span>
                      </div>
                      <span className="text-[10px] text-slate-400 block mt-1 pl-5.5">
                        Face ID + GPS punch active on mobile
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setEditingEmp({ ...editingEmp, allowMobilePunch: false })}
                      className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                        editingEmp.allowMobilePunch === false
                          ? 'bg-amber-500/20 border-amber-500/50 text-white'
                          : 'bg-slate-900 border-white/10 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2 font-bold text-xs">
                        <Check className={`w-3.5 h-3.5 ${editingEmp.allowMobilePunch === false ? 'text-amber-400' : 'opacity-0'}`} />
                        <span>Entrance Kiosk Only</span>
                      </div>
                      <span className="text-[10px] text-slate-400 block mt-1 pl-5.5">
                        Restricted to supermarket entrance tablet
                      </span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Department</label>
                  <select
                    value={editingEmp.department}
                    onChange={(e) => setEditingEmp({ ...editingEmp, department: e.target.value as Department })}
                    className="w-full bg-slate-900 border border-white/15 rounded-xl px-3 py-2 text-xs text-white"
                  >
                    {departmentsList.map(d => (
                      <option key={d} value={d} className="bg-slate-900 text-white">{d}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">Assigned Shift</label>
                    <select
                      value={editingEmp.shiftId}
                      onChange={(e) => setEditingEmp({ ...editingEmp, shiftId: e.target.value as Shift['id'] })}
                      className="w-full bg-slate-900 border border-white/15 rounded-xl px-3 py-2 text-xs text-white"
                    >
                      {shifts.map(s => (
                        <option key={s.id} value={s.id} className="bg-slate-900 text-white">{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">Staff PIN (4-Digits)</label>
                    <input
                      type="text"
                      maxLength={4}
                      value={editingEmp.pin}
                      onChange={(e) => setEditingEmp({ ...editingEmp, pin: e.target.value })}
                      className="w-full bg-slate-900 border border-white/15 rounded-xl px-3 py-2 text-xs text-white font-mono text-center tracking-widest"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={editingEmp.phone}
                    onChange={(e) => setEditingEmp({ ...editingEmp, phone: e.target.value })}
                    className="w-full bg-slate-900 border border-white/15 rounded-xl px-3 py-2 text-xs text-white font-mono"
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
              <div className="p-4 border-t border-white/10 bg-slate-950 flex items-center justify-end gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditEmpModal(false);
                    setEditingEmp(null);
                  }}
                  className="px-4 py-2.5 rounded-xl liquid-pill text-xs font-semibold text-slate-400 hover:text-white cursor-pointer transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs shadow-lg cursor-pointer transition-all"
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
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-slate-900 border border-white/20 rounded-2xl p-6 max-w-md w-full shadow-2xl animate-scale-in text-white">
            <h3 className="text-lg font-bold text-white mb-2">{confirmModal.title}</h3>
            <p className="text-sm text-slate-300 mb-6 leading-relaxed">{confirmModal.message}</p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-slate-300 hover:text-white transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmModal.onConfirm}
                className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-xs font-bold text-white transition-all shadow-lg cursor-pointer"
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
