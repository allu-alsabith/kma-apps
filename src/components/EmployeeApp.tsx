import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  Calendar, 
  ShieldCheck, 
  ChevronRight, 
  MapPin, 
  Coffee, 
  FileText, 
  UserCheck, 
  Sparkles, 
  CheckCircle2, 
  Send,
  AlertCircle,
  AlertTriangle,
  TrendingUp,
  ScanFace,
  QrCode,
  Smartphone,
  Store,
  Bell,
  BellRing,
  Check,
  X,
  XCircle,
  Trash2,
  Info,
  Building2,
  Lock,
  LifeBuoy,
  Layers
} from 'lucide-react';
import { Employee, AttendanceRecord, LeaveRequest, Shift, PunchType, StaffNotification, Company, HelpRequest } from '../types';
import { formatTime12H, formatSalaryRate, formatCurrencyINR } from '../utils/formatters';
import { soundService } from '../services/sound';
import { AccountHelpModal } from './AccountHelpModal';
import { NetworkSyncBadge } from './NetworkSyncBadge';
import { BiometricFaceAuthOverlay } from './BiometricFaceAuthOverlay';

interface EmployeeAppProps {
  employees: Employee[];
  shifts: Shift[];
  attendanceLogs: AttendanceRecord[];
  leaveRequests: LeaveRequest[];
  onApplyLeave: (leave: Omit<LeaveRequest, 'id' | 'requestedAt' | 'status'>) => void;
  onMobileGeoPunch?: (employee: Employee, punchType?: PunchType, snapshotUrl?: string) => void;
  onOpenInstallModal?: () => void;
  isStandalone?: boolean;
  isStaffOnlyMode?: boolean;
  notifications?: StaffNotification[];
  onMarkNotificationAsRead?: (id: string) => void;
  onMarkAllNotificationsAsRead?: (employeeId?: string) => void;
  onDeleteNotification?: (id: string) => void;
  activeCompany?: Company;
  companies?: Company[];
  onSelectCompany?: (companyId: string) => void;
  onSubmitHelpRequest?: (request: Omit<HelpRequest, 'id' | 'createdAt' | 'status'>) => Promise<void> | void;
}

