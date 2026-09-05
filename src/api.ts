import { API_BASE_URL } from './constants';
import type {
  AuthResponse, Org, Table, MenuItem, Order, ThemeColors,
} from './models';

// =======================================================================
// Low-level fetch helper
// =======================================================================

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(
  path: string,
  options: { method?: string; token?: string | null; body?: unknown } = {}
): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.token) headers['Authorization'] = `Bearer ${options.token}`;

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (res.status === 204) return undefined as T;

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, (data as { error?: string }).error ?? `Request failed (${res.status})`);
  }
  return data as T;
}

export { ApiError };

// =======================================================================
// Auth
// =======================================================================

export function registerAccount(body: {
  orgName: string; name: string; email: string; password: string;
}): Promise<AuthResponse> {
  return request('/api/auth/register', { method: 'POST', body });
}

export function login(body: { email: string; password: string }): Promise<AuthResponse> {
  return request('/api/auth/login', { method: 'POST', body });
}

export function fetchMe(token: string): Promise<AuthResponse> {
  return request('/api/auth/me', { token });
}

// NOTE: the backend from the earlier step does not have a change-password
// route yet — this is the contract the Settings screen expects once it's
// added (a simple `admin_users.password_hash` update, re-verifying
// `currentPassword` with argon2 first):
//
//   POST /api/auth/password   (auth required)
//   body:  { currentPassword: string, newPassword: string }
//   200:   { success: true }
//   401:   { error: "current password is incorrect" }
export function changePassword(
  token: string,
  body: { currentPassword: string; newPassword: string }
): Promise<{ success: boolean }> {
  return request('/api/auth/password', { method: 'POST', token, body });
}

// =======================================================================
// Org / theme
// =======================================================================

export function getOrg(orgId: string): Promise<Org> {
  return request(`/api/orgs/${orgId}`);
}

export function updateOrg(
  orgId: string,
  token: string,
  body: { name?: string; tagline?: string; logoInitial?: string; theme?: ThemeColors }
): Promise<Org> {
  return request(`/api/orgs/${orgId}`, { method: 'PUT', token, body });
}

// =======================================================================
// Tables
// =======================================================================

export function listTables(orgId: string, token: string): Promise<Table[]> {
  return request(`/api/orgs/${orgId}/tables`, { token });
}

export function createTable(
  orgId: string, token: string, body: { name: string; seats: number }
): Promise<Table> {
  return request(`/api/orgs/${orgId}/tables`, { method: 'POST', token, body });
}

export function updateTable(
  orgId: string, token: string, tableId: string, body: { name?: string; seats?: number }
): Promise<Table> {
  return request(`/api/orgs/${orgId}/tables/${tableId}`, { method: 'PUT', token, body });
}

export function deleteTable(orgId: string, token: string, tableId: string): Promise<void> {
  return request(`/api/orgs/${orgId}/tables/${tableId}`, { method: 'DELETE', token });
}

// =======================================================================
// Menu
// =======================================================================

export function fetchMenu(orgId: string): Promise<MenuItem[]> {
  return request(`/api/orgs/${orgId}/menu`);
}

// Bulk replace — matches the original dummy `api.saveMenu(restaurantId, items)`
// contract used across the dashboard.
export function saveMenu(orgId: string, token: string, items: MenuItem[]): Promise<{ success: boolean }> {
  const payload = items.map((i) => ({
    id: i.id,
    category: i.category,
    name: i.name,
    description: i.description ?? '',
    price: i.price,
    tags: i.tags ?? [],
    portion: i.portion ?? '',
    image: i.image ?? '',
  }));
  return request(`/api/orgs/${orgId}/menu`, { method: 'PUT', token, body: payload });
}

// =======================================================================
// Orders
// =======================================================================

export function fetchOrgOrders(
  orgId: string,
  token: string,
  params: { from?: string; to?: string; status?: string } = {}
): Promise<Order[]> {
  const qs = new URLSearchParams();
  if (params.from) qs.set('from', params.from);
  if (params.to) qs.set('to', params.to);
  if (params.status) qs.set('status', params.status);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return request(`/api/orgs/${orgId}/orders${suffix}`, { token });
}

export function updateOrderStatus(
  orgId: string, token: string, orderId: string, status: string
): Promise<Order> {
  return request(`/api/orgs/${orgId}/orders/${orderId}/status`, { method: 'PATCH', token, body: { status } });
}