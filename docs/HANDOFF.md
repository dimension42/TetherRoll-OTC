# 작업 인계 문서 (Handoff) — 다음 에이전트/개발자용

> 이 문서는 **콜드 스타트로 이 레포 작업을 이어받는 Claude 에이전트(또는 사람)** 를 위한 것이다.
> 먼저 이 문서를 끝까지 읽고, 그다음 `docs/ARCHITECTURE.md`(자금흐름 SSOT) → `docs/MODE1_MULTISIG.md`(Mode 1 설계) 순서로 읽어라.
>
> 최종 갱신: 2026-05-26

---

## 0. ⚠️ 절대 규칙 — 익명 커밋 (READ FIRST)

이 레포의 모든 커밋은 **익명**이어야 한다. 사용자의 명시적 요청이다.

- author/committer = `anonymous <anonymous@users.noreply.github.com>`
- 커밋 메시지에 **`Co-Authored-By: Claude ...` 트레일러를 절대 넣지 말 것** (기본 동작을 끌 것).
- `Culture Korea`, `culture@culturing.org`, 원작성자 `s2753860 / w.cha@sms.ed.ac.uk` 등 **실명·실제 이메일을 커밋·문서·코드에 남기지 말 것**.
- 전체 히스토리는 이미 익명화되어 있다(filter-branch + force-push 완료). 새 커밋이 실명/Claude로 들어가면 즉시 amend로 정리하라.

커밋 명령 예시:
```bash
git -c user.name="anonymous" -c user.email="anonymous@users.noreply.github.com" \
    commit --author="anonymous <anonymous@users.noreply.github.com>" -m "메시지 (Co-Authored-By 줄 없이)"
```
> push가 자격증명 프롬프트로 멈추면 `GIT_TERMINAL_PROMPT=0 git push ...` 로 실행(이미 자격증명은 캐시됨). "fatal: Cannot prompt" 메시지가 떠도 push 자체는 성공한다.

---

## 1. 프로젝트 한 줄 요약

USDT 중심 탈중앙 OTC(장외) 거래 플랫폼. Next.js 14 + Privy + wagmi + Solidity.
거래 처리 방식은 **두 가지**: (대외 표준) **Mode 1 = 2-of-3 공동 멀티시그 에스크로**, (내부 옵션) **Mode 2 = 보증금 하이브리드**. 자세한 자금흐름·결정은 `docs/ARCHITECTURE.md`(D1~D15) 참조.

---

## 2. 브랜치 현황 (⚠️ 아직 main 에 머지 안 됨)

| 브랜치 | 내용 |
|---|---|
| `main` | 레거시 코드(익명화된 원본 히스토리). 신규 작업은 아직 머지 안 됨. |
| `docs/escrow-architecture` | `docs/ARCHITECTURE.md` (자금흐름 SSOT) |
| **`feat/auth-gating-mode1`** | **가장 완전한 브랜치.** 위 문서 + C(로그인 게이팅) 구현 + B(Mode 1) 설계·컨트랙트 전부 포함. **여기서 이어가라.** |

```bash
git fetch origin
git checkout feat/auth-gating-mode1
```
> 작업은 임시 클론에서 진행됐으므로(머신 정리 시 소실), 항상 GitHub에서 다시 클론해 이어간다.

---

## 3. 완료된 것 (DONE)

### 명세 (SSOT)
- `docs/ARCHITECTURE.md` — 자금흐름·에스크로·접근제어 단일 진실 공급원. 결정 **D1~D15 전부 확정**, OQ 전부 해소. 코드 감사 체크리스트(§3~§8) 포함.
- `docs/MODE1_MULTISIG.md` — Mode 1 기술 설계 + 보안 체크리스트(§9) + 구현 단계(§10).

### C — 로그인 게이팅 + Supabase (빌드 통과: `next build` exit 0)
- `src/middleware.ts` — 미인증 시 모든 페이지 → `/login` 강제 (`/api`·정적 제외).
- `src/app/login/page.tsx` — 로그인 전용 화면, **회원가입 불가**, open-redirect 방어.
- `src/app/api/session/route.ts` — Supabase allowlist 검증 후 **HMAC 서명 세션 쿠키** 발급/조회/삭제.
- `src/lib/auth/session.ts` — Edge 호환 HMAC 서명(timing-safe 검증).
- `src/lib/auth/allowlist.ts` + `src/lib/supabase.ts` — allowlist 대조 + 서버 service_role 클라이언트.
- `src/components/auth/SessionSync.tsx` (+ `Web3Provider.tsx` 연결) — 로그인/로그아웃 ↔ 쿠키 동기화, 미허용 시 강제 로그아웃.
- `src/app/api/accounts/route.ts` + admin 페이지 **'계정 관리' 탭** — 어드민만 계정 발급/삭제(회원가입 대체).
- `supabase/migrations/0001_init.sql` — `accounts`/`audit_log` + RLS.
- 개발 폴백: Supabase 미설정 시 로그인 게이트는 유지하되 allowlist만 미강제.

### B — Mode 1 컨트랙트 (테스트 통과: `npx hardhat test` 11 passing)
- `contracts/src/ExpiryRefundModule.sol` — Mode 1의 유일 커스텀 컨트랙트(D12). 데드라인 후 누구나 트리거 → Safe 잔액 전액을 **고정된 A**에게 환불. 목적지/자산 변경자 없음, 1회성, ERC20+native.
- `contracts/src/test/MockSafe.sol`·`MockERC20.sol`, `contracts/test/ExpiryRefundModule.test.js`.
- 워크스페이스 정비: `contracts/package.json`(Hardhat + OZ v5), `hardhat.config.js`(`sources=./src`, `viaIR:true`), `PoolRegistry.sol` 죽은 import 제거.

