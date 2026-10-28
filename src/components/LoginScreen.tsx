import React, { useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { ApiError, getConfig } from '../api';
import { AppMark } from './AppMark';
import { ThemeToggle } from './ThemeToggle';

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
          'expired-callback'?: () => void;
          theme?: 'dark' | 'light' | 'auto';
        }
      ) => string;
      reset: (widgetId?: string) => void;
    };
  }
}

function formatLockout(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lockoutSeconds, setLockoutSeconds] = useState<number | null>(null);
  const [siteKey, setSiteKey] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const widgetRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  // Turnstile is optional: the server says whether it is configured
  useEffect(() => {
    getConfig().then((cfg) => setSiteKey(cfg.turnstileSiteKey));
  }, []);

  useEffect(() => {
    if (!siteKey || !widgetRef.current) return;
    const render = () => {
      if (!window.turnstile || !widgetRef.current || widgetIdRef.current) return;
      widgetIdRef.current = window.turnstile.render(widgetRef.current, {
        sitekey: siteKey,
        // Match the page: an explicit choice on <html>, otherwise the system setting
        theme: (document.documentElement.dataset.theme as 'dark' | 'light' | undefined) ?? 'auto',
        callback: (token) => setTurnstileToken(token),
        'expired-callback': () => setTurnstileToken(null),
        'error-callback': () => setError('The bot check failed to load. Refresh the page.'),
      });
    };
    if (window.turnstile) {
      render();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.onload = render;
    document.head.appendChild(script);
  }, [siteKey]);

  useEffect(() => {
    if (lockoutSeconds === null) return;
    const id = setInterval(() => {
      setLockoutSeconds((prev) => {
        if (prev === null || prev <= 1) {
          setError(null);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [lockoutSeconds === null]); // eslint-disable-line react-hooks/exhaustive-deps

  const locked = lockoutSeconds !== null;
  const needsTurnstile = Boolean(siteKey) && !turnstileToken;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || loading || locked) return;

    setError(null);
    setLoading(true);
    try {
      await onLogin(password, turnstileToken || undefined);
    } catch (err) {
      if (err instanceof ApiError && err.status === 429 && err.retryAfter) {
        setLockoutSeconds(err.retryAfter);
        setError('Too many wrong passwords.');
      } else if (err instanceof ApiError && err.status === 401) {
        setError('That password is not right.');
      } else {
        setError(err instanceof Error ? err.message : 'Could not sign in. Try again.');
      }
      if (siteKey && window.turnstile && widgetIdRef.current) {
        window.turnstile.reset(widgetIdRef.current);
        setTurnstileToken(null);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="fixed top-[max(12px,env(safe-area-inset-top))] right-3">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2.5 mb-8">
          <AppMark size={26} />
          <span className="font-display font-semibold text-xl tracking-[0.02em]">Beacon</span>
        </div>

        <h1 className="font-display font-semibold text-[28px] leading-9 tracking-[0.01em]">Sign in to the server</h1>
        <p className="mt-2 text-muted">
          Start, stop and back up the Minecraft server. Ask whoever runs it for the password.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 panel band-grass px-5 pb-5 pt-7 space-y-4" noValidate>
          <div>
            <label htmlFor="password" className="block text-sm font-medium mb-2">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error && !locked) setError(null);
                }}
                disabled={loading || locked}
                autoComplete="current-password"
                autoFocus
                aria-invalid={Boolean(error)}
                aria-describedby={error ? 'login-error' : undefined}
                className="w-full h-11 pl-3 pr-12 rounded-lg bg-raised border-2 border-control text-ink outline-none focus:border-[var(--focus)] aria-[invalid=true]:border-negative disabled:opacity-60"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 right-0 w-11 flex items-center justify-center rounded-r-lg text-muted hover:text-ink"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" aria-hidden="true" /> : <Eye className="w-4 h-4" aria-hidden="true" />}
              </button>
            </div>
          </div>

          {siteKey && <div ref={widgetRef} className="min-h-[65px]" />}

          {error && (
            <p id="login-error" role="alert" className="text-sm text-negative">
              {error}
              {locked && (
                <span className="num text-muted"> Try again in {formatLockout(lockoutSeconds ?? 0)}.</span>
              )}
            </p>
          )}

          <button type="submit" disabled={loading || !password || locked || needsTurnstile} className="btn-primary w-full">
            {loading && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </main>
  );
};
