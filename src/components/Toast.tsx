import React from 'react';
import { X } from 'lucide-react';
import { ToastMessage } from '../types';

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

const MARK: Record<ToastMessage['type'], string> = {
  success: 'bg-positive',
  error: 'bg-negative',
  info: 'bg-info',
};

export const ToastContainer: React.FC<ToastProps> = ({ toasts, onDismiss }) => (
  <div
    className="fixed top-[72px] right-4 left-4 sm:left-auto z-50 flex flex-col gap-2 sm:w-96 pointer-events-none"
    role="status"
    aria-live="polite"
  >
    {toasts.map((toast) => (
      <div
        key={toast.id}
        className="pointer-events-auto panel flex items-start gap-3 p-3.5 animate-toast-in"
      >
        <span className={`mt-1.5 w-2.5 h-2.5 rounded-[2px] border border-edge shrink-0 ${MARK[toast.type]}`} aria-hidden="true" />
        <p className="flex-1 min-w-0">{toast.text}</p>
        <button
          type="button"
          onClick={() => onDismiss(toast.id)}
          className="shrink-0 -my-2.5 -mr-2 w-11 h-11 inline-flex items-center justify-center rounded-lg text-muted hover:text-ink hover:bg-raised"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    ))}
  </div>
);