---

## 4. 검증 방법

```bash
# 프론트(C) 빌드
npm install
npm run build            # → exit 0 기대 (/login, /api/*, Middleware 확인)

# 컨트랙트(B) 테스트
cd contracts
npm install
npx hardhat test         # → 11 passing 기대
```

---

## 5. 남은 작업 (TODO — 우선순위)

### B 잔여 (Mode 1 실제 연동) — `docs/MODE1_MULTISIG.md §10` 체크리스트
1. **Safe Protocol Kit 연동** (`src/lib/safe/*`) — 2-of-3 Safe 예측주소·배포·`ExpiryRefundModule` enable+configure 트랜잭션·정산 배치(USDT→수령자 + 수수료→feeRecipient) 빌더.
   - 자격증명 불필요(빌더·타입검증 가능) → **가장 먼저 착수 권장.** deps: `@safe-global/protocol-kit`, `@safe-global/api-kit`. 인코딩은 이미 설치된 `viem` 활용.
2. **입금 인덱서 + Keeper 워커** — Safe USDT 입금 감지(FUNDED 전이), 데드라인 만료 Safe에 `ExpiryRefundModule.refund(safe)` 호출.
3. **MPC(Fireblocks) 중재 서명 서비스** — 법인 키. 분쟁 시 정당측과 2/3 공동서명. *Fireblocks 계정 필요.*
4. **Mode 1 프론트 UX** — 거래 생성/예치/서명 (wagmi + Safe SDK), 어드민 분쟁 화면 연동.
5. **`ExpiryRefundModule` 통합 테스트** — 실제 Gnosis Safe(@safe-global/safe-contracts) 대상(현재는 MockSafe 단위테스트).

### C 활성화 (코드 변경 없이 설정만)
1. Supabase 프로젝트 생성 → `supabase/migrations/0001_init.sql` 적용.
2. 최초 어드민 시드: 마이그레이션 하단 주석의 `insert ...` 를 본인 값으로 1회 실행.
3. env 설정(§7): `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SESSION_SECRET`, `NEXT_PUBLIC_PRIVY_APP_ID`.

### A — 코드 감사 (사용자가 "마지막에 병렬로" 하기로 함)
`docs/ARCHITECTURE.md §3~§8` + `docs/MODE1_MULTISIG.md §9` 체크리스트 기준. 이미 식별된 의심 버그:
- `contracts/src/EscrowVault.sol`
  - `_settle`: native 분배에 `native / 2` 하드코딩 → 혼합 정산 시 자금 오배분/잠김 위험.
  - `_settleDispute`: 미완성 — 패자 보증금 잔여 반환·승자 페널티 지급 로직이 주석과 불일치(플랫폼 몫만 처리). `escrowId`·`loser` 미사용 경고.
  - native relay fee가 `createEscrow`에서 추적만 되고 `_settle`에서 분리 전송 안 됨.
  - 자금 보유 컨트랙트에 `Pausable`(긴급정지) 없음.
- 신규 인증 코드: 프로덕션에선 `/api/session` 이 Privy 토큰을 서버 검증(`@privy-io/server-auth`)하도록 강화(현재 MVP는 클라가 보낸 신원을 신뢰 + HMAC 쿠키). 미들웨어 가드는 쿠키 위조 방지를 위해 `SESSION_SECRET` 필수.
- 수수료/보증금은 **거래별 설정**(D7) — 전역 상수와 혼용 금지, 전역 max 가드·오버라이드 감사로그(D15) 구현 확인.

---

## 6. 핵심 결정 요약 (상세는 ARCHITECTURE.md §6)

D1 하이브리드+2모드(대외 Mode1) · D2 디폴트→상대방 보상 · D3 오프라인 양측서명 · D4 온체인 원자정산 ·
D5 로그인우선·회원가입불가·어드민발급만 · D6 2-of-3(A,B,법인) 법인 비수탁 · D7 수수료·보증금 거래별설정 ·
D8 Supabase 저장 · D9 수수료부담 생성자 pay/receive · D10 증빙없는 상호확인 · D11 법인키 MPC ·
D12 양측무응답→A환불(타임락모듈) · D13 Safe가스비 A부담 · D14 부분체결 양모드 · D15 어드민오버라이드 분쟁시도 가능(+가드).

---

## 7. 환경변수 (`.env.example` 참조)

```
NEXT_PUBLIC_PRIVY_APP_ID=        # Privy 소셜로그인(미설정 시 테스트 계정 모드)
NEXT_PUBLIC_SUPABASE_URL=        # allowlist 저장소
SUPABASE_SERVICE_ROLE_KEY=       # 서버 전용 (절대 클라 노출 금지)
SESSION_SECRET=                  # 세션 쿠키 HMAC 키 (프로덕션 필수)
DEV_ADMIN_EMAIL=                 # 개발모드에서 admin 역할 부여할 이메일(선택)
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=
SEPOLIA_RPC_URL= / DEPLOYER_PRIVATE_KEY= / ETHERSCAN_API_KEY=   # 컨트랙트 배포용
```

---

## 8. 주의/함정

- `AGENTS.md`의 "This is NOT the Next.js you know"는 create-next-app 기본 보일러플레이트다. 실제 `next`는 **14.2.x**(표준 App Router/middleware 규칙 적용). `eslint-config-next`(16)와 버전 불일치가 있으나 빌드는 통과한다.
- `package.json` name이 `otc-platform`, `@types/react`가 19인데 `react`는 18 — 정리 대상(기능 영향 없음).
- 작업 디렉토리는 임시 클론이므로 **GitHub가 진실**이다. 항상 `git fetch` 후 작업.
