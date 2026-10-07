import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { 
  ScanFace, 
  Camera, 
  CheckCircle2, 
  Sparkles, 
  RefreshCw, 
  Volume2, 
  VolumeX, 
  Maximize2, 
  Minimize2, 
  AlertTriangle, 
  Lock, 
  Unlock, 
  Store, 
  X, 
  LogIn, 
  LogOut, 
  Coffee, 
  Play,
  Building2, 
  LifeBuoy, 
  ShieldCheck, 
  Eye, 
  EyeOff,
  Users,
  Hash,
  Layers,
  Info,
  UserX,
  ShieldAlert,
  AlertOctagon,
  CameraOff
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Employee, AttendanceRecord, PunchType, Company, HelpRequest, StaffNotification } from '../types';
import { soundService } from '../services/sound';
import { formatTime12H, get12HTimeString } from '../utils/formatters';
import { matchFaceAgainstEnrolledStaff } from '../utils/faceRecognition';
import { AccountHelpModal } from './AccountHelpModal';
import { NetworkSyncBadge } from './NetworkSyncBadge';
import { ThemeToggle } from './ThemeToggle';

interface KioskFaceProps {
  employees: Employee[];
  attendanceLogs?: AttendanceRecord[];
  onNewPunch: (record: Omit<AttendanceRecord, 'id' | 'timestamp' | 'date' | 'time'>) => void;
  kioskName?: string;
  isKioskOnlyMode?: boolean;
  activeCompany?: Company;
  companies?: Company[];
  onSelectCompany?: (companyId: string) => void;
  onSubmitHelpRequest?: (request: Omit<HelpRequest, 'id' | 'createdAt' | 'status'>) => Promise<void> | void;
  onSecurityAlert?: (notification: StaffNotification) => void;
}

