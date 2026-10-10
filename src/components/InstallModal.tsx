import React, { useState, useEffect } from 'react';
import { 
  Smartphone, 
  X, 
  Copy, 
  Check, 
  QrCode, 
  ExternalLink, 
  Apple, 
  Share2, 
  PlusSquare, 
  Sparkles,
  ScanFace,
  ShieldCheck,
  Globe,
  Info,
  Layers,
  Lock,
  Tablet,
  LayoutGrid
} from 'lucide-react';
import QRCode from 'qrcode';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { 
  APP_CONFIGS 
} from '../utils/appPackager';

export type AppInstallTarget = 'STAFF' | 'KIOSK' | 'ADMIN' | 'MANAGER';

interface InstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialApp?: AppInstallTarget;
  onLaunchApp?: (target: AppInstallTarget) => void;
  isManagerHub?: boolean;
  companyCode?: string;
}

export const InstallModal: React.FC<InstallModalProps> = ({
  isOpen,
  onClose,
  initialApp = 'STAFF',
  onLaunchApp,
  isManagerHub = false,
  companyCode,
}) => {
  const [selectedApp, setSelectedApp] = useState<AppInstallTarget>(initialApp);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [osTab, setOsTab] = useState<'ANDROID' | 'IOS' | 'TABLET_LOCK'>('ANDROID');
  
  const { isInstallable, isInstalled, install } = usePWAInstall();

  // Synchronize initialApp when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedApp(initialApp);
    }
  }, [isOpen, initialApp]);

  // Compute the dedicated URL for the selected application
  const getAppUrl = (target: AppInstallTarget) => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.origin + window.location.pathname);
      if (target === 'STAFF') url.searchParams.set('app', 'staff');
      else if (target === 'KIOSK') url.searchParams.set('app', 'kiosk');
      else if (target === 'ADMIN') url.searchParams.set('app', 'admin');
      else if (target === 'MANAGER') url.searchParams.set('app', 'manager');
      if (companyCode && target !== 'MANAGER') {
        url.searchParams.set('company', companyCode);
      }
      return url.toString();
    }
    const slug = target === 'STAFF' ? 'staff' : target === 'KIOSK' ? 'kiosk' : target === 'ADMIN' ? 'admin' : 'manager';
    const compQuery = companyCode && target !== 'MANAGER' ? `&company=${encodeURIComponent(companyCode)}` : '';
    return `https://attendo.local/?app=${slug}${compQuery}`;
  };

  const activeAppUrl = getAppUrl(selectedApp);

  // Re-generate QR Code when selected app changes or modal opens
  useEffect(() => {
    if (!isOpen) return;

    QRCode.toDataURL(
      activeAppUrl,
      {
        width: 280,
        margin: 2,
        color: {
          dark: '#1E293B',
          light: '#FFFFFF',
        },
      },
      (err, url) => {
        if (!err && url) {
          setQrDataUrl(url);
        }
      }
    );
  }, [isOpen, activeAppUrl, selectedApp]);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(activeAppUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleDirectLaunch = () => {
    if (!isManagerHub) return;
    if (onLaunchApp) {
      onLaunchApp(selectedApp);
      onClose();
      return;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-500/20 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl p-5 sm:p-7 border border-[#E2E8F0] shadow-xl animate-scale-in text-[#1E293B] my-6">
        
        {/* Close Button */}
        <button
          id="btn-close-install-modal"
          onClick={onClose}
          className="absolute top-5 right-5 w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-all cursor-pointer z-10"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#2563EB] flex-shrink-0">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-[#1E293B]">
                {isManagerHub ? 'App Web Addresses & Access Hub' : `${APP_CONFIGS[selectedApp].name} Web Address`}
              </h2>
              <span className="px-2 py-0.5 text-[10px] font-semibold bg-blue-50 text-[#2563EB] border border-blue-200 rounded-md">
                {isManagerHub ? '4 Dedicated Apps' : 'Dedicated App'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {isManagerHub 
                ? 'Copy or scan the dedicated web address for each application to access on phone, door tablet, or desktop.'
                : `Dedicated web address and access details for ${APP_CONFIGS[selectedApp].name}.`}
            </p>
          </div>
        </div>

        {/* 4 Dedicated App Selection Tabs - ONLY available in Apps Manager */}
        {isManagerHub && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200 mb-5">
            {/* TAB 1: STAFF APP */}
            <button
              id="tab-select-staff-app"
              onClick={() => {
                setSelectedApp('STAFF');
                setOsTab('IOS');
              }}
              className={`flex flex-col sm:flex-row items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-semibold transition-all cursor-pointer text-center ${
                selectedApp === 'STAFF'
                  ? 'bg-[#2563EB] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Smartphone className="w-4 h-4 shrink-0" />
              <div className="leading-tight">
                <span>Staff App</span>
                <span className="hidden sm:block text-[9px] opacity-80 font-normal">Personal Phones</span>
              </div>
            </button>

            {/* TAB 2: ENTRANCE DOOR KIOSK */}
            <button
              id="tab-select-kiosk-app"
              onClick={() => {
                setSelectedApp('KIOSK');
                setOsTab('TABLET_LOCK');
              }}
              className={`flex flex-col sm:flex-row items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-semibold transition-all cursor-pointer text-center ${
                selectedApp === 'KIOSK'
                  ? 'bg-[#2563EB] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <ScanFace className="w-4 h-4 shrink-0" />
              <div className="leading-tight">
                <span>Face Kiosk</span>
                <span className="hidden sm:block text-[9px] opacity-80 font-normal">Door Tablet</span>
              </div>
            </button>

            {/* TAB 3: ADMIN HR PORTAL */}
            <button
              id="tab-select-admin-app"
              onClick={() => {
                setSelectedApp('ADMIN');
                setOsTab('ANDROID');
              }}
              className={`flex flex-col sm:flex-row items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-semibold transition-all cursor-pointer text-center ${
                selectedApp === 'ADMIN'
                  ? 'bg-[#2563EB] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <div className="leading-tight">
                <span>Admin HR</span>
                <span className="hidden sm:block text-[9px] opacity-80 font-normal">Manager Console</span>
              </div>
            </button>

            {/* TAB 4: APPS MANAGER */}
            <button
              id="tab-select-manager-app"
              onClick={() => {
                setSelectedApp('MANAGER');
                setOsTab('ANDROID');
              }}
              className={`flex flex-col sm:flex-row items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-semibold transition-all cursor-pointer text-center ${
                selectedApp === 'MANAGER'
                  ? 'bg-[#2563EB] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <LayoutGrid className="w-4 h-4 shrink-0" />
              <div className="leading-tight">
                <span>Apps Manager</span>
                <span className="hidden sm:block text-[9px] opacity-80 font-normal">Companies &amp; Apps</span>
              </div>
            </button>
          </div>
        )}

        {/* Dynamic App Target Description Card */}
        <div className="rounded-xl p-3.5 mb-4 border border-[#E2E8F0] bg-[#F8FAFC]">
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#2563EB]">
                {selectedApp === 'STAFF' && 'TARGET: EMPLOYEE PERSONAL PHONES (iOS & ANDROID)'}
                {selectedApp === 'KIOSK' && 'TARGET: ENTRANCE DOOR TABLET (ENTERPRISE TURNSTILE TERMINAL)'}
                {selectedApp === 'ADMIN' && 'TARGET: STORE MANAGER & HR WORKSTATION'}
                {selectedApp === 'MANAGER' && 'TARGET: EXECUTIVE IT & APPLICATION PROVISIONING HUB'}
              </span>
              <h3 className="text-sm font-bold text-[#1E293B] mt-0.5">
                {selectedApp === 'STAFF' && 'Staff Mobile — Attendance App'}
                {selectedApp === 'KIOSK' && 'Face Terminal — Entrance Door Kiosk'}
                {selectedApp === 'ADMIN' && 'Store Admin — Store HR Management Console'}
                {selectedApp === 'MANAGER' && 'Apps Manager — Company & Application Hub'}
              </h3>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                {selectedApp === 'STAFF' && 'Staff members download this onto their phone. Completely hides Admin and Kiosk tabs. Only shows personal shifts, live camera face punch, GPS geofencing, and leave requests.'}
                {selectedApp === 'KIOSK' && 'Installed on an iPad or Android tablet mounted at the supermarket entrance door. Operates in hands-free fullscreen mode with rapid face AI scan for staff entering and exiting.'}
                {selectedApp === 'ADMIN' && 'For the supermarket owner and HR managers. Full management of employee rosters, live attendance audits, shift scheduling, and payroll calculations.'}
                {selectedApp === 'MANAGER' && 'Dedicated system hub to register new supermarket companies, manage database codes & passwords, pair face kiosks, and toggle per-app permissions.'}
              </p>
            </div>
          </div>
        </div>

        {/* QR Code & Direct Link Card */}
        <div className="bg-white rounded-xl p-4 flex flex-col sm:flex-row items-center gap-4 mb-4 border border-[#E2E8F0] shadow-xs">
          
          {/* QR Code Container */}
          <div className="relative p-2 bg-white keep-white rounded-xl border border-slate-200 shadow-xs flex-shrink-0 flex items-center justify-center">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt={`Scan to open ${selectedApp} app`}
                className="w-32 h-32 object-contain rounded-lg"
              />
            ) : (
              <div className="w-32 h-32 flex items-center justify-center text-slate-400">
                <QrCode className="w-8 h-8 animate-pulse text-slate-400" />
              </div>
            )}
            <div className="absolute -bottom-2 bg-[#2563EB] text-[9px] font-bold text-white px-2.5 py-0.5 rounded-full shadow-xs">
              SCAN WITH CAMERA
            </div>
          </div>

          {/* Link Actions & Direct Launch */}
          <div className="flex-1 w-full space-y-2.5 text-center sm:text-left">
            <div>
              <span className="text-xs font-bold text-[#1E293B] block">
                1. Point Camera or Share Direct Link
              </span>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {selectedApp === 'STAFF' && 'Point your personal phone camera at the QR code to install the Staff App directly.'}
                {selectedApp === 'KIOSK' && 'Point the entrance door tablet camera at this QR code to load the Kiosk terminal.'}
                {selectedApp === 'ADMIN' && 'Open this link on your manager laptop or workstation browser to install.'}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={activeAppUrl}
                className="flex-1 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg px-3 py-2 text-[11px] font-mono text-[#2563EB] focus:outline-none truncate"
              />
              <button
                id="btn-copy-install-link"
                onClick={handleCopy}
                className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 border ${
                  copied
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                }`}
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied!' : 'Copy Link'}</span>
              </button>
            </div>

            {/* Direct Open Button - ONLY available in Apps Manager */}
            {isManagerHub && (
              <div className="flex items-center gap-2 pt-1">
                <button
                  id="btn-launch-selected-app"
                  onClick={handleDirectLaunch}
                  className="flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer bg-[#2563EB] hover:bg-blue-700 text-white shadow-xs"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>
                    {selectedApp === 'STAFF' && 'Launch Staff App on this screen'}
                    {selectedApp === 'KIOSK' && 'Launch Entrance Door Kiosk'}
                    {selectedApp === 'ADMIN' && 'Launch Admin Console'}
                    {selectedApp === 'MANAGER' && 'Launch Apps Manager'}
                  </span>
                </button>
              </div>
            )}

            {/* In-App Install (if browser supports beforeinstallprompt) */}
            {isInstallable && !isInstalled && (
              <div className="pt-1">
                <button
                  onClick={install}
                  className="w-full py-2 px-3 rounded-lg bg-blue-50 hover:bg-blue-100 text-[#2563EB] text-xs font-semibold flex items-center justify-center gap-1.5 border border-blue-200 transition-all cursor-pointer"
                  title="Install progressive web app directly"
                >
                  <Globe className="w-3.5 h-3.5 text-[#2563EB]" />
                  <span>Install App to Home Screen</span>
                </button>
              </div>
            )}
          </div>

        </div>

        {/* Device Setup & Bookmark Guidelines */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              2. Open Web Address on Device
            </span>
            <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-lg border border-slate-200 text-xs">
              <button
                onClick={() => setOsTab('ANDROID')}
                className={`px-2.5 py-1 rounded-md font-semibold flex items-center gap-1 transition-all ${
                  osTab === 'ANDROID' ? 'bg-[#2563EB] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Smartphone className="w-3 h-3" />
                <span>Android</span>
              </button>
              <button
                onClick={() => setOsTab('IOS')}
                className={`px-2.5 py-1 rounded-md font-semibold flex items-center gap-1 transition-all ${
                  osTab === 'IOS' ? 'bg-[#2563EB] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Apple className="w-3 h-3" />
                <span>iPhone / iPad</span>
              </button>
              {selectedApp === 'KIOSK' && (
                <button
                  onClick={() => setOsTab('TABLET_LOCK')}
                  className={`px-2.5 py-1 rounded-md font-semibold flex items-center gap-1 transition-all ${
                    osTab === 'TABLET_LOCK' ? 'bg-[#2563EB] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Lock className="w-3 h-3" />
                  <span>Door Tablet Lock</span>
                </button>
              )}
            </div>
          </div>

          {/* Android Steps */}
          {osTab === 'ANDROID' && (
            <div className="bg-[#F8FAFC] rounded-xl p-3.5 space-y-2 border border-[#E2E8F0] text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="p-2.5 rounded-lg bg-white border border-[#E2E8F0]">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-[#2563EB] flex items-center justify-center font-bold text-[10px] mb-1">1</span>
                  <p className="text-slate-600 text-[11px]">Open the web address in <strong>Chrome</strong> on your Android phone or tablet.</p>
                </div>
                <div className="p-2.5 rounded-lg bg-white border border-[#E2E8F0]">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-[#2563EB] flex items-center justify-center font-bold text-[10px] mb-1">2</span>
                  <p className="text-slate-600 text-[11px]">In Chrome, tap the <strong>three dots (⋮)</strong> menu &rarr; <strong>&quot;Add to Home screen&quot;</strong>.</p>
                </div>
                <div className="p-2.5 rounded-lg bg-white border border-[#E2E8F0]">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-[#2563EB] flex items-center justify-center font-bold text-[10px] mb-1">3</span>
                  <p className="text-slate-600 text-[11px]">Launch the app directly from your Home Screen with camera access.</p>
                </div>
              </div>
            </div>
          )}

          {/* iOS Safari Steps */}
          {osTab === 'IOS' && (
            <div className="bg-[#F8FAFC] rounded-xl p-3.5 space-y-2 border border-[#E2E8F0] text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="p-2.5 rounded-lg bg-white border border-[#E2E8F0]">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-[#2563EB] flex items-center justify-center font-bold text-[10px] mb-1">1</span>
                  <p className="text-slate-600 text-[11px]">Open link in <strong>Safari</strong> on iPhone or iPad.</p>
                </div>
                <div className="p-2.5 rounded-lg bg-white border border-[#E2E8F0]">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-[#2563EB] flex items-center justify-center font-bold text-[10px] mb-1">2</span>
                  <p className="text-slate-600 text-[11px] flex items-center gap-1 flex-wrap">
                    Tap <strong className="inline-flex items-center gap-0.5 px-1 py-0.5 bg-slate-100 rounded border border-slate-200"><Share2 className="w-2.5 h-2.5 text-[#2563EB]" /> Share</strong> at bottom.
                  </p>
                </div>
                <div className="p-2.5 rounded-lg bg-white border border-[#E2E8F0]">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-[#2563EB] flex items-center justify-center font-bold text-[10px] mb-1">3</span>
                  <p className="text-slate-600 text-[11px] flex items-center gap-1 flex-wrap">
                    Tap <strong className="inline-flex items-center gap-0.5 px-1 py-0.5 bg-slate-100 rounded border border-slate-200"><PlusSquare className="w-2.5 h-2.5 text-emerald-600" /> Add to Home Screen</strong>.
                  </p>
                </div>
              </div>
              <p className="text-[11px] text-slate-500 text-center">
                App icon installs as <strong>&quot;{APP_CONFIGS[selectedApp].name}&quot;</strong> with standalone full-screen window.
              </p>
            </div>
          )}

          {/* Entrance Door Tablet Kiosk Mode Setup */}
          {osTab === 'TABLET_LOCK' && (
            <div className="bg-[#F8FAFC] rounded-xl p-3.5 space-y-2 border border-[#E2E8F0] text-xs">
              <div className="flex items-center gap-2 text-[#2563EB] font-bold text-xs">
                <Tablet className="w-4 h-4" />
                <span>Enterprise Door Setup:</span>
              </div>
              <ul className="space-y-1.5 text-slate-600 text-[11px] pl-2 list-disc list-inside">
                <li>
                  <strong>iPad Mount:</strong> After adding to Home Screen, enable <em>iOS Guided Access</em> (Settings &rarr; Accessibility &rarr; Guided Access). Triple-click power button to lock tablet.
                </li>
                <li>
                  <strong>Android Tablet:</strong> Enable <em>App Pinning</em> in Android Settings to prevent navigation outside the Kiosk.
                </li>
                <li>
                  <strong>Manager Passcode:</strong> The Kiosk is protected with a manager PIN to return to Admin settings.
                </li>
              </ul>
            </div>
          )}
        </div>

        {/* Modal Action Footer */}
        <div className="mt-4 pt-3 border-t border-[#E2E8F0] flex items-center justify-between">
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-[#2563EB]" />
            <span>Each app is isolated for its dedicated role &amp; hardware</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-white border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
