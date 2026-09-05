import type { OrderStatus } from "./models";
import {
  Search, RefreshCw, Clock, Sparkles, BellRing,
  CheckCircle2, XCircle, ReceiptText, ChefHat,
  type LucideIcon,
} from 'lucide-react';

export const ORDERS_SOCKET_URL = 'wss://56.228.32.113:8080/ws/orders';
/*
export const ORDER_STATUS_META: Record<
  OrderStatus,
  { label: string; color: string; icon: LucideIcon; next?: OrderStatus; nextLabel?: string }> = {
  new:        { label: 'New',        color: '#C9A15F', icon: Sparkles,    next: 'preparing', nextLabel: 'Start preparing' },
  preparing:  { label: 'Preparing',  color: '#7E9BB0', icon: ChefHat,     next: 'ready',      nextLabel: 'Mark ready' },
  ready:      { label: 'Ready',      color: '#8FA37E', icon: BellRing,    next: 'served',     nextLabel: 'Mark served' },
  served:     { label: 'Served',     color: '#6C7276', icon: CheckCircle2 },
  cancelled:  { label: 'Cancelled',  color: '#A8798A', icon: XCircle },
};

export const fontSerif = "'Fraunces', serif";
export const fontSans = "'Inter', system-ui, sans-serif";
export const fontMono = "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace";

export const COLORS = {
  ink: '#14181A',
  surface: '#1C2124',
  surfaceSoft: 'rgba(255,255,255,0.02)',
  border: 'rgba(255,255,255,0.06)',
  borderStrong: 'rgba(255,255,255,0.1)',
  textPrimary: '#F3EEE2',
  textSecondary: '#8B9296',
  textMuted: '#5F6568',
  textFaint: '#6C7276',
  brass: '#C9A15F',
  brassHover: '#DDB878',
  sage: '#8FA37E',
  rose: '#A8798A',
  slate: '#7E9BB0',
};
*/

// ---------------------------------------------------------------------
// Backend endpoints
// ---------------------------------------------------------------------

// The Rust backend (axum + sqlite) from earlier — defaults to :8080.
export const API_BASE_URL = 'http://56.228.32.113:8080';

// The guest-facing ordering site — used to build/preview QR values.
// (The backend itself already bakes this into `qrValue` on each table,
// this is only used for display fallbacks.)
export const CLIENT_HOST = "http://localhost:5000/";

// wss://.../ws/orders?orgId=<id>&token=<jwt> — the backend authenticates
// the socket via these two query params before upgrading.
export function getOrdersSocketUrl(orgId: string, token: string): string {
  const wsBase = API_BASE_URL.replace(/^http/, 'ws');
  console.log("sock = ", `${wsBase}/ws/orders?orgId=${encodeURIComponent(orgId)}&token=${encodeURIComponent(token)}`)
  return `${wsBase}/ws/orders?orgId=${encodeURIComponent(orgId)}&token=${encodeURIComponent(token)}`;
}

export const AUTH_STORAGE_KEY = 'wayfarer_admin_auth';

// ---------------------------------------------------------------------
// Order status — semantic, deliberately NOT theme-driven. "Ready" should
// always read as green, "preparing" as blue-gray, etc, regardless of
// which brand color the restaurant picks in Settings.
// ---------------------------------------------------------------------

export const ORDER_STATUS_META: Record<
  OrderStatus,
  { label: string; color: string; icon: LucideIcon; next?: OrderStatus; nextLabel?: string }> = {
  new:        { label: 'New',        color: '#C9A15F', icon: Sparkles,    next: 'preparing', nextLabel: 'Start preparing' },
  preparing:  { label: 'Preparing',  color: '#7E9BB0', icon: ChefHat,     next: 'ready',      nextLabel: 'Mark ready' },
  ready:      { label: 'Ready',      color: '#8FA37E', icon: BellRing,    next: 'served',     nextLabel: 'Mark served' },
  served:     { label: 'Served',     color: '#6C7276', icon: CheckCircle2 },
  cancelled:  { label: 'Cancelled',  color: '#A8798A', icon: XCircle },
};

export const fontSerif = "'Fraunces', serif";
export const fontSans = "'Inter', system-ui, sans-serif";
export const fontMono = "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace";

// ---------------------------------------------------------------------
// COLORS — chrome colors used by Components.tsx (inline styles).
// These now resolve through CSS custom properties set on `.ds-container`
// (see Dashboard.tsx + Dashboard.css), which are themselves populated
// from the restaurant's chosen brand colors. Only genuinely brand-neutral
// / semantic colors (sage/rose/slate below) stay as fixed hex.
// ---------------------------------------------------------------------

export const COLORS = {
  ink: 'var(--brand-ink)',
  surface: 'var(--brand-surface)',
  surfaceSoft: 'var(--brand-surface-soft)',
  border: 'var(--brand-border)',
  borderStrong: 'var(--brand-border-strong)',
  textPrimary: 'var(--brand-text-primary)',
  textSecondary: 'var(--brand-text-secondary)',
  textMuted: 'var(--brand-text-muted)',
  textFaint: 'var(--brand-text-faint)',
  brass: 'var(--brand-accent)',
  brassHover: 'var(--brand-accent-hover)',
  // semantic, fixed regardless of theme:
  sage: '#8FA37E',
  rose: '#A8798A',
  slate: '#7E9BB0',
};