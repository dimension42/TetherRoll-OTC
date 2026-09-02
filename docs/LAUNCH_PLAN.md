# TetherRoll — 런칭 구축 계획 (SSOT, 2026-09-02)

> 이 문서는 `docs/PRD.md`를 구현 단위로 구체화한 것이다. PRD와 충돌하면 이 문서가 우선한다.
> 5월 `docs/ARCHITECTURE.md`(다른 브랜치)의 결정 중 **D2·D4·D12만** 계승하고 나머지(D5 가입 금지, Mode 1 Safe)는 폐기한다.

## 0. 확정 결정

| # | 결정 | 내용 |
|---|---|---|
| 1 | 접근 모델 | 공개 마켓(crypto↔crypto, 비로그인 열람) + 이메일/지갑/소셜 가입 + VIP Desk 승인제(KRW). |
| 2 | 온체인 | **EscrowVault v2 단일 컨트랙트**(불변, 업그레이드 없음). 거래당 Gnosis Safe(Mode 1)는 폐기. |
| 3 | 스왑 | P2P 풀의 **원자 스왑**(`take()` 한 트랜잭션에 양방향 전송+수수료). DEX 애그리게이터 없음. |
| 4 | 커스터디 | **없음.** 유저 잔액·입금 원장 없음. `/deposit` 삭제. Roll Order 지급은 플랫폼 핫월렛 → 유저 지갑(초기 수동 집행 + tx hash 기록). |
| 5 | 체인 | Sepolia(테스트) → Polygon → BSC → Ethereum. 프론트는 4체인 설정, 배포 주소는 `src/lib/contracts/addresses.ts`. |
| 6 | 더미 데이터 | 금지. 시드는 `venues`·`fee_configs`·`platform_settings`뿐. 랜딩의 하드코딩 수치 제거. |
| 7 | 소개 페이지 | `/`(랜딩)·`/features`는 디자인 유지. 허위 문구("Live on Sepolia")와 mock 수치만 제거. |

## 1. 우선순위

실제 자금이 오가는 최소 경로를 먼저 성립시킨다.

```
P0  결함 수정 · 컨트랙트 워크스페이스 · CI · 입력검증 · 레이트리밋          (WS2, WS3 일부)
P1  EscrowVault v2 + 테스트 + 배포 스크립트                                    (WS1)
P2  지갑 셸 · 풀 생성(온체인 락) · 테이크(원자 스왑) · 취소/만료 · 인덱서 · 내 거래  (WS2+WS3)
P3  VIP KRW P2P: 담보 락 · 송금/수령 확인 · 분쟁 · 중재                          (WS2+WS3+WS5)
P4  Roll Order: 견적 · 주문 · 입금확인 · 집행 기록 · 정산/환불                    (WS4)
P5  어드민 완성: Pools · Fees · Treasury · Disputes · Settings(킬스위치·공지)     (WS5)
P6  외부 감사 · 메인넷                                                          (docs/CODEX_AUDIT.md)
```

## 2. 워크스트림 & 파일 소유권

병렬 작업 시 충돌 방지를 위해 각 워크스트림은 자기 소유 경로만 수정한다. 공유 파일은 아래 규칙.

| WS | 범위 | 소유 경로 |
|---|---|---|
| WS1 contracts | EscrowVault v2, 테스트, 배포, ABI 추출 | `contracts/**`, `src/lib/contracts/**` |
| WS2 backend | 가드·검증·레이트리밋·세션·지갑·풀 라이프사이클·인덱서·트레이드 API | `src/lib/**`(contracts/ 제외), `src/app/api/**`(roll/·admin/ 신규 탭 API 제외), `vercel.json`(crons) |
| WS3 frontend | 지갑 셸, 풀 생성/테이크/취소, 내 거래, 로그인 UX, 랜딩 정리 | `src/app/(page,login,pools,escrow→trades,profile,deposit,vip)`, `src/components/(layout,pools,wallet,auth,providers,vip)`, `src/hooks/**` |
| WS4 roll | Roll Order 백엔드+프론트+어드민 탭 컴포넌트 | `src/app/api/roll/**`, `src/app/api/admin/rolls/**`, `src/app/api/admin/refunds/**`, `src/lib/roll/**`, `src/app/vip/roll/**`, `src/components/roll/**`, `src/components/admin/RollsTab.tsx`, `src/components/admin/RefundsTab.tsx` |
| WS5 admin | 어드민 콘솔 재구성 + 신규 탭 + API | `src/components/admin/**`(RollsTab/RefundsTab 제외), `src/app/api/admin/(fees,pools,treasury,whitelist,settings,disputes,trades)/**` |

