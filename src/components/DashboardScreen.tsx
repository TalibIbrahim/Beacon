import React, { useCallback, useEffect, useRef, useState } from 'react';
import { LogOut, Play, RefreshCw, RotateCw, Square } from 'lucide-react';
import { ApiError, getStatus, logout, sendPowerAction } from '../api';
import { getFinding, getPhase, isTransitional, Phase } from '../serverState';
import { PowerAction, StatusResponse, ToastMessage } from '../types';
import { ActivityLogCard } from './ActivityLogCard';
import { AppMark } from './AppMark';
import { BackupCard } from './BackupCard';
import { BackupsCard } from './BackupsCard';
import { HealthCard } from './HealthCard';
import { LeaderboardCard } from './LeaderboardCard';
import { PlayersCard } from './PlayersCard';
import { SkeletonLoader } from './SkeletonLoader';
import { StatusPanel } from './StatusPanel';
import { StopConfirmModal } from './StopConfirmModal';
import { SettingsMenu } from './SettingsMenu';
import { ThemeToggle } from './ThemeToggle';
import { ToastContainer } from './Toast';
import { UsageCard } from './UsageCard';

interface DashboardScreenProps {
  onLogout: () => void;
}

const POLL_FAST_MS = 4000; // while the VM is starting or stopping
const POLL_BACKUP_MS = 5000; // while a "Backup now" is requested or running
const POLL_SLOW_MS = 10000;
const COOLDOWN_SECONDS = 30;

// "Updated 8s ago", ticking on its own so the rest of the screen does not re-render every second
const Freshness: React.FC<{ updatedAt: number | null; failed: boolean }> = ({ updatedAt, failed }) => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!updatedAt) return null;
  const s = Math.max(0, Math.round((now - updatedAt) / 1000));
  const ago = s < 5 ? 'just now' : s < 60 ? `${s}s ago` : `${Math.floor(s / 60)}m ago`;
  return (
    <span className={`num text-sm ${failed ? 'text-negative' : 'text-faint'}`}>
      {failed ? `Couldn't refresh · last good ${ago}` : `Updated ${ago}`}
    </span>
  );
};

interface PowerControlsProps {
  phase: Phase;
  // A restore is copying the world onto the VM: the server refuses power actions until it is done
  restoring: boolean;
  cooldown: number;
  loadingAction: PowerAction | null;
  onAction: (action: PowerAction) => void;
}

const PowerControls: React.FC<PowerControlsProps> = ({ phase, restoring, cooldown, loadingAction, onAction }) => {
  const busy = loadingAction !== null;
  const blocked = busy || cooldown > 0 || restoring;
  const vmUp = phase === 'online' || phase === 'loading';

  const note = restoring
    ? 'Restore in progress'
    : cooldown > 0
      ? `Next action in ${cooldown}s`
      : phase === 'booting' || phase === 'loading'
      ? 'Starting up…'
      : phase === 'stopping'
      ? 'Shutting down…'
      : null;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 sm:justify-end">
      {note && <span className="num text-sm text-muted w-full sm:w-auto order-last sm:order-first">{note}</span>}
      {vmUp ? (
        <>
          <button type="button" className="btn-secondary flex-1 sm:flex-none" disabled={blocked} onClick={() => onAction('restart')}>
            <RotateCw className={`w-4 h-4 ${loadingAction === 'restart' ? 'animate-spin' : ''}`} aria-hidden="true" />
            Restart
          </button>
          <button type="button" className="btn-danger flex-1 sm:flex-none" disabled={blocked} onClick={() => onAction('stop')}>
            <Square className="w-3.5 h-3.5" aria-hidden="true" />
            Stop server
          </button>
        </>
      ) : (
        <button
          type="button"
          className="btn-primary flex-1 sm:flex-none"
          disabled={blocked || phase !== 'off'}
          onClick={() => onAction('start')}
        >
          {loadingAction === 'start' ? (
            <RefreshCw className="w-4 h-4 animate-spin" aria-hidden="true" />
          ) : (
            <Play className="w-4 h-4" aria-hidden="true" />
          )}
          Start server
        </button>
      )}
    </div>
  );
};