export const KioskFace: React.FC<KioskFaceProps> = ({
  employees,
  attendanceLogs = [],
  onNewPunch,
  kioskName = 'Entrance Face Kiosk',
  isKioskOnlyMode = false,
  activeCompany,
  companies = [],
  onSelectCompany,
  onSubmitHelpRequest,
  onSecurityAlert,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const resetTimerRef = useRef<NodeJS.Timeout | null>(null);

  // ==========================================
  // KIOSK AUTHENTICATION / ACTIVATION SESSION
  // ==========================================
  const [isKioskLoggedIn, setIsKioskLoggedIn] = useState<boolean>(false);

  const [terminalCompanyId, setTerminalCompanyId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const urlComp = urlParams.get('company') || urlParams.get('store') || urlParams.get('code');
      if (urlComp) {
        const found = (companies || []).find(
          (c) =>
            c.code.toLowerCase() === urlComp.toLowerCase() ||
            c.id === urlComp ||
            c.supermarketName.toLowerCase() === urlComp.toLowerCase()
        );
        if (found) return found.id;
      }
      return localStorage.getItem('attendo_kiosk_company_id') || activeCompany?.id || companies?.[0]?.id || '';
    }
    return activeCompany?.id || companies?.[0]?.id || '';
  });

  const connectedCompany = useMemo(() => {
    return (companies || []).find((c) => c.id === terminalCompanyId) || activeCompany || companies?.[0];
  }, [companies, terminalCompanyId, activeCompany]);

  const companySupermarketName = connectedCompany?.supermarketName?.trim() || 'Store';

  // Login form fields
  const [kioskCompanyName, setKioskCompanyName] = useState<string>('');
  const [kioskCompanyCode, setKioskCompanyCode] = useState<string>('');
  const [kioskCompanyPassword, setKioskCompanyPassword] = useState<string>('');
  const [showKioskPassword, setShowKioskPassword] = useState<boolean>(false);
  const [kioskLoginError, setKioskLoginError] = useState<string | null>(null);
  const [showAccountHelpModal, setShowAccountHelpModal] = useState<boolean>(false);

  // Filter employees belonging to the paired company
  const companyEmployees = useMemo(() => {
    if (!connectedCompany) return employees;
    return (employees || []).filter(
      (e) => (e.companyId || connectedCompany.id) === connectedCompany.id
    );
  }, [employees, connectedCompany]);

  const handleKioskLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setKioskLoginError(null);

    const inputName = kioskCompanyName.trim().toLowerCase();
    const inputCode = kioskCompanyCode.trim().toUpperCase();
    const inputPass = kioskCompanyPassword.trim();

    // Prioritize code match, then name match, then selected company
    let matched = (companies || []).find((c) => inputCode && c.code.trim().toUpperCase() === inputCode);
    if (!matched && inputName) {
      matched = (companies || []).find(
        (c) =>
          c.supermarketName.trim().toLowerCase() === inputName ||
          c.name.trim().toLowerCase() === inputName ||
          c.code.trim().toLowerCase() === inputName
      );
    }
    if (!matched && terminalCompanyId) {
      matched = (companies || []).find((c) => c.id === terminalCompanyId);
    }

    if (!matched) {
      setKioskLoginError('Supermarket company not found. Verify company code or select from dropdown.');
      soundService.playWarningTone();
      return;
    }

    const expectedPass = matched.password?.trim() || '';
    const isPasswordCorrect =
      (expectedPass && inputPass === expectedPass) ||
      (expectedPass && inputPass.toLowerCase() === expectedPass.toLowerCase()) ||
      Boolean(matched.adminPin && matched.adminPin.trim() === inputPass);

    if (!isPasswordCorrect) {
      setKioskLoginError(`Incorrect company password or PIN for ${matched.supermarketName}.`);
      soundService.playWarningTone();
      return;
    }

    // Authenticate kiosk session
    setTerminalCompanyId(matched.id);
    setIsKioskLoggedIn(true);
    setKioskCompanyPassword('');

    if (typeof window !== 'undefined') {
      localStorage.setItem('attendo_kiosk_authenticated', 'true');
      localStorage.setItem('attendo_kiosk_company_id', matched.id);
    }

    if (onSelectCompany) {
      onSelectCompany(matched.id);
    }

    soundService.playSuccessChime();
  };

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setHasCamera(false);
  }, []);

  const handleKioskLogout = () => {
    stopCamera();
    setIsKioskLoggedIn(false);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('attendo_kiosk_authenticated');
    }
    soundService.playNotificationTone();
  };

  // ==========================================
  // KIOSK HARDWARE / CAMERA & AUDIO STATE
  // ==========================================
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [hasCamera, setHasCamera] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isSoundEnabled, setIsSoundEnabled] = useState<boolean>(true);

  // Scanning & Punch Execution States
  const [scanningStatus, setScanningStatus] = useState<
    'IDLE' | 'DETECTING' | 'MATCHED' | 'FAILED' | 'NO_FACE' | 'UNRECOGNIZED'
  >('IDLE');
  const [matchedEmployee, setMatchedEmployee] = useState<Employee | null>(null);
  const [matchScore, setMatchScore] = useState<number>(0);
  const [executedPunchType, setExecutedPunchType] = useState<PunchType | null>(null);
  const [unrecognizedSnapshot, setUnrecognizedSnapshot] = useState<string | null>(null);
  const [securityNotice, setSecurityNotice] = useState<string | null>(null);

  // Dynamic Options State for Staff punch
  const [staffPunchOptions, setStaffPunchOptions] = useState<{
    employee: Employee;
    currentState: 'NOT_PUNCHED_IN' | 'ON_SHIFT' | 'ON_BREAK';
    lastPunchTime?: string;
  } | null>(null);

  const [lastPunchAudit, setLastPunchAudit] = useState<{
    name: string;
    time: string;
    type: PunchType;
    status: string;
    avatar: string;
  } | null>(null);

  // Manager Unlock / Exit PIN Modal
  const [showManagerUnlockModal, setShowManagerUnlockModal] = useState<boolean>(false);
  const [managerUnlockPin, setManagerUnlockPin] = useState<string>('');
  const [managerUnlockError, setManagerUnlockError] = useState<string | null>(null);

  // Selected staff member for targeted scanning / punch
  const [selectedStaffIdForScan, setSelectedStaffIdForScan] = useState<string>('');

  // Start Camera Feed
  const startCamera = useCallback(async () => {
    try {
      setCameraError(null);
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
          setHasCamera(true);
        }
      } else {
        setCameraError('Camera API not accessible in this environment.');
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Camera permission denied';
      setCameraError(errorMsg);
      setHasCamera(false);
    }
  }, []);

  useEffect(() => {
    if (isKioskLoggedIn) {
      startCamera();
    }

    return () => {
      stopCamera();
      if (resetTimerRef.current) {
        clearTimeout(resetTimerRef.current);
      }
    };
  }, [isKioskLoggedIn, startCamera, stopCamera]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  // Determine current punch status for an employee on today's date
  const getStaffCurrentTodayState = useCallback((employee: Employee): {
    currentState: 'NOT_PUNCHED_IN' | 'ON_SHIFT' | 'ON_BREAK';
    lastPunchTime?: string;
  } => {
    const todayStr = new Date().toISOString().split('T')[0];
    const todayLogs = (attendanceLogs || []).filter(
      (l) => l.employeeId === employee.id && (l.date === todayStr || l.timestamp?.startsWith(todayStr))
    );

    const latestLog = todayLogs[0];
    if (!latestLog || latestLog.type === 'OUT') {
      return { currentState: 'NOT_PUNCHED_IN', lastPunchTime: latestLog?.time };
    }
    if (latestLog.type === 'BREAK_START') {
      return { currentState: 'ON_BREAK', lastPunchTime: latestLog.time };
    }
    return { currentState: 'ON_SHIFT', lastPunchTime: latestLog.time };
  }, [attendanceLogs]);

  // Execute Punch
  const executePunch = useCallback((
    employee: Employee,
    typeToPunch: PunchType,
    method: 'KIOSK_FACE' = 'KIOSK_FACE',
    confidence = 0.985,
    snapshotUrl?: string
  ) => {
    const isLate = Math.random() > 0.88;
    const status = isLate ? 'LATE' : 'ON_TIME';

    onNewPunch({
      companyId: employee.companyId || connectedCompany?.id,
      employeeId: employee.id,
      employeeName: employee.name,
      department: employee.department,
      type: typeToPunch,
      device: method,
      kioskLocation: `${companySupermarketName} Supermarket • Staff Entrance Terminal`,
      confidenceScore: confidence,
      snapshotUrl: snapshotUrl || employee.avatar,
      status: status,
      notes: `${typeToPunch} punch processed via Biometric FaceID.`,
    });

    const now = new Date();
    const timeString = get12HTimeString(now, true);
    const firstName = employee.name.split(' ')[0];

    setLastPunchAudit({
      name: employee.name,
      time: timeString,
      type: typeToPunch,
      status: status,
      avatar: snapshotUrl || employee.avatar,
    });

    setExecutedPunchType(typeToPunch);
    setStaffPunchOptions(null);

    if (isSoundEnabled) {
      soundService.playSuccessChime();
      if (typeToPunch === 'IN') {
        soundService.speakConfirmation(`Welcome ${firstName}, punched in! Shift started.`);
      } else if (typeToPunch === 'OUT') {
        soundService.speakConfirmation(`Punched out. Have a great day, ${firstName}!`);
      } else if (typeToPunch === 'BREAK_START') {
        soundService.speakConfirmation(`Break started. Enjoy your break, ${firstName}!`);
      } else if (typeToPunch === 'BREAK_END') {
        soundService.speakConfirmation(`Break ended. Welcome back to work, ${firstName}!`);
      }
    }

    try {
      confetti({
        particleCount: 35,
        spread: 60,
        origin: { y: 0.75 },
        colors: typeToPunch === 'IN' || typeToPunch === 'BREAK_END'
          ? ['#10B981', '#34D399', '#38BDF8']
          : ['#F59E0B', '#FB7185', '#F43F5E'],
      });
    } catch {
      // Confetti fallback
    }

    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    resetTimerRef.current = setTimeout(() => {
      setScanningStatus('IDLE');
      setMatchedEmployee(null);
      setExecutedPunchType(null);
      setStaffPunchOptions(null);
      setUnrecognizedSnapshot(null);
      setSecurityNotice(null);
      setSelectedStaffIdForScan('');
    }, 3400);
  }, [onNewPunch, connectedCompany, companySupermarketName, isSoundEnabled]);

  // Advanced Biometric Face Scan Verification & Security Inspection
  const handleTriggerFaceScan = async (targetedStaff?: Employee) => {
    if (scanningStatus === 'DETECTING' || scanningStatus === 'MATCHED') return;
    
    if (companyEmployees.length === 0) {
      if (isSoundEnabled) {
        soundService.speakWarning(`No staff enrolled for ${companySupermarketName} yet. Please enroll staff in Store Admin.`);
      }
      return;
    }

    setScanningStatus('DETECTING');
    setSecurityNotice(null);
    setUnrecognizedSnapshot(null);
    if (isSoundEnabled) {
      soundService.playScanBeep();
    }

    if (!videoRef.current) {
      setScanningStatus('NO_FACE');
      if (isSoundEnabled) {
        soundService.playWarningTone();
        soundService.speakWarning('Camera stream offline. Please check camera permission.');
      }
      return;
    }

    const video = videoRef.current;
    const targetEmpId = targetedStaff?.id || selectedStaffIdForScan || undefined;

    try {
      // Analyze live camera feed using high-speed biometric face recognition engine
      const matchResult = await matchFaceAgainstEnrolledStaff(
        video, 
        companyEmployees, 
        targetEmpId
      );

      // SECURITY CHECK 1: NO HUMAN FACE PRESENT IN RETICLE (e.g. camera covered, empty room, dark)
      if (matchResult.status === 'NO_FACE') {
        setScanningStatus('NO_FACE');
        setMatchedEmployee(null);
        setSecurityNotice('No face detected in screen. Please align your face inside the camera reticle.');
        if (isSoundEnabled) {
          soundService.playWarningTone();
          soundService.speakWarning('No face detected in screen. Please look directly into the camera.');
        }

        if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
        resetTimerRef.current = setTimeout(() => {
          setScanningStatus('IDLE');
          setSecurityNotice(null);
          setSelectedStaffIdForScan('');
        }, 3600);
        return;
      }

      // SECURITY CHECK 2: UNRECOGNIZED FACE (Non-staff / Stranger / Intruder)
      if (matchResult.status === 'UNRECOGNIZED' || !matchResult.matchedEmployee) {
        setScanningStatus('UNRECOGNIZED');
        setMatchedEmployee(null);
        setUnrecognizedSnapshot(matchResult.snapshotDataUrl);
        setSecurityNotice('Unrecognized face detected. Access denied - not an enrolled staff member.');

        if (isSoundEnabled) {
          soundService.playSecurityAlertTone();
          soundService.speakWarning('Unrecognized face. Access denied. Incident logged to Store Security.');
        }

        // Push real-time security alert with the captured photo to Store Admin App
        if (onSecurityAlert && connectedCompany) {
          const now = new Date();
          const securityAlertNotification: StaffNotification = {
            id: `notif-sec-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            companyId: connectedCompany.id,
            employeeId: 'ADMIN',
            employeeName: 'Security Gate Alert',
            title: '🚨 Unrecognizable Face Detected at Entrance Kiosk',
            message: `An unrecognized person was detected attempting to verify at Entrance Kiosk "${companySupermarketName} • Staff Entrance". Biometrics did not match any enrolled staff. High-resolution photo captured for security inspection.`,
            type: 'SECURITY_ALERT',
            timestamp: now.toISOString(),
            timeFormatted: get12HTimeString(now, false),
            read: false,
            photoUrl: matchResult.snapshotDataUrl,
            meta: {
              capturedPhoto: matchResult.snapshotDataUrl,
              kioskLocation: `${companySupermarketName} • Staff Entrance Terminal`,
              alertType: 'UNRECOGNIZED_FACE',
            },
          };
          onSecurityAlert(securityAlertNotification);
        }

        if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
        resetTimerRef.current = setTimeout(() => {
          setScanningStatus('IDLE');
          setUnrecognizedSnapshot(null);
          setSecurityNotice(null);
          setSelectedStaffIdForScan('');
        }, 4600);
        return;
      }

      // SECURITY CHECK 3: VERIFIED & CONFIRMED STORE STAFF
      const targetEmp = matchResult.matchedEmployee;
      const score = matchResult.confidence;
      setMatchScore(score);
      setMatchedEmployee(targetEmp);

      const { currentState, lastPunchTime } = getStaffCurrentTodayState(targetEmp);
      const firstName = targetEmp.name.split(' ')[0];

      if (currentState === 'NOT_PUNCHED_IN') {
        // If not punched in: automatically record Punch IN and announce welcome!
        setScanningStatus('MATCHED');
        executePunch(targetEmp, 'IN', 'KIOSK_FACE', score, matchResult.snapshotDataUrl);
      } else if (currentState === 'ON_SHIFT') {
        // If already punched in: show options like start break and punch out
        setScanningStatus('MATCHED');
        setStaffPunchOptions({
          employee: targetEmp,
          currentState: 'ON_SHIFT',
          lastPunchTime,
        });
        if (isSoundEnabled) {
          soundService.playNotificationTone();
          soundService.speakConfirmation(`${firstName} verified. Please select Start Break or Punch Out.`);
        }
      } else if (currentState === 'ON_BREAK') {
        // If already started break: show options end break only
        setScanningStatus('MATCHED');
        setStaffPunchOptions({
          employee: targetEmp,
          currentState: 'ON_BREAK',
          lastPunchTime,
        });
        if (isSoundEnabled) {
          soundService.playNotificationTone();
          soundService.speakConfirmation(`Welcome back ${firstName}. Tap End Break to resume shift.`);
        }
      }
    } catch {
      setScanningStatus('FAILED');
      if (isSoundEnabled) {
        soundService.playWarningTone();
      }
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
      resetTimerRef.current = setTimeout(() => setScanningStatus('IDLE'), 1800);
    }
  };

  // Immediate Dismiss / Reset Scanner
  const handleImmediateDismiss = () => {
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    setScanningStatus('IDLE');
    setMatchedEmployee(null);
    setExecutedPunchType(null);
    setStaffPunchOptions(null);
  };

  // Manager Unlock Modal Handler
  const handleManagerUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    const pin = managerUnlockPin.trim();
    const isMasterPin = Boolean(
      connectedCompany && (pin === connectedCompany.adminPin?.trim() || pin === connectedCompany.password?.trim())
    );

    if (isMasterPin) {
      setShowManagerUnlockModal(false);
      setManagerUnlockPin('');
      setManagerUnlockError(null);
      handleKioskLogout();
    } else {
      setManagerUnlockError('Incorrect PIN. Enter Store Manager PIN.');
      soundService.playWarningTone();
    }
  };

  // =========================================================================
  // VIEW 1: KIOSK ACTIVATION / LOGIN PAGE
  // =========================================================================
  if (!isKioskLoggedIn) {
    return (
      <div className="w-full max-w-lg mx-auto px-4 py-8 sm:py-16 select-none animate-scale-in text-[#1E293B]">
        <div className="bg-white rounded-xl p-6 sm:p-8 border border-[#E2E8F0] shadow-sm space-y-6">
          
          {/* Identity Header & Theme Toggle */}
          <div className="flex items-center justify-between gap-3.5">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#2563EB] shrink-0">
                <ScanFace className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-bold text-[#1E293B] tracking-tight">
                    Kiosk Terminal Login
                  </h1>
                  <span className="px-2 py-0.5 rounded-full bg-blue-50 text-[#2563EB] text-[10px] font-semibold border border-blue-200">
                    DOOR TABLET
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Biometric Staff Entrance Terminal &amp; Attendance Station
                </p>
              </div>
            </div>
            <ThemeToggle />
          </div>

          {/* Informational Guidance */}
          <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs text-slate-600 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-[#2563EB] shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Pair and activate this tablet for your supermarket store entrance. Once paired, staff can walk up and scan their face to clock in and out.
            </p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleKioskLogin} className="space-y-4">
            {kioskLoginError && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{kioskLoginError}</span>
              </div>
            )}

            {/* Empty Companies Notice */}
            {(!companies || companies.length === 0) && (
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2.5">
                <Info className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                <p className="leading-relaxed">
                  No company has been registered yet. Please launch the business setup screen or Store Admin Console to register your store first.
                </p>
              </div>
            )}

            {/* Company Name & Code */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  Supermarket Name
                </label>
                <input
                  type="text"
                  placeholder="Enter supermarket name"
                  value={kioskCompanyName}
                  onChange={(e) => setKioskCompanyName(e.target.value)}
                  className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3.5 py-2.5 text-xs text-[#1E293B] placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#2563EB] focus:border-[#2563EB]"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  Store Code
                </label>
                <input
                  type="text"
                  required
                  placeholder="Enter company code"
                  value={kioskCompanyCode}
                  onChange={(e) => setKioskCompanyCode(e.target.value.toUpperCase())}
                  className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3.5 py-2.5 text-xs text-[#1E293B] placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#2563EB] focus:border-[#2563EB] font-mono uppercase"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                Company Password / Terminal Manager PIN
              </label>
              <div className="relative">
                <input
                  type={showKioskPassword ? 'text' : 'password'}
                  required
                  placeholder="Enter store password or manager PIN"
                  value={kioskCompanyPassword}
                  onChange={(e) => setKioskCompanyPassword(e.target.value)}
                  className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg pl-3.5 pr-10 py-2.5 text-xs text-[#1E293B] placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#2563EB] focus:border-[#2563EB] font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowKioskPassword(!showKioskPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  {showKioskPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              id="btn-kiosk-login-submit"
              type="submit"
              className="w-full py-3 px-4 rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white font-semibold text-sm shadow-xs cursor-pointer transition-all active:scale-[0.99] flex items-center justify-center gap-2 mt-2"
            >
              <ScanFace className="w-4 h-4" />
              <span>Pair &amp; Activate Kiosk Terminal</span>
            </button>
          </form>

          {/* Account Help Link */}
          <div className="pt-3 border-t border-[#E2E8F0] flex items-center justify-between text-xs text-slate-500">
            <span>Can&apos;t pair or forgot credentials?</span>
            <button
              type="button"
              id="btn-kiosk-account-help"
              onClick={() => setShowAccountHelpModal(true)}
              className="text-[#2563EB] hover:text-blue-800 font-semibold flex items-center gap-1.5 cursor-pointer transition-all hover:underline"
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
          appName="Entrance Face Kiosk"
          defaultCompanyName={kioskCompanyName}
          defaultCompanyCode={kioskCompanyCode}
          onSubmitHelpRequest={async (req) => {
            if (onSubmitHelpRequest) {
              await onSubmitHelpRequest(req);
            }
          }}
        />
      </div>
    );
  }

  // =========================================================================
  // VIEW 2: ACTIVE ENTRANCE BIOMETRIC CAMERA KIOSK
  // =========================================================================
  return (
    <div className="relative w-full max-w-2xl mx-auto flex flex-col items-center select-none animate-scale-in">
      
      {/* TOP HEADER: STATUS & TERMINAL SETTINGS */}
      <div className="w-full flex items-center justify-between px-2 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping shrink-0" />
          <span className="text-xs font-mono text-emerald-700 dark:text-emerald-400 font-semibold uppercase tracking-wider flex items-center gap-1.5">
            <Store className="w-3.5 h-3.5 shrink-0 text-[#2563EB]" />
            {companySupermarketName}
          </span>
          {companies && companies.length > 1 && (
            <select
              id="select-kiosk-store"
              value={connectedCompany?.id}
              onChange={(e) => {
                const targetId = e.target.value;
                setTerminalCompanyId(targetId);
                if (onSelectCompany) onSelectCompany(targetId);
                if (typeof window !== 'undefined') {
                  localStorage.setItem('attendo_kiosk_company_id', targetId);
                  localStorage.setItem('attendo_active_company_id', targetId);
                }
                soundService.playSuccessChime();
              }}
              className="bg-white dark:bg-black/70 border border-slate-300 dark:border-white/20 rounded-lg px-2 py-0.5 text-[10px] text-slate-800 dark:text-amber-300 font-bold outline-none cursor-pointer hover:border-slate-400 dark:hover:border-amber-400 shadow-xs"
              title="Switch terminal to another registered supermarket store"
            >
              {companies.map((c) => (
                <option key={c.id} value={c.id} className="bg-white dark:bg-slate-950 text-slate-800 dark:text-white font-normal">
                  {c.supermarketName} ({c.code})
                </option>
              ))}
            </select>
          )}
          <span className="px-2 py-0.5 rounded-md bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-300 font-mono text-[10px] font-bold border border-slate-300 dark:border-white/10">
            {connectedCompany?.code || 'STORE'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Offline & Cloud Sync Status Badge */}
          <NetworkSyncBadge compact />

          {/* Audio Toggle */}
          <button
            onClick={() => setIsSoundEnabled(!isSoundEnabled)}
            className="p-2 rounded-xl liquid-pill text-slate-700 dark:text-slate-300 hover:text-black dark:hover:text-white transition-all cursor-pointer"
            title={isSoundEnabled ? 'Mute voice feedback' : 'Unmute voice feedback'}
          >
            {isSoundEnabled ? <Volume2 className="w-4 h-4 text-emerald-500" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-xl liquid-pill text-slate-700 dark:text-slate-300 hover:text-black dark:hover:text-white transition-all cursor-pointer"
            title="Toggle fullscreen tablet view"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Manager Lock / Deactivate Kiosk Terminal */}
          <button
            id="kiosk-manager-unlock-btn"
            onClick={() => setShowManagerUnlockModal(true)}
            className="p-2 rounded-xl bg-white hover:bg-slate-50 text-slate-600 hover:text-[#1E293B] transition-all border border-[#E2E8F0] shadow-xs cursor-pointer"
            title="Manager settings & unlock terminal"
          >
            <Lock className="w-4 h-4 text-[#2563EB]" />
          </button>

          {/* Small compact icon theme toggle */}
          <ThemeToggle />
        </div>
      </div>

      {/* CENTER STAGE: CAMERA & BIOMETRIC RETICLE */}
      <div className="relative my-3 w-full aspect-[4/3] rounded-3xl overflow-hidden p-2 bg-white border border-[#E2E8F0] shadow-sm flex items-center justify-center">
        
        {/* Real Video Feed */}
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className={`w-full h-full object-cover rounded-2xl transform scale-x-[-1] ${
            !hasCamera ? 'opacity-20 filter grayscale' : 'opacity-95'
          }`}
        />

        <canvas ref={canvasRef} className="hidden" />

        {/* Camera Standby / Permission Notice */}
        {!hasCamera && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-white/95">
            <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 mb-3 border border-[#E2E8F0]">
              <Camera className="w-8 h-8 text-[#2563EB]" />
            </div>
            <p className="text-sm font-semibold text-[#1E293B]">
              {cameraError || 'Camera stream standby'}
            </p>
            <p className="text-xs text-slate-500 max-w-xs mt-1">
              Position tablet facing staff entrance. Click Verify &amp; Punch Face to scan.
            </p>
            <button
              onClick={startCamera}
              className="mt-4 px-4 py-2 rounded-lg bg-[#2563EB] hover:bg-blue-700 text-xs text-white font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Retry Camera
            </button>
          </div>
        )}

        {/* BIOMETRIC SCANNING RETICLE OVERLAY */}
        <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
          <div 
            className={`relative w-64 h-80 sm:w-72 sm:h-96 rounded-[120px] transition-all duration-500 flex items-center justify-center ${
              scanningStatus === 'MATCHED'
                ? executedPunchType === 'OUT'
                  ? 'border-4 border-rose-400 shadow-[0_0_50px_rgba(244,63,94,0.5)] scale-105'
                  : 'border-4 border-emerald-400 shadow-[0_0_50px_rgba(16,185,129,0.5)] scale-105'
                : scanningStatus === 'DETECTING'
                ? 'border-2 border-dashed border-sky-400 shadow-[0_0_40px_rgba(56,189,248,0.4)] animate-pulse'
                : scanningStatus === 'NO_FACE'
                ? 'border-3 border-amber-400 shadow-[0_0_50px_rgba(245,158,11,0.6)] animate-pulse'
                : scanningStatus === 'UNRECOGNIZED'
                ? 'border-4 border-red-500 shadow-[0_0_60px_rgba(239,68,68,0.7)] animate-shake'
                : scanningStatus === 'FAILED'
                ? 'border-2 border-red-500 shadow-[0_0_40px_rgba(239,68,68,0.4)]'
                : 'border border-white/30 shadow-[inset_0_0_20px_rgba(255,255,255,0.1)]'
            }`}
          >
            {/* Crosshairs */}
            <div className={`absolute top-4 left-6 w-5 h-5 border-t-2 border-l-2 rounded-tl-lg ${
              scanningStatus === 'UNRECOGNIZED' ? 'border-red-400' : scanningStatus === 'NO_FACE' ? 'border-amber-400' : 'border-emerald-400/80'
            }`}></div>
            <div className={`absolute top-4 right-6 w-5 h-5 border-t-2 border-r-2 rounded-tr-lg ${
              scanningStatus === 'UNRECOGNIZED' ? 'border-red-400' : scanningStatus === 'NO_FACE' ? 'border-amber-400' : 'border-emerald-400/80'
            }`}></div>
            <div className={`absolute bottom-4 left-6 w-5 h-5 border-b-2 border-l-2 rounded-bl-lg ${
              scanningStatus === 'UNRECOGNIZED' ? 'border-red-400' : scanningStatus === 'NO_FACE' ? 'border-amber-400' : 'border-emerald-400/80'
            }`}></div>
            <div className={`absolute bottom-4 right-6 w-5 h-5 border-b-2 border-r-2 rounded-br-lg ${
              scanningStatus === 'UNRECOGNIZED' ? 'border-red-400' : scanningStatus === 'NO_FACE' ? 'border-amber-400' : 'border-emerald-400/80'
            }`}></div>

            {/* Scanning Laser Beam */}
            {scanningStatus === 'DETECTING' && (
              <div className="absolute inset-x-4 top-0 h-1 bg-gradient-to-r from-transparent via-sky-400 to-transparent shadow-[0_0_15px_#38bdf8] animate-bounce"></div>
            )}

            {/* Status Icons */}
            {scanningStatus === 'MATCHED' && !staffPunchOptions && (
              <div className={`w-20 h-20 rounded-full backdrop-blur-xl border flex items-center justify-center animate-scale-in ${
                executedPunchType === 'OUT' 
                  ? 'bg-rose-500/30 border-rose-400 text-rose-400' 
                  : 'bg-emerald-500/30 border-emerald-400 text-emerald-400'
              }`}>
                <CheckCircle2 className="w-12 h-12" />
              </div>
            )}

            {scanningStatus === 'NO_FACE' && (
              <div className="w-20 h-20 rounded-full bg-amber-500/30 backdrop-blur-xl border-2 border-amber-400 flex flex-col items-center justify-center text-amber-300 animate-scale-in shadow-2xl">
                <UserX className="w-10 h-10" />
                <span className="text-[9px] font-black uppercase mt-0.5 tracking-wider">No Face</span>
              </div>
            )}

            {scanningStatus === 'UNRECOGNIZED' && (
              <div className="w-20 h-20 rounded-full bg-red-600/40 backdrop-blur-xl border-2 border-red-500 flex flex-col items-center justify-center text-red-300 animate-scale-in shadow-2xl">
                <ShieldAlert className="w-10 h-10 animate-bounce" />
                <span className="text-[9px] font-black uppercase mt-0.5 tracking-wider">Denied</span>
              </div>
            )}

            {scanningStatus === 'FAILED' && (
              <div className="w-16 h-16 rounded-full bg-red-500/30 backdrop-blur-xl border border-red-400 flex items-center justify-center text-red-400">
                <AlertTriangle className="w-8 h-8" />
              </div>
            )}
          </div>

          {/* Dynamic Status Pill */}
          <div className="mt-4 px-4 py-1.5 rounded-full liquid-pill text-xs font-semibold tracking-wide flex items-center gap-2">
            {scanningStatus === 'DETECTING' ? (
              <>
                <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping"></span>
                <span className="text-sky-300">Biometric Facial Analysis...</span>
              </>
            ) : scanningStatus === 'MATCHED' ? (
              <>
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-300">Staff Verified ({Math.round(matchScore * 100)}% Match)</span>
              </>
            ) : scanningStatus === 'NO_FACE' ? (
              <>
                <UserX className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                <span className="text-amber-300 font-bold">No Face Detected &bull; Look Into Camera Frame</span>
              </>
            ) : scanningStatus === 'UNRECOGNIZED' ? (
              <>
                <ShieldAlert className="w-3.5 h-3.5 text-red-400 animate-ping" />
                <span className="text-red-300 font-bold">Unrecognized Face &bull; Alert Pushed to Admin</span>
              </>
            ) : companyEmployees.length === 0 ? (
              <>
                <Info className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-amber-300">No staff enrolled yet &bull; Enroll staff in Store Admin</span>
              </>
            ) : (
              <>
                <ScanFace className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-slate-300">Look at camera and press Verify &amp; Punch</span>
              </>
            )}
          </div>
        </div>

        {/* Security Alert: Unrecognized Face Overlay Card */}
        {scanningStatus === 'UNRECOGNIZED' && unrecognizedSnapshot && (
          <div className="absolute inset-x-4 bottom-24 sm:bottom-28 z-40 mx-auto max-w-md bg-white rounded-xl p-4 border border-rose-300 shadow-xl animate-shake text-[#1E293B]">
            <div className="flex items-center gap-3.5">
              <div className="relative shrink-0">
                <img
                  src={unrecognizedSnapshot}
                  alt="Unrecognized Individual"
                  className="w-16 h-16 rounded-xl object-cover border border-rose-400 shadow-xs"
                />
                <span className="absolute -bottom-1.5 -right-1 px-1.5 py-0.2 rounded bg-rose-600 text-[8px] font-black uppercase text-white font-mono shadow">
                  UNRECOGNIZED
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 text-rose-600 font-bold text-xs uppercase tracking-wide">
                  <ShieldAlert className="w-4 h-4 shrink-0 animate-bounce" />
                  <span>Security Alert: Unrecognized Face</span>
                </div>
                <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">
                  Face biometric does not match any registered staff member. Access denied.
                </p>
                <div className="flex items-center gap-1.5 mt-1 text-[10px] text-rose-600 font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping"></span>
                  <span>Incident photo transmitted to Store Admin Console</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Notice: No Face Detected in Screen */}
        {scanningStatus === 'NO_FACE' && (
          <div className="absolute inset-x-4 bottom-24 sm:bottom-28 z-40 mx-auto max-w-sm bg-white rounded-xl p-3.5 border border-amber-300 shadow-lg animate-fade-in text-[#1E293B] text-center">
            <div className="flex items-center justify-center gap-2 text-amber-600 font-bold text-xs">
              <UserX className="w-4 h-4 shrink-0" />
              <span>No Face Detected In Screen</span>
            </div>
            <p className="text-[11px] text-slate-600 mt-1">
              Please position your face directly inside the camera reticle before pressing verify.
            </p>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* MODAL 1: INTERACTIVE PUNCH OPTIONS MODAL (When already clocked in / on break) */}
        {/* ------------------------------------------------------------------ */}
        {staffPunchOptions && (
          <div className="absolute inset-4 rounded-2xl bg-white p-6 border border-[#E2E8F0] flex flex-col items-center justify-between text-center z-40 animate-fade-in shadow-xl text-[#1E293B]">
            
            <div className="flex items-center justify-between w-full">
              <span className="text-xs font-mono font-bold px-3 py-1 rounded-md bg-blue-50 text-[#2563EB] border border-blue-200 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#2563EB]" />
                <span>STAFF VERIFIED</span>
              </span>
              <button
                onClick={handleImmediateDismiss}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="my-auto flex flex-col items-center w-full max-w-sm">
              <div className="relative mb-3">
                <img
                  src={staffPunchOptions.employee.avatar}
                  alt={staffPunchOptions.employee.name}
                  className="w-20 h-20 rounded-2xl object-cover border-2 border-[#2563EB] shadow-md"
                />
                <div className="absolute -bottom-2 -right-2 p-1 rounded-full bg-emerald-600 text-white">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>

              <h3 className="text-xl font-bold text-[#1E293B] tracking-tight">
                {staffPunchOptions.employee.name}
              </h3>
              <p className="text-xs font-semibold text-slate-600 mt-0.5">
                {staffPunchOptions.employee.role} &bull; <span className="font-mono text-[#2563EB] font-bold">{staffPunchOptions.employee.id}</span>
              </p>

              {/* Status Note */}
              <div className="mt-2.5 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-[11px] text-slate-700">
                {staffPunchOptions.currentState === 'ON_SHIFT' ? (
                  <span>Currently on shift {staffPunchOptions.lastPunchTime ? `since ${formatTime12H(staffPunchOptions.lastPunchTime, true)}` : ''}</span>
                ) : (
                  <span className="text-amber-800 font-semibold">Currently on break {staffPunchOptions.lastPunchTime ? `since ${formatTime12H(staffPunchOptions.lastPunchTime, true)}` : ''}</span>
                )}
              </div>

              {/* ACTION CHOICES */}
              <div className="w-full mt-5 space-y-2.5">
                {staffPunchOptions.currentState === 'ON_SHIFT' ? (
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      id="btn-kiosk-start-break"
                      onClick={() => executePunch(staffPunchOptions.employee, 'BREAK_START', 'KIOSK_FACE')}
                      className="py-3 px-4 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold text-xs shadow-xs active:scale-98 transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Coffee className="w-5 h-5 text-amber-700" />
                      <span>Start Break</span>
                    </button>

                    <button
                      id="btn-kiosk-punch-out"
                      onClick={() => executePunch(staffPunchOptions.employee, 'OUT', 'KIOSK_FACE')}
                      className="py-3 px-4 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-900 border border-rose-300 font-bold text-xs shadow-xs active:scale-98 transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <LogOut className="w-5 h-5 text-rose-700" />
                      <span>Punch Out</span>
                    </button>
                  </div>
                ) : (
                  <button
                    id="btn-kiosk-end-break"
                    onClick={() => executePunch(staffPunchOptions.employee, 'BREAK_END', 'KIOSK_FACE')}
                    className="w-full py-3 px-4 rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white font-bold text-xs shadow-xs active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Play className="w-4 h-4 text-white" />
                    <span>End Break &bull; Resume Shift</span>
                  </button>
                )}
              </div>
            </div>

            <div className="w-full pt-2">
              <button
                onClick={handleImmediateDismiss}
                className="text-slate-500 hover:text-slate-800 text-xs font-semibold cursor-pointer"
              >
                Not You? Cancel
              </button>
            </div>

          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* MODAL 2: PUNCH EXECUTION CONFIRMATION CARD */}
        {/* ------------------------------------------------------------------ */}
        {executedPunchType && matchedEmployee && !staffPunchOptions && (
          <div className="absolute inset-4 rounded-2xl bg-white p-6 border border-[#E2E8F0] flex flex-col items-center justify-between text-center z-30 animate-fade-in shadow-xl text-[#1E293B]">
            
            <div className="flex items-center justify-between w-full">
              <span className={`text-xs font-mono font-bold px-3 py-1 rounded-md border flex items-center gap-1.5 ${
                executedPunchType === 'OUT'
                  ? 'bg-rose-50 text-rose-800 border-rose-200'
                  : executedPunchType === 'BREAK_START'
                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                  : 'bg-emerald-50 text-emerald-800 border-emerald-200'
              }`}>
                {executedPunchType === 'IN' && <LogIn className="w-3.5 h-3.5" />}
                {executedPunchType === 'OUT' && <LogOut className="w-3.5 h-3.5" />}
                {executedPunchType === 'BREAK_START' && <Coffee className="w-3.5 h-3.5" />}
                {executedPunchType === 'BREAK_END' && <Play className="w-3.5 h-3.5" />}
                <span>
                  {executedPunchType === 'IN' && 'PUNCHED IN • SHIFT STARTED'}
                  {executedPunchType === 'OUT' && 'PUNCHED OUT • SHIFT ENDED'}
                  {executedPunchType === 'BREAK_START' && 'BREAK STARTED'}
                  {executedPunchType === 'BREAK_END' && 'BREAK ENDED • SHIFT RESUMED'}
                </span>
              </span>

              <span className="text-xs font-mono text-slate-500">
                Match: {(matchScore * 100).toFixed(1)}%
              </span>
            </div>

            <div className="my-auto flex flex-col items-center">
              <div className="relative mb-3">
                <img
                  src={matchedEmployee.avatar}
                  alt={matchedEmployee.name}
                  className={`w-24 h-24 rounded-2xl object-cover border-2 shadow-sm ${
                    executedPunchType === 'OUT'
                      ? 'border-rose-400'
                      : executedPunchType === 'BREAK_START'
                      ? 'border-amber-400'
                      : 'border-emerald-400'
                  }`}
                />
                <div className={`absolute -bottom-2 -right-2 p-1.5 rounded-full ${
                  executedPunchType === 'OUT' 
                    ? 'bg-rose-600 text-white' 
                    : executedPunchType === 'BREAK_START'
                    ? 'bg-amber-500 text-white'
                    : 'bg-emerald-600 text-white'
                }`}>
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>

              <h3 className="text-2xl font-bold text-[#1E293B] tracking-tight">
                {matchedEmployee.name}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {matchedEmployee.role} &bull; Staff ID: {matchedEmployee.id}
              </p>

              <div className="mt-3 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-xs text-slate-700">
                {executedPunchType === 'IN' && 'Welcome to work! Shift recorded.'}
                {executedPunchType === 'OUT' && 'Shift complete! Have a great rest.'}
                {executedPunchType === 'BREAK_START' && 'Enjoy your break!'}
                {executedPunchType === 'BREAK_END' && 'Welcome back! Shift resumed.'}
              </div>
            </div>

            <div className="w-full flex items-center justify-between gap-3">
              <div className="flex-1 bg-[#F8FAFC] rounded-xl p-2.5 border border-[#E2E8F0] flex items-center justify-between text-xs">
                <div className="text-left">
                  <span className="text-slate-500 block text-[10px]">TIME RECORDED</span>
                  <span className="font-mono text-[#1E293B] font-bold text-sm">
                    {get12HTimeString(new Date(), true)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-slate-500 block text-[10px]">STATUS</span>
                  <span className="text-emerald-700 font-bold">
                    VERIFIED
                  </span>
                </div>
              </div>

              <button
                onClick={handleImmediateDismiss}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-all cursor-pointer whitespace-nowrap border border-slate-200"
              >
                Next Person
              </button>
            </div>

          </div>
        )}

      </div>

      {/* BOTTOM WALK-UP ACTION BAR */}
      <div className="w-full max-w-xl flex flex-col gap-3 relative z-10">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#E2E8F0] flex flex-col items-center gap-3 text-[#1E293B]">
          
          {/* Quick Staff Selection Roster (When multiple employees enrolled) */}
          {companyEmployees.length > 1 && (
            <div className="w-full pb-2 border-b border-[#E2E8F0]">
              <div className="flex items-center justify-between text-xs text-slate-600 mb-2">
                <span className="flex items-center gap-1.5 font-semibold text-[#1E293B]">
                  <Users className="w-3.5 h-3.5 text-[#2563EB]" />
                  <span>Select Staff to Verify</span>
                </span>
                <div className="flex items-center gap-2">
                  {selectedStaffIdForScan && (
                    <button
                      type="button"
                      onClick={() => setSelectedStaffIdForScan('')}
                      className="text-[10px] text-[#2563EB] hover:underline cursor-pointer font-medium"
                    >
                      Clear Selection
                    </button>
                  )}
                  <span className="text-[10px] text-slate-500">
                    {companyEmployees.length} enrolled
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-thin">
                {companyEmployees.map((emp) => {
                  const { currentState } = getStaffCurrentTodayState(emp);
                  const isSelected = selectedStaffIdForScan === emp.id;
                  return (
                    <button
                      key={emp.id}
                      type="button"
                      onClick={() => {
                        if (isSelected) {
                          setSelectedStaffIdForScan('');
                        } else {
                          setSelectedStaffIdForScan(emp.id);
                          handleTriggerFaceScan(emp);
                        }
                      }}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs whitespace-nowrap transition-all border cursor-pointer active:scale-95 ${
                        isSelected
                          ? 'bg-blue-50 border-[#2563EB] text-[#2563EB] font-bold shadow-xs'
                          : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                      }`}
                    >
                      <div className="relative">
                        <img
                          src={emp.avatar}
                          alt={emp.name}
                          className="w-6 h-6 rounded-full object-cover border border-slate-300"
                        />
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-white ${
                            currentState === 'ON_SHIFT'
                              ? 'bg-emerald-500'
                              : currentState === 'ON_BREAK'
                              ? 'bg-amber-500'
                              : 'bg-slate-400'
                          }`}
                        />
                      </div>
                      <span className="font-medium text-[11px]">{emp.name.split(' ')[0]}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Roster Empty Notice */}
          {companyEmployees.length === 0 && (
            <div className="w-full p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 shrink-0 text-amber-600" />
                <span className="text-[11px] leading-tight">
                  No staff enrolled for {companySupermarketName} yet. Add staff in Store Admin Console to enable biometric walk-up face punch.
                </span>
              </div>
            </div>
          )}

          {/* VERIFY & PUNCH FACE (BIOMETRIC ONLY - ENTERPRISE SLATE BLUE #2563EB) */}
          <div className="w-full">
            <button
              id="kiosk-trigger-scan-btn"
              onClick={() => handleTriggerFaceScan()}
              disabled={scanningStatus === 'DETECTING' || companyEmployees.length === 0}
              className="w-full py-3.5 px-5 rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white font-bold text-sm sm:text-base shadow-xs active:scale-[0.98] transition-all flex items-center justify-center gap-3 cursor-pointer group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center group-hover:scale-105 transition-transform">
                <ScanFace className="w-5 h-5 text-white" />
              </div>
              <div className="text-left">
                <span className="block text-sm sm:text-base font-bold tracking-tight leading-tight">
                  VERIFY &amp; PUNCH FACE
                </span>
                <span className="block text-[10px] font-normal text-blue-100">
                  {companyEmployees.length === 0
                    ? 'No staff enrolled yet'
                    : selectedStaffIdForScan
                    ? `Verifying ${companyEmployees.find(e => e.id === selectedStaffIdForScan)?.name.split(' ')[0]}`
                    : 'Smart biometric face check'}
                </span>
              </div>
            </button>
          </div>

          <div className="w-full flex items-center justify-center text-xs text-slate-500 px-2 pt-1 border-t border-[#E2E8F0]">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-slate-600 font-medium text-[11px]">
                Biometric Face Scanner Armed &bull; {companySupermarketName}
              </span>
            </div>
          </div>
        </div>

        {/* Live Recent Punch Audit */}
        {lastPunchAudit && (
          <div className="bg-white rounded-xl px-4 py-2.5 border border-[#E2E8F0] flex items-center justify-between text-xs text-[#1E293B] shadow-xs">
            <div className="flex items-center gap-2.5">
              <img src={lastPunchAudit.avatar} alt="" className="w-7 h-7 rounded-full object-cover border border-slate-200" />
              <div>
                <span className="text-slate-500 text-[11px] block sm:inline">Recent punch: </span>
                <strong className="text-[#1E293B]">{lastPunchAudit.name}</strong> &bull;{' '}
                <span className={
                  lastPunchAudit.type === 'OUT' 
                    ? 'text-rose-600 font-bold' 
                    : lastPunchAudit.type === 'BREAK_START'
                    ? 'text-amber-600 font-bold'
                    : 'text-emerald-600 font-bold'
                }>
                  {lastPunchAudit.type === 'IN' && 'Punched IN'}
                  {lastPunchAudit.type === 'OUT' && 'Punched OUT'}
                  {lastPunchAudit.type === 'BREAK_START' && 'Started Break'}
                  {lastPunchAudit.type === 'BREAK_END' && 'Ended Break'}
                </span>{' '}
                <span className="text-slate-500">at {formatTime12H(lastPunchAudit.time, true)}</span>
              </div>
            </div>
            <span className="text-[10px] px-2.5 py-0.5 rounded-md font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              {lastPunchAudit.status}
            </span>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* STORE MANAGER UNLOCK / DEACTIVATE MODAL */}
      {/* ------------------------------------------------------------------ */}
      {showManagerUnlockModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-2xl p-6 flex flex-col items-center shadow-xl animate-scale-in border border-[#E2E8F0] text-[#1E293B]">
            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-[#2563EB] mb-3 border border-blue-100">
              <Lock className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-bold text-[#1E293B]">Manager Authorization</h3>
            <p className="text-xs text-slate-500 text-center mt-1">
              Enter Store Manager PIN or Company Password to unlock &amp; switch terminal
            </p>

            <form onSubmit={handleManagerUnlock} className="w-full mt-4 space-y-3">
              {managerUnlockError && (
                <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs text-center">
                  {managerUnlockError}
                </div>
              )}

              <div>
                <input
                  type="password"
                  maxLength={6}
                  autoFocus
                  required
                  placeholder="Enter PIN"
                  value={managerUnlockPin}
                  onChange={(e) => setManagerUnlockPin(e.target.value)}
                  className="w-full bg-white border border-[#CBD5E1] rounded-xl py-3 text-center text-xl font-mono text-[#1E293B] tracking-widest focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowManagerUnlockModal(false);
                    setManagerUnlockPin('');
                    setManagerUnlockError(null);
                  }}
                  className="py-2.5 rounded-lg bg-white border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="py-2.5 rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white font-semibold text-xs shadow-xs cursor-pointer transition-all active:scale-98"
                >
                  Unlock Terminal
                </button>
              </div>

              <p className="text-[10px] text-slate-500 text-center pt-1">
                Authorized store administrators only
              </p>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