공유 파일 규칙:
- `package.json`: 통합자(메인 세션)만 수정. 필요한 의존성은 보고서에 적는다. 사전 추가됨: `zod`.
- `supabase/migrations/0002_launch.sql`: 통합자가 작성 완료. 컬럼이 더 필요하면 **`0003_<ws>.sql`을 새로 만들고** 0002는 건드리지 않는다.
- `src/lib/auth/guards.ts`, `src/lib/db.ts`: WS2 소유. 다른 WS는 import만.
- `src/components/admin/AdminConsole.tsx`: WS5 소유. WS4의 탭은 통합 시 WS5 콘솔에 연결.
- `Navbar.tsx`: WS3 소유. 메뉴 항목: Pools · Trades · (VIP Desk) · (Admin). Escrow/Deposit 제거, Features는 유지.

## 3. 공통 규약

- 모든 API 라우트: 첫 줄 가드 → `zod` 스키마 파싱(`src/lib/validate.ts`의 `parseBody(req, schema)`) → 로직. 실패는 400 `{ error, issues }`.
- 에러: `AuthError(status, message)`만 throw. `handleApiError`가 응답. 밴은 `AuthError(403)`.
- 레이트리밋: `src/lib/ratelimit.ts` `rateLimit(key, limit, windowSec)` — DB 테이블 `rate_limits` 기반(외부 의존 없음). 인증 라우트 10/분/IP, 풀·트레이드 생성 30/시간/유저, 견적 60/분/유저.
- 금액: DB `numeric`은 문자열로 주고받는다. 온체인 수량은 `bigint` 문자열(`"1000000"`) + `decimals`. 화면 표기는 `formatUnits` + `toLocaleString`, monospace.
- 상태의 진실: 온체인 엔티티(풀·트레이드)는 체인이 진실, DB는 캐시. DB `status`는 인덱서/confirm 엔드포인트만 변경한다.
- 체인 ID: 1, 137, 56, 11155111. 토큰 화이트리스트 `src/lib/tokens.ts`(체인별 address/decimals/symbol). 서버도 같은 파일로 검증.
- 클라이언트 → 컨트랙트 호출은 `wagmi`의 `useWriteContract` + `src/lib/contracts/abi.ts`. Privy 임베디드 지갑은 `@privy-io/wagmi`로 wagmi 커넥터에 연결.

## 4. API 계약 (v2 신규·변경)

### 인증·지갑
```
GET  /api/auth/me                 → { user: { id, email, walletAddress, wallets[], displayName, vipStatus, isAdmin } | null }
POST /api/auth/siwe/verify        domain/uri/expiration 검증 추가. 로그인된 세션이면 지갑 "연결"(user_wallets 추가), 아니면 로그인.
POST /api/wallets/link            { message, signature } — 로그인 상태에서 추가 지갑 검증·등록
DELETE /api/wallets/[address]
POST /api/auth/logout-all         session_version++ → 모든 세션 무효화
```

