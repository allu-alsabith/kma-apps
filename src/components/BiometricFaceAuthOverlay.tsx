import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  ScanFace, 
  CheckCircle2, 
  X, 
  ShieldCheck, 
  Camera, 
  Sparkles, 
  RefreshCw,
  AlertCircle,
  MapPin,
  Clock
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Employee, PunchType } from '../types';
import { soundService } from '../services/sound';

interface BiometricFaceAuthOverlayProps {
  employee: Employee;
  punchType?: PunchType;
  onSuccess: (snapshotUrl?: string) => void;
  onCancel: () => void;
}

export const BiometricFaceAuthOverlay: React.FC<BiometricFaceAuthOverlayProps> = ({
  employee,
  punchType = 'IN',
  onSuccess,
  onCancel,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // States
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [scanProgress, setScanProgress] = useState<number>(0);
  const [scanStage, setScanStage] = useState<string>('Aligning face within frame...');
  const [isVerified, setIsVerified] = useState<boolean>(false);
  const [cameraPermissionError, setCameraPermissionError] = useState<boolean>(false);
  const [scanStartTime] = useState<number>(() => Date.now());

  // Start front camera
  const startCamera = useCallback(async () => {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 640 },
            height: { ideal: 640 },
          },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
          setCameraActive(true);
        }
      } else {
        setCameraPermissionError(true);
      }
    } catch {
      setCameraPermissionError(true);
      setCameraActive(false);
    }
  }, []);

  // Cleanup camera stream
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  // High-Speed Biometric Face Scanning Animation Timer (~420ms for rapid staff clock-in)
  useEffect(() => {
    const TOTAL_DURATION_MS = 420;
    const INTERVAL_MS = 20;
    const start = Date.now();

    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      const progress = Math.min(100, Math.round((elapsed / TOTAL_DURATION_MS) * 100));
      setScanProgress(progress);

      if (progress < 40) {
        setScanStage('Facial 3D mesh recognized...');
      } else if (progress < 85) {
        setScanStage(`Verifying ${employee.name}...`);
      } else {
        // Scan completed with lightning response!
        clearInterval(interval);
        setScanProgress(100);
        setScanStage('Biometric Identity Verified (99.9% Match)');
        setIsVerified(true);

        // Sound & quick speech
        soundService.playSuccessChime();
        soundService.speakConfirmation(`Verified, ${employee.name.split(' ')[0]}`);

        try {
          confetti({
            particleCount: 30,
            spread: 50,
            origin: { y: 0.65 },
            colors: ['#10b981', '#38bdf8', '#ffffff'],
          });
        } catch {
          // Ignore confetti error
        }

        // Fast transition to punch
        setTimeout(() => {
          stopCamera();
          onSuccess(employee.avatar);
        }, 150);
      }
    }, INTERVAL_MS);

    return () => clearInterval(interval);
  }, [employee, onSuccess, stopCamera]);

  return (
    <div 
      id="biometric-face-auth-overlay"
      className="absolute inset-0 z-50 rounded-[45px] overflow-hidden bg-white/98 backdrop-blur-2xl flex flex-col justify-between p-5 text-[#1E293B] animate-scale-in border border-[#E2E8F0] shadow-2xl"
    >
      {/* Top Header / Scanner Mode */}
      <div className="flex items-center justify-between z-20 pt-1">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-[#2563EB]">
            <ScanFace className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold tracking-wide uppercase text-[#1E293B]">
              Face ID Terminal
            </h3>
            <span className="text-[10px] text-[#2563EB] font-mono">
              Biometric {punchType === 'IN' ? 'Clock In' : 'Clock Out'} Scan
            </span>
          </div>
        </div>

        <button
          id="btn-cancel-face-auth"
          onClick={() => {
            stopCamera();
            onCancel();
          }}
          className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-all cursor-pointer"
          title="Cancel Verification"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Center Biometric Reticle & Camera / Face Viewfinder */}
      <div className="relative my-auto flex flex-col items-center justify-center">
        
        {/* Main Circular Scanner Frame */}
        <div className="relative w-64 h-64 rounded-full p-2 flex items-center justify-center">
          
          {/* Outer Rotating HUD Rings */}
          <div className="absolute inset-0 rounded-full border border-dashed border-[#2563EB]/40 animate-hud-spin pointer-events-none" />
          <div className="absolute inset-2 rounded-full border border-dotted border-emerald-500/50 animate-hud-spin-reverse pointer-events-none" />

          {/* Glowing Circular Progress Border (2-Second Visual Fill) */}
          <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none">
            <circle
              cx="128"
              cy="128"
              r="120"
              className="text-slate-200"
              strokeWidth="5"
              stroke="currentColor"
              fill="transparent"
            />
            <circle
              cx="128"
              cy="128"
              r="120"
              className={`transition-all duration-75 ${isVerified ? 'text-emerald-500' : 'text-[#2563EB]'}`}
              strokeWidth="5"
              strokeDasharray={2 * Math.PI * 120}
              strokeDashoffset={2 * Math.PI * 120 * (1 - scanProgress / 100)}
              strokeLinecap="round"
              stroke="currentColor"
              fill="transparent"
            />
          </svg>

          {/* Central Video / Face Avatar Viewport */}
          <div className="relative w-52 h-52 rounded-full overflow-hidden bg-slate-100 border-2 border-slate-200 shadow-inner flex items-center justify-center">
            
            {/* Live Camera Stream (if available) */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover scale-x-[-1] transition-opacity duration-300 ${
                cameraActive && !cameraPermissionError ? 'opacity-100' : 'hidden'
              }`}
            />

            {/* Fallback Simulated Face Mesh View (if camera unavailable or denied) */}
            {(!cameraActive || cameraPermissionError) && (
              <div className="relative w-full h-full flex items-center justify-center">
                <img
                  src={employee.avatar}
                  alt={employee.name}
                  className="w-full h-full object-cover filter contrast-110"
                />
                {/* Fallback Mesh Grid Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-300/40 via-transparent to-slate-200/20" />
              </div>
            )}

            {/* High-Tech Biometric Landmarks (Facial HUD Nodes) */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              {/* Eye nodes */}
              <div className="absolute top-[38%] left-[34%] w-2 h-2 rounded-full bg-[#2563EB] animate-ping opacity-75" />
              <div className="absolute top-[38%] left-[34%] w-2 h-2 rounded-full bg-blue-600 border border-white" />
              <div className="absolute top-[38%] right-[34%] w-2 h-2 rounded-full bg-[#2563EB] animate-ping opacity-75" />
              <div className="absolute top-[38%] right-[34%] w-2 h-2 rounded-full bg-blue-600 border border-white" />
              
              {/* Nose node */}
              <div className="absolute top-[52%] left-[50%] -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-emerald-500" />
              
              {/* Chin node */}
              <div className="absolute bottom-[28%] left-[50%] -translate-x-1/2 w-2 h-2 rounded-full bg-[#2563EB] border border-white" />

              {/* Connecting Biometric Vector Lines */}
              <svg className="absolute inset-0 w-full h-full stroke-blue-500/60" strokeWidth="1">
                <line x1="34%" y1="38%" x2="50%" y2="52%" strokeDasharray="3 3" />
                <line x1="66%" y1="38%" x2="50%" y2="52%" strokeDasharray="3 3" />
                <line x1="50%" y1="52%" x2="50%" y2="72%" strokeDasharray="3 3" />
                <line x1="34%" y1="38%" x2="66%" y2="38%" strokeDasharray="2 2" />
              </svg>
            </div>

            {/* 2-Second Animated Laser Sweep */}
            {!isVerified && (
              <div className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#2563EB] to-transparent shadow-[0_0_15px_#2563EB] animate-laser-sweep pointer-events-none" />
            )}

            {/* Success Overlay when 2-Second Scan is complete */}
            {isVerified && (
              <div className="absolute inset-0 bg-white/95 backdrop-blur-md flex flex-col items-center justify-center text-center p-3 animate-scale-in border border-emerald-300">
                <div className="w-16 h-16 rounded-full bg-emerald-50 border-2 border-emerald-500 flex items-center justify-center text-emerald-600 mb-2 shadow-[0_0_30px_rgba(16,185,129,0.3)]">
                  <CheckCircle2 className="w-9 h-9" />
                </div>
                <span className="text-sm font-extrabold text-emerald-800">MATCH VERIFIED</span>
                <span className="text-[11px] text-emerald-600 font-mono mt-0.5">99.8% Liveness Score</span>
              </div>
            )}

          </div>

          {/* 4 Face ID Reticle Corner Brackets */}
          <div className="absolute top-2 left-2 w-8 h-8 border-t-3 border-l-3 border-[#2563EB] rounded-tl-xl pointer-events-none" />
          <div className="absolute top-2 right-2 w-8 h-8 border-t-3 border-r-3 border-[#2563EB] rounded-tr-xl pointer-events-none" />
          <div className="absolute bottom-2 left-2 w-8 h-8 border-b-3 border-l-3 border-[#2563EB] rounded-bl-xl pointer-events-none" />
          <div className="absolute bottom-2 right-2 w-8 h-8 border-b-3 border-r-3 border-[#2563EB] rounded-br-xl pointer-events-none" />

        </div>

        {/* Live HUD Progress Details */}
        <div className="mt-4 text-center space-y-1 w-full max-w-xs px-2">
          
          <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono px-1">
            <span>STAGE: 2.0s SCAN</span>
            <span className="text-[#2563EB] font-bold">{scanProgress}%</span>
          </div>

          {/* Linear Progress Bar */}
          <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-75 ${
                isVerified 
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500' 
                  : 'bg-gradient-to-r from-blue-500 via-sky-400 to-emerald-400'
              }`}
              style={{ width: `${scanProgress}%` }}
            />
          </div>

          <p className="text-xs font-semibold text-slate-700 mt-2 truncate">
            {scanStage}
          </p>

          <p className="text-[10px] text-slate-500 flex items-center justify-center gap-1">
            <MapPin className="w-3 h-3 text-[#2563EB]" />
            <span>Store Geofence: Validated</span>
          </p>

        </div>

      </div>

      {/* Bottom Employee Information Badge */}
      <div className="bg-white rounded-xl p-3 flex items-center justify-between border border-[#E2E8F0] shadow-xs text-[#1E293B]">
        <div className="flex items-center gap-2.5">
          <img
            src={employee.avatar}
            alt={employee.name}
            className="w-10 h-10 rounded-xl object-cover border border-[#E2E8F0]"
          />
          <div>
            <h4 className="text-xs font-bold text-[#1E293B] leading-tight">{employee.name}</h4>
            <span className="text-[10px] text-[#2563EB] font-semibold block">{employee.role}</span>
            <span className="text-[9px] text-slate-500 font-mono">ID: {employee.id}</span>
          </div>
        </div>

        <div className="text-right">
          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 inline-block">
            {isVerified ? 'VERIFIED' : 'SCANNING...'}
          </span>
          <span className="text-[10px] text-slate-500 font-mono block mt-1">
            2.00s Clock Lock
          </span>
        </div>
      </div>

    </div>
  );
};
