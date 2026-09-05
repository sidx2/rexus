import { useMemo, useState } from 'react';
import { HexColorPicker } from 'react-colorful';
import { Loader2, Save, KeyRound, Palette, Store, Check, Sun, Moon } from 'lucide-react';
import './Settings.css';
import * as api from './api';
import { deriveTheme, hexToHsl } from './utils';
import type { Org, ThemeColors } from './models';

type ThemeMode = 'light' | 'dark';

function guessMode(theme: ThemeColors): ThemeMode {
  return hexToHsl(theme.background).l > 50 ? 'light' : 'dark';
}

export default function Settings({
  org, token, onOrgUpdated,
}: {
  org: Org;
  token: string;
  onOrgUpdated: (org: Org) => void;
}) {
  // --- profile fields ---
  const [name, setName] = useState(org.name);
  const [tagline, setTagline] = useState(org.tagline);

  // --- brand color fields ---
  const [mode, setMode] = useState<ThemeMode>(guessMode(org.theme));
  const [primary, setPrimary] = useState(org.theme.primary);
  const [accent, setAccent] = useState(org.theme.accent);
  const [pickerOpen, setPickerOpen] = useState<'primary' | 'accent' | null>(null);

  const previewTheme = useMemo(() => deriveTheme(primary, accent, mode), [primary, accent, mode]);

  const [savingBrand, setSavingBrand] = useState(false);
  const [brandError, setBrandError] = useState<string | null>(null);
  const [brandSaved, setBrandSaved] = useState(false);

  async function handleSaveBrand() {
    setSavingBrand(true);
    setBrandError(null);
    setBrandSaved(false);
    try {
      const updated = await api.updateOrg(org.id, token, {
        name: name.trim(),
        tagline: tagline.trim(),
        theme: previewTheme,
      });
      onOrgUpdated(updated);
      setBrandSaved(true);
      setTimeout(() => setBrandSaved(false), 2500);
    } catch (err) {
      setBrandError(err instanceof Error ? err.message : 'Could not save changes.');
    } finally {
      setSavingBrand(false);
    }
  }

  // --- password fields ---
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSaved, setPasswordSaved] = useState(false);

  const canSubmitPassword =
    currentPassword.length > 0 && newPassword.length >= 8 && newPassword === confirmPassword;

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmitPassword) return;
    setSavingPassword(true);
    setPasswordError(null);
    setPasswordSaved(false);
    try {
      await api.changePassword(token, { currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordSaved(true);
      setTimeout(() => setPasswordSaved(false), 2500);
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Could not update your password.');
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div className="ds-view fade-in settings-view">
      <header className="ds-header">
        <div>
          <h1 className="ds-title">Settings</h1>
          <p className="ds-subtitle">Your restaurant's profile, brand colors, and account security.</p>
        </div>
      </header>

      {/* --- Profile --- */}
      <section className="ds-card glass-panel settings-section slide-up">
        <h3 className="settings-section-title"><Store size={18} /> Restaurant profile</h3>
        <div className="ds-row">
          <div className="ds-input-group">
            <label>Restaurant name</label>
            <input className="ds-input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="ds-input-group">
            <label>Tagline</label>
            <input
              className="ds-input"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="Kitchen & Bar"
            />
          </div>
        </div>
      </section>

      {/* --- Brand colors --- */}
      <section className="ds-card glass-panel settings-section slide-up delay-1">
        <div className="settings-section-header">
          <h3 className="settings-section-title"><Palette size={18} /> Brand colors</h3>
          <div className="mode-toggle">
            <button
              type="button"
              className={mode === 'light' ? 'active' : ''}
              onClick={() => setMode('light')}
            >
              <Sun size={13} /> Light
            </button>
            <button
              type="button"
              className={mode === 'dark' ? 'active' : ''}
              onClick={() => setMode('dark')}
            >
              <Moon size={13} /> Dark
            </button>
          </div>
        </div>
        <p className="settings-section-desc">
          Pick your two brand colors — everything else (soft tints, borders, text) is generated
          automatically to stay readable and consistent, and applies to both this dashboard and
          the guest ordering menu.
        </p>

        <div className="swatch-row">
          <div className="swatch-picker">
            <label>Primary</label>
            <button
              type="button"
              className="swatch-button"
              style={{ backgroundColor: primary }}
              onClick={() => setPickerOpen(pickerOpen === 'primary' ? null : 'primary')}
            >
              <span className="swatch-hex">{primary.toUpperCase()}</span>
            </button>
            {pickerOpen === 'primary' && (
              <div className="swatch-popover">
                <HexColorPicker color={primary} onChange={setPrimary} />
                <input
                  className="swatch-hex-input"
                  value={primary}
                  onChange={(e) => setPrimary(e.target.value)}
                />
              </div>
            )}
          </div>

          <div className="swatch-picker">
            <label>Accent</label>
            <button
              type="button"
              className="swatch-button"
              style={{ backgroundColor: accent }}
              onClick={() => setPickerOpen(pickerOpen === 'accent' ? null : 'accent')}
            >
              <span className="swatch-hex">{accent.toUpperCase()}</span>
            </button>
            {pickerOpen === 'accent' && (
              <div className="swatch-popover">
                <HexColorPicker color={accent} onChange={setAccent} />
                <input
                  className="swatch-hex-input"
                  value={accent}
                  onChange={(e) => setAccent(e.target.value)}
                />
              </div>
            )}
          </div>
        </div>

        {/* live preview: how this palette looks on each surface */}
        <div className="theme-preview-row">
          <div className="theme-preview-card admin-preview">
            <p className="theme-preview-label">Admin dashboard</p>
            <div className="mini-admin-card" style={{ background: '#14181c', borderColor: 'rgba(255,255,255,0.08)' }}>
              <div className="mini-order-dot" style={{ background: previewTheme.accent }} />
              <div className="mini-order-text">
                <span style={{ color: '#f3eee2' }}>Table 4</span>
                <span style={{ color: '#8b9296' }}>2 items</span>
              </div>
              <button
                type="button"
                className="mini-btn"
                style={{ background: previewTheme.primary, color: '#fff' }}
              >
                Mark ready
              </button>
            </div>
          </div>

          <div
            className="theme-preview-card guest-preview"
            style={{ background: previewTheme.background, borderColor: previewTheme.border }}
          >
            <p className="theme-preview-label" style={{ color: previewTheme.textSecondary }}>Guest menu</p>
            <div
              className="mini-guest-card"
              style={{ background: previewTheme.surface, borderColor: previewTheme.border }}
            >
              <div className="mini-guest-icon" style={{ background: previewTheme.accentSoft, color: previewTheme.primary }}>
                <Store size={16} />
              </div>
              <div className="mini-guest-text">
                <span style={{ color: previewTheme.textPrimary }}>Grilled Ribeye</span>
                <span style={{ color: previewTheme.textSecondary }}>$46.00</span>
              </div>
              <button
                type="button"
                className="mini-btn-round"
                style={{ background: previewTheme.primary, color: '#fff' }}
              >
                +
              </button>
            </div>
          </div>
        </div>

        {brandError && <p className="settings-error">{brandError}</p>}

        <div className="settings-actions">
          {brandSaved && <span className="settings-saved"><Check size={14} /> Saved</span>}
          <button className="ds-btn ds-btn-primary" onClick={handleSaveBrand} disabled={savingBrand}>
            {savingBrand ? <Loader2 className="spin" size={16} /> : <Save size={16} />}
            {savingBrand ? 'Saving…' : 'Save brand colors'}
          </button>
        </div>
      </section>

      {/* --- Account & security --- */}
      <section className="ds-card glass-panel settings-section slide-up delay-2">
        <h3 className="settings-section-title"><KeyRound size={18} /> Account &amp; security</h3>
        <form onSubmit={handleChangePassword} className="ds-form">
          <div className="ds-input-group">
            <label>Current password</label>
            <input
              className="ds-input"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          <div className="ds-row">
            <div className="ds-input-group">
              <label>New password</label>
              <input
                className="ds-input"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                autoComplete="new-password"
              />
            </div>
            <div className="ds-input-group">
              <label>Confirm new password</label>
              <input
                className="ds-input"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
          </div>

          {newPassword.length > 0 && newPassword.length < 8 && (
            <p className="settings-hint">Password must be at least 8 characters.</p>
          )}
          {confirmPassword.length > 0 && newPassword !== confirmPassword && (
            <p className="settings-hint">Passwords don't match.</p>
          )}
          {passwordError && <p className="settings-error">{passwordError}</p>}

          <div className="settings-actions">
            {passwordSaved && <span className="settings-saved"><Check size={14} /> Password updated</span>}
            <button type="submit" className="ds-btn ds-btn-secondary" disabled={!canSubmitPassword || savingPassword}>
              {savingPassword ? <Loader2 className="spin" size={16} /> : <KeyRound size={16} />}
              {savingPassword ? 'Updating…' : 'Update password'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}