### 풀 (Public / VIP 공통, visibility로 분리)
```
GET  /api/pools?scope=public|vip&status=&chainId=&cursor=     만료 제외(서버에서 expires_at > now 또는 status 기준)
GET  /api/pools/mine
POST /api/pools                   { chainId, kind:'SWAP'|'FIAT', offerToken, offerAmount(bigint str), requestToken|fiatCurrency, requestAmount, expiresAt, allowPartial, visibility, collateralMode?, collateralPct? }
                                  → { id, status:'DRAFT' } (DB만. 온체인 락 전)
POST /api/pools/[id]/confirm      { txHash } → 서버가 receipt 조회, PoolCreated 이벤트 파싱 → onchain_pool_id·status OPEN 기록
POST /api/pools/[id]/cancel       DB 마킹만 (온체인 cancel은 클라이언트 tx → confirm 엔드포인트가 반영)
GET  /api/pools/[id]              + trades[] (내가 당사자인 것)
```

### 트레이드
```
POST /api/trades                  { poolId, offerWanted } → SWAP: DB trade PENDING 생성 후 클라가 take() 전송
POST /api/trades/[id]/confirm     { txHash } → PoolTaken/FiatTradeCreated 이벤트 파싱 → 상태 갱신
POST /api/trades/[id]/paid        FIAT: 구매자 "송금함" (DB) — 온체인 markPaid는 클라 tx + confirm
POST /api/trades/[id]/received    FIAT: 판매자 "수령함" — 온체인 confirmReceived + confirm
POST /api/trades/[id]/dispute     { evidence: file→Storage 'evidence' bucket, note } → evidence_hash 온체인 raiseDispute는 클라 tx
GET  /api/trades/mine
```

### 인덱서 · 트랜잭션
```
GET  /api/cron/indexer            Vercel cron 1분. CRON_SECRET 헤더 검증. 체인별 indexer_cursors부터 getLogs → DB 반영. 만료 처리(EXPIRED 마킹, 체인상 expire()는 유저/키퍼가 호출)
GET  /api/cron/expire             풀·트레이드·Roll Order 만료 마킹
POST /api/tx                      { chainId, hash, kind, refType, refId } → onchain_txs 기록 (프론트가 tx 전송 직후 호출)
```

### Roll Order (VIP)
```
POST /api/roll/quote              { side, asset, chain, amountKrw, slippageBps } → { quoteId, venues:[{id, name, share, rate, amountKrw, amountAsset}], estFeePlatform, estFeeGas, total, expiresAt }
POST /api/roll/orders             { quoteId, receiveAddress, minFillPct, expiresIn } → { id, status:'AWAITING_DEPOSIT', deposit:{ bank, account, holder, amountKrw, code } }
GET  /api/roll/orders/[id]        주문 + fills[]
GET  /api/roll/orders             내 주문
POST /api/roll/orders/[id]/cancel 체결 전(AWAITING_DEPOSIT)만
--- admin ---
GET  /api/admin/rolls?status=
POST /api/admin/rolls/[id]/deposit-confirm     { amountKrw, depositorName } → FILLING
POST /api/admin/rolls/[id]/fills               { venueId, amountKrw, amountAsset, rate } → fill EXECUTED
POST /api/admin/rolls/[id]/fills/[fillId]/sent { txHash, gasActual } → SENT
POST /api/admin/rolls/[id]/settle              → FILLED | PART_SETTLED + refunds 행 생성 (할인 계산)
POST /api/admin/rolls/[id]/freeze | unfreeze   { reason }
GET/POST /api/admin/refunds                    상태 전이 REQUESTED→PROCESSING→DONE
```

### 어드민 (WS5)
```
GET/POST /api/admin/fees            { key, value, venueId? } insert-only 이력 + auditLog
GET/PATCH /api/admin/pools          hide / force-close(DB) — 온체인 자금은 유저가 cancel/expire
GET/POST /api/admin/treasury/transfers   요청 → 다른 어드민 승인 → 실행(tx hash 수동 입력, 화이트리스트 필수)
GET/POST/DELETE /api/admin/whitelist
GET/PUT /api/admin/settings         kill_switch, announcement
GET/POST /api/admin/disputes        분쟁 목록 + 판정 기록(온체인 resolveDispute는 ARBITRATOR 지갑이 클라에서 전송, tx hash 기록)
GET  /api/admin/trades
GET  /api/admin/stats               수수료 수익·거래량·활성 풀·진행 Roll 포함
```

