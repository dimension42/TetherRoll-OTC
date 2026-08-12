# TetherRoll OTC — 기능 개편 PRD

> 기준: `f195a0e` (2026-08-11). 기존 화면 디자인은 클로드 디자인으로 확정 완료 → 본 문서에서 제외.
> 디자인 스펙은 **본 PRD에서 신규 추가되는 기능**에 한해서만 포함한다.
> 3D 히어로는 별도 외주 모델링(GLB) 반입 예정 → 본 문서 범위 외. 코드에는 모델 교체용 슬롯만 유지.

---

## 0. 범위 요약

| 구분 | 내용 |
|---|---|
| **신규 1** | Roll Order — 외부 P2P 거래소(바이낸스, OKX 등) 유동성 통합 체결 엔진 |
| **신규 2** | 접근 구조 이원화 — Public(crypto↔crypto) / **VIP Desk**(KRW↔crypto, 비공개) |
| **신규 3** | 어드민 콘솔 전면 재구축 (현 `admin/page.tsx`는 mock 561줄 → 폐기) |
| **유지** | KRW↔crypto 직접 P2P 풀 + 한화측 선택적 온체인 담보(collateralMode) — VIP Desk 내부로 이동 |
| **전제 작업** | mock 전량 제거, TEST_ACCOUNTS fallback 삭제, EscrowVault v2 재작성, 지갑 커넥터 실연결 |

---

## 1. Roll Order — 유동성 롤업 엔진 (신규 핵심 개념)

### 1.1 개념

1:1도 1:N 매칭도 아니다. **온라인에 흩어진 여러 유동성 소스(venue)를 하나의 주문으로 말아(roll) 단일 거래로 체결**하는 새로운 주문 유형.

- 명칭: **Roll Order (롤 오더)** — "코인이 굴러가며 유동성을 흡수한다"는 브랜드 은유
- 체결 과정: **Rolling** / 유동성 소스: **Venue** / venue별 개별 체결: **Fill**
- 슬로건 예: *"One Roll. Every Pool."*

**예시 시나리오** — 유저가 KRW 5억으로 USDT 매수 주문:
바이낸스 P2P에 2억, OKX P2P에 3억 상당 물량만 존재 → Roll Engine이 두 venue의 물량을 합산 견적 → 유저는 한 번의 주문·한 번의 입금으로 5억 전량 체결. venue가 3개 이상이어도 동일.

### 1.2 유저 플로우

```
① 주문 작성 → ② 통합 견적(Quote) → ③ KRW 입금(물량 확보 선입금) →
④ Rolling(venue별 순차/병렬 체결) → ⑤ 체결분 USDT 온체인 지급 →
⑥ 만료/완료 시 정산 (미체결 KRW 환불)
```

**① 주문 작성 파라미터**
- 방향·자산·수량 (예: KRW → USDT 500,000,000)
- 수령 지갑 주소 + 체인 (TRC-20 / ERC-20 / Polygon / BSC)
- **최소 체결률(min fill %)**: 만료 시점까지 이 비율이 안 채워지면 거래 철회. 유저가 직접 설정 (기본 80%, 0~100%)
- 주문 유효기간 (예: 1h / 6h / 24h)

**② 통합 견적 (Estimated Fee — 입금 전 필수 고지)**
```
총 예상 비용 = 체결 원가(venue별 가중평균 환율)
             + 플랫폼 중개 수수료 (venue 최저 수수료보다 소폭 높은 스프레드, bps)
             + 온체인 트랜잭션 수수료 (체인별 가스비 실비 추정 × 전송 횟수)
```
- venue별 예상 배분 내역을 유저에게 투명하게 표시 (Binance 40% / OKX 60% 등)
- 가스비는 체인 선택에 따라 실시간 추정 (TRC-20 vs ERC-20 차이 큼)
- 견적 유효시간(quote TTL, 예: 60초) 경과 시 재견적

**③ 입금** — 유저가 플랫폼 지정 계좌로 KRW 송금 → 입금 확인 시 Rolling 시작
**④~⑥ 정산 규칙**은 아래 1.3.

### 1.3 체결·수수료·환불 규칙

