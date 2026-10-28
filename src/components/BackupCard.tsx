import React from 'react';
import { Download } from 'lucide-react';
import { BACKUP_DOWNLOAD_URL } from '../api';
import { formatBytes, formatDate, formatRelative } from '../format';
import { BackupInfo, BackupSource } from '../types';

interface BackupCardProps {
  backupInfo?: BackupInfo;
  onToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

const SOURCE_LABEL: Record<BackupSource, string> = {
  r2: 'Cloudflare R2',
  url: 'Oracle Object Storage',
  vm: 'Direct from the VM',
  none: 'Not set up',
};

const CodeBlock: React.FC<{ children: string }> = ({ children }) => (
  <pre className="mt-2 p-3 rounded-card bg-ground border border-line text-[13px] leading-5 text-muted overflow-x-auto">
    <code>{children}</code>
  </pre>
);

export const BackupCard: React.FC<BackupCardProps> = ({ backupInfo, onToast }) => {
  const info: BackupInfo = backupInfo ?? { available: false, source: 'none' };
  const isVm = info.source === 'vm';
  const size = formatBytes(info.sizeBytes);

  const rows: Array<[string, React.ReactNode]> = [
    ['Archive', 'world-latest.tar.gz'],
    ['Size', size ? <span className="num">{size}</span> : <span className="text-faint">—</span>],
    [
      'Saved',
      info.lastModified ? (
        <span className="num">
          {formatRelative(info.lastModified)} <span className="text-faint">· {formatDate(info.lastModified)}</span>
        </span>
      ) : (
        <span className="text-faint">—</span>
      ),
    ],
  ];

  return (
    <section className="panel" aria-labelledby="backup-heading">
      <header className="flex items-center justify-between gap-3 px-5 pt-4 pb-3">
        <h2 id="backup-heading" className="text-base font-semibold">
          World save
        </h2>
        <span
          className={`h-6 px-2.5 inline-flex items-center rounded-full text-xs whitespace-nowrap ${
            info.available ? 'bg-raised text-muted' : 'bg-pill-warning text-warning'
          }`}
        >
          {info.available ? SOURCE_LABEL[info.source] : info.source === 'none' ? 'Not set up' : 'Waiting for upload'}
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

        {info.available ? (
          <a
            href={BACKUP_DOWNLOAD_URL}
            // R2 and Object Storage answer as a file download, so the dashboard stays put.
            // The VM link is plain HTTP and may be down, so it gets its own tab.
            {...(isVm ? { target: '_blank', rel: 'noopener noreferrer' } : { download: '' })}
            onClick={() => onToast('info', 'Download started. Check your browser’s downloads.')}
            className="btn-secondary"
          >
            <Download className="w-4 h-4" aria-hidden="true" />
            Download .tar.gz
          </a>
        ) : (
          <button type="button" className="btn-secondary" disabled>
            <Download className="w-4 h-4" aria-hidden="true" />
            Download .tar.gz
          </button>
        )}
      </div>

      {(info.message && !info.available) || isVm ? (
        <p className="mx-5 mb-5 -mt-1 text-muted">
          {isVm
            ? 'Served over plain HTTP from the VM on port 8080, so it only works while scripts/serve-backup.sh is running, and your browser may ask before keeping the file.'
            : info.message}
        </p>
      ) : null}

      <div className="border-t border-line">
        <details className="group px-5">
          <summary className="flex items-center justify-between h-11 cursor-pointer text-muted hover:text-ink list-none [&::-webkit-details-marker]:hidden">
            <span>{info.available ? 'Restore on a new server' : 'How to set up world backups'}</span>
            <span className="text-faint group-open:rotate-180 transition-transform" aria-hidden="true">
              ▾
            </span>
          </summary>
          <div className="pb-5 space-y-4 text-muted">
            {!info.available && (
              <div>
                <p>
                  On arm-free, pack the latest backup and upload it to the Object Storage bucket in{' '}
                  <code className="text-ink">BACKUP_URL</code> (mc-agent.sh does this after every backup):
                </p>
                <CodeBlock>{`~/beacon/pack-and-upload.sh --force`}</CodeBlock>
              </div>
            )}
            <div>
              <p>Unpack the downloaded save into the new server's folder, then start it:</p>
              <CodeBlock>{`tar -xzf minecraft-world-*.tar.gz -C /home/ubuntu/minecraft`}</CodeBlock>
            </div>
            <p className="text-faint">The full steps are in the README under “World saves”.</p>
          </div>
        </details>
      </div>
    </section>
  );
};