공개 화면은 `platform_settings.announcement.text`가 있으면 배너 표시, `kill_switch.enabled`면 풀·트레이드·Roll 생성 API가 503 `{ error:'Trading paused' }`.

## 5. 데이터 모델 변경

`supabase/migrations/0002_launch.sql` 참조. 요약:
- `users` + `session_version`, `primary_wallet`
- `user_wallets`(다중 지갑), `onchain_txs`, `indexer_cursors`, `contract_deployments`, `rate_limits`
- `pools` 확장: `kind`, `chain_id`, `maker_address`, `offer_token`, `request_token`, `offer_decimals`, `request_decimals`, `offer_remaining`, `allow_partial`, `fee_bps`, `onchain_pool_id`, `create_tx_hash`, status에 `DRAFT/LOCKING/OPEN/PARTIAL/FILLED/CANCELLED/EXPIRED/HIDDEN`
- `trades`(스왑 체결 + fiat 트레이드 통합), `disputes`
- `roll_orders` + `deposit_code`, `deposit_amount_krw`, `settled_at`, `fee_actual_platform`, `discount_applied`
- Storage bucket `evidence` (private)

## 6. 프론트 화면 목록 (WS3/WS4/WS5)

| 경로 | 내용 |
|---|---|
| `/` | 유지. 배지 "Live on Sepolia Testnet" 제거, mock 수치 3개 → `/api/stats` 실데이터(활성 풀·총 체결·총 유저) |
| `/login` | 유지 + Privy 완료 콜백, 지갑 연결 후 서명 단계 안내 |
| `/pools` | 목록 + 체인 필터 + 만료 제외 + 커서 페이지네이션 |
| `/pools/create` | 재작성: 체인 → 토큰(화이트리스트) → 수량·환율 → 만료·부분체결 → 검토 → approve → createPool → confirm. 트랜잭션 스테퍼 |
| `/pools/[id]` | 상세 + Take 패널(수량, 견적, 수수료, approve→take→confirm) + 메이커면 Cancel/Expire |
| `/trades` (구 /escrow) | 내 거래: 만든 풀 · 참여 트레이드 · 상태 탭 · tx 링크 · FIAT 액션(송금함/수령함/분쟁) |
| `/profile` | 지갑 목록·연결·해제, 거래 이력 요약, 로그아웃-올 |
| `/vip` | 데스크: KRW 풀 목록 + Roll Order 진입 + 내 Roll |
| `/vip/roll/new`, `/vip/roll/[id]` | 위저드 · Rolling 진행 · 정산 결과 |
| `/admin` | 9탭: Dashboard · Rolls · Pools · Trades/Disputes · VIP · Treasury · Fees · Users · Logs · Settings |
| `/deposit` | 삭제 |

## 7. 완료 정의 (런칭 게이트)

- [ ] `npm run build` · `npm run lint` · `npx tsc --noEmit` · `cd contracts && npx hardhat test` 전부 통과, GitHub Actions 녹색
- [ ] Sepolia에서 E2E: 지갑 A 풀 생성(락) → 지갑 B 테이크 → 양쪽 잔액 변화 + DB 상태 FILLED + `/trades` 표시
- [ ] Sepolia에서 FIAT: 판매자 트레이드 생성 → 구매자 담보 → 송금함 → 수령함 → 릴리즈
- [ ] Roll Order: 견적 → 주문 → 어드민 입금확인 → Fill 기록 → 정산 → 환불 행 생성
- [ ] 어드민: 킬스위치 켜면 생성 API 503, 공지 배너 표시, Treasury 2인 승인 강제
- [ ] `docs/CODEX_AUDIT.md`에 외부 감사 항목 정리
- [ ] 더미 데이터 0. 시드 3종 외 insert 없음