| 상황 | USDT 지급 | 수수료 | KRW 잔액 |
|---|---|---|---|
| 100% 체결 | 전량 지급 | Estimated fee 100% | — |
| 부분 체결 (min fill 이상, 만료) | 체결분만 지급 | **체결분 예상 수수료의 10%만 부과 (90% 할인)** | 미체결분 전액 환불 |
| 부분 체결 (min fill 미달 → 자동 철회) | **이미 체결된 분량은 지급** | 체결분에 90% 할인 적용 | 미체결분 전액 환불 |
| 0% 체결 / 유저 취소(체결 전) | — | 0 | 전액 환불 |

- 핵심 원칙: **입금 이후 발생한 모든 체결분은 무조건 유저에게 귀속**. 전량 미체결이라는 이유로 체결분을 되팔지 않는다.
- 90% 할인은 "전량 체결을 못 해준 것에 대한 보상" — 어드민에서 할인율 조정 가능(기본 90%).
- 가스비는 실제 전송 발생분만 실비 청구 (부분 체결 시 체결분 전송 가스만).

### 1.4 Roll Order 상태머신

```
DRAFT → QUOTED → AWAITING_DEPOSIT → FILLING ─┬→ FILLED        (100%)
                      │(입금확인)              ├→ PART_SETTLED  (부분체결 정산)
                      │                       ├→ REFUNDED      (0% 체결/철회 환불)
   (미입금 만료) EXPIRED ←┘                     └→ FROZEN        (어드민 강제중단)
```
- `FROZEN`은 어드민 전용 상태 — 해제 시 FILLING 복귀 또는 강제 정산/환불 분기.

### 1.5 아키텍처

```
Quote Engine ── venue별 호가 수집·합산·스프레드 적용 (30초 캐시)
  ├─ VenueAdapter: binance-p2p   (공개 광고 검색 API)
  ├─ VenueAdapter: okx-p2p
  └─ VenueAdapter: (확장 슬롯 — Bybit, HTX …)
Execution Engine ── 입금 확인 후 venue별 Fill 생성·집행·상태 추적
  └─ 플랫폼 운영계정(마켓테이커) 통해 venue에서 실매수 → 플랫폼 핫월렛 → 유저 지갑
Settlement ── 체결분 온체인 전송(tx hash 기록), 수수료 정산, 환불 큐 생성
Treasury ── 핫월렛/수익월렛 분리, 이체는 어드민 콘솔에서 (4.2)
```

**VenueAdapter 인터페이스** (venue 추가가 어댑터 1개 구현으로 끝나야 함):
```ts
interface VenueAdapter {
  id: string;                                   // 'binance-p2p'
  fetchAds(pair, side): Promise<VenueAd[]>;     // 광고/호가 수집
  quote(amountKRW): Promise<VenueQuote>;        // 해당 venue 체결가능량+환율
  execute(fill): Promise<FillResult>;           // 실집행 (자동/반자동)
  health(): Promise<VenueHealth>;               // 장애·지연 감지
}
```

**리스크 노트 (구현 전 확정 필요)**
- 바이낸스/OKX P2P는 제3자 대리체결용 공식 API가 없다. 실집행은 **플랫폼 운영계정이 해당 거래소에서 직접 매수하는 OTC 데스크 모델**이 되며, 초기엔 반자동(운영자 집행 + 시스템 추적), 자동화는 각 거래소 API/ToS 검토 후 단계 적용.
- venue 환율은 체결 시점에 변동 → 견적 대비 슬리피지 허용범위(bps)를 주문 파라미터에 포함, 초과 시 해당 Fill 스킵.

### 1.6 신규 화면 디자인 스펙 — Roll Order

