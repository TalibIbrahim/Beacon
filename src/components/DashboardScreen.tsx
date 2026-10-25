import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  RefreshCw,
  LogOut,
  AlertTriangle,
  Radio,
} from 'lucide-react';
import { ApiError, getStatus, logout, sendPowerAction } from '../api';
import { StatusResponse, ToastMessage } from '../types';
import { ActivityLogCard } from './ActivityLogCard';
import { BackupCard } from './BackupCard';
import { ControlsCard } from './ControlsCard';
import { PlayersCard } from './PlayersCard';
import { ServerStatusCard } from './ServerStatusCard';
import { SkeletonLoader } from './SkeletonLoader';
import { StopConfirmModal } from './StopConfirmModal';
import { ToastContainer } from './Toast';
import { TrialBanner } from './TrialBanner';
import { UsageCard } from './UsageCard';

interface DashboardScreenProps {
  onLogout: () => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({ onLogout }) => {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const [cooldown, setCooldown] = useState<number>(0);
  const [loadingAction, setLoadingAction] = useState<'start' | 'stop' | 'restart' | null>(null);

  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    action: 'stop' | 'restart';
    playerCount: number;
  }>({
    isOpen: false,
    action: 'stop',
    playerCount: 0,
  });

  const addToast = useCallback((type: 'success' | 'error' | 'info', text: string) => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, type, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const fetchStatus = useCallback(
    async (showLoadingSpinner = false) => {
      if (showLoadingSpinner) setRefreshing(true);
      try {
        const data = await getStatus();
        setStatus(data);
        setError(null);
        if (data.powerCooldownSeconds && data.powerCooldownSeconds > 0) {
          setCooldown(data.powerCooldownSeconds);
        }
      } catch (err) {
        if (err instanceof ApiError) {
          if (err.status === 401) {
            onLogout();
            return;
          }
          setError(err.message);
        } else {
          setError('Failed to refresh server status.');
        }
      } finally {
        setLoading(false);
        if (showLoadingSpinner) setRefreshing(false);
      }
    },
    [onLogout]
  );

  useEffect(() => {
    fetchStatus(false);
  }, [fetchStatus]);

  const timerRef = useRef<any>(null);

  useEffect(() => {
    const isFastPolling =
      status?.vmState === 'STARTING' || status?.vmState === 'STOPPING';
    const intervalMs = isFastPolling ? 4000 : 10000;

    const schedule = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (document.visibilityState === 'hidden') return;

      timerRef.current = setTimeout(async () => {
        if (document.visibilityState === 'visible') {
          await fetchStatus(false);
        }
      }, intervalMs);
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchStatus(false);
        schedule();
      } else {
        if (timerRef.current) clearTimeout(timerRef.current);
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    schedule();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [status?.vmState, fetchStatus]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const interval = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldown]);

  const handleActionClick = (action: 'start' | 'stop' | 'restart') => {
    if (action === 'start') {
      executePowerAction('start', false);
    } else {
      setModalState({
        isOpen: true,
        action,
        playerCount: status?.players.online || 0,
      });
    }
  };

  const executePowerAction = async (
    action: 'start' | 'stop' | 'restart',
    force: boolean
  ) => {
    setLoadingAction(action);
    try {
      const res = await sendPowerAction(action, force);
      addToast(
        'success',
        res.message || `Successfully sent ${action} command.`
      );
      setCooldown(30);
      setModalState((prev) => ({ ...prev, isOpen: false }));
      await fetchStatus(true);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.requiresForce) {
          setModalState({
            isOpen: true,
            action: action === 'start' ? 'stop' : action,
            playerCount: status?.players.online || 1,
          });
        }
        addToast('error', err.message);
      } else {
        addToast('error', `Failed to execute ${action} command.`);
      }
    } finally {
      setLoadingAction(null);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      // ignore
    }
    onLogout();
  };

  return (
    <div className="min-h-screen bg-background text-neutral-100 flex flex-col pb-20 select-none">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <StopConfirmModal
        isOpen={modalState.isOpen}
        action={modalState.action}
        playerCount={modalState.playerCount}
        loading={loadingAction !== null}
        onConfirm={(force) => executePowerAction(modalState.action, force)}
        onClose={() => setModalState((prev) => ({ ...prev, isOpen: false }))}
      />

      {/* Navigation Topbar */}
      <header className="sticky top-0 z-40 bg-black/60 border-b border-white/[0.08] backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          {/* Logo & Identity */}
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-neutral-900 border border-white/10 flex items-center justify-center">
              <Radio className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm tracking-tight text-white font-mono">BEACON</span>
              <span className="text-neutral-600 font-mono text-xs">/</span>
              <span className="text-xs font-mono text-neutral-400">CONTROL</span>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-mono text-emerald-300">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.9)]" />
              <span>ONLINE</span>
            </div>
          </div>

          {/* Controls & Session */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => fetchStatus(true)}
              disabled={refreshing}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/[0.06] active:scale-95 transition-all border border-transparent hover:border-white/[0.08]"
              title="Manual sync"
              aria-label="Manual sync"
            >
              <RefreshCw
                className={`w-4 h-4 ${refreshing ? 'animate-spin text-emerald-400' : ''}`}
              />
            </button>

            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono font-medium text-neutral-400 hover:text-rose-400 hover:bg-rose-500/10 active:scale-95 transition-all border border-transparent hover:border-rose-500/20"
              title="Disconnect"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">DISCONNECT</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 flex-1 w-full space-y-6">
        {error && (
          <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs font-mono flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={() => fetchStatus(true)}
              className="px-2.5 py-1 rounded-md bg-rose-500/20 hover:bg-rose-500/30 font-semibold text-rose-200 text-xs transition-colors"
            >
              RETRY
            </button>
          </div>
        )}

        {loading ? (
          <SkeletonLoader />
        ) : status ? (
          <>
            <TrialBanner daysLeft={status.trialDaysLeft} />

            <ServerStatusCard
              vmState={status.vmState}
              minecraftState={status.minecraftState}
              address={status.address}
              onlineSince={status.onlineSince}
            />

            <ControlsCard
              vmState={status.vmState}
              cooldownSeconds={cooldown}
              loadingAction={loadingAction}
              onActionClick={handleActionClick}
            />

            <UsageCard
              usage={status.computeUsage}
              trialDaysLeft={status.trialDaysLeft}
            />

            <BackupCard
              backupInfo={status.backupInfo}
              onToast={addToast}
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <PlayersCard
                players={status.players}
                version={status.version}
                motd={status.motd}
                isOnline={status.minecraftState === 'Online'}
              />

              <ActivityLogCard logs={status.recentLog} />
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
};
