import React, { useEffect, useRef, useState } from 'react';
import { DatabaseBackup, Loader2 } from 'lucide-react';
import { ApiError, requestBackup } from '../api';
import { formatBytes, formatDate, formatRelative } from '../format';
import { BackupJobInfo } from '../types';

interface BackupsCardProps {
  job?: BackupJobInfo;
  onRequested: () => void;
  onToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

// A "Backup now" result stays on the card for an hour, then the card goes back to the schedule
const RESULT_VISIBLE_MS = 60 * 60 * 1000;

type Tone = 'positive' | 'negative' | 'warning' | 'muted';

const TONE_TEXT: Record<Tone, string> = {
  positive: 'text-positive',
  negative: 'text-negative',
  warning: 'text-warning',
  muted: 'text-muted',
};

const TONE_DOT: Record<Tone, string> = {
  positive: 'bg-positive',
  negative: 'bg-negative',
  warning: 'bg-warning',
  muted: 'bg-faint',
};

const TONE_PILL: Record<Tone, string> = {
  positive: 'bg-pill-positive text-positive',
  negative: 'bg-pill-negative text-negative',
  warning: 'bg-pill-warning text-warning',
  muted: 'bg-raised text-muted',
};

const Dash = () => <span className="text-faint">—</span>;

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const EMPTY_JOB: BackupJobInfo = {
  configured: false,
  agent: { lastSeen: null, responding: false, busy: false, cronActive: null, scheduleInstalled: null },
  lastBackupAt: null,
  lastBackupBytes: null,
  lastRun: null,
  request: null,
  cooldownSeconds: 0,
  overdue: false,
};

export const BackupsCard: React.FC<BackupsCardProps> = ({ job: jobProp, onRequested, onToast }) => {
  const job = jobProp ?? EMPTY_JOB;
  const { agent, request } = job;
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(job.cooldownSeconds);

  // The server's number is the truth; count down locally between polls
  useEffect(() => setCooldown(job.cooldownSeconds), [job.cooldownSeconds, request?.requestedAt]);
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  // Toast when a "Backup now" this tab has watched finishes
  const prev = useRef<{ requestedAt?: string; state?: string }>({});
  useEffect(() => {
    const was = prev.current;
    if (request && was.requestedAt === request.requestedAt && (was.state === 'pending' || was.state === 'running')) {
      if (request.state === 'done') onToast('success', 'Backup finished. The download has the fresh copy.');
      if (request.state === 'failed') onToast('error', `Backup failed: ${request.error ?? 'no reason given'}`);
    }
    prev.current = { requestedAt: request?.requestedAt, state: request?.state };
  }, [request?.requestedAt, request?.state, request?.error, onToast]);

  const active = request?.state === 'pending' || request?.state === 'running';
  const disabled = !job.configured || submitting || active || cooldown > 0;

  const handleRequest = async () => {
    setSubmitting(true);
    try {
      await requestBackup();
      onToast('success', 'Backup requested. arm-free picks it up within a minute.');
      onRequested();
    } catch (err) {
      if (err instanceof ApiError && err.retryAfter) setCooldown(err.retryAfter);
      onToast('error', err instanceof Error ? err.message : 'Could not request a backup.');
      if (err instanceof ApiError && err.status === 409) onRequested();
    } finally {
      setSubmitting(false);
    }
  };

  // Header pill: is the cron job on arm-free alive?
  const [pillTone, pillText]: [Tone, string] = !job.configured
    ? ['warning', 'Not set up']
    : agent.responding
    ? ['positive', 'Cron running']
    : agent.lastSeen
    ? ['negative', 'Not responding']
    : ['warning', 'Waiting for arm-free'];

  const cronValue = !job.configured ? (
    <span className="text-faint">Not set up</span>
  ) : !agent.lastSeen ? (
    <span className="text-warning">Never checked in</span>
  ) : (
    <span className="inline-flex items-center gap-2">
      <span className={`w-2 h-2 rounded-full ${agent.responding ? 'bg-positive' : 'bg-negative'}`} aria-hidden="true" />
      <span>
        {agent.responding ? 'Running' : 'Not responding'}{' '}
        <span className="text-faint num">· seen {formatRelative(agent.lastSeen)}</span>
      </span>
    </span>
  );

  const scheduleValue =
    agent.cronActive === false ? (
      <span className="text-negative">cron service stopped</span>
    ) : agent.scheduleInstalled === true ? (
      'Every 30 minutes'
    ) : agent.scheduleInstalled === false ? (
      <span className="text-warning">Not in crontab</span>
    ) : (
      <Dash />
    );

  const size = formatBytes(job.lastBackupBytes ?? undefined);

  const rows: Array<[string, React.ReactNode]> = [
    ['Backup cron', cronValue],
    [
      'Last backup',
      job.lastBackupAt ? (
        <span className={`num ${job.overdue ? 'text-warning' : ''}`}>
          {formatRelative(job.lastBackupAt)} <span className="text-faint">· {formatDate(job.lastBackupAt)}</span>
        </span>
      ) : (
        <Dash />
      ),
    ],
    ['Size', size ? <span className="num">{size}</span> : <Dash />],
    ['Schedule', scheduleValue],
  ];

  // One line under the button: the "Backup now" request first, then anything else worth knowing
  let line: { tone: Tone; text: string; spin?: boolean } | null = null;
  const recent = (iso?: string) => Boolean(iso && Date.now() - new Date(iso).getTime() < RESULT_VISIBLE_MS);
  if (request?.state === 'pending') {
    line = {
      tone: 'warning',
      text: agent.responding
        ? `Requested ${formatRelative(request.requestedAt)}. arm-free checks in every minute.`
        : 'Requested, but arm-free is not responding. It runs if arm-free checks in within 10 minutes.',
    };
  } else if (request?.state === 'running') {
    line = {
      tone: 'warning',
      spin: true,
      text: `Running since ${formatRelative(request.startedAt)}: pulling from Minecraft-Premium, then uploading.`,
    };
  } else if (request?.state === 'done' && recent(request.finishedAt)) {
    const doneSize = formatBytes(request.sizeBytes);
    line = { tone: 'positive', text: `Done ${formatRelative(request.finishedAt)}${doneSize ? ` · ${doneSize}` : ''}` };
  } else if (request?.state === 'failed' && recent(request.finishedAt ?? request.requestedAt)) {
    line = { tone: 'negative', text: `Failed: ${request.error ?? 'no reason given'}` };
  } else if (agent.busy) {
    line = { tone: 'muted', spin: true, text: 'A scheduled backup is running.' };
  } else if (job.lastRun && !job.lastRun.ok && job.lastRun.trigger === 'scheduled') {
    line = { tone: 'negative', text: `Last scheduled backup failed: ${job.lastRun.error ?? 'no reason given'}` };
  }

  const buttonLabel = submitting
    ? 'Requesting…'
    : request?.state === 'pending'
    ? 'Requested'
    : request?.state === 'running'
    ? 'Running…'
    : 'Backup now';
  const spinning = submitting || request?.state === 'running';

  return (
    <section className="panel" aria-labelledby="backups-heading">
      <header className="flex items-center justify-between gap-3 px-5 pt-4 pb-3">
        <h2 id="backups-heading" className="text-base font-semibold">
          Backups
        </h2>
        <span className={`h-6 px-2.5 inline-flex items-center rounded-full text-xs whitespace-nowrap ${TONE_PILL[pillTone]}`}>
          {pillText}
        </span>
      </header>

      <div className="px-5 pb-5 grid gap-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <dl className="min-w-0">
          {rows.map(([label, value]) => (
            <div key={label} className="flex items-baseline justify-between gap-4 h-9 border-t border-rule first:border-t-0">
              <dt className="text-muted shrink-0">{label}</dt>
              <dd className="truncate text-right">{value}</dd>
            </div>
          ))}
        </dl>

        <div className="flex flex-col gap-1.5 sm:items-end">
          <button type="button" className="btn-secondary" disabled={disabled} onClick={handleRequest}>
            {spinning ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : (
              <DatabaseBackup className="w-4 h-4" aria-hidden="true" />
            )}
            {buttonLabel}
          </button>
          {cooldown > 0 && !active && (
            <span className="num text-xs text-faint sm:text-right">Available again in {formatCountdown(cooldown)}</span>
          )}
        </div>
      </div>

      <div aria-live="polite">
        {line && (
          <p className={`mx-5 mb-4 -mt-1 flex items-start gap-2 ${TONE_TEXT[line.tone]}`}>
            {line.spin ? (
              <Loader2 className="w-3.5 h-3.5 mt-[3px] shrink-0 animate-spin" aria-hidden="true" />
            ) : (
              <span className={`w-2 h-2 mt-1.5 rounded-full shrink-0 ${TONE_DOT[line.tone]}`} aria-hidden="true" />
            )}
            <span className="min-w-0 break-words">{line.text}</span>
          </p>
        )}
      </div>

      {job.overdue && (
        <p className="mx-5 mb-4 px-3 py-2.5 rounded-card bg-pill-warning text-warning">
          The last backup is more than 90 minutes old and the server is running. Check the cron job on arm-free.
        </p>
      )}

      {!job.configured && job.message && <p className="mx-5 mb-5 -mt-1 text-muted">{job.message}</p>}

      <p className="px-5 py-3 border-t border-line text-xs text-faint">
        arm-free copies Minecraft-Premium every 30 minutes and uploads the world save, so the download works while
        both VMs are off.
      </p>
    </section>
  );
};
