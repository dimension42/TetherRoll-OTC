-- Custody backend columns (docs/CUSTODY_SPEC.md)
-- Add cancel tracking and refund address to support custody trade lifecycle

-- cancel tracking for trades (both parties must confirm cancellation after deposits)
alter table public.trades add column if not exists cancel_requested_by uuid[] default '{}';

-- refund address for legs (captured at trade creation from taker/maker input)
alter table public.custody_legs add column if not exists refund_address text;
