import React from 'react';
import { Play, Square, RotateCw, Key, AlertCircle, Shield, Download } from 'lucide-react';
import { ActivityLogEntry } from '../types';

interface ActivityLogCardProps {
  logs: ActivityLogEntry[];
}

export const ActivityLogCard: React.FC<ActivityLogCardProps> = ({ logs }) => {
  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;

      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'START':
        return <Play className="w-3 h-3 text-emerald-400" />;
      case 'STOP':
        return <Square className="w-3 h-3 text-rose-400" />;
      case 'RESTART':
        return <RotateCw className="w-3 h-3 text-amber-400" />;
      case 'LOGIN':
        return <Key className="w-3 h-3 text-blue-400" />;
      case 'BACKUP_DOWNLOAD':
        return <Download className="w-3 h-3 text-cyan-400" />;
      default:
        return <AlertCircle className="w-3 h-3 text-neutral-400" />;
    }
  };

  return (
    <div className="carbon-panel rounded-2xl p-6 border border-white/[0.08] space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
        <div>
          <h2 className="text-base font-bold text-white tracking-tight">Audit Stream</h2>
          <p className="text-xs text-neutral-400 mt-0.5">Flight recorder of all control events</p>
        </div>

        <div className="text-[11px] font-mono text-neutral-400">
          LAST {logs.length} ENTRIES
        </div>
      </div>

      {logs.length === 0 ? (
        <div className="p-8 text-center text-xs font-mono text-neutral-400 italic">
          No audit entries recorded in KV.
        </div>
      ) : (
        <div className="divide-y divide-white/[0.03] max-h-72 overflow-y-auto pr-1 font-mono">
          {logs.map((entry) => (
            <div
              key={entry.id}
              className="py-2.5 flex items-center justify-between gap-3 text-xs"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-1 rounded bg-black/60 border border-white/[0.06] shrink-0">
                  {getActionIcon(entry.action)}
                </div>

                <div className="min-w-0 flex items-center gap-2">
                  <span className="font-semibold text-neutral-200">
                    {entry.action}
                  </span>
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold ${
                      entry.result === 'SUCCESS'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    }`}
                  >
                    {entry.result}
                  </span>
                  <span className="text-[11px] text-neutral-400 truncate">
                    #{entry.actor}
                  </span>
                </div>
              </div>

              <div className="shrink-0 text-right text-[11px] text-neutral-400 tabular-nums">
                {formatTime(entry.timestamp)}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 text-[11px] font-mono text-neutral-400 pt-1">
        <Shield className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
        <span>Origin IPs are SHA-256 masked for privacy and security.</span>
      </div>
    </div>
  );
};
