import { Clock, ReceiptText } from "lucide-react";
import { COLORS, fontMono, fontSans, fontSerif, ORDER_STATUS_META } from "./constants";
import type { DateFilter, Order, OrderStatus } from "./models";
import { formatClockTime, formatCurrency, formatRelativeTime } from "./utils";

export function ConnectionBadge({ connected }: { connected: boolean }) {
  const color = connected ? COLORS.sage : COLORS.rose;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        borderRadius: 9999,
        border: `1px solid ${color}66`,
        backgroundColor: `${color}1A`,
        color,
        padding: '6px 12px',
        fontSize: 12,
        fontWeight: 500,
        fontFamily: fontSans,
      }}
    >
      <span style={{ position: 'relative', display: 'flex', height: 8, width: 8 }}>
        {connected && (
          <span
            className="orders-ping"
            style={{
              position: 'absolute',
              display: 'inline-flex',
              height: '100%',
              width: '100%',
              borderRadius: 9999,
              backgroundColor: COLORS.sage,
              opacity: 0.6,
            }}
          />
        )}
        <span
          style={{
            position: 'relative',
            display: 'inline-flex',
            height: 8,
            width: 8,
            borderRadius: 9999,
            backgroundColor: color,
          }}
        />
      </span>
      {connected ? 'Live' : 'Reconnecting…'}
    </span>
  );
}

export function DateFilterBar({
  value, onChange, customRange, onCustomChange,
}: {
  value: DateFilter;
  onChange: (f: DateFilter) => void;
  customRange: { from: string; to: string };
  onCustomChange: (r: { from: string; to: string }) => void;
}) {
  const options: { id: DateFilter; label: string }[] = [
    { id: 'today', label: 'Today' },
    { id: 'yesterday', label: 'Yesterday' },
    { id: '7d', label: 'Last 7 days' },
    { id: 'custom', label: 'Custom' },
  ];

  const pillStyle = (active: boolean): React.CSSProperties => ({
    borderRadius: 9999,
    padding: '6px 14px',
    fontSize: 13,
    fontFamily: fontSans,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    border: active ? '1px solid rgba(201,161,95,0.6)' : `1px solid ${COLORS.borderStrong}`,
    backgroundColor: active ? 'rgba(201,161,95,0.1)' : 'transparent',
    color: active ? COLORS.brass : COLORS.textSecondary,
  });

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
      {options.map((opt) => {
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            style={pillStyle(active)}
            onMouseEnter={(e) => { if (!active) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)'; }}
            onMouseLeave={(e) => { if (!active) e.currentTarget.style.borderColor = COLORS.borderStrong; }}
          >
            {opt.label}
          </button>
        );
      })}

      {value === 'custom' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 4 }}>
          <input
            type="date"
            value={customRange.from}
            onChange={(e) => onCustomChange({ ...customRange, from: e.target.value })}
            style={{
              borderRadius: 8,
              border: `1px solid ${COLORS.borderStrong}`,
              backgroundColor: '#161A1C',
              padding: '6px 10px',
              fontSize: 12.5,
              color: COLORS.textPrimary,
              outline: 'none',
              fontFamily: fontSans,
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(201,161,95,0.6)')}
            onBlur={(e) => (e.currentTarget.style.borderColor = COLORS.borderStrong)}
          />
          <span style={{ color: COLORS.textMuted }}>–</span>
          <input
            type="date"
            value={customRange.to}
            onChange={(e) => onCustomChange({ ...customRange, to: e.target.value })}
            style={{
              borderRadius: 8,
              border: `1px solid ${COLORS.borderStrong}`,
              backgroundColor: '#161A1C',
              padding: '6px 10px',
              fontSize: 12.5,
              color: COLORS.textPrimary,
              outline: 'none',
              fontFamily: fontSans,
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(201,161,95,0.6)')}
            onBlur={(e) => (e.currentTarget.style.borderColor = COLORS.borderStrong)}
          />
        </div>
      )}
    </div>
  );
}

export function StatusFilterPills({
  value, counts, onChange,
}: {
  value: 'all' | OrderStatus;
  counts: Record<'all' | OrderStatus, number>;
  onChange: (s: 'all' | OrderStatus) => void;
}) {
  const options: { id: 'all' | OrderStatus; label: string; color: string }[] = [
    { id: 'all', label: 'All', color: COLORS.textSecondary },
    { id: 'new', label: 'New', color: ORDER_STATUS_META.new.color },
    { id: 'preparing', label: 'Preparing', color: ORDER_STATUS_META.preparing.color },
    { id: 'ready', label: 'Ready', color: ORDER_STATUS_META.ready.color },
    { id: 'served', label: 'Served', color: ORDER_STATUS_META.served.color },
    { id: 'cancelled', label: 'Cancelled', color: ORDER_STATUS_META.cancelled.color },
  ];

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {options.map((opt) => {
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              borderRadius: 9999,
              padding: '6px 12px',
              fontSize: 12.5,
              fontWeight: 500,
              fontFamily: fontSans,
              cursor: 'pointer',
              backgroundColor: active ? `${opt.color}1F` : 'transparent',
              color: active ? opt.color : COLORS.textSecondary,
              border: active ? `1px solid ${opt.color}55` : `1px solid ${COLORS.border}`,
              transition: 'all 0.15s ease',
            }}
          >
            {opt.label}
            <span style={{ opacity: 0.6 }}>{counts[opt.id]}</span>
          </button>
        );
      })}
    </div>
  );
}

