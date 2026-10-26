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
  info: 'bg-faint',
};

export const ToastContainer: React.FC<ToastProps> = ({ toasts, onDismiss }) => (
  <div
    className="fixed top-14 right-4 left-4 sm:left-auto z-50 flex flex-col gap-2 sm:w-96 pointer-events-none"
    role="status"
    aria-live="polite"
  >
    {toasts.map((toast) => (
      <div
        key={toast.id}
        className="pointer-events-auto flex items-start gap-3 p-3.5 rounded-card bg-raised border border-control shadow-[0_12px_28px_rgba(0,0,0,0.45)] animate-toast-in"
      >
        <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${MARK[toast.type]}`} aria-hidden="true" />
        <p className="flex-1 min-w-0">{toast.text}</p>
        <button
          type="button"
          onClick={() => onDismiss(toast.id)}
          className="shrink-0 -m-1 p-1 rounded text-faint hover:text-ink"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    ))}
  </div>
);
