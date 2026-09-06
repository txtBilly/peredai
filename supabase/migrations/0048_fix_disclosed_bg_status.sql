-- 0048_fix_disclosed_bg_status.sql
-- Fix Model A regression: open_connect_chat (0047) writes the seeker's raw
-- verification_status into chats.disclosed_bg_status. But that column has a CHECK
-- constraint allowing only ('verified', 'none') (migration 0013), while a Model A
-- seeker's status is 'unverified' / 'pending' / NULL. The INSERT therefore fails
-- with a check-violation, which the /api/connect route surfaces as the generic
-- 'connect_failed' (500) — the "Не удалось открыть диалог" error a paying seeker
-- hit when opening a chat.
--
-- Map the status to the two allowed values: 'verified' stays 'verified';
-- everything else discloses as 'none' (not identity-verified).
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

  -- Open the chat, disclosing the seeker's identity status. disclosed_bg_status is
  -- constrained to ('verified','none'): map a Sber-verified seeker to 'verified',
  -- everyone else ('unverified'/'pending'/NULL) to 'none'.
  insert into chats (
    listing_id, seeker_id, lister_id, status,
    disclosed_seeker_name, disclosed_bg_status
  )
  values (
    p_listing_id, v_seeker, v_listing.lister_id, 'active',
    v_profile.full_name,
    case when v_profile.verification_status = 'verified' then 'verified' else 'none' end
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
