-- 0047_seekers_no_verify.sql
-- Model A: Sber ID verifies LISTERS only. Seekers no longer verify identity —
-- they pay for tokens (email + name + consent captured at/after payment) and can
-- respond to listings without Sber ID.
--
-- Two changes:
--   1. open_connect_chat: drop the not_verified gate for the seeker, and stamp
--      the chat's disclosed_bg_status with the seeker's REAL status
--      ('verified' only if they happen to be Sber-verified, else 'unverified')
--      instead of hard-coding 'verified'.
--   2. Enforce lister verification server-side: a listing can only go 'active'
--      (be published) if its lister is Sber-verified. Belt-and-braces alongside
--      the middleware /list gate.
--
-- Apply by hand in the Supabase SQL Editor.

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

  select full_name, verification_status
    into v_profile
  from profiles
  where id = v_seeker;

  -- Seekers do NOT need identity verification (Model A). They just need a name
  -- (shown to the lister) and an available token.
  if coalesce(nullif(trim(v_profile.full_name), ''), null) is null then
    raise exception 'name_required';
  end if;

  select id, lister_id, status
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

  -- Must have an available token.
  select coalesce(sum(amount), 0) into v_balance
  from credit_ledger
  where seeker_id = v_seeker;
  if v_balance < 1 then
    raise exception 'no_credits';
  end if;

  -- One active chat per seeker.
  if exists (select 1 from chats where seeker_id = v_seeker and status = 'active') then
    raise exception 'active_chat_exists';
  end if;

  -- Open the chat, disclosing the seeker's real (possibly unverified) status.
  insert into chats (
    listing_id, seeker_id, lister_id, status,
    disclosed_seeker_name, disclosed_bg_status
  )
  values (
    p_listing_id, v_seeker, v_listing.lister_id, 'active',
    v_profile.full_name, coalesce(v_profile.verification_status, 'unverified')
  )
  returning id into v_chat_id;

  -- Consume one token, linked to the chat.
  insert into credit_ledger (seeker_id, event, amount, related_chat_id, note)
  values (v_seeker, 'consume', -1, v_chat_id, 'Opened a chat')
  returning id into v_ledger_id;

  update chats set credit_ledger_id = v_ledger_id where id = v_chat_id;

  -- Lock the listing so no one else can connect to it.
  update listings set status = 'negotiating' where id = p_listing_id;

  return v_chat_id;
end;
$$;

grant execute on function open_connect_chat(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Only a Sber-verified lister may publish (set a listing 'active').
-- ---------------------------------------------------------------------------
create or replace function enforce_lister_verified()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.status = 'active' and (TG_OP = 'INSERT' or OLD.status is distinct from 'active') then
    if (select verification_status from profiles where id = NEW.lister_id) is distinct from 'verified' then
      raise exception 'lister_not_verified';
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_enforce_lister_verified on listings;
create trigger trg_enforce_lister_verified
  before insert or update on listings
  for each row execute function enforce_lister_verified();
