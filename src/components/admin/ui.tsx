'use client';

import { useState, type ReactNode } from 'react';

// ============================================================================
// API Helper
// ============================================================================

export async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ============================================================================
// KPI Tile
// ============================================================================

interface KpiTileProps {
  label: string;
  value: string | number;
  color?: string;
  warn?: boolean;
  icon?: string;
}

export function KpiTile({ label, value, color = '#00c9a7', warn = false, icon }: KpiTileProps) {
  return (
    <div
      className="p-6 rounded-xl"
      style={{
        background: warn ? 'rgba(255,176,32,0.08)' : '#111',
        border: `1px solid ${warn ? 'rgba(255,176,32,0.3)' : '#1f1f1f'}`,
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        {icon && <span className="text-lg">{icon}</span>}
        <p className="text-sm" style={{ color: '#8FA398' }}>
          {label}
        </p>
      </div>
      <p className="text-4xl font-black" style={{ color, fontVariantNumeric: 'tabular-nums' }}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
    </div>
  );
}

// ============================================================================
// Data Table
// ============================================================================

interface Column<T> {
  key: string;
  label: string;
  render: (row: T) => ReactNode;
  mono?: boolean;
  sortable?: boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (row: T) => string;
  emptyText?: string;
}

export function DataTable<T>({ columns, data, keyExtractor, emptyText = 'No data' }: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState(true);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  return (
    <div className="overflow-x-auto rounded-xl border" style={{ borderColor: '#1f1f1f' }}>
      <table className="w-full">
        <thead className="sticky top-0" style={{ background: '#0F1712', borderBottom: '1px solid #1f1f1f' }}>
          <tr>
            {columns.map(col => (
              <th
                key={col.key}
                className={`px-4 py-3 text-left text-xs font-bold ${col.sortable ? 'cursor-pointer select-none' : ''}`}
                style={{ color: '#8FA398' }}
                onClick={col.sortable ? () => handleSort(col.key) : undefined}
              >
                {col.label}
                {col.sortable && sortKey === col.key && (
                  <span className="ml-1">{sortAsc ? '↑' : '↓'}</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-12 text-center text-sm" style={{ color: '#8FA398' }}>
                {emptyText}
              </td>
            </tr>
          ) : (
            data.map(row => (
              <tr
                key={keyExtractor(row)}
                className="border-t hover:bg-opacity-50"
                style={{ borderColor: '#1f1f1f', backgroundColor: 'transparent' }}
              >
                {columns.map(col => (
                  <td
                    key={col.key}
                    className="px-4 py-3 text-sm"
                    style={{ color: '#fff', fontFamily: col.mono ? 'monospace' : undefined }}
                  >
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================================
// Status Chip
// ============================================================================

export function StatusChip({ status, label }: { status: string; label?: string }) {
  const colorMap: Record<string, string> = {
    OPEN: '#00c9a7',
    FILLING: '#00c9a7',
    FILLED: '#00c9a7',
    CONFIRMED: '#00c9a7',
    RELEASED: '#00c9a7',
    APPROVED: '#00c9a7',
    PENDING: '#FFB020',
    AWAITING_DEPOSIT: '#FFB020',
    REQUESTED: '#FFB020',
    PROCESSING: '#FFB020',
    FROZEN: '#FF4D5E',
    CANCELLED: '#8FA398',
    EXPIRED: '#8FA398',
    REJECTED: '#FF4D5E',
    DISPUTED: '#FF4D5E',
    HIDDEN: '#8FA398',
  };

  const color = colorMap[status] || '#8FA398';

  return (
    <span
      className="inline-block px-2 py-1 rounded text-xs font-bold"
      style={{ background: `${color}20`, color, border: `1px solid ${color}40` }}
    >
      {label || status}
    </span>
  );
}

// ============================================================================
// Drawer (slide-in panel)
// ============================================================================

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  width?: string;
}

export function Drawer({ isOpen, onClose, title, children, width = '600px' }: DrawerProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      style={{ background: 'rgba(0,0,0,0.8)' }}
      onClick={onClose}
    >
      <div
        className="h-full overflow-y-auto"
        style={{ width, background: '#0F1712', borderLeft: '1px solid #1f1f1f' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between p-6 border-b" style={{ background: '#0F1712', borderColor: '#1f1f1f' }}>
          <h2 className="text-2xl font-bold text-white">{title}</h2>
          <button
            onClick={onClose}
            className="text-2xl text-white hover:text-red-400 transition-colors"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

// ============================================================================
// Confirm Dialog
// ============================================================================

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  confirmColor?: string;
  requireTypedConfirm?: string;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  confirmColor = '#FF4D5E',
  requireTypedConfirm,
}: ConfirmDialogProps) {
  const [typedValue, setTypedValue] = useState('');

  if (!isOpen) return null;

  const canConfirm = !requireTypedConfirm || typedValue === requireTypedConfirm;

  const handleConfirm = () => {
    if (canConfirm) {
      onConfirm();
      setTypedValue('');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.8)' }}
      onClick={onClose}
    >
      <div
        className="max-w-md w-full rounded-2xl p-6"
        style={{ background: '#0F1712', border: '1px solid #1f1f1f' }}
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-xl font-bold text-white mb-4">{title}</h3>
        <p className="text-sm mb-6" style={{ color: '#C8D5D0' }}>
          {message}
        </p>
        {requireTypedConfirm && (
          <div className="mb-6">
            <label className="block text-xs mb-2" style={{ color: '#8FA398' }}>
              Type <span className="font-mono font-bold" style={{ color: '#fff' }}>{requireTypedConfirm}</span> to confirm:
            </label>
            <input
              type="text"
              value={typedValue}
              onChange={e => setTypedValue(e.target.value)}
              className="w-full px-4 py-2 rounded-lg text-sm font-mono"
              style={{ background: '#050806', border: '1px solid #1f1f1f', color: '#fff' }}
              autoFocus
            />
          </div>
        )}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg text-sm font-bold transition-colors"
            style={{ background: '#111', color: '#fff', border: '1px solid #1f1f1f' }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canConfirm}
            className="flex-1 px-4 py-2 rounded-lg text-sm font-bold transition-opacity"
            style={{
              background: confirmColor,
              color: '#fff',
              opacity: canConfirm ? 1 : 0.5,
              cursor: canConfirm ? 'pointer' : 'not-allowed',
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Utilities
// ============================================================================

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function shortenId(str: string | null, len = 8): string {
  if (!str) return 'N/A';
  return str.length > len ? `${str.slice(0, len)}…` : str;
}

export function jsonSummary(obj: unknown): string {
  if (!obj) return '—';
  const str = JSON.stringify(obj);
  return str.length > 100 ? str.slice(0, 100) + '…' : str;
}

export function Loading() {
  return (
    <div className="flex items-center justify-center py-20">
      <div
        className="w-8 h-8 border-2 rounded-full animate-spin"
        style={{ borderColor: '#00c9a7', borderTopColor: 'transparent' }}
      />
    </div>
  );
}

export function ErrorMessage({ error, onRetry }: { error: string; onRetry?: () => void }) {
  return (
    <div className="text-center py-20">
      <p className="text-red-400 mb-4">{error}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-6 py-2 rounded-lg font-bold transition-colors"
          style={{ background: '#00c9a7', color: '#050806' }}
        >
          Retry
        </button>
      )}
    </div>
  );
}
