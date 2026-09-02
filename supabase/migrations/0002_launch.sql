-- TetherRoll 런칭 스키마 (docs/LAUNCH_PLAN.md §5)
-- 0001 적용 후 SQL Editor에서 실행.

-- ── users 확장 ──
alter table public.users
  add column if not exists session_version int not null default 1,
  add column if not exists primary_wallet text;

-- ── 다중 지갑 ──
create table if not exists public.user_wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  address text not null,                       -- lowercase 0x
  label text,
  source text not null default 'siwe' check (source in ('siwe','privy_embedded','manual')),
  verified_at timestamptz,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  unique (address)
);
create index if not exists user_wallets_user_idx on public.user_wallets (user_id);

-- 기존 users.wallet_address → user_wallets 백필
insert into public.user_wallets (user_id, address, source, verified_at, is_primary)
select id, wallet_address, 'siwe', created_at, true from public.users
where wallet_address is not null
on conflict (address) do nothing;

-- ── 컨트랙트 배포 · 인덱서 커서 ──
create table if not exists public.contract_deployments (
  chain_id int not null,
  name text not null,                           -- 'EscrowVault'
  address text not null,
  deployed_block bigint not null default 0,
  abi_version text not null default 'v2',
  created_at timestamptz not null default now(),
  primary key (chain_id, name)
);

create table if not exists public.indexer_cursors (
  chain_id int not null,
  contract text not null,
  last_block bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (chain_id, contract)
);

-- ── 온체인 트랜잭션 로그 ──
create table if not exists public.onchain_txs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id),
  chain_id int not null,
  hash text not null,
  kind text not null,                           -- 'pool_create' | 'pool_take' | 'pool_cancel' | 'pool_expire' | 'fiat_create' | 'fiat_join' | 'fiat_paid' | 'fiat_release' | 'fiat_cancel' | 'fiat_expire' | 'fiat_dispute' | 'fiat_resolve' | 'approve' | 'roll_payout' | 'treasury'
  ref_type text,                                -- 'pool' | 'trade' | 'roll_fill' | 'treasury_transfer'
  ref_id text,
  status text not null default 'PENDING' check (status in ('PENDING','CONFIRMED','FAILED')),
  block_number bigint,
  gas_used numeric,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  unique (chain_id, hash)
);
create index if not exists onchain_txs_user_idx on public.onchain_txs (user_id, created_at desc);
create index if not exists onchain_txs_ref_idx on public.onchain_txs (ref_type, ref_id);

-- ── 레이트리밋 (외부 의존 없음) ──
create table if not exists public.rate_limits (
  key text primary key,                         -- '<scope>:<id>'
  window_start timestamptz not null,
  count int not null default 0
);

-- ── pools 확장 (온체인 연결) ──
alter table public.pools
  add column if not exists kind text not null default 'SWAP' check (kind in ('SWAP','FIAT')),
  add column if not exists maker_address text,
  add column if not exists offer_token text,           -- 컨트랙트 주소 또는 '0x0000000000000000000000000000000000000000'
  add column if not exists request_token text,
  add column if not exists offer_decimals int,
  add column if not exists request_decimals int,
  add column if not exists offer_amount_wei numeric,   -- bigint 문자열 (실수령량, 인덱서가 갱신)
  add column if not exists request_amount_wei numeric,
  add column if not exists offer_remaining_wei numeric,
  add column if not exists allow_partial boolean not null default true,
  add column if not exists fee_bps int,
  add column if not exists onchain_pool_id bigint,
  add column if not exists create_tx_hash text,
  add column if not exists close_tx_hash text,
  add column if not exists taken_count int not null default 0;

alter table public.pools drop constraint if exists pools_status_check;
alter table public.pools add constraint pools_status_check check (status in
  ('DRAFT','LOCKING','OPEN','PARTIAL','FILLED','MATCHED','CANCELLED','COMPLETED','EXPIRED','HIDDEN'));
alter table public.pools alter column status set default 'DRAFT';
create unique index if not exists pools_onchain_idx on public.pools (chain_id, onchain_pool_id) where onchain_pool_id is not null;
create index if not exists pools_creator_idx on public.pools (creator_id, created_at desc);
create index if not exists pools_expires_idx on public.pools (expires_at) where status in ('OPEN','PARTIAL');

