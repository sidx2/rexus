export type DateFilter = 'today' | 'yesterday' | '7d' | 'custom';

export type OrderStatus = 'new' | 'preparing' | 'ready' | 'served' | 'cancelled';

export interface OrderItem {
  id: string;
  name: string;
  qty: number;
  price: number;
  note?: string;
}

export interface Order {
  id: string;
  tableId: string;
  tableName: string;
  items: OrderItem[];
  status: OrderStatus;
  total: number;
  subtotal?: number;
  tax?: number;
  createdAt: number; // epoch ms
  updatedAt: number;
}

// ---------------------------------------------------------------------
// Org / theme — mirrors the Rust backend's OrgOut + ThemeOut exactly
// (field names are already camelCase on the wire).
// ---------------------------------------------------------------------

export interface ThemeColors {
  primary: string;
  primaryDark: string;
  accent: string;
  accentSoft: string;
  background: string;
  surface: string;
  textPrimary: string;
  textSecondary: string;
  border: string;
}

export interface Org {
  id: string;
  name: string;
  tagline: string;
  logoInitial: string;
  theme: ThemeColors;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
}

export interface AuthResponse {
  token: string;
  org: Org;
  user: AdminUser;
}

// ---------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------

export interface Table {
  id: string;
  name: string;
  seats: number;
  qrValue: string;
}

// ---------------------------------------------------------------------
// Menu
// ---------------------------------------------------------------------

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: string;
  description?: string;
  tags?: string[];
  portion?: string;   // e.g. "250g", "2 pieces", "Serves 2-3" — free text on purpose
  image?: string;
}