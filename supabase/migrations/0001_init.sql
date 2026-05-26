-- TetherRoll OTC — 접근제어 스키마 (D5 로그인 우선·회원가입 불가·어드민 발급 / D8 Supabase)
-- 적용: supabase db push  또는  Supabase 대시보드 SQL editor 에 붙여넣기

-- ── 계정 (어드민이 발급한 것만 로그인 가능) ───────────────────────────────
create table if not exists public.accounts (
  id          uuid primary key default gen_random_uuid(),
  email       text unique,                    -- 소문자 정규화 권장
  wallet      text unique,                    -- 0x... 소문자
  role        text not null default 'user'    -- 'admin' | 'maker' | 'taker' | 'user'
              check (role in ('admin','maker','taker','user')),
  status      text not null default 'active'  -- 'active' | 'disabled'
              check (status in ('active','disabled')),
  label       text,                           -- 표시용 메모(이름 등)
  created_at  timestamptz not null default now(),
  created_by  text                            -- 발급한 어드민 식별자
);

-- 이메일/지갑 중 하나는 있어야 식별 가능
alter table public.accounts
  drop constraint if exists accounts_identity_present;
alter table public.accounts
  add constraint accounts_identity_present
  check (email is not null or wallet is not null);

create index if not exists accounts_email_idx  on public.accounts (lower(email));
create index if not exists accounts_wallet_idx on public.accounts (lower(wallet));

-- ── 감사 로그 (계정 발급/삭제, 거래별 수수료·보증금 오버라이드 등 D15 가드) ──
create table if not exists public.audit_log (
  id          bigint generated always as identity primary key,
  actor       text,            -- 행위자(어드민 식별자)
  action      text not null,   -- 'account.create' | 'account.disable' | 'fee.override' ...
  target      text,            -- 대상 식별자
  before      jsonb,
  after       jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists audit_log_created_idx on public.audit_log (created_at desc);

-- ── RLS: 익명/일반 사용자는 직접 접근 불가. 서버(서비스 롤)만 조작 ───────────
-- (Next.js 서버 라우트가 SERVICE_ROLE_KEY 로 접근하여 allowlist 검증/계정 발급 수행)
alter table public.accounts  enable row level security;
alter table public.audit_log enable row level security;
-- 별도 policy 미부여 → anon/authenticated 클라이언트는 0행. service_role 은 RLS 우회.

-- ── 최초 어드민 시드 (배포 시 본인 값으로 교체 후 1회 실행) ─────────────────
-- insert into public.accounts (email, role, status, label, created_by)
-- values (lower('ADMIN_EMAIL_HERE'), 'admin', 'active', 'Founder', 'seed')
-- on conflict (email) do update set role = 'admin', status = 'active';
