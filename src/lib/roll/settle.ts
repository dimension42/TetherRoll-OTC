/**
 * Settlement math for Roll Orders — pure functions, unit-testable.
 * Given an order + fills, compute final state, fees, refund.
 */

export interface SettlementInput {
  amountKrw: number; // requested amount
  depositAmount: number; // actual deposit confirmed
  estFeePlatform: number;
  estFeeGas: number;
  fills: Array<{
    status: string;
    amountKrw: number;
    amountAsset: number;
    gasActual?: number;
  }>;
  minFillPct: number;
  partialDiscountPct: number; // from fee_configs
}

export interface SettlementResult {
  filledKrw: number;
  filledAsset: number;
  fillPct: number;
  status: 'FILLED' | 'PART_SETTLED' | 'REFUNDED';
  feeActualPlatform: number;
  feeActualGas: number;
  discountApplied: number;
  refundKrw: number;
}

export function computeSettlement(input: SettlementInput): SettlementResult {
  // 1. Sum executed/sent fills
  const executedFills = input.fills.filter(f => f.status === 'EXECUTED' || f.status === 'SENT');
  const filledKrw = executedFills.reduce((sum, f) => sum + f.amountKrw, 0);
  const filledAsset = executedFills.reduce((sum, f) => sum + f.amountAsset, 0);
  const fillPct = input.amountKrw > 0 ? (filledKrw / input.amountKrw) * 100 : 0;

  // 2. Determine status
  let status: SettlementResult['status'];
  if (fillPct >= 100) {
    status = 'FILLED';
  } else if (filledKrw > 0) {
    status = 'PART_SETTLED'; // partial, regardless of min fill (PRD §1.3: executed fills belong to user)
  } else {
    status = 'REFUNDED'; // no fills
  }

  // 3. Platform fee
  let feeActualPlatform = 0;
  let discountApplied = 0;

  if (status === 'FILLED') {
    feeActualPlatform = input.estFeePlatform;
  } else if (status === 'PART_SETTLED') {
    const proRataFee = input.estFeePlatform * (filledKrw / input.amountKrw);
    const discountFactor = input.partialDiscountPct / 100;
    feeActualPlatform = proRataFee * (1 - discountFactor);
    discountApplied = proRataFee * discountFactor;
  }

  // 4. Gas fee (actual gas of SENT fills)
  const sentFills = input.fills.filter(f => f.status === 'SENT');
  const feeActualGas = sentFills.reduce((sum, f) => sum + (f.gasActual ?? 0), 0);

  // 5. Refund
  const refundKrw = Math.max(0, input.depositAmount - filledKrw - feeActualPlatform - feeActualGas);

  return {
    filledKrw,
    filledAsset,
    fillPct,
    status,
    feeActualPlatform,
    feeActualGas,
    discountApplied,
    refundKrw,
  };
}

/**
 * Example worked numbers for a ₩500,000,000 order with 60% fill:
 *
 * Input:
 *   amountKrw = 500,000,000
 *   depositAmount = 505,000,000 (includes est fees)
 *   estFeePlatform = 2,500,000 (0.5% spread)
 *   estFeeGas = 2,500,000 (est for 2 venues)
 *   fills = [
 *     { status: 'SENT', amountKrw: 200,000,000, amountAsset: 142,857, gasActual: 1,000,000 },
 *     { status: 'SENT', amountKrw: 100,000,000, amountAsset: 71,429, gasActual: 1,000,000 },
 *   ]
 *   minFillPct = 80
 *   partialDiscountPct = 90
 *
 * Result:
 *   filledKrw = 300,000,000 (200M + 100M)
 *   filledAsset = 214,286
 *   fillPct = 60%
 *   status = 'PART_SETTLED'
 *   feeActualPlatform = 2,500,000 * 0.6 * 0.1 = 150,000 (pro-rata with 90% discount)
 *   discountApplied = 2,500,000 * 0.6 * 0.9 = 1,350,000
 *   feeActualGas = 2,000,000 (1M + 1M actual gas from 2 sent fills)
 *   refundKrw = 505,000,000 - 300,000,000 - 150,000 - 2,000,000 = 202,850,000
 */
