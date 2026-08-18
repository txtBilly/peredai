-- Fix: a lister could request to close a chat whenever the SEEKER's last message
-- was >24h old — even if the seeker had sent the most recent message and was
-- waiting on the lister. Whoever did NOT send the last message owes the next
-- one, so the lister may only request close when the seeker owes the reply
-- (the lister, or nobody, spoke last) AND the seeker has been silent ≥24h.
create or replace function request_close_chat(p_chat_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_chat record;
  v_last record;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;

  select id, seeker_id, lister_id, status, opened_at, lister_close_requested_at
    into v_chat
  from chats where id = p_chat_id for update;

  if v_chat.id is null then raise exception 'chat_not_found'; end if;
  if v_user <> v_chat.lister_id then raise exception 'forbidden'; end if;  -- lister only
  if v_chat.status <> 'active' then raise exception 'chat_not_active'; end if;
  if v_chat.lister_close_requested_at is not null then raise exception 'already_requested'; end if;

  -- Most recent message in the thread (if any).
  select sender_id, created_at into v_last
  from messages
  where chat_id = p_chat_id
  order by created_at desc
  limit 1;

  -- Seeker spoke last → the lister owes the reply; can't claim the seeker is idle.
  if v_last.sender_id = v_chat.seeker_id then
    raise exception 'seeker_awaiting_reply';
  end if;

  -- Seeker owes the next message: require 24h since the last activity
  -- (the lister's last message, or chat open if neither has messaged).
  if coalesce(v_last.created_at, v_chat.opened_at) > now() - interval '24 hours' then
    raise exception 'seeker_recently_active';
  end if;

  update chats set lister_close_requested_at = now() where id = p_chat_id;
end;
$$;

grant execute on function request_close_chat(uuid) to authenticated;
