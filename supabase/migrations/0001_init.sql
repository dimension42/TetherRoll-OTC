-- TetherRoll P1 schema (PRD §5)
-- 적용: Supabase SQL Editor에 붙여넣거나 `supabase db push`

create extension if not exists pgcrypto;

-- ── users: 3종 로그인(이메일/지갑/소셜)을 하나의 계정으로 통합 ──
create table public.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  supabase_uid uuid unique,          -- Supabase auth.users id (이메일 로그인)
  wallet_address text unique,        -- SIWE 지갑 (lowercase)
  privy_did text unique,             -- Privy 소셜
  display_name text,
  role text not null default 'user' check (role in ('user','viewer','ops','admin')),
  vip_status text not null default 'none' check (vip_status in ('none','pending','approved','revoked')),
  vip_expires_at timestamptz,
  banned_at timestamptz,
  ban_reason text,
  risk_flags jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.vip_access_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id),
  reason text not null,
  expected_volume text,
  contact text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reject_reason text,
  reviewed_by uuid references public.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.vip_access_requests (status, created_at desc);

-- ── pools: 기존 P2P 풀 + visibility/담보 확장 ──
create table public.pools (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.users(id),
  visibility text not null default 'public' check (visibility in ('public','vip')),
  trade_type text not null check (trade_type in ('CRYPTO_CRYPTO','CRYPTO_FIAT','FIAT_CRYPTO')),
  offer_symbol text not null,
  offer_chain text,
  offer_amount numeric not null,
  request_symbol text not null,
  request_chain text,
  request_amount numeric not null,
  fiat_currency text,
  collateral_mode text not null default 'NONE' check (collateral_mode in ('NONE','KRW_SIDE_LOCKS')),
  collateral_pct int check (collateral_pct between 10 and 100),
  status text not null default 'OPEN' check (status in ('OPEN','PARTIAL','MATCHED','CANCELLED','COMPLETED','HIDDEN')),
  filled_pct numeric not null default 0,
  chain_id int,
  escrow_id bigint,                  -- EscrowVault v2 onchain id
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.pools (visibility, status, created_at desc);

-- ── Roll Order ──
create table public.venues (
  id text primary key,               -- 'binance-p2p'
  name text not null,
  adapter_key text not null,
  enabled boolean not null default false,
  fee_override_bps int,
  health_status text not null default 'unknown',
  updated_at timestamptz not null default now()
);

create table public.roll_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id),
  side text not null check (side in ('BUY','SELL')),      -- BUY = KRW→crypto
  asset text not null,               -- 'USDT'
  chain text not null,               -- 'TRC20' | 'ERC20' | 'POLYGON' | 'BSC'
  receive_address text,
  amount_krw numeric not null,
  min_fill_pct int not null default 80 check (min_fill_pct between 0 and 100),
  slippage_bps int not null default 50,
  expires_at timestamptz not null,
  quote_snapshot jsonb,              -- venue별 배분·환율 견적
  est_fee_platform numeric,
  est_fee_gas numeric,
  status text not null default 'DRAFT' check (status in
    ('DRAFT','QUOTED','AWAITING_DEPOSIT','FILLING','FILLED','PART_SETTLED','REFUNDED','EXPIRED','FROZEN','CANCELLED')),
  deposit_confirmed_at timestamptz,
  frozen_by uuid references public.users(id),
  frozen_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.roll_orders (user_id, created_at desc);
create index on public.roll_orders (status);

create table public.roll_fills (
  id uuid primary key default gen_random_uuid(),
  roll_order_id uuid not null references public.roll_orders(id),
  venue_id text not null references public.venues(id),
  amount_krw numeric not null,
  amount_asset numeric not null,
  rate numeric not null,
  status text not null default 'PENDING' check (status in ('PENDING','EXECUTED','SENT','FAILED','SKIPPED')),
  tx_hash text,
  gas_actual numeric,
  executed_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.roll_fills (roll_order_id);

-- ── 수수료 설정: 이력 보존(update 대신 insert, 최신값 = 최근 행) ──
create table public.fee_configs (
  id uuid primary key default gen_random_uuid(),
  key text not null,                 -- 'spread_bps' | 'gas_margin_pct' | 'partial_discount_pct' | ...
  value numeric not null,
  venue_id text references public.venues(id),
  changed_by uuid references public.users(id),
  created_at timestamptz not null default now()
);
create index on public.fee_configs (key, created_at desc);

create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  roll_order_id uuid not null references public.roll_orders(id),
  amount_krw numeric not null,
  bank_info_enc text,                -- 암호화 저장 (서버에서 AES-GCM)
  status text not null default 'REQUESTED' check (status in ('REQUESTED','PROCESSING','DONE','FAILED')),
  processed_by uuid references public.users(id),
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.treasury_transfers (
  id uuid primary key default gen_random_uuid(),
  chain text not null,
  from_wallet text not null,
  to_address text not null,
  token text not null,
  amount numeric not null,
  requested_by uuid not null references public.users(id),
  approved_by uuid references public.users(id),  -- 2인 승인: requested_by와 달라야 함(앱 레벨 강제)
  status text not null default 'REQUESTED' check (status in ('REQUESTED','APPROVED','EXECUTED','REJECTED')),
  tx_hash text,
  created_at timestamptz not null default now()
);

create table public.whitelist_addresses (
  id uuid primary key default gen_random_uuid(),
  chain text not null,
  address text not null,
  label text,
  added_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  unique (chain, address)
);

create table public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.users(id),
  action text not null,
  target_type text,
  target_id text,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);
create index on public.admin_audit_logs (created_at desc);

create table public.platform_settings (
  key text primary key,              -- 'kill_switch' | 'announcement' ...
  value jsonb not null,
  updated_by uuid references public.users(id),
  updated_at timestamptz not null default now()
);

-- ── RLS: 전 테이블 잠금. 모든 접근은 서버 API(service role) 경유 ──
alter table public.users enable row level security;
alter table public.vip_access_requests enable row level security;
alter table public.pools enable row level security;
alter table public.venues enable row level security;
alter table public.roll_orders enable row level security;
alter table public.roll_fills enable row level security;
alter table public.fee_configs enable row level security;
alter table public.refunds enable row level security;
alter table public.treasury_transfers enable row level security;
alter table public.whitelist_addresses enable row level security;
alter table public.admin_audit_logs enable row level security;
alter table public.platform_settings enable row level security;

-- ── seed ──
insert into public.venues (id, name, adapter_key, enabled) values
  ('binance-p2p', 'Binance P2P', 'binance', false),
  ('okx-p2p', 'OKX P2P', 'okx', false);

insert into public.fee_configs (key, value) values
  ('spread_bps', 50),            -- 플랫폼 스프레드 0.5%
  ('gas_margin_pct', 10),        -- 가스비 마진 10%
  ('partial_discount_pct', 90);  -- 부분체결 수수료 할인 90%

insert into public.platform_settings (key, value) values
  ('kill_switch', '{"enabled": false}'),
  ('announcement', '{"text": null}');