- **주문 위저드** (VIP Desk 내): 금액 입력 → venue 통합 견적 카드(venue별 로고·배분율·환율을 가로 스택바로 시각화) → min fill % 슬라이더(철회 라인 표시) → 수수료 브레이크다운(중개 수수료/가스비 분리 표기, "부분체결 시 90% 할인" 배지) → 입금 안내.
- **Rolling 진행 화면 (시그니처)**: 중앙에 코인이 굴러가는 프로그레스 — venue 노드들을 지나며 Fill이 붙을 때마다 코인이 커지는 눈덩이 애니메이션. 하단에 실시간 체결 게이지(체결% / min fill 라인 / 만료 카운트다운), Fill별 카드(venue, 수량, 환율, tx hash 링크).
- **정산 결과 화면**: 체결/환불 분해 내역, 할인 적용액 강조("수수료 90% 할인 적용 −₩XXX"), 온체인 전송 영수증.
- 색 규칙은 기존 시스템 준수(딥그린 = 체결·완료), min fill 라인은 warn 색.

---

## 2. 접근 구조 이원화 — Public / VIP Desk

### 2.1 구조

| 영역 | 경로 | 접근 | 내용 |
|---|---|---|---|
| Public Market | `/pools` | 누구나 | **crypto ↔ crypto** 풀만 노출 |
| **VIP Desk** | `/vip` | 승인된 계정만 | KRW ↔ crypto 전부: Roll Order + 직접 P2P 풀(선택적 담보 포함) |

- 기존 화면에서 KRW/fiat 관련 필터·풀·생성 옵션을 Public에서 **완전 제거** (숨김이 아니라 서버 레벨 분리 — 미승인 계정에는 API 응답 자체가 없어야 함).
- 명칭 확정: **"VIP Desk"**. 미승인 유저의 네비게이션에는 메뉴 자체를 노출하지 않고(직링크 접근 시에만 잠긴 게이트 표시), 승인 유저에게만 네비에 딥그린 도트(●)와 함께 메뉴가 나타난다 — "내 화면에만 보이는 메뉴"로 특권감을 준다.

### 2.2 인증·접근 게이트

- 로그인 수단 3종 모두 지원: ① 지갑 서명(SIWE) ② 소셜 로그인(Privy) ③ 자체 이메일+비밀번호 계정 — 어떤 수단이든 **하나의 user 레코드로 통합**되고, VIP 자격은 user 단위로 부여.
- `/vip` 진입 시: 미로그인 → 로그인 유도 / 로그인 + 미승인 → **접근 요청 화면** / 승인됨 → 데스크 진입.
- 접근 요청: 요청 사유·예상 거래 규모·연락 수단 입력 → `vip_access_requests`에 PENDING 저장 → 어드민 승인/거절 (4.3). 거절 시 사유와 함께 통보, 재요청 쿨다운(기본 7일).
- VIP 자격은 회수 가능(어드민), 만료일 설정 가능.

### 2.3 신규 화면 디자인 스펙 — VIP Gate

- `/vip` 게이트: 검정 배경에 딥그린 볼트 도어 모티프 — 승인된 계정으로 진입 시 도어가 열리는 트랜지션. 미승인자에게는 잠긴 도어 + "Request Access" CTA만.
- 접근 요청 폼은 모달 1장으로 최소화. 제출 후 상태 배지(PENDING/REJECTED)를 게이트 화면에 표시.
- 데스크 내부는 기존 확정 디자인 시스템을 따르되, VIP 영역임을 알리는 상단 딥그린 헤어라인 + "PRIVATE DESK" 워터마크 정도의 차등만.

---

## 3. 유지 기능 — 직접 P2P 풀 (VIP Desk 내 KRW 거래)

- Roll Order 외에, 개인 간 직접 KRW↔crypto 풀 생성/테이크 기능 유지.
- **한화 제공측 선택적 온체인 담보**: 풀 설정 `collateralMode: NONE | KRW_SIDE_LOCKS`, 담보 비율(거래액의 10~100%) 설정. `KRW_SIDE_LOCKS`면 한화 제공자가 담보 크립토를 EscrowVault v2에 락 후 거래 진행, 미설정이면 크립토측 단독 락.
- crypto↔crypto 풀은 Public에서 기존 플로우 그대로 (EscrowVault v2 기반으로 재연결).

---

## 4. 어드민 콘솔 (전면 재구축)

현 상태: `src/app/admin/page.tsx` mock 대시보드 존재, 서버 가드 없음 → **폐기 후 재구축**.
모든 어드민 API는 서버측 `requireAdmin()` 필수, 어드민 계정은 DB 테이블 + 환경변수 듀얼 소스.

