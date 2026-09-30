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
}

export const InstallModal: React.FC<InstallModalProps> = ({
  isOpen,
  onClose,
  initialApp = 'STAFF',
  onLaunchApp,
  isManagerHub = false,
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
      return url.toString();
    }
    const slug = target === 'STAFF' ? 'staff' : target === 'KIOSK' ? 'kiosk' : target === 'ADMIN' ? 'admin' : 'manager';
    return `https://attendo.local/?app=${slug}`;
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
          dark: '#05070D',
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
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xl flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl liquid-glass-card rounded-[32px] p-5 sm:p-7 border border-white/20 shadow-[0_25px_80px_rgba(0,0,0,0.9)] animate-scale-in text-white my-6">
        
        {/* Close Button */}
        <button
          id="btn-close-install-modal"
          onClick={onClose}
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 hover:text-white transition-all cursor-pointer z-10"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-500 via-emerald-400 to-purple-500 p-0.5 shadow-lg flex-shrink-0">
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center text-emerald-400">
              <Globe className="w-6 h-6" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-black tracking-tight text-white">
                {isManagerHub ? 'App Web Addresses & Access Hub' : `${APP_CONFIGS[selectedApp].name} Web Address`}
              </h2>
              <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full">
                {isManagerHub ? '4 Dedicated Apps' : 'Dedicated App'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {isManagerHub 
                ? 'Copy or scan the dedicated web address for each application to access on phone, door tablet, or desktop.'
                : `Dedicated web address and access details for ${APP_CONFIGS[selectedApp].name}.`}
            </p>
          </div>
        </div>

        {/* 4 Dedicated App Selection Tabs - ONLY available in Apps Manager */}
        {isManagerHub && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 bg-black/50 rounded-2xl border border-white/10 mb-5">
            {/* TAB 1: STAFF APP */}
            <button
              id="tab-select-staff-app"
              onClick={() => {
                setSelectedApp('STAFF');
                setOsTab('IOS');
              }}
              className={`flex flex-col sm:flex-row items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer text-center ${
                selectedApp === 'STAFF'
                  ? 'bg-sky-500 text-slate-950 shadow-lg shadow-sky-500/25 scale-[1.01]'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
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
              className={`flex flex-col sm:flex-row items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer text-center ${
                selectedApp === 'KIOSK'
                  ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/25 scale-[1.01]'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
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
              className={`flex flex-col sm:flex-row items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer text-center ${
                selectedApp === 'ADMIN'
                  ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/25 scale-[1.01]'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
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
              className={`flex flex-col sm:flex-row items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer text-center ${
                selectedApp === 'MANAGER'
                  ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/25 scale-[1.01]'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
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
        <div className={`rounded-2xl p-3.5 mb-4 border ${
          selectedApp === 'STAFF' 
            ? 'bg-sky-500/10 border-sky-500/30' 
            : selectedApp === 'KIOSK' 
            ? 'bg-emerald-500/10 border-emerald-500/30' 
            : selectedApp === 'ADMIN'
            ? 'bg-purple-500/10 border-purple-500/30'
            : 'bg-amber-500/10 border-amber-500/30'
        }`}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className={`text-[10px] font-mono font-bold uppercase tracking-wider ${
                selectedApp === 'STAFF' 
                  ? 'text-sky-400' 
                  : selectedApp === 'KIOSK' 
                  ? 'text-emerald-400' 
                  : selectedApp === 'ADMIN' 
                  ? 'text-purple-400'
                  : 'text-amber-400'
              }`}>
                {selectedApp === 'STAFF' && 'TARGET: EMPLOYEE PERSONAL PHONES (iOS & ANDROID)'}
                {selectedApp === 'KIOSK' && 'TARGET: ENTRANCE DOOR TABLET (ENTERPRISE TURNSTILE TERMINAL)'}
                {selectedApp === 'ADMIN' && 'TARGET: STORE MANAGER & HR WORKSTATION'}
                {selectedApp === 'MANAGER' && 'TARGET: EXECUTIVE IT & APPLICATION PROVISIONING HUB'}
              </span>
              <h3 className="text-sm font-bold text-white mt-0.5">
                {selectedApp === 'STAFF' && 'Staff Mobile — Attendance App'}
                {selectedApp === 'KIOSK' && 'Face Terminal — Entrance Door Kiosk'}
                {selectedApp === 'ADMIN' && 'Store Admin — Store HR Management Console'}
                {selectedApp === 'MANAGER' && 'Apps Manager — Company & Application Hub'}
              </h3>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                {selectedApp === 'STAFF' && 'Staff members download this onto their phone. Completely hides Admin and Kiosk tabs. Only shows personal shifts, live camera face punch, GPS geofencing, and leave requests.'}
                {selectedApp === 'KIOSK' && 'Installed on an iPad or Android tablet mounted at the supermarket entrance door. Operates in hands-free fullscreen mode with rapid face AI scan for staff entering and exiting.'}
                {selectedApp === 'ADMIN' && 'For the supermarket owner and HR managers. Full management of employee rosters, live attendance audits, shift scheduling, and payroll calculations.'}
                {selectedApp === 'MANAGER' && 'Dedicated system hub to register new supermarket companies, manage database codes & passwords, pair face kiosks, and toggle per-app permissions.'}
              </p>
            </div>
          </div>
        </div>

        {/* QR Code & Direct Link Card */}
        <div className="liquid-glass rounded-2xl p-4 flex flex-col sm:flex-row items-center gap-4 mb-4 border border-white/10">
          
          {/* QR Code Container */}
          <div className="relative p-2 bg-white rounded-2xl shadow-xl flex-shrink-0 flex items-center justify-center">
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
            <div className="absolute -bottom-2 bg-slate-900 text-[9px] font-bold text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/40">
              SCAN WITH CAMERA
            </div>
          </div>

          {/* Link Actions & Direct Launch */}
          <div className="flex-1 w-full space-y-2.5 text-center sm:text-left">
            <div>
              <span className="text-xs font-bold text-slate-200 block">
                1. Point Camera or Share Direct Link
              </span>
              <p className="text-[11px] text-slate-400 mt-0.5">
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
                className="flex-1 bg-slate-900/90 border border-white/15 rounded-xl px-3 py-2 text-[11px] font-mono text-sky-300 focus:outline-none truncate"
              />
              <button
                id="btn-copy-install-link"
                onClick={handleCopy}
                className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                  copied
                    ? 'bg-emerald-500 text-black font-bold'
                    : 'liquid-button text-white hover:bg-white/15'
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
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-lg ${
                    selectedApp === 'STAFF'
                      ? 'bg-sky-500 hover:bg-sky-400 text-slate-950'
                      : selectedApp === 'KIOSK'
                      ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                      : 'bg-purple-500 hover:bg-purple-400 text-white'
                  }`}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>
                    {selectedApp === 'STAFF' && 'Launch Staff App on this screen'}
                    {selectedApp === 'KIOSK' && 'Launch Entrance Door Kiosk'}
                    {selectedApp === 'ADMIN' && 'Launch Admin Console'}
                  </span>
                </button>
              </div>
            )}

            {/* In-App Install (if browser supports beforeinstallprompt) */}
            {isInstallable && !isInstalled && (
              <div className="pt-1">
                <button
                  onClick={install}
                  className="w-full py-2 px-3 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center justify-center gap-1.5 border border-emerald-500/30 transition-all cursor-pointer shadow-lg"
                  title="Install progressive web app directly"
                >
                  <Globe className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Install App to Home Screen</span>
                </button>
              </div>
            )}
          </div>

        </div>

        {/* Device Setup & Bookmark Guidelines */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              2. Open Web Address on Device
            </span>
            <div className="flex items-center gap-1 p-0.5 bg-black/40 rounded-xl border border-white/10 text-xs">
              <button
                onClick={() => setOsTab('ANDROID')}
                className={`px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1 transition-all ${
                  osTab === 'ANDROID' ? 'bg-emerald-500 text-slate-950 font-bold shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Smartphone className="w-3 h-3" />
                <span>Android</span>
              </button>
              <button
                onClick={() => setOsTab('IOS')}
                className={`px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1 transition-all ${
                  osTab === 'IOS' ? 'bg-sky-500 text-slate-950 font-bold shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Apple className="w-3 h-3" />
                <span>iPhone / iPad</span>
              </button>
              {selectedApp === 'KIOSK' && (
                <button
                  onClick={() => setOsTab('TABLET_LOCK')}
                  className={`px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1 transition-all ${
                    osTab === 'TABLET_LOCK' ? 'bg-amber-500 text-slate-950 font-bold shadow' : 'text-amber-400 hover:text-white'
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
            <div className="liquid-glass rounded-2xl p-3 space-y-2 border border-emerald-500/20 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="p-2.5 rounded-xl bg-white/5 border border-white/5">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-[10px] mb-1">1</span>
                  <p className="text-slate-300 text-[11px]">Open the web address in <strong>Chrome</strong> on your Android phone or tablet.</p>
                </div>
                <div className="p-2.5 rounded-xl bg-white/5 border border-white/5">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-[10px] mb-1">2</span>
                  <p className="text-slate-300 text-[11px]">In Chrome, tap the <strong>three dots (⋮)</strong> menu &rarr; <strong>&quot;Add to Home screen&quot;</strong> or bookmark.</p>
                </div>
                <div className="p-2.5 rounded-xl bg-white/5 border border-white/5">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-[10px] mb-1">3</span>
                  <p className="text-slate-300 text-[11px]">Launch the app directly from your browser or Home Screen with camera access.</p>
                </div>
              </div>
            </div>
          )}

          {/* iOS Safari Steps */}
          {osTab === 'IOS' && (
            <div className="liquid-glass rounded-2xl p-3 space-y-2 border border-sky-500/20 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="p-2.5 rounded-xl bg-white/5 border border-white/5">
                  <span className="w-5 h-5 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold text-[10px] mb-1">1</span>
                  <p className="text-slate-300 text-[11px]">Open link in <strong>Safari</strong> on iPhone or iPad.</p>
                </div>
                <div className="p-2.5 rounded-xl bg-white/5 border border-white/5">
                  <span className="w-5 h-5 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold text-[10px] mb-1">2</span>
                  <p className="text-slate-300 text-[11px] flex items-center gap-1 flex-wrap">
                    Tap <strong className="inline-flex items-center gap-0.5 px-1 py-0.5 bg-white/10 rounded"><Share2 className="w-2.5 h-2.5 text-sky-400" /> Share</strong> at bottom.
                  </p>
                </div>
                <div className="p-2.5 rounded-xl bg-white/5 border border-white/5">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-[10px] mb-1">3</span>
                  <p className="text-slate-300 text-[11px] flex items-center gap-1 flex-wrap">
                    Tap <strong className="inline-flex items-center gap-0.5 px-1 py-0.5 bg-white/10 rounded"><PlusSquare className="w-2.5 h-2.5 text-emerald-400" /> Add to Home Screen</strong>.
                  </p>
                </div>
              </div>
              <p className="text-[11px] text-slate-400 text-center">
                App icon installs as <strong>&quot;{APP_CONFIGS[selectedApp].name}&quot;</strong> with standalone full-screen window.
              </p>
            </div>
          )}

          {/* Entrance Door Tablet Kiosk Mode Setup */}
          {osTab === 'TABLET_LOCK' && (
            <div className="liquid-glass rounded-2xl p-3.5 space-y-2 border border-emerald-500/30 text-xs bg-emerald-950/20">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                <Tablet className="w-4 h-4" />
                <span>Enterprise Door Setup (Like Google Workspace Turnstiles):</span>
              </div>
              <ul className="space-y-1.5 text-slate-300 text-[11px] pl-2 list-disc list-inside">
                <li>
                  <strong>iPad Mount:</strong> After adding to Home Screen, enable <em>iOS Guided Access</em> (Settings &rarr; Accessibility &rarr; Guided Access). Triple-click the iPad power button to lock the tablet to the entrance door so staff cannot exit the app.
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
        <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between">
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>Each app is isolated for its dedicated user & hardware</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl liquid-pill text-xs font-semibold text-slate-300 hover:text-white cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
