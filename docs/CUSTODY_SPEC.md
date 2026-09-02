# Desk 거래 (커스터디 에스크로) 명세 — 비EVM 전 자산 지원

> 2026-09-02 결정. EVM 자산은 EscrowVault v2(컨트랙트 보관) 그대로. **그 외 모든 체인(BTC · Tron · Solana · 기타)은 플랫폼 지갑이 에스크로 자금을 보관**한다.
> 어드민이 자산(체인·심볼·소수점·플랫폼 입금 주소)을 등록하면 그 자산은 즉시 거래 가능. 상태의 진실은 체인이 아니라 **DB + 어드민 확인**이다.
> 규제 메모: 타인 가상자산의 보관·이전 = 특금법 VASP 영역. `docs/CODEX_AUDIT.md` R-01·M-04 참조.

## 1. 개념

- **Desk 풀** (`pools.kind = 'DESK'`): 오프체인 광고. 생성 즉시 OPEN. 온체인 락 없음.
- **Desk 트레이드** (`trades.kind = 'DESK'`): 두 개의 **레그(leg)** 로 구성. 각 레그는 `CRYPTO`(플랫폼 주소로 입금) 또는 `FIAT`(KRW 은행 송금).
  - BTC ↔ KRW : 레그A = BTC 입금(판매자), 레그B = KRW 송금(구매자)
  - BTC ↔ USDT(TRC-20) : 레그A = BTC 입금, 레그B = USDT 입금 (양쪽 다 플랫폼 보관 → 양쪽 지급)
  - 자산 하나가 EVM 토큰이어도 어드민이 custody 자산으로 등록했다면 Desk 로 거래 가능(선택 사항, 기본은 컨트랙트 권장).
- **입금 식별**: 자산마다 플랫폼 주소 1개(어드민 등록). 트레이드마다 **고유 금액 꼬리(amount suffix)** 를 붙여 정확한 송금액을 지정하고(예: 0.12345678 → 0.12345**913**), 유저는 송금 후 **tx hash 제출**. 서버가 체인 검증기(verifier)로 (수신 주소·금액·컨펌 수)를 확인한다. 검증기가 없는 체인은 어드민이 탐색기로 보고 수동 확인.
- **지급**: 양 레그 확정 후 어드민이 플랫폼 지갑(하드웨어/멀티시그)에서 수동 송금하고 tx hash 기록. 임계금액 이상은 2인 승인(요청≠승인). 서버가 가능하면 지급 tx도 검증.

## 2. 상태 머신

```
trade.status (DESK):
  PENDING            트레이드 생성, 입금 안내 발급
  AWAITING_DEPOSITS  하나 이상 레그 미확정
  DEPOSITED          모든 CRYPTO 레그 확정 + FIAT 레그 '송금함' + 상대 '수령함'
  PAYOUT_PENDING     지급 요청 생성(자동) — 어드민 승인/집행 대기
  COMPLETED          모든 지급 tx 기록·검증
  CANCELLED          입금 전 취소(양측 또는 만료). 이미 입금된 레그가 있으면 → REFUNDING
  REFUNDING          환불 지급 대기 → COMPLETED(환불 완료 시 status는 REFUNDED)
  REFUNDED
  DISPUTED           당사자 분쟁 제기 → 어드민 판정 → PAYOUT_PENDING(승자) 또는 REFUNDING
  EXPIRED            deadline 내 입금 미완료 (입금된 레그는 환불 큐)

leg.status: PENDING → SUBMITTED(tx hash 제출) → CONFIRMING(컨펌 부족) → CONFIRMED | FAILED | REFUNDED
FIAT leg: PENDING → SENT(송금함) → RECEIVED(상대 수령함)
payout.status: REQUESTED → APPROVED → EXECUTED(tx hash) → VERIFIED | FAILED | REJECTED
```

## 3. 데이터 (`supabase/migrations/0003_custody.sql`)

