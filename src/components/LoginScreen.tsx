import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, Loader2, Clock, ShieldCheck, Terminal } from 'lucide-react';
import { ApiError } from '../api';

interface LoginScreenProps {
  onLogin: (password: string, turnstileToken?: string) => Promise<void>;
}

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        params: {
          sitekey: string;
          callback?: (token: string) => void;
          'error-callback'?: () => void;
          theme?: 'dark' | 'light' | 'auto';
        }
      ) => string;
      reset: (widgetId?: string) => void;
    };
    TURNSTILE_SITEKEY?: string;
  }
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lockoutSeconds, setLockoutSeconds] = useState<number | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  const siteKey =
    typeof window !== 'undefined'
      ? window.TURNSTILE_SITEKEY ||
        (import.meta as any).env?.VITE_TURNSTILE_SITEKEY
      : undefined;

  useEffect(() => {
    if (!siteKey) return;

    if (!document.getElementById('turnstile-script')) {
      const script = document.createElement('script');
      script.id = 'turnstile-script';
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        if (window.turnstile) {
          window.turnstile.render('#turnstile-widget', {
            sitekey: siteKey,
            theme: 'dark',
            callback: (token: string) => setTurnstileToken(token),
            'error-callback': () => setError('Security verification failed'),
          });
        }
      };
      document.head.appendChild(script);
    } else if (window.turnstile) {
      window.turnstile.render('#turnstile-widget', {
        sitekey: siteKey,
        theme: 'dark',
        callback: (token: string) => setTurnstileToken(token),
      });
    }
  }, [siteKey]);

  // Live countdown timer for lockout
  useEffect(() => {
    if (lockoutSeconds === null || lockoutSeconds <= 0) return;

    const interval = setInterval(() => {
      setLockoutSeconds((prev) => {
        if (prev === null || prev <= 1) {
          setError(null);
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [lockoutSeconds]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || loading || lockoutSeconds !== null) return;

    setError(null);
    setLoading(true);

    try {
      await onLogin(password, turnstileToken || undefined);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 429 && err.retryAfter) {
          setLockoutSeconds(err.retryAfter);
          setError('Too many failed attempts. Console locked.');
        } else {
          setError(err.message || 'Incorrect password');
        }
      } else {
        setError('Connection error. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const formatLockout = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s < 10 ? '0' : ''}${s}s`;
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-between p-6 sm:p-12 relative overflow-hidden select-none">
      {/* Background Subtle Mesh */}
      <div className="absolute inset-0 subtle-grid opacity-40 pointer-events-none" />
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-emerald-500/[0.03] rounded-full blur-3xl pointer-events-none" />

      {/* Top Header telemetry */}
      <header className="relative z-10 flex items-center justify-between text-[11px] font-mono text-neutral-400">
        <div className="flex items-center gap-2.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
          <span className="font-semibold text-neutral-200 tracking-wider">BEACON</span>
          <span className="text-neutral-500">/</span>
          <span className="text-neutral-300">NODE-01</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-neutral-300">ME-DUBAI-1</span>
          <span className="text-neutral-500">|</span>
          <span className="text-emerald-400 font-medium">READY</span>
        </div>
      </header>

      {/* Centerpiece Console */}
      <main className="relative z-10 w-full max-w-sm mx-auto my-auto py-8">
        <div className="carbon-panel rounded-2xl p-7 border border-white/[0.08]">
          <div className="mb-6 space-y-1">
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <span>Server Access</span>
            </h1>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Private infrastructure control console. Shared authorization required.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error && lockoutSeconds === null) setError(null);
                  }}
                  disabled={loading || lockoutSeconds !== null}
                  placeholder="Enter shared passphrase"
                  autoFocus
                  required
                  className="w-full bg-black/60 border border-white/[0.1] focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/30 rounded-xl px-4 py-3 text-sm text-neutral-100 placeholder-neutral-500 font-mono tracking-tight transition-all outline-none disabled:opacity-40"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={loading || lockoutSeconds !== null}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-neutral-500 hover:text-neutral-300 transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Optional Turnstile Container */}
            {siteKey && (
              <div id="turnstile-widget" className="flex justify-center my-2 min-h-[65px]" />
            )}

            {/* Lockout or Error Banner */}
            {lockoutSeconds !== null ? (
              <div className="p-3 rounded-xl bg-amber-500/[0.08] border border-amber-500/25 text-amber-300 text-xs flex items-center gap-2.5">
                <Clock className="w-4 h-4 shrink-0 text-amber-400 animate-spin" />
                <div className="font-mono">
                  <div className="font-semibold tracking-wide">BRUTE-FORCE LOCKOUT</div>
                  <div className="text-[11px] text-amber-300/80">
                    Retry enabled in <span className="font-bold tabular-nums">{formatLockout(lockoutSeconds)}</span>
                  </div>
                </div>
              </div>
            ) : error ? (
              <div className="p-3 rounded-xl bg-rose-500/[0.08] border border-rose-500/25 text-rose-300 text-xs font-mono">
                {error}
              </div>
            ) : null}

            {/* Primary Submit */}
            <button
              type="submit"
              disabled={loading || !password || lockoutSeconds !== null}
              className="w-full py-3 px-4 rounded-xl font-semibold text-xs text-black bg-emerald-400 hover:bg-emerald-300 active:scale-[0.98] transition-all disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center gap-2 shadow-[0_0_20px_-3px_rgba(16,185,129,0.4)]"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span className="font-mono tracking-wider">VERIFYING...</span>
                </>
              ) : (
                <span className="font-mono tracking-wider">AUTHORIZE SESSION</span>
              )}
            </button>
          </form>
        </div>
      </main>

      {/* Footer telemetry */}
      <footer className="relative z-10 flex flex-col sm:flex-row items-center justify-between text-[11px] font-mono text-neutral-400 gap-2 border-t border-white/[0.04] pt-4">
        <div className="flex items-center gap-2 text-neutral-400">
          <ShieldCheck className="w-3.5 h-3.5 text-neutral-400" />
          <span>PBKDF2 100K ITERATIONS // CONSTANT-TIME VERIFIED</span>
        </div>
        <div className="text-neutral-400 flex items-center gap-1.5">
          <Terminal className="w-3 h-3" />
          <span>ORACLE CLOUD V8 PAGES RUNTIME</span>
        </div>
      </footer>
    </div>
  );
};
