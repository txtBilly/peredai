-- 0045_drop_bg_check_profile_columns.sql
-- Deeper background-check cleanup: drop the now-unused profiles.bg_check_* columns.
--
-- The lock_verified_full_name trigger (0014 → 0024) referenced
-- bg_check_completed_at, so we FIRST recreate it to key only off
-- identity_verified_at (the bank ID flow — Sber ID / T-ID — is the sole
-- verification path now), THEN drop the columns.
--
-- ORDER OF DEPLOY: ship the application code that no longer selects these columns
-- BEFORE applying this migration, so no live request selects a dropped column.
--
-- Apply by hand in the Supabase SQL editor.

-- 1. Recreate the name-lock trigger function without bg_check_completed_at.
create or replace function lock_verified_full_name()
returns trigger
language plpgsql
as $$
begin
  -- Legal name is locked once the account has been verified via the bank ID
  -- flow. A legitimate (re)verification is exempt: the verifying update advances
  -- identity_verified_at in the same UPDATE (or the old value was null on first
  -- verify), so new differs from old only for a name-only edit afterwards.
  if new.full_name is distinct from old.full_name
     and old.identity_verified_at is not null
     and new.identity_verified_at is not distinct from old.identity_verified_at
  then
    new.full_name := old.full_name;
  end if;
  return new;
end;
$$;

-- Trigger binding unchanged; the function body above is the update.
drop trigger if exists trg_lock_verified_full_name on profiles;
create trigger trg_lock_verified_full_name
  before update on profiles
  for each row
  execute function lock_verified_full_name();

-- 2. Drop the retired columns.
alter table profiles drop column if exists bg_check_vendor_ref;
alter table profiles drop column if exists bg_check_completed_at;
alter table profiles drop column if exists bg_check_expires_at;
