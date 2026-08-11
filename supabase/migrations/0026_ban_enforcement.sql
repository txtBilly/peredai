-- Two-tier bans + ban-evasion.
--
-- Tiers:
--   is_shadow_banned  — silent: the member thinks they're active, but they're
--                       hidden AND cannot list or connect.
--   is_banned         — full ban: locked out of the platform (enforced in the
--                       app layer too; see requireUser / banned page).
-- Both block listing and connecting (enforced in the DB below so it can't be
-- bypassed by the client).
--
-- Evasion: when a NEW account matches a banned/shadow-banned account (same phone
-- or same verified name), it's auto-shadow-banned and flagged 'ban_evasion' for
-- admin review — so a banned user can't just re-register and carry on.

alter table profiles add column if not exists is_banned boolean not null default false;
alter table profiles add column if not exists banned_at timestamptz;

-- 1) Connect: block shadow/full-banned seekers.
create or replace function open_connect_chat(p_listing_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seeker    uuid := auth.uid();
  v_profile   record;
  v_listing   record;
  v_balance   int;
  v_chat_id   uuid;
  v_ledger_id uuid;
begin
  if v_seeker is null then
    raise exception 'not_authenticated';
  end if;

  select full_name, credit_score, bg_check_completed_at, bg_check_expires_at,
         is_shadow_banned, is_banned
    into v_profile
  from profiles
  where id = v_seeker;

  -- Banned members (either tier) cannot connect.
  if coalesce(v_profile.is_shadow_banned, false) or coalesce(v_profile.is_banned, false) then
    raise exception 'account_restricted';
  end if;

  -- Must hold a valid, unexpired background check.
  if v_profile.bg_check_completed_at is null
     or v_profile.bg_check_expires_at is null
     or v_profile.bg_check_expires_at <= now() then
    raise exception 'not_verified';
  end if;

  select id, lister_id, min_credit_score, status
    into v_listing
  from listings
  where id = p_listing_id
  for update;

  if v_listing.id is null then
    raise exception 'listing_not_found';
  end if;
  if v_listing.status <> 'active' then
    raise exception 'listing_unavailable';
  end if;
  if v_listing.lister_id = v_seeker then
    raise exception 'own_listing';
  end if;

  if v_listing.min_credit_score is not null
     and (v_profile.credit_score is null or v_profile.credit_score < v_listing.min_credit_score) then
    raise exception 'below_min_score';
  end if;

  select coalesce(sum(amount), 0) into v_balance
  from credit_ledger
  where seeker_id = v_seeker;
  if v_balance < 1 then
    raise exception 'no_credits';
  end if;

  if exists (select 1 from chats where seeker_id = v_seeker and status = 'active') then
    raise exception 'active_chat_exists';
  end if;

  insert into chats (
    listing_id, seeker_id, lister_id, status,
    disclosed_seeker_name, disclosed_credit_score, disclosed_bg_status
  )
  values (
    p_listing_id, v_seeker, v_listing.lister_id, 'active',
    v_profile.full_name, v_profile.credit_score, 'verified'
  )
  returning id into v_chat_id;

  insert into credit_ledger (seeker_id, event, amount, related_chat_id, note)
  values (v_seeker, 'consume', -1, v_chat_id, 'Opened a chat')
  returning id into v_ledger_id;

  update chats set credit_ledger_id = v_ledger_id where id = v_chat_id;
  update listings set status = 'negotiating' where id = p_listing_id;

  return v_chat_id;
end;
$$;

grant execute on function open_connect_chat(uuid) to authenticated;

-- 2) Listing publish: block a restricted lister (duplicate review OR either ban
--    tier). Replaces block_listing_if_duplicate_review from 0025.
drop trigger if exists trg_block_listing_if_duplicate_review on listings;

create or replace function block_listing_if_restricted()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.status = 'active'
     and exists (
       select 1 from profiles p
       where p.id = new.lister_id
         and (p.duplicate_review is true or p.is_shadow_banned is true or p.is_banned is true)
     )
  then
    raise exception 'account_restricted'
      using hint = 'This account is restricted and cannot publish listings.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_block_listing_if_restricted on listings;
create trigger trg_block_listing_if_restricted
  before insert or update on listings
  for each row
  execute function block_listing_if_restricted();

-- 3) Extend duplicate detection to catch ban evasion.
create or replace function flag_duplicate_profile()
returns trigger
language plpgsql
security definer
as $$
declare
  phone_changed boolean;
  verifying boolean;
  match_id uuid;
  match_shadow boolean;
  match_banned boolean;
begin
  -- Leave already-reviewed / already-banned accounts alone.
  if new.duplicate_review is true or new.is_banned is true then
    return new;
  end if;

  phone_changed := (tg_op = 'INSERT') or (new.phone is distinct from old.phone);

  if tg_op = 'INSERT' then
    verifying := (new.identity_verified_at is not null or new.bg_check_completed_at is not null);
  else
    verifying := (new.identity_verified_at is distinct from old.identity_verified_at)
              or (new.bg_check_completed_at is distinct from old.bg_check_completed_at);
  end if;

  -- Phone match.
  if new.phone is not null and phone_changed then
    select o.id, o.is_shadow_banned, o.is_banned
      into match_id, match_shadow, match_banned
    from profiles o
    where o.id <> new.id and o.deleted_at is null and o.phone = new.phone
    limit 1;
    if match_id is not null then
      new.duplicate_reason := 'phone';
    end if;
  end if;

  -- Verified-name match (only at the verification moment, and only if no phone match).
  if match_id is null and new.full_name is not null and btrim(new.full_name) <> '' and verifying then
    select o.id, o.is_shadow_banned, o.is_banned
      into match_id, match_shadow, match_banned
    from profiles o
    where o.id <> new.id
      and o.deleted_at is null
      and (o.identity_verified_at is not null or o.bg_check_completed_at is not null)
      and lower(btrim(o.full_name)) = lower(btrim(new.full_name))
    limit 1;
    if match_id is not null then
      new.duplicate_reason := 'verified_name';
    end if;
  end if;

  if match_id is not null then
    new.duplicate_matched_id := match_id;
    new.duplicate_review := true;
    -- Ban evasion: the matched account is banned → auto-restrict this one
    -- (silent shadow-ban) pending admin review.
    if coalesce(match_banned, false) or coalesce(match_shadow, false) then
      new.is_shadow_banned := true;
      new.duplicate_reason := 'ban_evasion';
    end if;
  end if;

  return new;
end;
$$;

-- Trigger definition unchanged from 0025; function body above is the update.
drop trigger if exists trg_flag_duplicate_profile on profiles;
create trigger trg_flag_duplicate_profile
  before insert or update on profiles
  for each row
  execute function flag_duplicate_profile();