```
custody_assets      id, chain_key('BTC'|'TRON'|'SOLANA'|'LTC'|... 자유), chain_name, symbol, name, decimals,
                    kind('native'|'token'), token_id(TRC20 컨트랙트/SPL mint 등, 선택),
                    deposit_address(플랫폼 주소), address_regex(유저 주소 검증), explorer_tx_url('https://mempool.space/tx/{hash}'),
                    explorer_address_url, verifier('bitcoin'|'tron'|'solana'|'evm'|'manual'), verifier_config(jsonb: rpc, api key env 이름, evm chainId/token 주소),
                    min_confirmations, min_amount, max_amount, payout_2p_threshold(2인 승인 임계, minor 단위), enabled, created_by, updated_at
custody_legs        id, trade_id, side('OFFER'|'REQUEST'), owner_id(입금/송금 의무자), counterparty_id(수령자),
                    kind('CRYPTO'|'FIAT'), asset_id(custody_assets), fiat_currency, amount(numeric, minor 단위 정수 또는 원화 정수),
                    amount_with_suffix(고유 금액), deposit_address, receive_address(상대가 받을 주소), tx_hash, confirmations,
                    status, verified_at, verified_by('auto'|admin id), note, created_at, updated_at
custody_payouts     id, trade_id, leg_id, asset_id, to_address, amount, purpose('SETTLE'|'REFUND'), requested_by(null=system),
                    approved_by, executed_by, tx_hash, status, verified_at, reject_reason, created_at, executed_at
trades              + kind 'DESK', deadline 재사용, dispute 재사용
pools               + kind 'DESK', offer_asset_id, request_asset_id (custody_assets FK), offer_amount(minor), request_amount(minor)
onchain_txs         kind 'custody_deposit' | 'custody_payout' (chain_id는 0, hash+chain_key 기록용 컬럼 chain_key 추가)
```
`custody_assets` 시드 없음(어드민이 등록). 예시 프리셋만 어드민 UI에 제공(BTC mainnet/mempool.space, Tron USDT/TronGrid, Solana/USDC SPL).

## 4. 검증기 인터페이스 (`src/lib/custody/verifiers/*`)

```ts
interface DepositVerifier {
  key: 'bitcoin' | 'tron' | 'solana' | 'evm' | 'manual';
  verifyTx(input: { asset: CustodyAsset; txHash: string; toAddress: string; expectedAmount: bigint })
    : Promise<{ found: boolean; toMatches: boolean; amount: bigint | null; confirmations: number; ok: boolean; raw?: unknown }>;
  scanAddress?(asset: CustodyAsset, address: string, since?: string): Promise<Array<{ txHash: string; amount: bigint; confirmations: number }>>; // 자동 감지(옵션)
  validateAddress(asset: CustodyAsset, address: string): boolean;
}
```
- bitcoin: mempool.space REST (`/api/tx/{hash}`, `/api/address/{addr}/txs`), 컨펌 = tip − block_height + 1. bech32/base58 주소 regex + 간단 검증.
- tron: TronGrid (`/v1/transactions/{hash}`, TRC20는 `/v1/accounts/{addr}/transactions/trc20`), `TRONGRID_API_KEY` 선택. 주소 `^T[1-9A-HJ-NP-Za-km-z]{33}$`.
- solana: JSON-RPC `getTransaction`(jsonParsed), SOL 전송/SPL transfer 파싱, 컨펌 = `finalized` 여부 + slot 차. `SOLANA_RPC_URL` 선택.
- evm: viem — 네이티브 tx value 또는 ERC-20 Transfer 로그(to == 플랫폼 주소). 커스터디로 등록된 EVM 자산용.
- manual: 항상 `{found:false}` → 어드민 수동 확인 경로.
- 모든 외부 호출 8초 타임아웃, 실패 시 `CONFIRMING` 유지(cron 재시도).

## 5. API

