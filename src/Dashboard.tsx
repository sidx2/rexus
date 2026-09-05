
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Plus,
  Printer,
  UtensilsCrossed,
  LayoutGrid,
  Trash2,
  ChefHat,
  Save,
  Loader2,
  Search, RefreshCw, Clock, Sparkles, BellRing,
  CheckCircle2, XCircle, ReceiptText,
  Settings as SettingsIcon,
  LogOut,
  Users,
  ClipboardList,
  Pencil, X, Check, ImagePlus,
  BarChart3,
  Menu
} from 'lucide-react';
import './Dashboard.css';
import type { DateFilter, Order, OrderStatus, Table, MenuItem, Org, AuthResponse } from './models';
import { compressImageFile, getRangeForFilter } from './utils';
import { COLORS, fontSans, fontSerif, ORDER_STATUS_META, getOrdersSocketUrl } from './constants';
import { ConnectionBadge, DateFilterBar, EmptyOrders, OrderCard, StatusFilterPills } from './Components';
import Settings from './Settings';
import * as api from './api';

import Analytics from './Analytics';

interface MenuItemFormState {
  name: string;
  price: string;
  category: string;
  portion: string;
  description: string;
  image: string | null;
}

const EMPTY_ITEM_FORM: MenuItemFormState = {
  name: '', price: '', category: '', portion: '', description: '', image: null,
};

type Tab = 'menu' | 'tables' | 'orders' | 'analytics' | 'settings';

