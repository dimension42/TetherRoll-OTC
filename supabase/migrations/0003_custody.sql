-- Desk 거래 (커스터디 에스크로) 스키마 — docs/CUSTODY_SPEC.md §3

create table if not exists public.custody_assets (
  id uuid primary key default gen_random_uuid(),
  chain_key text not null,                       -- 'BTC' | 'TRON' | 'SOLANA' | 'LTC' | ...
  chain_name text not null,
  symbol text not null,
  name text not null,
  decimals int not null default 8,
  kind text not null default 'native' check (kind in ('native','token')),
  token_id text,                                 -- TRC20 컨트랙트 / SPL mint / ERC20 주소
  deposit_address text not null,                 -- 플랫폼 입금 주소
  address_regex text,                            -- 유저 수령 주소 검증용
  explorer_tx_url text,                          -- 'https://mempool.space/tx/{hash}'
  explorer_address_url text,
  verifier text not null default 'manual' check (verifier in ('bitcoin','tron','solana','evm','manual')),
  verifier_config jsonb not null default '{}',
  min_confirmations int not null default 2,
  min_amount numeric not null default 0,         -- minor 단위
  max_amount numeric,
  payout_2p_threshold numeric,                   -- 이 금액 이상 지급은 2인 승인 (null = 항상)
  enabled boolean not null default false,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (chain_key, symbol)
);

alter table public.pools drop constraint if exists pools_kind_check;
alter table public.pools add constraint pools_kind_check check (kind in ('SWAP','FIAT','DESK'));
alter table public.pools
  add column if not exists offer_asset_id uuid references public.custody_assets(id),
  add column if not exists request_asset_id uuid references public.custody_assets(id);

alter table public.trades drop constraint if exists trades_kind_check;
alter table public.trades add constraint trades_kind_check check (kind in ('SWAP','FIAT','DESK'));
alter table public.trades drop constraint if exists trades_status_check;
alter table public.trades add constraint trades_status_check check (status in
  ('PENDING','AWAITING_BOND','ACTIVE','PAID','RELEASED','CONFIRMED','CANCELLED','EXPIRED','DISPUTED','RESOLVED','FAILED',
   'AWAITING_DEPOSITS','DEPOSITED','PAYOUT_PENDING','COMPLETED','REFUNDING','REFUNDED'));

create table if not exists public.custody_legs (
  id uuid primary key default gen_random_uuid(),
  trade_id uuid not null references public.trades(id) on delete cascade,
  side text not null check (side in ('OFFER','REQUEST')),
  owner_id uuid references public.users(id),         -- 입금/송금 의무자
  counterparty_id uuid references public.users(id),  -- 수령자
  kind text not null check (kind in ('CRYPTO','FIAT')),
  asset_id uuid references public.custody_assets(id),
  fiat_currency text,
  amount numeric not null,                            -- minor 단위 정수 / 원화 정수
  amount_with_suffix numeric,                         -- 고유 금액 (CRYPTO)
  deposit_address text,                               -- 플랫폼 주소 스냅샷
  receive_address text,                               -- 상대가 받을 주소 (지급 대상)
  bank_info_enc text,                                 -- FIAT 수령 계좌 (암호화)
  tx_hash text,
  confirmations int not null default 0,
  status text not null default 'PENDING' check (status in
    ('PENDING','SUBMITTED','CONFIRMING','CONFIRMED','FAILED','REFUNDED','SENT','RECEIVED')),
  verified_at timestamptz,
  verified_by text,                                   -- 'auto' | admin user id
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists custody_legs_trade_idx on public.custody_legs (trade_id);
create index if not exists custody_legs_status_idx on public.custody_legs (status);
create unique index if not exists custody_legs_txhash_idx on public.custody_legs (asset_id, tx_hash) where tx_hash is not null;

create table if not exists public.custody_payouts (
  id uuid primary key default gen_random_uuid(),
  trade_id uuid not null references public.trades(id),
  leg_id uuid references public.custody_legs(id),
  asset_id uuid not null references public.custody_assets(id),
  to_address text not null,
  amount numeric not null,
  purpose text not null check (purpose in ('SETTLE','REFUND')),
  requested_by uuid references public.users(id),      -- null = 시스템 자동 생성
  approved_by uuid references public.users(id),
  executed_by uuid references public.users(id),
  tx_hash text,
  status text not null default 'REQUESTED' check (status in ('REQUESTED','APPROVED','EXECUTED','VERIFIED','FAILED','REJECTED')),
  needs_approval boolean not null default true,
  verified_at timestamptz,
  reject_reason text,
  note text,
  created_at timestamptz not null default now(),
  executed_at timestamptz
);
create index if not exists custody_payouts_status_idx on public.custody_payouts (status, created_at);
create index if not exists custody_payouts_trade_idx on public.custody_payouts (trade_id);

alter table public.onchain_txs add column if not exists chain_key text;

alter table public.custody_assets enable row level security;
alter table public.custody_legs enable row level security;
alter table public.custody_payouts enable row level security;