-- ── trades: 스왑 체결 + fiat 트레이드 통합 ──
create table if not exists public.trades (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid references public.pools(id),
  kind text not null check (kind in ('SWAP','FIAT')),
  chain_id int not null,
  maker_id uuid references public.users(id),
  taker_id uuid references public.users(id),
  maker_address text,
  taker_address text,
  -- SWAP
  offer_out_wei numeric,                        -- taker가 받은 offer (수수료 전)
  request_in_wei numeric,                       -- taker가 낸 request
  fee_offer_wei numeric,
  fee_request_wei numeric,
  -- FIAT (seller = 크립토 락, buyer = KRW 송금)
  seller_id uuid references public.users(id),
  buyer_id uuid references public.users(id),
  seller_address text,
  buyer_address text,
  token text,
  amount_wei numeric,
  fiat_currency text,
  fiat_amount numeric,
  bond_token text,
  bond_amount_wei numeric,
  bank_info_enc text,                           -- seller 계좌 (AES-GCM, 서버만 복호화)
  deadline timestamptz,
  release_window_sec int,
  paid_at timestamptz,
  released_at timestamptz,
  onchain_trade_id bigint,
  evidence_hash text,
  -- 공통
  status text not null default 'PENDING' check (status in
    ('PENDING','AWAITING_BOND','ACTIVE','PAID','RELEASED','CONFIRMED','CANCELLED','EXPIRED','DISPUTED','RESOLVED','FAILED')),
  tx_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists trades_pool_idx on public.trades (pool_id);
create index if not exists trades_taker_idx on public.trades (taker_id, created_at desc);
create index if not exists trades_maker_idx on public.trades (maker_id, created_at desc);
create index if not exists trades_party_idx on public.trades (seller_id, buyer_id);
create unique index if not exists trades_onchain_idx on public.trades (chain_id, onchain_trade_id) where onchain_trade_id is not null;
create index if not exists trades_status_idx on public.trades (status);

create table if not exists public.disputes (
  id uuid primary key default gen_random_uuid(),
  trade_id uuid not null references public.trades(id),
  raised_by uuid references public.users(id),
  note text,
  evidence_paths jsonb not null default '[]',   -- Storage 'evidence' 버킷 경로
  evidence_hash text,
  status text not null default 'OPEN' check (status in ('OPEN','UNDER_REVIEW','RESOLVED_BUYER','RESOLVED_SELLER')),
  decision_note text,
  resolved_by uuid references public.users(id),
  resolve_tx_hash text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists disputes_status_idx on public.disputes (status, created_at);

-- ── Roll Order 확장 ──
alter table public.roll_orders
  add column if not exists deposit_code text,                 -- 입금자명 매칭 코드 'TR-XXXXXX'
  add column if not exists deposit_amount_krw numeric,        -- 실제 입금 확인액
  add column if not exists depositor_name text,
  add column if not exists filled_krw numeric not null default 0,
  add column if not exists filled_asset numeric not null default 0,
  add column if not exists fee_actual_platform numeric,
  add column if not exists fee_actual_gas numeric,
  add column if not exists discount_applied numeric,
  add column if not exists refund_krw numeric,
  add column if not exists settled_at timestamptz,
  add column if not exists quote_id uuid;
create unique index if not exists roll_orders_deposit_code_idx on public.roll_orders (deposit_code) where deposit_code is not null;

create table if not exists public.roll_quotes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id),
  side text not null,
  asset text not null,
  chain text not null,
  amount_krw numeric not null,
  slippage_bps int not null default 50,
  venues jsonb not null,                        -- [{id, name, share, rate, amountKrw, amountAsset}]
  est_fee_platform numeric not null,
  est_fee_gas numeric not null,
  total_krw numeric not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists roll_quotes_user_idx on public.roll_quotes (user_id, created_at desc);

alter table public.refunds
  add column if not exists reason text,
  add column if not exists note text;

-- ── 어드민 확장 ──
alter table public.treasury_transfers
  add column if not exists reject_reason text,
  add column if not exists executed_at timestamptz,
  add column if not exists note text;

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  level text not null default 'info' check (level in ('info','warn','danger')),
  active boolean not null default true,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

-- ── RLS 잠금 (신규 테이블) ──
alter table public.user_wallets enable row level security;
alter table public.contract_deployments enable row level security;
alter table public.indexer_cursors enable row level security;
alter table public.onchain_txs enable row level security;
alter table public.rate_limits enable row level security;
alter table public.trades enable row level security;
alter table public.disputes enable row level security;
alter table public.roll_quotes enable row level security;
alter table public.announcements enable row level security;

-- ── Storage: 분쟁 증거 (private) ──
insert into storage.buckets (id, name, public) values ('evidence', 'evidence', false)
on conflict (id) do nothing;

-- ── 시드 보강 (더미 데이터 아님 — 운영 파라미터) ──
insert into public.fee_configs (key, value) values
  ('swap_fee_bps', 30),           -- 온체인 컨트랙트 feeBps와 동일하게 유지 (표시용)
  ('penalty_bps', 1000),
  ('roll_max_amount_krw', 1000000000),
  ('roll_min_fill_pct_floor', 0)
on conflict do nothing;
