import React, { useEffect, useState } from 'react';
import { Cloud, CloudOff, RefreshCw, AlertCircle, CheckCircle2, Server } from 'lucide-react';
import { syncEngine, SyncEngineStatus } from '../../utils/syncEngine';

interface SyncIndicatorProps {
  onOpenSettings?: () => void;
}

export const SyncIndicator: React.FC<SyncIndicatorProps> = ({ onOpenSettings }) => {
  const [status, setStatus] = useState<SyncEngineStatus>({
    state: typeof navigator !== 'undefined' && navigator.onLine ? 'ONLINE' : 'OFFLINE',
    pendingCount: 0,
    lastSyncedAt: null,
    errorMessage: null,
  });
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    const unsubscribe = syncEngine.subscribe((s) => setStatus(s));
    syncEngine.start();
    return () => {
      unsubscribe();
      syncEngine.stop();
    };
  }, []);

  const handleManualSync = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsManualSyncing(true);
    await syncEngine.syncNow();
    setIsManualSyncing(false);
  };

  const getStatusBadge = () => {
    if (status.state === 'OFFLINE') {
      return {
        bg: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
        icon: <CloudOff className="w-3.5 h-3.5 animate-pulse" />,
        label: status.pendingCount > 0 ? `Offline (${status.pendingCount} antrean)` : 'Offline Lokal',
        dot: 'bg-amber-500',
      };
    }
    if (status.state === 'SYNCING' || isManualSyncing) {
      return {
        bg: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
        icon: <RefreshCw className="w-3.5 h-3.5 animate-spin" />,
        label: 'Menyinkronkan...',
        dot: 'bg-blue-500 animate-ping',
      };
    }
    if (status.state === 'ERROR') {
      return {
        bg: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
        icon: <AlertCircle className="w-3.5 h-3.5" />,
        label: status.pendingCount > 0 ? `Tertunda (${status.pendingCount})` : 'Sinkron Tertunda',
        dot: 'bg-rose-500',
      };
    }
    // ONLINE
    if (status.pendingCount > 0) {
      return {
        bg: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
        icon: <Cloud className="w-3.5 h-3.5" />,
        label: `${status.pendingCount} Menunggu Sync`,
        dot: 'bg-blue-500',
      };
    }
    return {
      bg: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
      icon: <CheckCircle2 className="w-3.5 h-3.5" />,
      label: 'Tersinkron',
      dot: 'bg-emerald-500',
    };
  };

  const badge = getStatusBadge();

  return (
    <div className="relative inline-block text-xs font-medium">
      <div
        onClick={() => setShowTooltip(!showTooltip)}
        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border cursor-pointer select-none transition-all hover:bg-opacity-20 ${badge.bg}`}
        title="Klik untuk melihat detail sinkronisasi cloud"
      >
        <span className="relative flex h-2 w-2">
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${badge.dot}`} />
          <span className={`relative inline-flex rounded-full h-2 w-2 ${badge.dot}`} />
        </span>
        <span className="flex items-center gap-1">
          {badge.icon}
          <span className="hidden sm:inline">{badge.label}</span>
        </span>

        <button
          onClick={handleManualSync}
          disabled={status.state === 'OFFLINE' || isManualSyncing}
          className="ml-1 p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-30 transition-colors"
          title="Sinkronkan Sekarang"
        >
          <RefreshCw className={`w-3 h-3 ${isManualSyncing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {showTooltip && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute right-0 mt-2 w-72 p-3 bg-zinc-900 border border-zinc-700 text-zinc-200 rounded-xl shadow-2xl z-50 text-xs space-y-2 animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
            <div className="flex items-center gap-1.5 font-semibold text-zinc-100">
              <Server className="w-4 h-4 text-emerald-400" />
              <span>Status Cloud Sync</span>
            </div>
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                status.state === 'ONLINE' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
              }`}
            >
              {status.state}
            </span>
          </div>

          <div className="space-y-1.5 text-zinc-300">
            <div className="flex justify-between">
              <span className="text-zinc-400">Antrean Outbox:</span>
              <span className="font-semibold text-zinc-100">{status.pendingCount} mutasi lokal</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Terakhir Sync:</span>
              <span className="text-zinc-300 font-mono text-[11px]">
                {status.lastSyncedAt
                  ? new Date(status.lastSyncedAt).toLocaleTimeString('id-ID', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })
                  : 'Belum pernah'}
              </span>
            </div>
            {status.errorMessage && (
              <div className="p-2 rounded bg-rose-500/10 border border-rose-500/30 text-rose-300 text-[11px] leading-tight">
                {status.errorMessage}
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-zinc-800 flex items-center justify-between">
            <button
              onClick={handleManualSync}
              disabled={status.state === 'OFFLINE' || isManualSyncing}
              className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-lg font-medium text-[11px] flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw className={`w-3 h-3 ${isManualSyncing ? 'animate-spin' : ''}`} />
              Sinkron Sekarang
            </button>
            {onOpenSettings && (
              <button
                onClick={() => {
                  setShowTooltip(false);
                  onOpenSettings();
                }}
                className="text-zinc-400 hover:text-zinc-200 underline text-[11px]"
              >
                Pengaturan
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
