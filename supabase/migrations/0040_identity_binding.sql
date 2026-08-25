-- 0040_identity_binding.sql
-- Anti-abuse identity binding for the RU bank-ID verification (Sber ID / T-ID).
--
--  * profiles.verified_identity_key — HMAC(secret, "provider:sub") of the bank
--    identity that verified this account. UNIQUE (one real identity = one
--    account): a second account cannot verify with the same bank identity.
--  * banned_identities — identity keys that are barred from ever verifying again,
--    so a banned person cannot re-register around the ban.
--
-- Apply by hand in the Supabase SQL editor.

alter table public.profiles
  add column if not exists verified_identity_key text;

create unique index if not exists profiles_verified_identity_key_uidx
  on public.profiles (verified_identity_key)
  where verified_identity_key is not null;

create table if not exists public.banned_identities (
  identity_key text primary key,
  reason       text,
  banned_at    timestamptz not null default now()
);

alter table public.banned_identities enable row level security;
-- No policies → only the service-role (RLS-bypassing) server client can touch it.