### 4.1 대시보드 (홈)

- **자산별 풀 현황**: 자산×체인별 — 활성 풀 수, 총 예치량, 24h 거래량, Roll Order 진행 수
- **수수료 수익**: 일/주/월 플랫폼 수수료(중개+가스 마진 분리), venue별 원가 대비 마진, 할인 지급 총액
- **실시간 운영 보드**: 진행 중 Rolling 목록(체결 게이지 포함), 입금 대기, 환불 대기 큐, 분쟁 수
- venue 헬스 상태(어댑터별 지연·오류율)

### 4.2 Treasury (플랫폼 수익 지갑 관리)

- 수익 지갑 잔액(체인별) 조회, **다른 지갑으로 이체 실행**
- 안전장치(필수): 출금 주소 화이트리스트 사전 등록 + **2인 승인(요청 어드민 ≠ 승인 어드민)** + 전 건 감사 로그. 핫월렛/수익월렛 분리 운영.

### 4.3 관리 기능

| 기능 | 내용 |
|---|---|
| **VIP 승인 큐** | 접근 요청 목록 → 승인/거절(사유 필수), 자격 회수·만료 관리 |
| **수수료 설정** | 플랫폼 스프레드(bps), 가스 마진, 부분체결 할인율(기본 90%), venue별 개별 오버라이드 — 변경 이력 저장 |
| **풀 관리** | 풀별 조회·숨김·강제 마감, Roll Order 파라미터 상한(최대 금액, 최소 min fill 등) |
| **계정 밴** | 로그인 차단(사유·기간), 연결 지갑 주소 블랙리스트 동반 등록, 진행 중 거래 처리 방침 선택 |
| **거래 강제 중단** | Roll Order → FROZEN / P2P 에스크로 → 관리자 개입 상태. 해제·강제환불·강제정산 분기 |
| **분쟁 중재** | 증거 뷰어 + 판정 실행 (기존 설계 유지, 실데이터 연결) |

### 4.4 추가 필수 기능 (제안 — 포함 권장)

1. **감사 로그(Audit Log)**: 모든 어드민 행위 불변 기록 (누가·언제·무엇을·이전값→이후값). Treasury·밴·수수료 변경은 특히 필수.
2. **글로벌 킬스위치**: 신규 주문 접수 일시 중지(입금·환불·정산은 계속) — venue 장애·시세 급변 대응.
3. **환불 처리 큐**: KRW 환불은 은행 이체라 수동 개입 발생 → 상태 추적(요청→처리중→완료) 전용 화면.
4. **알림/모니터링**: 대형 주문, 입금-체결 금액 불일치, 핫월렛 잔고 임계치, venue 오류율 급증 시 어드민 알림(텔레그램/이메일).
5. **리스크 플래그**: 계정별 누적 거래량·이상 패턴(분할 입금 등) 자동 플래그 → 수동 검토 큐. (KRW 취급 시 AML 최소선)
6. **공지 배너 관리**: 점검·지연 공지를 유저 화면에 즉시 게시.
7. **어드민 권한 등급**: SUPER / OPS(운영·환불) / VIEWER(조회) — Treasury와 수수료 변경은 SUPER 전용.

### 4.5 신규 화면 디자인 스펙 — 어드민

- 정보밀도 우선의 데스크탑 전용 콘솔(모바일 대응 불필요). 좌측 네비: Dashboard / Rolls / Pools / VIP / Treasury / Fees / Users / Disputes / Logs.
- 대시보드 상단 KPI 타일(수익·거래량·활성 Roll) + 실시간 운영 보드는 상태색 규칙 준수(FROZEN=danger, FILLING=accent green 펄스).
- Treasury 이체 플로우는 3단 확인(금액·주소 재확인 → 2인 승인 대기 → 실행)을 UI로 강제.

---

## 5. 데이터 모델 (신규·변경 테이블)