export const DashboardScreen: React.FC<DashboardScreenProps> = ({ onLogout }) => {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [cooldown, setCooldown] = useState(0);
  const [loadingAction, setLoadingAction] = useState<PowerAction | null>(null);
  const [modal, setModal] = useState<{ isOpen: boolean; action: 'stop' | 'restart'; playerCount: number }>({
    isOpen: false,
    action: 'stop',
    playerCount: 0,
  });

  const addToast = useCallback((type: ToastMessage['type'], text: string) => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, type, text }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 5000);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const fetchStatus = useCallback(
    async (manual = false) => {
      if (manual) setRefreshing(true);
      try {
        const data = await getStatus();
        setStatus(data);
        setError(null);
        setUpdatedAt(Date.now());
        if (data.powerCooldownSeconds && data.powerCooldownSeconds > 0) {
          setCooldown(data.powerCooldownSeconds);
        }
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          onLogout();
          return;
        }
        setError(err instanceof Error ? err.message : 'Failed to load the server status.');
      } finally {
        setLoading(false);
        if (manual) setRefreshing(false);
      }
    },
    [onLogout]
  );

  // Poll: fast while the VM is changing state or a backup is under way, slower otherwise, paused
  // while the tab is hidden
  const phase: Phase | null = status ? getPhase(status) : null;
  const backupState = status?.backupJob?.request?.state;
  const restoreState = status?.backupJob?.restore?.state;
  const restoring = restoreState === 'pending' || restoreState === 'running';
  const pollMsRef = useRef(POLL_SLOW_MS);
  pollMsRef.current =
    phase !== null && isTransitional(phase)
      ? POLL_FAST_MS
      : backupState === 'pending' || backupState === 'running' || restoring
      ? POLL_BACKUP_MS
      : POLL_SLOW_MS;

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    const loop = async () => {
      if (document.visibilityState === 'visible') await fetchStatus();
      if (!cancelled) timer = setTimeout(loop, pollMsRef.current);
    };

    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      clearTimeout(timer);
      loop();
    };

    loop();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [fetchStatus]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  const executePowerAction = async (action: PowerAction, force: boolean) => {
    setLoadingAction(action);
    try {
      await sendPowerAction(action, force);
      const done = { start: 'Start sent. The world should be up in about 2 minutes.', stop: 'Stop sent.', restart: 'Restart sent.' };
      addToast('success', done[action]);
      setCooldown(COOLDOWN_SECONDS);
      setModal((m) => ({ ...m, isOpen: false }));
      await fetchStatus();
    } catch (err) {
      if (err instanceof ApiError && err.requiresForce && action !== 'start') {
        // Someone joined since the dialog opened: ask again with the real count
        setModal({ isOpen: true, action, playerCount: err.playerCount ?? Math.max(1, status?.players.online ?? 1) });
        addToast('error', err.message);
      } else {
        addToast('error', err instanceof Error ? err.message : `Could not ${action} the server.`);
      }
    } finally {
      setLoadingAction(null);
    }
  };

  const handleAction = (action: PowerAction) => {
    if (action === 'start') {
      executePowerAction('start', false);
      return;
    }
    setModal({ isOpen: true, action, playerCount: status?.minecraftState === 'Online' ? status.players.online : 0 });
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      // the cookie expires on its own
    }
    onLogout();
  };

  const closeModal = useCallback(() => setModal((m) => ({ ...m, isOpen: false })), []);

  return (
    <div className="min-h-screen flex flex-col">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <StopConfirmModal
        isOpen={modal.isOpen}
        action={modal.action}
        playerCount={modal.playerCount}
        loading={loadingAction !== null}
        onConfirm={(force) => executePowerAction(modal.action, force)}
        onClose={closeModal}
      />

      <header className="sticky top-0 z-40 bg-[var(--ground-top)] pt-[env(safe-area-inset-top)]">
        <div className="max-w-[1152px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <AppMark />
            <span className="font-display font-semibold text-lg tracking-[0.02em]">Beacon</span>
            {status?.computeUsage && (
              <span className="hidden md:inline text-faint truncate">
                {status.region} · {status.computeUsage.shape}
              </span>
            )}
          </div>
          <div className="flex items-center gap-0.5 sm:gap-2">
            <span className="hidden sm:inline mr-1">
              <Freshness updatedAt={updatedAt} failed={Boolean(error && status)} />
            </span>
            <ThemeToggle />
            <SettingsMenu />
            <button
              type="button"
              onClick={() => fetchStatus(true)}
              disabled={refreshing}
              className="btn-ghost"
              aria-label="Refresh now"
              title="Refresh now"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
            </button>
            <button type="button" onClick={handleLogout} className="btn-ghost">
              <LogOut className="w-4 h-4" aria-hidden="true" />
              <span>Sign out</span>
            </button>
          </div>
        </div>
        {/* The ground line: a strip of grass over dirt */}
        <div className="h-[7px] bg-grass border-b-2 border-edge shadow-[inset_0_-3px_0_var(--dirt)]" aria-hidden="true" />
      </header>

      <main className="max-w-[1152px] w-full mx-auto px-4 sm:px-6 pt-8 pb-16 flex-1">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-7">
          <div className="min-w-0">
            <h1 className="font-display font-semibold text-[30px] leading-9 tracking-[0.01em]">Minecraft server</h1>
            <p className="mt-1.5 text-muted num">
              {status ? getFinding(status) : error ? 'Status unavailable.' : 'Checking the server…'}
            </p>
          </div>
          {status && phase && phase !== 'unknown' && (
            <PowerControls phase={phase} restoring={restoring} cooldown={cooldown} loadingAction={loadingAction} onAction={handleAction} />
          )}
        </div>

        {error && !status && !loading ? (
          <div className="panel p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p>
              <span className="inline-block w-2 h-2 rounded-[2px] bg-negative mr-2.5 align-middle" aria-hidden="true" />
              Couldn't load the server status. {error}
            </p>
            <button type="button" onClick={() => fetchStatus(true)} className="btn-secondary self-start sm:self-auto">
              Retry
            </button>
          </div>
        ) : loading || !status || !phase ? (
          <SkeletonLoader />
        ) : (
          // One column on phones (status, health, players, leaderboard, save, backups, cost, activity); two from lg up.
          // 1152 canvas - 48 padding = 1104 = 720 main + 24 gap + 360 rail
          <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
            <div className="contents lg:flex lg:flex-col lg:gap-6">
              <div className="order-1 lg:order-none">
                <StatusPanel status={status} onToast={addToast} />
              </div>
              <div className="order-2 lg:order-none">
                <HealthCard health={status.health} />
              </div>
              <div className="order-5 lg:order-none">
                <BackupCard backupInfo={status.backupInfo} onToast={addToast} />
              </div>
              <div className="order-6 lg:order-none">
                <BackupsCard job={status.backupJob} onRequested={fetchStatus} onToast={addToast} />
              </div>
              <div className="order-7 lg:order-none">
                <UsageCard usage={status.computeUsage} trialDaysLeft={status.trialDaysLeft} region={status.region} />
              </div>
            </div>
            <div className="contents lg:flex lg:flex-col lg:gap-6">
              <div className="order-3 lg:order-none">
                <PlayersCard players={status.players} phase={phase} />
              </div>
              <div className="order-4 lg:order-none">
                <LeaderboardCard entries={status.leaderboard} />
              </div>
              <div className="order-8 lg:order-none">
                <ActivityLogCard logs={status.recentLog} />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
