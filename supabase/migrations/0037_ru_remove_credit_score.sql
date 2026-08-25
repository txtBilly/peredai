-- 0037_ru_remove_credit_score.sql
-- Russia market (Peredai): there is no credit score and no paid background
-- check. Verification is identity-only (OAuth ID → verification_status).
--
-- This rewrites open_connect_chat to:
--   * gate on identity verification (verification_status = 'verified') instead
--     of the background-check timestamps,
--   * drop the min_credit_score hard block (and the below_min_score error),
--   * stop snapshotting disclosed_credit_score onto the chat.
--
-- The listings.min_credit_score and chats.disclosed_credit_score columns are
-- left in place (nullable, unused) to avoid a destructive change; a later
-- migration can drop them. Apply by hand in the Supabase SQL Editor.

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

  -- Must be identity-verified (OAuth ID). No credit score, no bg check.
  if v_profile.verification_status is distinct from 'verified' then
    raise exception 'not_verified';
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

  -- Must have an available credit.
  select coalesce(sum(amount), 0) into v_balance
  from credit_ledger
  where seeker_id = v_seeker;
  if v_balance < 1 then
    raise exception 'no_credits';
  end if;

  -- One active chat per seeker (index is the backstop; this gives a clean error).
  if exists (select 1 from chats where seeker_id = v_seeker and status = 'active') then
    raise exception 'active_chat_exists';
  end if;

  -- Open the chat with the disclosed-identity snapshot (no credit score in RU).
  insert into chats (
    listing_id, seeker_id, lister_id, status,
    disclosed_seeker_name, disclosed_bg_status
  )
  values (
    p_listing_id, v_seeker, v_listing.lister_id, 'active',
    v_profile.full_name, 'verified'
  )
  returning id into v_chat_id;

  -- Consume one credit, linked to the chat.
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
