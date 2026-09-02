-- Custody backend columns (docs/CUSTODY_SPEC.md)
-- Add cancel tracking and refund address to support custody trade lifecycle

-- cancel tracking for trades (both parties must confirm cancellation after deposits)
alter table public.trades add column if not exists cancel_requested_by uuid[] default '{}';

-- refund address for legs (captured at trade creation from taker/maker input)
alter table public.custody_legs add column if not exists refund_address text;

-- pool-level maker inputs for DESK trades (captured at pool creation)
alter table public.pools add column if not exists maker_receive_address text;
alter table public.pools add column if not exists maker_refund_address text;
alter table public.pools add column if not exists maker_bank_info_enc text;
