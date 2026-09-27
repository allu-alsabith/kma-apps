import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, RefreshCw, CheckCircle2, ScanFace, X, AlertCircle, Sparkles, Image as ImageIcon } from 'lucide-react';
import { soundService } from '../services/sound';

interface FaceEnrollmentScannerProps {
  currentAvatar: string;
  onFaceCaptured: (avatarDataUrl: string) => void;
  staffName?: string;
}

// High-quality hypermarket staff sample faces if the user wants quick selection or has no webcam
const SAMPLE_PORTRAITS = [
  { label: 'Male 1', url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80' },
  { label: 'Female 1', url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&auto=format&fit=crop&q=80' },
  { label: 'Male 2', url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&auto=format&fit=crop&q=80' },
  { label: 'Female 2', url: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&auto=format&fit=crop&q=80' },
  { label: 'Male 3', url: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400&auto=format&fit=crop&q=80' },
  { label: 'Female 3', url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80' },
];

export const FaceEnrollmentScanner: React.FC<FaceEnrollmentScannerProps> = ({
  currentAvatar,
  onFaceCaptured,
  staffName = 'Staff Member',
}) => {
  const [activeMode, setActiveMode] = useState<'CAMERA' | 'UPLOAD' | 'SAMPLES' | 'URL'>('CAMERA');
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturedPreview, setCapturedPreview] = useState<string>(currentAvatar);
  const [urlInput, setUrlInput] = useState<string>(currentAvatar.startsWith('http') ? currentAvatar : '');

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Sync state if currentAvatar changes externally
  useEffect(() => {
    setCapturedPreview(currentAvatar);
  }, [currentAvatar]);

  // Stop camera tracks cleanly
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsStreaming(false);
  };

  // Start live camera stream
  const startCamera = async () => {
    setCameraError(null);
    stopCamera();

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
          await videoRef.current.play();
          setIsStreaming(true);
        }
      } else {
        setCameraError('Camera API is not supported in this browser environment.');
        setActiveMode('UPLOAD');
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Camera permission denied or camera in use';
      setCameraError(errorMsg);
      setIsStreaming(false);
    }
  };

  // Snap snapshot from live video
  const captureSnapshot = () => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current || document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 400;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Center crop to a square
    const minDim = Math.min(video.videoWidth, video.videoHeight) || 400;
    const startX = (video.videoWidth - minDim) / 2;
    const startY = (video.videoHeight - minDim) / 2;

    // Mirror the snapshot so it matches the mirror view
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, startX, startY, minDim, minDim, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    setCapturedPreview(dataUrl);
    onFaceCaptured(dataUrl);
    soundService.playSuccessChime();

    // Stop streaming after successful capture
    stopCamera();
  };

  // Handle local file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file (JPG, PNG, WebP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setCapturedPreview(result);
      onFaceCaptured(result);
      soundService.playSuccessChime();
    };
    reader.readAsDataURL(file);
  };

  // Select sample photo
  const handleSelectSample = (sampleUrl: string) => {
    setCapturedPreview(sampleUrl);
    onFaceCaptured(sampleUrl);
    soundService.playSuccessChime();
  };

  // Handle URL save
  const handleUrlSubmit = () => {
    if (!urlInput.trim()) return;
    setCapturedPreview(urlInput.trim());
    onFaceCaptured(urlInput.trim());
    soundService.playSuccessChime();
  };

  // Effect to switch mode
  useEffect(() => {
    if (activeMode === 'CAMERA' && !capturedPreview) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [activeMode, capturedPreview]);

  return (
    <div className="rounded-2xl p-3.5 bg-slate-950/80 border border-white/15 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <ScanFace className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-bold text-white">Staff Face Biometrics</span>
          {capturedPreview ? (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Captured
            </span>
          ) : (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-medium">
              Optional / Ready
            </span>
          )}
        </div>
        
        {/* Source Mode Tabs */}
        <div className="flex items-center gap-1 p-0.5 bg-slate-900 rounded-lg border border-white/10 text-[10px]">
          <button
            type="button"
            onClick={() => setActiveMode('CAMERA')}
            className={`px-2 py-1 rounded-md font-semibold transition-all cursor-pointer ${
              activeMode === 'CAMERA'
                ? 'bg-emerald-500 text-slate-950 font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Camera
          </button>
          <button
            type="button"
            onClick={() => setActiveMode('UPLOAD')}
            className={`px-2 py-1 rounded-md font-semibold transition-all cursor-pointer ${
              activeMode === 'UPLOAD'
                ? 'bg-emerald-500 text-slate-950 font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Upload
          </button>
          <button
            type="button"
            onClick={() => setActiveMode('SAMPLES')}
            className={`px-2 py-1 rounded-md font-semibold transition-all cursor-pointer ${
              activeMode === 'SAMPLES'
                ? 'bg-emerald-500 text-slate-950 font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Presets
          </button>
          <button
            type="button"
            onClick={() => setActiveMode('URL')}
            className={`px-2 py-1 rounded-md font-semibold transition-all cursor-pointer ${
              activeMode === 'URL'
                ? 'bg-emerald-500 text-slate-950 font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Link
          </button>
        </div>
      </div>

      {/* Hidden canvas for snapshot rendering */}
      <canvas ref={canvasRef} className="hidden" />

      {/* PREVIEW OF CAPTURED FACE (if one is currently set) */}
      {capturedPreview && activeMode !== 'SAMPLES' && !isStreaming ? (
        <div className="relative flex items-center gap-3.5 p-3 rounded-2xl bg-white/5 border border-emerald-500/30">
          <div className="relative shrink-0">
            <img
              src={capturedPreview}
              alt={staffName}
              className="w-16 h-16 rounded-2xl object-cover border-2 border-emerald-400 shadow-xl"
            />
            <div className="absolute -bottom-1 -right-1 p-0.5 rounded-full bg-emerald-500 text-black">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-300">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Face Photo Attached</span>
            </div>
            <p className="text-[10px] text-slate-300 mt-0.5">
              Synced for entrance kiosk & mobile clock-in.
            </p>
            <div className="flex items-center gap-2 mt-1.5">
              <button
                type="button"
                onClick={() => {
                  setActiveMode('CAMERA');
                  startCamera();
                }}
                className="text-[10px] text-sky-400 hover:text-sky-300 font-semibold cursor-pointer flex items-center gap-1 underline"
              >
                <RefreshCw className="w-2.5 h-2.5" /> Retake Photo
              </button>
              <span className="text-slate-600">•</span>
              <button
                type="button"
                onClick={() => {
                  setCapturedPreview('');
                  onFaceCaptured('');
                }}
                className="text-[10px] text-rose-400 hover:text-rose-300 font-semibold cursor-pointer underline"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ============================================================== */}
      {/* MODE 1: LIVE WEBCAM CAPTURE                                   */}
      {/* ============================================================== */}
      {activeMode === 'CAMERA' && (!capturedPreview || isStreaming) && (
        <div className="space-y-2">
          <div className="relative w-full h-48 bg-slate-900 rounded-2xl overflow-hidden border border-white/20 flex items-center justify-center">
            {/* Video Element */}
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className="w-full h-full object-cover transform scale-x-[-1]"
            />

            {/* Biometric Scanning Overlay */}
            {isStreaming && (
              <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                <div className="w-24 h-32 rounded-[40px] border-2 border-emerald-400/80 shadow-[0_0_20px_rgba(16,185,129,0.3)] relative">
                  <div className="absolute top-2 left-2 w-2.5 h-2.5 border-t-2 border-l-2 border-emerald-400"></div>
                  <div className="absolute top-2 right-2 w-2.5 h-2.5 border-t-2 border-r-2 border-emerald-400"></div>
                  <div className="absolute bottom-2 left-2 w-2.5 h-2.5 border-b-2 border-l-2 border-emerald-400"></div>
                  <div className="absolute bottom-2 right-2 w-2.5 h-2.5 border-b-2 border-r-2 border-emerald-400"></div>
                </div>
                <span className="text-[10px] text-emerald-300 font-mono mt-1 bg-black/70 px-2 py-0.5 rounded-full">
                  Align face & click capture
                </span>
              </div>
            )}

            {/* Capture Control Button */}
            {isStreaming && (
              <div className="absolute bottom-2.5 inset-x-0 flex justify-center z-10">
                <button
                  type="button"
                  onClick={captureSnapshot}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-bold text-xs shadow-xl flex items-center gap-1.5 hover:brightness-110 active:scale-95 cursor-pointer transition-all"
                >
                  <Camera className="w-4 h-4" />
                  <span>Capture Face Snapshot</span>
                </button>
              </div>
            )}

            {/* Error or not streaming state */}
            {(!isStreaming || cameraError) && (
              <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center p-4 text-center">
                <AlertCircle className="w-6 h-6 text-amber-400 mb-1" />
                <p className="text-xs text-white font-semibold">{cameraError || 'Camera inactive'}</p>
                <p className="text-[10px] text-slate-400 mt-1 max-w-xs">
                  You can grant camera access or easily switch to "Upload" or "Presets" tab.
                </p>
                <div className="flex items-center gap-2 mt-3">
                  <button
                    type="button"
                    onClick={startCamera}
                    className="px-3 py-1.5 rounded-xl bg-emerald-500 text-slate-950 text-[11px] font-bold cursor-pointer"
                  >
                    Start Camera
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveMode('UPLOAD')}
                    className="px-3 py-1.5 rounded-xl bg-white/10 text-white text-[11px] font-semibold cursor-pointer"
                  >
                    Upload Photo
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveMode('SAMPLES')}
                    className="px-3 py-1.5 rounded-xl bg-white/10 text-sky-400 text-[11px] font-semibold cursor-pointer"
                  >
                    Choose Preset
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODE 2: FILE UPLOAD                                            */}
      {/* ============================================================== */}
      {activeMode === 'UPLOAD' && (
        <div className="space-y-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
          />

          <div
            onClick={() => fileInputRef.current?.click()}
            className="w-full py-5 border-2 border-dashed border-white/20 hover:border-emerald-400/60 rounded-2xl flex flex-col items-center justify-center p-3 cursor-pointer bg-slate-900/50 hover:bg-slate-900/80 transition-all text-center"
          >
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-1.5">
              <Upload className="w-4 h-4" />
            </div>
            <p className="text-xs font-semibold text-white">Click to Select Staff Photo</p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Select portrait from your phone gallery or computer (JPG, PNG)
            </p>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODE 3: PRESET PORTRAITS                                       */}
      {/* ============================================================== */}
      {activeMode === 'SAMPLES' && (
        <div className="space-y-2">
          <p className="text-[10px] text-slate-400">
            Click any portrait to instantly apply as this staff member's face:
          </p>
          <div className="grid grid-cols-6 gap-2">
            {SAMPLE_PORTRAITS.map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelectSample(p.url)}
                className={`relative rounded-xl overflow-hidden aspect-square border-2 transition-all cursor-pointer ${
                  capturedPreview === p.url ? 'border-emerald-400 ring-2 ring-emerald-500/40' : 'border-white/10 hover:border-white/40'
                }`}
              >
                <img src={p.url} alt={p.label} className="w-full h-full object-cover" />
                {capturedPreview === p.url && (
                  <div className="absolute inset-0 bg-emerald-500/30 flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4 text-white" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODE 4: DIRECT IMAGE URL                                       */}
      {/* ============================================================== */}
      {activeMode === 'URL' && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="https://example.com/employee-photo.jpg"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              className="flex-1 bg-slate-900 border border-white/15 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 font-mono text-ellipsis"
            />
            <button
              type="button"
              onClick={handleUrlSubmit}
              className="px-3 py-2 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs cursor-pointer shadow-md"
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

