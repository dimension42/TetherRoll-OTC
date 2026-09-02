@AGENTS.md

# TetherRoll — Claude Code 규칙

기획 전문: `docs/PRD.md` (Roll Order·VIP Desk·어드민 명세). 새 세션은 PRD부터 읽을 것.

## 핵심 규약

- **데이터 접근**: 클라이언트에서 Supabase 직접 호출 금지. 모든 접근은 `/api/*` 라우트에서 `db()`(service role, `src/lib/db.ts`) 경유. RLS는 전면 잠금 상태.
- **인증 가드** (`src/lib/auth/guards.ts`): API 라우트 첫 줄에 `requireUser()` / `requireVip()` / `requireAdmin()`. 서버 컴포넌트는 `getSessionUser()` + `isAdminUser()` + `notFound()`.
- **VIP 은닉 원칙**: fiat(KRW) 관련 데이터·페이지는 미승인 계정에 404. 프론트 숨김만으로 처리 금지. 공개 화면에 "VIP" 존재를 광고하지 않는다.
- **어드민 행위는 전부 `auditLog()` 기록**. Treasury 이체는 2인 승인(요청≠승인).
- **세션**: httpOnly `tr_session` JWT (jose). 클라이언트 저장소에 계정정보 저장 금지.
- **금액 표기**: 화면에서 돈은 항상 monospace + toLocaleString.
- **스타일**: 다크 전용. bg `#050806`, 딥그린 `#0A2E1F/#123B2A`, 액센트 `#00c9a7`, danger `#FF4D5E`.

## 금지

- mock 데이터 재도입 금지 (P1에서 전량 제거함)
- 테스트 계정 fallback 금지 — 인증 미설정이면 로그인 불가가 정답
- `contracts/` v1 컨트랙트 재사용 금지 (정산 이중지급 결함 — v2 재작성 대상)

## 명령어

```bash
npm run dev / npm run build / npm run lint
```

빌드 통과 확인 후 커밋. 브랜치: `feat/*` → main merge.
