import { db } from '@/lib/db';
import { requireRole } from '@/lib/auth/adminRoles';
import { handleApiError } from '@/lib/auth/guards';
import { formatUnits } from 'viem';
import { findToken } from '@/lib/tokens';

export const dynamic = 'force-dynamic';

/** GET /api/admin/stats — 대시보드 KPI (PRD §4.1) */
export async function GET() {
  try {
    await requireRole('viewer');
    const client = db();

    // 유저 통계
    const { count: totalUsers } = await client.from('users').select('*', { count: 'exact', head: true });
    const { count: vipPending } = await client.from('vip_access_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending');
    const { count: vipApproved } = await client.from('users').select('*', { count: 'exact', head: true }).eq('vip_status', 'approved');

    // 풀 통계
    const { count: poolsOpen } = await client.from('pools').select('*', { count: 'exact', head: true }).in('status', ['OPEN', 'PARTIAL']);
    const { count: poolsTotal } = await client.from('pools').select('*', { count: 'exact', head: true });

    // 거래 통계 (24h, 7d, 30d)
    const now = new Date();
    const day = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const week = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const month = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { count: trades24h } = await client.from('trades').select('*', { count: 'exact', head: true }).in('status', ['CONFIRMED', 'RELEASED']).gte('created_at', day);
    const { count: trades7d } = await client.from('trades').select('*', { count: 'exact', head: true }).in('status', ['CONFIRMED', 'RELEASED']).gte('created_at', week);
    const { count: trades30d } = await client.from('trades').select('*', { count: 'exact', head: true }).in('status', ['CONFIRMED', 'RELEASED']).gte('created_at', month);

    // 수수료 수익 추정 (24h, 7d, 30d) — 체인×토큰별 wei 집계
    const feeFields = 'chain_id, token, fee_offer_wei, fee_request_wei';
    const { data: fees24h } = await client.from('trades').select(feeFields).in('status', ['CONFIRMED', 'RELEASED']).gte('created_at', day);
    const { data: fees7d } = await client.from('trades').select(feeFields).in('status', ['CONFIRMED', 'RELEASED']).gte('created_at', week);
    const { data: fees30d } = await client.from('trades').select(feeFields).in('status', ['CONFIRMED', 'RELEASED']).gte('created_at', month);

    const aggregateFees = (rows: { chain_id: number; token: string; fee_offer_wei: string | null; fee_request_wei: string | null }[]) => {
      const byToken: Record<string, { chainId: number; token: string; totalWei: bigint; decimals: number; symbol: string }> = {};
      for (const r of rows || []) {
        if (!r.chain_id || !r.token) continue;
        const key = `${r.chain_id}:${r.token}`;
        const tokenInfo = findToken(r.chain_id, r.token);
        if (!tokenInfo) continue;
        const offerWei = BigInt(r.fee_offer_wei || '0');
        const requestWei = BigInt(r.fee_request_wei || '0');
        if (!byToken[key]) {
          byToken[key] = { chainId: r.chain_id, token: r.token, totalWei: BigInt(0), decimals: tokenInfo.decimals, symbol: tokenInfo.symbol };
        }
        byToken[key].totalWei += offerWei + requestWei;
      }
      return Object.values(byToken).map(t => ({
        chainId: t.chainId,
        token: t.token,
        symbol: t.symbol,
        decimals: t.decimals,
        totalWei: t.totalWei.toString(),
        totalFormatted: formatUnits(t.totalWei, t.decimals),
      }));
    };

    const feeRevenue24h = aggregateFees(fees24h || []);
    const feeRevenue7d = aggregateFees(fees7d || []);
    const feeRevenue30d = aggregateFees(fees30d || []);

    // Roll Order 통계
    const { count: rollsInProgress } = await client.from('roll_orders').select('*', { count: 'exact', head: true }).in('status', ['FILLING', 'AWAITING_DEPOSIT', 'FROZEN']);
    const { data: rollsFillingData } = await client.from('roll_orders').select('id, amount_krw, filled_krw').eq('status', 'FILLING');
    const rollsFillingKrw = (rollsFillingData || []).reduce((sum, r) => sum + Number(r.amount_krw || 0), 0);

    // 환불 대기
    const { count: refundsPending } = await client.from('refunds').select('*', { count: 'exact', head: true }).in('status', ['REQUESTED', 'PROCESSING']);

    // 분쟁 오픈
    const { count: disputesOpen } = await client.from('disputes').select('*', { count: 'exact', head: true }).eq('status', 'OPEN');

    // 인덱서 상태
    const { data: cursors } = await client.from('indexer_cursors').select('chain_id, contract, last_block, updated_at');
    const { data: deployments } = await client.from('contract_deployments').select('chain_id, name, deployed_block');

    // Venue 헬스
    const { data: venues } = await client.from('venues').select('id, name, health_status, updated_at').eq('enabled', true);

    // 킬스위치
    const { data: killSwitch } = await client.from('platform_settings').select('value').eq('key', 'kill_switch').maybeSingle();
    const killSwitchEnabled = killSwitch?.value?.enabled || false;

    // 활성 공지
    const { data: announcement } = await client.from('announcements').select('id, text, level').eq('active', true).order('created_at', { ascending: false }).limit(1).maybeSingle();

    return Response.json({
      stats: {
        totalUsers: totalUsers || 0,
        vipPending: vipPending || 0,
        vipApproved: vipApproved || 0,
        poolsOpen: poolsOpen || 0,
        poolsTotal: poolsTotal || 0,
        trades24h: trades24h || 0,
        trades7d: trades7d || 0,
        trades30d: trades30d || 0,
        feeRevenue24h,
        feeRevenue7d,
        feeRevenue30d,
        rollsInProgress: rollsInProgress || 0,
        rollsFillingKrw,
        refundsPending: refundsPending || 0,
        disputesOpen: disputesOpen || 0,
        indexerCursors: cursors || [],
        deployments: deployments || [],
        venues: venues || [],
        killSwitchEnabled,
        activeAnnouncement: announcement,
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
