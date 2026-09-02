import { formatUnits } from 'viem';

/**
 * 포맷 유틸 — 금액은 항상 monospace + toLocaleString (CLAUDE.md 규칙)
 */

export function fmtAmount(wei: bigint | string, decimals: number, maxFrac = 6): string {
  const n = typeof wei === 'string' ? BigInt(wei) : wei;
  const units = formatUnits(n, decimals);
  const num = parseFloat(units);

  if (num === 0) return '0';

  // 정수부만 있으면 그대로
  if (Number.isInteger(num)) return num.toLocaleString('en-US');

  // 소수점 자리 제한
  const parts = units.split('.');
  if (!parts[1]) return Number(parts[0]).toLocaleString('en-US');

  const frac = parts[1].slice(0, maxFrac).replace(/0+$/, '');
  if (!frac) return Number(parts[0]).toLocaleString('en-US');

  return `${Number(parts[0]).toLocaleString('en-US')}.${frac}`;
}

export function fmtKrw(amount: number | string): string {
  const n = typeof amount === 'string' ? parseFloat(amount) : amount;
  return `₩${Math.round(n).toLocaleString('ko-KR')}`;
}

export function shortAddr(address: string, start = 6, end = 4): string {
  if (address.length < start + end) return address;
  return `${address.slice(0, start)}...${address.slice(-end)}`;
}

export function pct(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

export function fmtDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}
