import React, { useState } from 'react';
import { Wifi, WifiOff, RefreshCw, CheckCircle2, Cloud, CloudOff, AlertCircle } from 'lucide-react';
import { useNetworkSync } from '../services/offlineSync';

interface NetworkSyncBadgeProps {
  compact?: boolean;
  className?: string;
  showDetails?: boolean;
}

export const NetworkSyncBadge: React.FC<NetworkSyncBadgeProps> = ({
  compact = false,
  className = '',
  showDetails = true,
}) => {
  const { isOnline, isSyncing, pendingCount, lastSyncTime, triggerSync } = useNetworkSync();
  const [showTooltip, setShowTooltip] = useState(false);

  const handleManualSync = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isOnline && !isSyncing) {
      await triggerSync();
    }
  };

  return (
    <div className={`relative inline-flex items-center ${className}`}>
      <button
        type="button"
        onClick={() => setShowTooltip(!showTooltip)}
        className={`flex items-center gap-1.5 rounded-full transition-all cursor-pointer select-none ${
          compact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]'
        } font-semibold ${
          isSyncing
            ? 'bg-sky-500/15 border border-sky-500/30 text-sky-300'
            : !isOnline
            ? 'bg-amber-500/20 border border-amber-500/40 text-amber-300 shadow-sm'
            : pendingCount > 0
            ? 'bg-amber-500/15 border border-amber-500/30 text-amber-300'
            : 'bg-emerald-500/10 border border-emerald-500/25 text-emerald-400'
        }`}
        title="Network & Offline Cloud Sync Status"
      >
        {isSyncing ? (
          <>
            <RefreshCw className="w-3 h-3 animate-spin text-sky-400" />
            <span>{compact ? 'Syncing' : `Syncing ${pendingCount > 0 ? `(${pendingCount})` : ''}`}</span>
          </>
        ) : !isOnline ? (
          <>
            <CloudOff className="w-3 h-3 text-amber-400 shrink-0" />
            <span>
              {compact
                ? `Offline${pendingCount > 0 ? ` (${pendingCount})` : ''}`
                : `Offline Mode ${pendingCount > 0 ? `• ${pendingCount} Queued` : '• 100% Ready'}`}
            </span>
          </>
        ) : pendingCount > 0 ? (
          <>
            <RefreshCw className="w-3 h-3 text-amber-400 animate-spin" />
            <span>{compact ? `${pendingCount} Queued` : `${pendingCount} Pending Sync`}</span>
          </>
        ) : (
          <>
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400"></span>
            </span>
            <span>{compact ? 'Auto-Synced' : 'Automatic Live Sync'}</span>
          </>
        )}
      </button>

      {/* Detail Tooltip Popover */}
      {showDetails && showTooltip && (
        <div
          className="absolute top-full mt-2 right-0 z-50 w-72 rounded-2xl p-3 bg-slate-900/95 border border-white/20 backdrop-blur-xl shadow-2xl text-left animate-scale-in"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10">
            <div className="flex items-center gap-1.5">
              {isOnline ? (
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
              ) : (
                <div className="w-2 h-2 rounded-full bg-amber-400" />
              )}
              <span className="text-xs font-bold text-white">
                {isOnline ? 'Internet Connected' : 'Offline Autonomy Mode'}
              </span>
            </div>
            <button
              onClick={() => setShowTooltip(false)}
              className="text-[10px] text-slate-400 hover:text-white px-1"
            >
              ✕
            </button>
          </div>

          <p className="text-[11px] text-slate-300 leading-relaxed">
            {!isOnline
              ? 'Your device is operating in autonomous offline mode. All face punches, PIN clockings, and leaves are saved locally and will auto-upload to the cloud as soon as connection is re-established.'
              : pendingCount > 0
              ? `Auto-sync in progress: ${pendingCount} operation(s) syncing to the cloud database automatically.`
              : 'Continuous automatic sync active. All store rosters, face punches, attendance logs, and leave requests synchronize across all kiosks, phones, and admin portals automatically.'}
          </p>

          <div className="mt-3 pt-2 border-t border-white/10 flex items-center justify-between text-[10px] text-slate-400">
            <span className="flex items-center gap-1 text-emerald-400 font-medium">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              100% Automatic Data Sync
            </span>
            {isOnline && (
              <button
                disabled={isSyncing}
                onClick={handleManualSync}
                className="px-2 py-0.5 rounded-md bg-white/10 hover:bg-white/20 text-slate-300 text-[10px] cursor-pointer flex items-center gap-1 transition-all disabled:opacity-50"
                title="Force connection test"
              >
                <RefreshCw className={`w-2.5 h-2.5 ${isSyncing ? 'animate-spin text-emerald-400' : ''}`} />
                <span>{isSyncing ? 'Syncing...' : 'Check Cloud'}</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
