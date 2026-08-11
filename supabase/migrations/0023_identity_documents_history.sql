-- Real identity verification (Stripe Identity) support.
--
-- Two goals:
--  1. Store the *verified* ID metadata we're allowed to keep — document type
--     and the LAST 4 of the document number only. The full number is never
--     persisted (Stripe holds the source images for compliance).
--  2. Keep a non-overwriting history of every verification attempt so customer
--     service can audit a user's uploads/sessions from the admin app.

-- Verified ID summary on the profile (source of truth = latest verified attempt).
alter table profiles add column if not exists id_type text;   -- passport | driving_license | id_card
alter table profiles add column if not exists id_last4 text;  -- last 4 of the document number only

-- Append-only audit trail: one row per verification attempt. Nothing here is
-- ever updated in place, so history is preserved.
create table if not exists identity_documents (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references profiles(id) on delete cascade,
  kind           text not null default 'stripe',   -- 'stripe' (vendor-held images) | 'upload' (self-hosted photo)
  storage_path   text,                              -- set when kind='upload' (path in the id-documents bucket)
  vendor_ref     text,                              -- Stripe VerificationSession id when kind='stripe'
  doc_type       text,                              -- passport | driving_license | id_card
  id_last4       text,                              -- last 4 of the document number only
  status         text not null default 'pending',  -- pending | verified | failed
  failure_reason text,
  created_at     timestamptz not null default now()
);

create index if not exists identity_documents_user_idx
  on identity_documents (user_id, created_at desc);

alter table identity_documents enable row level security;

-- A member can create and read their own records; the service role (used by the
-- webhook and admin routes) bypasses RLS entirely.
drop policy if exists "owner inserts identity docs" on identity_documents;
create policy "owner inserts identity docs" on identity_documents for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "owner reads identity docs" on identity_documents;
create policy "owner reads identity docs" on identity_documents for select to authenticated
  using (user_id = auth.uid());

-- Customer-service staff can read everyone's records for audit.
drop policy if exists "staff reads identity docs" on identity_documents;
create policy "staff reads identity docs" on identity_documents for select to authenticated
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_staff = true));