export const EmployeeApp: React.FC<EmployeeAppProps> = ({
  employees,
  shifts,
  attendanceLogs,
  leaveRequests,
  onApplyLeave,
  onMobileGeoPunch,
  onOpenInstallModal,
  isStandalone = false,
  isStaffOnlyMode = false,
  notifications = [],
  onMarkNotificationAsRead,
  onMarkAllNotificationsAsRead,
  onDeleteNotification,
  activeCompany,
  companies = [],
  onSelectCompany,
  onSubmitHelpRequest,
}) => {
  // Mobile screen detection
  const [isMobileScreen, setIsMobileScreen] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 640;
    }
    return false;
  });

  React.useEffect(() => {
    const handleResize = () => {
      setIsMobileScreen(window.innerWidth < 640);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isNativeMobileView = isMobileScreen || isStandalone || isStaffOnlyMode;

  const [showAccountHelpModal, setShowAccountHelpModal] = useState<boolean>(false);

  // Current logged in company and employee session
  const [staffCompanyId, setStaffCompanyId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const savedSession = localStorage.getItem('attendo_staff_session_id');
      if (savedSession) {
        return localStorage.getItem('attendo_staff_company_id') || '';
      }
    }
    return '';
  });

  const staffCompany = staffCompanyId ? (companies || []).find((c) => c.id === staffCompanyId) || null : null;
  const supermarketBrandName = staffCompany?.supermarketName?.trim() || '';

  // Filter employees belonging to this company for staff app
  const companyEmployees = React.useMemo(() => {
    if (!staffCompany) return employees;
    return (employees || []).filter(
      (e) => (e.companyId || staffCompany.id) === staffCompany.id
    );
  }, [employees, staffCompany]);

  // Current logged in employee session (starts unauthenticated so employee logs in)
  const [currentEmployeeId, setCurrentEmployeeId] = useState<string>('');

  // Staff Sign-in Form State (Company Name + Company Password + Emp ID + PIN) - Starts 100% empty (no auto-fill)
  const [loginCompanyName, setLoginCompanyName] = useState<string>('');
  const [loginCompanyPassword, setLoginCompanyPassword] = useState<string>('');
  const [loginEmpId, setLoginEmpId] = useState<string>('');
  const [loginPin, setLoginPin] = useState<string>('');
  const [loginError, setLoginError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'TODAY' | 'HISTORY' | 'LEAVES' | 'ALERTS' | 'PROFILE'>('TODAY');

  // In-App Notification States
  const [showNotificationsModal, setShowNotificationsModal] = useState<boolean>(false);
  const [activeNotifFilter, setActiveNotifFilter] = useState<'ALL' | 'LEAVES' | 'SHIFTS'>('ALL');
  const [dismissedToastIds, setDismissedToastIds] = useState<Set<string>>(new Set());

  // Leave Form State
  const [showLeaveModal, setShowLeaveModal] = useState<boolean>(false);
  const [leaveType, setLeaveType] = useState<'CASUAL' | 'SICK' | 'EMERGENCY' | 'ANNUAL'>('CASUAL');
  const [startDate, setStartDate] = useState<string>('2026-09-15');
  const [endDate, setEndDate] = useState<string>('2026-09-16');
  const [reason, setReason] = useState<string>('');
  const [leaveSubmitted, setLeaveSubmitted] = useState<boolean>(false);

  const currentEmployee = employees.find((e) => e.id === currentEmployeeId);
  const assignedShift = shifts.find((s) => s.id === currentEmployee?.shiftId) || shifts[0];

  // Filter logs and notifications for this specific staff member
  const myLogs = currentEmployee ? attendanceLogs.filter((log) => log.employeeId === currentEmployee.id) : [];
  const myLeaves = currentEmployee ? leaveRequests.filter((l) => l.employeeId === currentEmployee.id) : [];

  // Staff Notifications for current logged-in employee or broadcast ('ALL')
  const staffNotifications = React.useMemo(() => {
    if (!currentEmployee) return [];
    return notifications.filter(
      (n) => n.employeeId === currentEmployee.id || n.employeeId === 'ALL'
    );
  }, [notifications, currentEmployee]);

  const unreadCount = React.useMemo(() => {
    return staffNotifications.filter((n) => !n.read).length;
  }, [staffNotifications]);

  const latestUnreadToast = React.useMemo(() => {
    return staffNotifications.find((n) => !n.read && !dismissedToastIds.has(n.id)) || null;
  }, [staffNotifications, dismissedToastIds]);

  const filteredStaffNotifications = React.useMemo(() => {
    if (activeNotifFilter === 'LEAVES') {
      return staffNotifications.filter((n) => n.type === 'LEAVE_STATUS');
    }
    if (activeNotifFilter === 'SHIFTS') {
      return staffNotifications.filter((n) => n.type === 'SHIFT_UPDATE');
    }
    return staffNotifications;
  }, [staffNotifications, activeNotifFilter]);

  const handleDismissToast = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDismissedToastIds(prev => new Set(prev).add(id));
  };

  const handleOpenNotificationItem = (notif: StaffNotification) => {
    if (!notif.read && onMarkNotificationAsRead) {
      onMarkNotificationAsRead(notif.id);
    }
    if (notif.type === 'LEAVE_STATUS') {
      setActiveTab('LEAVES');
      setShowNotificationsModal(false);
    } else if (notif.type === 'SHIFT_UPDATE') {
      setActiveTab('TODAY');
      setShowNotificationsModal(false);
    }
  };

  // Mobile Face Biometric Punching State
  const [activePunchType, setActivePunchType] = useState<PunchType | null>(null);

  // Today's latest punch
  const latestPunch = myLogs[0];
  const isClockedIn = latestPunch?.type === 'IN' || latestPunch?.type === 'BREAK_END';
  const isOnBreak = latestPunch?.type === 'BREAK_START';

  const companyStaffCount = React.useMemo(() => {
    const targetCompId = staffCompany?.id || companies?.[0]?.id;
    return (employees || []).filter((e) => (e.companyId || targetCompId) === targetCompId).length;
  }, [employees, staffCompany, companies]);

  const handleStaffLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    // 1. Verify Company Name or Code
    const query = loginCompanyName.trim().toLowerCase();
    if (!query) {
      setLoginError('Please enter your company code or name.');
      soundService.playWarningTone();
      return;
    }

    const targetCompany = (companies || []).find(
      (c) =>
        c.code.trim().toLowerCase() === query ||
        c.supermarketName.trim().toLowerCase() === query ||
        c.name.trim().toLowerCase() === query
    );

    if (!targetCompany) {
      setLoginError('Supermarket company not found. Please verify the company code or name.');
      soundService.playWarningTone();
      return;
    }

    // 2. Verify Company Password
    const enteredCompanyPass = loginCompanyPassword.trim();
    const correctCompanyPass = targetCompany.password?.trim();
    const isCompanyPassValid =
      enteredCompanyPass === correctCompanyPass ||
      (correctCompanyPass && enteredCompanyPass.toLowerCase() === correctCompanyPass.toLowerCase());

    if (!isCompanyPassValid) {
      setLoginError(`Incorrect company password for ${targetCompany.supermarketName}.`);
      soundService.playWarningTone();
      return;
    }

    // 3. Verify that the employee is registered under this specific company
    const found = employees.find((emp) => {
      const matchesCompany = (emp.companyId || targetCompany.id) === targetCompany.id;
      const matchesIdentity =
        emp.id.trim().toUpperCase() === loginEmpId.trim().toUpperCase() ||
        emp.phone.replace(/\D/g, '') === loginEmpId.replace(/\D/g, '');
      return matchesCompany && matchesIdentity;
    });

    if (!found) {
      const companyStaff = employees.filter((e) => e.companyId === targetCompany.id);
      if (companyStaff.length === 0) {
        setLoginError(
          `No employees are registered in ${targetCompany.supermarketName} yet. The store owner can enroll staff in the Store Admin Console first.`
        );
      } else {
        setLoginError(
          `Staff member "${loginEmpId}" is not registered in ${targetCompany.supermarketName}.`
        );
      }
      soundService.playWarningTone();
      return;
    }

    // 4. Verify Staff 4-Digit Security PIN
    if (found.pin && found.pin !== loginPin.trim()) {
      setLoginError('Invalid 4-digit security PIN. Please verify with Store HR.');
      soundService.playWarningTone();
      return;
    }

    // 5. Successful Login
    setCurrentEmployeeId(found.id);
    setStaffCompanyId(targetCompany.id);
    if (typeof window !== 'undefined') {
      localStorage.setItem('attendo_staff_session_id', found.id);
      localStorage.setItem('attendo_staff_company_id', targetCompany.id);
      localStorage.removeItem('attendo_staff_company_name');
    }
    if (onSelectCompany) {
      onSelectCompany(targetCompany.id);
    }
    soundService.playSuccessChime();
    setLoginCompanyName('');
    setLoginEmpId('');
    setLoginPin('');
    setLoginCompanyPassword('');
  };

  const handleStaffLogout = () => {
    setCurrentEmployeeId('');
    setLoginCompanyName('');
    setLoginEmpId('');
    setLoginPin('');
    setLoginCompanyPassword('');
    setLoginError(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('attendo_staff_session_id');
      localStorage.removeItem('attendo_staff_company_name');
      localStorage.removeItem('attendo_staff_company_id');
    }
  };

  const handleLeaveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim() || !currentEmployee) return;

    onApplyLeave({
      companyId: staffCompany?.id,
      employeeId: currentEmployee.id,
      employeeName: currentEmployee.name,
      department: currentEmployee.department,
      type: leaveType,
      startDate,
      endDate,
      reason,
    });

    setLeaveSubmitted(true);
    soundService.playSuccessChime();
    setTimeout(() => {
      setLeaveSubmitted(false);
      setShowLeaveModal(false);
      setReason('');
    }, 1600);
  };

  return (
    <div className={`w-full flex flex-col items-center justify-center ${isNativeMobileView ? 'p-0 min-h-screen' : 'p-2 md:p-6'} select-none bg-[#F8FAFC] text-[#1E293B]`}>
      
      {/* Install on Phone quick action banner */}
      {!isNativeMobileView && onOpenInstallModal && (
        <div className="w-full max-w-sm mb-3 flex items-center justify-between gap-2">
          <button
            id="btn-employee-phone-install-banner"
            onClick={onOpenInstallModal}
            className="w-full py-2 px-3 rounded-xl bg-white border border-[#E2E8F0] shadow-xs flex items-center justify-between text-xs font-semibold text-slate-700 hover:text-[#1E293B] hover:bg-slate-50 transition-all cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-[#2563EB]" />
              <span className="truncate">Install on Phone</span>
            </div>
            <span className="px-1.5 py-0.5 rounded-md bg-blue-50 text-[#2563EB] text-[10px] font-semibold flex items-center gap-1 border border-blue-200 shrink-0">
              <QrCode className="w-3 h-3" /> QR
            </span>
          </button>
        </div>
      )}

      {/* ========================================================= */}
      {/* SMARTPHONE VIEW CANVAS (NATIVE ON MOBILE, MOCKUP ON DESKTOP) */}
      {/* ========================================================= */}
      <div className={isNativeMobileView 
        ? "relative w-full max-w-md min-h-screen bg-[#F8FAFC] text-[#1E293B] flex flex-col justify-between sm:rounded-2xl sm:border sm:border-[#E2E8F0] sm:my-3 sm:shadow-lg overflow-hidden transition-colors" 
        : "relative w-full max-w-[400px] h-[820px] rounded-[48px] p-3 bg-white shadow-xl border border-slate-200 overflow-hidden flex flex-col transition-colors"
      }>
        
        {/* Screen Canvas (Internal view) */}
        <div className={`relative w-full h-full ${!isNativeMobileView ? 'rounded-[38px] border border-slate-200' : ''} overflow-hidden bg-[#F8FAFC] text-[#1E293B] flex flex-col justify-between flex-1 transition-colors`}>

          {/* VIEW A: STAFF LOGIN SCREEN IF NOT AUTHENTICATED */}
          {!currentEmployee ? (
            <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col justify-between z-20">
              <div className="pt-3 text-center">
                <div className="w-12 h-12 rounded-xl mx-auto mb-2.5 bg-blue-50 border border-blue-200 flex items-center justify-center text-[#2563EB] shadow-xs">
                  <ScanFace className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-bold text-[#1E293B] tracking-tight">Staff Sign In</h2>
                <p className="text-xs text-slate-500 mt-0.5 max-w-[260px] mx-auto">
                  Staff Attendance Portal
                </p>
              </div>

              {/* Login Form */}
              <div className="bg-white rounded-xl p-4 sm:p-5 border border-[#E2E8F0] shadow-xs my-auto">
                <form onSubmit={handleStaffLogin} className="space-y-3">
                  {loginError && (
                    <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                      <span>{loginError}</span>
                    </div>
                  )}

                  {/* Empty Companies Notice */}
                  {(!companies || companies.length === 0) && (
                    <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2.5">
                      <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <strong className="block text-amber-900 font-semibold">No Business Registered Yet</strong>
                        <span className="text-[11px] text-amber-700 leading-tight block mt-0.5">
                          Please have your store owner or manager set up the company first in Store Admin Console.
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Company Name / Supermarket Selector */}
                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                      Company Code or Name
                    </label>
                    <div className="relative">
                      <Building2 className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400 pointer-events-none" />
                      <input
                        id="staff-login-company"
                        type="text"
                        autoComplete="off"
                        required
                        placeholder="Enter company code or name"
                        value={loginCompanyName}
                        onChange={(e) => setLoginCompanyName(e.target.value)}
                        className="w-full bg-white border border-[#CBD5E1] rounded-lg pl-9 pr-3.5 py-2 text-xs text-[#1E293B] placeholder-slate-400 focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] font-medium"
                      />
                    </div>
                  </div>

                  {/* Company Password */}
                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                      Company Password
                    </label>
                    <div className="relative">
                      <Lock className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400 pointer-events-none" />
                      <input
                        id="staff-login-company-password"
                        type="password"
                        autoComplete="current-password"
                        required
                        placeholder="Enter company password"
                        value={loginCompanyPassword}
                        onChange={(e) => setLoginCompanyPassword(e.target.value)}
                        className="w-full bg-white border border-[#CBD5E1] rounded-lg pl-9 pr-3.5 py-2 text-xs text-[#1E293B] placeholder-slate-400 focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                      Employee ID or Phone
                    </label>
                    <input
                      id="staff-login-id"
                      type="text"
                      autoComplete="off"
                      required
                      placeholder="Enter employee ID or phone"
                      value={loginEmpId}
                      onChange={(e) => setLoginEmpId(e.target.value)}
                      className="w-full bg-white border border-[#CBD5E1] rounded-lg px-3.5 py-2 text-xs text-[#1E293B] placeholder-slate-400 focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                      4-Digit Staff PIN
                    </label>
                    <input
                      id="staff-login-pin"
                      type="password"
                      autoComplete="new-password"
                      maxLength={4}
                      required
                      placeholder="Enter 4-digit PIN"
                      value={loginPin}
                      onChange={(e) => setLoginPin(e.target.value)}
                      className="w-full bg-white border border-[#CBD5E1] rounded-lg px-3.5 py-2 text-xs text-[#1E293B] placeholder-slate-400 focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] font-mono tracking-widest text-center text-sm"
                    />
                  </div>

                  <button
                    id="btn-staff-login-submit"
                    type="submit"
                    className="w-full py-2.5 rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white font-semibold text-xs shadow-xs active:scale-98 transition-all cursor-pointer"
                  >
                    Sign In to Staff App
                  </button>
                </form>
              </div>

              {/* Secure Corporate Portal Notice & Account Help */}
              <div className="pt-2 border-t border-[#E2E8F0] text-center space-y-1.5">
                <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-600 font-medium">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#2563EB]" />
                  <span>Authorized Staff Portal</span>
                </div>
                <p className="text-[10px] text-slate-500 leading-relaxed max-w-xs mx-auto">
                  Sign in with credentials provided by Store Management or HR.
                </p>

                <div className="pt-1 flex items-center justify-center gap-2 flex-wrap">
                  <button
                    type="button"
                    id="btn-staff-account-help"
                    onClick={() => setShowAccountHelpModal(true)}
                    className="text-[#2563EB] hover:text-blue-800 font-semibold text-[11px] flex items-center gap-1.5 py-1 px-3 rounded-lg bg-blue-50 border border-blue-200 transition-all cursor-pointer"
                  >
                    <LifeBuoy className="w-3.5 h-3.5" />
                    <span>Need Help?</span>
                  </button>
                </div>
              </div>

              {/* Account Help Modal */}
              <AccountHelpModal
                isOpen={showAccountHelpModal}
                onClose={() => setShowAccountHelpModal(false)}
                appName="Staff Mobile App"
                defaultCompanyName={loginCompanyName || supermarketBrandName}
                defaultCompanyCode={staffCompany?.code}
                onSubmitHelpRequest={async (req) => {
                  if (onSubmitHelpRequest) {
                    await onSubmitHelpRequest(req);
                  }
                }}
              />
            </div>
          ) : (
            /* VIEW B: AUTHENTICATED STAFF PERSONAL DASHBOARD */
            <>
              {/* MAIN SCROLLABLE CONTENT AREA */}
              <div className="flex-1 overflow-y-auto px-4 py-2 space-y-3.5 z-20">
                
                {/* Header / Greeting */}
                <div className="flex items-center justify-between pt-1">
                  <div>
                    <div className="flex items-center gap-1 text-[11px] text-[#2563EB] font-semibold tracking-wide uppercase">
                      <Store className="w-3 h-3" /> {supermarketBrandName} Supermarket
                    </div>
                    <h2 className="text-xl font-bold text-[#1E293B] tracking-tight">
                      Hi, {currentEmployee.name.split(' ')[0]}
                    </h2>
                    <p className="text-[11px] text-slate-500 font-medium">
                      {currentEmployee.role} • <span className="font-mono text-[#2563EB] font-semibold">{currentEmployee.id}</span>
                      {staffCompany && (
                        <span className="ml-1.5 px-1.5 py-0.2 rounded bg-slate-100 border border-slate-200 text-slate-700 font-mono text-[9px] font-semibold">
                          {staffCompany.code}
                        </span>
                      )}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <NetworkSyncBadge compact />
                    <button
                      id="btn-staff-notifications-toggle"
                      onClick={() => setShowNotificationsModal(true)}
                      title="Staff In-App Notifications"
                      className="relative p-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-[#E2E8F0] transition-all cursor-pointer shadow-xs"
                    >
                      <Bell className="w-4 h-4" />
                      {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white font-bold text-[9px] flex items-center justify-center border-2 border-white animate-pulse">
                          {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                      )}
                    </button>
                    <button
                      onClick={handleStaffLogout}
                      title="Sign Out"
                      className="px-2 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-600 hover:text-[#1E293B] text-[10px] font-semibold border border-[#E2E8F0] transition-all cursor-pointer shadow-xs"
                    >
                      Sign Out
                    </button>
                    <div className="relative">
                      <img
                        src={currentEmployee.avatar}
                        alt={currentEmployee.name}
                        className="w-10 h-10 rounded-xl object-cover border border-[#CBD5E1] shadow-xs"
                      />
                      <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center text-[7px] font-bold text-white">
                        ✓
                      </span>
                    </div>
                  </div>
                </div>

                {/* Floating In-App Alert Toast for Latest Unread Notification */}
                {latestUnreadToast && (
                  <div
                    onClick={() => handleOpenNotificationItem(latestUnreadToast)}
                    className="p-3 rounded-xl border border-[#E2E8F0] bg-white transition-all cursor-pointer shadow-sm animate-fade-in flex items-center justify-between gap-2.5 text-[#1E293B]"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="p-1.5 rounded-lg bg-blue-50 text-[#2563EB] shrink-0 border border-blue-100">
                        <BellRing className="w-4 h-4 animate-bounce" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-bold text-[#1E293B] truncate">
                            {latestUnreadToast.title}
                          </span>
                          <span className="text-[9px] font-mono text-slate-400 shrink-0">{latestUnreadToast.timeFormatted}</span>
                        </div>
                        <p className="text-[10px] text-slate-600 truncate">{latestUnreadToast.message}</p>
                      </div>
                    </div>
                    <button
                      onClick={(e) => handleDismissToast(e, latestUnreadToast.id)}
                      className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 shrink-0"
                      title="Dismiss alert"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

            {/* TAB CONTENT: TODAY'S SHIFT */}
            {activeTab === 'TODAY' && (
              <>
                {/* Hero Shift Card */}
                <div className="bg-white rounded-xl p-4 border border-[#E2E8F0] shadow-xs relative overflow-hidden text-[#1E293B]">
                  <div className="flex items-center justify-between mb-3">
                    <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-[#2563EB] border border-blue-200">
                      {assignedShift.name}
                    </span>
                    <span className="text-[11px] font-mono text-slate-500 font-medium">
                      {assignedShift.badge}
                    </span>
                  </div>

                  <div className="my-2">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">ATTENDANCE STATUS</span>
                    <div className="flex items-center gap-2 mt-1">
                      <div className={`w-3 h-3 rounded-full ${isClockedIn ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                      <span className="text-lg font-bold text-[#1E293B]">
                        {isClockedIn ? 'Currently Clocked In' : 'Not Clocked In'}
                      </span>
                    </div>
                  </div>

                  {latestPunch && (
                    <div className="mt-3 pt-3 border-t border-[#E2E8F0] flex items-center justify-between text-xs">
                      <span className="text-slate-500">Last Punch:</span>
                      <span className="text-[#1E293B] font-mono font-semibold">
                        {formatTime12H(latestPunch.time, true)} ({latestPunch.type})
                      </span>
                    </div>
                  )}

                  {/* Geofence / Location Status */}
                  <div className="mt-2 text-[11px] text-slate-500 flex items-center justify-between pt-1">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-[#2563EB]" />
                      <span>{supermarketBrandName} Store Geofence: Inside Zone</span>
                    </span>
                    <span className="text-[10px] text-emerald-700 font-semibold">Live GPS Active</span>
                  </div>
                </div>

                {/* Mobile Attendance Punch Action Card - Only shown if mobile punch is enabled */}
                {currentEmployee.allowMobilePunch !== false && (
                  <div className="bg-white rounded-xl p-4 border border-[#E2E8F0] shadow-xs space-y-3 text-[#1E293B]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 text-[#2563EB] flex items-center justify-center">
                          <ScanFace className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="text-xs font-bold text-[#1E293B] block">Mobile Attendance Punch</span>
                          <span className="text-[10px] text-slate-500">Biometric FaceID + Geofence</span>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200 flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3 text-emerald-600" />
                        Ready
                      </span>
                    </div>

                    <div>
                      {!isClockedIn && !isOnBreak ? (
                        <button
                          id="btn-staff-mobile-clock-in"
                          type="button"
                          onClick={() => setActivePunchType('IN')}
                          className="w-full py-3 px-4 rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white font-bold text-sm shadow-xs flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98]"
                        >
                          <ScanFace className="w-4 h-4 text-white" />
                          <span>Clock In with Face ID</span>
                        </button>
                      ) : isClockedIn ? (
                        <div className="grid grid-cols-2 gap-2.5">
                          <button
                            id="btn-staff-mobile-break-start"
                            type="button"
                            onClick={() => setActivePunchType('BREAK_START')}
                            className="py-2.5 px-3 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold text-xs border border-amber-300 flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-[0.98]"
                          >
                            <Coffee className="w-4 h-4 text-amber-700" />
                            <span>Start Break</span>
                          </button>
                          <button
                            id="btn-staff-mobile-clock-out"
                            type="button"
                            onClick={() => setActivePunchType('OUT')}
                            className="py-2.5 px-3 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-900 font-bold text-xs border border-rose-300 flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-[0.98]"
                          >
                            <XCircle className="w-4 h-4 text-rose-700" />
                            <span>Clock Out</span>
                          </button>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-2.5">
                          <button
                            id="btn-staff-mobile-break-end"
                            type="button"
                            onClick={() => setActivePunchType('BREAK_END')}
                            className="py-2.5 px-3 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-900 font-bold text-xs border border-emerald-300 flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-[0.98]"
                          >
                            <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                            <span>End Break</span>
                          </button>
                          <button
                            id="btn-staff-mobile-clock-out-from-break"
                            type="button"
                            onClick={() => setActivePunchType('OUT')}
                            className="py-2.5 px-3 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-900 font-bold text-xs border border-rose-300 flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-[0.98]"
                          >
                            <XCircle className="w-4 h-4 text-rose-700" />
                            <span>Clock Out</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Quick Stats Grid */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="bg-white rounded-xl p-3 border border-[#E2E8F0] shadow-xs text-[#1E293B]">
                    <span className="text-[10px] text-slate-500 font-semibold block uppercase">ESTIMATED EARNINGS</span>
                    <span className="text-lg font-bold text-[#1E293B] mt-1 block tabular-nums">
                      {formatCurrencyINR(
                        currentEmployee.payBasis === 'DAILY'
                          ? (currentEmployee.wageRate || 650) * 26
                          : currentEmployee.payBasis === 'WEEKLY'
                            ? (currentEmployee.wageRate || 4200) * 4
                            : (currentEmployee.wageRate || 18000)
                      )}
                    </span>
                    <span className="text-[10px] text-slate-500 block mt-0.5 truncate">
                      {formatSalaryRate(currentEmployee.payBasis, currentEmployee.wageRate, currentEmployee.hourlyRate)}
                    </span>
                  </div>

                  <div className="bg-white rounded-xl p-3 border border-[#E2E8F0] shadow-xs text-[#1E293B]">
                    <span className="text-[10px] text-slate-500 font-semibold block uppercase">THIS MONTH HOURS</span>
                    <span className="text-lg font-bold text-[#1E293B] mt-1 block tabular-nums">154.5 <span className="text-xs font-normal text-slate-500">hrs</span></span>
                    <span className="text-[10px] text-[#2563EB] flex items-center gap-0.5 mt-0.5 font-semibold">
                      <TrendingUp className="w-3 h-3" /> Target 160 hrs
                    </span>
                  </div>
                </div>

                {/* Quick Action: Apply for Leave */}
                <div className="bg-white rounded-xl p-3 border border-[#E2E8F0] shadow-xs flex items-center justify-between text-[#1E293B]">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-[#2563EB]">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-[#1E293B] block">Need Time Off?</span>
                      <span className="text-[10px] text-slate-500">Apply for casual or sick leave</span>
                    </div>
                  </div>
                  <button
                    id="open-leave-modal"
                    onClick={() => setShowLeaveModal(true)}
                    className="px-3 py-1.5 rounded-lg bg-blue-50 text-[#2563EB] hover:bg-blue-100 border border-blue-200 text-xs font-semibold flex items-center gap-1 cursor-pointer transition-all"
                  >
                    <span>Apply</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </>
            )}

            {/* TAB CONTENT: ATTENDANCE HISTORY */}
            {activeTab === 'HISTORY' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-bold text-[#1E293B]">Your Punch Logs</span>
                  <span className="text-[10px] text-slate-500">{myLogs.length} events logged</span>
                </div>

                {myLogs.length === 0 ? (
                  <div className="bg-white rounded-xl p-6 border border-[#E2E8F0] shadow-xs text-center text-slate-500 text-xs">
                    No punch records found today.
                  </div>
                ) : (
                  myLogs.map((log) => (
                    <div key={log.id} className="bg-white rounded-xl px-3.5 py-3 border border-[#E2E8F0] shadow-xs flex items-center justify-between text-[#1E293B] min-h-[56px]">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`px-2.5 py-1 min-w-[40px] w-auto rounded-md flex items-center justify-center text-xs font-semibold whitespace-nowrap border shrink-0 transition-colors ${
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
                          <span className="text-xs font-bold text-[#1E293B] block truncate">{formatTime12H(log.time, true)}</span>
                          <span className="text-[10px] text-slate-500 block truncate">{log.device.replace('_', ' ')}</span>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-700 font-semibold">
                        {log.status}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* TAB CONTENT: LEAVES */}
            {activeTab === 'LEAVES' && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-bold text-[#1E293B]">My Leave Requests</span>
                  <button
                    onClick={() => setShowLeaveModal(true)}
                    className="text-[11px] text-[#2563EB] hover:text-blue-700 font-semibold cursor-pointer"
                  >
                    + New Request
                  </button>
                </div>

                {/* Latest Leave Status Notice if notification exists */}
                {staffNotifications.filter(n => n.type === 'LEAVE_STATUS').slice(0, 1).map((notif) => (
                  <div
                    key={notif.id}
                    className={`p-2.5 rounded-xl border text-xs flex items-start gap-2 ${
                      notif.leaveStatus === 'APPROVED'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : 'bg-rose-50 border-rose-200 text-rose-800'
                    }`}
                  >
                    <div className="mt-0.5 shrink-0">
                      {notif.leaveStatus === 'APPROVED' ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <strong className="text-[#1E293B] text-[11px]">{notif.title}</strong>
                        <span className="text-[9px] text-slate-500 font-mono">{notif.timeFormatted}</span>
                      </div>
                      <p className="text-[10px] text-slate-600 mt-0.5">{notif.message}</p>
                    </div>
                  </div>
                ))}

                {myLeaves.length === 0 ? (
                  <div className="bg-white rounded-xl p-6 border border-[#E2E8F0] shadow-xs text-center text-slate-500 text-xs">
                    No active leave requests.
                  </div>
                ) : (
                  myLeaves.map((leave) => (
                    <div key={leave.id} className="bg-white rounded-xl p-3 border border-[#E2E8F0] shadow-xs text-[#1E293B]">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-[#1E293B]">{leave.type} LEAVE</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                          leave.status === 'APPROVED'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : leave.status === 'REJECTED'
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                          {leave.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600">{leave.reason}</p>
                      <div className="mt-2 text-[10px] text-slate-500 flex items-center justify-between border-t border-[#E2E8F0] pt-1.5">
                        <span>{leave.startDate} to {leave.endDate}</span>
                        <span>Req: {formatTime12H(leave.requestedAt, false)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* TAB CONTENT: ALERTS & NOTIFICATIONS */}
            {activeTab === 'ALERTS' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <div>
                    <span className="text-xs font-bold text-[#1E293B] flex items-center gap-1.5">
                      <Bell className="w-3.5 h-3.5 text-[#2563EB]" />
                      <span>In-App Notifications</span>
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {unreadCount > 0 ? `${unreadCount} unread alert${unreadCount === 1 ? '' : 's'}` : 'All caught up'}
                    </span>
                  </div>

                  {staffNotifications.length > 0 && onMarkAllNotificationsAsRead && (
                    <button
                      onClick={() => onMarkAllNotificationsAsRead(currentEmployee.id)}
                      className="text-[10px] text-[#2563EB] hover:text-blue-700 font-semibold cursor-pointer"
                    >
                      Mark all read
                    </button>
                  )}
                </div>

                {/* Filter Chips */}
                <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-[#E2E8F0] text-[11px]">
                  {(['ALL', 'LEAVES', 'SHIFTS'] as const).map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setActiveNotifFilter(filter)}
                      className={`flex-1 py-1 rounded-lg font-bold transition-all text-center cursor-pointer ${
                        activeNotifFilter === filter ? 'bg-[#2563EB] text-white shadow-xs' : 'text-slate-600 hover:text-[#1E293B]'
                      }`}
                    >
                      {filter === 'ALL' ? 'All Alerts' : filter === 'LEAVES' ? 'Leaves' : 'Shifts'}
                    </button>
                  ))}
                </div>

                {filteredStaffNotifications.length === 0 ? (
                  <div className="bg-white rounded-xl p-8 border border-[#E2E8F0] shadow-xs text-center text-slate-500 text-xs space-y-2">
                    <Bell className="w-8 h-8 text-slate-400 mx-auto" />
                    <p className="font-semibold text-[#1E293B]">No notifications yet</p>
                    <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                      You will be notified here immediately when your leave request is approved/rejected or when store shift schedules are adjusted.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {filteredStaffNotifications.map((notif) => (
                      <div
                        key={notif.id}
                        onClick={() => handleOpenNotificationItem(notif)}
                        className={`p-3.5 rounded-xl border transition-all cursor-pointer relative bg-white shadow-xs ${
                          !notif.read ? 'border-[#2563EB] ring-1 ring-[#2563EB]/20' : 'border-[#E2E8F0]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-md border ${
                              notif.type === 'LEAVE_STATUS'
                                ? notif.leaveStatus === 'APPROVED'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-rose-50 text-rose-700 border-rose-200'
                                : 'bg-blue-50 text-[#2563EB] border-blue-200'
                            }`}>
                              {notif.type === 'LEAVE_STATUS' ? `LEAVE ${notif.leaveStatus || 'DECISION'}` : 'SHIFT SCHEDULE'}
                            </span>
                            {!notif.read && (
                              <span className="w-2 h-2 rounded-full bg-[#2563EB]" />
                            )}
                          </div>

                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-slate-400 font-mono">{notif.timeFormatted}</span>
                            {onDeleteNotification && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDeleteNotification(notif.id);
                                }}
                                className="p-1 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                                title="Delete alert"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>

                        <h4 className="text-xs font-bold text-[#1E293B] mb-1">{notif.title}</h4>
                        <p className="text-[11px] text-slate-600 leading-relaxed">{notif.message}</p>

                        {notif.type === 'LEAVE_STATUS' && notif.leaveStatus && (
                          <div className="mt-2 pt-2 border-t border-[#E2E8F0] flex items-center justify-between text-[10px]">
                            <span className="text-slate-500">Decision logged in store system:</span>
                            <strong className={notif.leaveStatus === 'APPROVED' ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold'}>
                              {notif.leaveStatus}
                            </strong>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT: PROFILE */}
            {activeTab === 'PROFILE' && (
              <div className="space-y-3">
                <div className="bg-white rounded-xl p-5 border border-[#E2E8F0] shadow-xs flex flex-col items-center text-center text-[#1E293B]">
                  <img
                    src={currentEmployee.avatar}
                    alt={currentEmployee.name}
                    className="w-20 h-20 rounded-xl object-cover border-2 border-[#2563EB] shadow-xs mb-2"
                  />
                  <h3 className="text-base font-bold text-[#1E293B]">{currentEmployee.name}</h3>
                  <p className="text-xs text-[#2563EB] font-semibold">{currentEmployee.role}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{currentEmployee.department}</p>
                </div>

                <div className="bg-white rounded-xl p-4 border border-[#E2E8F0] shadow-xs space-y-2.5 text-xs text-[#1E293B]">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Employee ID:</span>
                    <span className="font-mono font-bold text-[#1E293B]">{currentEmployee.id}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Compensation:</span>
                    <span className="font-bold text-emerald-700">
                      {formatSalaryRate(currentEmployee.payBasis, currentEmployee.wageRate, currentEmployee.hourlyRate)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Pay Scheme:</span>
                    <span className="font-semibold text-[#1E293B]">
                      {currentEmployee.payBasis === 'DAILY' ? 'Daily Wage (Per Day)' : currentEmployee.payBasis === 'WEEKLY' ? 'Weekly Wage (Per Week)' : 'Monthly Salary'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Assigned Shift:</span>
                    <span className="text-[#1E293B] font-medium">{assignedShift.name} ({assignedShift.badge})</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Mobile Punch:</span>
                    <span className={currentEmployee.allowMobilePunch === false ? "text-amber-700 font-semibold" : "text-emerald-700 font-semibold"}>
                      {currentEmployee.allowMobilePunch === false ? "Entrance Kiosk Only" : "Enabled (Face ID + GPS)"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Face Biometrics:</span>
                    <span className="text-emerald-700 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Enrolled (Active)
                    </span>
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* Clean Light Tab Bar */}
          <div className="w-full px-4 pb-4 pt-2 z-40 bg-white border-t border-[#E2E8F0] flex items-center justify-around shadow-xs">
            <button
              onClick={() => setActiveTab('TODAY')}
              className={`flex flex-col items-center gap-1 py-1 transition-all cursor-pointer ${
                activeTab === 'TODAY' ? 'text-[#2563EB] font-bold' : 'text-slate-500 hover:text-[#1E293B]'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span className="text-[9px] font-semibold">Today</span>
            </button>

            <button
              onClick={() => setActiveTab('HISTORY')}
              className={`flex flex-col items-center gap-1 py-1 transition-all cursor-pointer ${
                activeTab === 'HISTORY' ? 'text-[#2563EB] font-bold' : 'text-slate-500 hover:text-[#1E293B]'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span className="text-[9px] font-semibold">History</span>
            </button>

            <button
              onClick={() => setActiveTab('LEAVES')}
              className={`flex flex-col items-center gap-1 py-1 transition-all cursor-pointer ${
                activeTab === 'LEAVES' ? 'text-[#2563EB] font-bold' : 'text-slate-500 hover:text-[#1E293B]'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span className="text-[9px] font-semibold">Leaves</span>
            </button>

            <button
              id="tab-btn-alerts"
              onClick={() => setActiveTab('ALERTS')}
              className={`relative flex flex-col items-center gap-1 py-1 transition-all cursor-pointer ${
                activeTab === 'ALERTS' ? 'text-[#2563EB] font-bold' : 'text-slate-500 hover:text-[#1E293B]'
              }`}
            >
              <div className="relative">
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1.5 -right-2 min-w-[14px] h-3.5 px-0.5 rounded-full bg-rose-500 text-white font-bold text-[8px] flex items-center justify-center border border-white animate-pulse">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </div>
              <span className="text-[9px] font-semibold">Alerts</span>
            </button>

            <button
              onClick={() => setActiveTab('PROFILE')}
              className={`flex flex-col items-center gap-1 py-1 transition-all cursor-pointer ${
                activeTab === 'PROFILE' ? 'text-[#2563EB] font-bold' : 'text-slate-500 hover:text-[#1E293B]'
              }`}
            >
              <UserCheck className="w-4 h-4" />
              <span className="text-[9px] font-semibold">Profile</span>
            </button>
          </div>

          {/* iOS Home Indicator Bar (Only on desktop preview mockup) */}
          {!isNativeMobileView && (
            <div className="w-32 h-1 bg-slate-300 rounded-full mx-auto mb-1.5 z-40"></div>
          )}

          </>
          )}

        </div>

      </div>

      {/* APPLY LEAVE MODAL */}
      {showLeaveModal && (
        <div className="fixed inset-0 z-50 bg-slate-500/20 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-xl p-5 border border-[#E2E8F0] shadow-xl text-[#1E293B] animate-scale-in">
            <h3 className="text-base font-bold text-[#1E293B] mb-1">Apply for Leave</h3>
            <p className="text-xs text-slate-500 mb-4">Request approval from Store Admin</p>

            {leaveSubmitted ? (
              <div className="py-8 text-center">
                <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto mb-2 animate-bounce" />
                <p className="text-sm font-bold text-[#1E293B]">Leave Request Submitted!</p>
                <p className="text-xs text-slate-500">Store Manager notified for review.</p>
              </div>
            ) : (
              <form onSubmit={handleLeaveSubmit} className="space-y-3">
                <div>
                  <label className="text-[11px] text-slate-600 font-semibold block mb-1">Leave Type</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(['CASUAL', 'SICK', 'EMERGENCY', 'ANNUAL'] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setLeaveType(type)}
                        className={`py-1.5 text-xs font-semibold rounded-lg transition-all border cursor-pointer ${
                          leaveType === type ? 'bg-[#2563EB] text-white border-[#2563EB]' : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-[#E2E8F0]'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-1">Start Date</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full bg-white border border-[#CBD5E1] rounded-lg px-2.5 py-1.5 text-xs text-[#1E293B] focus:outline-none focus:border-[#2563EB]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-1">End Date</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full bg-white border border-[#CBD5E1] rounded-lg px-2.5 py-1.5 text-xs text-[#1E293B] focus:outline-none focus:border-[#2563EB]"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] text-slate-600 font-semibold block mb-1">Reason</label>
                  <textarea
                    rows={2}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Reason for leave"
                    required
                    className="w-full bg-white border border-[#CBD5E1] rounded-lg p-2.5 text-xs text-[#1E293B] focus:outline-none focus:border-[#2563EB]"
                  />
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowLeaveModal(false)}
                    className="flex-1 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 border border-[#E2E8F0] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2 rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white font-bold text-xs shadow-xs cursor-pointer"
                  >
                    Submit Request
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* NOTIFICATIONS CENTER MODAL */}
      {showNotificationsModal && currentEmployee && (
        <div className="fixed inset-0 z-50 bg-slate-500/20 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-md bg-white rounded-xl p-5 border border-[#E2E8F0] shadow-xl space-y-4 max-h-[85vh] flex flex-col text-[#1E293B]">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0] shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-blue-50 border border-blue-100 text-[#2563EB]">
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#1E293B]">Notification Alerts</h3>
                  <p className="text-xs text-slate-500">
                    {unreadCount > 0 ? `${unreadCount} unread message${unreadCount === 1 ? '' : 's'}` : 'All caught up'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {staffNotifications.length > 0 && onMarkAllNotificationsAsRead && (
                  <button
                    onClick={() => onMarkAllNotificationsAsRead(currentEmployee.id)}
                    className="text-[11px] text-[#2563EB] hover:text-blue-700 font-semibold px-2 py-1 rounded-lg hover:bg-slate-100 cursor-pointer"
                  >
                    Mark all read
                  </button>
                )}
                <button
                  onClick={() => setShowNotificationsModal(false)}
                  className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-[#1E293B] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Filter pills */}
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-[#E2E8F0] text-xs shrink-0">
              {(['ALL', 'LEAVES', 'SHIFTS'] as const).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setActiveNotifFilter(filter)}
                  className={`flex-1 py-1 rounded-lg font-bold transition-all text-center cursor-pointer ${
                    activeNotifFilter === filter ? 'bg-[#2563EB] text-white shadow-xs' : 'text-slate-600 hover:text-[#1E293B]'
                  }`}
                >
                  {filter === 'ALL' ? 'All' : filter === 'LEAVES' ? 'Leaves' : 'Shifts'}
                </button>
              ))}
            </div>

            {/* Notification items list */}
            <div className="overflow-y-auto space-y-2.5 pr-1 flex-1">
              {filteredStaffNotifications.length === 0 ? (
                <div className="py-12 text-center text-slate-500 space-y-2">
                  <Bell className="w-8 h-8 text-slate-400 mx-auto" />
                  <p className="text-sm font-semibold text-[#1E293B]">No notifications</p>
                  <p className="text-xs text-slate-500">
                    Leave status decisions and store shift adjustments will appear here.
                  </p>
                </div>
              ) : (
                filteredStaffNotifications.map((notif) => (
                  <div
                    key={notif.id}
                    onClick={() => handleOpenNotificationItem(notif)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer relative bg-white shadow-xs ${
                      !notif.read ? 'border-[#2563EB] ring-1 ring-[#2563EB]/20' : 'border-[#E2E8F0]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-md border ${
                          notif.type === 'LEAVE_STATUS'
                            ? notif.leaveStatus === 'APPROVED'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-blue-50 text-[#2563EB] border-blue-200'
                        }`}>
                          {notif.type === 'LEAVE_STATUS' ? `LEAVE ${notif.leaveStatus || 'UPDATE'}` : 'SHIFT ROSTER'}
                        </span>
                        {!notif.read && (
                          <span className="w-2 h-2 rounded-full bg-[#2563EB]" />
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-slate-400 font-mono">{notif.timeFormatted}</span>
                        {onDeleteNotification && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteNotification(notif.id);
                            }}
                            className="p-1 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                            title="Delete alert"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>

                    <h4 className="text-xs font-bold text-[#1E293B] mb-0.5">{notif.title}</h4>
                    <p className="text-[11px] text-slate-600 leading-relaxed">{notif.message}</p>

                    {notif.type === 'LEAVE_STATUS' && notif.leaveStatus && (
                      <div className="mt-2 pt-1.5 border-t border-[#E2E8F0] flex items-center justify-between text-[10px]">
                        <span className="text-slate-500">Decision:</span>
                        <strong className={notif.leaveStatus === 'APPROVED' ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold'}>
                          {notif.leaveStatus}
                        </strong>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 border-t border-[#E2E8F0] shrink-0">
              <button
                onClick={() => setShowNotificationsModal(false)}
                className="w-full py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-all cursor-pointer border border-[#E2E8F0]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
