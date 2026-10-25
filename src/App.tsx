import React, { useState, useEffect } from 'react';
import { Radio, Loader2 } from 'lucide-react';
import { getStatus, login } from './api';
import { DashboardScreen } from './components/DashboardScreen';
import { LoginScreen } from './components/LoginScreen';

export const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  // Check existing session on mount
  useEffect(() => {
    let isMounted = true;
    const checkSession = async () => {
      try {
        await getStatus();
        if (isMounted) setIsAuthenticated(true);
      } catch {
        if (isMounted) setIsAuthenticated(false);
      }
    };
    checkSession();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleLogin = async (password: string, turnstileToken?: string) => {
    await login(password, turnstileToken);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
  };

  // Initial authentication check splash
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-2xl bg-neutral-900 border border-white/10 flex items-center justify-center shadow-glass mb-4">
          <Radio className="w-6 h-6 text-emerald-400" />
        </div>
        <Loader2 className="w-5 h-5 text-neutral-500 animate-spin" />
      </div>
    );
  }

  return isAuthenticated ? (
    <DashboardScreen onLogout={handleLogout} />
  ) : (
    <LoginScreen onLogin={handleLogin} />
  );
};
