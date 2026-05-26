# TetherRoll OTC — 작업 이어가기 (에이전트 필독)

**이 레포 작업을 이어받는다면 먼저 [`docs/HANDOFF.md`](docs/HANDOFF.md) 를 읽어라.** 현재 상태·남은 작업·검증 방법이 정리돼 있다. 가장 완전한 브랜치는 `feat/auth-gating-mode1` 이다.

> ⚠️ **절대 규칙 — 익명 커밋**: 모든 커밋의 author/committer는 `anonymous <anonymous@users.noreply.github.com>` 여야 하며, 커밋 메시지에 `Co-Authored-By: Claude ...` 트레일러를 **넣지 마라**. 실명·실제 이메일(예: s2753860, culture@culturing.org)도 남기지 마라. (사용자 명시 요청. 상세: HANDOFF.md §0)

설계 기준 문서: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)(자금흐름 SSOT), [`docs/MODE1_MULTISIG.md`](docs/MODE1_MULTISIG.md)(Mode 1).

---

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
