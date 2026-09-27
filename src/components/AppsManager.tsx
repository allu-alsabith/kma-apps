import React, { useState, useMemo, useEffect } from 'react';
import { 
  Building2, 
  Store, 
  Layers, 
  ShieldCheck, 
  Smartphone, 
  ScanFace, 
  Plus, 
  Edit2, 
  Trash2, 
  KeyRound, 
  Lock, 
  Eye, 
  EyeOff, 
  Copy, 
  Check, 
  ExternalLink, 
  QrCode, 
  Download, 
  AlertTriangle, 
  Search, 
  X, 
  CheckCircle2, 
  SlidersHorizontal,
  ChevronRight,
  Info,
  LogOut,
  Sparkles,
  RefreshCw,
  Share2,
  Columns,
  LifeBuoy,
  Phone,
  Mail,
  User,
  Database,
  Cloud,
  Server
} from 'lucide-react';
import QRCode from 'qrcode';
import { Company, Employee, AttendanceRecord, AppPortal, HelpRequest, Shift, LeaveRequest, StaffNotification } from '../types';
import { soundService } from '../services/sound';
import { AppInstallTarget } from './InstallModal';
import { signInWithGoogle, signOutUser, subscribeToAuth, syncAllDataToFirestore, type User as FirebaseUser } from '../services/firebase';
import firebaseConfigData from '../../firebase-applet-config.json';

interface AppsManagerProps {
  companies: Company[];
  activeCompany?: Company;
  onSelectCompany?: (companyId: string) => void;
  onCreateCompany?: (companyData: Omit<Company, 'id' | 'createdAt'>) => Promise<Company | void> | void;
  onUpdateCompany?: (company: Company) => void;
  onDeleteCompany?: (companyId: string) => void;
  employees: Employee[];
  attendanceLogs: AttendanceRecord[];
  shifts?: Shift[];
  leaveRequests?: LeaveRequest[];
  notifications?: StaffNotification[];
  isStandalone?: boolean;
  onLaunchPortal?: (portal: AppPortal) => void;
  onOpenInstallModal?: (target?: AppInstallTarget) => void;
  isFirebaseConnected?: boolean;
  helpRequests?: HelpRequest[];
  onUpdateHelpRequestStatus?: (id: string, status: HelpRequest['status']) => void;
  onDeleteHelpRequest?: (id: string) => void;
}

