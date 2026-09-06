-- 0046_coupons.sql
-- Discount coupons for the contact-token purchase.
--
-- A coupon can discount the price and/or grant extra tokens (bonus_credits), or
-- be a 100%-off ('free') coupon that grants tokens with no payment. One
-- redemption per account (enforced by the unique constraint below); coupons do
-- not stack (the app applies at most one per purchase).
--
-- All access is via the service-role client (src/lib/coupons.ts). RLS is enabled
-- with NO policies, so anon/authenticated are denied and only the RLS-bypassing
-- service role can read/write — same pattern as the other server-only tables.
--
-- Apply by hand in the Supabase SQL editor.

create table if not exists public.coupons (
  id             uuid primary key default gen_random_uuid(),
  code           text not null unique,            -- stored UPPER-cased; users type case-insensitively
  kind           text not null check (kind in ('percent', 'fixed', 'free')),
  value          integer not null default 0,      -- percent: 0..100; fixed: whole ₽ off; ignored for 'free'
  bonus_credits  integer not null default 0,      -- extra tokens granted on top of the base bundle
  active         boolean not null default true,
  starts_at      timestamptz,                     -- null = no start bound
  expires_at     timestamptz,                     -- null = never expires
  max_redemptions integer,                        -- null = unlimited total uses
  redeemed_count integer not null default 0,
  note           text,
  created_at     timestamptz not null default now(),
  constraint coupons_value_range check (value >= 0 and (kind <> 'percent' or value <= 100))
);

create table if not exists public.coupon_redemptions (
  id                uuid primary key default gen_random_uuid(),
  coupon_id         uuid not null references public.coupons(id) on delete cascade,
  user_id           uuid not null references auth.users(id) on delete cascade,
  amount_discounted integer not null default 0,   -- ₽ taken off at redemption
  credits_granted   integer not null default 0,   -- tokens granted (base + bonus)
  payment_ref       text,                          -- YooKassa payment id, or mock ref
  created_at        timestamptz not null default now(),
  unique (coupon_id, user_id)                      -- one redemption of a coupon per account
);

create index if not exists coupon_redemptions_user_idx on public.coupon_redemptions (user_id);

alter table public.coupons enable row level security;
alter table public.coupon_redemptions enable row level security;
-- Deliberately no policies: server-only (service role) access.

-- ---------------------------------------------------------------------------
-- Example coupons for testing. Remove or edit as needed.
--   TEST100  — 100% off (free): grants the bundle with no payment.
--   TEST50   — 50% off the price.
--   BONUS2   — full price, +2 extra tokens.
-- ---------------------------------------------------------------------------
insert into public.coupons (code, kind, value, bonus_credits, note) values
  ('TEST100', 'free',    0,  0, 'QA: free bundle, no payment'),
  ('TEST50',  'percent', 50, 0, 'QA: 50% off'),
  ('BONUS2',  'fixed',   0,  2, 'QA: +2 bonus tokens, full price')
on conflict (code) do nothing;
