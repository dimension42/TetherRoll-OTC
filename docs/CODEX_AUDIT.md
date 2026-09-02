# TetherRoll — 외부 감사(Codex) 의뢰 항목

> 작성일 2026-09-02. 기준 브랜치 `feat/roll-order-platform`. 컨트랙트 전용 체크리스트는 `docs/CODEX_AUDIT_CONTRACTS.md`(12항목)에 별도.
> 각 항목은 **[위험도] 무엇을 / 어디를 / 어떻게 확인할지 / 현재 우리가 아는 한계**로 적었다. 감사자는 이 문서를 체크리스트로 쓰고, 발견 사항은 항목 ID로 회신한다.

## 0. 시스템 경계 (감사 범위)

```
브라우저(wagmi/viem, RainbowKit, Privy) ──tx──▶ EscrowVault v2 (Sepolia/Polygon/BSC/ETH)
        │ httpOnly JWT                              │ events
        ▼                                           ▼
Next.js API (/api/*)  ◀── cron(1분) ── 인덱서(getLogs) ── DB 캐시
        │ service-role
        ▼
Supabase Postgres (RLS 전면 잠금) + Storage(evidence, private)
```
- 자금의 진실은 체인. DB는 캐시. **DB를 조작해도 자금이 움직이면 안 된다** — 이 원칙이 깨지는 경로가 있는지가 감사의 핵심 질문.
- 서버가 개인키를 들고 있는 곳: 없음(런칭 범위). Roll Order 지급·Treasury 이체는 어드민이 지갑으로 직접 서명하고 tx hash만 기록.

## 1. 컨트랙트 (요약 — 상세는 CODEX_AUDIT_CONTRACTS.md)

| ID | 위험도 | 항목 |
|---|---|---|
| C-01 | 치명 | 이중 지급 불가 증명: `offerRemaining`/`amount`/`bondAmount`가 전송 직전 0 처리되는지 전 경로 추적 (`take`, `cancel`, `expire`, `confirmReceived`, `cancelFiatTrade`, `expireFiatTrade`, `resolveDispute`) |
| C-02 | 치명 | 컨트랙트 잔액 ≥ Σ(모든 OPEN 풀 offerRemaining + 모든 활성 트레이드 amount + bond) 불변식 — 퍼징 권장 |
| C-03 | 높음 | 네이티브 ETH push 실패(수취자가 컨트랙트)로 인한 DoS: `take`에서 maker가 ETH 거부 컨트랙트면 테이크 불가 → pull 패턴 필요 여부 판단 |
| C-04 | 높음 | 부분 체결 풀의 프런트러닝/샌드위치: `take`에 최소 수령량 파라미터 없음. 가격이 풀 고정이라 슬리피지 없음이 맞는지 확인 |
| C-05 | 높음 | `resolveDispute`가 현재 `penaltyBps`(스냅샷 아님)를 씀 — 어드민이 분쟁 중 비율을 바꿔 결과에 영향 가능. 스냅샷으로 바꿀지 결정 |
| C-06 | 중 | `escalateUnreleased`: releaseWindow=0 허용 → PAID 직후 누구나 분쟁 승격. 서버가 최소값을 강제하는지(프론트 24h) 확인 |
| C-07 | 중 | USDT(mainnet) 비표준 approve(0 아닌 값에서 변경 시 revert) — 프론트가 approve(0) 후 approve(n) 하는지 |
| C-08 | 중 | `feeBps` 스냅샷은 풀/트레이드 생성 시점 — 이후 `setFees`가 기존 풀에 영향 없음을 테스트로 고정 |
| C-09 | 낮음 | 이벤트 인덱스 파라미터 충분성(인덱서가 `maker`/`taker`로 필터할 수 있는지) |

## 2. 인증 · 세션

