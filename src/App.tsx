import { useEffect, useState } from 'react';
import Dashboard from './Dashboard';
import Auth from './Auth';
import * as api from './api';
import { AUTH_STORAGE_KEY } from './constants';
import type { AuthResponse, Org } from './models';

type SessionState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'signed-in'; auth: AuthResponse };

function loadStoredToken(): string | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { token?: string };
    return parsed.token ?? null;
  } catch {
    return null;
  }
}

function persistAuth(auth: AuthResponse | null) {
  if (auth) {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ token: auth.token }));
  } else {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  }
}

function App() {
  const [session, setSession] = useState<SessionState>({ status: 'loading' });

  // On load, if a token is stored, re-validate it against /api/auth/me
  // rather than trusting stale localStorage data — this also refreshes
  // the org (and its theme) in case it changed since the last visit.
  useEffect(() => {
    const token = loadStoredToken();
    if (!token) {
      setSession({ status: 'signed-out' });
      return;
    }
    api
      .fetchMe(token)
      .then((auth) => {
        persistAuth(auth);
        setSession({ status: 'signed-in', auth });
      })
      .catch(() => {
        persistAuth(null);
        setSession({ status: 'signed-out' });
      });
  }, []);

  function handleAuthenticated(auth: AuthResponse) {
    persistAuth(auth);
    setSession({ status: 'signed-in', auth });
  }

  function handleOrgUpdated(org: Org) {
    setSession((prev) => {
      if (prev.status !== 'signed-in') return prev;
      const nextAuth = { ...prev.auth, org };
      persistAuth(nextAuth);
      return { status: 'signed-in', auth: nextAuth };
    });
  }

  function handleLogout() {
    persistAuth(null);
    setSession({ status: 'signed-out' });
  }

  if (session.status === 'loading') {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#09090b', color: '#94a3b8', fontFamily: "'Inter', system-ui, sans-serif", fontSize: 14,
      }}>
        Loading…
      </div>
    );
  }

  if (session.status === 'signed-out') {
    return <Auth onAuthenticated={handleAuthenticated} />;
  }

  return <Dashboard auth={session.auth} onOrgUpdated={handleOrgUpdated} onLogout={handleLogout} />;
}

export default App;