export default function Dashboard({
  auth, onOrgUpdated, onLogout,
}: {
  auth: AuthResponse;
  onOrgUpdated: (org: Org) => void;
  onLogout: () => void;
}) {
  const { token, org, user } = auth;
  const [activeTab, setActiveTab] = useState<Tab>('menu');

  // Theme is applied here, once, at the root of the dashboard — every
  // child (order cards, buttons, active nav state, etc, via COLORS/
  // Dashboard.css) reads it back out through these CSS custom properties.
  const themeVars = useMemo(
    () =>
      ({
        '--brand-primary': org.theme.primary,
        '--brand-primary-dark': org.theme.primaryDark,
        '--brand-accent': org.theme.accent,
        '--brand-accent-soft': org.theme.accentSoft,
      }) as React.CSSProperties,
    [org.theme]
  );

  // -----------------------------------------------------------------
  // Menu state
  // -----------------------------------------------------------------
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [newItem, setNewItem] = useState({ name: '', price: '', category: '' });
  const [isFetchingMenu, setIsFetchingMenu] = useState(true);
  const [isSavingMenu, setIsSavingMenu] = useState(false);
  const [menuError, setMenuError] = useState<string | null>(null);

  const [itemForm, setItemForm] = useState<MenuItemFormState>(EMPTY_ITEM_FORM);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const formCardRef = useRef<HTMLDivElement>(null);

  const resetItemForm = () => {
    setItemForm(EMPTY_ITEM_FORM);
    setEditingItemId(null);
    setImageError(null);
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // lets the same file be re-selected later if removed
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setImageError('Please choose an image file.');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setImageError('That image is too large (max 8MB).');
      return;
    }
    setIsProcessingImage(true);
    setImageError(null);
    try {
      const dataUrl = await compressImageFile(file);
      setItemForm((prev) => ({ ...prev, image: dataUrl }));
    } catch (err) {
      setImageError(err instanceof Error ? err.message : 'Could not process that image.');
    } finally {
      setIsProcessingImage(false);
    }
  };

  const handleRemoveImage = () => setItemForm((prev) => ({ ...prev, image: null }));

  const handleSubmitItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemForm.name || !itemForm.price || !itemForm.category) return;
    if (editingItemId) {
      setMenuItems((prev) => prev.map((item) => (item.id === editingItemId ? { ...item, ...patch } : item)));
    } else {
      setMenuItems((prev) => [...prev, { id: crypto.randomUUID(), ...patch }]);
    }
    resetItemForm();
  };

  const handleEditItem = (item: MenuItem) => {
    setEditingItemId(item.id);
    setItemForm({
      name: item.name,
      price: String(item.price),
      category: item.category,
      portion: item.portion ?? '',
      description: item.description ?? '',
      image: item.image ?? null,
    });
    formCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleDeleteItem = (id: string) => {
    setMenuItems((prev) => prev.filter((item) => item.id !== id));
    if (editingItemId === id) resetItemForm();
  };

  const canSubmitItem = Boolean(itemForm.name && itemForm.price && itemForm.category);

  const patch = {
    name: itemForm.name.trim(),
    price: Number(itemForm.price),
    category: itemForm.category.trim(),
    portion: itemForm.portion.trim() || undefined,
    description: itemForm.description.trim() || undefined,
    image: itemForm.image ?? undefined,
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsFetchingMenu(true);
      setMenuError(null);
      try {
        const data = await api.fetchMenu(org.id);
        if (!cancelled) setMenuItems(data);
      } catch (err) {
        if (!cancelled) setMenuError(err instanceof Error ? err.message : 'Could not load the menu.');
      } finally {
        if (!cancelled) setIsFetchingMenu(false);
      }
    })();
    return () => { cancelled = true; };
  }, [org.id]);

  const handleAddMenuItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.name || !newItem.price || !newItem.category) return;
    setMenuItems((prev) => [...prev, {
      id: crypto.randomUUID(),
      name: newItem.name,
      price: Number(newItem.price),
      category: newItem.category.trim(),
    }]);
    setNewItem({ name: '', price: '', category: '' });
  };

  const handleSaveMenu = async () => {
    setIsSavingMenu(true);
    setMenuError(null);
    try {
      await api.saveMenu(org.id, token, menuItems);
    } catch (err) {
      setMenuError(err instanceof Error ? err.message : 'Could not save the menu.');
    } finally {
      setIsSavingMenu(false);
    }
  };

  const groupedMenu = useMemo(() => {
    return menuItems.reduce((acc, item) => {
      if (!acc[item.category]) acc[item.category] = [];
      acc[item.category].push(item);
      return acc;
    }, {} as Record<string, MenuItem[]>);
  }, [menuItems]);

  // -----------------------------------------------------------------
  // Table state
  // -----------------------------------------------------------------
  const [tables, setTables] = useState<Table[]>([]);
  const [newTableName, setNewTableName] = useState('');
  const [newTableSeats, setNewTableSeats] = useState(2);
  const [isFetchingTables, setIsFetchingTables] = useState(true);
  const [isCreatingTable, setIsCreatingTable] = useState(false);
  const [tableError, setTableError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsFetchingTables(true);
      setTableError(null);
      try {
        const data = await api.listTables(org.id, token);
        if (!cancelled) setTables(data);
      } catch (err) {
        if (!cancelled) setTableError(err instanceof Error ? err.message : 'Could not load tables.');
      } finally {
        if (!cancelled) setIsFetchingTables(false);
      }
    })();
    return () => { cancelled = true; };
  }, [org.id, token]);

  const handleCreateTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTableName.trim() || isCreatingTable) return;
    setIsCreatingTable(true);
    setTableError(null);
    try {
      const created = await api.createTable(org.id, token, { name: newTableName.trim(), seats: newTableSeats });
      setTables((prev) => [created, ...prev]);
      setNewTableName('');
      setNewTableSeats(2);
    } catch (err) {
      setTableError(err instanceof Error ? err.message : 'Could not create the table.');
    } finally {
      setIsCreatingTable(false);
    }
  };

  const handleDeleteTable = async (tableId: string) => {
    const prev = tables;
    setTables((cur) => cur.filter((t) => t.id !== tableId));
    try {
      await api.deleteTable(org.id, token, tableId);
    } catch (err) {
      setTables(prev); // roll back on failure
      setTableError(err instanceof Error ? err.message : 'Could not delete the table.');
    }
  };

  const handlePrintQR = (table: Table) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const qrSvg = document.getElementById(`qr-${table.id}`)?.outerHTML;

    printWindow.document.write(`
      <html>
        <head>
          <title>Print - ${table.name}</title>
          <style>
            body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
            .print-card { border: 2px dashed #000; padding: 40px; border-radius: 16px; text-align: center; }
            h1 { margin: 0 0 10px; }
            .qr-wrapper { margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="print-card">
            <h1>${table.name}</h1>
            <p>Scan to order</p>
            <div class="qr-wrapper">${qrSvg}</div>
          </div>
          <script>window.print(); window.onafterprint = () => window.close();</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // -----------------------------------------------------------------
  // Orders — live via WebSocket ("today"), past via REST
  // -----------------------------------------------------------------
  const [orders, setOrders] = useState<Order[]>([]);
  const [connected, setConnected] = useState(false);
  const [newOrderIds, setNewOrderIds] = useState<Set<string>>(new Set());

  const [pastOrders, setPastOrders] = useState<Order[]>([]);
  const [isLoadingPast, setIsLoadingPast] = useState(false);
  const [pastError, setPastError] = useState<string | null>(null);

  const [dateFilter, setDateFilter] = useState<DateFilter>('today');
  const [customRange, setCustomRange] = useState<{ from: string; to: string }>({ from: '', to: '' });
  const [statusFilter, setStatusFilter] = useState<'all' | OrderStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const connectSocket = useCallback(() => {
    console.log("🔥 connectSocket CALLED");

    const existing = socketRef.current;

    console.log(
      "🔥 existing socket:",
      existing?.readyState
    );

    if (
      existing &&
      (
        existing.readyState === WebSocket.CONNECTING ||
        existing.readyState === WebSocket.OPEN
      )
    ) {
      console.log("⛔ WebSocket already active — skipping");

      return;
    }

    console.log("🟢 Creating new WebSocket");
    const socket = new WebSocket(getOrdersSocketUrl(org.id, token));
    socketRef.current = socket;

    socket.onopen = () => {
      reconnectAttemptRef.current = 0;
      setConnected(true);
      socket.send(JSON.stringify({ type: 'orders:subscribe', scope: 'today' }));
    };

    socket.onmessage = (event) => {
      let msg: any;
      try { msg = JSON.parse(event.data); } catch { return; }

      switch (msg.type) {
        case 'orders:sync':
          setOrders(msg.orders as Order[]);
          break;
        case 'order:new':
          setOrders((prev) => [msg.order as Order, ...prev]);
          console.log("msg.order", msg);
          setNewOrderIds((prev) => new Set(prev).add(msg.order.id));
          setTimeout(() => {
            setNewOrderIds((prev) => {
              const next = new Set(prev);
              next.delete(msg.order.id);
              return next;
            });
          }, 4000);
          break;
        case 'order:update':
          setOrders((prev) => prev.map((o) => (o.id === msg.order.id ? msg.order : o)));
          break;
        case 'order:delete':
          setOrders((prev) => prev.filter((o) => o.id !== msg.orderId));
          break;
      }
    };

    socket.onclose = () => {
      setConnected(false);
      if (!mountedRef.current) return;
      const delay = Math.min(1000 * 2 ** reconnectAttemptRef.current, 15000);
      reconnectAttemptRef.current += 1;
      reconnectTimeoutRef.current = setTimeout(connectSocket, delay);
    };

    socket.onerror = () => socket.close();
  }, [org.id, token]);

  useEffect(() => {
    mountedRef.current = true;
    connectSocket();
    return () => {
      mountedRef.current = false;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      socketRef.current?.close();
    };
  }, [connectSocket]);

  const handleAdvanceStatus = useCallback((order: Order) => {
    const next = ORDER_STATUS_META[order.status].next;
    if (!next) return;
    setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: next, updatedAt: Date.now() } : o)));
    socketRef.current?.send(JSON.stringify({ type: 'order:updateStatus', orderId: order.id, status: next }));
  }, []);

  const fetchPastOrders = useCallback(async (from: Date, to: Date) => {
    setIsLoadingPast(true);
    setPastError(null);
    try {
      const result = await api.fetchOrgOrders(org.id, token, {
        from: from.toISOString(),
        to: to.toISOString(),
      });
      setPastOrders(result);
    } catch {
      setPastError('Could not load past orders. Try again.');
    } finally {
      setIsLoadingPast(false);
    }
  }, [org.id, token]);

  useEffect(() => {
    if (dateFilter === 'today') return;
    const { from, to } = getRangeForFilter(dateFilter, customRange);
    fetchPastOrders(from, to);
  }, [dateFilter, customRange, fetchPastOrders]);

  const sourceOrders = dateFilter === 'today' ? orders : pastOrders;

  const statusCounts = useMemo(() => {
    const counts: Record<'all' | OrderStatus, number> = { all: sourceOrders.length, new: 0, preparing: 0, ready: 0, served: 0, cancelled: 0 };
    sourceOrders.forEach((o) => { counts[o.status] += 1; });
    return counts;
  }, [sourceOrders]);

  const displayedOrders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return sourceOrders
      .filter((o) => statusFilter === 'all' || o.status === statusFilter)
      .filter((o) => !q || o.tableName.toLowerCase().includes(q) || o.id.toLowerCase().includes(q))
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [sourceOrders, statusFilter, searchQuery]);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="ds-container" style={themeVars}>
      {/* Animated Background Orbs — colored from the restaurant's own brand palette */}
      <div className="ds-bg-orb orb-1"></div>
      <div className="ds-bg-orb orb-2"></div>
      <div className="ds-bg-orb orb-3"></div>

      {isSidebarOpen && (
        <div
          className="ds-sidebar-overlay"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`ds-sidebar glass-panel ${isSidebarOpen ? 'open' : ''}`}>
        <button className="ds-mobile-close" onClick={() => setIsSidebarOpen(false)}>
          <X size={20} />
        </button>
        <div className="ds-logo-container">
          <div className="ds-logo-icon">
            <ChefHat size={24} />
          </div>
          <h2>{org.name}</h2>
        </div>

        <nav className="ds-nav">
          <button
            className={`ds-nav-btn ${activeTab === 'menu' ? 'active' : ''}`}
            onClick={() => setActiveTab('menu')}
          >
            <UtensilsCrossed size={18} /> Menu Builder
          </button>
          <button
            className={`ds-nav-btn ${activeTab === 'tables' ? 'active' : ''}`}
            onClick={() => setActiveTab('tables')}
          >
            <LayoutGrid size={18} /> Table Manager
          </button>
          <button
            className={`ds-nav-btn ${activeTab === 'orders' ? 'active' : ''}`}
            onClick={() => setActiveTab('orders')}
          >
            <ClipboardList size={18} /> Orders
          </button>
          <button
            className={`ds-nav-btn ${activeTab === 'analytics' ? 'active' : ''}`}
            onClick={() => setActiveTab('analytics')}
          >
            <BarChart3 size={18} /> Analytics
          </button>
          <button
            className={`ds-nav-btn ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            <SettingsIcon size={18} /> Settings
          </button>
        </nav>

        <div className="ds-sidebar-footer">
          <div className="ds-user-chip">
            <div className="ds-user-avatar">{user.name.charAt(0).toUpperCase()}</div>
            <div className="ds-user-info">
              <span className="ds-user-name">{user.name}</span>
              <span className="ds-user-email">{user.email}</span>
            </div>
          </div>
          <button className="ds-nav-btn ds-logout-btn" onClick={onLogout}>
            <LogOut size={18} /> Log out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="ds-main">
        <button className="ds-mobile-toggle" onClick={() => setIsSidebarOpen(true)}>
          <Menu size={24} />
        </button>
        {activeTab === 'menu' && (
          <div className="ds-view fade-in">
            <header className="ds-header">
              <div>
                <h1 className="ds-title">Menu Builder</h1>
                <p className="ds-subtitle">Design your offerings and push to database.</p>
              </div>
              <button
                className="ds-btn ds-btn-primary"
                onClick={handleSaveMenu}
                disabled={isSavingMenu || isFetchingMenu}
              >
                {isSavingMenu ? <Loader2 className="spin" size={18} /> : <Save size={18} />}
                {isSavingMenu ? 'Saving...' : 'Save Menu'}
              </button>
            </header>

            {menuError && <p className="ds-error-banner">{menuError}</p>}

            <div className="ds-grid-2-col">
              {/* Form Section */}
              <div className="ds-card glass-panel flex-col gap-md slide-up" ref={formCardRef}>
                <h3>{editingItemId ? 'Edit Item' : 'Add New Item'}</h3>
                <form onSubmit={handleSubmitItem} className="ds-form">
                  <label className="ds-input-group">
                    <span style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)', fontWeight: 600 }}>
                      Photo (optional)
                    </span>
                    <div className="image-upload-box" onClick={() => fileInputRef.current?.click()}>
                      {itemForm.image ? (
                        <>
                          <img src={itemForm.image} alt="" className="image-upload-preview" />
                          <button
                            type="button"
                            className="image-upload-remove"
                            onClick={(e) => { e.stopPropagation(); handleRemoveImage(); }}
                            aria-label="Remove photo"
                          >
                            <X size={14} />
                          </button>
                        </>
                      ) : (
                        <div className="image-upload-placeholder">
                          <ImagePlus size={22} strokeWidth={1.6} />
                          <span>Add photo</span>
                        </div>
                      )}
                      {isProcessingImage && (
                        <div className="image-upload-spinner-overlay">
                          <Loader2 className="spin" size={20} />
                        </div>
                      )}
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageSelect}
                      style={{ display: 'none' }}
                    />
                    {imageError && <span className="ds-field-error">{imageError}</span>}
                  </label>

                  <div className="ds-input-group">
                    <label>Item Name</label>
                    <input
                      type="text"
                      value={itemForm.name}
                      onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                      placeholder="e.g. Paneer Butter Masala"
                      className="ds-input"
                    />
                  </div>

                  <div className="ds-row">
                    <div className="ds-input-group">
                      <label>Price (₹)</label>
                      <input
                        type="number"
                        value={itemForm.price}
                        onChange={(e) => setItemForm({ ...itemForm, price: e.target.value })}
                        placeholder="180"
                        className="ds-input"
                      />
                    </div>
                    <div className="ds-input-group">
                      <label>Portion / Quantity</label>
                      <input
                        type="text"
                        value={itemForm.portion}
                        onChange={(e) => setItemForm({ ...itemForm, portion: e.target.value })}
                        placeholder="250g, 2 pieces, Serves 2"
                        className="ds-input"
                      />
                    </div>
                  </div>

                  <div className="ds-input-group">
                    <label>Category</label>
                    <input
                      type="text"
                      list="categories"
                      value={itemForm.category}
                      onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })}
                      placeholder="Main Course"
                      className="ds-input"
                    />
                    <datalist id="categories">
                      <option value="Breakfast" />
                      <option value="Main Course" />
                      <option value="Beverages" />
                    </datalist>
                  </div>

                  <div className="ds-input-group">
                    <label>Description (optional)</label>
                    <textarea
                      value={itemForm.description}
                      onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
                      placeholder="Short description guests will see on the menu"
                      className="ds-input ds-textarea"
                      rows={2}
                    />
                  </div>

                  <div className="form-actions">
                    {editingItemId && (
                      <button type="button" className="ds-btn ds-btn-outline" onClick={resetItemForm}>
                        Cancel
                      </button>
                    )}
                    <button type="submit" className="ds-btn ds-btn-secondary" disabled={!canSubmitItem}>
                      {editingItemId ? <Check size={18} /> : <Plus size={18} />}
                      {editingItemId ? 'Save changes' : 'Add to Menu'}
                    </button>
                  </div>
                </form>
              </div>

              {/* Preview Section */}
              <div className="ds-card glass-panel flex-col ds-menu-preview slide-up delay-1">
                <h3>Live Preview</h3>

                {isFetchingMenu ? (
                  <div className="ds-loader-container">
                    <Loader2 className="spin ds-text-primary" size={32} />
                    <p>Loading menu from database...</p>
                  </div>
                ) : (
                  <div className="ds-menu-list">
                    {Object.entries(groupedMenu).map(([category, items]) => (
                      <div key={category} className="ds-menu-category">
                        <h4>{category}</h4>
                        <div className="ds-menu-items-grid">
                          {items.map((item) => (
                            <div key={item.id} className={`ds-menu-item ${editingItemId === item.id ? 'ds-menu-item--editing' : ''}`}>
                              <div className="ds-menu-item-thumb">
                                {item.image ? <img src={item.image} alt={item.name} /> : <UtensilsCrossed size={18} strokeWidth={1.6} />}
                              </div>
                              <div className="ds-menu-item-main">
                                <div className="ds-menu-item-info">
                                  <span className="ds-menu-item-name">{item.name}</span>
                                  {item.portion && <span className="ds-menu-item-portion">{item.portion}</span>}
                                </div>
                                <div className="ds-menu-item-price">₹{item.price}</div>
                              </div>
                              <div className="ds-menu-item-actions">
                                <button onClick={() => handleEditItem(item)} className="ds-btn-icon" title="Edit item">
                                  <Pencil size={15} />
                                </button>
                                <button onClick={() => handleDeleteItem(item.id)} className="ds-btn-icon ds-danger" title="Remove item">
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                    {menuItems.length === 0 && <p className="ds-empty-state">No items in menu.</p>}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        {activeTab === 'tables' && (
          <div className="ds-view fade-in">
            <header className="ds-header">
              <div>
                <h1 className="ds-title">Table Manager</h1>
                <p className="ds-subtitle">Generate QR codes guests scan to open your menu.</p>
              </div>
              <form onSubmit={handleCreateTable} className="ds-header-form">
                <input
                  type="text"
                  value={newTableName}
                  onChange={(e) => setNewTableName(e.target.value)}
                  placeholder="e.g. Table 04"
                  className="ds-input"
                />
                <div className="ds-seats-input">
                  <Users size={14} />
                  <input
                    type="number"
                    min={1}
                    max={24}
                    value={newTableSeats}
                    onChange={(e) => setNewTableSeats(Math.max(1, Number(e.target.value) || 1))}
                    className="ds-input ds-seats-number"
                  />
                </div>
                <button type="submit" className="ds-btn ds-btn-primary" disabled={!newTableName.trim() || isCreatingTable}>
                  {isCreatingTable ? <Loader2 className="spin" size={18} /> : <Plus size={18} />}
                  Generate QR
                </button>
              </form>
            </header>

            {tableError && <p className="ds-error-banner">{tableError}</p>}

            {isFetchingTables ? (
              <div className="ds-loader-container">
                <Loader2 className="spin ds-text-primary" size={32} />
                <p>Loading tables...</p>
              </div>
            ) : (
              <div className="ds-grid-3-col">
                {tables.map((table, index) => (
                  <div key={table.id} className="ds-card glass-panel ds-qr-card slide-up" style={{ animationDelay: `${index * 0.1}s` }}>
                    <button
                      className="ds-btn-icon ds-danger ds-qr-delete"
                      onClick={() => handleDeleteTable(table.id)}
                      title="Delete table"
                    >
                      <Trash2 size={16} />
                    </button>
                    <div className="ds-qr-wrapper">
                      <QRCodeSVG
                        id={`qr-${table.id}`}
                        value={table.qrValue}
                        size={140}
                        bgColor="#ffffff"
                        fgColor="#0f172a"
                        level="Q"
                      />
                    </div>
                    <h4>{table.name}</h4>
                    <p className="ds-uuid">{table.seats} seats · {table.id}</p>
                    <button onClick={() => handlePrintQR(table)} className="ds-btn ds-btn-outline w-full">
                      <Printer size={16} /> Print Ticket
                    </button>
                  </div>
                ))}
                {tables.length === 0 && (
                  <div className="ds-empty-state col-span-full">
                    <LayoutGrid size={48} opacity={0.2} />
                    <p>No tables generated yet.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'orders' && (
          <div style={{ maxWidth: 1180, margin: '0 auto', padding: '32px 24px' }}>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 20,
                justifyContent: 'space-between',
              }}
            >
              <div>
                <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.16em', color: COLORS.brass, margin: 0, fontFamily: fontSans }}>
                  Orders
                </p>
                <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
                  <h1 style={{ fontSize: 36, lineHeight: 1, color: COLORS.textPrimary, fontFamily: fontSerif, margin: 0 }}>
                    Orders
                  </h1>
                  <ConnectionBadge connected={connected} />
                </div>
                <p style={{ marginTop: 10, fontSize: 14, color: COLORS.textSecondary, fontFamily: fontSans }}>
                  Live from the floor, as it happens.
                </p>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  height: 44,
                  borderRadius: 12,
                  border: `1px solid ${COLORS.borderStrong}`,
                  backgroundColor: COLORS.surface,
                  padding: '0 14px',
                  width: 'fit-content',
                }}
              >
                <Search size={15} color={COLORS.textFaint} strokeWidth={1.8} />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search table or order #"
                  style={{
                    width: 190,
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    fontSize: 13.5,
                    color: COLORS.textPrimary,
                    fontFamily: fontSans,
                  }}
                />
              </div>
            </div>

            <div
              style={{
                marginTop: 28,
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
                borderRadius: 16,
                border: `1px solid ${COLORS.border}`,
                backgroundColor: COLORS.surfaceSoft,
                padding: 16,
              }}
            >
              <DateFilterBar value={dateFilter} onChange={setDateFilter} customRange={customRange} onCustomChange={setCustomRange} />
              <StatusFilterPills value={statusFilter} counts={statusCounts} onChange={setStatusFilter} />
            </div>

            <div style={{ marginTop: 24 }}>
              {dateFilter !== 'today' && isLoadingPast ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                    padding: '96px 0',
                    fontSize: 13.5,
                    color: COLORS.textSecondary,
                    fontFamily: fontSans,
                  }}
                >
                  <RefreshCw size={15} className="orders-spin" strokeWidth={1.8} /> Loading past orders…
                </div>
              ) : dateFilter !== 'today' && pastError ? (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 12,
                    borderRadius: 26,
                    border: '1px dashed rgba(168,121,138,0.3)',
                    padding: '80px 32px',
                    textAlign: 'center',
                  }}
                >
                  <p style={{ fontSize: 14, color: '#E2A0A6', fontFamily: fontSans, margin: 0 }}>{pastError}</p>
                  <button
                    onClick={() => {
                      const { from, to } = getRangeForFilter(dateFilter, customRange);
                      fetchPastOrders(from, to);
                    }}
                    style={{
                      borderRadius: 8,
                      border: `1px solid ${COLORS.borderStrong}`,
                      backgroundColor: 'transparent',
                      color: '#B9BEC1',
                      padding: '6px 14px',
                      fontSize: 13,
                      cursor: 'pointer',
                      fontFamily: fontSans,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    Try again
                  </button>
                </div>
              ) : displayedOrders.length === 0 ? (
                <EmptyOrders dateFilter={dateFilter} />
              ) : (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
                    gap: 16,
                  }}
                >
                  {displayedOrders.map((order) => (
                    <OrderCard key={order.id} order={order} isNew={newOrderIds.has(order.id)} onAdvance={handleAdvanceStatus} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'analytics' && (
          <Analytics org={org} token={token} menuItems={menuItems} />
        )}

        {activeTab === 'settings' && (
          <Settings org={org} token={token} onOrgUpdated={onOrgUpdated} />
        )}
      </main>
    </div>
  );
}