| ID | 위험도 | 항목 | 위치 |
|---|---|---|---|
| A-01 | 높음 | SIWE 검증: nonce(쿠키 5분)·domain(허용 목록 = `NEXT_PUBLIC_APP_DOMAIN` 또는 요청 Host)·uri origin·expirationTime·chainId. **Host 헤더 스푸핑**으로 허용 도메인을 우회할 수 있는 배포 환경(Vercel은 Host를 정규화)인지 확인 | `src/app/api/auth/siwe/verify/route.ts` |
| A-02 | 높음 | 지갑 연결 모드: 로그인 세션이 있으면 같은 엔드포인트가 "연결"로 동작 — 피싱 사이트가 유저에게 SIWE 서명을 받아 **타인 계정에 지갑을 붙일 수 있는지** (nonce가 우리 쿠키에 묶여 있어 불가해야 함) | 동상 |
| A-03 | 높음 | JWT: HS256, `AUTH_SECRET` 64hex, 7일, `sv`(session_version) 클레임으로 강제 로그아웃. 만료 갱신 없음(7일 후 재로그인) — 의도된 동작 | `src/lib/auth/session.ts` |
| A-04 | 중 | CSRF: 쿠키 `SameSite=Lax` + JSON 바디 + 커스텀 없음. GET으로 상태를 바꾸는 라우트가 없는지 전수 확인(`/api/cron/*`는 Bearer 필수) | 전 라우트 |
| A-05 | 중 | Privy: 서버가 `verifyAuthToken` 후 `getUser`로 임베디드 지갑 주소를 `user_wallets`에 등록. **Privy 계정 이메일이 기존 이메일 계정과 같으면 자동 병합** — 계정 탈취 벡터가 되는지(이메일 검증이 Privy 측에서 보장되는지) | `src/lib/auth/link.ts`, `api/auth/privy` |
| A-06 | 중 | 이메일 가입은 Supabase Auth. Confirm email OFF 상태로 런칭하면 타인 이메일로 가입 가능 → 운영 전 ON 필수 | Supabase 설정 |
| A-07 | 낮음 | 어드민 판별 듀얼 소스(`users.role` + `ADMIN_EMAILS`). 이메일 기반 승격은 이메일 소유 검증에 의존 | `src/lib/auth/guards.ts`, `adminRoles.ts` |

## 3. API · 데이터

| ID | 위험도 | 항목 | 위치 |
|---|---|---|---|
| D-01 | 치명 | **confirm 엔드포인트 신뢰 경계**: 클라이언트가 보낸 tx hash를 서버가 receipt로 검증(`to`=EscrowVault, `from`∈유저 지갑, 기대 이벤트 존재). 다른 유저의 tx hash를 제출해 DB 행을 오염시킬 수 있는지, 같은 hash를 두 풀/트레이드에 연결할 수 있는지 | `src/lib/onchain/confirm.ts`, `api/pools/[id]/confirm`, `api/trades/[id]/confirm` |
| D-02 | 높음 | 인덱서 멱등성: PoolCreated(온체인 id → tx_hash 순 매칭, 중복 행 흡수), PoolTaken(tx_hash 매칭, CONFIRMED면 스킵), FiatTradeCreated(온체인 id → tx_hash → 신규). 인덱서와 confirm이 동시에 같은 로그를 처리할 때 경쟁 조건 | `src/lib/onchain/events.ts`, `indexer.ts` |
| D-03 | 높음 | 인덱서 커서: `latest-1`까지만 처리(1블록 재org 여유). Polygon/BSC의 깊은 재org 시 DB가 체인과 어긋날 수 있음 — 프론트가 온체인 read를 우선하도록 되어 있는지 | 동상 |
| D-04 | 높음 | 은행 정보 암호화: AES-256-GCM, 키 `ENCRYPTION_KEY`(env). 키 회전 절차 없음. 복호화는 buyer(ACTIVE/PAID 동안)와 어드민(환불 처리, 감사 로그)만 | `src/lib/crypto.ts`, `src/lib/roll/crypto.ts`, `api/trades/[id]`, `api/admin/refunds/[id]/bank` |
| D-05 | 중 | 레이트리밋: DB fixed window, **read-then-write 비원자적** → 동시 요청으로 한도 초과 가능. 인증 라우트 10/분/IP는 `x-forwarded-for` 첫 홉 신뢰 — Vercel 외 배포 시 스푸핑 가능 | `src/lib/ratelimit.ts` |
| D-06 | 중 | zod 검증 누락 라우트 전수 조사(`parseBody` 미사용 라우트 grep). PostgREST `.or()` 문자열 조립에 사용자 입력이 들어가는 곳(`admin/users` 검색은 이스케이프 처리됨) | 전 라우트 |
| D-07 | 중 | VIP 은닉: fiat 풀·Roll·VIP 라우트가 미승인에 404. 목록 API의 `scope=vip`외에 `GET /api/pools/[id]`로 VIP 풀 id를 알면 조회되는지(requireVip 적용됨) | `api/pools/*` |
| D-08 | 중 | Storage `evidence` 버킷 private. 서명 URL 600초. 업로드는 당사자만, MIME/크기 제한(10MB, image/pdf) 서버 검증 여부 | `api/trades/[id]/evidence`, `api/admin/disputes/[id]` |
| D-09 | 중 | 킬스위치 적용 범위: pools POST, trades POST, roll quote/orders. **누락 라우트**(예: wallets/link, vip/request)가 있어도 되는지 정책 확인 | `requireNotPaused()` 호출부 |
| D-10 | 낮음 | `/api/stats` 공개 집계(유저 수) 노출 정책 | `api/stats` |
| D-11 | 낮음 | cron 인증: `Authorization: Bearer CRON_SECRET`. Vercel cron만 호출한다고 가정 | `api/cron/*` |