export const AppsManager: React.FC<AppsManagerProps> = ({
  companies = [],
  activeCompany,
  onSelectCompany,
  onCreateCompany,
  onUpdateCompany,
  onDeleteCompany,
  employees = [],
  attendanceLogs = [],
  shifts = [],
  leaveRequests = [],
  notifications = [],
  isStandalone = false,
  onLaunchPortal,
  onOpenInstallModal,
  isFirebaseConnected = true,
  helpRequests = [],
  onUpdateHelpRequestStatus,
  onDeleteHelpRequest,
}) => {
  // Master Apps Manager selected company for preview and app provisioning
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(() => {
    return activeCompany?.id || companies[0]?.id || 'comp-kma';
  });

  useEffect(() => {
    if (activeCompany?.id) {
      setSelectedCompanyId(activeCompany.id);
    }
  }, [activeCompany?.id]);

  // Active Management Tab
  const [managerTab, setManagerTab] = useState<'COMPANIES' | 'APPS' | 'DEPLOYMENT' | 'SUPPORT_REQUESTS' | 'DATABASE'>('COMPANIES');
  const [searchCompanyQuery, setSearchCompanyQuery] = useState<string>('');

  // Firebase Google Auth State
  const [googleUser, setGoogleUser] = useState<FirebaseUser | null>(null);
  const [isSigningInGoogle, setIsSigningInGoogle] = useState<boolean>(false);
  const [isSyncingAllData, setIsSyncingAllData] = useState<boolean>(false);
  const [bulkSyncResult, setBulkSyncResult] = useState<{ success: boolean; counts: Record<string, number> } | null>(null);

  useEffect(() => {
    const unsub = subscribeToAuth((user) => {
      setGoogleUser(user);
    });
    return () => unsub();
  }, []);

  const handleGoogleSignIn = async () => {
    setIsSigningInGoogle(true);
    try {
      const user = await signInWithGoogle();
      if (user) {
        soundService.playSuccessChime();
      }
    } catch (err: unknown) {
      console.warn('Google sign-in error:', err);
      soundService.playWarningTone();
    } finally {
      setIsSigningInGoogle(false);
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

  const handleTriggerBulkSync = async () => {
    setIsSyncingAllData(true);
    setBulkSyncResult(null);
    try {
      const res = await syncAllDataToFirestore({
        companies,
        employees,
        attendanceLogs,
        shifts,
        leaveRequests,
        notifications,
        helpRequests,
      });
      setBulkSyncResult({ success: res.success, counts: res.syncedCounts });
      soundService.playSuccessChime();
    } catch {
      soundService.playWarningTone();
    } finally {
      setIsSyncingAllData(false);
    }
  };

  // Support Requests Filter State
  const [supportFilterApp, setSupportFilterApp] = useState<string>('ALL');
  const [supportFilterStatus, setSupportFilterStatus] = useState<string>('ALL');
  const [supportSearchQuery, setSupportSearchQuery] = useState<string>('');

  // Modals for Create / Edit / Delete Company
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [companyToEdit, setCompanyToEdit] = useState<Company | null>(null);
  const [companyToDelete, setCompanyToDelete] = useState<Company | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Form Fields
  const [formLegalName, setFormLegalName] = useState<string>('');
  const [formSupermarketName, setFormSupermarketName] = useState<string>('');
  const [formCode, setFormCode] = useState<string>('');
  const [formPassword, setFormPassword] = useState<string>('');
  const [formAdminPin, setFormAdminPin] = useState<string>('1234');
  const [formAddress, setFormAddress] = useState<string>('');
  const [formEmail, setFormEmail] = useState<string>('');
  const [formPhone, setFormPhone] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Revealed passwords map
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // QR Code Generation Modal
  const [qrModalApp, setQrModalApp] = useState<{ name: string; url: string; target: string } | null>(null);
  const [generatedQrDataUrl, setGeneratedQrDataUrl] = useState<string>('');

  // Per-company App Access Toggles (Stored in localStorage for persistence)
  const [appToggles, setAppToggles] = useState<{
    allowMobileGeoPunch: boolean;
    allowStaffLeaves: boolean;
    staffShiftAlerts: boolean;
    kioskStrictBiometrics: boolean;
    kioskAudioFeedback: boolean;
    kioskBackupPin: boolean;
    adminPayrollEnabled: boolean;
    adminLiveSplitEnabled: boolean;
  }>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('attendo_app_access_toggles');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          // ignore
        }
      }
    }
    return {
      allowMobileGeoPunch: true,
      allowStaffLeaves: true,
      staffShiftAlerts: true,
      kioskStrictBiometrics: true,
      kioskAudioFeedback: true,
      kioskBackupPin: true,
      adminPayrollEnabled: true,
      adminLiveSplitEnabled: true,
    };
  });

  const updateAppToggle = (key: keyof typeof appToggles, value: boolean) => {
    setAppToggles((prev) => {
      const updated = { ...prev, [key]: value };
      if (typeof window !== 'undefined') {
        localStorage.setItem('attendo_app_access_toggles', JSON.stringify(updated));
      }
      return updated;
    });
    soundService.playSuccessChime();
  };

  const togglePasswordReveal = (id: string) => {
    setRevealedPasswords((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCopyText = async (text: string, keyName: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(keyName);
      soundService.playSuccessChime();
      setTimeout(() => setCopiedKey(null), 2500);
    } catch {
      // ignore
    }
  };

  // Find the selected supermarket company
  const selectedCompany = useMemo(() => {
    return companies.find((c) => c.id === selectedCompanyId) || activeCompany || companies[0];
  }, [selectedCompanyId, companies, activeCompany]);

  // Alias for compatibility with sub-components and app launchers
  const authenticatedCompany = selectedCompany;

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setFormLegalName('');
    setFormSupermarketName('');
    setFormCode('');
    setFormPassword('');
    setFormAdminPin('1234');
    setFormAddress('');
    setFormEmail('');
    setFormPhone('');
    setFormError(null);
    setShowCreateModal(true);
  };

  // Submit Create Company
  const handleCreateCompanySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const legName = formLegalName.trim();
    const supName = formSupermarketName.trim();
    const code = formCode.trim().toUpperCase();
    const pass = formPassword.trim();

    if (!legName || !supName || !code || !pass) {
      setFormError('Legal name, supermarket brand name, company code, and company password are required.');
      soundService.playWarningTone();
      return;
    }

    if (companies.some((c) => c.code.toUpperCase() === code)) {
      setFormError(`Company code "${code}" already exists. Please choose a distinct code.`);
      soundService.playWarningTone();
      return;
    }

    if (onCreateCompany) {
      const created = await onCreateCompany({
        name: legName,
        supermarketName: supName,
        code: code,
        password: pass,
        adminPin: formAdminPin.trim() || '1234',
        address: formAddress.trim() || `${supName} Supermarket Main Store`,
        contactEmail: formEmail.trim() || `admin@${code.toLowerCase()}.com`,
        contactPhone: formPhone.trim() || '+91 98765 00000',
        isActive: true,
      });
      if (created && created.id) {
        setSelectedCompanyId(created.id);
        if (onSelectCompany) {
          onSelectCompany(created.id);
        }
      }
    }

    soundService.playSuccessChime();
    setFormSuccess(`Company "${supName}" created successfully! Code: ${code} | Password: ${pass}. You can now sign into Store Admin, Kiosk, and Staff App.`);
    setTimeout(() => setFormSuccess(null), 8000);
    setShowCreateModal(false);
  };

  // Open Edit Modal
  const handleStartEdit = (comp: Company) => {
    setCompanyToEdit(comp);
    setFormLegalName(comp.name);
    setFormSupermarketName(comp.supermarketName);
    setFormCode(comp.code);
    setFormPassword(comp.password);
    setFormAdminPin(comp.adminPin || '1234');
    setFormAddress(comp.address || '');
    setFormEmail(comp.contactEmail || '');
    setFormPhone(comp.contactPhone || '');
    setFormError(null);
    setShowEditModal(true);
  };

  // Submit Edit Company
  const handleEditCompanySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyToEdit || !onUpdateCompany) return;

    const legName = formLegalName.trim();
    const supName = formSupermarketName.trim();
    const code = formCode.trim().toUpperCase();
    const pass = formPassword.trim();

    if (!legName || !supName || !code || !pass) {
      setFormError('Legal name, supermarket brand name, company code, and company password are required.');
      soundService.playWarningTone();
      return;
    }

    const updated: Company = {
      ...companyToEdit,
      name: legName,
      supermarketName: supName,
      code: code,
      password: pass,
      adminPin: formAdminPin.trim() || '1234',
      address: formAddress.trim() || companyToEdit.address,
      contactEmail: formEmail.trim() || companyToEdit.contactEmail,
      contactPhone: formPhone.trim() || companyToEdit.contactPhone,
    };

    onUpdateCompany(updated);
    soundService.playSuccessChime();
    setFormSuccess(`Updated "${supName}" company settings.`);
    setTimeout(() => setFormSuccess(null), 5000);
    setShowEditModal(false);
  };

  // Delete Company
  const handleConfirmDelete = async () => {
    if (!companyToDelete || !onDeleteCompany) return;
    setIsDeleting(true);
    await onDeleteCompany(companyToDelete.id);
    setIsDeleting(false);
    setCompanyToDelete(null);
    soundService.playSuccessChime();
    setFormSuccess('Company removed successfully.');
    setTimeout(() => setFormSuccess(null), 4000);
  };

  // Helper count of employees per company
  const getStaffCount = (compId: string) => {
    return employees.filter((e) => (e.companyId || compId) === compId).length;
  };

  // Helper count of logs per company
  const getLogsCount = (compId: string) => {
    const empIds = new Set(employees.filter((e) => (e.companyId || compId) === compId).map((e) => e.id));
    return attendanceLogs.filter((l) => l.companyId === compId || empIds.has(l.employeeId)).length;
  };

  // Filtered companies
  const filteredCompanies = useMemo(() => {
    if (!searchCompanyQuery.trim()) return companies;
    const q = searchCompanyQuery.toLowerCase();
    return companies.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.supermarketName.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        (c.address && c.address.toLowerCase().includes(q))
    );
  }, [companies, searchCompanyQuery]);

  // Compute App URLs
  const getBaseOrigin = () => {
    if (typeof window !== 'undefined') {
      return window.location.origin + window.location.pathname;
    }
    return 'https://kma.supermarket';
  };

  const getAppLaunchUrl = (portalSlug: 'admin' | 'kiosk' | 'staff' | 'manager', companyCode?: string) => {
    const base = getBaseOrigin();
    const url = new URL(base);
    url.searchParams.set('app', portalSlug);
    if (companyCode && portalSlug !== 'manager') {
      url.searchParams.set('company', companyCode);
    }
    return url.toString();
  };

  // Generate QR Code for an App
  const openQrModalForApp = (name: string, portalSlug: 'admin' | 'kiosk' | 'staff') => {
    const compCode = authenticatedCompany?.code || activeCompany?.code || '';
    const appUrl = getAppLaunchUrl(portalSlug, compCode);
    setQrModalApp({ name, url: appUrl, target: portalSlug });

    QRCode.toDataURL(
      appUrl,
      {
        width: 320,
        margin: 2,
        color: {
          dark: '#05070D',
          light: '#FFFFFF',
        },
      },
      (err, dataUrl) => {
        if (!err && dataUrl) {
          setGeneratedQrDataUrl(dataUrl);
        }
      }
    );
  };

  // Filtered Help Requests for Apps Manager Support Tab
  const filteredHelpRequests = useMemo(() => {
    return (helpRequests || []).filter((req) => {
      if (supportFilterApp !== 'ALL' && req.appName !== supportFilterApp) {
        return false;
      }
      if (supportFilterStatus !== 'ALL' && req.status !== supportFilterStatus) {
        return false;
      }
      if (supportSearchQuery.trim()) {
        const q = supportSearchQuery.toLowerCase();
        const matchName = req.contactName?.toLowerCase().includes(q);
        const matchPhone = req.contactPhone?.toLowerCase().includes(q);
        const matchMsg = req.message?.toLowerCase().includes(q);
        const matchComp = req.companyName?.toLowerCase().includes(q) || req.companyCode?.toLowerCase().includes(q);
        const matchApp = req.appName?.toLowerCase().includes(q);
        return matchName || matchPhone || matchMsg || matchComp || matchApp;
      }
      return true;
    });
  }, [helpRequests, supportFilterApp, supportFilterStatus, supportSearchQuery]);

  // ==========================================
  // APPS MANAGER DASHBOARD (MASTER HUB)
  // ==========================================
  return (
    <div className="w-full max-w-7xl mx-auto p-4 md:p-6 space-y-6 select-none">
      
      {/* Discreet Standalone Bar if launched with ?app=manager */}
      {isStandalone && (
        <div className="w-full px-2 py-1 flex items-center justify-between text-xs text-slate-400 border-b border-white/10 pb-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
            <span className="font-semibold text-slate-300">
              Apps Manager Standalone &bull; {selectedCompany?.supermarketName || 'Master'} Console
            </span>
          </div>
        </div>
      )}

      {/* TOP COMMAND HEADER */}
      <div className="liquid-glass rounded-3xl p-5 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 shadow-2xl">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono text-amber-400 font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5" /> Apps Manager &bull; Master Control Hub
            </span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
              {isFirebaseConnected ? 'CLOUD CONNECTED' : 'LOCAL STORE'}
            </span>

            {/* Google Firebase Auth */}
            {googleUser ? (
              <div className="flex items-center gap-1.5 bg-blue-500/15 border border-blue-500/30 rounded-xl px-2.5 py-1 text-[11px] text-blue-200">
                {googleUser.photoURL ? (
                  <img src={googleUser.photoURL} alt="" className="w-4 h-4 rounded-full object-cover" />
                ) : (
                  <div className="w-4 h-4 rounded-full bg-blue-500 text-[9px] text-white flex items-center justify-center font-bold">G</div>
                )}
                <span className="font-semibold max-w-[110px] truncate">{googleUser.displayName || googleUser.email}</span>
                <button
                  type="button"
                  onClick={handleGoogleSignOut}
                  className="text-blue-300 hover:text-white text-[10px] underline ml-1 cursor-pointer"
                  title="Sign out of Google"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isSigningInGoogle}
                className="px-2.5 py-1 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-[11px] flex items-center gap-1.5 cursor-pointer border border-white/15 transition-all"
                title="Sign in with Google using Firebase Auth"
              >
                <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>{isSigningInGoogle ? 'Connecting...' : 'Google Sign In'}</span>
              </button>
            )}
            
            {/* Active Company Selector */}
            <div className="flex items-center gap-1.5 bg-black/50 border border-white/15 rounded-xl px-2.5 py-1">
              <Building2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="text-[10px] text-slate-400">Selected Store:</span>
              <select
                id="select-manager-active-company"
                value={selectedCompany?.id || ''}
                onChange={(e) => {
                  setSelectedCompanyId(e.target.value);
                  if (onSelectCompany) onSelectCompany(e.target.value);
                }}
                className="bg-transparent border-none text-[11px] text-amber-300 font-bold outline-none cursor-pointer hover:text-amber-200"
              >
                {companies.map((c) => (
                  <option key={c.id} value={c.id} className="bg-slate-900 text-white font-medium">
                    {c.supermarketName} ({c.code})
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => {
                if (authenticatedCompany) onSelectCompany(authenticatedCompany.id);
                if (onLaunchPortal) onLaunchPortal('ADMIN_PORTAL');
              }}
              className="px-2.5 py-1 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 font-semibold text-[11px] flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
              title="Open Store Admin Console"
            >
              <Store className="w-3.5 h-3.5" />
              <span>Launch Store Admin</span>
            </button>
          </div>

          <h1 className="text-2xl font-extrabold text-white tracking-tight mt-1">
            Supermarket Companies & Application Access Control
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Provision new supermarket companies, manage company credentials, and configure access for the connected workforce apps.
          </p>
        </div>

        {/* Section Tabs */}
        <div className="flex items-center gap-1 p-1 bg-black/40 rounded-2xl border border-white/10 overflow-x-auto w-full lg:w-auto">
          {[
            { id: 'COMPANIES', label: `Companies (${companies.length})`, icon: Building2 },
            { id: 'APPS', label: '3 Apps & Access', icon: Layers },
            { id: 'DEPLOYMENT', label: 'Fast Store Setup', icon: Download },
            { 
              id: 'SUPPORT_REQUESTS', 
              label: `Requests (${(helpRequests || []).filter((r) => r.status === 'PENDING').length})`, 
              icon: LifeBuoy,
              badgeCount: (helpRequests || []).filter((r) => r.status === 'PENDING').length
            },
            { id: 'DATABASE', label: 'Firebase Cloud DB', icon: Database },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                id={`btn-manager-tab-${tab.id.toLowerCase()}`}
                onClick={() => setManagerTab(tab.id as typeof managerTab)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                  managerTab === tab.id
                    ? 'bg-gradient-to-b from-white/25 to-white/5 text-white shadow-lg border border-white/20'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${tab.id === 'SUPPORT_REQUESTS' ? 'text-rose-400' : 'text-amber-400'}`} />
                <span>{tab.label}</span>
                {tab.badgeCount !== undefined && tab.badgeCount > 0 && (
                  <span className="ml-0.5 px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-mono font-bold animate-pulse">
                    {tab.badgeCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Global Feedback Banner */}
      {formSuccess && (
        <div className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 text-xs flex items-center gap-2.5 animate-scale-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="font-semibold">{formSuccess}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: COMPANIES MANAGEMENT                                               */}
      {/* ========================================================================= */}
      {managerTab === 'COMPANIES' && (
        <div className="space-y-6 animate-scale-in">
          {/* Top Actions & Search Bar */}
          <div className="liquid-glass rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search companies by name or code..."
                value={searchCompanyQuery}
                onChange={(e) => setSearchCompanyQuery(e.target.value)}
                className="w-full bg-slate-900/80 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-amber-400"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                id="btn-create-company-apps-manager"
                onClick={handleOpenCreateModal}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-emerald-500 hover:from-amber-400 hover:to-emerald-400 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>+ Create New Company</span>
              </button>
            </div>
          </div>

          {/* Companies Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredCompanies.map((company) => {
              const staffCount = getStaffCount(company.id);
              const logsCount = getLogsCount(company.id);
              const isCurrentActive = (activeCompany?.id || companies[0]?.id) === company.id;
              const isPwRevealed = !!revealedPasswords[company.id];

              return (
                <div
                  key={company.id}
                  className={`liquid-glass-card rounded-3xl p-5 border transition-all flex flex-col justify-between space-y-4 shadow-xl ${
                    isCurrentActive ? 'border-amber-400/40 ring-1 ring-amber-400/20 bg-slate-900/80' : 'border-white/10'
                  }`}
                >
                  {/* Card Header */}
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500/20 to-sky-500/20 border border-amber-400/30 flex items-center justify-center text-amber-300 font-black text-sm">
                          <Store className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-extrabold text-white text-base">
                              {company.supermarketName} Supermarket
                            </h3>
                          </div>
                          <span className="font-mono text-[11px] text-amber-300 px-1.5 py-0.2 rounded bg-amber-500/10 border border-amber-500/20 font-bold">
                            CODE: {company.code}
                          </span>
                        </div>
                      </div>

                      {isCurrentActive && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold text-[10px]">
                          ACTIVE STORE
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-300 font-medium">
                      {company.name}
                    </p>
                    {company.address && (
                      <p className="text-[11px] text-slate-400 flex items-center gap-1 truncate">
                        <span>{company.address}</span>
                      </p>
                    )}
                  </div>

                  {/* Company Credentials Box (Company Password & Code) */}
                  <div className="p-3 rounded-2xl bg-black/60 border border-white/10 space-y-2 text-xs">
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span className="font-semibold flex items-center gap-1">
                        <KeyRound className="w-3 h-3 text-amber-400" />
                        <span>Staff & Kiosk Password</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => togglePasswordReveal(company.id)}
                        className="text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer text-[10px]"
                      >
                        {isPwRevealed ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        <span>{isPwRevealed ? 'Hide' : 'Reveal'}</span>
                      </button>
                    </div>

                    <div className="flex items-center justify-between bg-slate-950 px-2.5 py-1.5 rounded-xl border border-white/10 font-mono">
                      <span className="text-amber-300 font-bold tracking-wider">
                        {isPwRevealed ? company.password : '••••••••'}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopyText(company.password, `pw-${company.id}`)}
                        className="p-1 text-slate-400 hover:text-white cursor-pointer"
                        title="Copy Company Password"
                      >
                        {copiedKey === `pw-${company.id}` ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>

                    {company.adminPin && (
                      <div className="flex items-center justify-between text-[11px] pt-1 border-t border-white/5">
                        <span className="text-slate-400">Admin Backup PIN:</span>
                        <span className="font-mono text-sky-300 font-bold">{company.adminPin}</span>
                      </div>
                    )}
                  </div>

                  {/* Operational Stats */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div className="p-2 rounded-xl bg-white/5 border border-white/5 text-center">
                      <span className="text-[10px] text-slate-400 block">Enrolled Staff</span>
                      <strong className="text-sm text-emerald-400 font-black">{staffCount}</strong>
                    </div>
                    <div className="p-2 rounded-xl bg-white/5 border border-white/5 text-center">
                      <span className="text-[10px] text-slate-400 block">Punch Logs</span>
                      <strong className="text-sm text-sky-400 font-black">{logsCount}</strong>
                    </div>
                  </div>

                  {/* Per-Company App Launch Buttons */}
                  <div className="pt-2 border-t border-white/10 space-y-1.5">
                    <div className="grid grid-cols-3 gap-1.5">
                      <button
                        onClick={() => {
                          if (onSelectCompany) onSelectCompany(company.id);
                          if (typeof window !== 'undefined') {
                            localStorage.setItem('attendo_active_company_id', company.id);
                            localStorage.setItem('attendo_admin_company_id', company.id);
                            localStorage.setItem('attendo_admin_session_auth', 'true');
                          }
                          if (onLaunchPortal) onLaunchPortal('ADMIN_PORTAL');
                          else window.location.href = getAppLaunchUrl('admin', company.code);
                        }}
                        className="py-1.5 px-2 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30 text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-all"
                        title={`Open Store Admin Console for ${company.supermarketName}`}
                      >
                        <ShieldCheck className="w-3 h-3 text-purple-400" />
                        <span>Admin</span>
                      </button>
                      <button
                        onClick={() => {
                          if (onSelectCompany) onSelectCompany(company.id);
                          if (typeof window !== 'undefined') {
                            localStorage.setItem('attendo_kiosk_company_id', company.id);
                            localStorage.setItem('attendo_active_company_id', company.id);
                            localStorage.setItem('attendo_kiosk_authenticated', 'true');
                          }
                          if (onLaunchPortal) onLaunchPortal('KIOSK_FACE');
                          else window.location.href = getAppLaunchUrl('kiosk', company.code);
                        }}
                        className="py-1.5 px-2 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-500/30 text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-all"
                        title={`Open Entrance Kiosk Scanner for ${company.supermarketName}`}
                      >
                        <ScanFace className="w-3 h-3 text-sky-400" />
                        <span>Kiosk</span>
                      </button>
                      <button
                        onClick={() => {
                          if (onSelectCompany) onSelectCompany(company.id);
                          if (typeof window !== 'undefined') {
                            localStorage.setItem('attendo_staff_company_id', company.id);
                            localStorage.setItem('attendo_staff_company_name', company.supermarketName);
                            localStorage.setItem('attendo_active_company_id', company.id);
                          }
                          if (onLaunchPortal) onLaunchPortal('EMPLOYEE_APP');
                          else window.location.href = getAppLaunchUrl('staff', company.code);
                        }}
                        className="py-1.5 px-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-all"
                        title={`Open Staff Mobile App for ${company.supermarketName}`}
                      >
                        <Smartphone className="w-3 h-3 text-amber-400" />
                        <span>Staff</span>
                      </button>
                    </div>

                    {staffCount === 0 && (
                      <div className="text-[10px] text-slate-400 text-center py-0.5">
                        Roster empty &bull; Add staff in Store Admin
                      </div>
                    )}
                  </div>

                  {/* Actions Bar */}
                  <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-2">
                    {!isCurrentActive ? (
                      <button
                        onClick={() => {
                          if (onSelectCompany) onSelectCompany(company.id);
                          soundService.playSuccessChime();
                        }}
                        className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 text-xs font-semibold cursor-pointer transition-all"
                      >
                        Set as Active Store
                      </button>
                    ) : (
                      <span className="text-[11px] text-emerald-400 font-bold flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Default Store
                      </span>
                    )}

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleStartEdit(company)}
                        className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white cursor-pointer transition-all"
                        title="Edit Company Details & Password"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setCompanyToDelete(company)}
                        className="p-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 cursor-pointer transition-all"
                        title="Delete Company"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: 3 APPS & ACCESS MANAGEMENT                                         */}
      {/* ========================================================================= */}
      {managerTab === 'APPS' && (
        <div className="space-y-6 animate-scale-in">
          <div className="p-4 rounded-2xl liquid-glass flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-amber-400" />
                <span>Connected Workforce Apps for {authenticatedCompany?.supermarketName || 'Store'} Supermarket</span>
              </h2>
              <p className="text-xs text-slate-400">
                Configure feature access, standalone deep-links, and QR codes for staff and hardware deployment.
              </p>
            </div>
            {onOpenInstallModal && (
              <button
                onClick={onOpenInstallModal}
                className="px-3 py-1.5 rounded-xl liquid-button text-xs text-emerald-300 hover:text-white flex items-center gap-1.5 font-bold cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Open Deployment Modal</span>
              </button>
            )}
          </div>

          {/* 3 Apps Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* APP 1: STORE ADMIN HR PORTAL */}
            <div className="liquid-glass-card rounded-3xl p-5 border border-white/15 space-y-4 shadow-xl flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold text-[10px]">
                    DESKTOP CONSOLE
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-extrabold text-white">Store Admin HR Portal</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Centralized management for staff enrollment, live floor presence, shifts, leaves, and payroll export.
                  </p>
                </div>

                <div className="p-3 rounded-2xl bg-black/50 border border-white/10 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Launch Slug:</span>
                    <span className="font-mono text-emerald-300 font-bold">?app=admin</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Target Device:</span>
                    <span className="text-slate-200">Store Manager PC / HR Laptop</span>
                  </div>
                </div>

                {/* Feature Toggles */}
                <div className="space-y-2 pt-2 border-t border-white/10 text-xs">
                  <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                    HR Permissions & Toggles
                  </span>
                  <label className="flex items-center justify-between p-2 rounded-xl bg-white/5 hover:bg-white/10 cursor-pointer">
                    <span className="text-slate-300 text-[11px]">Enable Payroll Wage Calculations</span>
                    <input
                      type="checkbox"
                      checked={appToggles.adminPayrollEnabled}
                      onChange={(e) => updateAppToggle('adminPayrollEnabled', e.target.checked)}
                      className="accent-emerald-500 w-4 h-4 cursor-pointer"
                    />
                  </label>
                  <label className="flex items-center justify-between p-2 rounded-xl bg-white/5 hover:bg-white/10 cursor-pointer">
                    <span className="text-slate-300 text-[11px]">Enable Live Split Screen View</span>
                    <input
                      type="checkbox"
                      checked={appToggles.adminLiveSplitEnabled}
                      onChange={(e) => updateAppToggle('adminLiveSplitEnabled', e.target.checked)}
                      className="accent-emerald-500 w-4 h-4 cursor-pointer"
                    />
                  </label>
                </div>
              </div>

              <div className="space-y-2 pt-3 border-t border-white/10">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      if (authenticatedCompany) onSelectCompany(authenticatedCompany.id);
                      if (onLaunchPortal) onLaunchPortal('ADMIN_PORTAL');
                      else window.location.href = getAppLaunchUrl('admin', authenticatedCompany?.code);
                    }}
                    className="py-2 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Launch Admin</span>
                  </button>
                  <button
                    onClick={() => openQrModalForApp('Store Admin HR Portal', 'admin')}
                    className="py-2 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <QrCode className="w-3.5 h-3.5 text-emerald-400" />
                    <span>QR Code</span>
                  </button>
                </div>
                {onOpenInstallModal && (
                  <button
                    onClick={() => onOpenInstallModal('ADMIN')}
                    className="w-full py-2 px-3 rounded-xl liquid-button bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer border border-emerald-500/30 transition-all"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Download App (APK / iOS)</span>
                  </button>
                )}
              </div>
            </div>

            {/* APP 2: BIOMETRIC TABLET KIOSK */}
            <div className="liquid-glass-card rounded-3xl p-5 border border-white/15 space-y-4 shadow-xl flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-sky-500/20 border border-sky-500/30 flex items-center justify-center text-sky-400">
                    <ScanFace className="w-6 h-6" />
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 font-bold text-[10px]">
                    ENTRANCE TERMINAL
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-extrabold text-white">Biometric Face Kiosk</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Entrance door tablet terminal with sub-second camera face scanning, audio chimes, and backup PIN clocking.
                  </p>
                </div>

                <div className="p-3 rounded-2xl bg-black/50 border border-white/10 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Launch Slug:</span>
                    <span className="font-mono text-sky-300 font-bold">?app=kiosk</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Target Device:</span>
                    <span className="text-slate-200">Android / iPad Tablet at Door</span>
                  </div>
                </div>

                {/* Feature Toggles */}
                <div className="space-y-2 pt-2 border-t border-white/10 text-xs">
                  <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                    Kiosk Terminal Settings
                  </span>
                  <label className="flex items-center justify-between p-2 rounded-xl bg-white/5 hover:bg-white/10 cursor-pointer">
                    <span className="text-slate-300 text-[11px]">Strict Biometric Face Threshold</span>
                    <input
                      type="checkbox"
                      checked={appToggles.kioskStrictBiometrics}
                      onChange={(e) => updateAppToggle('kioskStrictBiometrics', e.target.checked)}
                      className="accent-sky-500 w-4 h-4 cursor-pointer"
                    />
                  </label>
                  <label className="flex items-center justify-between p-2 rounded-xl bg-white/5 hover:bg-white/10 cursor-pointer">
                    <span className="text-slate-300 text-[11px]">Audio Confirmation Punch Tones</span>
                    <input
                      type="checkbox"
                      checked={appToggles.kioskAudioFeedback}
                      onChange={(e) => updateAppToggle('kioskAudioFeedback', e.target.checked)}
                      className="accent-sky-500 w-4 h-4 cursor-pointer"
                    />
                  </label>
                  <label className="flex items-center justify-between p-2 rounded-xl bg-white/5 hover:bg-white/10 cursor-pointer">
                    <span className="text-slate-300 text-[11px]">Allow Backup PIN Clock In</span>
                    <input
                      type="checkbox"
                      checked={appToggles.kioskBackupPin}
                      onChange={(e) => updateAppToggle('kioskBackupPin', e.target.checked)}
                      className="accent-sky-500 w-4 h-4 cursor-pointer"
                    />
                  </label>
                </div>
              </div>

              <div className="space-y-2 pt-3 border-t border-white/10">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      if (authenticatedCompany) onSelectCompany(authenticatedCompany.id);
                      if (onLaunchPortal) onLaunchPortal('KIOSK_FACE');
                      else window.location.href = getAppLaunchUrl('kiosk', authenticatedCompany?.code);
                    }}
                    className="py-2 px-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Launch Kiosk</span>
                  </button>
                  <button
                    onClick={() => openQrModalForApp('Biometric Face Kiosk', 'kiosk')}
                    className="py-2 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <QrCode className="w-3.5 h-3.5 text-sky-400" />
                    <span>QR Code</span>
                  </button>
                </div>
                {onOpenInstallModal && (
                  <button
                    onClick={() => onOpenInstallModal('KIOSK')}
                    className="w-full py-2 px-3 rounded-xl liquid-button bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer border border-sky-500/30 transition-all"
                  >
                    <Download className="w-3.5 h-3.5 text-sky-400" />
                    <span>Download Kiosk (APK / iOS)</span>
                  </button>
                )}
              </div>
            </div>

            {/* APP 3: STAFF MOBILE APP */}
            <div className="liquid-glass-card rounded-3xl p-5 border border-white/15 space-y-4 shadow-xl flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                    <Smartphone className="w-6 h-6" />
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold text-[10px]">
                    MOBILE STAFF
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-extrabold text-white">Staff Mobile App</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Personal phone app for cashiers, butchers, and floor staff with company login, shift view, and leave requests.
                  </p>
                </div>

                <div className="p-3 rounded-2xl bg-black/50 border border-white/10 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Launch Slug:</span>
                    <span className="font-mono text-amber-300 font-bold">?app=staff</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Target Device:</span>
                    <span className="text-slate-200">Staff Personal iPhone / Android</span>
                  </div>
                </div>

                {/* Feature Toggles */}
                <div className="space-y-2 pt-2 border-t border-white/10 text-xs">
                  <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                    Staff App Permissions
                  </span>
                  <label className="flex items-center justify-between p-2 rounded-xl bg-white/5 hover:bg-white/10 cursor-pointer">
                    <span className="text-slate-300 text-[11px]">Allow Mobile Geo-Punch (GPS)</span>
                    <input
                      type="checkbox"
                      checked={appToggles.allowMobileGeoPunch}
                      onChange={(e) => updateAppToggle('allowMobileGeoPunch', e.target.checked)}
                      className="accent-amber-500 w-4 h-4 cursor-pointer"
                    />
                  </label>
                  <label className="flex items-center justify-between p-2 rounded-xl bg-white/5 hover:bg-white/10 cursor-pointer">
                    <span className="text-slate-300 text-[11px]">Allow In-App Leave Requests</span>
                    <input
                      type="checkbox"
                      checked={appToggles.allowStaffLeaves}
                      onChange={(e) => updateAppToggle('allowStaffLeaves', e.target.checked)}
                      className="accent-amber-500 w-4 h-4 cursor-pointer"
                    />
                  </label>
                  <label className="flex items-center justify-between p-2 rounded-xl bg-white/5 hover:bg-white/10 cursor-pointer">
                    <span className="text-slate-300 text-[11px]">Shift Schedule Push Alerts</span>
                    <input
                      type="checkbox"
                      checked={appToggles.staffShiftAlerts}
                      onChange={(e) => updateAppToggle('staffShiftAlerts', e.target.checked)}
                      className="accent-amber-500 w-4 h-4 cursor-pointer"
                    />
                  </label>
                </div>
              </div>

              <div className="space-y-2 pt-3 border-t border-white/10">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      if (authenticatedCompany) onSelectCompany(authenticatedCompany.id);
                      if (onLaunchPortal) onLaunchPortal('EMPLOYEE_APP');
                      else window.location.href = getAppLaunchUrl('staff', authenticatedCompany?.code);
                    }}
                    className="py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Launch Staff</span>
                  </button>
                  <button
                    onClick={() => openQrModalForApp('Staff Mobile Attendance App', 'staff')}
                    className="py-2 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <QrCode className="w-3.5 h-3.5 text-amber-400" />
                    <span>QR Code</span>
                  </button>
                </div>
                {onOpenInstallModal && (
                  <button
                    onClick={() => onOpenInstallModal('STAFF')}
                    className="w-full py-2 px-3 rounded-xl liquid-button bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer border border-amber-500/30 transition-all"
                  >
                    <Download className="w-3.5 h-3.5 text-amber-400" />
                    <span>Download Staff App (APK / iOS)</span>
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: FAST STORE HARDWARE DEPLOYMENT                                      */}
      {/* ========================================================================= */}
      {managerTab === 'DEPLOYMENT' && (
        <div className="space-y-6 animate-scale-in">
          <div className="liquid-glass rounded-3xl p-6 border border-white/15 space-y-5 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Download className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-black text-white">
                  3-Step Fast Store Hardware Deployment
                </h2>
                <p className="text-xs text-slate-400">
                  Quick instructions and distribution packets to equip entrance tablets, manager PC, and employee phones.
                </p>
              </div>
            </div>

            {/* Checklist */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="w-7 h-7 rounded-xl bg-emerald-500 text-slate-950 font-black text-xs flex items-center justify-center">1</span>
                  <span className="text-[10px] text-slate-400 font-mono">STEP ONE</span>
                </div>
                <h4 className="font-bold text-white text-sm">Door Entrance Tablet</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Mount an Android / iPad tablet at Gate A. Open the Kiosk link (<code>?app=kiosk</code>), tap "Add to Home Screen" for fullscreen kiosk mode.
                </p>
                <button
                  onClick={() => openQrModalForApp('Door Kiosk Tablet', 'kiosk')}
                  className="w-full py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer"
                >
                  <QrCode className="w-3.5 h-3.5 text-sky-400" />
                  <span>Scan Tablet QR</span>
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="w-7 h-7 rounded-xl bg-sky-500 text-slate-950 font-black text-xs flex items-center justify-center">2</span>
                  <span className="text-[10px] text-slate-400 font-mono">STEP TWO</span>
                </div>
                <h4 className="font-bold text-white text-sm">HR Office Desktop</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Bookmark the Store Admin Console (<code>?app=admin</code>) on the store manager laptop. Staff attendance and leaves sync in real-time.
                </p>
                <button
                  onClick={() => {
                    const url = getAppLaunchUrl('admin', authenticatedCompany?.code);
                    handleCopyText(url, 'admin-url-copy');
                  }}
                  className="w-full py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer"
                >
                  {copiedKey === 'admin-url-copy' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey === 'admin-url-copy' ? 'Copied Link!' : 'Copy Admin Link'}</span>
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="w-7 h-7 rounded-xl bg-amber-500 text-slate-950 font-black text-xs flex items-center justify-center">3</span>
                  <span className="text-[10px] text-slate-400 font-mono">STEP THREE</span>
                </div>
                <h4 className="font-bold text-white text-sm">Staff Phone Distribution</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Send staff the Staff App link with Company Code <strong>{authenticatedCompany?.code || '—'}</strong> and the company password.
                </p>
                <button
                  onClick={() => {
                    const staffUrl = getAppLaunchUrl('staff', authenticatedCompany?.code);
                    const msg = `Welcome to ${authenticatedCompany?.supermarketName || 'Store'} Supermarket Workforce App!\n\n1. Open link: ${staffUrl}\n2. Company Code: ${authenticatedCompany?.code || ''}\n3. Company Password: ${authenticatedCompany?.password || ''}\n4. Enter your Staff ID & PIN to check shifts and attendance.`;
                    handleCopyText(msg, 'staff-broadcast-msg');
                  }}
                  className="w-full py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-bold flex items-center justify-center gap-1 cursor-pointer border border-amber-500/30"
                >
                  {copiedKey === 'staff-broadcast-msg' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
                  <span>{copiedKey === 'staff-broadcast-msg' ? 'Instructions Copied!' : 'Copy Staff Broadcast'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: APP REQUESTS & ACCOUNT HELP INBOX                                  */}
      {/* ========================================================================= */}
      {managerTab === 'SUPPORT_REQUESTS' && (
        <div className="space-y-6 animate-scale-in">
          {/* Top Banner & Quick Metrics */}
          <div className="liquid-glass rounded-3xl p-5 border border-white/10 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                  <LifeBuoy className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
                    <span>Incoming Help & Account Requests</span>
                    <span className="px-2 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/30 text-rose-300 text-[10px] font-bold">
                      {(helpRequests || []).length} Total
                    </span>
                  </h2>
                  <p className="text-xs text-slate-400">
                    Real-time support and login assistance tickets submitted from login screens across all apps.
                  </p>
                </div>
              </div>

              {/* Status Counters */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                  <span className="text-xs text-amber-300 font-bold">
                    {(helpRequests || []).filter((r) => r.status === 'PENDING').length} Pending
                  </span>
                </div>
                <div className="px-3 py-1.5 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-sky-400"></span>
                  <span className="text-xs text-sky-300 font-bold">
                    {(helpRequests || []).filter((r) => r.status === 'IN_REVIEW').length} In Review
                  </span>
                </div>
                <div className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  <span className="text-xs text-emerald-300 font-bold">
                    {(helpRequests || []).filter((r) => r.status === 'RESOLVED').length} Resolved
                  </span>
                </div>
              </div>
            </div>

            {/* Filter Controls Bar */}
            <div className="pt-3 border-t border-white/10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
              {/* App Filter Buttons */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] text-slate-400 font-medium mr-1">Filter App:</span>
                {[
                  { id: 'ALL', label: 'All Apps', icon: Layers },
                  { id: 'Admin Portal', label: 'Admin Portal', icon: ShieldCheck },
                  { id: 'Staff Mobile App', label: 'Staff Mobile App', icon: Smartphone },
                  { id: 'Entrance Face Kiosk', label: 'Face Kiosk', icon: ScanFace },
                ].map((appOpt) => {
                  const Icon = appOpt.icon;
                  const isSelected = supportFilterApp === appOpt.id;
                  const count =
                    appOpt.id === 'ALL'
                      ? (helpRequests || []).length
                      : (helpRequests || []).filter((r) => r.appName === appOpt.id).length;

                  return (
                    <button
                      key={appOpt.id}
                      onClick={() => setSupportFilterApp(appOpt.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-white/20 text-white border border-white/30 shadow'
                          : 'bg-black/30 text-slate-400 hover:text-white hover:bg-white/10 border border-white/5'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5 text-amber-400" />
                      <span>{appOpt.label}</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/10 text-slate-300 font-mono">
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Status Filter & Search */}
              <div className="flex items-center gap-2 w-full lg:w-auto">
                <select
                  value={supportFilterStatus}
                  onChange={(e) => setSupportFilterStatus(e.target.value)}
                  className="bg-slate-900 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-slate-300 outline-none focus:border-amber-400 cursor-pointer"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="PENDING">Pending Only</option>
                  <option value="IN_REVIEW">In Review</option>
                  <option value="RESOLVED">Resolved</option>
                </select>

                <div className="relative flex-1 lg:w-60">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search requests..."
                    value={supportSearchQuery}
                    onChange={(e) => setSupportSearchQuery(e.target.value)}
                    className="w-full bg-slate-900/80 border border-white/10 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-amber-400"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Help Requests Cards Grid / List */}
          {filteredHelpRequests.length === 0 ? (
            <div className="liquid-glass rounded-3xl p-10 text-center space-y-3 border border-white/10">
              <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 mx-auto">
                <LifeBuoy className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-white">No Help Requests Found</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                {supportSearchQuery || supportFilterApp !== 'ALL' || supportFilterStatus !== 'ALL'
                  ? 'No incoming tickets match your active filter criteria.'
                  : 'No support or account help requests have been submitted yet. When a staff member or admin clicks "Account Help" on any login screen (Admin, Staff App, or Face Kiosk), their request will appear here instantly.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredHelpRequests.map((req) => {
                const isKiosk = req.appName.includes('Kiosk') || req.appName.includes('Face');
                const isStaff = req.appName.includes('Staff') || req.appName.includes('Mobile');
                const isAdmin = req.appName.includes('Admin');

                const appBadgeColor = isStaff
                  ? 'bg-sky-500/20 text-sky-300 border-sky-500/30'
                  : isKiosk
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  : isAdmin
                  ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                  : 'bg-amber-500/20 text-amber-300 border-amber-500/30';

                const AppIcon = isStaff ? Smartphone : isKiosk ? ScanFace : isAdmin ? ShieldCheck : LifeBuoy;

                const statusColor =
                  req.status === 'PENDING'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                    : req.status === 'IN_REVIEW'
                    ? 'bg-sky-500/20 text-sky-300 border-sky-500/30'
                    : req.status === 'RESOLVED'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    : 'bg-slate-500/20 text-slate-300 border-slate-500/30';

                return (
                  <div
                    key={req.id}
                    className="liquid-glass-card rounded-3xl p-5 border border-white/10 hover:border-white/20 transition-all shadow-xl space-y-4 flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      {/* Card Header: App Name Badge + Status */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Prominent App Name Badge */}
                          <span
                            className={`px-3 py-1 rounded-xl text-xs font-bold border flex items-center gap-1.5 ${appBadgeColor}`}
                          >
                            <AppIcon className="w-3.5 h-3.5" />
                            <span>{req.appName}</span>
                          </span>

                          {req.companyName && (
                            <span className="px-2 py-0.5 rounded-lg bg-black/40 border border-white/10 text-slate-300 text-[11px] font-medium">
                              {req.companyName} {req.companyCode ? `(${req.companyCode})` : ''}
                            </span>
                          )}
                        </div>

                        {/* Status Tag */}
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${statusColor}`}>
                          {req.status.replace('_', ' ')}
                        </span>
                      </div>

                      {/* Requester Profile */}
                      <div className="flex items-center justify-between text-xs bg-slate-950/60 rounded-2xl p-3 border border-white/5">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 font-bold text-white text-sm">
                            <User className="w-3.5 h-3.5 text-amber-400" />
                            <span>{req.contactName || 'Anonymous User'}</span>
                          </div>
                          {req.employeeIdOrRole && (
                            <span className="text-[11px] text-slate-400 block font-mono">
                              Role/ID: {req.employeeIdOrRole}
                            </span>
                          )}
                        </div>

                        <div className="space-y-1 text-right">
                          {req.contactPhone && (
                            <a
                              href={`tel:${req.contactPhone}`}
                              className="text-emerald-400 hover:text-emerald-300 text-[11px] font-mono flex items-center justify-end gap-1"
                            >
                              <Phone className="w-3 h-3" />
                              <span>{req.contactPhone}</span>
                            </a>
                          )}
                          {req.contactEmail && (
                            <a
                              href={`mailto:${req.contactEmail}`}
                              className="text-sky-400 hover:text-sky-300 text-[11px] flex items-center justify-end gap-1"
                            >
                              <Mail className="w-3 h-3" />
                              <span>{req.contactEmail}</span>
                            </a>
                          )}
                        </div>
                      </div>

                      {/* Issue Category Pill */}
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase font-bold text-slate-400">Issue:</span>
                        <span className="px-2.5 py-0.5 rounded-lg bg-white/10 text-amber-300 font-semibold text-xs border border-white/10">
                          {req.issueType}
                        </span>
                      </div>

                      {/* User's Message */}
                      <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10 text-xs text-slate-200 leading-relaxed font-sans relative">
                        <p className="whitespace-pre-wrap">{req.message}</p>
                      </div>

                      {/* Timestamp */}
                      <div className="text-[11px] text-slate-500 flex items-center justify-between">
                        <span>Submitted on:</span>
                        <span className="font-mono text-slate-400">
                          {new Date(req.createdAt).toLocaleString(undefined, {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </span>
                      </div>
                    </div>

                    {/* Footer Actions: Status Transition Buttons */}
                    <div className="pt-3 border-t border-white/10 flex items-center justify-between gap-2">
                      <button
                        onClick={() => onDeleteHelpRequest && onDeleteHelpRequest(req.id)}
                        className="px-2.5 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-semibold flex items-center gap-1 border border-rose-500/20 cursor-pointer transition-all active:scale-95"
                        title="Delete ticket"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>

                      <div className="flex items-center gap-2">
                        {req.status === 'PENDING' && (
                          <button
                            onClick={() => onUpdateHelpRequestStatus && onUpdateHelpRequestStatus(req.id, 'IN_REVIEW')}
                            className="px-3 py-1.5 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 text-xs font-bold border border-sky-500/30 cursor-pointer transition-all active:scale-95"
                          >
                            Mark In Review
                          </button>
                        )}
                        {req.status !== 'RESOLVED' && (
                          <button
                            onClick={() => onUpdateHelpRequestStatus && onUpdateHelpRequestStatus(req.id, 'RESOLVED')}
                            className="px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-bold border border-emerald-500/30 flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Resolve</span>
                          </button>
                        )}
                        {req.status === 'RESOLVED' && (
                          <button
                            onClick={() => onUpdateHelpRequestStatus && onUpdateHelpRequestStatus(req.id, 'PENDING')}
                            className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 text-xs font-semibold cursor-pointer transition-all"
                          >
                            Re-open
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 5: FIREBASE FIRESTORE CLOUD DATABASE & PERSISTENCE               */}
      {/* ==================================================================== */}
      {managerTab === 'DATABASE' && (
        <div className="space-y-6 animate-fade-in">
          {/* Top Cloud Header */}
          <div className="liquid-glass rounded-3xl p-6 border border-emerald-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
                <Database className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-extrabold text-white">Firebase Firestore Cloud Database</h2>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold">
                    CONNECTED &bull; LIVE SYNC
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-1 max-w-2xl">
                  Every data entity in the application is persisted directly in Firebase Cloud Firestore with automatic real-time sync across all connected tablets, phones, and admin terminals.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              <button
                type="button"
                id="btn-sync-all-firebase-data"
                onClick={handleTriggerBulkSync}
                disabled={isSyncingAllData}
                className="w-full md:w-auto px-5 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black text-xs shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isSyncingAllData ? 'animate-spin' : ''}`} />
                <span>{isSyncingAllData ? 'Syncing Every Data to Firebase...' : 'Store Every Data to Cloud Now'}</span>
              </button>
            </div>
          </div>

          {/* Sync Result Toast Banner */}
          {bulkSyncResult && (
            <div className={`p-4 rounded-2xl border text-xs animate-scale-in flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
              bulkSyncResult.success 
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200' 
                : 'bg-rose-500/15 border-rose-500/40 text-rose-200'
            }`}>
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                  <strong className="font-bold text-white block">
                    {bulkSyncResult.success ? 'All Data Stored & Synchronized in Firebase!' : 'Partial Sync Warning'}
                  </strong>
                  <span className="text-[11px] text-slate-300">
                    Uploaded: {bulkSyncResult.counts.companies} Companies, {bulkSyncResult.counts.employees} Employees, {bulkSyncResult.counts.attendance} Punches, {bulkSyncResult.counts.shifts} Shifts, {bulkSyncResult.counts.leaves} Leaves, {bulkSyncResult.counts.notifications} Notifications, {bulkSyncResult.counts.helpRequests} Support Requests.
                  </span>
                </div>
              </div>
              <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-black/40 text-emerald-300 border border-emerald-500/30">
                CLOUD VERIFIED
              </span>
            </div>
          )}

          {/* Firestore Collections Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Companies */}
            <div className="liquid-glass-card rounded-2xl p-4 border border-white/10 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono text-amber-400 font-bold uppercase tracking-wider">/companies</span>
                  <Building2 className="w-4 h-4 text-amber-400" />
                </div>
                <h3 className="text-base font-bold text-white">Supermarket Companies</h3>
                <p className="text-[11px] text-slate-400 mt-1">Multi-tenant store accounts, codes, passwords & manager credentials</p>
              </div>
              <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between">
                <span className="text-xs text-slate-400">Total in Cloud:</span>
                <span className="text-sm font-mono font-bold text-emerald-400">{companies.length} records</span>
              </div>
            </div>

            {/* 2. Employees */}
            <div className="liquid-glass-card rounded-2xl p-4 border border-white/10 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono text-emerald-400 font-bold uppercase tracking-wider">/employees</span>
                  <User className="w-4 h-4 text-emerald-400" />
                </div>
                <h3 className="text-base font-bold text-white">Workforce Directory</h3>
                <p className="text-[11px] text-slate-400 mt-1">Real staff names, departments, shifts, wage rates & face biometric photos</p>
              </div>
              <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between">
                <span className="text-xs text-slate-400">Total in Cloud:</span>
                <span className="text-sm font-mono font-bold text-emerald-400">{employees.length} records</span>
              </div>
            </div>

            {/* 3. Attendance Records */}
            <div className="liquid-glass-card rounded-2xl p-4 border border-white/10 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono text-sky-400 font-bold uppercase tracking-wider">/attendanceRecords</span>
                  <ScanFace className="w-4 h-4 text-sky-400" />
                </div>
                <h3 className="text-base font-bold text-white">Attendance Logs</h3>
                <p className="text-[11px] text-slate-400 mt-1">Check-in, break, and check-out punches via Biometric FaceID & PIN pad</p>
              </div>
              <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between">
                <span className="text-xs text-slate-400">Total in Cloud:</span>
                <span className="text-sm font-mono font-bold text-emerald-400">{attendanceLogs.length} records</span>
              </div>
            </div>

            {/* 4. Shifts */}
            <div className="liquid-glass-card rounded-2xl p-4 border border-white/10 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono text-purple-400 font-bold uppercase tracking-wider">/shifts</span>
                  <Layers className="w-4 h-4 text-purple-400" />
                </div>
                <h3 className="text-base font-bold text-white">Shift Schedules</h3>
                <p className="text-[11px] text-slate-400 mt-1">Store shifts, start & end timings, grace periods & department mappings</p>
              </div>
              <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between">
                <span className="text-xs text-slate-400">Total in Cloud:</span>
                <span className="text-sm font-mono font-bold text-emerald-400">{(shifts || []).length || 3} records</span>
              </div>
            </div>

            {/* 5. Leaves */}
            <div className="liquid-glass-card rounded-2xl p-4 border border-white/10 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono text-rose-400 font-bold uppercase tracking-wider">/leaveRequests</span>
                  <ShieldCheck className="w-4 h-4 text-rose-400" />
                </div>
                <h3 className="text-base font-bold text-white">Leave Requests</h3>
                <p className="text-[11px] text-slate-400 mt-1">Staff time-off requests, supervisor approvals, and audit statuses</p>
              </div>
              <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between">
                <span className="text-xs text-slate-400">Total in Cloud:</span>
                <span className="text-sm font-mono font-bold text-emerald-400">{(leaveRequests || []).length} records</span>
              </div>
            </div>

            {/* 6. Staff Notifications */}
            <div className="liquid-glass-card rounded-2xl p-4 border border-white/10 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono text-amber-300 font-bold uppercase tracking-wider">/notifications</span>
                  <Sparkles className="w-4 h-4 text-amber-300" />
                </div>
                <h3 className="text-base font-bold text-white">Staff Alerts</h3>
                <p className="text-[11px] text-slate-400 mt-1">In-app notifications for roster changes, leave approvals & announcements</p>
              </div>
              <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between">
                <span className="text-xs text-slate-400">Total in Cloud:</span>
                <span className="text-sm font-mono font-bold text-emerald-400">{(notifications || []).length} records</span>
              </div>
            </div>

            {/* 7. Help Requests */}
            <div className="liquid-glass-card rounded-2xl p-4 border border-white/10 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono text-sky-300 font-bold uppercase tracking-wider">/helpRequests</span>
                  <LifeBuoy className="w-4 h-4 text-sky-300" />
                </div>
                <h3 className="text-base font-bold text-white">Support Tickets</h3>
                <p className="text-[11px] text-slate-400 mt-1">Account login help and support requests submitted from all 3 apps</p>
              </div>
              <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between">
                <span className="text-xs text-slate-400">Total in Cloud:</span>
                <span className="text-sm font-mono font-bold text-emerald-400">{(helpRequests || []).length} records</span>
              </div>
            </div>

            {/* 8. Google Authenticated Users */}
            <div className="liquid-glass-card rounded-2xl p-4 border border-white/10 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono text-blue-400 font-bold uppercase tracking-wider">/users</span>
                  <Server className="w-4 h-4 text-blue-400" />
                </div>
                <h3 className="text-base font-bold text-white">Firebase Auth Users</h3>
                <p className="text-[11px] text-slate-400 mt-1">Google Sign-in authenticated accounts with role and enterprise permissions</p>
              </div>
              <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between">
                <span className="text-xs text-slate-400">Status:</span>
                <span className="text-xs font-semibold text-blue-400">{googleUser ? '1 Active Session' : 'Ready'}</span>
              </div>
            </div>
          </div>

          {/* Cloud Configuration Details Card */}
          <div className="liquid-glass-card rounded-3xl p-5 border border-white/10 text-xs text-slate-300 space-y-3">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Cloud className="w-4 h-4 text-emerald-400" />
              <span>Firebase Cloud Firestore Instance Details</span>
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-3 rounded-2xl bg-black/40 border border-white/10">
                <span className="text-[10px] text-slate-400 uppercase font-mono block">Firestore Database ID</span>
                <span className="font-mono text-white font-bold text-xs truncate block mt-0.5">
                  {firebaseConfigData.firestoreDatabaseId || '(default)'}
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-black/40 border border-white/10">
                <span className="text-[10px] text-slate-400 uppercase font-mono block">Firebase Project ID</span>
                <span className="font-mono text-emerald-300 font-bold text-xs truncate block mt-0.5">
                  {firebaseConfigData.projectId}
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-black/40 border border-white/10">
                <span className="text-[10px] text-slate-400 uppercase font-mono block">Security Rules &amp; Sync</span>
                <span className="text-emerald-400 font-bold text-xs flex items-center gap-1.5 mt-0.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Deployed &bull; Multi-Tenant Isolated
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xl flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-lg liquid-glass-card rounded-[28px] border border-white/20 shadow-2xl animate-scale-in text-white my-6">
            <div className="p-5 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-amber-400" />
                <h3 className="text-lg font-bold">Create New Supermarket Company</h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCompanySubmit} className="p-5 space-y-4 text-xs">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 flex items-center gap-2 animate-shake">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span className="font-semibold">{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Supermarket Brand Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. Metro Mart"
                    value={formSupermarketName}
                    onChange={(e) => {
                      setFormSupermarketName(e.target.value);
                      if (!formCode && e.target.value) {
                        setFormCode(e.target.value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 5).toUpperCase());
                      }
                    }}
                    className="w-full bg-slate-900 border border-white/15 focus:border-amber-400 rounded-xl px-3 py-2 text-white outline-none"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Company Code * (Short)</label>
                  <input
                    type="text"
                    placeholder="e.g. METRO"
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                    className="w-full bg-slate-900 border border-white/15 focus:border-amber-400 rounded-xl px-3 py-2 text-white font-mono uppercase outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-300 font-bold block mb-1">Legal Company / Entity Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Metro Retail Supermarkets Pvt Ltd"
                  value={formLegalName}
                  onChange={(e) => setFormLegalName(e.target.value)}
                  className="w-full bg-slate-900 border border-white/15 focus:border-amber-400 rounded-xl px-3 py-2 text-white outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Company Password * (For Staff & Apps)</label>
                  <input
                    type="text"
                    placeholder="e.g. metro123"
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    className="w-full bg-slate-900 border border-white/15 focus:border-amber-400 rounded-xl px-3 py-2 text-white font-mono outline-none"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Admin Backup PIN (4 digits)</label>
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="1234"
                    value={formAdminPin}
                    onChange={(e) => setFormAdminPin(e.target.value)}
                    className="w-full bg-slate-900 border border-white/15 focus:border-amber-400 rounded-xl px-3 py-2 text-white font-mono outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-300 font-bold block mb-1">Store Address / Location</label>
                <input
                  type="text"
                  placeholder="e.g. 104 Commercial Street, Central District"
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  className="w-full bg-slate-900 border border-white/15 focus:border-amber-400 rounded-xl px-3 py-2 text-white outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Contact Email</label>
                  <input
                    type="email"
                    placeholder="admin@metromart.com"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full bg-slate-900 border border-white/15 focus:border-amber-400 rounded-xl px-3 py-2 text-white outline-none"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Contact Phone</label>
                  <input
                    type="text"
                    placeholder="+91 98765 00000"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="w-full bg-slate-900 border border-white/15 focus:border-amber-400 rounded-xl px-3 py-2 text-white outline-none"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-white/10 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-emerald-500 text-slate-950 font-bold shadow-lg shadow-amber-500/20 cursor-pointer"
                >
                  Create Company
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: EDIT COMPANY                                                       */}
      {/* ========================================================================= */}
      {showEditModal && companyToEdit && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xl flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-lg liquid-glass-card rounded-[28px] border border-white/20 shadow-2xl animate-scale-in text-white my-6">
            <div className="p-5 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-amber-400" />
                <h3 className="text-lg font-bold">Edit Company: {companyToEdit.supermarketName}</h3>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditCompanySubmit} className="p-5 space-y-4 text-xs">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 flex items-center gap-2 animate-shake">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span className="font-semibold">{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Supermarket Brand Name *</label>
                  <input
                    type="text"
                    value={formSupermarketName}
                    onChange={(e) => setFormSupermarketName(e.target.value)}
                    className="w-full bg-slate-900 border border-white/15 focus:border-amber-400 rounded-xl px-3 py-2 text-white outline-none"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Company Code *</label>
                  <input
                    type="text"
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                    className="w-full bg-slate-900 border border-white/15 focus:border-amber-400 rounded-xl px-3 py-2 text-white font-mono uppercase outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-300 font-bold block mb-1">Legal Entity Name *</label>
                <input
                  type="text"
                  value={formLegalName}
                  onChange={(e) => setFormLegalName(e.target.value)}
                  className="w-full bg-slate-900 border border-white/15 focus:border-amber-400 rounded-xl px-3 py-2 text-white outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Company Password *</label>
                  <input
                    type="text"
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    className="w-full bg-slate-900 border border-white/15 focus:border-amber-400 rounded-xl px-3 py-2 text-white font-mono outline-none"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Admin Backup PIN</label>
                  <input
                    type="text"
                    value={formAdminPin}
                    onChange={(e) => setFormAdminPin(e.target.value)}
                    className="w-full bg-slate-900 border border-white/15 focus:border-amber-400 rounded-xl px-3 py-2 text-white font-mono outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-300 font-bold block mb-1">Store Address</label>
                <input
                  type="text"
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  className="w-full bg-slate-900 border border-white/15 focus:border-amber-400 rounded-xl px-3 py-2 text-white outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Contact Email</label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full bg-slate-900 border border-white/15 focus:border-amber-400 rounded-xl px-3 py-2 text-white outline-none"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Contact Phone</label>
                  <input
                    type="text"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="w-full bg-slate-900 border border-white/15 focus:border-amber-400 rounded-xl px-3 py-2 text-white outline-none"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-white/10 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-emerald-500 text-slate-950 font-bold shadow-lg shadow-amber-500/20 cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: DELETE CONFIRMATION                                                */}
      {/* ========================================================================= */}
      {companyToDelete && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xl flex items-center justify-center p-3 sm:p-4">
          <div className="w-full max-w-md liquid-glass-card rounded-[28px] border border-white/20 shadow-2xl animate-scale-in text-white overflow-hidden">
            <div className="p-5 border-b border-white/10 flex items-center justify-between bg-slate-900/60">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-400" />
                <h3 className="text-base font-bold">Delete Supermarket Company?</h3>
              </div>
              <button
                onClick={() => setCompanyToDelete(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3 text-xs">
              <p className="text-slate-300">
                Are you sure you want to remove <strong>{companyToDelete.supermarketName} Supermarket</strong> (Code: <code>{companyToDelete.code}</code>)?
              </p>
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 space-y-1">
                <strong className="block font-bold">Important Notice:</strong>
                <span>Staff registered under this company will no longer be able to log in or clock attendance under this company code.</span>
              </div>
            </div>

            <div className="p-4 border-t border-white/10 bg-slate-950 flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setCompanyToDelete(null)}
                className="px-4 py-2 rounded-xl text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold cursor-pointer transition-all disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Yes, Delete Company'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: QR CODE DISPLAY & DOWNLOAD                                         */}
      {/* ========================================================================= */}
      {qrModalApp && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xl flex items-center justify-center p-3 sm:p-4">
          <div className="w-full max-w-sm liquid-glass-card rounded-[28px] p-6 border border-white/20 shadow-2xl animate-scale-in text-white text-center space-y-4 relative">
            <button
              onClick={() => setQrModalApp(null)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto">
              <QrCode className="w-6 h-6" />
            </div>

            <div>
              <h3 className="font-extrabold text-white text-base">{qrModalApp.name}</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Scan with Tablet or Phone camera to launch directly for {authenticatedCompany?.supermarketName || 'Store'}
              </p>
            </div>

            {generatedQrDataUrl ? (
              <div className="p-3 bg-white rounded-2xl inline-block shadow-xl border-4 border-slate-900 mx-auto">
                <img
                  src={generatedQrDataUrl}
                  alt="App QR Code"
                  className="w-56 h-56 object-contain"
                />
              </div>
            ) : (
              <div className="w-56 h-56 bg-slate-900 rounded-2xl flex items-center justify-center text-xs text-slate-400 mx-auto">
                Generating QR...
              </div>
            )}

            <div className="pt-2 flex items-center justify-center gap-2">
              <button
                onClick={() => handleCopyText(qrModalApp.url, 'qr-url')}
                className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                {copiedKey === 'qr-url' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey === 'qr-url' ? 'Copied URL!' : 'Copy Direct Link'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