export function OrderCard({
  order, isNew, onAdvance,
}: {
  order: Order;
  isNew: boolean;
  onAdvance: (order: Order) => void;
}) {
  const meta = ORDER_STATUS_META[order.status];
  const StatusIcon = meta.icon;

  return (
    <div
      className={isNew ? 'orders-arrive' : undefined}
      style={{
        position: 'relative',
        display: 'flex',
        overflow: 'hidden',
        borderRadius: 16,
        border: isNew ? '1px solid rgba(201,161,95,0.5)' : `1px solid ${COLORS.border}`,
        backgroundColor: COLORS.surface,
        padding: 20,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 0,
          width: 3,
          backgroundColor: meta.color,
        }}
      />
      <div style={{ minWidth: 0, flex: 1, paddingLeft: 8 }}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h4 style={{ fontSize: 17, color: COLORS.textPrimary, fontFamily: fontSerif, margin: 0 }}>
              {order.tableName}
            </h4>
            <span style={{ fontFamily: fontMono, fontSize: 11, color: COLORS.textMuted }}>
              #{order.id.slice(0, 8)}
            </span>
          </div>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              borderRadius: 9999,
              padding: '4px 10px',
              fontSize: 11,
              fontWeight: 500,
              color: meta.color,
              backgroundColor: `${meta.color}1A`,
              border: `1px solid ${meta.color}33`,
            }}
          >
            <StatusIcon size={12} strokeWidth={2} /> {meta.label}
          </span>
        </div>

        <ul style={{ marginTop: 12, marginBottom: 0, padding: 0, listStyle: 'none' }}>
          {order.items.map((item) => (
            <li
              key={item.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: 13.5,
                color: '#B9BEC1',
                padding: '2px 0',
              }}
            >
              <span>
                <span style={{ color: COLORS.textSecondary }}>{item.qty}×</span> {item.name}
              </span>
              <span style={{ fontFamily: fontMono, color: COLORS.textFaint }}>
                {formatCurrency(item.price * item.qty)}
              </span>
            </li>
          ))}
        </ul>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderTop: `1px solid ${COLORS.border}`,
            marginTop: 16,
            paddingTop: 14,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: COLORS.textFaint }}>
            <Clock size={13} strokeWidth={1.8} />
            {formatClockTime(order.createdAt)} · {formatRelativeTime(order.createdAt)}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontFamily: fontMono, fontSize: 15, color: COLORS.textPrimary }}>
              {formatCurrency(order.total)}
            </span>
            {meta.next && (
              <button
                type="button"
                onClick={() => onAdvance(order)}
                style={{
                  borderRadius: 8,
                  backgroundColor: COLORS.brass,
                  color: COLORS.ink,
                  border: 'none',
                  padding: '6px 12px',
                  fontSize: 12.5,
                  fontWeight: 600,
                  fontFamily: fontSans,
                  cursor: 'pointer',
                  transition: 'background-color 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = COLORS.brassHover)}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = COLORS.brass)}
              >
                {meta.nextLabel}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function EmptyOrders({ dateFilter }: { dateFilter: DateFilter }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 26,
        border: '1px dashed rgba(255,255,255,0.12)',
        padding: '96px 32px',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          display: 'flex',
          height: 56,
          width: 56,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 9999,
          border: '1px solid rgba(201,161,95,0.4)',
          color: COLORS.brass,
        }}
      >
        <ReceiptText size={22} strokeWidth={1.6} />
      </div>
      <h3 style={{ marginTop: 20, fontSize: 21, color: COLORS.textPrimary, fontFamily: fontSerif }}>
        {dateFilter === 'today' ? 'No orders yet today' : 'No orders in this range'}
      </h3>
      <p style={{ marginTop: 8, maxWidth: 320, fontSize: 13.5, lineHeight: 1.6, color: COLORS.textSecondary }}>
        {dateFilter === 'today'
          ? 'New orders will appear here the moment they come in.'
          : 'Try a different date range.'}
      </p>
    </div>
  );
}