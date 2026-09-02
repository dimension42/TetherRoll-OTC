import { useCallback } from 'react';
import { type Address } from 'viem';

/**
 * 트랜잭션 추적: 프론트가 tx 전송 직후 POST /api/tx
 * 영수증 받으면 confirm 엔드포인트 호출
 */
export function useTxTracker() {
  const track = useCallback(async (params: {
    chainId: number;
    hash: Address;
    kind: string;
    refType?: string;
    refId?: string;
  }) => {
    try {
      await fetch('/api/tx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
    } catch (err) {
      console.error('Failed to track tx:', err);
    }
  }, []);

  const confirm = useCallback(async (endpoint: string, txHash: Address, extra?: Record<string, unknown>) => {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txHash, ...extra }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Confirm failed: ${res.status}`);
      }

      return await res.json();
    } catch (err) {
      console.error('Failed to confirm tx:', err);
      throw err;
    }
  }, []);

  return { track, confirm };
}
