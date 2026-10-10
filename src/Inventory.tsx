import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip,
} from 'recharts';
import {
  Carrot, Milk, Beef, Wheat, Soup, CupSoda, Box, Package, Truck, Boxes,
  AlertTriangle, IndianRupee, TrendingDown, PackageX, CalendarClock,
  Search, Plus, Pencil, Trash2, X, Check, Save, FileText, PackageCheck,
  ArrowUpRight, ArrowDownRight, Phone, Mail, RefreshCw,
  type LucideIcon,
} from 'lucide-react';
import './Inventory.css';

/* =====================================================================
   Types

   Everything here runs on local component state for now — no backend
   calls. Field names/shapes are deliberately written the way the real
   API will eventually look (camelCase, same id conventions as
   MenuItem/Order elsewhere in this app) so swapping local state for
   real fetch/save calls later is a drop-in change, not a rewrite.
   ===================================================================== */

type InventoryCategory =
  | 'Vegetables' | 'Dairy' | 'Meat & Poultry' | 'Grains & Pulses'
  | 'Spices & Condiments' | 'Beverages' | 'Packaging' | 'Other';

type Unit = 'kg' | 'g' | 'L' | 'ml' | 'pcs' | 'packet' | 'box' | 'cylinder';

type StockStatus = 'out' | 'low' | 'ok';

interface Supplier {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  notes?: string;
}

interface InventoryItem {
  id: string;
  name: string;
  category: InventoryCategory;
  unit: Unit;
  stock: number;
  reorderThreshold: number;
  costPerUnit: number; // in rupees
  supplierId: string | null;
  expiryDate: string | null; // ISO date (YYYY-MM-DD), only for perishables
  notes?: string;
  updatedAt: number;
}

type MovementReason = 'restock' | 'kitchen-use' | 'wastage' | 'correction' | 'returned';

interface StockMovement {
  id: string;
  itemId: string;
  itemName: string;
  delta: number; // positive = stock in, negative = stock out
  reason: MovementReason;
  note?: string;
  createdAt: number;
}

type PurchaseOrderStatus = 'draft' | 'ordered' | 'received' | 'cancelled';

interface PurchaseOrderLine {
  itemId: string;
  itemName: string;
  qty: number;
  costPerUnit: number;
}

interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplierId: string;
  status: PurchaseOrderStatus;
  lines: PurchaseOrderLine[];
  expectedDate: string | null;
  createdAt: number;
  receivedAt?: number;
}

/* =====================================================================
   Static lookups
   ===================================================================== */

const CATEGORY_META: Record<InventoryCategory, { icon: LucideIcon; color: string }> = {
  'Vegetables': { icon: Carrot, color: '#4C8368' },
  'Dairy': { icon: Milk, color: '#7E9BB0' },
  'Meat & Poultry': { icon: Beef, color: '#C4633B' },
  'Grains & Pulses': { icon: Wheat, color: '#C9A15F' },
  'Spices & Condiments': { icon: Soup, color: '#A8798A' },
  'Beverages': { icon: CupSoda, color: '#6FA37E' },
  'Packaging': { icon: Box, color: '#8B9296' },
  'Other': { icon: Package, color: '#9B8AA8' },
};
const CATEGORIES = Object.keys(CATEGORY_META) as InventoryCategory[];
const UNITS: Unit[] = ['kg', 'g', 'L', 'ml', 'pcs', 'packet', 'box', 'cylinder'];

const REASON_LABELS: Record<MovementReason, string> = {
  restock: 'Restocked',
  'kitchen-use': 'Used in kitchen',
  wastage: 'Wastage / spoilage',
  correction: 'Correction',
  returned: 'Returned to supplier',
};

/* =====================================================================
   Helpers
   ===================================================================== */

