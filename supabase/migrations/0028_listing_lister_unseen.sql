-- Lister red-dot badge. Flags a listing when its status changes so the lister
-- notices: a seeker connected (active → negotiating), the chat closed
-- (negotiating → active), or the listing was discontinued (→ closed). The List
-- nav shows a dot while any of the lister's listings is unseen; opening My
-- Listings clears it (owner update via RLS).
alter table listings
  add column if not exists lister_unseen boolean not null default false;

-- Any status transition marks the listing unseen. Fires inside the same
-- statement as the RPCs that move status (open_connect_chat, close_chat,
-- decline_success, sweep_chat_deadlines, discontinue), so no call site needs to
-- change. Clearing the flag doesn't touch status, so it won't re-trigger.
create or replace function flag_lister_unseen()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status then
    new.lister_unseen := true;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_flag_lister_unseen on listings;
create trigger trg_flag_lister_unseen
  before update on listings
  for each row
  execute function flag_lister_unseen();

-- Fast lookup for the header badge count.
create index if not exists listings_lister_unseen_idx
  on listings (lister_id)
  where lister_unseen;
