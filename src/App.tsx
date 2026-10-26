import React, { useCallback, useEffect, useState } from 'react';
import { checkSession, login } from './api';
import { AppMark } from './components/AppMark';
import { DashboardScreen } from './components/DashboardScreen';
import { LoginScreen } from './components/LoginScreen';

export const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  // A cheap session check: a failing Oracle call no longer looks like being signed out
  useEffect(() => {
    let isMounted = true;
    checkSession()
      .then((ok) => isMounted && setIsAuthenticated(ok))
      // Network trouble: let the dashboard show its own error and retry
      .catch(() => isMounted && setIsAuthenticated(true));
    return () => {
      isMounted = false;
    };
  }, []);

  const handleLogin = async (password: string, turnstileToken?: string) => {
    await login(password, turnstileToken);
    setIsAuthenticated(true);
  };

  const handleLogout = useCallback(() => setIsAuthenticated(false), []);

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center" aria-busy="true">
        <AppMark size={28} />
        <span className="sr-only">Loading Beacon…</span>
      </div>
    );
  }

  return isAuthenticated ? <DashboardScreen onLogout={handleLogout} /> : <LoginScreen onLogin={handleLogin} />;
};
