import { useEffect, useMemo, useState, type ElementType, type ReactNode } from 'react';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, Cell,
  PieChart, Pie, Legend, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import {
  TrendingUp, TrendingDown, Minus, IndianRupee, Receipt, Timer,
  XCircle, Loader2, BarChart3,
} from 'lucide-react';
import './Analytics.css';
import * as api from './api';
import { DateFilterBar } from './Components';
import { getRangeForFilter } from './utils';
import { ORDER_STATUS_META } from './constants';
import type { DateFilter, Order, OrderStatus, MenuItem, Org } from './models';

/* =====================================================================
   Aggregation helpers — everything here is derived client-side from the
   plain Order[] the existing GET /api/orgs/:orgId/orders endpoint
   already returns. Fine for a restaurant's order volume; if this ever
   needs to run over months of history, move these aggregations into a
   backend query instead of pulling every order down to the browser.
   ===================================================================== */

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatDuration(ms: number): string {
  if (!ms || ms <= 0) return '—';
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return `${hrs}h ${rem}m`;
}

function formatHour(hour: number): string {
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h}${hour < 12 ? 'am' : 'pm'}`;
}

interface TrendPoint { label: string; revenue: number; orders: number }

function buildRevenueTrend(orders: Order[], granularity: 'hour' | 'day'): TrendPoint[] {
  const live = orders.filter((o) => o.status !== 'cancelled');

  if (granularity === 'hour') {
    const buckets: TrendPoint[] = Array.from({ length: 24 }, (_, h) => ({ label: formatHour(h), revenue: 0, orders: 0 }));
    live.forEach((o) => {
      const h = new Date(o.createdAt).getHours();
      buckets[h].revenue += o.total;
      buckets[h].orders += 1;
    });
    return buckets;
  }

  const map = new Map<string, { revenue: number; orders: number }>();
  live.forEach((o) => {
    const key = dayKey(new Date(o.createdAt));
    const cur = map.get(key) ?? { revenue: 0, orders: 0 };
    cur.revenue += o.total;
    cur.orders += 1;
    map.set(key, cur);
  });
  return Array.from(map.entries())
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([key, v]) => ({
      label: new Date(key).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      ...v,
    }));
}

function buildTopItems(orders: Order[]) {
  const map = new Map<string, { qty: number; revenue: number }>();
  orders.filter((o) => o.status !== 'cancelled').forEach((o) => {
    o.items.forEach((it) => {
      const cur = map.get(it.name) ?? { qty: 0, revenue: 0 };
      cur.qty += it.qty;
      cur.revenue += it.qty * it.price;
      map.set(it.name, cur);
    });
  });
  return Array.from(map.entries())
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8);
}

// Best-effort join against the currently-loaded menu, matched by name.
// Order items don't carry a category (or menuItemId) over the wire today
// — the ideal fix is exposing `category` on OrderItemOut in the backend
// so this doesn't have to guess by name and silently miss renamed/removed
// items into "Uncategorized".
function buildCategoryBreakdown(orders: Order[], menuItems: MenuItem[]) {
  const nameToCategory = new Map(menuItems.map((m) => [m.name.trim().toLowerCase(), m.category]));
  const map = new Map<string, number>();
  orders.filter((o) => o.status !== 'cancelled').forEach((o) => {
    o.items.forEach((it) => {
      const cat = nameToCategory.get(it.name.trim().toLowerCase()) ?? 'Uncategorized';
      map.set(cat, (map.get(cat) ?? 0) + it.qty * it.price);
    });
  });
  return Array.from(map.entries())
    .map(([category, revenue]) => ({ category, revenue }))
    .sort((a, b) => b.revenue - a.revenue);
}

function buildPeakHours(orders: Order[]) {
  const buckets = Array.from({ length: 24 }, (_, h) => ({ hour: h, label: formatHour(h), orders: 0 }));
  orders.filter((o) => o.status !== 'cancelled').forEach((o) => {
    buckets[new Date(o.createdAt).getHours()].orders += 1;
  });
  return buckets;
}

function buildTopTables(orders: Order[]) {
  const map = new Map<string, { revenue: number; orders: number }>();
  orders.filter((o) => o.status !== 'cancelled').forEach((o) => {
    const cur = map.get(o.tableName) ?? { revenue: 0, orders: 0 };
    cur.revenue += o.total;
    cur.orders += 1;
    map.set(o.tableName, cur);
  });
  return Array.from(map.entries())
    .map(([table, v]) => ({ table, ...v }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8);
}

function buildStatusBreakdown(orders: Order[]) {
  const counts: Record<OrderStatus, number> = { new: 0, preparing: 0, ready: 0, served: 0, cancelled: 0 };
  orders.forEach((o) => { counts[o.status] += 1; });
  return (Object.keys(counts) as OrderStatus[])
    .filter((s) => counts[s] > 0)
    .map((s) => ({ status: s, name: ORDER_STATUS_META[s].label, value: counts[s], color: ORDER_STATUS_META[s].color }));
}

interface Kpis {
  revenue: number;
  orderCount: number;
  avgOrderValue: number;
  cancellationRate: number;
  avgFulfillmentMs: number;
}

function computeKpis(orders: Order[]): Kpis {
  const live = orders.filter((o) => o.status !== 'cancelled');
  const revenue = live.reduce((sum, o) => sum + o.total, 0);
  const cancelledCount = orders.length - live.length;
  const served = orders.filter((o) => o.status === 'served');
  const avgFulfillmentMs = served.length
    ? served.reduce((sum, o) => sum + (o.updatedAt - o.createdAt), 0) / served.length
    : 0;
  return {
    revenue,
    orderCount: orders.length,
    avgOrderValue: live.length ? revenue / live.length : 0,
    cancellationRate: orders.length ? (cancelledCount / orders.length) * 100 : 0,
    avgFulfillmentMs,
  };
}

function formatRupees(n: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

/* =====================================================================
   Small presentational pieces
   ===================================================================== */

function Trend({ current, previous, invert = false }: { current: number; previous: number; invert?: boolean }) {
  if (previous === 0 && current === 0) return null;
  if (previous === 0) return <span className="an-trend an-trend--flat"><Minus size={12} /> new</span>;
  const delta = ((current - previous) / previous) * 100;
  const rounded = Math.round(Math.abs(delta));
  if (rounded === 0) return <span className="an-trend an-trend--flat"><Minus size={12} /> flat</span>;
  const isUp = delta > 0;
  const isGood = invert ? !isUp : isUp;
  const Icon = isUp ? TrendingUp : TrendingDown;
  return (
    <span className={`an-trend ${isGood ? 'an-trend--good' : 'an-trend--bad'}`}>
      <Icon size={12} /> {rounded}%
    </span>
  );
}

function KpiCard({
  icon: Icon, label, value, current, previous, invert, loading,
}: {
  icon: ElementType;
  label: string;
  value: string;
  current: number;
  previous: number;
  invert?: boolean;
  loading: boolean;
}) {
  return (
    <div className="an-kpi glass-panel">
      <div className="an-kpi-icon"><Icon size={17} strokeWidth={1.8} /></div>
      <div className="an-kpi-body">
        <p className="an-kpi-label">{label}</p>
        <div className="an-kpi-value-row">
          <span className="an-kpi-value">{loading ? '—' : value}</span>
          {!loading && <Trend current={current} previous={previous} invert={invert} />}
        </div>
      </div>
    </div>
  );
}

function ChartCard({
  title, subtitle, children, className = '',
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`ds-card glass-panel an-chart-card ${className}`}>
      <div className="an-chart-header">
        <h3>{title}</h3>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="an-empty-chart">
      <BarChart3 size={26} strokeWidth={1.4} />
      <p>{label}</p>
    </div>
  );
}

/* =====================================================================
   Root
   ===================================================================== */

export default function Analytics({
  org, token, menuItems,
}: {
  org: Org;
  token: string;
  menuItems: MenuItem[];
}) {
  const [dateFilter, setDateFilter] = useState<DateFilter>('7d');
  const [customRange, setCustomRange] = useState<{ from: string; to: string }>({ from: '', to: '' });

  const [orders, setOrders] = useState<Order[] | null>(null);
  const [previousOrders, setPreviousOrders] = useState<Order[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { from, to } = getRangeForFilter(dateFilter, customRange);
        const spanMs = to.getTime() - from.getTime();
        const prevTo = new Date(from.getTime() - 1);
        const prevFrom = new Date(prevTo.getTime() - spanMs);

        const [current, previous] = await Promise.all([
          api.fetchOrgOrders(org.id, token, { from: from.toISOString(), to: to.toISOString() }),
          api.fetchOrgOrders(org.id, token, { from: prevFrom.toISOString(), to: prevTo.toISOString() }),
        ]);
        if (cancelled) return;
        setOrders(current);
        setPreviousOrders(previous);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load analytics.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [org.id, token, dateFilter, customRange]);

  const granularity: 'hour' | 'day' = dateFilter === 'today' || dateFilter === 'yesterday' ? 'hour' : 'day';

  const kpis = useMemo(() => computeKpis(orders ?? []), [orders]);
  const prevKpis = useMemo(() => computeKpis(previousOrders ?? []), [previousOrders]);

  const revenueTrend = useMemo(() => buildRevenueTrend(orders ?? [], granularity), [orders, granularity]);
  const topItems = useMemo(() => buildTopItems(orders ?? []), [orders]);
  const categoryBreakdown = useMemo(() => buildCategoryBreakdown(orders ?? [], menuItems), [orders, menuItems]);
  const peakHours = useMemo(() => buildPeakHours(orders ?? []), [orders]);
  const topTables = useMemo(() => buildTopTables(orders ?? []), [orders]);
  const statusBreakdown = useMemo(() => buildStatusBreakdown(orders ?? []), [orders]);

  const maxPeakHour = Math.max(1, ...peakHours.map((h) => h.orders));
  const hasData = (orders?.length ?? 0) > 0;

  return (
    <div className="ds-view fade-in an-view">
      <header className="ds-header">
        <div>
          <h1 className="ds-title">Analytics</h1>
          <p className="ds-subtitle">How the business is actually doing, at a glance.</p>
        </div>
        <DateFilterBar value={dateFilter} onChange={setDateFilter} customRange={customRange} onCustomChange={setCustomRange} />
      </header>

      {error && <p className="ds-error-banner">{error}</p>}

      {/* --- KPI row --- */}
      <div className="an-kpi-grid">
        <KpiCard
          icon={IndianRupee}
          label="Revenue"
          value={formatRupees(kpis.revenue)}
          current={kpis.revenue}
          previous={prevKpis.revenue}
          loading={loading}
        />
        <KpiCard
          icon={Receipt}
          label="Orders"
          value={String(kpis.orderCount)}
          current={kpis.orderCount}
          previous={prevKpis.orderCount}
          loading={loading}
        />
        <KpiCard
          icon={IndianRupee}
          label="Avg order value"
          value={formatRupees(kpis.avgOrderValue)}
          current={kpis.avgOrderValue}
          previous={prevKpis.avgOrderValue}
          loading={loading}
        />
        <KpiCard
          icon={Timer}
          label="Avg fulfillment time"
          value={formatDuration(kpis.avgFulfillmentMs)}
          current={kpis.avgFulfillmentMs}
          previous={prevKpis.avgFulfillmentMs}
          invert
          loading={loading}
        />
        <KpiCard
          icon={XCircle}
          label="Cancellation rate"
          value={`${kpis.cancellationRate.toFixed(1)}%`}
          current={kpis.cancellationRate}
          previous={prevKpis.cancellationRate}
          invert
          loading={loading}
        />
      </div>

      {loading ? (
        <div className="ds-loader-container">
          <Loader2 className="spin ds-text-primary" size={32} />
          <p>Crunching the numbers...</p>
        </div>
      ) : !hasData ? (
        <div className="ds-empty-state">
          <BarChart3 size={48} opacity={0.2} />
          <p>No orders in this range yet.</p>
        </div>
      ) : (
        <>
          {/* --- Revenue trend + status breakdown --- */}
          <div className="an-grid-main">
            <ChartCard title="Revenue trend" subtitle={granularity === 'hour' ? 'By hour' : 'By day'} className="an-span-2">
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={revenueTrend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="anRevenueFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--brand-primary)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--brand-primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-border)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
                  <Tooltip
                    contentStyle={{ background: '#14181c', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, fontSize: 12.5 }}
                    labelStyle={{ color: '#fff' }}
                    formatter={(value: number, name: string) => [name === 'revenue' ? formatRupees(value) : value, name === 'revenue' ? 'Revenue' : 'Orders']}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="var(--brand-primary)" strokeWidth={2} fill="url(#anRevenueFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Order status" subtitle="This range">
              {statusBreakdown.length === 0 ? <EmptyChart label="No orders yet" /> : (
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={statusBreakdown} dataKey="value" nameKey="name" innerRadius={54} outerRadius={82} paddingAngle={2}>
                      {statusBreakdown.map((entry) => <Cell key={entry.status} fill={entry.color} />)}
                    </Pie>
                    <Legend
                      layout="vertical"
                      align="right"
                      verticalAlign="middle"
                      iconSize={8}
                      formatter={(value) => <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{value}</span>}
                    />
                    <Tooltip contentStyle={{ background: '#14181c', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, fontSize: 12.5 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>

          {/* --- Top items + category mix --- */}
          <div className="an-grid-main">
            <ChartCard title="Best sellers" subtitle="By revenue">
              {topItems.length === 0 ? <EmptyChart label="No items sold yet" /> : (
                <ResponsiveContainer width="100%" height={Math.max(220, topItems.length * 34)}>
                  <BarChart data={topItems} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={140}
                      tick={{ fill: 'var(--text-main)', fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{ background: '#14181c', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, fontSize: 12.5 }}
                      formatter={(value: number, key: string) => [key === 'revenue' ? formatRupees(value) : `${value} sold`, key === 'revenue' ? 'Revenue' : 'Quantity']}
                    />
                    <Bar dataKey="revenue" fill="var(--brand-primary)" radius={[0, 6, 6, 0]} barSize={16} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            <ChartCard title="Revenue by category" subtitle="Matched from your current menu">
              {categoryBreakdown.length === 0 ? <EmptyChart label="No category data yet" /> : (
                <ResponsiveContainer width="100%" height={Math.max(220, categoryBreakdown.length * 34)}>
                  <BarChart data={categoryBreakdown} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis
                      type="category"
                      dataKey="category"
                      width={140}
                      tick={{ fill: 'var(--text-main)', fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{ background: '#14181c', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, fontSize: 12.5 }}
                      formatter={(value: number) => [formatRupees(value), 'Revenue']}
                    />
                    <Bar dataKey="revenue" fill="var(--brand-accent)" radius={[0, 6, 6, 0]} barSize={16} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>

          {/* --- Peak hours + top tables --- */}
          <div className="an-grid-main">
            <ChartCard title="Peak hours" subtitle="Orders by hour of day, across this range" className="an-span-2">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={peakHours} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <XAxis dataKey="label" tick={{ fill: 'var(--text-muted)', fontSize: 10.5 }} axisLine={false} tickLine={false} interval={1} />
                  <YAxis hide />
                  <Tooltip
                    contentStyle={{ background: '#14181c', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, fontSize: 12.5 }}
                    formatter={(value: number) => [`${value} orders`, '']}
                    labelFormatter={(label) => label}
                  />
                  <Bar dataKey="orders" radius={[4, 4, 0, 0]}>
                    {peakHours.map((h) => (
                      <Cell key={h.hour} fill="var(--brand-primary)" fillOpacity={0.25 + 0.75 * (h.orders / maxPeakHour)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Top tables" subtitle="By revenue">
              {topTables.length === 0 ? <EmptyChart label="No table data yet" /> : (
                <div className="an-table-list">
                  {topTables.map((t, i) => (
                    <div key={t.table} className="an-table-row">
                      <span className="an-table-rank">{i + 1}</span>
                      <span className="an-table-name">{t.table}</span>
                      <span className="an-table-orders">{t.orders} orders</span>
                      <span className="an-table-revenue">{formatRupees(t.revenue)}</span>
                    </div>
                  ))}
                </div>
              )}
            </ChartCard>
          </div>
        </>
      )}
    </div>
  );
}