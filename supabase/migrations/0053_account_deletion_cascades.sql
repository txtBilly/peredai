-- 0053_account_deletion_cascades.sql
--
-- Account deletion (/api/account/delete) anonymizes the profile then hard-deletes
-- the auth user, expecting the delete to "cascade any remaining rows linked via
-- FK". But several foreign keys were created without an ON DELETE rule (default
-- NO ACTION / RESTRICT), so once an account has chats, messages, ratings, reports,
-- etc., deleting it fails — the route returns server_error and the UI shows the
-- generic "Что-то пошло не так".
--
-- This aligns every FK in the deletion graph so a profile delete cascades cleanly:
--   * the user's OWN rows (chats they're party to, their messages, ratings) cascade
--   * nullable audit/moderation references are SET NULL so those records survive
--
-- When a profile is deleted (itself cascaded from auth.users), Postgres walks:
--   profiles → chats (seeker/lister) → messages, ratings   (cascade)
--   profiles → listings → chats                            (cascade)
--   nullable links in reports / strikes / intake_requests  (set null)
--
-- Apply by hand in the Supabase SQL Editor. Idempotent (safe to re-run).

do $$
declare
  specs text[] := array[
    -- table | column | referenced table | on-delete action
    'chats|seeker_id|profiles|cascade',
    'chats|lister_id|profiles|cascade',
    'chats|listing_id|listings|cascade',
    'chats|credit_ledger_id|credit_ledger|set null',
    'messages|sender_id|profiles|cascade',
    'ratings|chat_id|chats|cascade',
    'ratings|rater_id|profiles|cascade',
    'ratings|ratee_id|profiles|cascade',
    'reports|reporter_id|profiles|cascade',
    'reports|listing_id|listings|set null',
    'reports|reported_user|profiles|set null',
    'reports|chat_id|chats|set null',
    'reports|reviewed_by|profiles|set null',
    'strikes|listing_id|listings|set null',
    'strikes|report_id|reports|set null',
    'intake_requests|profile_id|profiles|set null',
    'intake_requests|matched_listing|listings|set null'
  ];
  spec text;
  p text[];
  tbl text; col text; ref text; act text;
  conname text;
begin
  foreach spec in array specs loop
    p := string_to_array(spec, '|');
    tbl := p[1]; col := p[2]; ref := p[3]; act := p[4];

    -- Find the existing single-column FK on (tbl, col), whatever it's named.
    select c.conname into conname
    from pg_constraint c
    where c.contype = 'f'
      and c.conrelid = ('public.' || tbl)::regclass
      and c.conkey = array[
        (select a.attnum from pg_attribute a
          where a.attrelid = ('public.' || tbl)::regclass
            and a.attname = col and not a.attisdropped)
      ];

    if conname is not null then
      execute format('alter table public.%I drop constraint %I', tbl, conname);
    end if;

    execute format(
      'alter table public.%I add constraint %I foreign key (%I) references public.%I(id) on delete %s',
      tbl, tbl || '_' || col || '_fkey', col, ref, act
    );
  end loop;
end $$;