function formatRupees(n: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

function formatQty(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

function timeAgo(ts: number): string {
  const diffMin = Math.floor((Date.now() - ts) / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

function daysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function daysUntil(dateStr: string): number {
  const target = new Date(`${dateStr}T00:00:00`);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target.getTime() - startOfToday.getTime()) / (24 * 60 * 60 * 1000));
}

function isExpiringSoon(expiryDate: string | null): boolean {
  if (!expiryDate) return false;
  return daysUntil(expiryDate) <= 7;
}

function expiryLabel(expiryDate: string): string {
  const d = daysUntil(expiryDate);
  if (d < 0) return 'Expired';
  if (d === 0) return 'Expires today';
  if (d === 1) return 'Expires tomorrow';
  return `Expires in ${d}d`;
}

function expiryTone(expiryDate: string): 'ok' | 'warn' | 'danger' {
  const d = daysUntil(expiryDate);
  if (d <= 1) return 'danger';
  if (d <= 7) return 'warn';
  return 'ok';
}

function computeStatus(item: InventoryItem): StockStatus {
  if (item.stock <= 0) return 'out';
  if (item.stock <= item.reorderThreshold) return 'low';
  return 'ok';
}

/* =====================================================================
   Seed data — realistic enough to make every panel (KPIs, needs
   attention, recent activity, purchase orders, suppliers) show
   something meaningful out of the box. Swap for real fetches later.
   ===================================================================== */

const SEED_SUPPLIERS: Supplier[] = [
  { id: 'sup-1', name: 'Fresh Farm Produce', contactPerson: 'Ramesh Gupta', phone: '98765 43210', email: 'orders@freshfarm.in', address: 'APMC Market, Sector 19' },
  { id: 'sup-2', name: 'Amul Dairy Distributors', contactPerson: 'Priya Nair', phone: '91234 56789', email: 'sales@amuldist.in', address: 'Dairy Complex, Ring Road' },
  { id: 'sup-3', name: 'Metro Meat Wholesale', contactPerson: 'Imran Shaikh', phone: '99887 76655', email: 'imran@metromeat.in', address: 'Cold Storage Lane 4' },
  { id: 'sup-4', name: 'Spice Bazaar Traders', contactPerson: 'Lakshmi Iyer', phone: '90909 80808', email: 'lakshmi@spicebazaar.in', address: 'Old Grain Market' },
  { id: 'sup-5', name: 'Sunrise Beverages Co.', contactPerson: 'Dev Malhotra', phone: '93333 22221', email: 'dev@sunrisebev.in', address: 'Industrial Estate, Block C' },
];

const SEED_ITEMS: InventoryItem[] = [
  { id: 'itm-1', name: 'Tomatoes', category: 'Vegetables', unit: 'kg', stock: 8, reorderThreshold: 15, costPerUnit: 40, supplierId: 'sup-1', expiryDate: daysFromNow(2), updatedAt: Date.now() },
  { id: 'itm-2', name: 'Onions', category: 'Vegetables', unit: 'kg', stock: 45, reorderThreshold: 20, costPerUnit: 35, supplierId: 'sup-1', expiryDate: null, updatedAt: Date.now() },
  { id: 'itm-3', name: 'Potatoes', category: 'Vegetables', unit: 'kg', stock: 60, reorderThreshold: 25, costPerUnit: 25, supplierId: 'sup-1', expiryDate: null, updatedAt: Date.now() },
  { id: 'itm-4', name: 'Green Chillies', category: 'Vegetables', unit: 'kg', stock: 2, reorderThreshold: 5, costPerUnit: 60, supplierId: 'sup-1', expiryDate: daysFromNow(1), updatedAt: Date.now() },
  { id: 'itm-5', name: 'Paneer', category: 'Dairy', unit: 'kg', stock: 0, reorderThreshold: 8, costPerUnit: 320, supplierId: 'sup-2', expiryDate: daysFromNow(3), updatedAt: Date.now() },
  { id: 'itm-6', name: 'Fresh Cream', category: 'Dairy', unit: 'L', stock: 4, reorderThreshold: 6, costPerUnit: 220, supplierId: 'sup-2', expiryDate: daysFromNow(4), updatedAt: Date.now() },
  { id: 'itm-7', name: 'Butter', category: 'Dairy', unit: 'kg', stock: 12, reorderThreshold: 5, costPerUnit: 480, supplierId: 'sup-2', expiryDate: null, updatedAt: Date.now() },
  { id: 'itm-8', name: 'Mozzarella Cheese', category: 'Dairy', unit: 'kg', stock: 9, reorderThreshold: 4, costPerUnit: 650, supplierId: 'sup-2', expiryDate: daysFromNow(20), updatedAt: Date.now() },
  { id: 'itm-9', name: 'Chicken', category: 'Meat & Poultry', unit: 'kg', stock: 18, reorderThreshold: 10, costPerUnit: 220, supplierId: 'sup-3', expiryDate: daysFromNow(2), updatedAt: Date.now() },
  { id: 'itm-10', name: 'Mutton', category: 'Meat & Poultry', unit: 'kg', stock: 3, reorderThreshold: 6, costPerUnit: 650, supplierId: 'sup-3', expiryDate: daysFromNow(1), updatedAt: Date.now() },
  { id: 'itm-11', name: 'Basmati Rice', category: 'Grains & Pulses', unit: 'kg', stock: 85, reorderThreshold: 30, costPerUnit: 110, supplierId: 'sup-4', expiryDate: null, updatedAt: Date.now() },
  { id: 'itm-12', name: 'Wheat Flour', category: 'Grains & Pulses', unit: 'kg', stock: 40, reorderThreshold: 20, costPerUnit: 42, supplierId: 'sup-4', expiryDate: null, updatedAt: Date.now() },
  { id: 'itm-13', name: 'Toor Dal', category: 'Grains & Pulses', unit: 'kg', stock: 14, reorderThreshold: 15, costPerUnit: 135, supplierId: 'sup-4', expiryDate: null, updatedAt: Date.now() },
  { id: 'itm-14', name: 'Garam Masala', category: 'Spices & Condiments', unit: 'kg', stock: 3.5, reorderThreshold: 2, costPerUnit: 480, supplierId: 'sup-4', expiryDate: null, updatedAt: Date.now() },
  { id: 'itm-15', name: 'Red Chilli Powder', category: 'Spices & Condiments', unit: 'kg', stock: 1, reorderThreshold: 3, costPerUnit: 320, supplierId: 'sup-4', expiryDate: null, updatedAt: Date.now() },
  { id: 'itm-16', name: 'Cooking Oil', category: 'Spices & Condiments', unit: 'L', stock: 22, reorderThreshold: 25, costPerUnit: 150, supplierId: 'sup-4', expiryDate: null, updatedAt: Date.now() },
  { id: 'itm-17', name: 'Coca-Cola Bottles', category: 'Beverages', unit: 'pcs', stock: 120, reorderThreshold: 48, costPerUnit: 35, supplierId: 'sup-5', expiryDate: null, updatedAt: Date.now() },
  { id: 'itm-18', name: 'Soda Water', category: 'Beverages', unit: 'box', stock: 6, reorderThreshold: 10, costPerUnit: 220, supplierId: 'sup-5', expiryDate: null, updatedAt: Date.now() },
  { id: 'itm-19', name: 'Disposable Containers', category: 'Packaging', unit: 'packet', stock: 15, reorderThreshold: 20, costPerUnit: 180, supplierId: null, expiryDate: null, updatedAt: Date.now() },
  { id: 'itm-20', name: 'Paper Bags', category: 'Packaging', unit: 'packet', stock: 0, reorderThreshold: 15, costPerUnit: 95, supplierId: null, expiryDate: null, updatedAt: Date.now() },
  { id: 'itm-21', name: 'LPG Cylinder', category: 'Other', unit: 'cylinder', stock: 2, reorderThreshold: 2, costPerUnit: 1100, supplierId: null, expiryDate: null, updatedAt: Date.now() },
  { id: 'itm-22', name: 'Cleaning Supplies', category: 'Other', unit: 'packet', stock: 8, reorderThreshold: 5, costPerUnit: 150, supplierId: null, expiryDate: null, updatedAt: Date.now() },
];

const SEED_MOVEMENTS: StockMovement[] = [
  { id: 'mv-1', itemId: 'itm-1', itemName: 'Tomatoes', delta: -7, reason: 'kitchen-use', createdAt: Date.now() - 35 * 60 * 1000 },
  { id: 'mv-2', itemId: 'itm-5', itemName: 'Paneer', delta: -8, reason: 'kitchen-use', createdAt: Date.now() - 90 * 60 * 1000 },
  { id: 'mv-3', itemId: 'itm-9', itemName: 'Chicken', delta: 20, reason: 'restock', note: 'Weekly delivery', createdAt: Date.now() - 3 * 60 * 60 * 1000 },
  { id: 'mv-4', itemId: 'itm-10', itemName: 'Mutton', delta: -3, reason: 'wastage', note: 'Spoiled — cold storage issue', createdAt: Date.now() - 5 * 60 * 60 * 1000 },
  { id: 'mv-5', itemId: 'itm-18', itemName: 'Soda Water', delta: -4, reason: 'kitchen-use', createdAt: Date.now() - 8 * 60 * 60 * 1000 },
  { id: 'mv-6', itemId: 'itm-20', itemName: 'Paper Bags', delta: -15, reason: 'kitchen-use', createdAt: Date.now() - 20 * 60 * 60 * 1000 },
];

const SEED_PURCHASE_ORDERS: PurchaseOrder[] = [
  {
    id: 'po-1', poNumber: 'PO-1001', supplierId: 'sup-1', status: 'received',
    lines: [{ itemId: 'itm-1', itemName: 'Tomatoes', qty: 20, costPerUnit: 38 }, { itemId: 'itm-2', itemName: 'Onions', qty: 50, costPerUnit: 33 }],
    expectedDate: daysFromNow(-2), createdAt: Date.now() - 3 * 24 * 60 * 60 * 1000, receivedAt: Date.now() - 2 * 24 * 60 * 60 * 1000,
  },
  {
    id: 'po-2', poNumber: 'PO-1002', supplierId: 'sup-2', status: 'ordered',
    lines: [{ itemId: 'itm-5', itemName: 'Paneer', qty: 15, costPerUnit: 310 }, { itemId: 'itm-6', itemName: 'Fresh Cream', qty: 10, costPerUnit: 215 }],
    expectedDate: daysFromNow(1), createdAt: Date.now() - 24 * 60 * 60 * 1000,
  },
  {
    id: 'po-3', poNumber: 'PO-1003', supplierId: 'sup-3', status: 'draft',
    lines: [{ itemId: 'itm-10', itemName: 'Mutton', qty: 10, costPerUnit: 640 }],
    expectedDate: null, createdAt: Date.now() - 2 * 60 * 60 * 1000,
  },
  {
    id: 'po-4', poNumber: 'PO-1004', supplierId: 'sup-4', status: 'ordered',
    lines: [{ itemId: 'itm-15', itemName: 'Red Chilli Powder', qty: 5, costPerUnit: 315 }, { itemId: 'itm-16', itemName: 'Cooking Oil', qty: 20, costPerUnit: 148 }],
    expectedDate: daysFromNow(2), createdAt: Date.now() - 12 * 60 * 60 * 1000,
  },
];

/* =====================================================================
   Small presentational pieces
   ===================================================================== */

function StatusBadge({ status }: { status: StockStatus }) {
  const meta = {
    out: { label: 'Out of stock', color: '#C4633B' },
    low: { label: 'Low stock', color: '#D9A441' },
    ok: { label: 'In stock', color: '#6FA37E' },
  }[status];
  return <span className="inv-status-badge" style={{ color: meta.color, background: `${meta.color}1F` }}>{meta.label}</span>;
}

function PoStatusBadge({ status }: { status: PurchaseOrderStatus }) {
  const meta: Record<PurchaseOrderStatus, { label: string; color: string }> = {
    draft: { label: 'Draft', color: '#8B9296' },
    ordered: { label: 'Ordered', color: '#7E9BB0' },
    received: { label: 'Received', color: '#6FA37E' },
    cancelled: { label: 'Cancelled', color: '#A8798A' },
  };
  const m = meta[status];
  return <span className="inv-status-badge" style={{ color: m.color, background: `${m.color}1F` }}>{m.label}</span>;
}

function InvKpiCard({ icon: Icon, label, value, tone }: { icon: LucideIcon; label: string; value: string; tone?: 'danger' | 'warn' }) {
  return (
    <div className="inv-kpi glass-panel">
      <div className={`inv-kpi-icon ${tone ? `inv-kpi-icon--${tone}` : ''}`}>
        <Icon size={17} strokeWidth={1.8} />
      </div>
      <div>
        <p className="inv-kpi-label">{label}</p>
        <p className="inv-kpi-value">{value}</p>
      </div>
    </div>
  );
}

function Modal({ title, onClose, children, width = 480 }: { title: string; onClose: () => void; children: ReactNode; width?: number }) {
  return (
    <div className="inv-modal-backdrop" onClick={onClose}>
      <div className="inv-modal" style={{ maxWidth: width }} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="inv-modal-header">
          <h3>{title}</h3>
          <button className="inv-modal-close" type="button" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>
        <div className="inv-modal-body">{children}</div>
      </div>
    </div>
  );
}

function ValueByCategoryCard({ data }: { data: { category: string; value: number; color: string }[] }) {
  return (
    <div className="ds-card glass-panel inv-side-card">
      <h3 className="inv-side-title"><IndianRupee size={15} /> Value by category</h3>
      {data.length === 0 ? (
        <p className="inv-side-empty">No stock value yet.</p>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={150}>
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="category" innerRadius={42} outerRadius={64} paddingAngle={2}>
                {data.map((d) => <Cell key={d.category} fill={d.color} />)}
              </Pie>
              <Tooltip
                contentStyle={{ background: '#14181c', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, fontSize: 12 }}
                formatter={(value) => formatRupees(Number(value ?? 0))}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="inv-legend">
            {data.slice(0, 5).map((d) => (
              <div key={d.category} className="inv-legend-row">
                <span className="inv-legend-dot" style={{ background: d.color }} />
                <span className="inv-legend-label">{d.category}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function NeedsAttentionPanel({ items, onAdjust }: { items: InventoryItem[]; onAdjust: (item: InventoryItem) => void }) {
  const flagged = useMemo(() => {
    const rank = (i: InventoryItem) => {
      const s = computeStatus(i);
      if (s === 'out') return 0;
      if (s === 'low') return 1;
      return 2;
    };
    return items
      .filter((i) => computeStatus(i) !== 'ok' || isExpiringSoon(i.expiryDate))
      .sort((a, b) => rank(a) - rank(b))
      .slice(0, 8);
  }, [items]);

  return (
    <div className="ds-card glass-panel inv-side-card">
      <h3 className="inv-side-title"><AlertTriangle size={15} /> Needs attention</h3>
      {flagged.length === 0 ? (
        <p className="inv-side-empty">Everything's well stocked.</p>
      ) : (
        <div className="inv-attention-list">
          {flagged.map((item) => {
            const status = computeStatus(item);
            const note = status === 'out'
              ? 'Out of stock'
              : status === 'low'
                ? `${formatQty(item.stock)} ${item.unit} left`
                : item.expiryDate ? expiryLabel(item.expiryDate) : '';
            return (
              <button key={item.id} type="button" className="inv-attention-row" onClick={() => onAdjust(item)}>
                <span className={`inv-attention-dot inv-attention-dot--${status}`} />
                <span className="inv-attention-name">{item.name}</span>
                <span className="inv-attention-note">{note}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RecentActivityPanel({ movements }: { movements: StockMovement[] }) {
  const recent = useMemo(() => [...movements].sort((a, b) => b.createdAt - a.createdAt).slice(0, 6), [movements]);
  return (
    <div className="ds-card glass-panel inv-side-card">
      <h3 className="inv-side-title"><RefreshCw size={15} /> Recent activity</h3>
      {recent.length === 0 ? (
        <p className="inv-side-empty">No stock movements yet.</p>
      ) : (
        <div className="inv-activity-list">
          {recent.map((m) => (
            <div key={m.id} className="inv-activity-row">
              <span className={`inv-activity-delta ${m.delta >= 0 ? 'inv-activity-delta--in' : 'inv-activity-delta--out'}`}>
                {m.delta >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                {m.delta >= 0 ? '+' : ''}{formatQty(m.delta)}
              </span>
              <div className="inv-activity-body">
                <span className="inv-activity-name">{m.itemName}</span>
                <span className="inv-activity-meta">{REASON_LABELS[m.reason]} · {timeAgo(m.createdAt)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* =====================================================================
   Modals
   ===================================================================== */

function ItemFormModal({
  initial, suppliers, onClose, onSave,
}: {
  initial: InventoryItem | null;
  suppliers: Supplier[];
  onClose: () => void;
  onSave: (item: InventoryItem) => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [category, setCategory] = useState<InventoryCategory>(initial?.category ?? CATEGORIES[0]);
  const [unit, setUnit] = useState<Unit>(initial?.unit ?? 'kg');
  const [stock, setStock] = useState(initial ? String(initial.stock) : '');
  const [threshold, setThreshold] = useState(initial ? String(initial.reorderThreshold) : '');
  const [cost, setCost] = useState(initial ? String(initial.costPerUnit) : '');
  const [supplierId, setSupplierId] = useState(initial?.supplierId ?? '');
  const [expiryDate, setExpiryDate] = useState(initial?.expiryDate ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');

  const canSave = name.trim().length > 0
    && stock.trim() !== '' && !Number.isNaN(Number(stock))
    && threshold.trim() !== '' && !Number.isNaN(Number(threshold))
    && cost.trim() !== '' && !Number.isNaN(Number(cost));

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    onSave({
      id: initial?.id ?? crypto.randomUUID(),
      name: name.trim(),
      category,
      unit,
      stock: Number(stock),
      reorderThreshold: Number(threshold),
      costPerUnit: Number(cost),
      supplierId: supplierId || null,
      expiryDate: expiryDate || null,
      notes: notes.trim() || undefined,
      updatedAt: Date.now(),
    });
  };

  return (
    <Modal title={initial ? 'Edit item' : 'Add inventory item'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="ds-form">
        <div className="ds-input-group">
          <label>Item name</label>
          <input className="ds-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Paneer" />
        </div>

        <div className="ds-row">
          <div className="ds-input-group">
            <label>Category</label>
            <select className="ds-input" value={category} onChange={(e) => setCategory(e.target.value as InventoryCategory)}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="ds-input-group">
            <label>Unit</label>
            <select className="ds-input" value={unit} onChange={(e) => setUnit(e.target.value as Unit)}>
              {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        </div>

        <div className="ds-row">
          <div className="ds-input-group">
            <label>Current stock</label>
            <input className="ds-input" type="number" min="0" step="0.01" value={stock} onChange={(e) => setStock(e.target.value)} />
          </div>
          <div className="ds-input-group">
            <label>Reorder threshold</label>
            <input className="ds-input" type="number" min="0" step="0.01" value={threshold} onChange={(e) => setThreshold(e.target.value)} />
          </div>
        </div>

        <div className="ds-row">
          <div className="ds-input-group">
            <label>Cost per unit (₹)</label>
            <input className="ds-input" type="number" min="0" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} />
          </div>
          <div className="ds-input-group">
            <label>Expiry date (optional)</label>
            <input className="ds-input" type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
          </div>
        </div>

        <div className="ds-input-group">
          <label>Supplier (optional)</label>
          <select className="ds-input" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
            <option value="">No supplier</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        <div className="ds-input-group">
          <label>Notes (optional)</label>
          <textarea className="ds-input ds-textarea" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <div className="inv-modal-footer">
          <button type="button" className="ds-btn ds-btn-outline" onClick={onClose}>Cancel</button>
          <button type="submit" className="ds-btn ds-btn-primary" disabled={!canSave}>
            <Save size={16} /> {initial ? 'Save changes' : 'Add item'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function StockAdjustModal({
  item, onClose, onAdjust,
}: {
  item: InventoryItem;
  onClose: () => void;
  onAdjust: (delta: number, reason: MovementReason, note: string) => void;
}) {
  const [direction, setDirection] = useState<'in' | 'out'>('in');
  const [qty, setQty] = useState('');
  const [reason, setReason] = useState<MovementReason>('restock');
  const [note, setNote] = useState('');

  const qtyNum = Number(qty);
  const validQty = qty.trim() !== '' && !Number.isNaN(qtyNum) && qtyNum > 0;
  const exceedsStock = direction === 'out' && validQty && qtyNum > item.stock;
  const canSave = validQty && !exceedsStock;

  const inReasons: { value: MovementReason; label: string }[] = [
    { value: 'restock', label: REASON_LABELS.restock },
    { value: 'correction', label: REASON_LABELS.correction },
  ];
  const outReasons: { value: MovementReason; label: string }[] = [
    { value: 'kitchen-use', label: REASON_LABELS['kitchen-use'] },
    { value: 'wastage', label: REASON_LABELS.wastage },
    { value: 'returned', label: REASON_LABELS.returned },
    { value: 'correction', label: REASON_LABELS.correction },
  ];
  const reasonOptions = direction === 'in' ? inReasons : outReasons;

  const handleDirectionChange = (next: 'in' | 'out') => {
    setDirection(next);
    setReason(next === 'in' ? 'restock' : 'kitchen-use');
  };

  const newStock = Math.max(0, direction === 'in' ? item.stock + (validQty ? qtyNum : 0) : item.stock - (validQty ? qtyNum : 0));

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    onAdjust(direction === 'in' ? qtyNum : -qtyNum, reason, note.trim());
  };

  return (
    <Modal title="Adjust stock" onClose={onClose}>
      <form onSubmit={handleSubmit} className="ds-form">
        <div className="inv-adjust-item">
          <span className="inv-adjust-item-name">{item.name}</span>
          <span className="inv-adjust-item-current">Current: {formatQty(item.stock)} {item.unit}</span>
        </div>

        <div className="inv-direction-toggle">
          <button type="button" className={direction === 'in' ? 'active' : ''} onClick={() => handleDirectionChange('in')}>
            <ArrowUpRight size={14} /> Stock in
          </button>
          <button type="button" className={direction === 'out' ? 'active' : ''} onClick={() => handleDirectionChange('out')}>
            <ArrowDownRight size={14} /> Stock out
          </button>
        </div>

        <div className="ds-row">
          <div className="ds-input-group">
            <label>Quantity ({item.unit})</label>
            <input className="ds-input" type="number" min="0" step="0.01" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="0" />
          </div>
          <div className="ds-input-group">
            <label>Reason</label>
            <select className="ds-input" value={reason} onChange={(e) => setReason(e.target.value as MovementReason)}>
              {reasonOptions.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
        </div>

        <div className="ds-input-group">
          <label>Note (optional)</label>
          <input className="ds-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Delivery from Fresh Farm Produce" />
        </div>

        {exceedsStock && <p className="inv-field-error">Only {formatQty(item.stock)} {item.unit} in stock.</p>}

        <div className="inv-adjust-preview">
          New stock level: <strong>{formatQty(newStock)} {item.unit}</strong>
        </div>

        <div className="inv-modal-footer">
          <button type="button" className="ds-btn ds-btn-outline" onClick={onClose}>Cancel</button>
          <button type="submit" className="ds-btn ds-btn-primary" disabled={!canSave}>
            <Check size={16} /> Save adjustment
          </button>
        </div>
      </form>
    </Modal>
  );
}

function SupplierFormModal({
  initial, onClose, onSave,
}: {
  initial: Supplier | null;
  onClose: () => void;
  onSave: (supplier: Supplier) => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [contactPerson, setContactPerson] = useState(initial?.contactPerson ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [email, setEmail] = useState(initial?.email ?? '');
  const [address, setAddress] = useState(initial?.address ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');

  const canSave = name.trim().length > 0 && phone.trim().length > 0;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    onSave({
      id: initial?.id ?? crypto.randomUUID(),
      name: name.trim(),
      contactPerson: contactPerson.trim(),
      phone: phone.trim(),
      email: email.trim(),
      address: address.trim(),
      notes: notes.trim() || undefined,
    });
  };

  return (
    <Modal title={initial ? 'Edit supplier' : 'Add supplier'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="ds-form">
        <div className="ds-input-group">
          <label>Supplier name</label>
          <input className="ds-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Fresh Farm Produce" />
        </div>
        <div className="ds-row">
          <div className="ds-input-group">
            <label>Contact person</label>
            <input className="ds-input" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} placeholder="e.g. Ramesh Gupta" />
          </div>
          <div className="ds-input-group">
            <label>Phone</label>
            <input className="ds-input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="98765 43210" />
          </div>
        </div>
        <div className="ds-input-group">
          <label>Email (optional)</label>
          <input className="ds-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="orders@supplier.com" />
        </div>
        <div className="ds-input-group">
          <label>Address (optional)</label>
          <input className="ds-input" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Shop no, street, city" />
        </div>
        <div className="ds-input-group">
          <label>Notes (optional)</label>
          <textarea className="ds-input ds-textarea" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <div className="inv-modal-footer">
          <button type="button" className="ds-btn ds-btn-outline" onClick={onClose}>Cancel</button>
          <button type="submit" className="ds-btn ds-btn-primary" disabled={!canSave}>
            <Save size={16} /> {initial ? 'Save changes' : 'Add supplier'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

interface DraftLine { key: string; itemId: string; qty: string; costPerUnit: string }

function PurchaseOrderFormModal({
  items, suppliers, onClose, onSave,
}: {
  items: InventoryItem[];
  suppliers: Supplier[];
  onClose: () => void;
  onSave: (draft: { supplierId: string; expectedDate: string | null; lines: PurchaseOrderLine[] }) => void;
}) {
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? '');
  const [expectedDate, setExpectedDate] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([{ key: crypto.randomUUID(), itemId: '', qty: '', costPerUnit: '' }]);

  const updateLine = (key: string, patch: Partial<DraftLine>) => {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  };

  const addLine = () => setLines((prev) => [...prev, { key: crypto.randomUUID(), itemId: '', qty: '', costPerUnit: '' }]);
  const removeLine = (key: string) => setLines((prev) => (prev.length > 1 ? prev.filter((l) => l.key !== key) : prev));

  const handleItemPick = (key: string, itemId: string) => {
    const item = items.find((i) => i.id === itemId);
    updateLine(key, { itemId, costPerUnit: item ? String(item.costPerUnit) : '' });
  };

  const validLines = lines.filter((l) => l.itemId && Number(l.qty) > 0 && l.costPerUnit !== '' && !Number.isNaN(Number(l.costPerUnit)));
  const canSave = Boolean(supplierId) && validLines.length > 0;
  const total = validLines.reduce((sum, l) => sum + Number(l.qty) * Number(l.costPerUnit), 0);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    onSave({
      supplierId,
      expectedDate: expectedDate || null,
      lines: validLines.map((l) => ({
        itemId: l.itemId,
        itemName: items.find((i) => i.id === l.itemId)?.name ?? 'Unknown item',
        qty: Number(l.qty),
        costPerUnit: Number(l.costPerUnit),
      })),
    });
  };

  return (
    <Modal title="New purchase order" width={560} onClose={onClose}>
      <form onSubmit={handleSubmit} className="ds-form">
        <div className="ds-row">
          <div className="ds-input-group">
            <label>Supplier</label>
            <select className="ds-input" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
              {suppliers.length === 0 && <option value="">Add a supplier first</option>}
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="ds-input-group">
            <label>Expected delivery (optional)</label>
            <input className="ds-input" type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} />
          </div>
        </div>

        <label className="inv-lines-label">Items</label>

        <div className="inv-po-lines">
          {lines.map((line) => (
            <div key={line.key} className="inv-po-line">
              <select className="ds-input" value={line.itemId} onChange={(e) => handleItemPick(line.key, e.target.value)}>
                <option value="">Select item…</option>
                {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
              <input
                className="ds-input"
                type="number"
                min="0"
                step="0.01"
                placeholder="Qty"
                value={line.qty}
                onChange={(e) => updateLine(line.key, { qty: e.target.value })}
              />
              <input
                className="ds-input"
                type="number"
                min="0"
                step="0.01"
                placeholder="₹/unit"
                value={line.costPerUnit}
                onChange={(e) => updateLine(line.key, { costPerUnit: e.target.value })}
              />
              <button type="button" className="inv-icon-btn inv-icon-btn--danger" onClick={() => removeLine(line.key)} title="Remove line">
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>

        <button type="button" className="inv-add-line-btn" onClick={addLine}>
          <Plus size={14} /> Add line
        </button>

        <div className="inv-po-total">
          <span>Total</span>
          <span>{formatRupees(total)}</span>
        </div>

        <div className="inv-modal-footer">
          <button type="button" className="ds-btn ds-btn-outline" onClick={onClose}>Cancel</button>
          <button type="submit" className="ds-btn ds-btn-primary" disabled={!canSave}>
            <FileText size={16} /> Create order
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* =====================================================================
   Root
   ===================================================================== */

type SubTab = 'items' | 'orders' | 'suppliers';

export default function Inventory() {
  const [items, setItems] = useState<InventoryItem[]>(SEED_ITEMS);
  const [suppliers, setSuppliers] = useState<Supplier[]>(SEED_SUPPLIERS);
  const [movements, setMovements] = useState<StockMovement[]>(SEED_MOVEMENTS);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>(SEED_PURCHASE_ORDERS);

  const [subTab, setSubTab] = useState<SubTab>('items');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<InventoryCategory | 'all'>('all');

  const [itemModal, setItemModal] = useState<{ mode: 'add' } | { mode: 'edit'; item: InventoryItem } | null>(null);
  const [adjustModalItem, setAdjustModalItem] = useState<InventoryItem | null>(null);
  const [supplierModal, setSupplierModal] = useState<{ mode: 'add' } | { mode: 'edit'; supplier: Supplier } | null>(null);
  const [poModalOpen, setPoModalOpen] = useState(false);

  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  };

  const supplierById = useMemo(() => new Map(suppliers.map((s) => [s.id, s])), [suppliers]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items
      .filter((i) => (categoryFilter === 'all' || i.category === categoryFilter) && (!q || i.name.toLowerCase().includes(q)))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [items, search, categoryFilter]);

  const totalValue = useMemo(() => items.reduce((sum, i) => sum + i.stock * i.costPerUnit, 0), [items]);
  const lowStockCount = useMemo(() => items.filter((i) => computeStatus(i) === 'low').length, [items]);
  const outOfStockCount = useMemo(() => items.filter((i) => computeStatus(i) === 'out').length, [items]);
  const expiringCount = useMemo(() => items.filter((i) => isExpiringSoon(i.expiryDate)).length, [items]);

  const categoryValueData = useMemo(() => {
    const map = new Map<InventoryCategory, number>();
    items.forEach((i) => map.set(i.category, (map.get(i.category) ?? 0) + i.stock * i.costPerUnit));
    return Array.from(map.entries())
      .map(([category, value]) => ({ category, value, color: CATEGORY_META[category].color }))
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [items]);

  // --- item handlers ---

  const handleSaveItem = (item: InventoryItem) => {
    const wasEdit = itemModal?.mode === 'edit';
    setItems((prev) => (prev.some((i) => i.id === item.id) ? prev.map((i) => (i.id === item.id ? item : i)) : [...prev, item]));
    setItemModal(null);
    showToast(wasEdit ? 'Item updated' : 'Item added');
  };

  const handleDeleteItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    showToast('Item removed');
  };

  const handleAdjustStock = (delta: number, reason: MovementReason, note: string) => {
    if (!adjustModalItem) return;
    const item = adjustModalItem;
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, stock: Math.max(0, i.stock + delta), updatedAt: Date.now() } : i)));
    setMovements((prev) => [
      { id: crypto.randomUUID(), itemId: item.id, itemName: item.name, delta, reason, note: note || undefined, createdAt: Date.now() },
      ...prev,
    ]);
    setAdjustModalItem(null);
    showToast('Stock updated');
  };

  // --- supplier handlers ---

  const handleSaveSupplier = (supplier: Supplier) => {
    const wasEdit = supplierModal?.mode === 'edit';
    setSuppliers((prev) => (prev.some((s) => s.id === supplier.id) ? prev.map((s) => (s.id === supplier.id ? supplier : s)) : [...prev, supplier]));
    setSupplierModal(null);
    showToast(wasEdit ? 'Supplier updated' : 'Supplier added');
  };

  const handleDeleteSupplier = (id: string) => {
    setSuppliers((prev) => prev.filter((s) => s.id !== id));
    showToast('Supplier removed');
  };

  // --- purchase order handlers ---

  const handleCreatePO = (draft: { supplierId: string; expectedDate: string | null; lines: PurchaseOrderLine[] }) => {
    const po: PurchaseOrder = {
      id: crypto.randomUUID(),
      poNumber: `PO-${1000 + purchaseOrders.length + 1}`,
      supplierId: draft.supplierId,
      status: 'draft',
      lines: draft.lines,
      expectedDate: draft.expectedDate,
      createdAt: Date.now(),
    };
    setPurchaseOrders((prev) => [po, ...prev]);
    setPoModalOpen(false);
    showToast('Purchase order created');
  };

  const handlePOStatusChange = (poId: string, status: PurchaseOrderStatus) => {
    const po = purchaseOrders.find((p) => p.id === poId);
    if (!po) return;

    if (status === 'received') {
      setItems((prevItems) => {
        let next = prevItems;
        po.lines.forEach((line) => {
          next = next.map((i) => (i.id === line.itemId ? { ...i, stock: i.stock + line.qty, updatedAt: Date.now() } : i));
        });
        return next;
      });
      const supplierName = supplierById.get(po.supplierId)?.name ?? 'supplier';
      setMovements((prev) => [
        ...po.lines.map((line) => ({
          id: crypto.randomUUID(),
          itemId: line.itemId,
          itemName: line.itemName,
          delta: line.qty,
          reason: 'restock' as MovementReason,
          note: `Received from ${supplierName} (${po.poNumber})`,
          createdAt: Date.now(),
        })),
        ...prev,
      ]);
    }

    setPurchaseOrders((prev) => prev.map((p) => (p.id === poId ? { ...p, status, receivedAt: status === 'received' ? Date.now() : p.receivedAt } : p)));
    showToast(
      status === 'received' ? 'Stock received and updated'
        : status === 'ordered' ? 'Order marked as placed'
          : status === 'cancelled' ? 'Order cancelled'
            : 'Order updated',
    );
  };

  const handleDeletePO = (id: string) => {
    setPurchaseOrders((prev) => prev.filter((p) => p.id !== id));
    showToast('Order deleted');
  };

  return (
    <div className="ds-view fade-in inv-view">
      <header className="ds-header">
        <div>
          <h1 className="ds-title">Inventory</h1>
          <p className="ds-subtitle">Stock levels, suppliers, and purchase orders.</p>
        </div>
        <div className="inv-subtab-switch">
          <button type="button" className={subTab === 'items' ? 'active' : ''} onClick={() => setSubTab('items')}>
            <Boxes size={14} /> Stock Items
          </button>
          <button type="button" className={subTab === 'orders' ? 'active' : ''} onClick={() => setSubTab('orders')}>
            <FileText size={14} /> Purchase Orders
          </button>
          <button type="button" className={subTab === 'suppliers' ? 'active' : ''} onClick={() => setSubTab('suppliers')}>
            <Truck size={14} /> Suppliers
          </button>
        </div>
      </header>

      <div className="inv-kpi-grid">
        <InvKpiCard icon={IndianRupee} label="Total inventory value" value={formatRupees(totalValue)} />
        <InvKpiCard icon={TrendingDown} label="Low stock items" value={String(lowStockCount)} tone={lowStockCount > 0 ? 'warn' : undefined} />
        <InvKpiCard icon={PackageX} label="Out of stock" value={String(outOfStockCount)} tone={outOfStockCount > 0 ? 'danger' : undefined} />
        <InvKpiCard icon={CalendarClock} label="Expiring soon" value={String(expiringCount)} tone={expiringCount > 0 ? 'warn' : undefined} />
      </div>

      {subTab === 'items' && (
        <>
          <div className="inv-toolbar">
            <div className="inv-search-box">
              <Search size={15} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search items…" />
            </div>
            <div className="inv-category-pills">
              <button type="button" className={categoryFilter === 'all' ? 'active' : ''} onClick={() => setCategoryFilter('all')}>All</button>
              {CATEGORIES.map((c) => (
                <button key={c} type="button" className={categoryFilter === c ? 'active' : ''} onClick={() => setCategoryFilter(c)}>{c}</button>
              ))}
            </div>
            <button type="button" className="ds-btn ds-btn-primary inv-toolbar-add" onClick={() => setItemModal({ mode: 'add' })}>
              <Plus size={16} /> Add item
            </button>
          </div>

          <div className="inv-items-layout">
            <div className="ds-card glass-panel inv-table-card">
              <div className="inv-table-scroll">
                <table className="inv-table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Stock</th>
                      <th>Status</th>
                      <th>Cost/unit</th>
                      <th>Value</th>
                      <th>Supplier</th>
                      <th>Expiry</th>
                      <th aria-label="Actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map((item) => {
                      const status = computeStatus(item);
                      const meta = CATEGORY_META[item.category];
                      const Icon = meta.icon;
                      const supplier = item.supplierId ? supplierById.get(item.supplierId) : null;
                      const ratio = Math.min(1, item.stock / Math.max(item.reorderThreshold * 2, 1));
                      return (
                        <tr key={item.id}>
                          <td>
                            <div className="inv-item-cell">
                              <span className="inv-item-icon" style={{ background: `${meta.color}22`, color: meta.color }}>
                                <Icon size={15} strokeWidth={1.8} />
                              </span>
                              <div>
                                <p className="inv-item-name">{item.name}</p>
                                <p className="inv-item-category">{item.category}</p>
                              </div>
                            </div>
                          </td>
                          <td>
                            <div className="inv-stock-cell">
                              <span>{formatQty(item.stock)} {item.unit}</span>
                              <div className="inv-stock-bar">
                                <div className={`inv-stock-bar-fill inv-stock-bar-fill--${status}`} style={{ width: `${ratio * 100}%` }} />
                              </div>
                            </div>
                          </td>
                          <td><StatusBadge status={status} /></td>
                          <td>{formatRupees(item.costPerUnit)}</td>
                          <td>{formatRupees(item.stock * item.costPerUnit)}</td>
                          <td>{supplier ? supplier.name : <span className="inv-muted">—</span>}</td>
                          <td>
                            {item.expiryDate
                              ? <span className={`inv-expiry inv-expiry--${expiryTone(item.expiryDate)}`}>{expiryLabel(item.expiryDate)}</span>
                              : <span className="inv-muted">—</span>}
                          </td>
                          <td>
                            <div className="inv-row-actions">
                              <button type="button" className="inv-icon-btn" onClick={() => setAdjustModalItem(item)} title="Adjust stock">
                                <Boxes size={15} />
                              </button>
                              <button type="button" className="inv-icon-btn" onClick={() => setItemModal({ mode: 'edit', item })} title="Edit item">
                                <Pencil size={15} />
                              </button>
                              <button type="button" className="inv-icon-btn inv-icon-btn--danger" onClick={() => handleDeleteItem(item.id)} title="Delete item">
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {filteredItems.length === 0 && (
                  <div className="ds-empty-state">
                    <Package size={40} opacity={0.2} />
                    <p>No items match your filters.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="inv-sidebar">
              <ValueByCategoryCard data={categoryValueData} />
              <NeedsAttentionPanel items={items} onAdjust={setAdjustModalItem} />
              <RecentActivityPanel movements={movements} />
            </div>
          </div>
        </>
      )}

      {subTab === 'orders' && (
        <>
          <div className="inv-toolbar inv-toolbar--end">
            <button type="button" className="ds-btn ds-btn-primary" onClick={() => setPoModalOpen(true)}>
              <Plus size={16} /> New purchase order
            </button>
          </div>

          <div className="inv-po-list">
            {purchaseOrders.length === 0 ? (
              <div className="ds-empty-state">
                <FileText size={40} opacity={0.2} />
                <p>No purchase orders yet.</p>
              </div>
            ) : purchaseOrders.map((po) => {
              const supplier = supplierById.get(po.supplierId);
              const total = po.lines.reduce((sum, l) => sum + l.qty * l.costPerUnit, 0);
              return (
                <div key={po.id} className="ds-card glass-panel inv-po-card">
                  <div className="inv-po-card-header">
                    <div>
                      <p className="inv-po-number">{po.poNumber}</p>
                      <p className="inv-po-supplier">{supplier?.name ?? 'Unknown supplier'}</p>
                    </div>
                    <PoStatusBadge status={po.status} />
                  </div>

                  <div className="inv-po-lines-preview">
                    {po.lines.map((l) => (
                      <div key={l.itemId} className="inv-po-line-preview">
                        <span>{formatQty(l.qty)}× {l.itemName}</span>
                        <span>{formatRupees(l.qty * l.costPerUnit)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="inv-po-footer">
                    <div className="inv-po-footer-meta">
                      {po.expectedDate && <span>Expected {new Date(po.expectedDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>}
                      {po.status === 'received' && po.receivedAt && <span>Received {new Date(po.receivedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>}
                    </div>
                    <div className="inv-po-footer-right">
                      <span className="inv-po-total-inline">{formatRupees(total)}</span>
                      {po.status === 'draft' && (
                        <div className="inv-po-actions">
                          <button type="button" className="ds-btn ds-btn-outline inv-po-btn" onClick={() => handleDeletePO(po.id)}>Delete</button>
                          <button type="button" className="ds-btn ds-btn-secondary inv-po-btn" onClick={() => handlePOStatusChange(po.id, 'ordered')}>
                            <Truck size={14} /> Mark as ordered
                          </button>
                        </div>
                      )}
                      {po.status === 'ordered' && (
                        <div className="inv-po-actions">
                          <button type="button" className="ds-btn ds-btn-outline inv-po-btn" onClick={() => handlePOStatusChange(po.id, 'cancelled')}>Cancel</button>
                          <button type="button" className="ds-btn ds-btn-primary inv-po-btn" onClick={() => handlePOStatusChange(po.id, 'received')}>
                            <PackageCheck size={14} /> Mark received
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {subTab === 'suppliers' && (
        <>
          <div className="inv-toolbar inv-toolbar--end">
            <button type="button" className="ds-btn ds-btn-primary" onClick={() => setSupplierModal({ mode: 'add' })}>
              <Plus size={16} /> Add supplier
            </button>
          </div>

          <div className="ds-grid-3-col">
            {suppliers.map((s) => {
              const itemCount = items.filter((i) => i.supplierId === s.id).length;
              const poCount = purchaseOrders.filter((p) => p.supplierId === s.id).length;
              return (
                <div key={s.id} className="ds-card glass-panel inv-supplier-card">
                  <div className="inv-supplier-header">
                    <div className="inv-supplier-avatar"><Truck size={18} /></div>
                    <div className="inv-supplier-actions">
                      <button type="button" className="inv-icon-btn" onClick={() => setSupplierModal({ mode: 'edit', supplier: s })} title="Edit">
                        <Pencil size={14} />
                      </button>
                      <button type="button" className="inv-icon-btn inv-icon-btn--danger" onClick={() => handleDeleteSupplier(s.id)} title="Delete">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <h4 className="inv-supplier-name">{s.name}</h4>
                  {s.contactPerson && <p className="inv-supplier-contact">{s.contactPerson}</p>}
                  <div className="inv-supplier-meta">
                    {s.phone && <span><Phone size={12} /> {s.phone}</span>}
                    {s.email && <span><Mail size={12} /> {s.email}</span>}
                  </div>
                  <div className="inv-supplier-stats">
                    <span>{itemCount} items</span>
                    <span>{poCount} orders</span>
                  </div>
                </div>
              );
            })}
            {suppliers.length === 0 && (
              <div className="ds-empty-state col-span-full">
                <Truck size={40} opacity={0.2} />
                <p>No suppliers added yet.</p>
              </div>
            )}
          </div>
        </>
      )}

      {toast && <div className="inv-toast"><Check size={14} /> {toast}</div>}

      {itemModal && (
        <ItemFormModal
          initial={itemModal.mode === 'edit' ? itemModal.item : null}
          suppliers={suppliers}
          onClose={() => setItemModal(null)}
          onSave={handleSaveItem}
        />
      )}
      {adjustModalItem && (
        <StockAdjustModal item={adjustModalItem} onClose={() => setAdjustModalItem(null)} onAdjust={handleAdjustStock} />
      )}
      {supplierModal && (
        <SupplierFormModal
          initial={supplierModal.mode === 'edit' ? supplierModal.supplier : null}
          onClose={() => setSupplierModal(null)}
          onSave={handleSaveSupplier}
        />
      )}
      {poModalOpen && (
        <PurchaseOrderFormModal items={items} suppliers={suppliers} onClose={() => setPoModalOpen(false)} onSave={handleCreatePO} />
      )}
    </div>
  );
}