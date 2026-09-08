-- Pending SBP purchase intents.
--
-- A Tochka SBP QR code carries no arbitrary metadata of ours (unlike a YooKassa
-- payment's metadata), so we persist what each qrcId represents. When a payment
-- for that QR reaches status "Accepted" — learned via polling and/or the Tochka
-- webhook — we look the intent up by qrcId and grant the tokens, recording any
-- coupon redemption. The Tochka operation id (trxId) is the idempotency anchor so
-- polling and the webhook can't double-grant.
--
-- Server-only: RLS is enabled with NO policies, so only the service-role client
-- (createAdminClient) can read/write it. The browser never touches this table.

create table if not exists public.sbp_intents (
  qrc_id        text primary key,
  seeker_id     uuid not null references public.profiles(id) on delete cascade,
  credits       integer not null,
  price_rub     integer not null,            -- rubles charged (records/analytics)
  coupon_id     uuid,
  coupon_code   text,
  discount_rub  integer not null default 0,
  status        text not null default 'pending',  -- pending | accepted | granted | rejected
  trx_id        text,                         -- Tochka operation id (idempotency)
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.sbp_intents enable row level security;

create index if not exists sbp_intents_seeker_idx on public.sbp_intents (seeker_id);
create index if not exists sbp_intents_status_idx on public.sbp_intents (status);