```
users               id, auth_provider(wallet|social|email), vip_status(none|pending|approved|revoked),
                    vip_expires_at, banned_at, ban_reason, risk_flags[]
vip_access_requests id, user_id, reason, expected_volume, contact, status, reviewed_by, reviewed_at
roll_orders         id, user_id, side, asset, chain, amount_krw, min_fill_pct, expires_at,
                    quote_snapshot(jsonb), est_fee_platform, est_fee_gas, status, deposit_confirmed_at
roll_fills          id, roll_order_id, venue_id, amount_krw, amount_asset, rate, status,
                    tx_hash, gas_actual, executed_by
venues              id, name, adapter_key, enabled, fee_override_bps, health_status
fee_configs         id, key(spread_bps|gas_margin|partial_discount_pct|...), value, venue_id?,
                    changed_by, changed_at        # 이력 보존(업데이트 대신 insert)
refunds             id, roll_order_id, amount_krw, bank_info_enc, status, processed_by
treasury_transfers  id, chain, from_wallet, to_address, amount, token, requested_by,
                    approved_by, status, tx_hash
admin_audit_logs    id, admin_id, action, target_type, target_id, before(jsonb), after(jsonb), at
pools (기존 확장)    + visibility(public|vip), collateral_mode, collateral_pct
```

## 6. API 개요 (전부 신규 — 현재 API 라우트 0개)

```
POST /api/roll/quote            통합 견적 (VIP 가드)
POST /api/roll/orders           주문 생성 → 입금 안내 반환
GET  /api/roll/orders/[id]      상태·Fill 스트림 (Realtime 병행)
POST /api/roll/orders/[id]/cancel
POST /api/vip/request           VIP 접근 요청
GET  /api/pools?scope=public    미승인 계정엔 fiat 풀 미포함 (서버 필터)
--- admin (requireAdmin) ---
GET/POST /api/admin/vip-requests, /fees, /pools, /users/[id]/ban,
         /rolls/[id]/freeze, /treasury/transfers, /audit-logs, /refunds
POST /api/auth/siwe | /email    자체 로그인
```

## 7. 보안 요구사항 (이월 + 신규)

1. **[이월·치명]** `Web3Provider.tsx` TEST_ACCOUNTS fallback 삭제 — Privy 미설정 시 로그인 불가 처리.
2. **[이월·치명]** EscrowVault v2 재작성 (`_settle` 이중지급, 분쟁 정산 잔액 잠김, 수수료 회계 등) + 테스트 스위트 + 외부 감사 권장.
3. **[이월]** 어드민 판별 서버 이전 (클라이언트 상수 `ADMIN_ADDRESSES` 폐기).
4. **[신규]** VIP 게이트는 서버 강제 — fiat 풀·Roll API는 미승인 토큰에 404. 프론트 숨김만으로 처리 금지.
5. **[신규]** Treasury: 화이트리스트 + 2인 승인 + 감사 로그. 핫월렛 키는 서버 KMS/환경변수 분리, 프론트 노출 금지.
6. **[신규]** 환불 계좌 등 PII 암호화 저장, 견적/주문 API 레이트리밋, 입금자명-주문 매칭 검증(제3자 입금 차단).
7. **[신규]** KRW 취급에 따른 규제(특금법 VASP) 검토는 별도 트랙 — 리스크 플래그(4.4-5)는 그 최소선.

## 8. 단계 제안

| 단계 | 내용 |
|---|---|
| P1 | mock 제거·인증 재구축(3종 로그인 통합)·VIP 게이트·어드민 뼈대(가드+승인 큐+감사 로그) |
| P2 | Roll Order: 견적 엔진 + venue 어댑터 2종(Binance/OKX 조회) + 주문·입금·수동 집행 + 정산/환불 |
| P3 | 어드민 완성(Treasury·수수료·밴·강제중단·모니터링), P2P 풀 EscrowVault v2 연결 |
| P4 | 집행 자동화·venue 확장·알림·리스크 플래그 고도화 |

## 9. 확정 필요 사항 (구현 착수 전)

1. venue 운영계정 확보 주체·명의 (거래소별 기업계정 여부)
2. KRW 수취·환불 계좌 운영 방식 (법인계좌 / 입금자명 매칭 규칙)
3. 부분체결 90% 할인 — "min fill 충족 후 만료된 부분체결"에도 동일 적용인지 (본 문서는 '모든 부분체결에 적용'으로 기재)
