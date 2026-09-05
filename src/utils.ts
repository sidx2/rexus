import type { DateFilter } from "./models";
import type { ThemeColors } from "./models";

// ---------------------------------------------------------------------
// Formatting (unchanged)
// ---------------------------------------------------------------------

export function formatClockTime(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function formatRelativeTime(ts: number): string {
  const diffSec = Math.floor((Date.now() - ts) / 1000);
  if (diffSec < 5) return 'Just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'INR' }).format(amount);
}

export function getRangeForFilter(
  filter: DateFilter,
  custom: { from: string; to: string }
): { from: Date; to: Date } {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000 - 1);

  switch (filter) {
    case 'yesterday': {
      const from = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000);
      return { from, to: new Date(startOfToday.getTime() - 1) };
    }
    case '7d':
      return { from: new Date(startOfToday.getTime() - 6 * 24 * 60 * 60 * 1000), to: endOfToday };
    case 'custom':
      return {
        from: custom.from ? new Date(custom.from) : startOfToday,
        to: custom.to ? new Date(new Date(custom.to).getTime() + 24 * 60 * 60 * 1000 - 1) : endOfToday,
      };
    default:
      return { from: startOfToday, to: endOfToday };
  }
}

// =======================================================================
// Color math — turns two picked brand colors (primary + accent) into a
// full 9-value theme, the same shape the backend stores and the same
// shape the guest ordering site consumes. No color library needed for
// this — it's about a dozen lines of HSL conversion.
// =======================================================================

interface Hsl { h: number; s: number; l: number }

export function hexToHsl(hex: string): Hsl {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h *= 60;
  }
  return { h, s: s * 100, l: l * 100 };
}

export function hslToHex(h: number, s: number, l: number): string {
  const sNorm = s / 100;
  const lNorm = l / 100;
  const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lNorm - c / 2;
  let [r, g, b] = [0, 0, 0];

  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];

  const toHex = (v: number) => {
    const n = Math.round((v + m) * 255);
    return n.toString(16).padStart(2, '0');
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

function clampL(l: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, l));
}

/**
 * Derives a full 9-color theme from just two picked brand colors, the
 * same way a design system generates tints/shades from a couple of seed
 * colors instead of asking for nine individual hex values.
 */
export function deriveTheme(primaryHex: string, accentHex: string, mode: 'light' | 'dark'): ThemeColors {
  const p = hexToHsl(primaryHex);
  const a = hexToHsl(accentHex);

  const primaryDark = hslToHex(p.h, p.s, clampL(p.l - 16, 8, 90));
  const accentSoft = hslToHex(a.h, Math.min(a.s, 55), mode === 'dark' ? 22 : 90);

  const background =
    mode === 'dark'
      ? hslToHex(p.h, 14, 8)
      : hslToHex(p.h, 22, 97);
  const surface =
    mode === 'dark'
      ? hslToHex(p.h, 12, 13)
      : hslToHex(p.h, 10, 100);
  const border =
    mode === 'dark'
      ? hslToHex(p.h, 10, 22)
      : hslToHex(p.h, 15, 90);
  const textPrimary =
    mode === 'dark'
      ? hslToHex(p.h, 15, 94)
      : hslToHex(p.h, 20, 14);
  const textSecondary =
    mode === 'dark'
      ? hslToHex(p.h, 8, 65)
      : hslToHex(p.h, 8, 44);

  return {
    primary: primaryHex.toUpperCase(),
    primaryDark,
    accent: accentHex.toUpperCase(),
    accentSoft,
    background,
    surface,
    textPrimary,
    textSecondary,
    border,
  };
}

export function compressImageFile(file: File, maxDimension = 640, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that image file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Could not read that image file.'));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          const scale = maxDimension / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Your browser does not support image processing.')); return; }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
