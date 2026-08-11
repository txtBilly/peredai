-- Duplicate-account detection.
--
-- Policy (per product decision): a suspected duplicate is NOT hard-blocked. The
-- member can still browse and Connect, but cannot publish a listing until an
-- admin clears the flag. Two signals raise it:
--   * phone     — a self-asserted number already used by another account
--                 (checked at signup and whenever the phone changes)
--   * verified_name — the same verified legal name as another verified account
--                 (checked only at the moment identity is verified, so ordinary
--                 profile edits never trip it)
-- The flag is only ever SET by the trigger; it's cleared by an admin.

alter table profiles add column if not exists duplicate_review boolean not null default false;
alter table profiles add column if not exists duplicate_reason text;      -- 'phone' | 'verified_name'
alter table profiles add column if not exists duplicate_matched_id uuid;  -- the account we matched against

create index if not exists profiles_phone_idx on profiles (phone);
create index if not exists profiles_full_name_lower_idx on profiles (lower(btrim(full_name)));

create or replace function flag_duplicate_profile()
returns trigger
language plpgsql
security definer
as $$
declare
  phone_changed boolean;
  verifying boolean;
  match_id uuid;
begin
  -- Never re-flag an account that's already under review.
  if new.duplicate_review is true then
    return new;
  end if;

  phone_changed := (tg_op = 'INSERT') or (new.phone is distinct from old.phone);

  if tg_op = 'INSERT' then
    verifying := (new.identity_verified_at is not null or new.bg_check_completed_at is not null);
  else
    verifying := (new.identity_verified_at is distinct from old.identity_verified_at)
              or (new.bg_check_completed_at is distinct from old.bg_check_completed_at);
  end if;

  -- Phone duplicate.
  if new.phone is not null and phone_changed then
    select o.id into match_id
    from profiles o
    where o.id <> new.id and o.deleted_at is null and o.phone = new.phone
    limit 1;
    if match_id is not null then
      new.duplicate_review := true;
      new.duplicate_reason := 'phone';
      new.duplicate_matched_id := match_id;
      return new;
    end if;
  end if;

  -- Verified-name duplicate (only at the verification moment).
  if new.full_name is not null and btrim(new.full_name) <> '' and verifying then
    select o.id into match_id
    from profiles o
    where o.id <> new.id
      and o.deleted_at is null
      and (o.identity_verified_at is not null or o.bg_check_completed_at is not null)
      and lower(btrim(o.full_name)) = lower(btrim(new.full_name))
    limit 1;
    if match_id is not null then
      new.duplicate_review := true;
      new.duplicate_reason := 'verified_name';
      new.duplicate_matched_id := match_id;
    end if;
  end if;

  return new;
end;
$$;

-- Runs after lock_verified_full_name alphabetically ('f' < 'l'), which is fine:
-- the name check only fires when a verification timestamp advances, which the
-- lock trigger never reverts.
drop trigger if exists trg_flag_duplicate_profile on profiles;
create trigger trg_flag_duplicate_profile
  before insert or update on profiles
  for each row
  execute function flag_duplicate_profile();

-- Enforcement: a flagged lister cannot make a listing public. Draft is fine
-- (not visible to anyone); only the transition to 'active' is blocked.
create or replace function block_listing_if_duplicate_review()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.status = 'active'
     and exists (select 1 from profiles p where p.id = new.lister_id and p.duplicate_review is true)
  then
    raise exception 'duplicate_review_pending'
      using hint = 'This account is pending duplicate review and cannot publish listings.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_block_listing_if_duplicate_review on listings;
create trigger trg_block_listing_if_duplicate_review
  before insert or update on listings
  for each row
  execute function block_listing_if_duplicate_review();
