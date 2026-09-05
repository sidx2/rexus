import { useState } from 'react';
import { ChefHat, Loader2, Eye, EyeOff } from 'lucide-react';
import './Auth.css';
import * as api from './api';
import type { AuthResponse } from './models';

type Mode = 'login' | 'signup';

export default function Auth({ onAuthenticated }: { onAuthenticated: (auth: AuthResponse) => void }) {
  const [mode, setMode] = useState<Mode>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // shared
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // signup-only
  const [orgName, setOrgName] = useState('');
  const [name, setName] = useState('');

  const canSubmit =
    mode === 'login'
      ? email.trim().length > 0 && password.length > 0
      : orgName.trim().length > 0 && name.trim().length > 0 && email.trim().length > 0 && password.length >= 8;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || loading) return;
    setLoading(true);
    setError(null);
    try {
      const auth =
        mode === 'login'
          ? await api.login({ email: email.trim(), password })
          : await api.registerAccount({ orgName: orgName.trim(), name: name.trim(), email: email.trim(), password });
      onAuthenticated(auth);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-orb auth-orb-1" />
      <div className="auth-orb auth-orb-2" />

      <div className="auth-card fade-in">
        <div className="auth-logo">
          <div className="auth-logo-icon">
            <ChefHat size={22} />
          </div>
          <span>Restaurant Admin</span>
        </div>

        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab ${mode === 'login' ? 'active' : ''}`}
            onClick={() => { setMode('login'); setError(null); }}
          >
            Log in
          </button>
          <button
            type="button"
            className={`auth-tab ${mode === 'signup' ? 'active' : ''}`}
            onClick={() => { setMode('signup'); setError(null); }}
          >
            Create account
          </button>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {mode === 'signup' && (
            <>
              <div className="auth-field">
                <label>Restaurant name</label>
                <input
                  type="text"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="The Wayfarer"
                  autoComplete="organization"
                />
              </div>
              <div className="auth-field">
                <label>Your name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Alex Rivera"
                  autoComplete="name"
                />
              </div>
            </>
          )}

          <div className="auth-field">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@restaurant.com"
              autoComplete="email"
            />
          </div>

          <div className="auth-field">
            <label>Password</label>
            <div className="auth-password-wrap">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'signup' ? 'At least 8 characters' : '••••••••'}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
              <button
                type="button"
                className="auth-password-toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && <p className="auth-error">{error}</p>}

          <button type="submit" className="auth-submit" disabled={!canSubmit || loading}>
            {loading ? <Loader2 className="spin" size={18} /> : null}
            {loading ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}
          </button>
        </form>

        <p className="auth-switch">
          {mode === 'login' ? (
            <>New here? <button type="button" onClick={() => setMode('signup')}>Create a restaurant account</button></>
          ) : (
            <>Already have an account? <button type="button" onClick={() => setMode('login')}>Log in</button></>
          )}
        </p>
      </div>
    </div>
  );
}