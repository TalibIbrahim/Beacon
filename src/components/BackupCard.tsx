import React, { useState } from 'react';
import {
  Download,
  Archive,
  Terminal,
  Loader2,
  ChevronDown,
  ChevronUp,
  HardDrive,
} from 'lucide-react';
import { downloadBackup } from '../api';
import { BackupInfo } from '../types';

interface BackupCardProps {
  backupInfo?: BackupInfo;
  onToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

export const BackupCard: React.FC<BackupCardProps> = ({ backupInfo, onToast }) => {
  const [downloading, setDownloading] = useState(false);
  const [showCommands, setShowCommands] = useState(false);

  const isAvailable = Boolean(backupInfo?.available);
  const sizeFormatted = backupInfo?.sizeBytes
    ? `${(backupInfo.sizeBytes / (1024 * 1024)).toFixed(1)} MB`
    : 'Unknown size';

  const formatTimestamp = (iso?: string) => {
    if (!iso) return 'Not available';
    try {
      const date = new Date(iso);
      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short',
      });
    } catch {
      return iso;
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    onToast('info', 'Preparing snapshot download...');
    try {
      await downloadBackup();
      onToast('success', 'World save snapshot downloaded successfully.');
    } catch (err: any) {
      onToast('error', err?.message || 'Failed to download world snapshot.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="carbon-panel rounded-2xl p-6 border border-white/[0.08] space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-white/[0.06] gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-white tracking-tight">World Archive & Migration</h2>
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-[10px] font-mono text-neutral-300">
              <Archive className="w-3 h-3 text-cyan-400" />
              <span>ORACLE CLOUD</span>
            </div>
          </div>
          <p className="text-xs text-neutral-400 mt-1">
            Off-server save snapshots for safe migration to Oracle Always Free Ampere (A1.Flex)
          </p>
        </div>

        {/* Optic status pill */}
        <div className="flex items-center gap-2 self-start sm:self-center">
          {isAvailable ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-mono font-medium text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.9)] animate-pulse" />
              <span>SNAPSHOT READY</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-xs font-mono font-medium text-amber-400">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.9)]" />
              <span>AWAITING SNAPSHOT</span>
            </div>
          )}
        </div>
      </div>

      {/* Grid: Details & Download Action */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Technical specs block */}
        <div className="md:col-span-2 p-4 rounded-xl bg-black/40 border border-white/[0.05] space-y-3 font-mono text-xs">
          <div className="flex items-center justify-between text-neutral-400 pb-2 border-b border-white/[0.04]">
            <span className="flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-neutral-500" />
              ARCHIVE CONTENTS
            </span>
            <span className="text-neutral-200">world, nether, end, server.props</span>
          </div>

          <div className="flex items-center justify-between text-neutral-400 pb-2 border-b border-white/[0.04]">
            <span>LATEST SNAPSHOT</span>
            <span className="text-neutral-200 tabular-nums">
              {formatTimestamp(backupInfo?.lastModified)}
            </span>
          </div>

          <div className="flex items-center justify-between text-neutral-400">
            <span>UNCOMPRESSED SIZE</span>
            <span className="text-neutral-200 font-semibold tabular-nums">
              {isAvailable ? sizeFormatted : 'No archive in bucket yet'}
            </span>
          </div>
        </div>

        {/* Primary Download Button */}
        <div className="flex flex-col justify-center">
          <button
            onClick={handleDownload}
            disabled={!isAvailable || downloading}
            className={`w-full py-4 px-4 rounded-xl font-mono text-xs font-bold tracking-wider uppercase transition-all duration-200 flex flex-col items-center justify-center gap-2 border ${
              isAvailable
                ? 'bg-gradient-to-b from-cyan-500/20 to-cyan-500/10 text-cyan-200 border-cyan-500/30 hover:border-cyan-400 hover:from-cyan-500/30 hover:to-cyan-500/20 hover:text-white shadow-[0_0_20px_rgba(6,182,212,0.15)] active:scale-[0.98]'
                : 'bg-white/[0.02] text-neutral-500 border-white/[0.05] cursor-not-allowed'
            }`}
          >
            {downloading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
                <span>DOWNLOADING...</span>
              </>
            ) : (
              <>
                <Download className={`w-5 h-5 ${isAvailable ? 'text-cyan-400' : 'text-neutral-600'}`} />
                <span>DOWNLOAD SAVE (.TAR.GZ)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Migration / Server restore drawer */}
      <div className="pt-2">
        <button
          onClick={() => setShowCommands(!showCommands)}
          className="w-full py-2 px-3 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.05] text-[11px] font-mono text-neutral-400 hover:text-neutral-200 flex items-center justify-between transition-colors"
        >
          <div className="flex items-center gap-2">
            <Terminal className="w-3.5 h-3.5 text-neutral-500" />
            <span>HOW TO SYNC FROM VM & RESTORE ON NEW SERVER</span>
          </div>
          {showCommands ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        {showCommands && (
          <div className="mt-3 p-4 rounded-xl bg-black/70 border border-white/[0.08] font-mono text-xs text-neutral-300 space-y-3">
            <div>
              <p className="text-[11px] text-neutral-400 mb-1.5 font-bold uppercase tracking-wider text-cyan-400">
                1. Direct Server Download (Zero setup, 100% Free):
              </p>
              <pre className="p-2.5 rounded bg-neutral-950 border border-white/[0.06] text-emerald-400 overflow-x-auto text-[11px]">
{`# On your server, zip the world into world-latest.tar.gz:
tar -czf world-latest.tar.gz world world_nether world_the_end server.properties
# Run a lightweight local download server on port 8080:
python3 -m http.server 8080`}
              </pre>
            </div>

            <div>
              <p className="text-[11px] text-neutral-400 mb-1.5 font-bold uppercase tracking-wider text-cyan-400">
                2. Restore on new server (Ampere A1.Flex):
              </p>
              <pre className="p-2.5 rounded bg-neutral-950 border border-white/[0.06] text-neutral-300 overflow-x-auto text-[11px]">
{`# Extract downloaded save into your new Minecraft directory:
tar -xzf world-latest.tar.gz
# Start your new Minecraft server and continue playing`}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