## 4. Roll Order (KRW)

| ID | 위험도 | 항목 |
|---|---|---|
| R-01 | 치명(법률) | 바이낸스/OKX P2P는 대리 체결 공식 API 없음. 조회 엔드포인트도 비공식. 운영계정으로 대리 매수하는 모델의 거래소 ToS·특금법(VASP) 검토 — 코드 문제가 아니라 사업 리스크. 런칭은 "수동 집행 + 기록" |
| R-02 | 높음 | 입금자명 매칭 코드(`TR-XXXXXX`)로 제3자 입금 차단. 어드민이 금액 불일치를 승인할 수 있음(`risk_flags` 플래그만) — 승인 정책 필요 |
| R-03 | 높음 | 정산 수식(`src/lib/roll/settle.ts`): 부분 체결 시 수수료 90% 할인, 환불 = 입금액 − 체결액 − 수수료 − 가스. **정산 후 fills 추가/수정이 가능한지**(상태 FILLED/PART_SETTLED 이후 fills 라우트가 막히는지) |
| R-04 | 중 | 견적: venue 원시 호가로 원가, 스프레드 별도(이중 계산 제거됨). venue 어댑터 다운 시 제외. 견적 TTL 60초 — 주문 생성 시 TTL 재검증 |
| R-05 | 중 | 환불 은행정보 암호화(D-04와 동일 키) |
| R-06 | 낮음 | 텔레그램 알림에 금액·코드 포함 — 채널 접근 통제 |

## 4b. Desk 거래 (커스터디 에스크로 — 비EVM 자산) · `docs/CUSTODY_SPEC.md`

| ID | 위험도 | 항목 |
|---|---|---|
| K-01 | 치명(법률) | 플랫폼 지갑이 타인 자산을 보관·이전 → 특금법 VASP 신고 대상 확정. 런칭 전 법률 검토 필수 |
| K-02 | 치명 | **개인키는 서버에 없음**이 설계 원칙. 코드 어디에도 서명·키 로딩이 없는지 grep(`privateKey`, `signTransaction`, `Keypair`, `bitcoinjs`) |
| K-03 | 높음 | 입금 식별 = 고유 금액 꼬리 + tx hash 제출 + 검증기. 같은 금액 꼬리가 동시에 두 레그에 배정되지 않는지(유일성 재시도), 검증기가 `to` 주소·금액·컨펌을 모두 확인하는지, 제출된 hash 재사용(다른 레그에 같은 hash) 차단(`custody_legs_txhash_idx`) |
| K-04 | 높음 | 검증기 외부 의존(mempool.space·TronGrid·Solana RPC) 장애 시 CONFIRMING 유지 후 cron 재시도 — 무한 대기 방지(어드민 수동 확인 경로) 및 잘못된 API 응답(스푸핑/포맷 변경)에 대한 방어 |
| K-05 | 높음 | 지급 큐: 임계 이상 2인 승인(요청자≠승인자) 서버 강제, 실행 tx 검증(주소·금액) 후 VERIFIED. 검증 불가 체인(manual)은 VERIFIED 불가 → 운영 절차 |
| K-06 | 중 | 자산 입금 주소 변경(어드민) 감사 로그 + 24h 경고. 주소 변경 직후 진행 중 레그는 스냅샷된 옛 주소를 유지해야 함 |
| K-07 | 중 | 잔액 대조: 온체인 잔액 − DB 보관액 − 대기 지급 = 0 이어야 함. 음수면 즉시 알림 |
| K-08 | 중 | 환불 주소·수령 주소는 트레이드 생성 시 확정·불변. 변경 경로가 없는지 |
| K-09 | 낮음 | 주소 정규식은 형식 검증만(체크섬 없음). BTC bech32 체크섬·Solana base58 검증 라이브러리 도입 검토 |

