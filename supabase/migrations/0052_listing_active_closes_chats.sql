-- 0052_listing_active_closes_chats.sql
--
-- Invariant: a listing with status='active' must have NO chat in status='active'
-- (enforced physically by the one_active_chat_per_listing unique index). The
-- app's close/decline/auto-free flows all close the chat BEFORE setting the
-- listing back to 'active', so they keep the invariant. But two paths bypass
-- them and can leave a dangling active chat:
--   * the admin "Восстановить" (moderate → active) button, and
--   * a manual SQL status flip.
-- When that happens, the NEXT open_connect_chat inserts a second active chat on
-- the listing, hits the unique index, and the /api/connect route reports the
-- generic 'connect_failed' (the "Не удалось открыть диалог" error).
--
-- This migration makes recurrence impossible, regardless of caller:
--   1. One-time heal of any currently-inconsistent rows.
--   2. A trigger: whenever a listing transitions INTO 'active', auto-close any
--      still-active chat on it — so the invariant always holds.
--   3. Harden open_connect_chat: map a unique_violation to a clean, mapped error
--      so a seeker can never see a 500 / lose a token to a race.
--
-- Apply by hand in the Supabase SQL Editor.

-- 1. Heal existing inconsistent state (e.g. a listing restored while its chat
--    stayed open). In a correct DB this touches zero rows.
update chats c
   set status = 'closed_didnt_work',
       closed_at = now(),
       closed_reason = 'listing_reactivated'
  from listings l
 where c.listing_id = l.id
   and c.status = 'active'
   and l.status = 'active';

-- 2. Trigger: close any active chat when a listing (re)enters 'active'.
create or replace function free_listing_closes_chats()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update chats
     set status = 'closed_didnt_work',
         closed_at = now(),
         closed_reason = 'listing_reactivated'
   where listing_id = new.id
     and status = 'active';
  return new;
end;
$$;

drop trigger if exists trg_free_listing_closes_chats on listings;
create trigger trg_free_listing_closes_chats
  after update of status on listings
  for each row
  when (new.status = 'active' and old.status is distinct from 'active')
  execute function free_listing_closes_chats();

-- 3. Harden open_connect_chat: a unique_violation on the chat insert (per-listing
--    or per-seeker index) becomes a clean mapped error instead of connect_failed.
--    Because the insert precedes the token consume, a rejected insert never
--    charges the seeker (the transaction rolls back).
create or replace function open_connect_chat(p_listing_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_seeker    uuid := auth.uid();
  v_profile   record;
  v_listing   record;
  v_balance   int;
  v_chat_id   uuid;
  v_ledger_id uuid;
begin
  if v_seeker is null then raise exception 'not_authenticated'; end if;

  select full_name, verification_status into v_profile from profiles where id = v_seeker;
  if coalesce(nullif(trim(v_profile.full_name), ''), null) is null then
    raise exception 'name_required';
  end if;

  select id, lister_id, status into v_listing from listings where id = p_listing_id for update;
  if v_listing.id is null then raise exception 'listing_not_found'; end if;
  if v_listing.status <> 'active' then raise exception 'listing_unavailable'; end if;
  if v_listing.lister_id = v_seeker then raise exception 'own_listing'; end if;

  select coalesce(sum(amount), 0) into v_balance from credit_ledger where seeker_id = v_seeker;
  if v_balance < 1 then raise exception 'no_credits'; end if;

  if exists (select 1 from chats where seeker_id = v_seeker and status = 'active') then
    raise exception 'active_chat_exists';
  end if;

  -- Insert the chat; translate a unique-index collision into a clean error.
  begin
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
  exception
    when unique_violation then
      if exists (select 1 from chats where seeker_id = v_seeker and status = 'active') then
        raise exception 'active_chat_exists';
      else
        raise exception 'listing_unavailable';
      end if;
  end;

  insert into credit_ledger (seeker_id, event, amount, related_chat_id, note)
  values (v_seeker, 'consume', -1, v_chat_id, 'Opened a chat')
  returning id into v_ledger_id;

  update chats set credit_ledger_id = v_ledger_id where id = v_chat_id;
  update listings set status = 'negotiating' where id = p_listing_id;

  return v_chat_id;
end;
$$;

grant execute on function open_connect_chat(uuid) to authenticated;
