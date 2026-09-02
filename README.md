# TetherRoll OTC

KRW ↔ crypto / crypto ↔ crypto OTC 에스크로 트레이딩 플랫폼.
Next.js 14 (App Router) + Supabase + wagmi/viem. 기획 전문은 [docs/PRD.md](docs/PRD.md).

## 구조 요약

| 영역 | 경로 | 접근 |
|---|---|---|
| Public Market | `/pools` | 누구나 — crypto↔crypto 풀만 |
| VIP Desk | `/vip` | 어드민 승인 계정만 — KRW↔crypto (Roll Order + P2P 풀) |
| Admin Console | `/admin` | 어드민만 (비어드민에겐 404) |

- 인증 3종(이메일 / 지갑 SIWE / Privy 소셜)이 하나의 `users` 계정으로 통합
- 세션: 서버 발급 httpOnly JWT 쿠키(`tr_session`). 데이터 접근은 전부 서버 API(service role) 경유, RLS는 전면 잠금
- fiat 풀은 미승인 계정에게 API 응답에서 아예 제외 (존재 은닉)

## 개발 환경 설정

1. **의존성**: `npm install`
2. **환경변수**: `.env.example` → `.env.local` 복사 후 채우기
   - `SUPABASE_SECRET_KEY`: Supabase 대시보드 → Settings → API Keys → secret key
   - `AUTH_SECRET`: `openssl rand -hex 32`
   - `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`: cloud.walletconnect.com (없으면 injected 지갑만 동작)
   - `NEXT_PUBLIC_PRIVY_APP_ID` / `PRIVY_APP_SECRET`: 소셜 로그인용 (없으면 이메일+지갑만)
3. **DB 마이그레이션**: `supabase/migrations/0001_init.sql`을 Supabase SQL Editor에서 실행
   (또는 `supabase link --project-ref pxhaafmzfawajginidos && supabase db push`)
4. `npm run dev`

## 배포 (Vercel)

- `feat/*` 브랜치 push → 프리뷰 배포, `main` merge → 프로덕션
- Vercel 프로젝트 환경변수에 `.env.example`의 전 항목 등록 필요 (`SUPABASE_SECRET_KEY`, `AUTH_SECRET`는 서버 전용)

## 스크립트

```bash
npm run dev    # 개발 서버
npm run build  # 프로덕션 빌드 (커밋 전 확인)
npm run lint
```

## 온체인 (Phase 3)

`contracts/`의 EscrowVault v1은 **치명적 결함으로 폐기 예정** (정산 이중지급 등, PRD §7).
EscrowVault v2 재작성 + 테스트 스위트 후 배포한다. 현재 프론트는 온체인 정산 미연결 상태.