## 5. 어드민 · Treasury

| ID | 위험도 | 항목 |
|---|---|---|
| M-01 | 높음 | 역할 3등급(viewer/ops/admin)이 **모든** `/api/admin/*`에 적용됐는지 전수(grep `requireRole`). `requireAdmin`(구)만 쓰는 라우트가 남아 있으면 ops가 admin 기능 접근 가능 |
| M-02 | 높음 | Treasury 2인 승인: 요청자≠승인자 서버 강제, 화이트리스트 주소만. 실행은 어드민이 지갑으로 서명 후 tx hash 입력 — **서버가 hash를 검증하지 않음**(기록용). 검증 추가 여부 결정 |
| M-03 | 중 | 온체인 어드민 동작(setFees/setFeeRecipient/pause/resolveDispute)은 브라우저 지갑 서명. `/api/admin/contract/audit`는 기록만 — 위조 기록 가능(감사 로그 신뢰도) |
| M-04 | 중 | 컨트랙트 DEFAULT_ADMIN_ROLE 키 보관: 런칭 시 배포자 EOA. 메인넷 전 Safe 멀티시그로 이전 필수 |
| M-05 | 낮음 | 감사 로그 insert-only(DB 권한상 서비스 롤은 삭제 가능) — 별도 보존 정책 |

## 6. 인프라 · 비밀

| ID | 위험도 | 항목 |
|---|---|---|
| I-01 | 치명 | `SUPABASE_SECRET_KEY`, `AUTH_SECRET`, `ENCRYPTION_KEY`, `CRON_SECRET`, `PRIVY_APP_SECRET`가 서버 전용인지(`NEXT_PUBLIC_` 접두사 없음) — 번들 grep |
| I-02 | 높음 | RLS 전면 잠금 + 클라이언트에서 Supabase 직접 호출 0건(grep `createClient` in components) |
| I-03 | 중 | 공개 RPC 의존: `*_RPC_URL` 미설정 시 viem 기본 퍼블릭 RPC → 레이트리밋으로 confirm/인덱서 실패 가능. 운영은 Alchemy/Infura 필수 |
| I-04 | 중 | CI(`.github/workflows/ci.yml`)가 컨트랙트 테스트를 포함하는지, main 보호 규칙 |
| I-05 | 낮음 | `vercel.json` 헤더(X-Frame-Options 등) + CSP 부재 — 지갑 연결 위해 CSP 도입 시 주의 |

## 7. 알려진 미검증 (감사 전 팀이 해야 할 것)

1. **Sepolia E2E 미실행**: 컨트랙트 미배포 상태에서 프론트·백엔드가 작성됨. 배포 후 풀 생성→테이크→confirm→인덱서 일치 검증이 첫 번째 작업.
2. 0002 마이그레이션이 운영 DB에 적용됐는지.
3. Privy·WalletConnect 실키로 소셜/모바일 지갑 로그인 검증.
4. 부하: 인덱서가 1분 cron 안에 2000블록×N체인을 끝내는지(Vercel 함수 타임아웃 300s).