유저 (requireUser; DESK 풀·자산은 공개 마켓에도 노출 가능 — `visibility` 그대로 적용):
```
GET  /api/custody/assets                       enabled 자산 목록 (주소 제외)
POST /api/pools  kind:'DESK' { offerAssetId | fiatCurrency, offerAmount, requestAssetId | fiatCurrency, requestAmount, expiresAt, allowPartial, visibility }
POST /api/trades kind DESK { poolId, amount?, receiveAddress(내가 받을 자산 주소, 크립토 수령 시), bankInfo?(내가 KRW 받을 때) }
GET  /api/trades/[id]                          + legs[], payouts[], 내 레그의 입금 안내(주소·정확 금액·QR 문자열)
POST /api/trades/[id]/legs/[legId]/submit      { txHash }  → 검증기 호출 → SUBMITTED/CONFIRMING/CONFIRMED
POST /api/trades/[id]/legs/[legId]/sent        FIAT 송금함
POST /api/trades/[id]/legs/[legId]/received    FIAT 수령함 (상대)
POST /api/trades/[id]/cancel                   입금 전 취소 / 입금 후엔 상대 동의 필요(양측 cancel → REFUNDING)
POST /api/trades/[id]/dispute                  기존 재사용
GET  /api/cron/custody                         CONFIRMING 레그 재검증, scanAddress 자동 감지, deadline 만료 → EXPIRED + 환불 큐
```
어드민 (requireRole):
```
GET/POST/PATCH/DELETE /api/admin/custody/assets   (admin) 자산 등록·주소 변경(감사 로그 필수)
GET  /api/admin/custody/legs?status=              (viewer)
POST /api/admin/custody/legs/[id]/confirm  {txHash?, note}  (ops) 수동 확인
POST /api/admin/custody/legs/[id]/fail     {note}           (ops)
GET  /api/admin/custody/payouts?status=           (viewer)
POST /api/admin/custody/payouts/[id]/approve      (ops; 요청자≠승인자, 임계 이상만 필요)
POST /api/admin/custody/payouts/[id]/executed {txHash}  (ops) → 검증기로 자동 검증 시도
POST /api/admin/custody/payouts/[id]/reject {reason}    (ops)
GET  /api/admin/custody/balances                  (viewer) 자산별 플랫폼 주소 잔액(검증기가 지원하면) + DB상 보관 중 합계 → 차이 표시
```

## 6. 화면

- 풀 생성 위저드: 시장 선택에 **"Desk (플랫폼 보관)"** 추가. 자산 선택은 `GET /api/custody/assets` 목록(체인 배지). 상대 자산은 Desk 자산 또는 KRW(VIP).
- 풀 카드/상세: `kind==='DESK'` 배지 "Platform custody" + 툴팁("플랫폼 지갑이 보관하는 거래입니다").
- 트레이드 상세(DESK): 레그 2개 카드 — 내 의무 레그에는 입금 주소(QR)·**정확 금액(꼬리 포함, 복사 버튼)**·컨펌 진행·tx hash 제출 폼, FIAT 레그는 송금함/수령함. 상단 타임라인. 지급 단계에서 지급 tx 링크. 분쟁 버튼.
- 어드민 **Custody 탭**: 자산 관리(프리셋 버튼: BTC·Tron USDT·Solana USDC), 입금 큐(SUBMITTED/CONFIRMING/수동), 지급 큐(REQUESTED→APPROVED→EXECUTED), 잔액 대조.

## 7. 보안·운영 규칙

- 서버는 **개인키를 갖지 않는다.** 지급은 어드민이 외부 지갑으로 서명. 자동 지급은 범위 밖.
- 자산 주소 변경은 admin 역할 + 감사 로그 + 변경 후 24시간 동안 UI에 "최근 변경" 경고.
- 임계 이상 지급은 2인 승인. 지급 실행 tx는 검증기로 확인해 VERIFIED, 불일치 시 FAILED + 알림.
- 유저 수령 주소는 트레이드 생성 시 확정·불변. 변경하려면 취소 후 재생성.
- 입금 금액 불일치(꼬리 다름/부족)는 CONFIRMING 에 머물고 어드민 판단(부족분 환불/추가 입금).
